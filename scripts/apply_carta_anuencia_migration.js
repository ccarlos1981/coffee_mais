require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.log("Variável de conexão POSTGRES_URL / DATABASE_URL não encontrada no .env.local.");
    console.log("Vou utilizar o client Supabase via RPC se disponível.");
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("Conectado ao Postgres. Aplicando migration de Carta de Anuência...");
    const sqlPath = path.join(__dirname, '../supabase/migrations/20260723_carta_anuencia_module.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log("Migration aplicada com sucesso!");
  } catch (err) {
    console.error("Erro ao aplicar migration via pg:", err.message);
  } finally {
    await client.end();
  }
}

main();
