-- =============================================================================
-- Migration: Correção definitiva dos achados da auditoria — Domínio Metas
-- Data: 2026-08-09
-- Escopo:
--   1. Corrigir Marketplace manager_id='Total' → '1006'
--   2. Remover trigger inerte trg_double_write_targets em public.targets
--   3. Validação de segurança: reportar registros sem sufixo (KA)/(Dist)
-- =============================================================================

-- =============================================================================
-- CORREÇÃO 1 — MARKETPLACE
-- =============================================================================
-- Atualiza os 12 registros de Marketplace que possuem manager_id='Total'
-- para o valor oficial manager_id='1006' (conforme CHANNELS e canonical.ts).
-- Idempotente: se já estiver correto, nenhuma linha é afetada.

UPDATE public.targets
SET manager_id = '1006',
    updated_at = NOW()
WHERE manager = 'Marketplace'
  AND manager_id = 'Total';

-- =============================================================================
-- CORREÇÃO 4 — VALIDAÇÃO DE SEGURANÇA
-- =============================================================================
-- Reporta registros de gerentes comerciais que existam sem sufixo (KA)/(Dist).
-- NÃO apaga registros. Apenas gera um aviso (NOTICE) durante a execução.

DO $$
DECLARE
  v_count INTEGER;
  v_detail TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(
    'id=' || id || ' manager=' || manager || ' manager_id=' || manager_id || ' month=' || month,
    '; '
  )
  INTO v_count, v_detail
  FROM public.targets
  WHERE manager IN ('Luiz', 'Leandro', 'Julliano', 'John Guedes')
    AND manager NOT LIKE '%(KA)%'
    AND manager NOT LIKE '%(Dist)%';

  IF v_count > 0 THEN
    RAISE WARNING '[AUDITORIA METAS] Encontrados % registros de gerentes comerciais SEM sufixo (KA)/(Dist): %', v_count, v_detail;
  ELSE
    RAISE NOTICE '[AUDITORIA METAS] Validação OK: ZERO registros de gerentes comerciais sem sufixo.';
  END IF;

  -- Validar Marketplace corrigido
  SELECT COUNT(*) INTO v_count
  FROM public.targets
  WHERE manager = 'Marketplace' AND manager_id = 'Total';

  IF v_count > 0 THEN
    RAISE WARNING '[AUDITORIA METAS] FALHA: Ainda existem % registros de Marketplace com manager_id=Total!', v_count;
  ELSE
    RAISE NOTICE '[AUDITORIA METAS] Validação OK: ZERO registros de Marketplace com manager_id=Total.';
  END IF;

  -- Confirmar Marketplace com manager_id='1006'
  SELECT COUNT(*) INTO v_count
  FROM public.targets
  WHERE manager = 'Marketplace' AND manager_id = '1006';

  RAISE NOTICE '[AUDITORIA METAS] Marketplace com manager_id=1006: % registros.', v_count;
END;
$$;

-- =============================================================================
-- CORREÇÃO 5 — REMOÇÃO DE TRIGGER INERTE
-- =============================================================================
-- A trigger trg_double_write_targets está instalada em public.targets,
-- mas a função tg_fn_double_write_manager() NÃO possui branch para 
-- TG_TABLE_NAME = 'targets'. A trigger é totalmente inerte.
--
-- A função é compartilhada com cm_clientes, base_atendimento (que funcionam)
-- e network_matrix, cm_weekly_projections, sales_legacy, cm_trade_calendario_anual
-- (que também são inertes). Removemos apenas a trigger em targets conforme escopo.
--
-- A função NÃO é removida pois é utilizada por cm_clientes e base_atendimento.

DROP TRIGGER IF EXISTS trg_double_write_targets ON public.targets;
