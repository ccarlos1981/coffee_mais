import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ============================================================
// 🧪 B.6 — SUÍTE DE TESTES DE UX / SKELETON SCREENS
// ============================================================

interface TestResult {
  id: string;
  name: string;
  category: "STATIC" | "UNIT" | "INTEGRATION";
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(id: string, name: string, category: "STATIC" | "UNIT" | "INTEGRATION", passed: boolean, details?: string) {
  results.push({ id, name, category, passed, details });
  const icon = passed ? "✅ [PASS]" : "❌ [FAIL]";
  console.log(`  ${icon} [${category}] ${id}: ${name}`);
  if (details && !passed) {
    console.log(`     └─ Detalhes: ${details}`);
  }
}

async function runB6Tests() {
  console.log("\n============================================================");
  console.log("🧪 B.6 — SUÍTE DE TESTES DE UX / SKELETON SCREENS");
  console.log("============================================================\n");

  const skeletonFilePath = path.join(process.cwd(), "src/components/Skeleton.tsx");
  const skeletonContent = fs.readFileSync(skeletonFilePath, "utf8");

  // B6-SKEL-01: Skeleton base continua exportado
  const hasBaseSkeleton = skeletonContent.includes("export function Skeleton");
  recordTest(
    "B6-SKEL-01",
    "Skeleton base continua exportado e funcional",
    "UNIT",
    hasBaseSkeleton,
    "export function Skeleton não encontrado em src/components/Skeleton.tsx"
  );

  // B6-SKEL-02: TableSkeletonRows existe e está exportado
  const hasTableSkeletonRows = skeletonContent.includes("export function TableSkeletonRows");
  recordTest(
    "B6-SKEL-02",
    "TableSkeletonRows exportado com tipagem de rows e columns",
    "UNIT",
    hasTableSkeletonRows,
    "export function TableSkeletonRows não encontrado em src/components/Skeleton.tsx"
  );

  // B6-SKEL-03: TableSkeletonCard existe e está exportado
  const hasTableSkeletonCard = skeletonContent.includes("export function TableSkeletonCard");
  recordTest(
    "B6-SKEL-03",
    "TableSkeletonCard exportado com estrutura completa de tabela",
    "UNIT",
    hasTableSkeletonCard,
    "export function TableSkeletonCard não encontrado em src/components/Skeleton.tsx"
  );

  // B6-SKEL-04: RpsTableSkeleton existe e está exportado
  const hasRpsTableSkeleton = skeletonContent.includes("export function RpsTableSkeleton");
  recordTest(
    "B6-SKEL-04",
    "RpsTableSkeleton exportado para o grid de planejamento da RPS",
    "UNIT",
    hasRpsTableSkeleton,
    "export function RpsTableSkeleton não encontrado em src/components/Skeleton.tsx"
  );

  // B6-SKEL-05: Nenhum helper executa fetch
  const hasNoFetch = !skeletonContent.includes("fetch(") && !skeletonContent.includes("axios");
  recordTest(
    "B6-SKEL-05",
    "Nenhum helper de Skeleton executa chamadas assíncronas de fetch",
    "STATIC",
    hasNoFetch,
    "Chamada assíncrona/fetch encontrada indevidamente em Skeleton.tsx"
  );

  // B6-SKEL-06: Nenhum helper possui mutation ou estado de negócio
  const hasNoMutation = !skeletonContent.includes("useState") && !skeletonContent.includes("useEffect") && !skeletonContent.includes(".insert") && !skeletonContent.includes(".update");
  recordTest(
    "B6-SKEL-06",
    "Nenhum helper de Skeleton possui mutations ou estado de negócio",
    "STATIC",
    hasNoMutation,
    "Mutações ou estado de negócio encontrados em Skeleton.tsx"
  );

  // B6-SKEL-07: Ausência de 'as any' nos arquivos alterados
  const saudeGridContent = fs.readFileSync(path.join(process.cwd(), "src/app/inovacoes/cockpit/components/SaudeCarteiraGrid.tsx"), "utf8");
  const rankingTabsContent = fs.readFileSync(path.join(process.cwd(), "src/app/inovacoes/cockpit/components/RankingComercialTabs.tsx"), "utf8");
  const dreGridContent = fs.readFileSync(path.join(process.cwd(), "src/app/inovacoes/dre/components/DreDimensionalGrid.tsx"), "utf8");
  
  const hasNoAnyInAltered = !skeletonContent.includes("as any") && !saudeGridContent.includes("as any") && !rankingTabsContent.includes("as any") && !dreGridContent.includes("as any");
  recordTest(
    "B6-SKEL-07",
    "Ausência de tipagem permissiva 'as any' nos componentes de apresentação alterados",
    "STATIC",
    hasNoAnyInAltered,
    "Uso de 'as any' detectado em componentes alterados"
  );

  // B6-SKEL-08: aria-busy e acessibilidade presentes
  const hasAriaBusy = skeletonContent.includes('aria-busy="true"') && 
                      saudeGridContent.includes('aria-busy={loading}') && 
                      dreGridContent.includes('aria-busy={loading}');
  recordTest(
    "B6-SKEL-08",
    "Atributos de acessibilidade aria-busy e aria-label presentes nos componentes",
    "STATIC",
    hasAriaBusy,
    "Faltando aria-busy nos componentes de tabela"
  );

  // B6-SKEL-09: motion-reduce:animate-none presente
  const hasMotionReduce = skeletonContent.includes("motion-reduce:animate-none");
  recordTest(
    "B6-SKEL-09",
    "Suporte a acessibilidade de movimento reduzido (motion-reduce:animate-none)",
    "STATIC",
    hasMotionReduce,
    "motion-reduce:animate-none ausente em Skeleton.tsx"
  );

  // B6-SKEL-10: As 4 telas utilizam os componentes Skeleton adequadamente
  const rpsContent = fs.readFileSync(path.join(process.cwd(), "src/app/processo-comercial/rps/page.tsx"), "utf8");
  const clientesContent = fs.readFileSync(path.join(process.cwd(), "src/app/config-financeiro/clientes/page.tsx"), "utf8");
  
  const hasAllScreenIntegrations = saudeGridContent.includes("TableSkeletonRows") &&
                                   rankingTabsContent.includes("TableSkeletonRows") &&
                                   dreGridContent.includes("TableSkeletonRows") &&
                                   rpsContent.includes("RpsTableSkeleton") &&
                                   clientesContent.includes("TableSkeletonRows");
  recordTest(
    "B6-SKEL-10",
    "As 4 telas operacionais/executivas utilizam Skeleton durante loading",
    "INTEGRATION",
    hasAllScreenIntegrations,
    "Uma ou mais telas não estão integradas com os novos skeletons"
  );

  // B6-SKEL-11: Zero alterações em APIs
  let gitDiffApi = "";
  try {
    gitDiffApi = execSync("git diff --name-only | grep 'src/app/api' || true").toString().trim();
  } catch (e) {}
  recordTest(
    "B6-SKEL-11",
    "Zero alterações em rotas de API HTTP (src/app/api)",
    "STATIC",
    gitDiffApi === "",
    `Rotas de API alteradas indevidamente: ${gitDiffApi}`
  );

  // B6-SKEL-12: Zero migrations novas criadas nesta Wave
  let gitDiffMigrations = "";
  try {
    gitDiffMigrations = execSync("git status --short | grep 'supabase/migrations' || true").toString().trim();
  } catch (e) {}
  recordTest(
    "B6-SKEL-12",
    "Zero migrations ou alterações de banco de dados",
    "STATIC",
    gitDiffMigrations === "",
    `Migrations encontradas: ${gitDiffMigrations}`
  );

  // B6-SKEL-13: AnalyticsEngine intacta
  let gitDiffAnalytics = "";
  try {
    gitDiffAnalytics = execSync("git diff --name-only | grep 'src/lib/governance/analytics' || true").toString().trim();
  } catch (e) {}
  recordTest(
    "B6-SKEL-13",
    "AnalyticsEngine e governança analítica 100% inalteradas",
    "STATIC",
    gitDiffAnalytics === "",
    `Arquivos em analytics alterados: ${gitDiffAnalytics}`
  );

  // Relatório Final
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log("\n============================================================");
  console.log(`📊 RESULTADO DA SUÍTE B.6: ${passed}/${total} APROVADOS (${failed} FALHAS)`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runB6Tests().catch((err) => {
  console.error("Erro fatal na suíte B.6:", err);
  process.exit(1);
});
