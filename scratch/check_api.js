const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function check() {
  console.log("Running route GET query with relation hint...");
  const companyId = "e143e8d6-c7d7-4315-8f54-aa12ce554d2d";
  const { data, error } = await supabaseAdmin
    .from("cm_company_kpi_config")
    .select(`
      id,
      kpi_id,
      kpi_code,
      weight,
      target_value,
      warning_threshold,
      critical_threshold,
      threshold_low,
      threshold_medium,
      threshold_high,
      is_enabled,
      kpi:cm_kpi_definition!cm_company_kpi_config_kpi_id_fkey (
        kpi_key,
        kpi_code,
        display_name,
        kpi_name,
        category
      )
    `)
    .eq("company_id", companyId);

  console.log("Data returned:", data ? data.length + " rows" : "null");
  console.log("First row:", data ? data[0] : null);
  console.log("Error returned:", error);
}

check();
