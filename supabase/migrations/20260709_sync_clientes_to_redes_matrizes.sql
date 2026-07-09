-- 1. Criar a função da trigger com SECURITY DEFINER para contornar restrições de escrita RLS em cm_redes_matrizes
CREATE OR REPLACE FUNCTION public.sync_cm_clientes_to_redes_matrizes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_matriz IS NOT NULL AND NEW.matriz IS NOT NULL THEN
    INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, min_cod_parceiro)
    VALUES (
      NEW.codigo_matriz,
      NEW.matriz,
      COALESCE(NULLIF(NEW.tipo_parceiro, ''), 'Outros'),
      NEW.codigo::text
    )
    ON CONFLICT (codigo) DO UPDATE
    SET
      nome = EXCLUDED.nome,
      canal = COALESCE(NULLIF(EXCLUDED.canal, ''), public.cm_redes_matrizes.canal);
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Criar a trigger na tabela cm_clientes
DROP TRIGGER IF EXISTS trg_sync_cm_clientes_to_redes_matrizes ON public.cm_clientes;
CREATE TRIGGER trg_sync_cm_clientes_to_redes_matrizes
AFTER INSERT OR UPDATE ON public.cm_clientes
FOR EACH ROW
EXECUTE FUNCTION public.sync_cm_clientes_to_redes_matrizes();

-- 3. Carga inicial: sincronizar matrizes de clientes existentes que estão ausentes na tabela cm_redes_matrizes
INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, min_cod_parceiro)
SELECT DISTINCT ON (codigo_matriz)
  codigo_matriz,
  matriz,
  COALESCE(NULLIF(tipo_parceiro, ''), 'Outros'),
  codigo::text
FROM public.cm_clientes
WHERE codigo_matriz IS NOT NULL
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  canal = COALESCE(NULLIF(EXCLUDED.canal, ''), public.cm_redes_matrizes.canal);
