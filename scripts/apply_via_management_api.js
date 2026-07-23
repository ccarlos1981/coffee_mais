require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function applyMigrationViaManagementAPI() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = 'ncncazbhpoxjlyvcbvqa'; // From NEXT_PUBLIC_SUPABASE_URL

  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN não disponível!");
    return;
  }

  const sqlPath = path.join(__dirname, '../supabase/migrations/20260723_carta_anuencia_module.sql');
  const query = fs.readFileSync(sqlPath, 'utf8');

  console.log("Enviando SQL para a API de Gerenciamento do Supabase...");

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Erro na API de Gerenciamento do Supabase:", result);
    } else {
      console.log("Migration aplicada com sucesso via Supabase Management API!", result);
    }
  } catch (err) {
    console.error("Erro ao chamar API de Gerenciamento:", err.message);
  }
}

applyMigrationViaManagementAPI();
