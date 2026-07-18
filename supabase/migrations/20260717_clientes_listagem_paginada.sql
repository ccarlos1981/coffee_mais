-- Migration: 20260717_clientes_listagem_paginada.sql
-- Description: Criar objetos de banco e índices para paginação e otimização de buscas no Cadastro Único.

-- 1. View para Condições de Pagamento distintas
CREATE OR REPLACE VIEW public.vw_clientes_condicoes_pagamento AS
SELECT DISTINCT condicao_pagamento
FROM public.cm_clientes
WHERE condicao_pagamento IS NOT NULL AND condicao_pagamento <> ''
ORDER BY condicao_pagamento;

GRANT SELECT ON public.vw_clientes_condicoes_pagamento TO anon, authenticated, service_role;

-- 2. Índices para otimização de buscas, ordenação e filtros
CREATE INDEX IF NOT EXISTS idx_clientes_nome_parceiro ON public.cm_clientes(nome_parceiro);
CREATE INDEX IF NOT EXISTS idx_clientes_fase ON public.cm_clientes(fase);
CREATE INDEX IF NOT EXISTS idx_clientes_condicao ON public.cm_clientes(condicao_pagamento);
