const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function getExactChannelMetrics() {
  console.log('=== EXTRAÇÃO EXATA DE INDICADORES POR CANAL (JULHO/2026) ===\n');

  const { data: result } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      WITH base AS (
        SELECT 
          f.cod_top,
          f.vlr_total_liq,
          f.quantidade,
          COALESCE(f.valor_venda_futura, 0) as valor_venda_futura,
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
        SUM(CASE WHEN cod_top::text NOT IN ('1200', '1201', '1117') THEN vlr_total_liq ELSE 0 END) as bruto,
        SUM(CASE WHEN cod_top::text IN ('1200', '1201') THEN ABS(vlr_total_liq) ELSE 0 END) as devolucoes,
        SUM(CASE WHEN cod_top::text = '1117' THEN vlr_total_liq ELSE 0 END) as bonificacoes,
        SUM(CASE WHEN cod_top::text IN ('1200', '1201') THEN -ABS(vlr_total_liq) ELSE vlr_total_liq END) as liquido_real,
        SUM(CASE WHEN cod_top::text IN ('1200', '1201') THEN -ABS(quantidade) ELSE quantidade END) as volume_und,
        SUM(valor_venda_futura) as venda_futura
      FROM base
      GROUP BY channel
      ORDER BY liquido_real DESC
    `
  });

  const totalLiquido = result.reduce((acc, r) => acc + Number(r.liquido_real || 0), 0);
  const totalBruto = result.reduce((acc, r) => acc + Number(r.bruto || 0), 0);
  const totalDev = result.reduce((acc, r) => acc + Number(r.devolucoes || 0), 0);
  const totalBon = result.reduce((acc, r) => acc + Number(r.bonificacoes || 0), 0);
  const totalFut = result.reduce((acc, r) => acc + Number(r.venda_futura || 0), 0);
  const totalVolume = result.reduce((acc, r) => acc + Number(r.volume_und || 0), 0);

  console.log('Resultados por Canal:');
  result.forEach(r => {
    const real = Number(r.liquido_real);
    const share = (real / totalLiquido) * 100;
    const und = Number(r.volume_und);
    const pm = und > 0 ? real / und : 0;
    console.log({
      channel: r.channel,
      bruto: Number(r.bruto).toFixed(2),
      dev: Number(r.devolucoes).toFixed(2),
      bon: Number(r.bonificacoes).toFixed(2),
      real: real.toFixed(2),
      fut: Number(r.venda_futura).toFixed(2),
      fatPlusFut: (real + Number(r.venda_futura)).toFixed(2),
      share: share.toFixed(2) + '%',
      volume_und: und,
      preco_medio: pm.toFixed(2)
    });
  });

  console.log('\n--- TOTAL CONSOLIDADO ---');
  console.log({
    bruto: totalBruto.toFixed(2),
    dev: totalDev.toFixed(2),
    bon: totalBon.toFixed(2),
    liquido_real: totalLiquido.toFixed(2),
    venda_futura: totalFut.toFixed(2),
    fatPlusFut: (totalLiquido + totalFut).toFixed(2),
    share: '100.00%',
    volume_und: totalVolume,
    preco_medio: (totalLiquido / totalVolume).toFixed(2)
  });
}

getExactChannelMetrics().catch(console.error);
