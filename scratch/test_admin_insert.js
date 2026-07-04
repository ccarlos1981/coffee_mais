require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Simulating createAdminClient (service role)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Check cristiano user id
  const { data: { users } } = await admin.auth.admin.listUsers();
  const cristiano = users.find(u => u.email === 'cristiano@coffeemais.com');
  console.log('Cristiano ID:', cristiano?.id);

  // Try to insert a test log
  const { data, error } = await admin.from('cm_audit_logs').insert({
    user_id: cristiano?.id,
    action: 'Acesso',
    table_name: 'teste_admin_client'
  });

  if (error) {
    console.error('INSERT ERROR:', error);
  } else {
    console.log('INSERT SUCCESS - log gravado!');
  }

  // Verify it was saved
  const { data: latest } = await admin
    .from('cm_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log('Latest 3 logs:', latest);
}
run();
