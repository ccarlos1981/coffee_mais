const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) envVars[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const backupDir = path.join(__dirname, 'backup_' + new Date().toISOString().split('T')[0]);
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

async function downloadTable(tableName) {
  console.log(`Starting backup of table: ${tableName}`);
  const allData = [];
  const pageSize = 1000;
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
      
    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allData.push(...data);
    offset += data.length;
    console.log(`... fetched ${allData.length} records from ${tableName}`);
    
    if (data.length < pageSize) break;
  }
  
  fs.writeFileSync(path.join(backupDir, `${tableName}.json`), JSON.stringify(allData, null, 2));
  console.log(`Finished ${tableName}: ${allData.length} total records saved.\n`);
}

async function run() {
  await downloadTable('targets');
  await downloadTable('business_days');
  await downloadTable('network_matrix');
  await downloadTable('cm_clientes');
  await downloadTable('sales'); // This will take a moment
  console.log('Backup complete!');
}

run();
