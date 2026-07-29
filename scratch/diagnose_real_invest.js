const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getValorProjetadoComercial(r) {
  if (r.abrangencia === "SKU" && r.skus_detalhes) {
    return r.skus_detalhes.reduce((acc, curr) => acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0), 0);
  }
  if (r.familias_detalhes && r.familias_detalhes.length > 0) {
    return r.familias_detalhes.reduce((acc, curr) => acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0), 0);
  }
  return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
}

function getInvestimentoRealizadoOficial(acao) {
  if (acao.apuracao_valor_realizado !== null && acao.apuracao_valor_realizado !== undefined) {
    return Number(acao.apuracao_valor_realizado);
  }
  return getValorProjetadoComercial(acao);
}

async function main() {
  const monthKey = "2026-07";

  const { data: rawInvestments } = await supabase
    .from('v_acoes_investimento_com_gerente')
    .select('gerente_responsavel, mes_referencia, apuracao_valor_realizado, valor_investimento, expectativa_volume, abrangencia, skus_detalhes, familias_detalhes')
    .eq('mes_referencia', monthKey)
    .eq('is_planejamento', false)
    .is('cancel_reason', null);

  const jullianoInvest = (rawInvestments || []).filter(i => (i.gerente_responsavel || '').toUpperCase().includes("JULLIANO"));

  let totalReal = 0;
  jullianoInvest.forEach((inv, idx) => {
    const val = getInvestimentoRealizadoOficial(inv);
    totalReal += val;
    console.log(`Ação ${idx + 1}: valor_investimento=${inv.valor_investimento}, expectativa_volume=${inv.expectativa_volume}, apuracao=${inv.apuracao_valor_realizado}, calculated=${val}`);
  });

  console.log("\n=== RESULTADO ===");
  console.log("Total Investimento Realizado (R$):", totalReal);
  console.log("Faturamento Julliano Jul/2026 (R$):", 220314.84);
  console.log("REAL (%) = (investRs / fatRs) * 100 =", (totalReal / 220314.84) * 100);
  console.log("DESAFIO (%) = 10.0");
  console.log("INVEST_PCT = (REAL / DESAFIO) * 100 =", ((totalReal / 220314.84) * 100) / 10 * 100);
  console.log("DELTA = REAL - DESAFIO =", (totalReal / 220314.84) * 100 - 10);
}

main().catch(console.error);
