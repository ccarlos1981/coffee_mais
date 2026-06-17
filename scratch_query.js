require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('cm_weekly_projections')
    .select('*')
    .limit(100);

  if (error) {
    console.error("Erro:", error.message);
  } else {
    console.log("--- PROJEÇÕES SEMANAIS GRAVADAS (LIMITE 100) ---");
    console.log(`Encontrados ${data.length} registros no total.`);
    if (data.length > 0) {
      // Agrupa por ano/mês para vermos onde há dados
      const summary = {};
      data.forEach(r => {
        const key = `${r.year}-${r.month}`;
        summary[key] = (summary[key] || 0) + 1;
      });
      console.log("Resumo por Período (Ano-Mês):", summary);
      console.log("Primeiros 10 registros:", JSON.stringify(data.slice(0, 10), null, 2));
    }
  }
}
run();
