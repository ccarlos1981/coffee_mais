const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function printCorrectSummary() {
  // Query 1: MyMetrics (Official SSOT Matview mv_vendas_mensal)
  const { data: mvMensal } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT channel, SUM(fat) as fat_real, COUNT(DISTINCT rede) as qtd_redes
      FROM mv_vendas_mensal
      WHERE mes = '2026-07'
      GROUP BY channel
    `
  });

  // Query 2: MyMetrics client count per channel (mv_vendas_cliente_mensal)
  const { data: mvCliente } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT channel, COUNT(DISTINCT nome_parceiro) as qtd_clientes, SUM(fat) as fat_cliente
      FROM mv_vendas_cliente_mensal
      WHERE mes = '2026-07'
      GROUP BY channel
    `
  });

  // Query 3: Coffee++ channel breakdown based directly on cm_clientes.tipo_parceiro
  const { data: coffeeBreakdown } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COALESCE(c.tipo_parceiro, 'Outros') as canal_coffee_mais,
        COUNT(DISTINCT f.cod_parceiro) as qtd_clientes_coffee,
        SUM(
          CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(f.vlr_total_liq, 0))
               ELSE COALESCE(f.vlr_total_liq, 0)
          END
        ) as fat_coffee_mais
      FROM cm_faturamento f
      LEFT JOIN cm_clientes c ON c.codigo = f.cod_parceiro::integer
      WHERE f.dt_faturamento >= '2026-07-01' AND f.dt_faturamento <= '2026-07-31'
        AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA')
        AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        AND (
          (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND f.cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
          OR
          (f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]) AND f.cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703))
        )
      GROUP BY COALESCE(c.tipo_parceiro, 'Outros')
    `
  });

  console.log('=== MY METRICS MENSAL ===');
  console.log(mvMensal);

  console.log('\n=== MY METRICS CLIENTE MENSAL ===');
  console.log(mvCliente);

  console.log('\n=== COFFEE++ CADASTRO MESTRE (TIPO_PARCEIRO) ===');
  console.log(coffeeBreakdown);
}

printCorrectSummary().catch(console.error);
