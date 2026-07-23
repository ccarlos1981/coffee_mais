import * as fs from 'fs';
import * as path from 'path';

// Carregar .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { AnalyticsEngine, parseAnalyticsFiltersFromParams, resolveOfficialSource } from '@/lib/governance/analytics';

interface ApiAuditResult {
  methodName: string;
  sourceUsed: string;
  rowCount: number;
  durationMs: number;
  status: 'OK' | 'ERROR';
  errorMessage?: string;
  sampleValue?: string;
}

async function runFullAnalyticsHomologation() {
  console.log("====================================================");
  console.log("🚀 HOMOLOGAÇÃO FINAL DA ANALYTICS ENGINE V1");
  console.log("====================================================\n");

  const results: ApiAuditResult[] = [];

  const defaultFilters = parseAnalyticsFiltersFromParams(new URLSearchParams("startMonth=2026-01&endMonth=2026-07"));

  // 1. getVendasSummary
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getVendasSummary(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getVendasSummary()",
      sourceUsed: source,
      rowCount: res?.rowsCur?.length || 0,
      durationMs: ms,
      status: "OK",
      sampleValue: `Linhas Período Atual: ${res?.rowsCur?.length || 0}`
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getVendasSummary()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 2. getHistoryData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getHistoryData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getHistoryData()",
      sourceUsed: source,
      rowCount: Array.isArray(res) ? res.length : 0,
      durationMs: ms,
      status: "OK",
      sampleValue: Array.isArray(res) ? `${res.length} meses históricos retornados` : "N/A"
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getHistoryData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 3. getHistoryMatrizData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getHistoryMatrizData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getHistoryMatrizData()",
      sourceUsed: source,
      rowCount: Array.isArray(res) ? res.length : 0,
      durationMs: ms,
      status: "OK",
      sampleValue: Array.isArray(res) ? `${res.length} registros mes_num/ano` : "N/A"
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getHistoryMatrizData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 4. getHistoryMatrizComparisonData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getHistoryMatrizComparisonData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getHistoryMatrizComparisonData()",
      sourceUsed: source,
      rowCount: res?.rows?.length || 0,
      durationMs: ms,
      status: "OK",
      sampleValue: `Modo: ${res.mode}, Linhas: ${res.rows?.length || 0}`
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getHistoryMatrizComparisonData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 5. getPositivacaoData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getPositivacaoData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({ hasClientOutput: true });
    results.push({
      methodName: "AnalyticsEngine.getPositivacaoData()",
      sourceUsed: source,
      rowCount: res?.byMonth?.length || 0,
      durationMs: ms,
      status: "OK",
      sampleValue: `Totais e Meses: ${res?.byMonth?.length || 0}`
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getPositivacaoData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 6. getPositivacaoDetailData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getPositivacaoDetailData(defaultFilters, "Leandro Saffi", "client", 50, 0, 1);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({ hasClientOutput: true });
    results.push({
      methodName: "AnalyticsEngine.getPositivacaoDetailData()",
      sourceUsed: source,
      rowCount: res?.data?.length || 0,
      durationMs: ms,
      status: "OK",
      sampleValue: `${res?.total || 0} clientes encontrados no total`
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getPositivacaoDetailData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 7. getSkuPdvData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getSkuPdvData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({ hasProductFilter: true });
    results.push({
      methodName: "AnalyticsEngine.getSkuPdvData()",
      sourceUsed: source,
      rowCount: res?.bySku?.length || 0,
      durationMs: ms,
      status: "OK",
      sampleValue: `By SKU: ${res?.bySku?.length || 0}`
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getSkuPdvData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 8. getSkuPdvDetailData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getSkuPdvDetailData(defaultFilters, "CAPSULA", "sku", 50, 0, 1);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({ hasProductFilter: true });
    results.push({
      methodName: "AnalyticsEngine.getSkuPdvDetailData()",
      sourceUsed: source,
      rowCount: res?.data?.length || 0,
      durationMs: ms,
      status: "OK",
      sampleValue: `${res?.total || 0} registros SKU/PDV`
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getSkuPdvDetailData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 9. getPrecoMatrizData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getPrecoMatrizData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getPrecoMatrizData()",
      sourceUsed: source,
      rowCount: Array.isArray(res) ? res.length : 0,
      durationMs: ms,
      status: "OK",
      sampleValue: Array.isArray(res) ? `${res.length} redes R$/Kg` : "N/A"
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getPrecoMatrizData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 10. getMetaCiaData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getMetaCiaData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getMetaCiaData()",
      sourceUsed: source,
      rowCount: Array.isArray(res) ? res.length : 0,
      durationMs: ms,
      status: "OK",
      sampleValue: Array.isArray(res) ? `${res.length} metas de unidades` : "N/A"
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getMetaCiaData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 11. getSparklineData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getSparklineData(defaultFilters);
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getSparklineData()",
      sourceUsed: source,
      rowCount: Array.isArray(res) ? res.length : 0,
      durationMs: ms,
      status: "OK",
      sampleValue: Array.isArray(res) ? `${res.length} pontos de curva` : "N/A"
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getSparklineData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  // 12. getGlobalFilterData
  try {
    const start = Date.now();
    const res = await AnalyticsEngine.getGlobalFilterData();
    const ms = Date.now() - start;
    const source = resolveOfficialSource({});
    results.push({
      methodName: "AnalyticsEngine.getGlobalFilterData()",
      sourceUsed: source,
      rowCount: Object.keys(res).length,
      durationMs: ms,
      status: "OK",
      sampleValue: `Managers: ${res.managers.length}, Redes: ${res.redes.length}, UFs: ${res.ufs.length}`
    });
  } catch (e: any) {
    results.push({ methodName: "AnalyticsEngine.getGlobalFilterData()", sourceUsed: "N/A", rowCount: 0, durationMs: 0, status: "ERROR", errorMessage: e.message });
  }

  console.log("----------------------------------------------------");
  console.log("TABELA RESUMO DE AUDITORIA DAS APIS / MÉTODOS:");
  console.log("----------------------------------------------------");
  console.table(results.map(r => ({
    "Método AnalyticsEngine": r.methodName,
    "Fonte Oficial": r.sourceUsed,
    "Status": r.status,
    "Tempo (ms)": `${r.durationMs} ms`,
    "Linhas": r.rowCount,
    "Amostra / Detalhe": r.sampleValue || ""
  })));

  const errorCount = results.filter(r => r.status === 'ERROR').length;
  if (errorCount === 0) {
    console.log("\n✅ TODAS AS 12 CONSULTAS DA ANALYTICS ENGINE FORAM APONTADAS E HOMOLOGADAS COM SUCESSO!");
  } else {
    console.error(`\n❌ ${errorCount} consulta(s) apresentaram erros.`);
  }
}

runFullAnalyticsHomologation();
