require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runQuery(sql) {
  const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });
  if (error) throw new Error(error.message);
  return data;
}

async function run() {
  console.log("=== SELECT FROM CM_AI_DECISION_LOG ===");

  try {
    const res = await runQuery(`
      SELECT * FROM cm_ai_decision_log LIMIT 5
    `);
    console.log(res);

  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
