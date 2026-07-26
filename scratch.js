require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getValorTotal(r) {
  if (r.abrangencia === "SKU" && r.skus_detalhes) {
    return r.skus_detalhes.reduce(
      (acc, curr) =>
        acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0),
      0
    );
  }
  if (r.familias_detalhes && r.familias_detalhes.length > 0) {
    return r.familias_detalhes.reduce(
      (acc, curr) =>
        acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0),
      0
    );
  }
  return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
}

async function test() {
  const { data: invs, error } = await supabase
    .from('v_acoes_investimento_com_gerente')
    .select('mes_referencia, gerente_responsavel, valor_investimento, expectativa_volume, abrangencia, skus_detalhes, familias_detalhes, apuracao_valor_realizado')
    .eq('mes_referencia', '2026-07')
    .eq('is_planejamento', false)
    .is('cancel_reason', null);

  if (error) {
    console.error(error);
    return;
  }

  const totals = {};
  for (const inv of invs) {
    const mgr = inv.gerente_responsavel;
    // Se tiver apuracao, usa. Sendo nulo, usamos o cálculo de expectativa
    let val = Number(inv.apuracao_valor_realizado) || getValorTotal(inv);
    
    if (!totals[mgr]) totals[mgr] = 0;
    totals[mgr] += val;
  }
  
  console.log("=== TRUE TOTAL INVEST (REAIS) ===");
  console.log(totals);
}
test();
