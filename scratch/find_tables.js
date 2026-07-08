require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Listing tables and views in public schema...");
  
  // Use RPC or custom query if we had it, but we can query information_schema via a postgres function,
  // or we can just try to run some SQL. Let's see if there is any execute_sql RPC in the project.
  // Wait, does the project have a general sql-executing mechanism?
  // Let's query information_schema or check what we can. Let's try to query some standard tables.
  
  // Let's run a select on standard table names that we found in the code or migrations.
  const commonTables = [
    'base_atendimento',
    'cm_clientes',
    'cm_faturamento_sankhya',
    'view_redes_disponiveis',
    'cm_weekly_projections',
    'cm_investimentos',
    'cm_investimento_cliente',
    'cm_visitas',
    'cm_planejamentos'
  ];

  for (const table of commonTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table/View: ${table} - Error: ${error.message}`);
      } else {
        console.log(`Table/View: ${table} - Exists (Count: ${count})`);
      }
    } catch (e) {
      console.log(`Table/View: ${table} - Exception: ${e.message}`);
    }
  }
}

run();
