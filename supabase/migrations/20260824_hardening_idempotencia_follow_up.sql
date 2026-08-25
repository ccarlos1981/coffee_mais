-- ============================================================
-- P3.2D — Hardening da Idempotência da Trilha Comercial
-- Índice Único Parcial para Atomicidade de Ações Abertas
-- ============================================================

-- Garante que não possam coexistir duas ações ABERTAS (PENDENTE ou EM_ANDAMENTO)
-- com a mesma origem e mesma referência de origem (ex: CRM, RPS, ALERTA).
-- Permite que ações encerradas (CONCLUIDA, CANCELADA, NAO_EFETIVA) ou ações manuais sem ref
-- coexistam normalmente.

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_follow_up_active_origem_ref
ON public.cm_follow_up_actions (origem, origem_ref)
WHERE status IN ('PENDENTE', 'EM_ANDAMENTO')
  AND origem IS NOT NULL
  AND origem_ref IS NOT NULL;
