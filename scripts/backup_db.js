const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Read environment variables from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) envVars[key.trim()] = vals.join('=').trim();
});

// 2. Initialize Supabase client with SERVICE_ROLE_KEY to bypass RLS and increase limit/throughput
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const backupDir = path.join(__dirname, '..', 'backup_' + new Date().toISOString().split('T')[0]);
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log(`Saving database backup to: ${backupDir}`);

// Helper to download tables using correct pagination strategy
async function downloadTable(tableName, pkName = 'id', isLarge = false) {
  console.log(`Backup starting for table: ${tableName} (pk: ${pkName}, large: ${isLarge})`);
  const startTime = Date.now();
  const pageSize = 1000;
  let offset = 0;
  
  if (isLarge) {
    const jsonlFilePath = path.join(backupDir, `${tableName}.jsonl`);
    const writeStream = fs.createWriteStream(jsonlFilePath);
    let lastPkValue = null;

    while (true) {
      let query = supabase
        .from(tableName)
        .select('*')
        .order(pkName, { ascending: true })
        .limit(pageSize);

      if (lastPkValue !== null) {
        query = query.gt(pkName, lastPkValue);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`Error fetching page for ${tableName}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        writeStream.write(JSON.stringify(row) + '\n');
      }

      offset += data.length;
      lastPkValue = data[data.length - 1][pkName];

      if (offset % 10000 === 0 || data.length < pageSize) {
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        const speed = (offset / elapsedSec).toFixed(1);
        console.log(`... fetched ${offset} records from ${tableName} (elapsed: ${elapsedSec}s, speed: ${speed} rec/s)`);
      }

      if (data.length < pageSize) break;
    }
    
    writeStream.end();
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Finished large table ${tableName}: ${offset} total records saved to ${jsonlFilePath} in ${elapsedSec}s.\n`);
  } else {
    const filePath = path.join(backupDir, `${tableName}.json`);
    const allData = [];

    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order(pkName, { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(`Error fetching page for ${tableName}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;

      allData.push(...data);
      offset += data.length;

      if (data.length < pageSize) break;
    }
    
    fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Finished ${tableName}: ${allData.length} records saved to ${filePath} in ${elapsedSec}s.\n`);
  }
}

async function run() {
  try {
    // 1. Download small and medium tables with correct primary keys and pagination
    await downloadTable('targets', 'id', false);
    await downloadTable('business_days', 'id', false);
    await downloadTable('network_matrix', 'id', false);
    await downloadTable('cm_clientes', 'id', false);
    await downloadTable('base_atendimento', 'cod_parceiro', false);
    await downloadTable('sales_v2', 'id', false);

    // 2. Download the large transaction table with keyset pagination
    await downloadTable('cm_faturamento_sankhya', 'id', true);
    
    console.log('Database backup completed successfully!');
  } catch (err) {
    console.error('Backup failed:', err);
  }
}

run();
