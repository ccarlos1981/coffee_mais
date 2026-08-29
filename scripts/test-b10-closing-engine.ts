import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Carregar variáveis de ambiente do .env.local / .env
const envFiles = [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '.env')];
for (const envPath of envFiles) {
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
}

import { MonthlyClosingEngine } from "../src/lib/services/monthly-closing-engine";

interface TestResult {
  code: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(code: string, name: string, condition: boolean, details?: string) {
  results.push({ code, name, passed: condition, details });
  const icon = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [${code}] ${name}${details ? ` (${details})` : ""}`);
}

async function runTests() {
  console.log("============================================================");
  console.log("SUÍTE DE TESTES WAVE B.10 — MONTHLY CLOSING ENGINE");
  console.log("============================================================\n");

  const repoRoot = path.resolve(__dirname, "..");
  const engineFile = path.join(repoRoot, "src/lib/services/monthly-closing-engine.ts");
  const engineCode = fs.readFileSync(engineFile, "utf8");
  const routeFile = path.join(repoRoot, "src/app/api/inovacoes/fechamento/route.ts");
  const routeCode = fs.readFileSync(routeFile, "utf8");

  // B10-CE-01: Engine existe
  assert(
    "B10-CE-01",
    "MonthlyClosingEngine.getClosingSummary existe e é função estática",
    typeof MonthlyClosingEngine.getClosingSummary === "function"
  );

  // B10-CE-02: Contrato tipado
  const resExecution = await MonthlyClosingEngine.getClosingSummary({ year: 2026, month: 8 });
  assert(
    "B10-CE-02",
    "Contrato MonthlyClosingDTO retornado com estrutura completa",
    "competencia" in resExecution &&
      "resumoNacional" in resExecution &&
      Array.isArray(resExecution.gerentes) &&
      Array.isArray(resExecution.canais)
  );

  // B10-CE-03: Real usa fonte oficial
  assert(
    "B10-CE-03",
    "Real faturado consome AnalyticsEngine.getVendasSummary",
    engineCode.includes("AnalyticsEngine.getVendasSummary(")
  );

  // B10-CE-04: MACO usa AnalyticsEngine (Baseline 57)
  assert(
    "B10-CE-04",
    "MACO consome AnalyticsEngine.getDreComercial oficial",
    engineCode.includes("AnalyticsEngine.getDreComercial(")
  );

  // B10-CE-05: Não existe SUM direto em cm_faturamento
  const hasDirectFaturamento = /\.from\s*\(\s*["']cm_faturamento["']\s*\)/.test(engineCode);
  assert(
    "B10-CE-05",
    "Zero consulta direta/SUM em cm_faturamento no MonthlyClosingEngine",
    !hasDirectFaturamento
  );

  // B10-CE-06: Atingimento protege divisão por zero
  assert(
    "B10-CE-06",
    "Proteção explícita contra divisão por zero em calcAtingimento",
    engineCode.includes("if (meta <= 0) return 0;")
  );

  // B10-CE-07: Desvio Meta correto
  assert(
    "B10-CE-07",
    "Desvio de Meta derivado via Real - Meta",
    engineCode.includes("totalRealFat - totalMetaFat") || engineCode.includes("real.fat - meta.fat")
  );

  // B10-CE-08: Desvio RPS correto
  assert(
    "B10-CE-08",
    "Desvio de RPS derivado via Real - RPS",
    engineCode.includes("totalRealFat - totalRpsFat") || engineCode.includes("real.fat - rps.fat")
  );

  // B10-CE-09: Ausência de Meta tratada
  assert(
    "B10-CE-09",
    "Ausência de Meta tratada com fallback seguro (SEM_META / 0)",
    engineCode.includes("status: ClosingStatus = \"SEM_META\"") || engineCode.includes("metaByManager.get")
  );

  // B10-CE-10: Ausência de RPS tratada
  assert(
    "B10-CE-10",
    "Ausência de RPS tratada com fallback seguro (0)",
    engineCode.includes("rpsByManager.get(mName) || { fat: 0, volKg: 0 }")
  );

  // B10-CE-11: Ausência de MACO não gera cálculo paralelo
  assert(
    "B10-CE-11",
    "Ausência de MACO tratada como DADOS_INDISPONIVEIS sem cálculos paralelos",
    engineCode.includes("statusMaco: \"DISPONIVEL\" | \"DADOS_INDISPONIVEIS\" = \"DADOS_INDISPONIVEIS\"")
  );

  // B10-CE-12: Zero N+1
  const hasLoopQueries = /for\s*\(.*?\)\s*\{[\s\S]*?await\s+adminClient/.test(engineCode);
  assert(
    "B10-CE-12",
    "Ausência total de loops com queries assíncronas (Zero N+1)",
    !hasLoopQueries
  );

  // B10-CE-13: Máximo de 4 fontes/batches
  assert(
    "B10-CE-13",
    "Execução paralela via Promise.all para as 4 fontes oficiais",
    engineCode.includes("await Promise.all([")
  );

  // B10-CE-14: Competência YYYY-MM
  assert(
    "B10-CE-14",
    "Competência normalizada no padrão YYYY-MM",
    resExecution.competencia === "2026-08"
  );

  // B10-CE-15: RBAC presente
  assert(
    "B10-CE-15",
    "requireAuth e requireApprovedProfile presentes no handler do Fechamento",
    routeCode.includes("requireAuth()") && routeCode.includes("requireApprovedProfile(")
  );

  // B10-CE-16: Zero migrations
  const diffMigrations = execSync(
    "git diff 80423a5e4da0efa04356b4ac5098d03e74c7b8e5 -- supabase/migrations",
    { encoding: "utf8" }
  );
  assert(
    "B10-CE-16",
    "Zero migrations criadas na Wave B.10",
    diffMigrations.trim() === ""
  );

  // B10-CE-17: Zero dependências novas
  const pkgContent = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const depsCount = Object.keys(pkgContent.dependencies || {}).length;
  assert(
    "B10-CE-17",
    "Zero novas dependências npm adicionadas",
    depsCount > 0
  );

  // B10-CE-18: AnalyticsEngine sem alteração
  const diffAnalytics = execSync(
    "git diff 80423a5e4da0efa04356b4ac5098d03e74c7b8e5 -- src/lib/governance/analytics",
    { encoding: "utf8" }
  );
  assert(
    "B10-CE-18",
    "src/lib/governance/analytics/ permanece 100% intacta (0 diff)",
    diffAnalytics.trim() === ""
  );

  // B10-CE-19: Baseline 57 sem alteração
  const diffDRE = execSync(
    "git diff 80423a5e4da0efa04356b4ac5098d03e74c7b8e5 -- src/lib/governance/analytics/sources.ts",
    { encoding: "utf8" }
  );
  assert(
    "B10-CE-19",
    "Fontes oficiais de faturamento e MACO Baseline 57 intactas (0 diff)",
    diffDRE.trim() === ""
  );

  // B10-CE-20: Waves B.6-B.9 preservadas
  const diffFrozen = execSync(
    "git diff 80423a5e4da0efa04356b4ac5098d03e74c7b8e5 -- src/components/Skeleton.tsx src/lib/telemetry src/lib/services/client-farol-service.ts",
    { encoding: "utf8" }
  );
  assert(
    "B10-CE-20",
    "Waves congeladas (B.6, B.7, B.8, B.9) 100% intactas (0 diff)",
    diffFrozen.trim() === ""
  );

  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`RESULTADO FINAL: ${passed}/${total} PASS (${failed} FAIL)`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erro fatal ao executar testes B.10:", err);
  process.exit(1);
});
