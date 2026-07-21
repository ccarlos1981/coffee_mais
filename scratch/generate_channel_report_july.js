const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function runChannelReport() {
  console.log('================================================================');
  console.log('   RELATÓRIO COMERCIAL — VENDA POR CANAL (JULHO/2026)           ');
  console.log('================================================================\n');

  // Query detailed channel indicators from mv_vendas_mensal and cm_faturamento
  const { data: channelMv } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        channel,
        SUM(fat) as fat_real,
        SUM(qty) as volume_qtd,
        SUM(valor_venda_futura) as venda_futura
      FROM mv_vendas_mensal
      WHERE mes = '2026-07'
      GROUP BY channel
      ORDER BY fat_real DESC
    `
  });

  // Query Bruto, Devoluções e Bonificações por Canal diretamente da cm_faturamento + cm_clientes
  const { data: channelBreakdown } = await supabase.rpc('execute_readonly_query', {
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
        SUM(quantidade) as qtd_total,
        SUM(valor_venda_futura) as venda_futura
      FROM base
      GROUP BY channel
      ORDER BY liquido_real DESC
    `
  });

  console.log('Breakdown por Canal:', channelBreakdown);

  // Totalizador Geral
  const totalReal = (channelBreakdown || []).reduce((acc, r) => acc + Number(r.liquido_real || 0), 0);
  const totalBruto = (channelBreakdown || []).reduce((acc, r) => acc + Number(r.bruto || 0), 0);
  const totalDev = (channelBreakdown || []).reduce((acc, r) => acc + Number(r.devolucoes || 0), 0);
  const totalBon = (channelBreakdown || []).reduce((acc, r) => acc + Number(r.bonificacoes || 0), 0);
  const totalFut = (channelBreakdown || []).reduce((acc, r) => acc + Number(r.venda_futura || 0), 0);
  const totalQtd = (channelBreakdown || []).reduce((acc, r) => acc + Number(r.qtd_total || 0), 0);

  console.log('\n--- TABELA FINAL FORMATADA ---');
  (channelBreakdown || []).forEach(r => {
    const real = Number(r.liquido_real || 0);
    const bruto = Number(r.bruto || 0);
    const dev = Number(r.devolucoes || 0);
    const bon = Number(r.bonificacoes || 0);
    const fut = Number(r.venda_futura || 0);
    const fatPlusFut = real + fut;
    const share = totalReal > 0 ? (real / totalReal) * 100 : 0;
    const qtd = Number(r.qtd_total || 0);
    const precoMedio = qtd > 0 ? real / qtd : 0;

    console.log({
      channel: r.channel,
      bruto,
      dev,
      bon,
      real,
      fut,
      fatPlusFut,
      share: share.toFixed(2) + '%',
      qtd,
      precoMedio: precoMedio.toFixed(2)
    });
  });

  console.log('\n--- TOTAL GERAL ---', {
    totalBruto,
    totalDev,
    totalBon,
    totalReal,
    totalFut,
    totalFatPlusFut: totalReal + totalFut,
    totalQtd,
    totalPrecoMedio: totalQtd > 0 ? totalReal / totalQtd : 0
  });
}

runChannelReport().catch(console.error);
