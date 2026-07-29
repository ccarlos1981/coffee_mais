const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function resolveCanonicalManager(input) {
  if (!input) return { managerName: "Outros", canonicalKey: "OUTROS" };
  const str = input.toUpperCase().trim();
  if (str.includes("JULLIANO")) return { managerName: "Julliano", canonicalKey: "JULLIANO" };
  if (str.includes("LEANDRO")) return { managerName: "Leandro", canonicalKey: "LEANDRO" };
  if (str.includes("LUIZ")) return { managerName: "Luiz", canonicalKey: "LUIZ" };
  return { managerName: input, canonicalKey: str };
}

function getInvestimentoRealizadoOficial(inv) {
  const apuracao = Number(inv.apuracao_valor_realizado ?? 0);
  return apuracao > 0 ? apuracao : Number(inv.valor_investimento ?? 0);
}

async function simulateRdmBackend() {
  const year = 2026;
  const month = 7;
  const manager = "Julliano";

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const targetManagers = [manager];

  // Vendas
  const { data: sales } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT mes, COALESCE(manager,'Outros') as manager, SUM(fat) as fat, SUM(qty) as qty FROM mv_vendas_mensal WHERE mes = '${monthKey}' GROUP BY mes, COALESCE(manager,'Outros')`
  });

  // Targets
  const { data: targets } = await supabase
    .from('targets')
    .select('manager, month, target_revenue, target_tons')
    .eq('year', year)
    .eq('month', month);

  // Investimentos
  const { data: rawInvestments } = await supabase
    .from('v_acoes_investimento_com_gerente')
    .select('gerente_responsavel, mes_referencia, apuracao_valor_realizado, valor_investimento')
    .eq('mes_referencia', monthKey)
    .eq('is_planejamento', false)
    .is('cancel_reason', null);

  const targetCanon = targetManagers.map(m => resolveCanonicalManager(m).canonicalKey);

  const realMonthFat = (sales || [])
    .filter(s => targetCanon.includes(resolveCanonicalManager(s.manager).canonicalKey))
    .reduce((acc, s) => acc + Number(s.fat), 0);

  const realMonthInvest = (rawInvestments || [])
    .filter(inv => targetCanon.includes(resolveCanonicalManager(inv.gerente_responsavel).canonicalKey))
    .reduce((acc, inv) => acc + getInvestimentoRealizadoOficial(inv), 0);

  const targetSum = targetManagers.reduce((acc, m) => {
    const t = (targets || []).find(t => resolveCanonicalManager(t.manager).canonicalKey === resolveCanonicalManager(m).canonicalKey);
    return acc + Number(t?.target_revenue ?? 0);
  }, 0);

  console.log("SIMULAÇÃO DA RUTA DA API:");
  console.log("Manager:", manager);
  console.log("realMonthFat (R$):", realMonthFat);
  console.log("realMonthInvest (R$):", realMonthInvest);
  console.log("targetSum (Target Revenue R$):", targetSum);
  console.log("10% of Target Revenue (R$):", targetSum * 0.10);
  
  // Real % = (realMonthInvest / realMonthFat) * 100
  const realPct = realMonthFat > 0 ? (realMonthInvest / realMonthFat) * 100 : 0;
  console.log("realPct calculated:", realPct, "%");

  // What if realMonthFat was taken in thousands (R$k) or wrong scale?
  // If realMonthInvest was 230.18 (in BRL) or if rawInvestments had valor_investimento = 230180?
  // Or if realMonthFat was 0.443 (in R$k) -> 230.18 / 0.443 = 519.59 * 100 = 51959% !!
  console.log("Check if realMonthFat in thousands (220.31484k):", realMonthFat / 1000);
  console.log("Check 230.18 / (220314.84/1000) * 100:", (realMonthInvest / (realMonthFat / 1000)) * 100);
  
  // Look at that: 230.18 / 220.31484 * 100 = 104.47
  // What if realMonthInvest was 114400 or something?
  // What if 220314.84 was divided by 230.18? 220314.84 / 230.18 = 957
  // What if realMonthFat was R$ 443.25 and realMonthInvest was R$ 230.18? 230.18 / 0.44325 * 100 = 51930% !!
}

simulateRdmBackend().catch(console.error);
