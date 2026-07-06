/**
 * Conversão de datas decodificadas do serial numérico do Excel para string ISO (YYYY-MM-DD) em UTC.
 */
export function excelSerialToDate(serial: number): string | null {
  try {
    if (isNaN(serial) || serial < 1) return null;
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const y = date_info.getUTCFullYear();
    const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date_info.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch (e) {
    return null;
  }
}

/**
 * Normaliza e parseia valores de data (seja string ou objeto Date nativo) para string ISO (YYYY-MM-DD) em UTC.
 */
export function parseDateString(dateStr: any): string | null {
  if (!dateStr) return null;
  
  if (dateStr instanceof Date) {
    const y = dateStr.getUTCFullYear();
    const m = String(dateStr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  const str = String(dateStr).trim();
  const parts = str.split("/");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (year.length === 4 && !isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
      return `${year}-${month}-${day}`;
    }
  }
  
  const yyyyMmDd = str.split("-");
  if (yyyyMmDd.length === 3 && yyyyMmDd[0].length === 4) {
    return str;
  }
  
  return null;
}

/**
 * Normaliza o código de matriz removendo espaços em branco e o sufixo decimal ".0" se existir.
 */
export function cleanMatrixCode(code: any): string {
  if (code === undefined || code === null) return "";
  return String(code).trim().replace(/\.0$/, "");
}

/**
 * Converte strings monetárias ou numéricas com notação brasileira do Excel para número float válido.
 */
export function parseExcelNum(val: any): number | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") return val;
  const clean = String(val).replace(/[R$\s\.]/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}
