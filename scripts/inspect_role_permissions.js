require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPermissions() {
  const { data: roles } = await supabase.from('cm_role_permissions').select('role, module_name, has_access').limit(50);
  console.log("Permissões no banco:", roles);
}

checkPermissions();
