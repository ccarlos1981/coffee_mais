-- ============================================================
-- Feature A — Follow-up Comercial Inteligente (Sprint 1)
-- Migration: Enums + Tabelas + RLS + Índices + Trigger
-- ============================================================

-- 1. ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE follow_up_status_enum AS ENUM (
    'PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'NAO_EFETIVA', 'CANCELADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE follow_up_origem_enum AS ENUM (
    'COCKPIT_PRESCRITIVO', 'RANKING_PERFORMANCE', 'ALERTA_QUEDA',
    'RPS_COMPROMISSO', 'MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE follow_up_tipo_enum AS ENUM (
    'REATIVACAO_CLIENTE', 'EXPANSAO_MIX', 'RECUPERACAO_VOLUME',
    'NEGOCIACAO_REDE', 'VISITA_COMERCIAL', 'ENVIO_PROPOSTA', 'OUTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE follow_up_prioridade_enum AS ENUM (
    'CRITICA', 'ALTA', 'MEDIA', 'BAIXA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. TABELA PRINCIPAL: cm_follow_up_actions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cm_follow_up_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Cliente
  cliente_id UUID NOT NULL REFERENCES public.cm_clientes(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  rede TEXT,
  
  -- Gerente responsável (VARCHAR para compatibilidade com cm_clientes.manager_id)
  manager_id VARCHAR(50) NOT NULL,
  manager_name TEXT NOT NULL,
  
  -- Origem e classificação
  origem follow_up_origem_enum NOT NULL DEFAULT 'MANUAL',
  origem_ref TEXT,
  tipo_acao follow_up_tipo_enum NOT NULL DEFAULT 'OUTRO',
  
  -- Conteúdo
  motivo TEXT NOT NULL,
  descricao TEXT,
  
  -- Prazos e status
  prazo DATE NOT NULL,
  status follow_up_status_enum NOT NULL DEFAULT 'PENDENTE',
  prioridade follow_up_prioridade_enum NOT NULL DEFAULT 'MEDIA',
  
  -- Resultado
  resultado TEXT,
  motivo_cancelamento TEXT,
  efetividade BOOLEAN,
  
  -- Auditoria
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluded_at TIMESTAMPTZ
);

-- 3. TABELA DE HISTÓRICO: cm_follow_up_history
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cm_follow_up_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES public.cm_follow_up_actions(id) ON DELETE CASCADE,
  status_anterior follow_up_status_enum,
  status_novo follow_up_status_enum NOT NULL,
  observacao TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_follow_up_manager ON public.cm_follow_up_actions(manager_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_status ON public.cm_follow_up_actions(status);
CREATE INDEX IF NOT EXISTS idx_follow_up_prazo ON public.cm_follow_up_actions(prazo);
CREATE INDEX IF NOT EXISTS idx_follow_up_cliente ON public.cm_follow_up_actions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_origem ON public.cm_follow_up_actions(origem);
CREATE INDEX IF NOT EXISTS idx_follow_up_created ON public.cm_follow_up_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_up_history_fk ON public.cm_follow_up_history(follow_up_id);

-- 5. TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_follow_up_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_follow_up_updated_at ON public.cm_follow_up_actions;
CREATE TRIGGER trg_follow_up_updated_at
  BEFORE UPDATE ON public.cm_follow_up_actions
  FOR EACH ROW EXECUTE FUNCTION public.fn_follow_up_updated_at();

-- 6. RLS
-- ============================================================

ALTER TABLE public.cm_follow_up_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_follow_up_history ENABLE ROW LEVEL SECURITY;

-- cm_follow_up_actions: SELECT
-- Gerente vê os seus; Admin/Gestão vê todos
DROP POLICY IF EXISTS follow_up_actions_select ON public.cm_follow_up_actions;
CREATE POLICY follow_up_actions_select ON public.cm_follow_up_actions
  FOR SELECT TO authenticated
  USING (
    manager_id = (SELECT manager_name FROM public.cm_user_profiles WHERE id = auth.uid())
    OR
    (SELECT role FROM public.cm_user_profiles WHERE id = auth.uid()) IN (
      'Admin', 'Admin Master', 'Diretoria', 'Presidência', 'CEO', 'Gerente Nacional'
    )
  );

-- cm_follow_up_actions: INSERT
-- Gerente cria para si; Admin cria para qualquer
DROP POLICY IF EXISTS follow_up_actions_insert ON public.cm_follow_up_actions;
CREATE POLICY follow_up_actions_insert ON public.cm_follow_up_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    manager_id = (SELECT manager_name FROM public.cm_user_profiles WHERE id = auth.uid())
    OR
    (SELECT role FROM public.cm_user_profiles WHERE id = auth.uid()) IN ('Admin', 'Admin Master')
  );

-- cm_follow_up_actions: UPDATE
-- Gerente edita seus (PENDENTE/EM_ANDAMENTO); Admin edita qualquer
DROP POLICY IF EXISTS follow_up_actions_update ON public.cm_follow_up_actions;
CREATE POLICY follow_up_actions_update ON public.cm_follow_up_actions
  FOR UPDATE TO authenticated
  USING (
    (
      manager_id = (SELECT manager_name FROM public.cm_user_profiles WHERE id = auth.uid())
      AND status IN ('PENDENTE', 'EM_ANDAMENTO')
    )
    OR
    (SELECT role FROM public.cm_user_profiles WHERE id = auth.uid()) IN ('Admin', 'Admin Master')
  );

-- cm_follow_up_history: SELECT (acompanha a ação)
DROP POLICY IF EXISTS follow_up_history_select ON public.cm_follow_up_history;
CREATE POLICY follow_up_history_select ON public.cm_follow_up_history
  FOR SELECT TO authenticated
  USING (
    follow_up_id IN (SELECT id FROM public.cm_follow_up_actions)
  );

-- cm_follow_up_history: INSERT (backend via service_role)
DROP POLICY IF EXISTS follow_up_history_insert ON public.cm_follow_up_history;
CREATE POLICY follow_up_history_insert ON public.cm_follow_up_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 7. GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON public.cm_follow_up_actions TO authenticated;
GRANT SELECT, INSERT ON public.cm_follow_up_history TO authenticated;
GRANT ALL ON public.cm_follow_up_actions TO service_role;
GRANT ALL ON public.cm_follow_up_history TO service_role;
