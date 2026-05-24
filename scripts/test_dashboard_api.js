require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const res = await fetch('http://localhost:3000/api/dashboard?startDate=2025-01-01&endDate=2025-04-30&investment=0&manager=all&familia=all&uf=all&channel=all&product=all');
  const text = await res.text();
  if (!res.ok || text.startsWith('<')) {
    console.log('API Error:', res.status, text.slice(0, 500));
    return;
  }
  const data = JSON.parse(text);
  console.log('Totals:', data.totals);
  console.log('By Manager count:', data.byManager?.length);
  console.log('By Familia count:', data.byFamilia?.length);
}

run();
