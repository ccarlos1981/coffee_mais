-- ======================================================================
-- MIGRATION: 20260824_sync_ownership_mv_refresh_trigger.sql
-- DESCRIÇÃO: Sincronização automática e assíncrona da dimensão de faturamento
--            quando houver alteração de ownership em cm_redes_matrizes.
-- GOVERNANÇA: Ciclo P1-5.1 / Preservação integral do Ciclo P0 (LOCKED).
-- ======================================================================

CREATE OR REPLACE FUNCTION public.sync_cm_redes_matrizes_to_clientes_safe()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só processa se houve alteração real do gerente da rede
  IF (TG_OP = 'UPDATE' AND (NEW.manager_id IS DISTINCT FROM OLD.manager_id OR NEW.manager IS DISTINCT FROM OLD.manager))
     OR (TG_OP = 'INSERT' AND NEW.manager_id IS NOT NULL) THEN
     
    -- 1. Atualiza todas as lojas vinculadas à rede que NÃO possuem regra regional explícita
    UPDATE public.cm_clientes c
    SET 
      responsavel = NEW.manager,
      manager_name = NEW.manager,
      manager_id = NEW.manager_id
    WHERE c.codigo_matriz = NEW.codigo
      -- Proteção contra loops e updates redundantes: só atualiza se for diferente
      AND (c.manager_id IS DISTINCT FROM NEW.manager_id OR c.responsavel IS DISTINCT FROM NEW.manager)
      -- Proteção 1: NÃO atualiza lojas com exceção regional ativa em cm_base_atendimento_regional
      AND NOT EXISTS (
        SELECT 1 
        FROM public.cm_base_atendimento_regional bar
        WHERE bar.cliente_matriz_id = NEW.codigo
          AND bar.estado = c.uf
          AND bar.ativo = true
      )
      -- Proteção 2: NÃO atualiza lojas com regra especial homologada em cm_regras_apuracao_comercial
      AND NOT EXISTS (
        SELECT 1 
        FROM public.cm_regras_apuracao_comercial rac
        WHERE rac.matriz_nome = NEW.nome
          AND (rac.uf IS NULL OR rac.uf = c.uf)
          AND rac.ativa = true
      );
      
    -- 2. Enfileira refresh assíncrono das Materialized Views (mv_vendas_agg, mv_vendas_mensal, mv_vendas_cliente_mensal, mv_positivacao_sku_mensal)
    --    Garante que a titularidade do faturamento acompanhe o novo ownership em <60s de forma idempotente e não-bloqueante.
    PERFORM public.fn_enqueue_mv_refresh(NULL);
      
  END IF;
  RETURN NEW;
END;
$function$;
