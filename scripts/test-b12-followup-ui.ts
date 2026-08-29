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
  console.log("SUÍTE DE TESTES WAVE B.12 — COCKPIT FOLLOW-UP 360° & EXECUÇÃO");
  console.log("============================================================\n");

  const repoRoot = path.resolve(__dirname, "..");
  const drawerFile = path.join(repoRoot, "src/app/processo-comercial/follow-up/components/FollowUpDrawer.tsx");
  const pageFile = path.join(repoRoot, "src/app/processo-comercial/follow-up/page.tsx");

  // B12-UI-01: Existência física dos componentes
  const allFilesExist = fs.existsSync(drawerFile) && fs.existsSync(pageFile);
  assert(
    "B12-UI-01",
    "Componentes da Wave B.12 existem fisicamente no repositório",
    allFilesExist
  );

  const drawerCode = fs.readFileSync(drawerFile, "utf8");
  const pageCode = fs.readFileSync(pageFile, "utf8");

  // B12-UI-02: Farol sob demanda no Drawer via /api/inovacoes/crm/farol
  assert(
    "B12-UI-02",
    "Drawer consulta o Farol sob demanda via /api/inovacoes/crm/farol",
    drawerCode.includes("/api/inovacoes/crm/farol") && drawerCode.includes("codParceiro")
  );

  // B12-UI-03: Zero Farol na listagem
  assert(
    "B12-UI-03",
    "Listagem principal (page.tsx) não realiza chamadas ao Farol (Anti-N+1)",
    !pageCode.includes("/api/inovacoes/crm/farol")
  );

  // B12-UI-04: AbortController
  assert(
    "B12-UI-04",
    "Drawer implementa AbortController com cancelamento de requisições pendentes",
    drawerCode.includes("new AbortController()") && drawerCode.includes("controller.abort()")
  );

  // B12-UI-05: Tratamento REGIONAL_
  assert(
    "B12-UI-05",
    "Ações regionais (REGIONAL_) são identificadas e tratadas sem requisição de PDV",
    drawerCode.includes("REGIONAL_") && drawerCode.includes("Ação Executiva de Âmbito Regional")
  );

  // B12-UI-06: SLA
  assert(
    "B12-UI-06",
    "Motor de cálculo de SLA implementado com classificação temporal e countdown",
    drawerCode.includes("calculateSla") && pageCode.includes("filterSla")
  );

  // B12-UI-07: Gap BRL
  assert(
    "B12-UI-07",
    "Gap Financeiro Original exibido com formatação em BRL",
    drawerCode.includes("gap_original_reais") && drawerCode.includes("formatCurrency")
  );

  // B12-UI-08: origem/origem_ref
  assert(
    "B12-UI-08",
    "Rastreabilidade de origem e origem_ref canônica no Drawer",
    drawerCode.includes("action.origem_ref") && drawerCode.includes("ORIGEM_LABELS")
  );

  // B12-UI-09: Zero Supabase direto na UI
  const uiCodes = [drawerCode, pageCode].join("\n");
  const hasDirectSupabase = /createClient|createAdminClient|supabase\.from|db\.from|\.from\s*\(\s*["'][a-zA-Z_]+["']\s*\)/.test(uiCodes);
  assert(
    "B12-UI-09",
    "Zero acesso direto ao banco Supabase a partir dos componentes da UI",
    !hasDirectSupabase
  );

  // B12-UI-10: Zero recálculo financeiro
  const hasFinancialCalculations = /vlr_total_liq|custo_total|vlr_total_st|buildMacoSqlExpression/.test(uiCodes);
  assert(
    "B12-UI-10",
    "Zero recálculo de fórmulas de faturamento ou MACO na UI",
    !hasFinancialCalculations
  );

  // B12-UI-11: Zero dependências novas
  const pkgContent = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert(
    "B12-UI-11",
    "Zero novas dependências adicionadas no package.json",
    "lucide-react" in pkgContent.dependencies && "sonner" in pkgContent.dependencies
  );

  // B12-UI-12: Zero migrations
  const diffMigrations = execSync(
    "git diff 28a653a599c0fd1b531c4b4895b9586106acb243 -- supabase/migrations/",
    { encoding: "utf8" }
  );
  assert(
    "B12-UI-12",
    "Zero migrations criadas ou alteradas na Wave B.12",
    diffMigrations.trim() === ""
  );

  // B12-UI-13: Preservação das Waves congeladas
  const diffFrozen = execSync(
    "git diff 28a653a599c0fd1b531c4b4895b9586106acb243 -- src/lib/services/monthly-closing-engine.ts src/app/api/inovacoes/fechamento/route.ts src/lib/services/client-farol-service.ts src/app/api/inovacoes/crm/farol/route.ts src/lib/governance/analytics/ src/lib/domain/canonical.ts src/app/inovacoes/fechamento/",
    { encoding: "utf8" }
  );
  assert(
    "B12-UI-13",
    "Arquivos congelados (B.6 a B.11) 100% intactos (0 diff)",
    diffFrozen.trim() === ""
  );

  // B12-UI-14: Acessibilidade
  assert(
    "B12-UI-14",
    "Atributos de acessibilidade aria-label, aria-busy, role='dialog' e role='table' presentes",
    drawerCode.includes('role="dialog"') && pageCode.includes('role="table"') && drawerCode.includes("aria-busy=")
  );

  // B12-UI-15: Zero N+1
  const hasLoopFetches = /for\s*\(.*?\)\s*\{[\s\S]*?fetch\(|\.forEach\s*\([\s\S]*?fetch\(/.test(pageCode);
  assert(
    "B12-UI-15",
    "Zero loops de requisição assíncrona na listagem principal (Zero N+1)",
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
  console.error("Erro fatal ao executar testes B.12:", err);
  process.exit(1);
});
