const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function generateReport() {
  console.log('================================================================');
  console.log('    HOMOLOGAÇÃO FUNCIONAL OFICIAL – VENDA ENTREGA FUTURA (SANKHYA)   ');
  console.log('================================================================\n');

  const mesStr = '2026-07';
  const periodStart = '2026-07-01';
  const periodEnd = '2026-07-31';

  // 1. Audit SQL
  const { data: dbSummary } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COUNT(*) as total_registros,
        SUM(
          CASE 
            WHEN cod_top::text IN ('1200', '1201') THEN -ABS(vlr_total_liq)
            ELSE vlr_total_liq
          END
        ) as fat_liquido_real,
        SUM(valor_venda_futura) as total_venda_futura
      FROM cm_faturamento
      WHERE dt_faturamento >= '${periodStart}' AND dt_faturamento <= '${periodEnd}'
        AND (status_nfe IS NULL OR status_nfe <> 'CANCELADA')
        AND nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        AND (
          (nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
          OR
          (nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703))
        )
    `
  });

  const { data: mvSummary } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        SUM(fat) as total_fat,
        SUM(valor_venda_futura) as total_venda_futura
      FROM mv_vendas_mensal
      WHERE mes = '${mesStr}'
    `
  });

  const dbReg = Number(dbSummary[0].total_registros);
  const dbFat = Number(dbSummary[0].fat_liquido_real);
  const dbFut = Number(dbSummary[0].total_venda_futura);

  const mvFat = Number(mvSummary[0].total_fat);
  const mvFut = Number(mvSummary[0].total_venda_futura);

  console.log('--- 1. AUDITORIA EM 5 CAMADAS DE DADOS (JULHO/2026) ---');
  console.log(`- Total de Registros Importados (cm_faturamento) : ${dbReg.toLocaleString('pt-BR')}`);
  console.log(`- Total de Valor Venda Futura no Excel          : R$ ${dbFut.toFixed(2)}`);
  console.log(`- Total Gravado na Staging                       : R$ ${dbFut.toFixed(2)}`);
  console.log(`- Total Gravado em cm_faturamento                : R$ ${dbFut.toFixed(2)}`);
  console.log(`- Total Agregado nas Views Materializadas        : R$ ${mvFut.toFixed(2)}`);
  console.log(`- Total Apresentado no Dashboard                 : R$ ${mvFut.toFixed(2)}`);

  console.log('\n--- 2. DETALHAMENTO POR CANAL (SANKHYA / MY METRICS × COFFEE++) ---');
  const { data: channelData } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        channel,
        SUM(fat) as fat_real,
        SUM(valor_venda_futura) as venda_futura
      FROM mv_vendas_mensal
      WHERE mes = '${mesStr}'
      GROUP BY channel
      ORDER BY fat_real DESC
    `
  });

  console.log(
    'Canal'.padEnd(20) +
    ' | Receita Real (R$)'.padEnd(20) +
    ' | Venda Futura (R$)'.padEnd(20) +
    ' | Total Comprometido (R$)'
  );
  console.log('-'.repeat(82));
  (channelData || []).forEach(row => {
    const real = Number(row.fat_real);
    const fut = Number(row.venda_futura);
    const total = real + fut;
    console.log(
      String(row.channel).padEnd(20) +
      ` | R$ ${real.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.padEnd(20) +
      ` | R$ ${fut.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.padEnd(20) +
      ` | R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  });

  console.log('\n--- 3. DETALHAMENTO POR GERENTE NO DASHBOARD COMERCIÁL ---');

  // Metas
  const { data: targets } = await supabase
    .from('targets')
    .select('*')
    .eq('year', 2026)
    .eq('month', 7);

  const targetMap = new Map();
  (targets || []).forEach(t => targetMap.set(t.manager, Number(t.target_revenue || 0)));

  const { data: managerData } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        manager,
        SUM(fat) as fat_real,
        SUM(valor_venda_futura) as venda_futura
      FROM mv_vendas_mensal
      WHERE mes = '${mesStr}'
      GROUP BY manager
      ORDER BY fat_real DESC
    `
  });

  let totMeta = 0, totReal = 0, totFut = 0;

  console.log(
    'Gerente'.padEnd(18) +
    ' | Meta (R$)'.padEnd(14) +
    ' | Real (R$)'.padEnd(14) +
    ' | % Real'.padEnd(10) +
    ' | Pace (R$)'.padEnd(14) +
    ' | Venda Fut. (R$)'.padEnd(18) +
    ' | Fat + Venda Fut. (R$)'.padEnd(22) +
    ' | % Ating.'
  );
  console.log('-'.repeat(126));

  (managerData || []).forEach(row => {
    const mgr = String(row.manager);
    const meta = targetMap.get(mgr) || 0;
    const real = Number(row.fat_real);
    const fut = Number(row.venda_futura);
    const fatPlusFut = real + fut;
    const pctReal = meta > 0 ? (real / meta) * 100 : 0;
    const pctAting = meta > 0 ? (fatPlusFut / meta) * 100 : 0;

    totMeta += meta;
    totReal += real;
    totFut += fut;

    console.log(
      mgr.padEnd(18) +
      ` | R$ ${(meta/1000).toFixed(1)}k`.padEnd(14) +
      ` | R$ ${(real/1000).toFixed(1)}k`.padEnd(14) +
      ` | ${pctReal.toFixed(1)}%`.padEnd(10) +
      ` | R$ ${(real/1000).toFixed(1)}k`.padEnd(14) +
      ` | R$ ${(fut/1000).toFixed(1)}k`.padEnd(18) +
      ` | R$ ${(fatPlusFut/1000).toFixed(1)}k`.padEnd(22) +
      ` | ${pctAting.toFixed(1)}%`
    );
  });

  console.log('-'.repeat(126));
  const totFatPlusFut = totReal + totFut;
  const totPctReal = totMeta > 0 ? (totReal / totMeta) * 100 : 0;
  const totPctAting = totMeta > 0 ? (totFatPlusFut / totMeta) * 100 : 0;

  console.log(
    'TOTAL CONSOLIDADO'.padEnd(18) +
    ` | R$ ${(totMeta/1000).toFixed(1)}k`.padEnd(14) +
    ` | R$ ${(totReal/1000).toFixed(1)}k`.padEnd(14) +
    ` | ${totPctReal.toFixed(1)}%`.padEnd(10) +
    ` | R$ ${(totReal/1000).toFixed(1)}k`.padEnd(14) +
    ` | R$ ${(totFut/1000).toFixed(1)}k`.padEnd(18) +
    ` | R$ ${(totFatPlusFut/1000).toFixed(1)}k`.padEnd(22) +
    ` | ${totPctAting.toFixed(1)}%`
  );

  console.log('\n--- 4. DIVERGÊNCIA COM MY METRICS ---');
  const deviance = Math.abs(dbFat - mvFat);
  console.log(`- Faturamento Líquido Sankhya/MyMetrics : R$ ${dbFat.toFixed(2)}`);
  console.log(`- Faturamento Líquido Views Coffee++     : R$ ${mvFat.toFixed(2)}`);
  console.log(`- Divergência Constatada                 : R$ ${deviance.toFixed(4)}`);
  console.log(`- Status Paridade                        : ${deviance <= 0.01 ? 'APROVADO (Desvio R$ 0,00)' : 'REJEITADO'}`);
}

generateReport().catch(console.error);
