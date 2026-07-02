-- 1. Logs de Importação com Lifecycle Completo
CREATE TABLE IF NOT EXISTS public.cm_dre_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    imported_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_ms BIGINT,
    source TEXT NOT NULL CHECK (source IN ('excel', 'bigquery')),
    rows_imported INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN (
        'uploaded', 
        'parsing', 
        'normalizing', 
        'syncing_bigquery', 
        'cache_refresh', 
        'success', 
        'error', 
        'rolled_back'
    )),
    error_log TEXT
);

-- 2. Tabela Staging (RAW)
CREATE TABLE IF NOT EXISTS public.cm_dre_excel_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_log_id UUID REFERENCES public.cm_dre_import_logs(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    raw_data JSONB NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    imported_by UUID REFERENCES auth.users(id)
);

-- 3. Tabela Consolidada DRE (cm_dre_financeiro)
CREATE TABLE IF NOT EXISTS public.cm_dre_financeiro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dre_key TEXT NOT NULL, -- Ex: 2026_07_107395_12_MODERNO_ALL_ALL
    ano INT NOT NULL,
    mes INT NOT NULL,
    codigo_matriz TEXT DEFAULT 'ALL',
    gerente_id TEXT DEFAULT 'ALL',
    canal_id TEXT DEFAULT 'ALL',
    sku_id TEXT DEFAULT 'ALL',
    familia_id TEXT DEFAULT 'ALL',
    
    -- Versionamento & Auditoria
    import_log_id UUID REFERENCES public.cm_dre_import_logs(id),
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Soft Delete
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_reason TEXT,
    
    -- Métricas absolutas (valores em R$ ou Tons)
    volume NUMERIC DEFAULT 0,
    receita_bruta NUMERIC DEFAULT 0,
    impostos NUMERIC DEFAULT 0,
    investimento_comercial NUMERIC DEFAULT 0,
    receita_liquida NUMERIC DEFAULT 0,
    custo_produtos NUMERIC DEFAULT 0,
    frete NUMERIC DEFAULT 0,
    margem_contribuicao NUMERIC DEFAULT 0,
    dga NUMERIC DEFAULT 0,
    custo_rede NUMERIC DEFAULT 0,
    ebitda NUMERIC DEFAULT 0,
    
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    origem TEXT DEFAULT 'EXCEL'
);

-- Índice Único Parcial (Garante unicidade da versão ativa)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dre_financeiro_active_key 
ON public.cm_dre_financeiro (dre_key) 
WHERE is_active = true AND is_deleted = false;

-- Índices de consulta rápida por período
CREATE INDEX IF NOT EXISTS idx_dre_financeiro_filters 
ON public.cm_dre_financeiro(ano, mes, codigo_matriz, gerente_id, canal_id) 
WHERE is_active = true AND is_deleted = false;

-- 4. Tabela de Fechamento Oficial (com Checksum de Integridade)
CREATE TABLE IF NOT EXISTS public.cm_dre_month_closure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ano INT NOT NULL,
    mes INT NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT true,
    
    -- Histórico de Fechamento
    closed_by UUID REFERENCES auth.users(id),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    snapshot_json JSONB NOT NULL,
    snapshot_checksum TEXT NOT NULL, -- md5(snapshot_json::text)
    
    -- Histórico de Reabertura
    reopened_by UUID REFERENCES auth.users(id),
    reopened_at TIMESTAMPTZ,
    reopen_reason TEXT,
    
    CONSTRAINT unique_month_closure UNIQUE (ano, mes)
);

-- 5. Tabela do Motor de Alertas Deduplicados
CREATE TABLE IF NOT EXISTS public.cm_dre_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_hash TEXT UNIQUE NOT NULL, -- md5(ano_mes_alerttype_matriz)
    ano INT NOT NULL,
    mes INT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('RECEITA_QUEDA', 'MARGEM_CRITICA', 'FRETE_ANORMAL', 'INVESTIMENTO_EXCESSIVO')),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    occurrence_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_dre_alerts_lookup 
ON public.cm_dre_alerts(ano, mes, severity) 
WHERE resolved_at IS NULL;

-- 6. Tabela de Metadados de Frescor do Cache (cm_dre_cache_metadata)
CREATE TABLE IF NOT EXISTS public.cm_dre_cache_metadata (
    cache_name TEXT PRIMARY KEY,
    last_refresh_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    refresh_duration_ms BIGINT NOT NULL DEFAULT 0,
    rows_processed INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL
);

-- 7. Trigger de Cálculos Monetários Absolutos
CREATE OR REPLACE FUNCTION public.calculate_dre_absolute_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW.receita_liquida := COALESCE(NEW.receita_bruta, 0) - COALESCE(NEW.impostos, 0) - COALESCE(NEW.investimento_comercial, 0);
    NEW.margem_contribuicao := NEW.receita_liquida - COALESCE(NEW.custo_produtos, 0) - COALESCE(NEW.frete, 0);
    NEW.ebitda := NEW.margem_contribuicao - COALESCE(NEW.dga, 0) - COALESCE(NEW.custo_rede, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropar trigger se existir para evitar erro de re-execução
DROP TRIGGER IF EXISTS tg_calculate_dre_absolute_fields ON public.cm_dre_financeiro;

CREATE TRIGGER tg_calculate_dre_absolute_fields
BEFORE INSERT OR UPDATE ON public.cm_dre_financeiro
FOR EACH ROW EXECUTE FUNCTION public.calculate_dre_absolute_fields();

-- Ativar RLS
ALTER TABLE public.cm_dre_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_excel_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_month_closure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_cache_metadata ENABLE ROW LEVEL SECURITY;

-- Adicionar políticas básicas de RLS para autenticados
CREATE POLICY "Permitir leitura para autenticados em cm_dre_import_logs" ON public.cm_dre_import_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir tudo para autenticados em cm_dre_import_logs" ON public.cm_dre_import_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura para autenticados em cm_dre_excel_raw" ON public.cm_dre_excel_raw FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir tudo para autenticados em cm_dre_excel_raw" ON public.cm_dre_excel_raw FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura para autenticados em cm_dre_financeiro" ON public.cm_dre_financeiro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir tudo para autenticados em cm_dre_financeiro" ON public.cm_dre_financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura para autenticados em cm_dre_month_closure" ON public.cm_dre_month_closure FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir tudo para autenticados em cm_dre_month_closure" ON public.cm_dre_month_closure FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura para autenticados em cm_dre_alerts" ON public.cm_dre_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir tudo para autenticados em cm_dre_alerts" ON public.cm_dre_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura para autenticados em cm_dre_cache_metadata" ON public.cm_dre_cache_metadata FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir tudo para autenticados em cm_dre_cache_metadata" ON public.cm_dre_cache_metadata FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Stored Procedure de Sincronismo DRE (BigQuery -> Supabase) com Advisory Locks
CREATE OR REPLACE FUNCTION public.sync_dre_sales_data(
    p_ano INT,
    p_mes INT,
    p_import_log_id UUID,
    p_uploaded_by UUID,
    p_rows JSONB
)
RETURNS JSONB
AS $$
DECLARE
    v_row RECORD;
    v_dre_key TEXT;
    v_old RECORD;
    v_new_version INT;
    v_processed_count INT := 0;
    v_inserted_count INT := 0;
    v_updated_count INT := 0;
BEGIN
    -- 1. Adquirir lock consultivo a nível de transação para o período
    PERFORM pg_advisory_xact_lock(hashtext('dre_lock_' || p_ano || '_' || p_mes));
    
    -- 2. Verificar se o mês está fechado
    IF EXISTS (
        SELECT 1 FROM public.cm_dre_month_closure 
        WHERE ano = p_ano AND mes = p_mes AND is_closed = true
    ) THEN
        RAISE EXCEPTION 'Mês fechado oficialmente. Alterações não permitidas.';
    END IF;
    
    -- 3. Loop sobre as linhas JSONB recebidas do BigQuery
    FOR v_row IN 
        SELECT 
            (val->>'codigo_matriz') as codigo_matriz,
            (val->>'gerente_id') as gerente_id,
            (val->>'canal_id') as canal_id,
            (val->>'sku_id') as sku_id,
            (val->>'familia_id') as familia_id,
            COALESCE((val->>'volume')::NUMERIC, 0) as volume,
            COALESCE((val->>'receita_bruta')::NUMERIC, 0) as receita_bruta
        FROM jsonb_array_elements(p_rows) as val
    LOOP
        v_processed_count := v_processed_count + 1;
        
        -- Formar a chave técnica dre_key
        v_dre_key := p_ano::text || '_' || p_mes::text || '_' || 
                     UPPER(COALESCE(v_row.codigo_matriz, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.gerente_id, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.canal_id, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.sku_id, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.familia_id, 'ALL'));
                     
        -- Buscar registro ativo anterior
        SELECT * INTO v_old 
        FROM public.cm_dre_financeiro
        WHERE dre_key = v_dre_key AND is_active = true AND is_deleted = false;
        
        IF FOUND THEN
            -- Se os dados de volume e receita bruta forem idênticos, apenas pulamos ou atualizamos metadados
            IF v_old.volume = v_row.volume AND v_old.receita_bruta = v_row.receita_bruta THEN
                -- Apenas atualiza o log de importação e timestamp para auditoria sem alterar versão
                UPDATE public.cm_dre_financeiro
                SET import_log_id = p_import_log_id,
                    uploaded_at = now()
                WHERE id = v_old.id;
            ELSE
                -- Desativar versão anterior
                UPDATE public.cm_dre_financeiro
                SET is_active = false
                WHERE id = v_old.id;
                
                -- Inserir nova versão carregando custos financeiros do Excel
                INSERT INTO public.cm_dre_financeiro (
                    dre_key, ano, mes, codigo_matriz, gerente_id, canal_id, sku_id, familia_id,
                    import_log_id, version, is_active,
                    volume, receita_bruta,
                    impostos, investimento_comercial, custo_produtos, frete, dga, custo_rede,
                    uploaded_by, origem
                ) VALUES (
                    v_dre_key, p_ano, p_mes, v_row.codigo_matriz, v_row.gerente_id, v_row.canal_id, v_row.sku_id, v_row.familia_id,
                    p_import_log_id, v_old.version + 1, true,
                    v_row.volume, v_row.receita_bruta,
                    v_old.impostos, v_old.investimento_comercial, v_old.custo_produtos, v_old.frete, v_old.dga, v_old.custo_rede,
                    p_uploaded_by, 'BIGQUERY'
                );
                
                v_updated_count := v_updated_count + 1;
            END IF;
        ELSE
            -- Inserir novo registro consolidado
            INSERT INTO public.cm_dre_financeiro (
                dre_key, ano, mes, codigo_matriz, gerente_id, canal_id, sku_id, familia_id,
                import_log_id, version, is_active,
                volume, receita_bruta,
                uploaded_by, origem
            ) VALUES (
                v_dre_key, p_ano, p_mes, v_row.codigo_matriz, v_row.gerente_id, v_row.canal_id, v_row.sku_id, v_row.familia_id,
                p_import_log_id, 1, true,
                v_row.volume, v_row.receita_bruta,
                p_uploaded_by, 'BIGQUERY'
            );
            
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'processed', v_processed_count,
        'inserted', v_inserted_count,
        'updated', v_updated_count
    );
END;
$$ LANGUAGE plpgsql;

-- 9. Stored Procedure de Lançamento DRE via Excel com Advisory Locks e Merge
CREATE OR REPLACE FUNCTION public.import_dre_excel_data(
    p_ano INT,
    p_mes INT,
    p_import_log_id UUID,
    p_uploaded_by UUID,
    p_rows JSONB
)
RETURNS JSONB
AS $$
DECLARE
    v_row RECORD;
    v_dre_key TEXT;
    v_old RECORD;
    v_processed_count INT := 0;
    v_inserted_count INT := 0;
    v_updated_count INT := 0;
BEGIN
    -- 1. Adquirir lock consultivo a nível de transação para o período
    PERFORM pg_advisory_xact_lock(hashtext('dre_lock_' || p_ano || '_' || p_mes));
    
    -- 2. Verificar se o mês está fechado
    IF EXISTS (
        SELECT 1 FROM public.cm_dre_month_closure 
        WHERE ano = p_ano AND mes = p_mes AND is_closed = true
    ) THEN
        RAISE EXCEPTION 'Mês fechado oficialmente. Alterações não permitidas.';
    END IF;
    
    -- 3. Loop sobre as linhas JSONB recebidas do Excel
    FOR v_row IN 
        SELECT 
            (val->>'codigo_matriz') as codigo_matriz,
            (val->>'gerente_id') as gerente_id,
            (val->>'canal_id') as canal_id,
            (val->>'sku_id') as sku_id,
            (val->>'familia_id') as familia_id,
            COALESCE((val->>'volume')::NUMERIC, 0) as volume,
            COALESCE((val->>'receita_bruta')::NUMERIC, 0) as receita_bruta,
            COALESCE((val->>'impostos')::NUMERIC, 0) as impostos,
            COALESCE((val->>'investimento_comercial')::NUMERIC, 0) as investimento_comercial,
            COALESCE((val->>'custo_produtos')::NUMERIC, 0) as custo_produtos,
            COALESCE((val->>'frete')::NUMERIC, 0) as frete,
            COALESCE((val->>'dga')::NUMERIC, 0) as dga,
            COALESCE((val->>'custo_rede')::NUMERIC, 0) as custo_rede
        FROM jsonb_array_elements(p_rows) as val
    LOOP
        v_processed_count := v_processed_count + 1;
        
        -- Formar a chave técnica dre_key
        v_dre_key := p_ano::text || '_' || p_mes::text || '_' || 
                     UPPER(COALESCE(v_row.codigo_matriz, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.gerente_id, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.canal_id, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.sku_id, 'ALL')) || '_' || 
                     UPPER(COALESCE(v_row.familia_id, 'ALL'));
                     
        -- Buscar registro ativo anterior
        SELECT * INTO v_old 
        FROM public.cm_dre_financeiro
        WHERE dre_key = v_dre_key AND is_active = true AND is_deleted = false;
        
        IF FOUND THEN
            -- Se os dados financeiros do Excel forem idênticos, apenas atualizamos o log e timestamp
            IF v_old.impostos = v_row.impostos 
               AND v_old.investimento_comercial = v_row.investimento_comercial 
               AND v_old.custo_produtos = v_row.custo_produtos 
               AND v_old.frete = v_row.frete 
               AND v_old.dga = v_row.dga 
               AND v_old.custo_rede = v_row.custo_rede 
               AND v_old.volume = v_row.volume
               AND v_old.receita_bruta = v_row.receita_bruta THEN
                
                UPDATE public.cm_dre_financeiro
                SET import_log_id = p_import_log_id,
                    uploaded_at = now()
                WHERE id = v_old.id;
            ELSE
                -- Desativar versão anterior
                UPDATE public.cm_dre_financeiro
                SET is_active = false
                WHERE id = v_old.id;
                
                -- Inserir nova versão mesclando os dados (preservando faturamento do BigQuery se o Excel não trouxer ou trouxer zerado)
                INSERT INTO public.cm_dre_financeiro (
                    dre_key, ano, mes, codigo_matriz, gerente_id, canal_id, sku_id, familia_id,
                    import_log_id, version, is_active,
                    volume, receita_bruta,
                    impostos, investimento_comercial, custo_produtos, frete, dga, custo_rede,
                    uploaded_by, origem
                ) VALUES (
                    v_dre_key, p_ano, p_mes, v_row.codigo_matriz, v_row.gerente_id, v_row.canal_id, v_row.sku_id, v_row.familia_id,
                    p_import_log_id, v_old.version + 1, true,
                    CASE WHEN v_row.volume > 0 THEN v_row.volume ELSE v_old.volume END,
                    CASE WHEN v_row.receita_bruta > 0 THEN v_row.receita_bruta ELSE v_old.receita_bruta END,
                    v_row.impostos, v_row.investimento_comercial, v_row.custo_produtos, v_row.frete, v_row.dga, v_row.custo_rede,
                    p_uploaded_by, 'EXCEL'
                );
                
                v_updated_count := v_updated_count + 1;
            END IF;
        ELSE
            -- Inserir novo registro consolidado
            INSERT INTO public.cm_dre_financeiro (
                dre_key, ano, mes, codigo_matriz, gerente_id, canal_id, sku_id, familia_id,
                import_log_id, version, is_active,
                volume, receita_bruta,
                impostos, investimento_comercial, custo_produtos, frete, dga, custo_rede,
                uploaded_by, origem
            ) VALUES (
                v_dre_key, p_ano, p_mes, v_row.codigo_matriz, v_row.gerente_id, v_row.canal_id, v_row.sku_id, v_row.familia_id,
                p_import_log_id, 1, true,
                v_row.volume, v_row.receita_bruta,
                v_row.impostos, v_row.investimento_comercial, v_row.custo_produtos, v_row.frete, v_row.dga, v_row.custo_rede,
                p_uploaded_by, 'EXCEL'
            );
            
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'processed', v_processed_count,
        'inserted', v_inserted_count,
        'updated', v_updated_count
    );
END;
$$ LANGUAGE plpgsql;


