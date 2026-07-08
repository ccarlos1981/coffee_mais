-- Migration created on 2026-07-08 for migrating checklists to families

-- 1. Add checklist columns to cm_investimento_familias
ALTER TABLE public.cm_investimento_familias
ADD COLUMN IF NOT EXISTS checklist_comunicacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_logistica BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_auditoria BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_conferencia BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS evidencias_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS fase_familia INT DEFAULT 1;

-- 2. Add commercial columns to cm_acoes_investimento
ALTER TABLE public.cm_acoes_investimento
ADD COLUMN IF NOT EXISTS verba_aprovada BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS contrato_assinado BOOLEAN DEFAULT false;

-- 3. Deploy trigger function to sync checklists
CREATE OR REPLACE FUNCTION public.sync_checklists_to_parent_legacy()
RETURNS trigger AS $$
DECLARE
  v_investimento_id UUID;
  v_comunicacao_ok BOOLEAN;
  v_logistica_ok BOOLEAN;
  v_auditoria_ok BOOLEAN;
  v_conferencia_ok BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_investimento_id := OLD.investimento_id;
  ELSE
    v_investimento_id := NEW.investimento_id;
  END IF;

  -- A. Calculate boolean aggregates (AND logic)
  SELECT 
    COALESCE(bool_and(checklist_comunicacao), false),
    COALESCE(bool_and(checklist_logistica), false),
    COALESCE(bool_and(checklist_auditoria), false),
    COALESCE(bool_and(checklist_conferencia), false)
  INTO 
    v_comunicacao_ok,
    v_logistica_ok,
    v_auditoria_ok,
    v_conferencia_ok
  FROM public.cm_investimento_familias
  WHERE investimento_id = v_investimento_id;

  -- B. Update parent table
  UPDATE public.cm_acoes_investimento
  SET 
    checklist_comunicacao = v_comunicacao_ok,
    checklist_logistica = v_logistica_ok,
    checklist_auditoria = v_auditoria_ok,
    checklist_conferencia = v_conferencia_ok
  WHERE id = v_investimento_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trg_sync_checklists_to_parent_legacy ON public.cm_investimento_familias;
CREATE TRIGGER trg_sync_checklists_to_parent_legacy
AFTER INSERT OR UPDATE OR DELETE ON public.cm_investimento_familias
FOR EACH ROW EXECUTE FUNCTION public.sync_checklists_to_parent_legacy();

-- 5. Backfill existing family records from parent checklists
UPDATE public.cm_investimento_familias f
SET 
  checklist_comunicacao = COALESCE(a.checklist_comunicacao, false),
  checklist_logistica = COALESCE(a.checklist_logistica, false),
  checklist_auditoria = COALESCE(a.checklist_auditoria, false),
  checklist_conferencia = COALESCE(a.checklist_conferencia, false)
FROM public.cm_acoes_investimento a
WHERE f.investimento_id = a.id;
