-- Configurações de Atendimento (Gestão de Regras de Gerência e Canal)

-- 1. Tabela UFs -> Gerente
CREATE TABLE IF NOT EXISTS public.manager_uf_mapping (
    uf TEXT PRIMARY KEY,
    manager TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela PDVs -> Gerente e Canal
-- Chave primária é o cod_parceiro, mas guardamos nome_parceiro e uf para fins de exibição na UI.
CREATE TABLE IF NOT EXISTS public.pdv_mapping (
    cod_parceiro TEXT PRIMARY KEY,
    nome_parceiro TEXT,
    rede TEXT,
    canal TEXT NOT NULL,
    manager TEXT NOT NULL,
    uf TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS simples (livre para autenticados ou anon neste estágio, como os demais dados)
ALTER TABLE public.manager_uf_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for manager_uf" ON public.manager_uf_mapping FOR ALL USING (true);

ALTER TABLE public.pdv_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for pdv" ON public.pdv_mapping FOR ALL USING (true);


-- 3. Função que será acionada pelo Botão "Sincronizar Histórico / Ler para Trás"
-- Retorna o número total de linhas modificadas.
CREATE OR REPLACE FUNCTION sync_historical_sales() 
RETURNS integer 
LANGUAGE plpgsql 
AS $$
DECLARE
  rows_affected integer := 0;
  uf_rows integer := 0;
  pdv_rows integer := 0;
BEGIN
  -- Regra 1 (Geral): UFs. Só modifica o que está diferente para não gerar IO inútil.
  WITH updated AS (
    UPDATE sales s
    SET manager = m.manager
    FROM manager_uf_mapping m
    WHERE s.uf = m.uf
      AND (s.manager IS DISTINCT FROM m.manager)
    RETURNING 1
  )
  SELECT count(*) INTO uf_rows FROM updated;

  -- Regra 2 (Específica): PDVs (sobrescreve a regra do UF se houver conflito).
  WITH updated AS (
    UPDATE sales s
    SET manager = p.manager,
        channel = p.canal
    FROM pdv_mapping p
    WHERE s.cod_parceiro = p.cod_parceiro
      AND (s.manager IS DISTINCT FROM p.manager OR s.channel IS DISTINCT FROM p.canal)
    RETURNING 1
  )
  SELECT count(*) INTO pdv_rows FROM updated;
  
  rows_affected := uf_rows + pdv_rows;
  
  -- Retorna o total de modificações feitas nas duas passadas
  RETURN rows_affected;
END;
$$;
