require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function run() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN is missing in .env.local');
  }

  // Parse project ref from URL or use it directly
  const projectRef = 'ncncazbhpoxjlyvcbvqa';
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260706_create_skus_conversao.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`Executing SQL migration on project ${projectRef}...`);

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const bodyText = await response.text();
  console.log('Response Status:', response.status);
  
  try {
    const data = JSON.parse(bodyText);
    console.log('Response Data:', data);
  } catch (e) {
    console.log('Raw Response:', bodyText);
  }
}

run().catch(console.error);
