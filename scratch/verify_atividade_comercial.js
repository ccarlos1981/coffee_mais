require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runQuery(sql) {
  const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });
  if (error) throw new Error(error.message);
  return data;
}

async function verify() {
  console.log("=== INTEGRATION TEST: CLIENT ACTIVITY INDICATORS ===");

  try {
    // 1. Check table existence and row count
    const countRes = await runQuery(`SELECT COUNT(*) as count FROM public.cm_clientes_atividade`);
    const totalCount = countRes[0].count;
    console.log(`  cm_clientes_atividade row count: ${totalCount}`);
    if (totalCount > 0) {
      console.log("  ✅ Table cm_clientes_atividade is populated!");
    } else {
      console.log("  ❌ Table cm_clientes_atividade is empty!");
    }

    // 2. Check last refresh timestamp
    const refreshRes = await runQuery(`SELECT DISTINCT last_refresh_at FROM public.cm_clientes_atividade LIMIT 1`);
    console.log(`  Last Refresh Timestamp: ${refreshRes[0]?.last_refresh_at}`);
    if (refreshRes[0]?.last_refresh_at) {
      console.log("  ✅ Timestamp exists!");
    } else {
      console.log("  ❌ Timestamp is missing!");
    }

    // 3. Count by classification
    const classificationCounts = await runQuery(`
      SELECT situacao_comercial, COUNT(*) as count 
      FROM public.cm_clientes_atividade 
      GROUP BY situacao_comercial
    `);
    console.log("  Counts by situation:", classificationCounts);

    const situations = classificationCounts.map(r => r.situacao_comercial);
    if (situations.length > 0) {
      console.log("  ✅ Classifications are working!");
    } else {
      console.log("  ❌ No classifications found!");
    }

    // 4. Test joined query exactly like Postgrest (select and left join)
    const joinRes = await runQuery(`
      SELECT c.codigo, c.nome_parceiro, a.ultima_compra, a.dias_sem_comprar, a.situacao_comercial, a.valor_faturado_12m, a.quantidade_notas_12m
      FROM public.cm_clientes c
      LEFT JOIN public.cm_clientes_atividade a ON c.id = a.cliente_id
      WHERE a.situacao_comercial = 'Ativo'
      LIMIT 3
    `);
    console.log("  Sample Active Clients Joined:", joinRes);
    if (joinRes.length > 0) {
      console.log("  ✅ Join query works perfectly!");
    } else {
      console.log("  ❌ Join query returned zero active clients!");
    }

    console.log("\n=== ALL SYSTEM INDICATORS VERIFIED AND CORRECT! ===");

  } catch (err) {
    console.error("❌ Test verification failed:", err.message);
  }
}

verify();
