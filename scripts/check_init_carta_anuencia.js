require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Supabase URL or Service Role Key missing!");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function checkAndInit() {
  console.log("Verificando se a tabela cm_cartas_anuencia responde...");
  const { data, error } = await adminClient.from('cm_cartas_anuencia').select('*').limit(1);
  if (error) {
    console.log("Tabela cm_cartas_anuencia ainda não acessível via API REST:", error.message);
    console.log("Tentando executar DDL via execute_readonly_query ou inserções diretas...");
    
    // Tenta via execute_readonly_query se a RPC aceitar DDL
    const sqlPath = path.join(__dirname, '../supabase/migrations/20260723_carta_anuencia_module.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const { error: rpcErr } = await adminClient.rpc('execute_readonly_query', { query_text: sql });
    if (rpcErr) {
      console.log("RPC result:", rpcErr.message);
    } else {
      console.log("Migration aplicada via RPC execute_readonly_query!");
    }
  } else {
    console.log("Tabela cm_cartas_anuencia já está ativa e acessível! Data count:", data.length);
  }
}

checkAndInit();
