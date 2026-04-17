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
        "Cód. Parceiro", "Cod. Parceiro", "Código", "Codigo",
        "cod_parceiro", "CodParceiro", "ID", "Cód. Parceiro (Parceiro)", "Cod. Parceiro (Parceiro)",
        "Código do Parceiro", "Codigo do Parceiro", "Cod. de Parceiro"
      );
      if (!codParceiro) continue;

      const nome = findCol(
        row,
        "Nome Parceiro", "Parceiro", "Nome", "Cliente",
        "nome_parceiro", "NomeParceiro", "Nome Parceiro (Parceiro)",
        "Razão Social", "Razao Social", "Nome Fantasia"
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
        "Rede", "Matriz", "rede", "Grupo", "Rede (Parceiro)"
      );

      records.push({
        cod_parceiro: String(codParceiro).replace(/\.0$/, ""),
        nome_parceiro: String(nome),
        rede: rede ? String(rede) : "",
        uf: uf ? String(uf).toUpperCase().trim() : "",
        canal: canal ? String(canal) : "VAREJO F OUT",
        manager: gerente ? String(gerente) : "Sem Gerente",
      });
    }

    if (records.length === 0) {
      return Response.json(
        { error: "Nenhum registro válido encontrado. Verifique se o Excel tem colunas como: Cód. Parceiro, Nome, Gerente, Canal, UF" },
        { status: 400 }
      );
    }

    // Upsert in batches of 500
    let upserted = 0;
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      const { error } = await supabase
        .from("pdv_mapping")
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
