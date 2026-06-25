-- Adicionar colunas de lanche/coffee break na tabela de escalas
ALTER TABLE public.cm_promotor_escala 
ADD COLUMN IF NOT EXISTS hora_saida_lanche TIME,
ADD COLUMN IF NOT EXISTS hora_retorno_lanche TIME;
