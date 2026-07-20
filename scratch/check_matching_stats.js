require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runQuery(sql) {
  const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });
  if (error) throw new Error(error.message);
  return data;
}

async function run() {
  console.log("=== TESTING CACHE TABLE JOIN PERFORMANCE ===");

  const sql = `
    SELECT c.id, c.codigo, c.nome_parceiro, a.ultima_compra, a.dias_sem_comprar, a.situacao_comercial, a.valor_faturado_12m, a.quantidade_notas_12m
    FROM public.cm_clientes c
    LEFT JOIN public.cm_clientes_atividade a ON c.id = a.cliente_id
    LIMIT 20
  `;

  const start = Date.now();
  try {
    const res = await runQuery(sql);
    console.log("Time taken:", Date.now() - start, "ms");
    console.log("Results count:", res.length);
    console.log("First 5 results:", res.slice(0, 5));

  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
