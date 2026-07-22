import * as XLSX from "xlsx";
import * as path from "path";

function parseExcelDate(raw: any): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const yyyy = parsed.y;
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const str = String(raw).trim();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) y = "20" + y;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  } else if (str.includes("-")) {
    return str.substring(0, 10);
  }
  return null;
}

function parseNumber(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  let str = String(val).trim().replace("R$", "").trim();
  if (str.includes(",") && str.includes(".")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

async function auditRealExcel() {
  const filePath = path.resolve("/Users/cristiano/Downloads/CFOP_01 a 21jul.xlsx");
  console.log(`=== AUDITORIA DIRETA DO ARQUIVO REAL EXCEL: ${filePath} ===\n`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawRows.length); i++) {
    const r = rawRows[i];
    if (Array.isArray(r) && r.some(cell => String(cell).trim() === "Dt. Neg" || String(cell).trim() === "Cód. CFOP")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error("❌ Não foi possível encontrar a linha de cabeçalho com 'Dt. Neg'.");
    return;
  }

  const headers = rawRows[headerRowIndex].map(h => String(h || "").trim());

  const dtNegIdx = headers.findIndex(h => h === "Dt. Neg");
  const cfopIdx = headers.findIndex(h => h === "Cód. CFOP");
  const liqIdx = headers.findIndex(h => h === "Vlr. Total Líq.");
  const brutoIdx = headers.findIndex(h => h === "Vlr. Bruto");
  const devIdx = headers.findIndex(h => h === "Vlr. Devolução");

  console.log(`Linha de cabeçalho no índice ${headerRowIndex}.`);
  console.log(`Índices -> Dt.Neg: ${dtNegIdx}, Cód.CFOP: ${cfopIdx}, Líquido: ${liqIdx}, Bruto: ${brutoIdx}, Devolução: ${devIdx}`);

  const dailyMap: Record<string, { count: number; bruto: number; dev: number; liquido: number }> = {};

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const rawDate = dtNegIdx !== -1 ? row[dtNegIdx] : null;
    const parsedDate = parseExcelDate(rawDate);
    if (!parsedDate) continue;

    const netVal = liqIdx !== -1 ? parseNumber(row[liqIdx]) : 0;
    const brutoVal = brutoIdx !== -1 ? parseNumber(row[brutoIdx]) : netVal;
    const devVal = devIdx !== -1 ? parseNumber(row[devIdx]) : 0;

    if (!dailyMap[parsedDate]) {
      dailyMap[parsedDate] = { count: 0, bruto: 0, dev: 0, liquido: 0 };
    }

    dailyMap[parsedDate].count += 1;
    dailyMap[parsedDate].bruto += brutoVal;
    dailyMap[parsedDate].dev += devVal;
    dailyMap[parsedDate].liquido += netVal;
  }

  const sortedDates = Object.keys(dailyMap).sort();
  console.log("\n--- DISTRIBUIÇÃO DIÁRIA REAL NO ARQUIVO EXCEL ORIGEM (/Users/cristiano/Downloads/CFOP_01 a 21jul.xlsx) ---");
  console.log("Data         | Linhas | Faturamento Bruto (R$) | Devoluções (R$) | Faturamento Líquido (R$)");
  console.log("-------------+--------+------------------------+-----------------+-------------------------");

  let totalCount = 0;
  let totalBruto = 0;
  let totalDev = 0;
  let totalLiquido = 0;

  for (const d of sortedDates) {
    const item = dailyMap[d];
    totalCount += item.count;
    totalBruto += item.bruto;
    totalDev += item.dev;
    totalLiquido += item.liquido;

    console.log(
      `${d}   | ${String(item.count).padStart(6)} | ${item.bruto.toFixed(2).padStart(22)} | ${item.dev.toFixed(2).padStart(15)} | ${item.liquido.toFixed(2).padStart(24)}`
    );
  }

  console.log("-------------+--------+------------------------+-----------------+-------------------------");
  console.log(
    `TOTAL        | ${String(totalCount).padStart(6)} | ${totalBruto.toFixed(2).padStart(22)} | ${totalDev.toFixed(2).padStart(15)} | ${totalLiquido.toFixed(2).padStart(24)}`
  );
}

auditRealExcel();
