require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seedPermissions() {
  const rolesToGrant = ["Admin", "CEO", "Gerente Regional", "Trade", "Financeiro", "TI", "Gerente Nacional", "Diretor"];
  
  for (const role of rolesToGrant) {
    const { error } = await supabase.from('cm_role_permissions').upsert({
      role: role,
      module_name: 'Carta de Anuência',
      has_access: true,
    }, { onConflict: 'role,module_name' });

    if (error) {
      console.error(`Erro ao conceder permissão para ${role}:`, error.message);
    } else {
      console.log(`Permissão "Carta de Anuência" concedida para ${role}`);
    }
  }
}

seedPermissions();
