import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Flexible column name matching
function findCol(row: Record<string, unknown>, ...candidates: string[]): unknown {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null) return row[c];
    // Try case-insensitive
    const key = Object.keys(row).find(
      (k) => k.toLowerCase().trim() === c.toLowerCase().trim()
    );
    if (key && row[key] !== undefined && row[key] !== null) return row[key];
  }
  return null;
}

function findHeaderRange(sheet: XLSX.WorkSheet, expectedKeys: string[]): number {
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || "").toLowerCase());
      const matchCount = expectedKeys.filter((k) =>
        rowStr.some((r) => r.includes(k.toLowerCase()))
      ).length;
      if (matchCount >= 2) return i;
    }
  }
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    // Try first sheet
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = findHeaderRange(sheet, ["parceiro", "gerente", "canal", "cód", "cod", "nome", "razão", "razao", "cliente", "vendedor"]);
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      range,
    });

    // DEBUG: Log column names and first rows to diagnose import issues
    console.log("[IMPORT DEBUG] Sheet name:", workbook.SheetNames[0]);
    console.log("[IMPORT DEBUG] Header range found at row:", range);
    console.log("[IMPORT DEBUG] Total rows parsed:", jsonData.length);
    if (jsonData.length > 0) {
      console.log("[IMPORT DEBUG] Column names:", Object.keys(jsonData[0]));
      console.log("[IMPORT DEBUG] First row sample:", JSON.stringify(jsonData[0]));
      if (jsonData.length > 1) {
        console.log("[IMPORT DEBUG] Second row sample:", JSON.stringify(jsonData[1]));
      }
    }

    const records: {
      cod_parceiro: string;
      nome_parceiro: string;
      rede: string;
      uf: string;
      canal: string;
      manager: string;
    }[] = [];

    for (const row of jsonData) {
      const codParceiro = findCol(
        row,
        "Cód Parceiro", "Cód. Parceiro", "Cod Parceiro", "Cod. Parceiro",
        "Código", "Codigo", "cod_parceiro", "CodParceiro", "ID",
        "Cód. Parceiro (Parceiro)", "Cod. Parceiro (Parceiro)",
        "Código do Parceiro", "Codigo do Parceiro", "Cod. de Parceiro"
      );
      if (!codParceiro) continue;

      const nome = findCol(
        row,
        "Nome / Razão", "Nome Parceiro", "Parceiro", "Nome", "Cliente",
        "nome_parceiro", "NomeParceiro", "Nome Parceiro (Parceiro)",
        "Razão Social", "Razao Social", "Nome Fantasia", "Nome / Razao"
      );
      if (!nome) continue;

      const gerente = findCol(
        row,
        "Gerente", "Manager", "Responsável", "Responsavel",
        "manager", "Time", "Vendedor", "Vendedor (Parceiro)"
      );

      const canal = findCol(
        row,
        "Canal", "Channel", "canal", "Tipo Canal", "Canal (Parceiro)"
      );

      const uf = findCol(
        row,
        "UF", "Estado", "uf", "UF Destino", "UF (Parceiro)"
      );

      const rede = findCol(
        row,
        "Matriz (rede)", "Matriz (Rede)", "Rede", "Matriz", "rede", "Grupo", "Rede (Parceiro)"
      );

      records.push({
        cod_parceiro: String(codParceiro).replace(/\.0$/, ""),
        nome_parceiro: String(nome),
        rede: rede ? String(rede) : "",
        uf: uf ? String(uf).toUpperCase().trim() : "",
        canal: canal ? String(canal) : "VAREJO F OUT",
        manager: gerente ? String(gerente) : "Inside Sales",
      });
    }

    if (records.length === 0) {
      return Response.json(
        { error: "Nenhum registro válido encontrado. Verifique se o Excel tem colunas como: Cód. Parceiro, Nome, Gerente, Canal, UF" },
        { status: 400 }
      );
    }

    // Deduplicate by cod_parceiro (keep last occurrence)
    const deduped = new Map<string, typeof records[0]>();
    for (const r of records) {
      deduped.set(r.cod_parceiro, r);
    }
    const uniqueRecords = Array.from(deduped.values());
    console.log(`[IMPORT] ${records.length} rows parsed, ${uniqueRecords.length} unique after dedup`);

    // Upsert in batches of 500
    let upserted = 0;
    for (let i = 0; i < uniqueRecords.length; i += 500) {
      const batch = uniqueRecords.slice(i, i + 500);
      const { error } = await supabase
        .from("base_atendimento")
        .upsert(batch, { onConflict: "cod_parceiro" });

      if (error) {
        console.error(`Upsert error at batch ${i}:`, error);
      } else {
        upserted += batch.length;
      }
    }

    return Response.json({
      success: true,
      message: `${upserted} clientes importados/atualizados com sucesso.`,
      totalProcessed: records.length,
      totalUpserted: upserted,
    });
  } catch (err) {
    console.error("Import clientes error:", err);
    const message = err instanceof Error ? err.message : "Erro no processamento";
    return Response.json({ error: message }, { status: 500 });
  }
}
