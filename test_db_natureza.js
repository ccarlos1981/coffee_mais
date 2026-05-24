require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  let from = 0;
  let allRows = [];
  while(true) {
    const { data, error } = await supabase.from('cm_faturamento_sankhya')
      .select('nome_vendedor, vlr_total_liq, cod_natureza, cod_top')
      .in('nome_vendedor', ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'])
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .range(from, from + 999);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  
  let valid = 0;
  let invalidNatureza = 0;
  let invalidTop = 0;
  let invalidBoth = 0;
  
  for(let row of allRows) {
    const validNat = [3, 222, 9, 313, 219, 216].includes(row.cod_natureza);
    const validTop = [301, 303, 309, 311, 314].includes(row.cod_top);
    
    if (validNat && validTop) valid += row.vlr_total_liq;
    else if (!validNat && validTop) invalidNatureza += row.vlr_total_liq;
    else if (validNat && !validTop) invalidTop += row.vlr_total_liq;
    else invalidBoth += row.vlr_total_liq;
  }
  console.log(`Valid: ${valid}`);
  console.log(`Invalid Natureza: ${invalidNatureza}`);
  console.log(`Invalid Top: ${invalidTop}`);
  console.log(`Invalid Both: ${invalidBoth}`);
}
run();
