const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function testFullSum() {
  console.log('=== TESTE DE SOMA COMPLETA DE CM_FATURAMENTO ===');

  const { data: sumResult, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COUNT(*) as total_rows,
        SUM(
          CASE 
            WHEN cod_top::text IN ('1200', '1201') THEN -ABS(vlr_total_liq)
            ELSE vlr_total_liq
          END
        ) as total_net,
        SUM(valor_venda_futura) as total_venda_futura
      FROM cm_faturamento
      WHERE dt_faturamento >= '2026-07-01' AND dt_faturamento <= '2026-07-31'
        AND (status_nfe IS NULL OR status_nfe <> 'CANCELADA')
        AND nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        AND (
          (nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
          OR
          (nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703))
        )
    `
  });

  console.log('Resultado da Soma em cm_faturamento:', sumResult);

  const { data: mvSum } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        SUM(fat) as total_fat,
        SUM(valor_venda_futura) as total_venda_futura
      FROM mv_vendas_mensal
      WHERE mes = '2026-07'
    `
  });

  console.log('Resultado da Soma em mv_vendas_mensal:', mvSum);
}

testFullSum().catch(console.error);
