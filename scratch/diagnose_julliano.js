const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function diagnoseJulliano() {
  console.log("=================================================");
  console.log("🔍 DIAGNÓSTICO DA RESPOSTA DE JULHO/2026 PARA JULLIANO");
  console.log("=================================================\n");

  const year = 2026;
  const month = 7;
  const monthKey = "2026-07";

  // 1. Fetch sales
  const { data: sales } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT mes, COALESCE(manager,'Outros') as manager, SUM(fat) as fat, SUM(qty) as qty FROM mv_vendas_mensal WHERE mes = '2026-07' GROUP BY mes, COALESCE(manager,'Outros')`
  });

  // 2. Fetch targets
  const { data: targets } = await supabase
    .from('targets')
    .select('manager, month, target_revenue, target_tons')
    .eq('year', year)
    .eq('month', month);

  // 3. Fetch weekly projections
  const { data: projections } = await supabase
    .from('cm_weekly_projections')
    .select('manager, kpi, projection_value, week_start_date')
    .eq('year', year)
    .eq('month', month)
    .eq('client_matrix', '_TOTAL_');

  // 4. Fetch investments
  const { data: rawInvestments } = await supabase
    .from('v_acoes_investimento_com_gerente')
    .select('gerente_responsavel, mes_referencia, apuracao_valor_realizado, valor_investimento')
    .eq('mes_referencia', monthKey)
    .eq('is_planejamento', false)
    .is('cancel_reason', null);

  console.log("Raw Targets:", targets);
  console.log("Raw Sales for 2026-07:", sales);

  // Filter for Julliano
  const jullianoSales = (sales || []).filter(s => s.manager.toUpperCase().includes("JULLIANO"));
  const jullianoTargets = (targets || []).filter(t => t.manager.toUpperCase().includes("JULLIANO"));
  const jullianoInvest = (rawInvestments || []).filter(i => (i.gerente_responsavel || '').toUpperCase().includes("JULLIANO"));

  console.log("\n--- DADOS JULLIANO (2026-07) ---");
  console.log("Sales fat (R$):", jullianoSales);
  console.log("Targets target_revenue (R$):", jullianoTargets);
  console.log("Investments (R$):", jullianoInvest.map(i => ({
    gerente: i.gerente_responsavel,
    valor_investimento: i.valor_investimento,
    apuracao: i.apuracao_valor_realizado
  })));

  const sumFat = jullianoSales.reduce((a, b) => a + Number(b.fat), 0);
  const sumTargetRev = jullianoTargets.reduce((a, b) => a + Number(b.target_revenue), 0);
  const sumInvest = jullianoInvest.reduce((a, b) => a + (Number(b.apuracao_valor_realizado || 0) || Number(b.valor_investimento || 0)), 0);

  console.log("\nSum Fat (R$):", sumFat);
  console.log("Sum Target Revenue (R$):", sumTargetRev);
  console.log("Sum Target 10% (R$):", sumTargetRev * 0.10);
  console.log("Sum Invest (R$):", sumInvest);
}

diagnoseJulliano().catch(console.error);
