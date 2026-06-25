import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

// Server-side Supabase client with service role for bulk inserts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Map Excel serial date to JS Date
function excelDateToDate(serial: number): Date | null {
  if (!serial || serial < 1) return null;
  // Excel date epoch is Jan 1, 1900
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400000);
}

function formatDateISO(date: Date | null): string | null {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

interface SalesRow {
  invoice_date: string | null;
  invoice_number: string | null;
  unique_number: string | null;
  channel: string | null;
  seller: string | null;
  network_uf: string | null;
  uf_destination: string | null;
  payment_type: string | null;
  product: string | null;
  quantity: number | null;
  net_value: number | null;
  freight: number | null;
  discount: number | null;
  cpv: number | null;
  weight_kg: number | null;
  company: string | null;
  partner: string | null;
  operation_type: string | null;
  upload_batch_id: string;
  // Extended DB columns
  cod_parceiro?: string | null;
  nome_parceiro?: string | null;
  parceiro?: string | null;
  cod_produto?: string | null;
  cfop?: string | null;
  empresa?: string | null;
  vlr_unitario?: number | null;
  vlr_substituicao?: number | null;
  custo_total?: number | null;
  custo_unitario?: number | null;
  vlr_frete?: number | null;
  chave?: string | null;
  ano?: number | null;
  mes?: number | null;
  dia?: number | null;
  ano_mes?: string | null;
}

function findHeaderRange(sheet: XLSX.WorkSheet, expectedKeys: string[]): number {
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && Array.isArray(row)) {
      // Check if at least 2 of the expected keys exist in this row
      const matchCount = expectedKeys.filter((k) => row.includes(k)).length;
      if (matchCount >= 2) return i;
    }
  }
  return 0;
}

function parseUltimasVendas(
  sheet: XLSX.WorkSheet,
  batchId: string
): SalesRow[] {
  const rows: SalesRow[] = [];
  const range = findHeaderRange(sheet, ["Data Faturamento", "Rede_UF", "Produto"]);
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    range
  });

  for (const row of jsonData) {
    // Skip rows without invoice date
    const rawDate = row["Data Faturamento"];
    if (!rawDate) continue;

    const invoiceDate =
      typeof rawDate === "number"
        ? formatDateISO(excelDateToDate(rawDate))
        : typeof rawDate === "string"
          ? rawDate
          : null;

    if (!invoiceDate) continue;

    rows.push({
      invoice_date: invoiceDate,
      invoice_number: row["Nro. Nota"]
        ? String(row["Nro. Nota"]).replace(/\.0$/, "")
        : null,
      unique_number: row["Nro. Único"]
        ? String(row["Nro. Único"]).replace(/\.0$/, "")
        : null,
      channel: row["Descrição (Natureza)"]
        ? String(row["Descrição (Natureza)"])
        : null,
      seller: row["Vendedor"] ? String(row["Vendedor"]) : null,
      network_uf: row["Rede_UF"] ? String(row["Rede_UF"]) : null,
      uf_destination: row["UF Destino"]
        ? String(row["UF Destino"])
        : null,
      payment_type: row["Tipo Pagamento"]
        ? String(row["Tipo Pagamento"])
        : null,
      product: row["Produto"] ? String(row["Produto"]) : null,
      quantity: typeof row["Qtd."] === "number" ? row["Qtd."] : null,
      net_value:
        typeof row[" Vlr. Total Líq."] === "number"
          ? row[" Vlr. Total Líq."]
          : typeof row["Vlr. Total Líq."] === "number"
            ? (row["Vlr. Total Líq."] as number)
            : null,
      freight:
        typeof row[" Receita Frete"] === "number"
          ? row[" Receita Frete"]
          : 0,
      discount:
        typeof row[" Vlr. Desconto"] === "number"
          ? row[" Vlr. Desconto"]
          : 0,
      cpv:
        typeof row["  CPV"] === "number"
          ? row["  CPV"]
          : typeof row["CPV"] === "number"
            ? (row["CPV"] as number)
            : null,
      weight_kg: null, // derived from quantity * product weight
      company: null,
      partner: null,
      operation_type: null,
      upload_batch_id: batchId,
    });
  }

  return rows;
}

function parsePortalVendas(
  sheet: XLSX.WorkSheet,
  batchId: string
): SalesRow[] {
  const rows: SalesRow[] = [];
  const range = findHeaderRange(sheet, ["Dt. do Faturamento", "Nro. Nota", "Nro. Único", "Chave"]);
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    range
  });

  for (const row of jsonData) {
    const rawDate = row["Dt. do Faturamento"];
    if (!rawDate) continue;

    const invoiceDate =
      typeof rawDate === "number"
        ? formatDateISO(excelDateToDate(rawDate))
        : typeof rawDate === "string"
          ? rawDate
          : null;

    if (!invoiceDate) continue;

    rows.push({
      invoice_date: invoiceDate,
      invoice_number: row["Nro. Nota"]
        ? String(row["Nro. Nota"]).replace(/\.0$/, "")
        : null,
      unique_number: row["Nro. Único"]
        ? String(row["Nro. Único"]).replace(/\.0$/, "")
        : row["Chave"]
          ? String(row["Chave"])
          : null,
      channel: row["Descrição (Centro de Resultado)"]
        ? String(row["Descrição (Centro de Resultado)"])
        : row["Descrição (Natureza)"]
          ? String(row["Descrição (Natureza)"])
          : null,
      seller: row["Apelido (Vendedor)"]
        ? String(row["Apelido (Vendedor)"])
        : null,
      network_uf: null,
      uf_destination: null,
      payment_type: row["Descrição (Tipo de Negociação)"]
        ? String(row["Descrição (Tipo de Negociação)"])
        : null,
      product: null,
      quantity: null,
      net_value:
        typeof row["Vlr. Nota"] === "number"
          ? row["Vlr. Nota"]
          : null,
      freight:
        typeof row["Vlr. do Frete"] === "number"
          ? row["Vlr. do Frete"]
          : typeof row["Vlr. Frete Total"] === "number"
            ? (row["Vlr. Frete Total"] as number)
            : 0,
      discount: 0,
      cpv: null,
      weight_kg:
        typeof row["Peso liq. dos Itens"] === "number"
          ? row["Peso liq. dos Itens"]
          : typeof row["Peso"] === "number"
            ? (row["Peso"] as number)
            : null,
      company: row["Nome Fantasia (Empresa)"]
        ? String(row["Nome Fantasia (Empresa)"])
        : null,
      partner: row["Nome Parceiro (Parceiro)"]
        ? String(row["Nome Parceiro (Parceiro)"])
        : null,
      operation_type: row["Descrição (Tipo de Operação)"]
        ? String(row["Descrição (Tipo de Operação)"])
        : null,
      upload_batch_id: batchId,
    });
  }

  return rows;
}

/* ─── Parser: Faturamento Sankhya (novo formato) ─── */
interface FaturamentoRow {
  cod_cfop: string | null;
  cfop_desc: string | null;
  dt_faturamento: string;
  nro_unico: string | null;
  nro_nota: string | null;
  cod_parceiro: string | null;
  nome_parceiro: string | null;
  cod_produto: string | null;
  desc_produto: string | null;
  quantidade: number;
  vlr_unitario: number;
  vlr_desconto: number;
  vlr_total_liq: number;
  cod_top: string | null;
  desc_top: string | null;
  custo_icms: number;
  cod_vendedor: string | null;
  nome_vendedor: string | null;
  controle: string | null;
  custo_total: number;
  cod_natureza: string | null;
  desc_natureza: string | null;
  status_nfe: string | null;
  vlr_frete: number;
  vlr_substituicao: number;
  vlr_total_st: number;
  cod_cr: string | null;
  centro_resultado: string | null;
}

function parseFaturamento(sheet: XLSX.WorkSheet): FaturamentoRow[] {
  const expectedKeys = ["Cód. CFOP", "Dt. Neg", "Produto"];
  const range = findHeaderRange(sheet, expectedKeys);
  
  // Verify headers are indeed present
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const headers = rawData[range];
  if (!headers || !headers.includes("Cód. CFOP") || !headers.includes("Dt. Neg") || !headers.includes("Produto")) {
    return [];
  }

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    range
  });

  const getVal = (row: Record<string, unknown>, headerName: string) => {
    return row[headerName] !== undefined ? row[headerName] : null;
  };

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      if (val.includes(',')) {
        const cleaned = val.replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      } else {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
      }
    }
    return 0;
  };

  const parseRowDate = (rawDate: any): string | null => {
    if (!rawDate) return null;
    if (rawDate instanceof Date) return formatDateISO(rawDate);
    if (typeof rawDate === 'number') return formatDateISO(excelDateToDate(rawDate));
    if (typeof rawDate === 'string') {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) return formatDateISO(d);
    }
    return null;
  };

  const rows: FaturamentoRow[] = [];
  for (const row of jsonData) {
    const dtFaturamento = parseRowDate(getVal(row, 'Dt. Neg'));
    if (!dtFaturamento) continue;

    rows.push({
      cod_cfop: getVal(row, 'Cód. CFOP') ? String(getVal(row, 'Cód. CFOP')) : null,
      cfop_desc: getVal(row, 'CFOP') ? String(getVal(row, 'CFOP')) : null,
      dt_faturamento: dtFaturamento,
      nro_unico: getVal(row, 'Nro. Único') ? String(getVal(row, 'Nro. Único')) : null,
      nro_nota: getVal(row, 'Nro. Nota') ? String(getVal(row, 'Nro. Nota')) : null,
      cod_parceiro: getVal(row, 'Cód. Parceiro') ? String(getVal(row, 'Cód. Parceiro')) : null,
      nome_parceiro: getVal(row, 'Parceiro') ? String(getVal(row, 'Parceiro')) : null,
      cod_produto: getVal(row, 'Cód. Produto') ? String(getVal(row, 'Cód. Produto')) : null,
      desc_produto: getVal(row, 'Produto') ? String(getVal(row, 'Produto')) : null,
      quantidade: parseNumber(getVal(row, 'Qtd.')),
      vlr_unitario: parseNumber(getVal(row, 'Vlr. Unitário')),
      vlr_desconto: parseNumber(getVal(row, 'Vlr. Desconto')),
      vlr_total_liq: parseNumber(getVal(row, 'Vlr. Total Líq.')),
      cod_top: getVal(row, 'Cód. TOP') ? String(getVal(row, 'Cód. TOP')) : null,
      desc_top: getVal(row, 'TOP') ? String(getVal(row, 'TOP')) : null,
      custo_icms: parseNumber(getVal(row, 'Custo s/ ICMS')),
      cod_vendedor: getVal(row, 'Cód. Vendedor') ? String(getVal(row, 'Cód. Vendedor')) : null,
      nome_vendedor: getVal(row, 'Vendedor') ? String(getVal(row, 'Vendedor')) : null,
      controle: getVal(row, 'Controle') ? String(getVal(row, 'Controle')) : null,
      custo_total: parseNumber(getVal(row, 'Custo Total')),
      cod_natureza: getVal(row, 'Cód. Natureza') ? String(getVal(row, 'Cód. Natureza')) : null,
      desc_natureza: getVal(row, 'Natureza') ? String(getVal(row, 'Natureza')) : null,
      status_nfe: getVal(row, 'Status NFe') ? String(getVal(row, 'Status NFe')) : null,
      vlr_frete: parseNumber(getVal(row, 'Vlr. Frete')),
      vlr_substituicao: parseNumber(getVal(row, 'Vlr. Substituição')),
      vlr_total_st: parseNumber(getVal(row, 'Vlr. Total ST')),
      cod_cr: getVal(row, 'Cód. CR') ? String(getVal(row, 'Cód. CR')) : null,
      centro_resultado: getVal(row, 'Centro de Resultado') ? String(getVal(row, 'Centro de Resultado')) : null
    });
  }
  return rows;
}

/* ─── Parser: Itens de Nota (formato padrão) ─── */
function parseItensNota(
  sheet: XLSX.WorkSheet,
  batchId: string
): SalesRow[] {
  const rows: SalesRow[] = [];
  const range = findHeaderRange(sheet, ["Nro. Nota", "Produto", "Qtd.", "Cód. Parceiro"]);
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    range,
  });

  for (const row of jsonData) {
    // Parse date — "Dt. Neg" is an Excel serial date
    const rawDate = row["Dt. Neg"] ?? row["Dt. Neg."];
    if (!rawDate) continue;

    const invoiceDate =
      typeof rawDate === "number"
        ? formatDateISO(excelDateToDate(rawDate))
        : typeof rawDate === "string"
          ? rawDate
          : null;

    if (!invoiceDate) continue;

    // Skip non-sales rows (e.g. cancellations, returns with no product)
    const produto = row["Produto"] ? String(row["Produto"]) : null;
    if (!produto) continue;

    // Parse date parts
    const dateObj = new Date(invoiceDate + "T00:00:00");
    const ano = dateObj.getFullYear();
    const mes = dateObj.getMonth() + 1;
    const dia = dateObj.getDate();

    const invoiceNumber = row["Nro. Nota"]
      ? String(row["Nro. Nota"]).replace(/\.0$/, "")
      : null;
    const uniqueNumber = row["Nro. Único"]
      ? String(row["Nro. Único"]).replace(/\.0$/, "")
      : null;
    const codParceiro = row["Cód. Parceiro"]
      ? String(row["Cód. Parceiro"]).replace(/\.0$/, "")
      : null;
    const codProduto = row["Cód. Produto"]
      ? String(row["Cód. Produto"]).replace(/\.0$/, "")
      : null;
    const qty = typeof row["Qtd."] === "number" ? row["Qtd."] : null;
    const custoTotal = typeof row["Custo Total"] === "number" ? row["Custo Total"] as number : null;

    rows.push({
      invoice_date: invoiceDate,
      invoice_number: invoiceNumber,
      unique_number: uniqueNumber,
      channel: null, // será preenchido via atendimento/pdv_mapping
      seller: null, // não disponível neste relatório
      network_uf: null,
      uf_destination: null,
      payment_type: null,
      product: produto,
      quantity: qty,
      net_value:
        typeof row["Vlr. Total Líq."] === "number"
          ? (row["Vlr. Total Líq."] as number)
          : typeof row[" Vlr. Total Líq."] === "number"
            ? (row[" Vlr. Total Líq."] as number)
            : null,
      freight:
        typeof row["Vlr. Frete"] === "number"
          ? (row["Vlr. Frete"] as number)
          : 0,
      discount:
        typeof row["Vlr. Desconto"] === "number"
          ? (row["Vlr. Desconto"] as number)
          : typeof row[" Vlr. Desconto"] === "number"
            ? (row[" Vlr. Desconto"] as number)
            : 0,
      cpv: custoTotal,
      weight_kg: null,
      company: row["Empresa"] ? String(row["Empresa"]) : null,
      partner: row["Parceiro"] ? String(row["Parceiro"]) : null,
      operation_type: row["TOP"] ? String(row["TOP"]) : null,
      upload_batch_id: batchId,
      // Extended fields
      cod_parceiro: codParceiro,
      nome_parceiro: row["Parceiro"] ? String(row["Parceiro"]) : null,
      parceiro: row["Parceiro"] ? String(row["Parceiro"]) : null,
      cod_produto: codProduto,
      cfop: row["CFOP"] ? String(row["CFOP"]) : null,
      empresa: row["Empresa"] ? String(row["Empresa"]) : null,
      vlr_unitario:
        typeof row["Vlr. Unitário"] === "number"
          ? (row["Vlr. Unitário"] as number)
          : null,
      vlr_substituicao:
        typeof row["Vlr. Substituição"] === "number"
          ? (row["Vlr. Substituição"] as number)
          : typeof row["Vlr. Total ST"] === "number"
            ? (row["Vlr. Total ST"] as number)
            : 0,
      custo_total: custoTotal,
      custo_unitario:
        custoTotal && qty && qty !== 0
          ? custoTotal / qty
          : null,
      vlr_frete:
        typeof row["Vlr. Frete"] === "number"
          ? (row["Vlr. Frete"] as number)
          : 0,
      chave: invoiceNumber && uniqueNumber
        ? `${invoiceNumber}${uniqueNumber}`
        : null,
      ano,
      mes,
      dia,
      ano_mes: `${ano}_${String(mes).padStart(2, "0")}`,
    });
  }

  return rows;
}

export async function POST(request: NextRequest) {
  let batchId = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // 1. Create upload batch record on server (ignores RLS using service role)
    const { data: batch, error: batchError } = await supabase
      .from("upload_batches")
      .insert({
        filename: file.name,
        file_type: file.name.split(".").pop()?.toLowerCase(),
        status: "processing",
      })
      .select()
      .single();

    if (batchError) {
      console.error("Error creating upload batch:", batchError);
      return Response.json({ error: `Erro ao registrar lote de upload: ${batchError.message}` }, { status: 500 });
    }

    batchId = batch.id;

    // Read file buffer
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sheetsDetected: string[] = [];
    let totalRecords = 0;
    let dateMin: string | null = null;
    let dateMax: string | null = null;

    // Process known sheets
    const allSalesRows: SalesRow[] = [];
    const allFaturamentoRows: FaturamentoRow[] = [];
    let isFaturamentoType = false;

    // First try to detect if it's a faturamento upload by checking all sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const fatRows = parseFaturamento(sheet);
      if (fatRows.length > 0) {
        allFaturamentoRows.push(...fatRows);
        sheetsDetected.push(sheetName);
        isFaturamentoType = true;
      }
    }

    let insertedCount = 0;
    let syncedCount = 0;

    if (isFaturamentoType) {
      if (allFaturamentoRows.length > 0) {
        // Find date range
        const dates = allFaturamentoRows.map(r => r.dt_faturamento).sort();
        dateMin = dates[0];
        dateMax = dates[dates.length - 1];

        // Delete existing records in that range
        const { error: deleteErr } = await supabase
          .from('cm_faturamento_sankhya')
          .delete()
          .gte('dt_faturamento', dateMin)
          .lte('dt_faturamento', dateMax);

        if (deleteErr) {
          console.error("Error deleting existing faturamento records:", deleteErr);
          // Update batch status to error
          await supabase
            .from("upload_batches")
            .update({ status: "error", completed_at: new Date().toISOString() })
            .eq("id", batchId);
          return Response.json({ error: `Erro ao limpar faturamento existente: ${deleteErr.message}` }, { status: 500 });
        }

        // Insert in batches of 100 with retry mechanism
        const batchSize = 100;
        for (let i = 0; i < allFaturamentoRows.length; i += batchSize) {
          const batch = allFaturamentoRows.slice(i, i + batchSize);
          
          let success = false;
          let retries = 3;
          let lastError = null;

          while (retries > 0 && !success) {
            try {
              const { error: insertErr } = await supabase
                .from('cm_faturamento_sankhya')
                .insert(batch);

              if (insertErr) {
                lastError = insertErr;
                retries--;
                if (retries > 0) {
                  console.warn(`[process-excel] Faturamento insert error, retrying in 500ms... Retries left: ${retries}`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } else {
                success = true;
              }
            } catch (err) {
              lastError = err;
              retries--;
              if (retries > 0) {
                console.warn(`[process-excel] Faturamento insert fetch failed, retrying in 500ms... Retries left: ${retries}`);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }

          if (!success) {
            const errMsg = lastError instanceof Error ? lastError.message : ((lastError as any)?.message || String(lastError));
            console.error(`Error inserting faturamento batch at ${i}:`, lastError);
            // Update batch status to error
            await supabase
              .from("upload_batches")
              .update({ status: "error", completed_at: new Date().toISOString() })
              .eq("id", batchId);
            return Response.json({ error: `Erro ao inserir faturamento: ${errMsg}` }, { status: 500 });
          }
          insertedCount += batch.length;
        }
        totalRecords = allFaturamentoRows.length;

        // Refresh materialized views
        try {
          console.log("[process-excel] Refreshing materialized views...");
          await supabase.rpc("refresh_materialized_views");
          console.log("[process-excel] Materialized views refreshed successfully");
        } catch (mvErr) {
          console.error("MV refresh error (non-fatal):", mvErr);
        }
      }

      // Update batch status to completed on success
      await supabase
        .from("upload_batches")
        .update({
          records_processed: totalRecords,
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", batchId);

      return Response.json({
        batchId,
        recordsProcessed: totalRecords,
        recordsInserted: insertedCount,
        duplicatesSkipped: 0,
        recordsSynced: 0,
        sheetsDetected,
        sheetsAvailable: workbook.SheetNames,
        period: dateMin && dateMax ? { start: dateMin, end: dateMax } : null,
        isFaturamento: true
      });
    }

    // Normal sales flow
    let usedItensNota = false;

    // If no known sheets... try every sheet with all parsers (ItensNota first)
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      
      // Try ItensNota (standard format with cod_parceiro) first
      const itensRows = parseItensNota(sheet, batchId);
      if (itensRows.length > 0) {
        sheetsDetected.push(sheetName);
        allSalesRows.push(...itensRows);
        usedItensNota = true;
        continue;
      }

      // Try ÚltimasVendas
      const ultimasRows = parseUltimasVendas(sheet, batchId);
      if (ultimasRows.length > 0) {
        sheetsDetected.push(sheetName);
        allSalesRows.push(...ultimasRows);
        continue;
      }

      // Only use PortalVendas if ItensNota didn't produce results (avoids duplicates)
      if (!usedItensNota) {
        const portalRows = parsePortalVendas(sheet, batchId);
        if (portalRows.length > 0) {
          sheetsDetected.push(sheetName);
          allSalesRows.push(...portalRows);
        }
      }
    }

    // Deduplicate rows by invoice_number + invoice_date + product + cod_parceiro
    const deduped = new Map<string, SalesRow>();
    for (const row of allSalesRows) {
      const key = `${row.invoice_number}|${row.invoice_date}|${row.product || ''}|${row.cod_parceiro || ''}`;
      deduped.set(key, row); // last wins
    }
    const uniqueRows = Array.from(deduped.values());
    console.log(`[process-excel] ${allSalesRows.length} rows parsed → ${uniqueRows.length} after dedup`);

    // Insert sales in batches of 100 with retry mechanism
    if (uniqueRows.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < uniqueRows.length; i += batchSize) {
        const batch = uniqueRows.slice(i, i + batchSize);
        
        let success = false;
        let retries = 3;
        let lastError = null;
        let dataResult = null;

        while (retries > 0 && !success) {
          try {
            const { data, error: insertError } = await supabase
              .from("sales_v2")
              .upsert(batch, { onConflict: 'chave', ignoreDuplicates: false })
              .select("id");

            if (insertError) {
              lastError = insertError;
              retries--;
              if (retries > 0) {
                console.warn(`[process-excel] Sales upsert error, retrying in 500ms... Retries left: ${retries}`);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } else {
              success = true;
              dataResult = data;
            }
          } catch (err) {
            lastError = err;
            retries--;
            if (retries > 0) {
              console.warn(`[process-excel] Sales upsert fetch failed, retrying in 500ms... Retries left: ${retries}`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (success) {
          insertedCount += dataResult?.length ?? 0;
        } else {
          console.error(`Insert error at batch ${i}:`, lastError);
          // Continue with next batch (non-fatal for total execution in sales flow as original code)
        }
      }
      totalRecords = uniqueRows.length;

      // Get date range
      const dates = allSalesRows
        .map((r) => r.invoice_date)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        dateMin = dates[0];
        dateMax = dates[dates.length - 1];
      }

      // Auto-sync: assign manager/channel via pdv_mapping
      try {
        const { data: syncResult } = await supabase.rpc("sync_batch_sales", {
          p_batch_id: batchId,
        });
        syncedCount = syncResult ?? 0;
      } catch (syncErr) {
        console.error("Sync error (non-fatal):", syncErr);
      }

      // Refresh materialized views for dashboard performance
      try {
        console.log("[process-excel] Refreshing materialized views...");
        await supabase.rpc("refresh_materialized_views");
        console.log("[process-excel] Materialized views refreshed successfully");
      } catch (mvErr) {
        console.error("MV refresh error (non-fatal):", mvErr);
      }
    }

    // Update batch status to completed on success
    await supabase
      .from("upload_batches")
      .update({
        records_processed: totalRecords,
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    return Response.json({
      batchId,
      recordsProcessed: totalRecords,
      recordsInserted: insertedCount,
      duplicatesSkipped: totalRecords - insertedCount,
      recordsSynced: syncedCount,
      sheetsDetected,
      sheetsAvailable: workbook.SheetNames,
      period: dateMin && dateMax ? { start: dateMin, end: dateMax } : null,
    });
  } catch (err) {
    console.error("Process Excel error:", err);
    if (batchId) {
      try {
        await supabase
          .from("upload_batches")
          .update({
            status: "error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", batchId);
      } catch (dbErr) {
        console.error("Failed to update batch error status:", dbErr);
      }
    }
    const message = err instanceof Error ? err.message : "Erro no processamento";
    return Response.json({ error: message }, { status: 500 });
  }
}
