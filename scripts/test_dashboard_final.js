require('dotenv').config({ path: '.env.local' });

async function run() {
  const url = 'http://localhost:3000/api/dashboard?startDate=2025-01-01&endDate=2025-04-30&investment=0&manager=all&familia=all&uf=all&channel=all&product=all';
  const res = await fetch(url);
  if (!res.ok) {
    console.log('Error dashboard:', res.status, await res.text());
  } else {
    const data = await res.json();
    console.log('Dashboard Totals:', data.totals);
    console.log('Dashboard By Manager:', data.byManager.map(m => m.manager));
  }

  const hUrl = 'http://localhost:3000/api/dashboard/history?startDate=2025-01-01&endDate=2025-04-30';
  const resH = await fetch(hUrl);
  if (!resH.ok) {
    console.log('Error history:', resH.status, await resH.text());
  } else {
    const dataH = await resH.json();
    console.log('History Totals:', dataH.totals);
  }
}
run();
