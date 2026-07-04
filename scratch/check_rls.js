require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Check RLS policies on cm_audit_logs
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*')
    .filter('tablename', 'eq', 'cm_audit_logs');

  if (error) {
    // Try raw SQL instead
    const { data: sql, error: sqlErr } = await supabase.rpc('exec_sql', { sql: `
      SELECT policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'cm_audit_logs';
    `});
    console.log('RLS policies (sql):', sql, sqlErr);
    return;
  }
  console.log('RLS policies:', data);
}
run();
