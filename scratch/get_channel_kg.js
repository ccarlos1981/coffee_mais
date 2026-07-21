const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function getChannelKg() {
  console.log('=== CÁLCULO DE VOLUME EM KG POR CANAL (JULHO/2026) ===\n');

  const { data: kgResult } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      WITH base AS (
        SELECT 
          f.cod_top,
          f.quantidade,
          COALESCE(k.peso_embalagem_kg, k.peso_total_caixa_kg / NULLIF(k.unidades_por_caixa, 0), 0.25) as peso_unit_kg,
          COALESCE(
            CASE
              WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
              WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
              WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
              WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
              ELSE c.tipo_parceiro
            END, 'Outros'::text) AS channel
        FROM cm_faturamento f
        LEFT JOIN cm_clientes c ON c.codigo = f.cod_parceiro::integer
        LEFT JOIN cm_skus_conversao k ON k.sku_codigo::text = f.cod_produto::text
        WHERE f.dt_faturamento >= '2026-07-01' AND f.dt_faturamento <= '2026-07-31'
          AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA')
          AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
          AND (
            (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND f.cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
            OR
            (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND f.cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703))
          )
      )
      SELECT 
        channel,
        SUM(
          CASE 
            WHEN cod_top::text IN ('1200', '1201') THEN -ABS(quantidade * peso_unit_kg)
            ELSE (quantidade * peso_unit_kg)
          END
        ) as volume_kg
      FROM base
      GROUP BY channel
      ORDER BY volume_kg DESC
    `
  });

  console.log('Volume em Kg por Canal:', kgResult);
}

getChannelKg().catch(console.error);
