require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runQuery(sql) {
  const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });
  if (error) throw new Error(error.message);
  return data;
}

async function run() {
  console.log("=== DB VALIDATION ===");

  try {
    // 1. Check tables
    const tables = await runQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('cm_responsavel_regras', 'cm_responsavel_sugestoes')
    `);
    console.log("Tables:", tables);

    // 2. Check RPC function
    const functions = await runQuery(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'fn_save_suggestions_transactional'
    `);
    console.log("Functions/RPCs:", functions);

    // 3. Check Indexes
    const indexes = await runQuery(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE tablename IN ('cm_responsavel_regras', 'cm_responsavel_sugestoes')
    `);
    console.log("Indexes:", indexes);

    // 4. Check RLS policies
    const policies = await runQuery(`
      SELECT policyname, tablename, cmd, roles, qual
      FROM pg_policies
      WHERE tablename IN ('cm_responsavel_regras', 'cm_responsavel_sugestoes')
    `);
    console.log("RLS Policies:", policies);

  } catch (err) {
    console.error("Error during DB verification:", err.message);
  }
}

run();
