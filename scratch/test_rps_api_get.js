const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("=== TESTING RPS TOP 10 CLIENT RANKING LOGIC ===");

  // Define parameters for July 2026
  const year = 2026;
  const month = 7;
  const curMonthKey = "2026-07";
  const prevMonthKey = "2026-06";
  const prevYearKey = "2025-07";

  // Fetch client history (from mv_vendas_cliente_mensal)
  console.log("Fetching client history from mv_vendas_cliente_mensal...");
  const { data: rawCliHist, error } = await supabase
    .from('mv_vendas_cliente_mensal')
    .select('mes, manager, rede, nome_parceiro, fat')
    .in('mes', [curMonthKey, prevMonthKey, prevYearKey, "2026-05", "2026-04"])
    .in('manager', ['Julliano', 'Leandro', 'Leandro Saffi', 'Luiz']);

  if (error) {
    console.error("Error fetching client history:", error);
    process.exit(1);
  }

  console.log(`Fetched ${rawCliHist.length} raw records.`);

  // Map and normalize Leandro Saffi to Leandro
  const cliHist = rawCliHist.map((c) => ({
    mes: c.mes,
    manager: c.manager === 'Leandro Saffi' ? 'Leandro' : (c.manager || 'Outros'),
    client: c.rede || c.nome_parceiro || 'Não Mapeado',
    fat: Number(c.fat || 0)
  }));

  const managers = ["Julliano", "Leandro", "Luiz"];
  const closedMonth1 = prevMonthKey;
  const closedMonth2 = "2026-05";
  const closedMonth3 = "2026-04";

  managers.forEach(mName => {
    console.log(`\n----------------------------------------`);
    console.log(`MANAGER: ${mName}`);

    // Filter historical data for this manager
    const managerCliHist = cliHist.filter(c => c.manager === mName);
    
    // Unique clients
    const allClientNames = Array.from(new Set(managerCliHist.map(c => c.client)));
    console.log(`Total unique clients in history for ${mName}: ${allClientNames.length}`);

    // Map rankingFat for ranking (sum of last 3 closed months faturamento)
    const clientSalesSummary = allClientNames.map(cName => {
      const salesC1 = managerCliHist.filter(c => c.client === cName && c.mes === closedMonth1);
      const salesC2 = managerCliHist.filter(c => c.client === cName && c.mes === closedMonth2);
      const salesC3 = managerCliHist.filter(c => c.client === cName && c.mes === closedMonth3);

      const fatC1 = salesC1.reduce((acc, s) => acc + s.fat, 0);
      const fatC2 = salesC2.reduce((acc, s) => acc + s.fat, 0);
      const fatC3 = salesC3.reduce((acc, s) => acc + s.fat, 0);

      const rankingFat = fatC1 + fatC2 + fatC3;

      const curSales = managerCliHist.find((c) => c.client === cName && c.mes === curMonthKey);
      const pmSales = managerCliHist.find((c) => c.client === cName && c.mes === prevMonthKey);
      const pySales = managerCliHist.find((c) => c.client === cName && c.mes === prevYearKey);

      const fatCur = Number(curSales?.fat || 0);
      const fatPm = Number(pmSales?.fat || 0);
      const fatPy = Number(pySales?.fat || 0);

      return {
        clientName: cName,
        fatCur,
        fatPm,
        fatPy,
        rankingFat
      };
    });

    // Sort decrescendo by rankingFat
    clientSalesSummary.sort((a, b) => b.rankingFat - a.rankingFat);

    // Slice top 10 and others
    const topClientsSummary = clientSalesSummary.slice(0, 10);
    const otherClientsSummary = clientSalesSummary.slice(10);

    console.log(`Top ${topClientsSummary.length} Clients:`);
    topClientsSummary.forEach((cli, idx) => {
      console.log(`  ${idx + 1}. ${cli.clientName} (RankingFat: ${cli.rankingFat.toFixed(2)})`);
    });

    console.log(`Remaining clients grouped in OUTROS: ${otherClientsSummary.length}`);
    if (otherClientsSummary.length > 0) {
      const sumAnoA = otherClientsSummary.reduce((acc, c) => acc + c.fatPy, 0);
      const sumMesA = otherClientsSummary.reduce((acc, c) => acc + c.fatPm, 0);
      console.log(`  OUTROS Consolidated - mes_a: ${sumMesA.toFixed(2)}, ano_a: ${sumAnoA.toFixed(2)}`);
      otherClientsSummary.forEach((cli, idx) => {
        console.log(`    - Excluded Client ${idx + 1}: ${cli.clientName} (RankingFat: ${cli.rankingFat.toFixed(2)})`);
      });
    }
  });

  console.log(`\n=== TEST COMPLETE ===`);
}

run();
