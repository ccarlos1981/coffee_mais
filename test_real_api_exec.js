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

async function testRealApiExec() {
  const year = 2026;
  const month = 7;

  const curMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevMonthVal = month === 1 ? 12 : month - 1;
  const prevMonthKey = `${prevMonthYear}-${String(prevMonthVal).padStart(2, '0')}`;
  const prevYearYear = year - 1;
  const prevYearKey = `${prevYearYear}-${String(month).padStart(2, '0')}`;

  const closedMonths = [];
  let tempY = year;
  let tempM = month;
  for (let i = 0; i < 3; i++) {
    tempM--;
    if (tempM === 0) {
      tempM = 12;
      tempY--;
    }
    closedMonths.push(`${tempY}-${String(tempM).padStart(2, '0')}`);
  }

  const sqlClientHistory = `
    SELECT 
      mes,
      manager,
      TRIM(rede) as client,
      SUM(fat) as fat
    FROM public.mv_vendas_cliente_mensal
    WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}', '${closedMonths[1]}', '${closedMonths[2]}')
      AND rede IS NOT NULL AND TRIM(rede) != ''
    GROUP BY mes, manager, TRIM(rede)
  `;
  const sqlBaseClients = `
    SELECT 
      manager,
      manager_id,
      TRIM(rede) as client
    FROM vw_redes_planejaveis_oficiais
    WHERE is_rede_planejavel = TRUE
  `;

  const [resCliHist, resBaseCli] = await Promise.all([
    supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory }),
    supabase.rpc('execute_readonly_query', { query_text: sqlBaseClients })
  ]);

  const cliHist = resCliHist.data || [];
  const baseCli = resBaseCli.data || [];

  const mName = "Julliano";

  const managerBaseCli = baseCli.filter((b) => isSameManager(b.manager, mName) || isSameManager(b.manager_id, mName));
  const managerCliHist = cliHist.filter((c) => isSameManager(c.manager, mName));

  const redeSet = new Set(managerBaseCli.map((b) => b.client));
  redeSet.delete('');
  redeSet.delete('Não Mapeado');
  redeSet.delete('OUTROS');

  const redeRollingMap = new Map();
  Array.from(redeSet).forEach(cName => {
    const r3m = managerCliHist
      .filter((c) => c.client === cName && closedMonths.includes(c.mes))
      .reduce((acc, c) => acc + Number(c.fat || 0), 0);
    redeRollingMap.set(cName, r3m);
  });

  const sortedRedeNames = Array.from(redeSet).sort((a, b) => {
    const fatA = redeRollingMap.get(a) || 0;
    const fatB = redeRollingMap.get(b) || 0;
    if (fatB !== fatA) return fatB - fatA;
    return a.localeCompare(b, 'pt-BR');
  });

  console.log("=== PAYLOAD REAL DO BACKEND (/api/processo-comercial/rps) ===");
  console.log("Array 'clients' enviado para o Gerente Julliano na ordem exata:\n");

  sortedRedeNames.forEach((cName, idx) => {
    const r3m = redeRollingMap.get(cName) || 0;
    console.log(`[Posição ${idx + 1}] client: "${cName}" | Rolling 3M FAT: R$ ${r3m.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  });
  console.log(`[Posição ${sortedRedeNames.length + 1}] client: "OUTROS" | Rolling 3M FAT: N/A`);
}

testRealApiExec();
