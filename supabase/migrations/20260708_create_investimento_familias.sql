-- Migration created on 2026-07-08 for cm_investimento_familias

CREATE TABLE IF NOT EXISTS public.cm_investimento_familias (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    investimento_id uuid NOT NULL REFERENCES public.cm_acoes_investimento(id) ON DELETE CASCADE,
    familia text NOT NULL,
    familia_id text NOT NULL,
    preco_flat numeric DEFAULT 0,
    preco_acao numeric DEFAULT 0,
    investimento numeric DEFAULT 0,
    expectativa_volume numeric DEFAULT 0,
    valor_investimento numeric DEFAULT 0,
    data_execucao date,
    status text NOT NULL DEFAULT 'PENDENTE'::text,
    aprovado_por text,
    aprovado_em timestamp with time zone,
    observacao_trade text,
    comprovante_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_status CHECK (status = ANY (ARRAY['PENDENTE'::text, 'APROVADA'::text, 'REPROVADA'::text, 'EXECUTADA'::text]))
);

CREATE TABLE IF NOT EXISTS public.cm_investimento_familias_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    familia_id uuid NOT NULL REFERENCES public.cm_investimento_familias(id) ON DELETE CASCADE,
    status_anterior text,
    status_novo text,
    usuario text,
    data_hora timestamp with time zone DEFAULT now(),
    observacao text
);

-- Enable RLS
ALTER TABLE public.cm_investimento_familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_investimento_familias_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all authenticated users full access" ON public.cm_investimento_familias TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated users full access" ON public.cm_investimento_familias_history TO authenticated USING (true) WITH CHECK (true);

-- Trigger functions and triggers
CREATE OR REPLACE FUNCTION public.sync_child_to_parent_legacy()
RETURNS trigger AS $$
DECLARE
  v_investimento_id UUID;
  v_familias_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_investimento_id := OLD.investimento_id;
  ELSE
    v_investimento_id := NEW.investimento_id;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'familia_id', f.familia_id,
      'familia_nome', f.familia,
      'preco_flat', f.preco_flat,
      'preco_acao', f.preco_acao,
      'investimento', f.investimento,
      'expectativa_volume', f.expectativa_volume,
      'start_date', f.data_execucao,
      'end_date', f.data_execucao,
      'status_trade', f.status,
      'aprovado_por', f.aprovado_por,
      'aprovado_em', f.aprovado_em,
      'observacao_trade', f.observacao_trade,
      'comprovante_url', f.comprovante_url
    )
  ) INTO v_familias_json
  FROM public.cm_investimento_familias f
  WHERE f.investimento_id = v_investimento_id;

  UPDATE public.cm_acoes_investimento
  SET familias_detalhes = COALESCE(v_familias_json, '[]'::jsonb)
  WHERE id = v_investimento_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_insert_parent_to_child()
RETURNS trigger AS $$
BEGIN
  IF NEW.familias_detalhes IS NOT NULL AND jsonb_array_length(NEW.familias_detalhes) > 0 THEN
    INSERT INTO public.cm_investimento_familias (
      investimento_id,
      familia,
      familia_id,
      preco_flat,
      preco_acao,
      investimento,
      expectativa_volume,
      valor_investimento,
      data_execucao,
      status,
      aprovado_por,
      aprovado_em,
      observacao_trade,
      comprovante_url
    )
    SELECT
      NEW.id,
      COALESCE(f->>'familia_nome', f->>'familia_id'),
      (f->>'familia_id'),
      COALESCE((f->>'preco_flat')::numeric, 0),
      COALESCE((f->>'preco_acao')::numeric, 0),
      COALESCE((f->>'investimento')::numeric, 0),
      COALESCE((f->>'expectativa_volume')::numeric, 0),
      COALESCE((f->>'investimento')::numeric, 0) * COALESCE((f->>'expectativa_volume')::numeric, 0),
      COALESCE(f->>'data_execucao', f->>'start_date')::date,
      CASE 
        WHEN (f->>'status_trade') = 'Aprovado' THEN 'APROVADA'
        WHEN (f->>'status_trade') = 'Reprovado' THEN 'REPROVADA'
        ELSE 'PENDENTE'
      END,
      (f->>'aprovado_por'),
      (f->>'aprovado_em')::timestamptz,
      (f->>'observacao_trade'),
      (f->>'comprovante_url')
    FROM jsonb_array_elements(NEW.familias_detalhes) AS f
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_child_to_parent_legacy
AFTER INSERT OR UPDATE OR DELETE ON public.cm_investimento_familias
FOR EACH ROW EXECUTE FUNCTION public.sync_child_to_parent_legacy();

CREATE TRIGGER trg_sync_insert_parent_to_child
AFTER INSERT ON public.cm_acoes_investimento
FOR EACH ROW EXECUTE FUNCTION public.sync_insert_parent_to_child();
