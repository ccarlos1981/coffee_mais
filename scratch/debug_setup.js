const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("Checking promotor profiles...");
  const { data: profiles, error: err1 } = await supabase
    .from('cm_promotor_perfil')
    .select('*');
  
  if (err1) {
    console.error("Error fetching profiles:", err1);
    return;
  }
  
  console.log(`Found ${profiles.length} promotor profiles:`);
  console.log(profiles);

  console.log("\nChecking employees...");
  const { data: employees, error: errEmp } = await supabase
    .from('cm_employees')
    .select('*')
    .limit(5);
  
  if (errEmp) {
    console.error("Error fetching employees:", errEmp);
  } else {
    console.log("Sample employees:", employees);
  }

  console.log("\nChecking visits...");
  const { data: visits, error: err2 } = await supabase
    .from('cm_promotor_visita')
    .select('id, status, cod_parceiro, agenda_diaria_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (err2) {
    console.error("Error fetching visits:", err2);
    return;
  }

  console.log(`Found ${visits.length} recent visits:`);
  visits.forEach(v => {
    console.log(`- Visit ID: ${v.id}, Status: ${v.status}, Partner: ${v.cod_parceiro}, Agenda: ${v.agenda_diaria_id}`);
  });
}

run().catch(console.error);
