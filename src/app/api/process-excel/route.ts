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
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const batchId = formData.get("batch_id") as string;

    if (!file) {
      return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sheetsDetected: string[] = [];
    let totalRecords = 0;
    let dateMin: string | null = null;
    let dateMax: string | null = null;

    // Process known sheets
    const allSalesRows: SalesRow[] = [];
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

    // Insert sales in batches of 500
    let insertedCount = 0;
    let syncedCount = 0;
    if (uniqueRows.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < uniqueRows.length; i += batchSize) {
        const batch = uniqueRows.slice(i, i + batchSize);
        const { data, error: insertError } = await supabase
          .from("sales_v2")
          .upsert(batch, { onConflict: 'chave', ignoreDuplicates: false })
          .select("id");

        if (insertError) {
          console.error(`Insert error at batch ${i}:`, insertError);
          // Continue with next batch
        } else {
          insertedCount += data?.length ?? 0;
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
    }

    return Response.json({
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
    const message = err instanceof Error ? err.message : "Erro no processamento";
    return Response.json({ error: message }, { status: 500 });
  }
}
