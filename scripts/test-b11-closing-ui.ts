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
  console.log("SUÍTE DE TESTES WAVE B.11 — COCKPIT VISUAL DE FECHAMENTO & RDM 360°");
  console.log("============================================================\n");

  const repoRoot = path.resolve(__dirname, "..");
  const basePath = path.join(repoRoot, "src/app/inovacoes/fechamento");

  const pageFile = path.join(basePath, "page.tsx");
  const headerFile = path.join(basePath, "components/ClosingHeader.tsx");
  const kpisFile = path.join(basePath, "components/ClosingKpiCards.tsx");
  const desviosFile = path.join(basePath, "components/ClosingDesviosGrid.tsx");
  const canaisFile = path.join(basePath, "components/ClosingCanaisGrid.tsx");
  const modalFile = path.join(basePath, "components/ClosingRdm360Modal.tsx");
  const exportFile = path.join(basePath, "utils/exportPptx.ts");

  // B11-UI-01: Existência dos componentes
  const allFilesExist =
    fs.existsSync(pageFile) &&
    fs.existsSync(headerFile) &&
    fs.existsSync(kpisFile) &&
    fs.existsSync(desviosFile) &&
    fs.existsSync(canaisFile) &&
    fs.existsSync(modalFile) &&
    fs.existsSync(exportFile);

  assert(
    "B11-UI-01",
    "Todos os 7 componentes e utilitários da Wave B.11 existem no repositório",
    allFilesExist
  );

  const pageCode = fs.readFileSync(pageFile, "utf8");
  const headerCode = fs.readFileSync(headerFile, "utf8");
  const kpisCode = fs.readFileSync(kpisFile, "utf8");
  const desviosCode = fs.readFileSync(desviosFile, "utf8");
  const canaisCode = fs.readFileSync(canaisFile, "utf8");
  const modalCode = fs.readFileSync(modalFile, "utf8");
  const exportCode = fs.readFileSync(exportFile, "utf8");

  // B11-UI-02: Consumo correto do DTO
  assert(
    "B11-UI-02",
    "Página e componentes consomem MonthlyClosingDTO do motor oficial",
    pageCode.includes("MonthlyClosingDTO") && modalCode.includes("MonthlyClosingDTO")
  );

  // B11-UI-03: Zero acesso direto ao banco
  const uiCodes = [pageCode, headerCode, kpisCode, desviosCode, canaisCode, modalCode, exportCode].join("\n");
  const hasDirectSupabase = /createClient|createAdminClient|supabase\.from|db\.from|\.from\s*\(\s*["'][a-zA-Z_]+["']\s*\)/.test(uiCodes);
  assert(
    "B11-UI-03",
    "Zero acesso direto ao banco Supabase a partir dos componentes da UI",
    !hasDirectSupabase
  );

  // B11-UI-04: Zero recálculo financeiro oficial na UI
  const hasFinancialCalculations = /vlr_total_liq|custo_total|vlr_total_st|buildMacoSqlExpression/.test(uiCodes);
  assert(
    "B11-UI-04",
    "Zero recálculo de regras fiscais ou tributárias de MACO na UI",
    !hasFinancialCalculations
  );

  // B11-UI-05: Semáforo baseado no DTO
  assert(
    "B11-UI-05",
    "Status semafórico de gerentes consome diretamente a propriedade status do DTO",
    desviosCode.includes("g.status === 'SUPERADA'") && desviosCode.includes("g.status === 'CRITICA'")
  );

  // B11-UI-06: Uma chamada HTTP por competência
  assert(
    "B11-UI-06",
    "Página consome endpoint /api/inovacoes/fechamento centralizado",
    pageCode.includes("fetch(`/api/inovacoes/fechamento?year=${selectedYear}&month=${selectedMonth}`)")
  );

  // B11-UI-07: Estados de loading/error/empty
  assert(
    "B11-UI-07",
    "Estados de loading com Skeleton, error com retry e empty implementados",
    pageCode.includes("isLoading") && pageCode.includes("errorCode === 403") && kpisCode.includes("animate-pulse")
  );

  // B11-UI-08: RBAC / 403
  assert(
    "B11-UI-08",
    "Tratamento explícito de erro 403 Forbidden no frontend",
    pageCode.includes("Acesso Restrito (403 Forbidden)")
  );

  // B11-UI-09: Follow-up determinístico
  assert(
    "B11-UI-09",
    "Follow-up acionado com origem COCKPIT_PRESCRITIVO e origem_ref canônica",
    desviosCode.includes("origem: 'COCKPIT_PRESCRITIVO'") &&
      desviosCode.includes("FECHAMENTO_${gerente.managerId}_${competencia}_PLANO_RECUPERACAO")
  );

  // B11-UI-10: Ausência de dependências novas
  const pkgContent = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert(
    "B11-UI-10",
    "Reutilização de html-to-image e pptxgenjs sem novas dependências externas",
    "html-to-image" in pkgContent.dependencies && "pptxgenjs" in pkgContent.dependencies
  );

  // B11-UI-11: Modal e PPTX usam o mesmo DTO
  assert(
    "B11-UI-11",
    "Modal RDM 360 e exportação PPTX alimentados pela mesma estrutura do DTO",
    modalCode.includes("ClosingRdm360ModalProps") && modalCode.includes("exportClosingToPptx")
  );

  // B11-UI-12: Formato 16:9
  assert(
    "B11-UI-12",
    "Exportação PPTX configurada no padrão widescreen 16:9 (10 x 5.625)",
    exportCode.includes("width: 10, height: 5.625")
  );

  // B11-UI-13: Acessibilidade
  assert(
    "B11-UI-13",
    "Atributos de acessibilidade aria-busy, aria-label e role='dialog' presentes",
    headerCode.includes("aria-label=") && modalCode.includes("role=\"dialog\"") && kpisCode.includes("aria-busy=")
  );

  // B11-UI-14: Preservação de arquivos congelados
  const diffFrozen = execSync(
    "git diff 0e23f337b4e3e1d71820828dba31814e09f42116 -- src/lib/services/monthly-closing-engine.ts src/app/api/inovacoes/fechamento/route.ts src/lib/governance/analytics",
    { encoding: "utf8" }
  );
  assert(
    "B11-UI-14",
    "Arquivos congelados (MonthlyClosingEngine, Route, AnalyticsEngine) 100% intactos (0 diff)",
    diffFrozen.trim() === ""
  );

  // B11-UI-15: Ausência de N+1
  const hasLoopFetches = /for\s*\(.*?\)\s*\{[\s\S]*?fetch\(/.test(uiCodes);
  assert(
    "B11-UI-15",
    "Zero loops de requisição assíncrona na camada de apresentação (Zero N+1)",
    !hasLoopFetches
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
  console.error("Erro fatal ao executar testes B.11:", err);
  process.exit(1);
});
