require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Auth error:', error);
    return;
  }
  
  console.log('Registered Auth Users:');
  users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}`));

  const { data: logs, error: logError } = await supabase
    .from('cm_audit_logs')
    .select('user_id, created_at, action, table_name')
    .order('created_at', { ascending: false });

  if (logError) {
    console.error('Logs error:', logError);
    return;
  }

  console.log('\nAudit Logs per User ID:');
  const userMap = {};
  users.forEach(u => userMap[u.id] = u.email);

  const stats = {};
  logs?.forEach(l => {
    const uid = l.user_id || 'sistema';
    const email = userMap[uid] || uid;
    if (!stats[email]) stats[email] = { count: 0, lastActive: null, actions: new Set() };
    stats[email].count++;
    stats[email].actions.add(l.action);
    if (!stats[email].lastActive || new Date(l.created_at) > new Date(stats[email].lastActive)) {
      stats[email].lastActive = l.created_at;
    }
  });

  console.log(Object.entries(stats).map(([email, s]) => ({
    email,
    count: s.count,
    lastActive: s.lastActive,
    actions: Array.from(s.actions)
  })));
}
run();
