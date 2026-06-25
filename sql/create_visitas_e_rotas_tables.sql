-- =========================================================================
-- MÓDULO PROMOTOR - COFFEE MAIS - FASE 2 (VISITAS E ROTEIRIZAÇÃO)
-- VERSÃO ATUALIZADA COM AJUSTES OPERACIONAIS E KPI/COMPLIANCE
-- =========================================================================

-- Função Auxiliar: Cálculo Geodésico de Cerca Virtual (Haversine)
CREATE OR REPLACE FUNCTION public.cm_calculate_distance_m(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    R DOUBLE PRECISION := 6371000; -- Raio médio da Terra em metros
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Atualização da Tabela Auxiliar de Geolocalização (Ajuste 1: Raio Dinâmico por PDV)
CREATE TABLE IF NOT EXISTS public.cm_promotor_pdv_geoloc (
    cod_parceiro TEXT PRIMARY KEY REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geofence_radius_m INT DEFAULT 100 NOT NULL CHECK (geofence_radius_m BETWEEN 10 AND 1000), -- Raio customizado por PDV (ex: 30m, 120m, 300m)
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Carteira Operacional de PDVs Recorrentes (Camada 1 - Rota Base)
CREATE TABLE IF NOT EXISTS public.cm_promotor_carteira_pdv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    cod_parceiro TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1: Segunda-feira, 7: Domingo
    duracao_estimada_min INT DEFAULT 60 NOT NULL, -- (Ajuste Final Fase 2)
    ordem_sugerida INT DEFAULT 1 NOT NULL,
    prioridade TEXT DEFAULT 'MEDIA' CHECK (prioridade IN ('ALTA', 'MEDIA', 'BAIXA')),
    criticidade_visita TEXT DEFAULT 'NORMAL' NOT NULL CHECK (criticidade_visita IN ('OBRIGATORIA', 'ALTA', 'NORMAL', 'BAIXA')), -- (Ajuste Final 1)
    motivo_visita TEXT DEFAULT 'rotina' NOT NULL CHECK (motivo_visita IN ('rotina', 'abastecimento', 'ruptura', 'auditoria_trade', 'campanha', 'urgencia')), -- (Ajuste 4)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promotor_id, cod_parceiro, dia_semana)
);

-- 3. Cadastro de Missões Dinâmicas de Trade Marketing (Camada 2 - Missões com Priorização)
CREATE TABLE IF NOT EXISTS public.cm_trade_missao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    sla_minutos INT DEFAULT 30,
    prioridade INT DEFAULT 50 NOT NULL CHECK (prioridade BETWEEN 1 AND 100), -- Priorização Comercial (Ajuste 5)
    checklist_schema JSONB NOT NULL, -- Definição do formulário dinâmico
    created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Mapeamento de Missões Dinâmicas para Lojas/Promotores
CREATE TABLE IF NOT EXISTS public.cm_trade_missao_pdv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    missao_id UUID NOT NULL REFERENCES public.cm_trade_missao(id) ON DELETE CASCADE,
    cod_parceiro TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    promotor_id UUID REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDENTE' NOT NULL CHECK (status IN ('PENDENTE', 'EXECUTADA', 'CANCELADA')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(missao_id, cod_parceiro, promotor_id)
);

-- 5. Agenda Consolidada do Dia (Instanciada automaticamente ao registrar o Ponto de Entrada)
CREATE TABLE IF NOT EXISTS public.cm_promotor_agenda_diaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    jornada_id UUID NOT NULL REFERENCES public.cm_promotor_jornada(id) ON DELETE RESTRICT,
    data_agenda DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promotor_id, data_agenda)
);

-- 6. Execução de Visitas a PDVs (Check-in/Check-out e Geofencing)
CREATE TABLE IF NOT EXISTS public.cm_promotor_visita (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_diaria_id UUID NOT NULL REFERENCES public.cm_promotor_agenda_diaria(id) ON DELETE CASCADE,
    cod_parceiro TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    tipo_visita TEXT DEFAULT 'ROTA_BASE' NOT NULL CHECK (tipo_visita IN ('ROTA_BASE', 'MISSAO_EXTRA', 'AVULSA')),
    criticidade_visita TEXT DEFAULT 'NORMAL' NOT NULL CHECK (criticidade_visita IN ('OBRIGATORIA', 'ALTA', 'NORMAL', 'BAIXA')), -- (Ajuste Final 1)
    motivo_visita TEXT DEFAULT 'rotina' NOT NULL CHECK (motivo_visita IN ('rotina', 'abastecimento', 'ruptura', 'auditoria_trade', 'campanha', 'urgencia')), -- (Ajuste 4)
    status TEXT DEFAULT 'PLANEJADA' NOT NULL CHECK (status IN ('PLANEJADA', 'EM_ROTA', 'CHECKIN_REALIZADO', 'EM_EXECUCAO', 'CONCLUIDA', 'NAO_REALIZADA', 'CANCELADA', 'LOJA_FECHADA')), -- Status detalhado (Ajuste 3)
    
    -- Registro de tempo de deslocamento para KPIs (Ajuste Final 3)
    em_rota_at TIMESTAMPTZ,
    
    -- Dados de Check-in (Sem Biometria Facial, Apenas GPS + Validação Geofencing)
    checkin_servidor TIMESTAMPTZ,
    checkin_dispositivo TIMESTAMPTZ,
    checkin_latitude DOUBLE PRECISION,
    checkin_longitude DOUBLE PRECISION,
    distancia_checkin_metros DOUBLE PRECISION,
    
    -- Dados de Check-out (Sem Biometria, Apenas GPS + Foto de Execução)
    checkout_servidor TIMESTAMPTZ,
    checkout_dispositivo TIMESTAMPTZ,
    checkout_latitude DOUBLE PRECISION,
    checkout_longitude DOUBLE PRECISION,
    checkout_foto_execucao_url TEXT, -- Foto de comprovação de gôndola/display (Ajuste 2)
    distancia_checkout_metros DOUBLE PRECISION,
    
    -- Métricas de Visita (Ajuste Final Fase 2)
    duracao_estimada_min INT DEFAULT 60 NOT NULL,
    duracao_real_min INT,
    justificativa_nao_visita TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Ocorrências na Execução de Loja (Ajuste Final 2)
CREATE TABLE IF NOT EXISTS public.cm_promotor_visita_ocorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID NOT NULL REFERENCES public.cm_promotor_visita(id) ON DELETE CASCADE,
    tipo_ocorrencia TEXT NOT NULL CHECK (tipo_ocorrencia IN ('LOJA_FECHADA', 'ACESSO_NEGADO', 'SEM_ESTOQUE', 'SEM_MATERIAL_MKT', 'RUPTURA_GRAVE', 'OUTRO')),
    descricao TEXT,
    foto_url TEXT, -- Foto do local ou prateleira vazia para auditoria
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Logs de Tentativas de Check-in Bloqueadas para Auditoria de Compliance (Ajuste Final 3 + Anti-Teleporte)
CREATE TABLE IF NOT EXISTS public.cm_promotor_visita_tentativa_bloqueada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    cod_parceiro TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    visita_id UUID REFERENCES public.cm_promotor_visita(id) ON DELETE CASCADE,
    tipo_bloqueio TEXT NOT NULL CHECK (tipo_bloqueio IN ('GPS_FORA_CERCA', 'GPS_INVALIDO', 'LOCALIZACAO_INDISPONIVEL', 'FORA_AGENDA', 'VELOCIDADE_IMPOSSIVEL')),
    latitude_tentada DOUBLE PRECISION NOT NULL,
    longitude_tentada DOUBLE PRECISION NOT NULL,
    distancia_calculada_metros DOUBLE PRECISION,
    foto_tentada_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Respostas e Resultados dos Checklists de Missões Dinâmicas
CREATE TABLE IF NOT EXISTS public.cm_trade_missao_execucao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID NOT NULL REFERENCES public.cm_promotor_visita(id) ON DELETE CASCADE,
    missao_id UUID NOT NULL REFERENCES public.cm_trade_missao(id) ON DELETE RESTRICT,
    respostas_checklist JSONB NOT NULL, -- Respostas do checklist associado
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(visita_id, missao_id)
);

-- =========================================================================
-- ÍNDICES DE PERFORMANCE (Otimização de Consultas de Agenda e Localização)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_carteira_promotor_dia ON public.cm_promotor_carteira_pdv(promotor_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_missao_pdv_promotor ON public.cm_trade_missao_pdv(promotor_id, cod_parceiro);
CREATE INDEX IF NOT EXISTS idx_agenda_diaria_promotor_data ON public.cm_promotor_agenda_diaria(promotor_id, data_agenda);
CREATE INDEX IF NOT EXISTS idx_visita_agenda ON public.cm_promotor_visita(agenda_diaria_id);
CREATE INDEX IF NOT EXISTS idx_visita_status ON public.cm_promotor_visita(status);
CREATE INDEX IF NOT EXISTS idx_visita_criticidade ON public.cm_promotor_visita(criticidade_visita);
CREATE INDEX IF NOT EXISTS idx_visita_ocorrencia_visita ON public.cm_promotor_visita_ocorrencia(visita_id);
CREATE INDEX IF NOT EXISTS idx_visita_bloqueada_promotor ON public.cm_promotor_visita_tentativa_bloqueada(promotor_id);
CREATE INDEX IF NOT EXISTS idx_missao_exec_visita ON public.cm_trade_missao_execucao(visita_id);

-- =========================================================================
-- SECURITY (Row Level Security - RLS)
-- =========================================================================
ALTER TABLE public.cm_promotor_pdv_geoloc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_carteira_pdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_trade_missao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_trade_missao_pdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_agenda_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_visita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_visita_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_visita_tentativa_bloqueada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_trade_missao_execucao ENABLE ROW LEVEL SECURITY;

-- Segurança: cm_promotor_pdv_geoloc
CREATE POLICY "Leitura livre de geolocalizacao" ON public.cm_promotor_pdv_geoloc FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores editam geolocalizacao" ON public.cm_promotor_pdv_geoloc FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);

-- Segurança: cm_promotor_carteira_pdv
CREATE POLICY "Visualizar carteira propria ou geral" ON public.cm_promotor_carteira_pdv FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores administram carteira" ON public.cm_promotor_carteira_pdv FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);

-- Segurança: cm_trade_missao
CREATE POLICY "Leitura livre de missoes" ON public.cm_trade_missao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Apenas criadores autorizados editam missoes" ON public.cm_trade_missao FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade'))
);

-- Segurança: cm_trade_missao_pdv
CREATE POLICY "Leitura de vinculo de missao" ON public.cm_trade_missao_pdv FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores editam vinculo de missao" ON public.cm_trade_missao_pdv FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);

-- Segurança: cm_promotor_agenda_diaria
CREATE POLICY "Leitura de agenda propria ou geral para gestores" ON public.cm_promotor_agenda_diaria FOR SELECT TO authenticated USING (
    auth.uid() = (SELECT user_id FROM public.cm_promotor_perfil WHERE employee_id = promotor_id) OR
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('Supervisor', 'CEO', 'Admin', 'Trade'))
);
CREATE POLICY "Escrita automática de agenda" ON public.cm_promotor_agenda_diaria FOR INSERT WITH CHECK (true);

-- Segurança: cm_promotor_visita
CREATE POLICY "Leitura de visitas" ON public.cm_promotor_visita FOR SELECT TO authenticated USING (true);
CREATE POLICY "Promotores atualizam apenas suas proprias visitas" ON public.cm_promotor_visita FOR ALL TO authenticated USING (
    auth.uid() IN (
        SELECT user_id FROM public.cm_promotor_perfil 
        WHERE employee_id = (SELECT promotor_id FROM public.cm_promotor_agenda_diaria WHERE id = agenda_diaria_id)
    ) OR
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('Supervisor', 'CEO', 'Admin', 'Trade'))
);

-- Segurança: cm_promotor_visita_ocorrencia
CREATE POLICY "Leitura de ocorrencias" ON public.cm_promotor_visita_ocorrencia FOR SELECT TO authenticated USING (true);
CREATE POLICY "Promotores inserem ocorrencias de suas visitas" ON public.cm_promotor_visita_ocorrencia FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (
        SELECT user_id FROM public.cm_promotor_perfil 
        WHERE employee_id = (
            SELECT promotor_id FROM public.cm_promotor_agenda_diaria 
            WHERE id = (SELECT agenda_diaria_id FROM public.cm_promotor_visita WHERE id = visita_id)
        )
    )
);

-- Segurança: cm_promotor_visita_tentativa_bloqueada
CREATE POLICY "Visualizar logs de tentativas" ON public.cm_promotor_visita_tentativa_bloqueada FOR SELECT TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('Supervisor', 'CEO', 'Admin', 'Trade'))
);
CREATE POLICY "Promotores inserem logs de tentativas bloqueadas" ON public.cm_promotor_visita_tentativa_bloqueada FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (
        SELECT user_id FROM public.cm_promotor_perfil WHERE employee_id = promotor_id
    )
);

-- Segurança: cm_trade_missao_execucao
CREATE POLICY "Visualizar execucoes de missoes" ON public.cm_trade_missao_execucao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Promotores inserem execucoes" ON public.cm_trade_missao_execucao FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (
        SELECT user_id FROM public.cm_promotor_perfil 
        WHERE employee_id = (
            SELECT promotor_id FROM public.cm_promotor_agenda_diaria 
            WHERE id = (SELECT agenda_diaria_id FROM public.cm_promotor_visita WHERE id = visita_id)
        )
    )
);

-- =========================================================================
-- TRIGGERS DE AUDITORIA AUTOMÁTICA
-- =========================================================================
DROP TRIGGER IF EXISTS audit_cm_promotor_carteira_pdv ON public.cm_promotor_carteira_pdv;
CREATE TRIGGER audit_cm_promotor_carteira_pdv AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_carteira_pdv FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_trade_missao ON public.cm_trade_missao;
CREATE TRIGGER audit_cm_trade_missao AFTER INSERT OR UPDATE OR DELETE ON public.cm_trade_missao FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_trade_missao_pdv ON public.cm_trade_missao_pdv;
CREATE TRIGGER audit_cm_trade_missao_pdv AFTER INSERT OR UPDATE OR DELETE ON public.cm_trade_missao_pdv FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_visita ON public.cm_promotor_visita;
CREATE TRIGGER audit_cm_promotor_visita AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_visita FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_visita_ocorrencia ON public.cm_promotor_visita_ocorrencia;
CREATE TRIGGER audit_cm_promotor_visita_ocorrencia AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_visita_ocorrencia FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_visita_tentativa_bloqueada ON public.cm_promotor_visita_tentativa_bloqueada;
CREATE TRIGGER audit_cm_promotor_visita_tentativa_bloqueada AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_visita_tentativa_bloqueada FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_trade_missao_execucao ON public.cm_trade_missao_execucao;
CREATE TRIGGER audit_cm_trade_missao_execucao AFTER INSERT OR UPDATE OR DELETE ON public.cm_trade_missao_execucao FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();
