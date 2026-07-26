require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function inspectJulliano() {
  const closedMonths = ['2026-06', '2026-05', '2026-04'];
  const mName = "Julliano";

  const sqlClientHistory = `
    SELECT 
      mes,
      manager,
      TRIM(rede) as client,
      SUM(fat) as fat
    FROM public.mv_vendas_cliente_mensal
    WHERE mes IN ('2026-06', '2026-05', '2026-04', '2026-07')
      AND rede IS NOT NULL AND TRIM(rede) != ''
    GROUP BY mes, manager, TRIM(rede)
  `;
  const { data: cliHist } = await supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory });

  const sqlBaseClients = `
    SELECT 
      manager,
      manager_id,
      TRIM(rede) as client
    FROM vw_redes_planejaveis_oficiais
    WHERE is_rede_planejavel = TRUE
  `;
  const { data: baseCli } = await supabase.rpc('execute_readonly_query', { query_text: sqlBaseClients });

  const managerBaseCli = (baseCli || []).filter(b => isSameManager(b.manager, mName) || isSameManager(b.manager_id, mName));
  const managerCliHist = (cliHist || []).filter(c => isSameManager(c.manager, mName));

  const redeSet = new Set(managerBaseCli.map(b => b.client));
  redeSet.delete('');
  redeSet.delete('Não Mapeado');
  redeSet.delete('OUTROS');

  console.log("redeSet para Julliano:", Array.from(redeSet));
  console.log("\nmanagerCliHist para Julliano em closedMonths:");
  managerCliHist.filter(c => closedMonths.includes(c.mes)).forEach(c => {
    console.log(`  mes=${c.mes} client="${c.client}" fat=${c.fat}`);
  });

  const redeRollingMap = {};
  for (const cName of redeSet) {
    const r3m = managerCliHist
      .filter(c => c.client === cName && closedMonths.includes(c.mes))
      .reduce((acc, c) => acc + Number(c.fat || 0), 0);
    redeRollingMap[cName] = r3m;
  }

  console.log("\nredeRollingMap exato:");
  Object.keys(redeRollingMap).forEach(k => {
    console.log(`  "${k}": R$ ${redeRollingMap[k]}`);
  });

  const sortedRedeNames = Array.from(redeSet).sort((a, b) => {
    const fatA = redeRollingMap[a] || 0;
    const fatB = redeRollingMap[b] || 0;
    if (fatB !== fatA) return fatB - fatA;
    return a.localeCompare(b, 'pt-BR');
  });

  console.log("\nsortedRedeNames resultante na API:");
  sortedRedeNames.forEach((r, i) => console.log(`  ${i+1}. "${r}" (R$ ${redeRollingMap[r]})`));
}

inspectJulliano();
