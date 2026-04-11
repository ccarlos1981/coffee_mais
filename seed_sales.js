const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function excelDateToDate(serial) {
  if (!serial || serial < 1) return null;
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400000);
}

function formatDateISO(date) {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function findHeaderRange(sheet, expectedKeys) {
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && Array.isArray(row)) {
      const matchCount = expectedKeys.filter((k) => row.includes(k)).length;
      if (matchCount >= 2) return i;
    }
  }
  return 0;
}

async function seed() {
  const filePath = './Dados da Coffee mais/VisãoHistórica KA (2).xlsb';
  console.log(`Reading file: ${filePath} (this may take a minute due to size)...`);
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  
  if (!workbook.SheetNames.includes('ÚltimasVendas')) {
    console.log("Sheet ÚltimasVendas not found!");
    return;
  }
  
  const sheet = workbook.Sheets['ÚltimasVendas'];
  const expectedKeys = ["Data Faturamento", "Rede_UF", "Produto"];
  const range = findHeaderRange(sheet, expectedKeys);
  
  console.log(`Headers found at row index: ${range}`);
  
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, range });
  console.log(`Rows read: ${jsonData.length}`);
  if (jsonData.length > 0) {
     console.log("First row preview:", JSON.stringify(jsonData[0], null, 2).slice(0, 500));
  }
  
  const batchId = require('crypto').randomUUID();
  console.log(`Creating upload batch: ${batchId}`);
  await supabase.from("upload_batches").insert({
     id: batchId,
     filename: "VisãoHistórica KA (2).xlsb",
     status: "processing"
  });
  
  const rows = [];
  for (const row of jsonData) {
    const rawDate = row["Data Faturamento"];
    if (!rawDate) continue;

    let invoiceDate = null;
    if (rawDate instanceof Date) {
        invoiceDate = formatDateISO(rawDate);
    } else if (typeof rawDate === "number") {
        invoiceDate = formatDateISO(excelDateToDate(rawDate));
    } else if (typeof rawDate === "string" && !rawDate.includes("Total")) {
        invoiceDate = rawDate;
    }

    if (!invoiceDate || isNaN(new Date(invoiceDate).getTime())) continue;

    rows.push({
      invoice_date: invoiceDate,
      invoice_number: row["Nro. Nota"] ? String(row["Nro. Nota"]).replace(/\.0$/, "") : null,
      unique_number: row["Nro. Único"] ? String(row["Nro. Único"]).replace(/\.0$/, "") : null,
      channel: row["Descrição (Natureza)"] ? String(row["Descrição (Natureza)"]) : null,
      seller: row["Vendedor"] ? String(row["Vendedor"]) : null,
      network_uf: row["Rede_UF"] ? String(row["Rede_UF"]) : null,
      uf_destination: row["UF Destino"] ? String(row["UF Destino"]) : null,
      payment_type: row["Tipo Pagamento"] ? String(row["Tipo Pagamento"]) : null,
      product: row["Produto"] ? String(row["Produto"]) : null,
      quantity: typeof row["Qtd."] === "number" ? row["Qtd."] : null,
      net_value:
        typeof row[" Vlr. Total Líq."] === "number"
          ? row[" Vlr. Total Líq."]
          : typeof row["Vlr. Total Líq."] === "number"
            ? row["Vlr. Total Líq."]
            : null,
      freight: typeof row[" Receita Frete"] === "number" ? row[" Receita Frete"] : 0,
      discount: typeof row[" Vlr. Desconto"] === "number" ? row[" Vlr. Desconto"] : 0,
      cpv:
        typeof row["  CPV"] === "number"
          ? row["  CPV"]
          : typeof row["CPV"] === "number"
            ? row["CPV"]
            : null,
      upload_batch_id: batchId,
    });
  }
  
  console.log(`Parsed ${rows.length} valid sales rows. Commencing bulk insert...`);
  
  let successCount = 0;
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("sales").insert(batch);
    if (insertError) {
      console.error(`Insert error at batch ${i}:`, insertError);
    } else {
      successCount += batch.length;
      if (successCount % 5000 === 0) {
         console.log(`Inserted ${successCount} rows...`);
      }
    }
  }
  
  await supabase.from("upload_batches").update({
     status: "completed",
     records_processed: successCount
  }).eq("id", batchId);
  
  console.log(`Successfully seeded ${successCount} sales rows!`);
}
seed().catch(console.error);
