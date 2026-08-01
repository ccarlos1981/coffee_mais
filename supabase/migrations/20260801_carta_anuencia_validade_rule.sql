-- ====================================================================
-- MIGRAÇÃO DE GOVERNANÇA: COLUNA OFICIAL validade_ate E BACKFILL
-- Data: 01/08/2026
-- ====================================================================

-- 1. Migrar coluna para a nomenclatura oficial "validade_ate"
DO $$
BEGIN
    -- Se "valida_ate" existir e "validade_ate" não existir, renomear a coluna diretamente
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cm_cartas_anuencia' AND column_name = 'valida_ate'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cm_cartas_anuencia' AND column_name = 'validade_ate'
    ) THEN
        ALTER TABLE public.cm_cartas_anuencia RENAME COLUMN valida_ate TO validade_ate;
    
    -- Se "validade_ate" não existir por qualquer motivo, criar a coluna
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cm_cartas_anuencia' AND column_name = 'validade_ate'
    ) THEN
        ALTER TABLE public.cm_cartas_anuencia ADD COLUMN validade_ate DATE;
    END IF;

    -- Se porventura ambas existirem, sincronizar e remover a legado "valida_ate"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cm_cartas_anuencia' AND column_name = 'valida_ate'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cm_cartas_anuencia' AND column_name = 'validade_ate'
    ) THEN
        UPDATE public.cm_cartas_anuencia SET validade_ate = valida_ate WHERE validade_ate IS NULL AND valida_ate IS NOT NULL;
        ALTER TABLE public.cm_cartas_anuencia DROP COLUMN valida_ate;
    END IF;
END $$;

-- 2. Backfill pontual para atualizar validade_ate de todas as cartas existentes conforme a regra oficial do 1º e 2º Ciclos
UPDATE public.cm_cartas_anuencia
SET validade_ate = CASE
    -- 1º Ciclo: Janeiro, Fevereiro, Março -> 31/03 do mesmo ano
    WHEN LOWER(competencia) LIKE '%janeiro%' 
      OR LOWER(competencia) LIKE '%fevereiro%' 
      OR LOWER(competencia) LIKE '%março%' 
      OR LOWER(competencia) LIKE '%marco%' 
    THEN ((substring(competencia from '20[0-9]{2}')) || '-03-31')::DATE

    -- 2º Ciclo: Junho, Julho, Agosto -> 31/08 do mesmo ano
    WHEN LOWER(competencia) LIKE '%junho%' 
      OR LOWER(competencia) LIKE '%julho%' 
      OR LOWER(competencia) LIKE '%agosto%' 
    THEN ((substring(competencia from '20[0-9]{2}')) || '-08-31')::DATE

    ELSE validade_ate
END
WHERE competencia SIMILAR TO '%20[0-9]{2}%';
