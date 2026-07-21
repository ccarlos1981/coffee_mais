const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function getExactSsotReport() {
  console.log('=== RELATÓRIO OFICIAL DE CANAIS (SINGLE SOURCE OF TRUTH - JULHO/2026) ===\n');

  const { data: rows } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      WITH base AS (
        SELECT 
          f.cod_top,
          f.vlr_total_liq,
          f.quantidade,
          COALESCE(k.peso_embalagem_kg, 0.25) as peso_unit_kg,
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
        LEFT JOIN cm_skus_conversao k ON k.codigo_integracao::text = f.cod_produto::text OR k.product_id::text = f.cod_produto::text
        WHERE f.dt_faturamento >= '2026-07-01' AND f.dt_faturamento <= '2026-07-31'
          AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA')
          AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
          AND (
            (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND f.cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
            OR
            (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND f.cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703))
          )
          AND NOT (
            f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])
            AND COALESCE(c.responsavel, 'SEM RESPONSÁVEL') = ANY (ARRAY['Ecommerce'::text, 'Marketplace'::text])
          )
      )
      SELECT 
        channel,
        SUM(CASE WHEN cod_top::text NOT IN ('1200', '1201', '1117') THEN vlr_total_liq ELSE 0 END) as bruto,
        SUM(CASE WHEN cod_top::text IN ('1200', '1201') THEN ABS(vlr_total_liq) ELSE 0 END) as devolucoes,
        SUM(CASE WHEN cod_top::text = '1117' THEN vlr_total_liq ELSE 0 END) as bonificacoes,
        SUM(CASE WHEN cod_top::text IN ('1200', '1201') THEN -ABS(vlr_total_liq) ELSE vlr_total_liq END) as liquido_real,
        SUM(CASE WHEN cod_top::text IN ('1200', '1201') THEN -ABS(quantidade) ELSE quantidade END) as volume_und,
        SUM(CASE WHEN cod_top::text IN ('1200', '1201') THEN -ABS(quantidade * peso_unit_kg) ELSE (quantidade * peso_unit_kg) END) as volume_kg,
        SUM(valor_venda_futura) as venda_futura
      FROM base
      GROUP BY channel
      ORDER BY liquido_real DESC
    `
  });

  const grandTotalReal = rows.reduce((acc, r) => acc + Number(r.liquido_real || 0), 0);
  const grandTotalBruto = rows.reduce((acc, r) => acc + Number(r.bruto || 0), 0);
  const grandTotalDev = rows.reduce((acc, r) => acc + Number(r.devolucoes || 0), 0);
  const grandTotalBon = rows.reduce((acc, r) => acc + Number(r.bonificacoes || 0), 0);
  const grandTotalFut = rows.reduce((acc, r) => acc + Number(r.venda_futura || 0), 0);
  const grandTotalQtd = rows.reduce((acc, r) => acc + Number(r.volume_und || 0), 0);
  const grandTotalKg = rows.reduce((acc, r) => acc + Number(r.volume_kg || 0), 0);

  console.log(`GRAND TOTAL NET REAL: R$ ${grandTotalReal.toFixed(2)}`);

  const formattedRows = rows.map(r => {
    const real = Number(r.liquido_real);
    const bruto = Number(r.bruto);
    const dev = Number(r.devolucoes);
    const bon = Number(r.bonificacoes);
    const fut = Number(r.venda_futura);
    const fatPlusFut = real + fut;
    const share = (real / grandTotalReal) * 100;
    const und = Number(r.volume_und);
    const kg = Number(r.volume_kg);
    const pmKg = kg > 0 ? real / kg : 0;

    return {
      channel: r.channel,
      bruto: bruto.toFixed(2),
      dev: dev.toFixed(2),
      bon: bon.toFixed(2),
      real: real.toFixed(2),
      fut: fut.toFixed(2),
      fatPlusFut: fatPlusFut.toFixed(2),
      share: share.toFixed(2) + '%',
      und,
      kg: kg.toFixed(2),
      pmKg: pmKg.toFixed(2)
    };
  });

  console.table(formattedRows);

  console.log('\n--- TOTAL GERAL CONSOLIDADO ---');
  console.log({
    bruto: grandTotalBruto.toFixed(2),
    dev: grandTotalDev.toFixed(2),
    bon: grandTotalBon.toFixed(2),
    liquido_real: grandTotalReal.toFixed(2),
    venda_futura: grandTotalFut.toFixed(2),
    fatPlusFut: (grandTotalReal + grandTotalFut).toFixed(2),
    share: '100.00%',
    und: grandTotalQtd,
    kg: grandTotalKg.toFixed(2),
    pmKg: (grandTotalReal / grandTotalKg).toFixed(2)
  });
}

getExactSsotReport().catch(console.error);
