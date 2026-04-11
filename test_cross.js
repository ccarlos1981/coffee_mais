const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: sales } = await supabase.from('sales').select('network_uf, net_value, quantity');
  const { data: networks } = await supabase.from('network_matrix').select('*');
  
  const map = new Map();
  networks.forEach(n => {
    if (n.rede_uf) map.set(n.rede_uf.trim().toUpperCase(), n);
  });
  
  let match = 0;
  let noMatch = 0;
  const noMatchNames = new Set();
  
  sales.forEach(s => {
    const k = (s.network_uf || "").trim().toUpperCase();
    if (map.has(k)) match++;
    else {
      noMatch++;
      noMatchNames.add(k);
    }
  });
  
  console.log(`Matched: ${match}, Unmatched: ${noMatch}`);
  if (noMatchNames.size > 0) {
    console.log(`Unmatched Network Names:`, Array.from(noMatchNames));
  }
}
run();
