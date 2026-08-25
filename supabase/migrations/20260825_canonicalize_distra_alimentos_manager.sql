-- Migration: 20260825_canonicalize_distra_alimentos_manager.sql
-- Objetivo: Sanitização cirúrgica e atômica dos registros legados da rede DISTRA ALIMENTOS (BUG-P3-02)
-- Alvo: Apenas os registros específicos validados na auditoria forense P4.3

DO $$
DECLARE
  v_count_clientes INT;
  v_count_redes INT;
  v_count_base INT;
BEGIN
  -- 1. Validar atomicamente que exatamente 1 registro existe em cada tabela antes de qualquer modificação
  SELECT count(*) INTO v_count_clientes
  FROM public.cm_clientes
  WHERE codigo = 114527 AND responsavel = 'Leandro';

  SELECT count(*) INTO v_count_redes
  FROM public.cm_redes_matrizes
  WHERE codigo = '114527.4' AND manager = 'Leandro';

  SELECT count(*) INTO v_count_base
  FROM public.base_atendimento
  WHERE cod_parceiro = '114527' AND manager = 'Leandro';

  IF v_count_clientes <> 1 OR v_count_redes <> 1 OR v_count_base <> 1 THEN
    RAISE EXCEPTION 'Abortando migração: validação prévia falhou (clientes: %, redes: %, base: %)',
      v_count_clientes, v_count_redes, v_count_base;
  END IF;

  -- 2. Atualizar cm_clientes
  UPDATE public.cm_clientes
  SET responsavel = 'Leandro Saffi',
      manager_name = 'Leandro Saffi'
  WHERE codigo = 114527;

  -- 3. Garantir consistência explícita em cm_redes_matrizes e base_atendimento
  UPDATE public.cm_redes_matrizes
  SET manager = 'Leandro Saffi'
  WHERE codigo = '114527.4';

  UPDATE public.base_atendimento
  SET manager = 'Leandro Saffi'
  WHERE cod_parceiro = '114527';

  RAISE NOTICE 'Saneamento cirúrgico de DISTRA ALIMENTOS concluído com sucesso: 1 cliente, 1 rede_matriz, 1 base_atendimento.';
END $$;
