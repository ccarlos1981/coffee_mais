require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getValorProjetadoComercial(r) {
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

function getInvestimentoRealizadoOficial(acao) {
  if (acao.apuracao_valor_realizado !== null && acao.apuracao_valor_realizado !== undefined) {
    return Number(acao.apuracao_valor_realizado);
  }
  return getValorProjetadoComercial(acao);
}

// Canonical resolution logic (matching canonical.ts)
function canonicalizeKey(val) {
  if (!val) return "";
  return val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
const MANAGERS_MAP = {
  "1000": "JULLIANO", "JULLIANO": "JULLIANO", "JULLIANO (SPC)": "JULLIANO",
  "1001": "LEANDRO", "LEANDRO": "LEANDRO", "LEANDRO SAFFI": "LEANDRO", "LEANDRO (SUL)": "LEANDRO",
  "1002": "LUIZ", "LUIZ": "LUIZ", "LUIZ (SU+CO+NE)": "LUIZ",
};
function getCanonicalManagerKey(name) {
  const k = canonicalizeKey(name);
  return MANAGERS_MAP[k] || k;
}
function isSameManager(a, b) {
  return getCanonicalManagerKey(a) === getCanonicalManagerKey(b);
}

async function runAudit() {
  const curMonthKey = '2026-07';

  // 1. Fetch raw investments from v_acoes_investimento_com_gerente (Same base for both)
  const { data: rawInvest, error: errInv } = await supabase
    .from('v_acoes_investimento_com_gerente')
    .select('*')
    .eq('mes_referencia', curMonthKey)
    .eq('is_planejamento', false);

  if (errInv) {
    console.error("Error fetching v_acoes_investimento_com_gerente:", errInv);
    return;
  }

  // --- MÓDULO 1: DASH GERANCIAL ---
  // How Dash Gerencial filters & assigns manager:
  // In Dash Gerencial page.tsx:
  // rawInvest.forEach((v) => {
  //   if (v.cancel_reason) return;
  //   const gerente = v.gerente_responsavel || "Sem Gerente";
  //   ...
  // });
  const dashActionsByManager = { JULLIANO: [], LEANDRO: [], LUIZ: [] };
  rawInvest.forEach(v => {
    if (v.cancel_reason) return;
    const mgrKey = getCanonicalManagerKey(v.gerente_responsavel);
    if (dashActionsByManager[mgrKey]) {
      dashActionsByManager[mgrKey].push(v);
    }
  });

  // --- MÓDULO 2: RPS ---
  // Exactly how RPS api/route.ts fetches & processes:
  const sqlRps = `
    SELECT 
      id,
      gerente_responsavel as manager,
      mes_referencia,
      apuracao_valor_realizado,
      valor_investimento,
      expectativa_volume,
      abrangencia,
      skus_detalhes,
      familias_detalhes,
      cancel_reason
    FROM v_acoes_investimento_com_gerente
    WHERE mes_referencia IN ('${curMonthKey}')
      AND is_planejamento = false
      AND cancel_reason IS NULL
  `;
  const { data: rpsRows, error: errRps } = await supabase.rpc('execute_readonly_query', { query_text: sqlRps });
  if (errRps) {
    console.error("Error RPS RPC:", errRps);
    return;
  }

  // In RPS route.ts:
  // rawInvests.forEach(acao => {
  //   const key = `${acao.manager}|${acao.mes_referencia}`;
  //   ...
  // });
  // And then:
  // const curInvest = investHist.filter((i) => isSameManager(i.manager, mName) && i.mes_referencia === curMonthKey);
  const rpsActionsByManager = { JULLIANO: [], LEANDRO: [], LUIZ: [] };
  rpsRows.forEach(v => {
    const mgrKey = getCanonicalManagerKey(v.manager);
    if (rpsActionsByManager[mgrKey]) {
      rpsActionsByManager[mgrKey].push(v);
    }
  });

  // AUDIT FOR EACH MANAGER
  const managers = [
    { targetName: "Julliano", key: "JULLIANO" },
    { targetName: "Leandro Saffi", key: "LEANDRO" },
    { targetName: "Luiz", key: "LUIZ" }
  ];

  for (const m of managers) {
    console.log(`\n======================================================`);
    console.log(` AUDITORIA DE CONJUNTOS DE AÇÕES: GERENTE ${m.targetName.toUpperCase()}`);
    console.log(`======================================================`);

    const dashList = dashActionsByManager[m.key] || [];
    const rpsList = rpsActionsByManager[m.key] || [];

    const dashMap = new Map();
    dashList.forEach(a => dashMap.set(a.id, a));

    const rpsMap = new Map();
    rpsList.forEach(a => rpsMap.set(a.id, a));

    let dashSum = 0;
    console.log(`\n--- 1. Ações no Dashboard Gerencial (Total: ${dashList.length}) ---`);
    dashList.forEach(a => {
      const val = getInvestimentoRealizadoOficial(a);
      dashSum += val;
      console.log(`  [Dash] ID: ${a.id} | Rede: ${a.rede} | GerenteView: ${a.gerente_responsavel} | Valor: R$ ${val.toFixed(2)}`);
    });

    let rpsSum = 0;
    console.log(`\n--- 2. Ações na RPS (Total: ${rpsList.length}) ---`);
    rpsList.forEach(a => {
      const val = getInvestimentoRealizadoOficial(a);
      rpsSum += val;
      console.log(`  [RPS]  ID: ${a.id} | GerenteQuery: ${a.manager} | Valor: R$ ${val.toFixed(2)}`);
    });

    // 3. Comparação de conjuntos
    const onlyDash = dashList.filter(a => !rpsMap.has(a.id));
    const onlyRps = rpsList.filter(a => !dashMap.has(a.id));
    
    // Repetidas na RPS
    const rpsCounts = {};
    rpsList.forEach(a => rpsCounts[a.id] = (rpsCounts[a.id] || 0) + 1);
    const rpsDuplicates = Object.entries(rpsCounts).filter(([id, count]) => count > 1);

    // Repetidas no Dash
    const dashCounts = {};
    dashList.forEach(a => dashCounts[a.id] = (dashCounts[a.id] || 0) + 1);
    const dashDuplicates = Object.entries(dashCounts).filter(([id, count]) => count > 1);

    console.log(`\n--- 3. Análise de Diferenças de Conjuntos ---`);
    console.log(`- Ações presentes APENAS no Dashboard: ${onlyDash.length}`);
    onlyDash.forEach(a => console.log(`    -> ID: ${a.id} | Rede: ${a.rede} | Gerente: ${a.gerente_responsavel}`));

    console.log(`- Ações presentes APENAS na RPS: ${onlyRps.length}`);
    onlyRps.forEach(a => console.log(`    -> ID: ${a.id} | Gerente: ${a.manager}`));

    console.log(`- Ações repetidas no Dashboard: ${dashDuplicates.length}`);
    console.log(`- Ações repetidas na RPS: ${rpsDuplicates.length}`);

    console.log(`\n--- 4. Somatório Final de Investimentos ---`);
    console.log(`  Dashboard Total Invest (R$): R$ ${dashSum.toFixed(2)}`);
    console.log(`  RPS Total Invest (R$):       R$ ${rpsSum.toFixed(2)}`);
    console.log(`  Diferença (RPS - Dash):     R$ ${(rpsSum - dashSum).toFixed(2)}`);
  }
}

runAudit();
