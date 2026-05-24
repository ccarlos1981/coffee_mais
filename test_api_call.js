async function run() {
  const res = await fetch('http://localhost:3000/api/dashboard?startDate=2026-05-01&endDate=2026-05-31');
  if(!res.ok) {
     console.error("HTTP error", res.status);
     const text = await res.text();
     console.error(text);
     return;
  }
  const json = await res.json();
  const totals = json.managerRows.map(m => ({ manager: m.manager, fat: m.fat }));
  console.log(totals);
  const totalGeral = totals.reduce((sum, item) => sum + item.fat, 0);
  console.log("Total Geral:", totalGeral.toLocaleString('pt-BR'));
}
run();
