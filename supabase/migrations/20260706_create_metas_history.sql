-- ============================================================
-- Migration: Create Promoter Goals Alteration History Audit
-- Date: 07/06/2026
-- ============================================================

-- 1. Create History Audit Table
CREATE TABLE IF NOT EXISTS public.cm_promotor_metas_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_id UUID REFERENCES public.cm_promotor_metas(id) ON DELETE CASCADE,
    promotor_id UUID NOT NULL,
    rede VARCHAR(150) NOT NULL,
    uf VARCHAR(10) NOT NULL,
    mes INTEGER NOT NULL,
    valor_anterior NUMERIC(15, 2),
    valor_novo NUMERIC(15, 2),
    usuario UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    motivo TEXT
);

-- 2. Indexes for Lookup and Chronology Performance
CREATE INDEX IF NOT EXISTS idx_cm_promotor_history_lookup
ON public.cm_promotor_metas_history (promotor_id, rede, uf, mes);

CREATE INDEX IF NOT EXISTS idx_cm_promotor_history_date
ON public.cm_promotor_metas_history (data_hora DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.cm_promotor_metas_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para autenticados" 
ON public.cm_promotor_metas_history
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Permitir escrita apenas do sistema" 
ON public.cm_promotor_metas_history
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true); -- Escrita é disparada via Trigger SECURITY DEFINER

-- 4. Trigger Function to Automatically Log Alterations on volume_target_units
CREATE OR REPLACE FUNCTION public.trg_cm_promotor_metas_history_func()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.volume_target_units IS NOT NULL) THEN
            INSERT INTO public.cm_promotor_metas_history (
                meta_id, promotor_id, rede, uf, mes, valor_anterior, valor_novo, usuario, data_hora
            ) VALUES (
                NEW.id, NEW.promotor_id, NEW.rede, NEW.uf, NEW.month, NULL, NEW.volume_target_units, NEW.updated_by, now()
            );
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only audit if the units goal has changed
        IF (COALESCE(OLD.volume_target_units, -1) <> COALESCE(NEW.volume_target_units, -1)) THEN
            INSERT INTO public.cm_promotor_metas_history (
                meta_id, promotor_id, rede, uf, mes, valor_anterior, valor_novo, usuario, data_hora
            ) VALUES (
                NEW.id, NEW.promotor_id, NEW.rede, NEW.uf, NEW.month, OLD.volume_target_units, NEW.volume_target_units, NEW.updated_by, now()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach History Trigger to cm_promotor_metas
CREATE OR REPLACE TRIGGER trg_cm_promotor_metas_history
AFTER INSERT OR UPDATE ON public.cm_promotor_metas
FOR EACH ROW EXECUTE FUNCTION public.trg_cm_promotor_metas_history_func();
