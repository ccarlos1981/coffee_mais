const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// Load env from .env.local manually
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) envVars[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function formatDateISO(date) {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

async function seed() {
  const filePath = './Dados da Coffee mais/Dados extras/dados3.xlsx';
  console.log(`\n🔄 Carregando ${filePath} (38MB, pode demorar ~30s)...\n`);

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['Planilha1'];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Headers are at row index 1
  const headers = rawData[1];
  console.log('📋 Headers encontrados:', headers.length, 'colunas');

  // Parse all rows
  const allRows = [];
  for (let i = 2; i < rawData.length; i++) {
    const obj = {};
    headers.forEach((h, idx) => { if (h) obj[h] = rawData[i][idx]; });
    allRows.push(obj);
  }
  console.log(`📊 Total de linhas brutas: ${allRows.length}`);

  // Filter: only valid rows (Ativo? = 'Sim' and Ano_Mês != '1900_01')
  const validRows = allRows.filter(r => {
    if (r['Ativo?'] === 'Não' || r['Ativo?'] === 'Nao') return false;
    if (r['Ano_Mês'] === '1900_01') return false;
    // Must have a valid date
    const dt = r['Data Faturamento'];
    if (!dt) return false;
    const d = new Date(dt);
    if (isNaN(d.getTime()) || d.getFullYear() < 2020) return false;
    return true;
  });

  console.log(`✅ Linhas válidas após filtro: ${validRows.length}`);
  console.log(`🗑️ Linhas descartadas: ${allRows.length - validRows.length}`);

  // Create upload batch
  const batchId = require('crypto').randomUUID();
  await supabase.from("upload_batches").insert({
    id: batchId,
    filename: "dados3.xlsx (re-ingestão completa)",
    status: "processing"
  });

  // Map rows to DB schema
  const dbRows = [];
  for (const row of validRows) {
    const rawDate = row['Data Faturamento'];
    let invoiceDate = null;
    if (rawDate instanceof Date) {
      invoiceDate = formatDateISO(rawDate);
    } else if (typeof rawDate === 'string') {
      invoiceDate = formatDateISO(new Date(rawDate));
    }
    if (!invoiceDate) continue;

    // Manager: use Responsável, but convert `false` to "Inside Sales"
    let manager = row['Responsável'];
    if (manager === false || manager === 'false' || !manager) {
      manager = 'Inside Sales';
    } else {
      manager = String(manager);
    }

    dbRows.push({
      // Core identifiers
      chave: row['Chave'] ? String(row['Chave']) : null,
      invoice_date: invoiceDate,
      invoice_number: row['Nro. Nota'] ? String(row['Nro. Nota']).replace(/\.0$/, '') : null,
      unique_number: row['Nro. Único'] ? String(row['Nro. Único']).replace(/\.0$/, '') : null,

      // Geography & Organization
      network_uf: row['Rede_UF'] ? String(row['Rede_UF']) : null,
      uf: row['UF'] ? String(row['UF']) : null,
      uf_destination: row['UF Destino'] ? String(row['UF Destino']) : null,
      regional: row['Regional'] ? String(row['Regional']) : null,
      manager: manager,
      rede: row['Rede'] ? String(row['Rede']) : null,
      ka: row['KA'] ? String(row['KA']) : null,

      // Partner / Client
      nome_parceiro: row['Nome do Parceiro'] ? String(row['Nome do Parceiro']) : null,
      parceiro: row['Parceiro'] ? String(row['Parceiro']).substring(0, 200) : null,
      cod_parceiro: row['Cód. Parceiro'] ? String(row['Cód. Parceiro']) : null,

      // Product
      product: row['Produto'] ? String(row['Produto']) : null,
      cod_produto: row['Cód. Produto'] ? String(row['Cód. Produto']) : null,
      tipo_produto: row['Tipo de Produto'] ? String(row['Tipo de Produto']) : null,
      quantity: typeof row['Qtd.'] === 'number' ? row['Qtd.'] : null,

      // Financial (all in R$)
      net_value: typeof row['Vlr. Total Líq.'] === 'number' ? row['Vlr. Total Líq.'] : 0,
      vlr_unitario: typeof row['Vlr. Unitário'] === 'number' ? row['Vlr. Unitário'] : 0,
      imposto: typeof row['Imposto'] === 'number' ? row['Imposto'] * 1000 : 0, // KR$ -> R$
      custo_unitario: typeof row['Custo'] === 'number' ? row['Custo'] : 0,
      custo_total: typeof row['Custo Total'] === 'number' ? row['Custo Total'] : 0,
      discount: typeof row['Vlr. Desconto'] === 'number' ? row['Vlr. Desconto'] : 0,

      // Freight
      receita_frete: typeof row['Receita Frete'] === 'number' ? row['Receita Frete'] : 0,
      custo_frete: typeof row['Custo Frete'] === 'number' ? row['Custo Frete'] : 0,
      vlr_frete: typeof row['Vlr. Frete'] === 'number' ? row['Vlr. Frete'] : 0,
      freight: typeof row['Receita Frete'] === 'number' ? row['Receita Frete'] : 0,

      // Tax substitution
      vlr_substituicao: typeof row['Vlr. Substituição'] === 'number' ? row['Vlr. Substituição'] : 0,

      // Classification
      channel: row['Descrição (Natureza)'] ? String(row['Descrição (Natureza)']) : null,
      seller: row['Vendedor'] ? String(row['Vendedor']) : null,
      comissao: row['Comissão'] ? String(row['Comissão']) : null,
      payment_type: row['Tipo Pagamento'] ? String(row['Tipo Pagamento']) : null,
      cfop: row['CFOP'] ? String(row['CFOP']) : null,
      empresa: row['Empresa'] ? String(row['Empresa']) : null,

      // Time dimensions
      ano: typeof row['Ano'] === 'number' ? row['Ano'] : null,
      mes: typeof row['Mês'] === 'number' ? row['Mês'] : null,
      dia: typeof row['Dia'] === 'number' ? row['Dia'] : null,
      ano_mes: row['Ano_Mês'] ? String(row['Ano_Mês']) : null,

      // CPV (use custo_total as CPV for backwards compatibility)
      cpv: typeof row['Custo Total'] === 'number' ? row['Custo Total'] : 0,

      upload_batch_id: batchId,
    });
  }

  console.log(`\n📦 ${dbRows.length} linhas mapeadas para inserção.`);

  // Show financial summary before inserting
  let totalFat = 0, totalImposto = 0, totalCusto = 0;
  dbRows.forEach(r => {
    totalFat += r.net_value || 0;
    totalImposto += r.imposto || 0;
    totalCusto += r.custo_total || 0;
  });
  console.log(`💰 Faturamento total: R$ ${totalFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`🏛️ Imposto total: R$ ${totalImposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`📉 Custo total: R$ ${totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Manager distribution
  const managerDist = {};
  dbRows.forEach(r => {
    managerDist[r.manager] = (managerDist[r.manager] || 0) + 1;
  });
  console.log('\n👥 Distribuição por Gerente:');
  Object.entries(managerDist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`   ${k}: ${v} linhas`);
  });

  // Bulk insert
  console.log('\n🚀 Iniciando inserção em batches de 500...\n');
  let successCount = 0;
  let errorCount = 0;
  const batchSize = 500;

  for (let i = 0; i < dbRows.length; i += batchSize) {
    const batch = dbRows.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("sales").insert(batch);

    if (insertError) {
      console.error(`❌ Erro no batch ${i}-${i + batchSize}:`, insertError.message);
      errorCount += batch.length;
      // Try individual inserts for this batch to find problem rows
      for (const row of batch) {
        const { error: singleError } = await supabase.from("sales").insert(row);
        if (singleError) {
          errorCount++;
          console.error(`   Row error (NF ${row.invoice_number}):`, singleError.message);
        } else {
          successCount++;
        }
      }
    } else {
      successCount += batch.length;
      if (successCount % 5000 === 0 || i + batchSize >= dbRows.length) {
        const pct = ((successCount / dbRows.length) * 100).toFixed(1);
        console.log(`   ✅ ${successCount}/${dbRows.length} inseridos (${pct}%)`);
      }
    }
  }

  // Update batch status
  await supabase.from("upload_batches").update({
    status: "completed",
    records_processed: successCount
  }).eq("id", batchId);

  console.log(`\n🎉 Ingestão concluída!`);
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  console.log(`   📋 Batch ID: ${batchId}`);
}

seed().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
