import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function grantAccess() {
  const { data: adminUsers } = await supabase
    .from('cm_role_permissions')
    .select('*')
    .eq('role', 'Admin')
    .eq('module_name', 'Clientes');

  if (!adminUsers || adminUsers.length === 0) {
    await supabase.from('cm_role_permissions').insert({
      role: 'Admin',
      module_name: 'Clientes',
      has_access: true
    });
    console.log('Access granted to Admin');
  }

  const { data: ceoUsers } = await supabase
    .from('cm_role_permissions')
    .select('*')
    .eq('role', 'CEO')
    .eq('module_name', 'Clientes');

  if (!ceoUsers || ceoUsers.length === 0) {
    await supabase.from('cm_role_permissions').insert({
      role: 'CEO',
      module_name: 'Clientes',
      has_access: true
    });
    console.log('Access granted to CEO');
  }
}

grantAccess();
