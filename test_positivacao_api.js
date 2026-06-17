require('dotenv').config({ path: '.env.local' });
const { GET } = require('./src/app/api/dashboard/positivacao/route');

async function test() {
  const req = {
    url: 'http://localhost:3000/api/dashboard/positivacao?startDate=2025-05-01&endDate=2026-05-31&channel=KA'
  };

  console.log('Calling Positivação API route GET...');
  try {
    const res = await GET(req);
    const json = await res.json();
    console.log('API success:', json.success);
    console.log('Totals in response:', json.totals);
    console.log('byMonth length:', json.byMonth?.length);
    if (json.byMonth) {
      console.log('Sample byMonth:', json.byMonth.slice(0, 3));
    }
    console.log('byManager length:', json.byManager?.length);
    if (json.byManager) {
      console.log('byManager managers:', json.byManager.map(m => m.manager));
    }
  } catch (err) {
    console.error('Error executing GET:', err);
  }
}

test();
