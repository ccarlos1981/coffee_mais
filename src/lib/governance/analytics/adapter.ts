/**
 * Adaptador Oficial de Payloads Analíticos — Analytics Engine V1
 * 
 * Centraliza a normalização de contratos de API (suportando simultaneamente
 * o contrato novo com `json.current` e o contrato legado de raiz).
 * 
 * Nenhuma página analítica deve desestruturar propriedades brutas diretamente do JSON da API.
 * 
 * @see Regra de Governança Financeira (Seção 10 e Seção 14)
 */

export interface NormalizedAnalyticsPayload<TManager = any, TFamilia = any, TMonth = any, TMatriz = any, TChannel = any, TSku = any> {
  success: boolean;
  byManager: TManager[];
  byFamilia: TFamilia[];
  byMonth: TMonth[];
  byMatriz: TMatriz[];
  matrizes: TMatriz[];
  byCanal: TChannel[];
  channels: TChannel[];
  bySku: TSku[];
  families: any[];
  matrizFamilies: any[];
  totals: Record<string, any>;
  summary: Record<string, any>;
  previousMonth: Record<string, any>;
  prevMonth: Record<string, any>;
  previousYear: Record<string, any>;
  prevYear: Record<string, any>;
  raw: any;
}

/**
 * Normaliza qualquer resposta de API analítica para um contrato uniforme e retrocompatível.
 */
export function normalizeAnalyticsPayload<TManager = any, TFamilia = any, TMonth = any, TMatriz = any, TChannel = any, TSku = any>(
  json: any
): NormalizedAnalyticsPayload<TManager, TFamilia, TMonth, TMatriz, TChannel, TSku> {
  if (!json || typeof json !== "object") {
    return {
      success: false,
      byManager: [],
      byFamilia: [],
      byMonth: [],
      byMatriz: [],
      matrizes: [],
      byCanal: [],
      channels: [],
      bySku: [],
      families: [],
      matrizFamilies: [],
      totals: {},
      summary: {},
      previousMonth: {},
      prevMonth: {},
      previousYear: {},
      prevYear: {},
      raw: json,
    };
  }

  // Normalização de Nível de Agregação / Contrato (Novo em json.current vs Legado na Raiz)
  const current = json.current && typeof json.current === "object" ? json.current : json;

  const byManager = current.byManager ?? json.byManager ?? [];
  const byFamilia = current.byFamilia ?? json.byFamilia ?? [];
  const byMonth = current.byMonth ?? json.byMonth ?? current.byMes ?? json.byMes ?? [];

  const matrizes = current.matrizes ?? json.matrizes ?? current.byMatriz ?? json.byMatriz ?? current.byRede ?? json.byRede ?? [];
  const byMatriz = matrizes;

  const channels = current.channels ?? json.channels ?? current.byCanal ?? json.byCanal ?? current.byChannel ?? json.byChannel ?? [];
  const byCanal = channels;

  const bySku = current.bySku ?? json.bySku ?? current.topSkus ?? json.topSkus ?? current.topProducts ?? json.topProducts ?? [];
  const families = current.families ?? json.families ?? [];
  const matrizFamilies = current.matrizFamilies ?? json.matrizFamilies ?? [];

  const totals = current.totals ?? json.totals ?? current.summary ?? json.summary ?? {};
  const summary = totals;

  const previousMonth = json.prevMonth ?? json.previousMonth ?? current.prevMonth ?? current.previousMonth ?? {};
  const prevMonth = previousMonth;

  const previousYear = json.prevYear ?? json.previousYear ?? current.prevYear ?? current.previousYear ?? {};
  const prevYear = previousYear;

  return {
    success: Boolean(json.success ?? true),
    byManager: Array.isArray(byManager) ? byManager : [],
    byFamilia: Array.isArray(byFamilia) ? byFamilia : [],
    byMonth: Array.isArray(byMonth) ? byMonth : [],
    byMatriz: Array.isArray(byMatriz) ? byMatriz : [],
    matrizes: Array.isArray(matrizes) ? matrizes : [],
    byCanal: Array.isArray(byCanal) ? byCanal : [],
    channels: Array.isArray(channels) ? channels : [],
    bySku: Array.isArray(bySku) ? bySku : [],
    families: Array.isArray(families) ? families : [],
    matrizFamilies: Array.isArray(matrizFamilies) ? matrizFamilies : [],
    totals: totals && typeof totals === "object" ? totals : {},
    summary: summary && typeof summary === "object" ? summary : {},
    previousMonth: previousMonth && typeof previousMonth === "object" ? previousMonth : {},
    prevMonth: prevMonth && typeof prevMonth === "object" ? prevMonth : {},
    previousYear: previousYear && typeof previousYear === "object" ? previousYear : {},
    prevYear: prevYear && typeof prevYear === "object" ? prevYear : {},
    raw: json,
  };
}
