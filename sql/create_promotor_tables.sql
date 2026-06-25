-- =========================================================================
-- MÓDULO PROMOTOR - COFFEE MAIS - FASE 1 (JORNADA, ESCALAS E OCORRÊNCIAS)
-- VERSÃO DESACOPLADA (MINIMIZANDO ACOPLAMENTO COM CORE)
-- =========================================================================

-- =========================================================================
-- 1. Tabela Auxiliar de Geolocalização de PDVs (Desacoplado de base_atendimento)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_pdv_geoloc (
    cod_parceiro TEXT PRIMARY KEY REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 2. Tabela de Mapeamento de Perfil Digital (Desacoplado de cm_employees)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_perfil (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 3. Tabela de Hierarquia Promotor-Supervisor
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_supervisor_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promotor_id)
);

-- =========================================================================
-- 4. Tabela de Mapeamento de PDVs por Promotor (Lojas Fixas de Rota)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_pdv_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    cod_parceiro TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    dia_semana INT CHECK (dia_semana BETWEEN 1 AND 7), -- 1: Segunda, 7: Domingo
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promotor_id, cod_parceiro, dia_semana)
);

-- =========================================================================
-- 5. Tabela de Escala de Trabalho do Promotor (Jornada Contratual Prevista)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_escala (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1: Segunda, 7: Domingo
    hora_entrada TIME NOT NULL,
    hora_saida_intervalo TIME,
    hora_retorno_intervalo TIME,
    hora_saida TIME NOT NULL,
    tolerancia_minutos INT DEFAULT 10 NOT NULL, -- Padrão de tolerância CLT (10 min diários)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, dia_semana)
);

-- =========================================================================
-- 6. Tabela de Controle de Jornada (Ponto Eletrônico - Imutável)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_jornada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE RESTRICT,
    tipo_registro TEXT NOT NULL CHECK (tipo_registro IN ('ENTRADA', 'SAIDA_INTERVALO', 'RETORNO_INTERVALO', 'SAIDA')),
    timestamp_servidor TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    timestamp_dispositivo TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    gps_accuracy DOUBLE PRECISION, -- Em metros
    device_info JSONB, -- Informações de SO/Modelo
    ip_address TEXT,
    is_offline_sync BOOLEAN DEFAULT FALSE NOT NULL,
    foto_comprovante_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 7. Tabela de Ocorrências e Justificativas de Ponto (Ajustes Trabalhistas)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_jornada_ocorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    tipo_ajuste TEXT NOT NULL CHECK (tipo_ajuste IN ('FALTA_BATIDA', 'ATRASO_JUSTIFICADO', 'ATESTADO_MEDICO', 'FOLGA_COMPENSATORIA', 'OUTRO')),
    data_ocorrencia DATE NOT NULL,
    tipo_registro_afetado TEXT NOT NULL CHECK (tipo_registro_afetado IN ('ENTRADA', 'SAIDA_INTERVALO', 'RETORNO_INTERVALO', 'SAIDA', 'DIA_INTEIRO')),
    horario_proposto TIME, -- Caso seja inclusão de batida esquecida
    justificativa TEXT NOT NULL,
    documento_comprovante_url TEXT, -- Link de foto de atestado / recibo
    status TEXT DEFAULT 'PENDENTE' NOT NULL CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
    aprovado_por UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    data_analise TIMESTAMPTZ,
    observacao_supervisor TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 8. Tabela de Banco de Horas (Créditos / Débitos de Minutos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_banco_horas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    data_competencia DATE NOT NULL,
    minutos_trabalhados INT DEFAULT 0 NOT NULL,
    minutos_previstos INT DEFAULT 0 NOT NULL,
    saldo_minutos INT DEFAULT 0 NOT NULL, -- Saldo do dia (positivo ou negativo)
    saldo_acumulado INT DEFAULT 0 NOT NULL, -- Saldo corrente acumulado
    tipo_lancamento TEXT DEFAULT 'CALCULO_DIARIO' NOT NULL CHECK (tipo_lancamento IN ('CALCULO_DIARIO', 'AJUSTE_MANUAL', 'COMPENSACAO')),
    descricao_ajuste TEXT,
    lancado_por UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 9. Tabela de Alertas de Inconsistência de Jornada
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cm_promotor_alertas_jornada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    jornada_id UUID REFERENCES public.cm_promotor_jornada(id) ON DELETE CASCADE,
    tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('ATRASO', 'SAIDA_ANTECIPADA', 'HORA_EXTRA_NAO_AUTORIZADA', 'GPS_IMPRECISO', 'FORA_DA_CERCA', 'SEM_ROSTO_DETECTADO')),
    descricao TEXT NOT NULL,
    resolvido BOOLEAN DEFAULT FALSE NOT NULL,
    resolvido_por UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    observacao_resolucao TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- SECURITY (Row Level Security)
-- =========================================================================
ALTER TABLE public.cm_promotor_pdv_geoloc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_supervisor_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_pdv_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_escala ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_jornada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_jornada_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_banco_horas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_alertas_jornada ENABLE ROW LEVEL SECURITY;

-- 1. Políticas cm_promotor_pdv_geoloc
DROP POLICY IF EXISTS "Leitura livre de geolocalizacao" ON public.cm_promotor_pdv_geoloc;
CREATE POLICY "Leitura livre de geolocalizacao" ON public.cm_promotor_pdv_geoloc FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Gestores editam geolocalizacao" ON public.cm_promotor_pdv_geoloc;
CREATE POLICY "Gestores editam geolocalizacao" ON public.cm_promotor_pdv_geoloc FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);

-- 2. Políticas cm_promotor_perfil
DROP POLICY IF EXISTS "Leitura de perfil promotor" ON public.cm_promotor_perfil;
CREATE POLICY "Leitura de perfil promotor" ON public.cm_promotor_perfil FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins controlam perfil promotor" ON public.cm_promotor_perfil;
CREATE POLICY "Admins controlam perfil promotor" ON public.cm_promotor_perfil FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade'))
);

-- 3. Políticas cm_promotor_supervisor_mapping
DROP POLICY IF EXISTS "Supervisores e admins leem mapeamento" ON public.cm_promotor_supervisor_mapping;
CREATE POLICY "Supervisores e admins leem mapeamento" 
ON public.cm_promotor_supervisor_mapping FOR SELECT 
TO authenticated 
USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('Supervisor', 'CEO', 'Admin', 'Trade')) OR 
    auth.uid() = (SELECT user_id FROM public.cm_promotor_perfil WHERE employee_id = promotor_id)
);
DROP POLICY IF EXISTS "Apenas admin e trade alteram hierarquia" ON public.cm_promotor_supervisor_mapping;
CREATE POLICY "Apenas admin e trade alteram hierarquia" 
ON public.cm_promotor_supervisor_mapping FOR ALL 
TO authenticated 
USING (auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade')));

-- 4. Políticas cm_promotor_pdv_mapping
DROP POLICY IF EXISTS "Qualquer autenticado le mapeamento de pdv" ON public.cm_promotor_pdv_mapping;
CREATE POLICY "Qualquer autenticado le mapeamento de pdv" ON public.cm_promotor_pdv_mapping FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Supervisor e admins alteram mapeamento de pdv" ON public.cm_promotor_pdv_mapping;
CREATE POLICY "Supervisor e admins alteram mapeamento de pdv" ON public.cm_promotor_pdv_mapping FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor')));

-- 5. Políticas cm_promotor_escala
DROP POLICY IF EXISTS "Visualizacao livre de escalas" ON public.cm_promotor_escala;
CREATE POLICY "Visualizacao livre de escalas" ON public.cm_promotor_escala FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Apenas admin e supervisores alteram escala" ON public.cm_promotor_escala;
CREATE POLICY "Apenas admin e supervisores alteram escala" ON public.cm_promotor_escala FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor')));

-- 6. Políticas cm_promotor_jornada (Imutável: Sem UPDATE/DELETE)
DROP POLICY IF EXISTS "Promotor insere proprio ponto" ON public.cm_promotor_jornada;
CREATE POLICY "Promotor insere proprio ponto" ON public.cm_promotor_jornada FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Leitura de jornada propria ou subordinados" ON public.cm_promotor_jornada;
CREATE POLICY "Leitura de jornada propria ou subordinados" ON public.cm_promotor_jornada FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
        SELECT perf.user_id 
        FROM public.cm_promotor_perfil perf
        JOIN public.cm_promotor_supervisor_mapping map ON map.supervisor_id = perf.employee_id
        WHERE map.promotor_id = cm_promotor_jornada.employee_id
    ) OR
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade'))
);

-- 7. Políticas cm_promotor_jornada_ocorrencias (Justificativas)
DROP POLICY IF EXISTS "Promotores leem e criam proprias ocorrencias" ON public.cm_promotor_jornada_ocorrencias;
CREATE POLICY "Promotores leem e criam proprias ocorrencias" 
ON public.cm_promotor_jornada_ocorrencias FOR ALL 
TO authenticated 
USING (
    auth.uid() = (SELECT user_id FROM public.cm_promotor_perfil WHERE employee_id = employee_id)
) WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.cm_promotor_perfil WHERE employee_id = employee_id)
    AND status = 'PENDENTE'
);
DROP POLICY IF EXISTS "Supervisores e admins gerenciam ocorrencias" ON public.cm_promotor_jornada_ocorrencias;
CREATE POLICY "Supervisores e admins gerenciam ocorrencias" ON public.cm_promotor_jornada_ocorrencias FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('Supervisor', 'CEO', 'Admin', 'Trade'))
);

-- 8. Políticas cm_promotor_banco_horas
DROP POLICY IF EXISTS "Leitura de banco de horas proprio ou geral para gestores" ON public.cm_promotor_banco_horas;
CREATE POLICY "Leitura de banco de horas proprio ou geral para gestores" 
ON public.cm_promotor_banco_horas FOR SELECT 
TO authenticated 
USING (
    auth.uid() = (SELECT user_id FROM public.cm_promotor_perfil WHERE employee_id = employee_id) OR
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('Supervisor', 'CEO', 'Admin', 'Trade'))
);
DROP POLICY IF EXISTS "Apenas service_role ou administradores lancam manual" ON public.cm_promotor_banco_horas;
CREATE POLICY "Apenas service_role ou administradores lancam manual" ON public.cm_promotor_banco_horas FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade'))
);

-- 9. Políticas cm_promotor_alertas_jornada
DROP POLICY IF EXISTS "Leitura de alertas de jornada" ON public.cm_promotor_alertas_jornada;
CREATE POLICY "Leitura de alertas de jornada" ON public.cm_promotor_alertas_jornada FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Supervisor e admins resolvem alertas" ON public.cm_promotor_alertas_jornada;
CREATE POLICY "Supervisor e admins resolvem alertas" ON public.cm_promotor_alertas_jornada FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('Supervisor', 'CEO', 'Admin', 'Trade'))
);

-- =========================================================================
-- TRIGGERS DE AUDITORIA AUTOMÁTICA
-- =========================================================================
DROP TRIGGER IF EXISTS audit_cm_promotor_pdv_geoloc ON public.cm_promotor_pdv_geoloc;
CREATE TRIGGER audit_cm_promotor_pdv_geoloc AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_pdv_geoloc FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_perfil ON public.cm_promotor_perfil;
CREATE TRIGGER audit_cm_promotor_perfil AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_perfil FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_supervisor_mapping ON public.cm_promotor_supervisor_mapping;
CREATE TRIGGER audit_cm_promotor_supervisor_mapping AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_supervisor_mapping FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_pdv_mapping ON public.cm_promotor_pdv_mapping;
CREATE TRIGGER audit_cm_promotor_pdv_mapping AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_pdv_mapping FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_escala ON public.cm_promotor_escala;
CREATE TRIGGER audit_cm_promotor_escala AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_escala FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_jornada ON public.cm_promotor_jornada;
CREATE TRIGGER audit_cm_promotor_jornada AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_jornada FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_jornada_ocorrencias ON public.cm_promotor_jornada_ocorrencias;
CREATE TRIGGER audit_cm_promotor_jornada_ocorrencias AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_jornada_ocorrencias FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_banco_horas ON public.cm_promotor_banco_horas;
CREATE TRIGGER audit_cm_promotor_banco_horas AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_banco_horas FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_alertas_jornada ON public.cm_promotor_alertas_jornada;
CREATE TRIGGER audit_cm_promotor_alertas_jornada AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_alertas_jornada FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();
