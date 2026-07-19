-- Migration: 20260719162039_fase3_sprint3.2_auditoria.sql
-- Description: Camada de Auditoria, Materialized View e Automação (pg_cron) para a Fase 3

BEGIN;

-- 1. Função Desacoplada de Validação de Existência de Matriz
CREATE OR REPLACE FUNCTION public.check_cliente_matriz_exists(p_codigo_matriz TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_codigo_matriz IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.cm_redes_matrizes
        WHERE codigo::text = p_codigo_matriz
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Função Desacoplada de Validação de Divergência de Atendimento (Ownership)
CREATE OR REPLACE FUNCTION public.check_ownership_divergence(p_codigo_matriz TEXT, p_uf TEXT, p_responsavel TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_responsavel IS DISTINCT FROM public.calcular_responsavel_cliente(p_codigo_matriz, p_uf, p_responsavel);
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Materialized View de Auditoria de Integridade (Excluindo linhas com inconsistência NULL)
-- DIRETRIZ ARQUITETURAL: Toda nova regra de auditoria de qualidade cadastral deverá ser implementada 
-- primeiro em funções auxiliares desacopladas, mantendo a Materialized View exclusivamente como 
-- camada de consolidação de inconsistências ativas.
CREATE MATERIALIZED VIEW public.mv_cadastros_inconsistentes AS
SELECT * FROM (
    SELECT 
        c.codigo AS cliente_codigo,
        c.nome_parceiro,
        c.uf,
        c.codigo_matriz,
        c.responsavel,
        CASE
            WHEN NOT public.check_cliente_uf_validity(c.uf) THEN 'SEM_UF'
            WHEN c.codigo_matriz IS NOT NULL AND NOT public.check_cliente_matriz_exists(c.codigo_matriz) THEN 'MATRIZ_INEXISTENTE'
            WHEN c.codigo_matriz IS NULL AND c.responsavel IS NOT NULL THEN 'GERENTE_SEM_MATRIZ'
            WHEN public.check_ownership_divergence(c.codigo_matriz, c.uf, c.responsavel) THEN 'DIVERGENCIA_OWNERSHIP'
        END AS tipo_inconsistencia
    FROM public.cm_clientes c
    WHERE (c.codigo_matriz IS NOT NULL)
       OR (c.uf IS NOT NULL AND c.responsavel IS NOT NULL)
) sub
WHERE sub.tipo_inconsistencia IS NOT NULL;

-- 4. Índices de Busca Rápida na Materialized View
CREATE UNIQUE INDEX idx_mv_inconsistentes_unique ON public.mv_cadastros_inconsistentes (cliente_codigo, tipo_inconsistencia);
CREATE INDEX idx_mv_inconsistentes_tipo ON public.mv_cadastros_inconsistentes (tipo_inconsistencia);

-- 5. Função Security Definer para Geração de Snapshots Históricos (Protegida contra divisão por zero)
CREATE OR REPLACE FUNCTION public.take_cadastros_quality_snapshot(p_source TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_c INTEGER;
    v_sem_resp INTEGER;
    v_sem_uf INTEGER;
    v_sem_matriz INTEGER;
    v_total_inconsistencias INTEGER;
    v_iqc NUMERIC(5,2);
    v_cobertura NUMERIC(5,2);
BEGIN
    SELECT COUNT(*) INTO v_total_c FROM public.cm_clientes;
    SELECT COUNT(*) INTO v_sem_resp FROM public.cm_clientes WHERE responsavel IS NULL;
    SELECT COUNT(*) INTO v_sem_uf FROM public.cm_clientes WHERE uf IS NULL OR uf = '';
    SELECT COUNT(*) INTO v_sem_matriz FROM public.cm_clientes WHERE codigo_matriz IS NULL;
    
    -- Conta apenas as inconsistências da Materialized View
    SELECT COUNT(DISTINCT cliente_codigo) INTO v_total_inconsistencias FROM public.mv_cadastros_inconsistentes;
    
    -- Proteção robusta contra divisão por zero em bases vazias
    IF v_total_c = 0 THEN
        v_iqc := 100.00;
        v_cobertura := 100.00;
    ELSE
        v_iqc := ((v_total_c - v_total_inconsistencias)::numeric / v_total_c::numeric) * 100;
        v_cobertura := (((v_total_c - v_sem_resp)::numeric) / v_total_c::numeric) * 100;
    END IF;

    INSERT INTO public.cm_cadastros_qualidade_snapshots 
        (total_clientes, sem_responsavel, sem_uf, sem_matriz, total_inconsistencias, iqc_score, cobertura_score, baseline_version, audit_rules_version, execution_source)
    VALUES 
        (v_total_c, v_sem_resp, v_sem_uf, v_sem_matriz, v_total_inconsistencias, v_iqc, v_cobertura, 'v1.0.1', 'v1.0.0', p_source)
    ON CONFLICT (snapshot_date) DO UPDATE SET
        total_clientes = EXCLUDED.total_clientes,
        total_inconsistencias = EXCLUDED.total_inconsistencias,
        iqc_score = EXCLUDED.iqc_score,
        cobertura_score = EXCLUDED.cobertura_score,
        execution_source = EXCLUDED.execution_source;
  END;
$$;

-- 6. Garantir Idempotência nos Agendamentos pg_cron (Remoção prévia segura)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_inconsistencias') THEN
        PERFORM cron.unschedule('refresh_mv_inconsistencias');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'take_quality_snapshot_weekly') THEN
        PERFORM cron.unschedule('take_quality_snapshot_weekly');
    END IF;
END $$;

-- 7. Programação dos Cron Jobs
-- 7.1. Refresh concorrente da materialized view (diário às 02:30 AM)
SELECT cron.schedule('refresh_mv_inconsistencias', '30 2 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cadastros_inconsistentes');

-- 7.2. Captura automática de snapshot histórico (semanal às segundas às 03:00 AM)
SELECT cron.schedule('take_quality_snapshot_weekly', '0 3 * * 1', 'SELECT public.take_cadastros_quality_snapshot(''cron'')');

-- 8. Registrar o Metadado da Execução desta Migration
INSERT INTO public.cm_governance_schema_history (baseline_version, fase, sprint, migration_name)
VALUES ('v1.0.1', 'Fase 3', 'Sprint 3.2', '20260719162039_fase3_sprint3.2_auditoria.sql');

COMMIT;
