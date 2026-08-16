-- Migration: cm_dre_rede_aliases
-- Estrutura genérica de aliases para mapeamento planilha → sistema no DRE Gerencial

CREATE TABLE IF NOT EXISTS cm_dre_rede_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rede_planilha TEXT NOT NULL,      -- Nome normalizado da planilha (ex: "ZAFFARI")
  rede_sistema TEXT NOT NULL,       -- Nome exato no sistema (ex: "ZAFFARI (CESTO)")
  rede_uf_match TEXT,               -- Match com Rede_UF da planilha (ex: "RS ZAFFARI")
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rede_planilha, rede_sistema)
);

-- Aliases ZAFFARI (critério determinístico via Rede_UF)
INSERT INTO cm_dre_rede_aliases (rede_planilha, rede_sistema, rede_uf_match) VALUES
  ('ZAFFARI', 'ZAFFARI', 'SP ZAFFARI'),
  ('ZAFFARI', 'ZAFFARI (CESTO)', 'RS ZAFFARI')
ON CONFLICT (rede_planilha, rede_sistema) DO NOTHING;

-- Índice para busca rápida por rede_planilha
CREATE INDEX IF NOT EXISTS idx_dre_rede_aliases_planilha ON cm_dre_rede_aliases (rede_planilha) WHERE ativo = TRUE;

COMMENT ON TABLE cm_dre_rede_aliases IS 'Mapeamento de nomes de rede da planilha DRE para redes oficiais do sistema. Utilizado quando uma rede da planilha corresponde a múltiplas redes no sistema (ex: ZAFFARI → ZAFFARI + ZAFFARI CESTO).';
COMMENT ON COLUMN cm_dre_rede_aliases.rede_planilha IS 'Nome normalizado da rede na planilha (após remoção de prefixo UF)';
COMMENT ON COLUMN cm_dre_rede_aliases.rede_sistema IS 'Nome exato da rede no sistema (mv_vendas_mensal.rede)';
COMMENT ON COLUMN cm_dre_rede_aliases.rede_uf_match IS 'Valor exato de Rede_UF na planilha para match determinístico. Se NULL, alias não possui critério de distribuição.';
