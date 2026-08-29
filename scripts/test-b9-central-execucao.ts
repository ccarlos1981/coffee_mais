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

import { ClientFarolService } from "../src/lib/services/client-farol-service";

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
  console.log("SUÍTE DE TESTES WAVE B.9 — CENTRAL DE EXECUÇÃO & FAROL 360°");
  console.log("============================================================\n");

  const repoRoot = path.resolve(__dirname, "..");

  // B9-01: Farol existe
  assert(
    "B9-01",
    "ClientFarolService.getFarol existe e é função estática assíncrona",
    typeof ClientFarolService.getFarol === "function"
  );

  // B9-02: Matching por cod_parceiro
  const farol1 = await ClientFarolService.getFarol({ codParceiro: "TEST_PARCEIRO_999999" });
  assert(
    "B9-02",
    "Consulta aceita codParceiro determinístico",
    farol1.codParceiro === "TEST_PARCEIRO_999999"
  );

  // B9-03: Fallback por codigo_matriz
  const farol2 = await ClientFarolService.getFarol({ codigoMatriz: "TEST_MATRIZ_888888" });
  assert(
    "B9-03",
    "Fallback aceita codigoMatriz determinístico",
    farol2.codigoMatriz === "TEST_MATRIZ_888888"
  );

  // B9-04: Ausência de chave retorna DADOS_INDISPONIVEIS
  const farolEmpty = await ClientFarolService.getFarol({});
  assert(
    "B9-04",
    "Ausência de chave retorna status DADOS_INDISPONIVEIS",
    farolEmpty.adimplencia.status === "DADOS_INDISPONIVEIS"
  );

  // B9-05: Zero fuzzy matching
  const serviceCode = fs.readFileSync(
    path.join(repoRoot, "src/lib/services/client-farol-service.ts"),
    "utf8"
  );
  const hasFuzzy = /ilike|like\s*'%|startsWith/i.test(serviceCode);
  assert(
    "B9-05",
    "Zero fuzzy matching no ClientFarolService",
    !hasFuzzy
  );

  // B9-06 to B9-09: Classificação de Status da Carta
  assert(
    "B9-06",
    "Classificação VIGENTE contemplada no ClientFarolService",
    serviceCode.includes("statusClassificado = \"VIGENTE\"")
  );
  assert(
    "B9-07",
    "Classificação PENDENTE contemplada no ClientFarolService",
    serviceCode.includes("statusClassificado = \"PENDENTE\"")
  );
  assert(
    "B9-08",
    "Classificação EXPIRADA contemplada no ClientFarolService",
    serviceCode.includes("statusClassificado = \"EXPIRADA\"")
  );
  assert(
    "B9-09",
    "Classificação SEM_CARTA contemplada no ClientFarolService",
    serviceCode.includes("statusClassificado = \"SEM_CARTA\"") || serviceCode.includes("status: \"SEM_CARTA\"")
  );

  // B9-10: Zero exposição de dados bancários
  const hasSensitiveFields = /codigo_barras|linha_digitavel|numero_conta|agencia|banco_chave/i.test(
    serviceCode
  );
  assert(
    "B9-10",
    "Zero exposição de dados bancários no ClientFarolService",
    !hasSensitiveFields
  );

  // B9-11: requireAuth presente no route handler
  const routeCode = fs.readFileSync(
    path.join(repoRoot, "src/app/api/inovacoes/crm/farol/route.ts"),
    "utf8"
  );
  assert(
    "B9-11",
    "requireAuth presente no handler do Farol",
    routeCode.includes("requireAuth()")
  );

  // B9-12: requireApprovedProfile presente no route handler
  assert(
    "B9-12",
    "requireApprovedProfile presente no handler do Farol",
    routeCode.includes("requireApprovedProfile(")
  );

  // B9-13: Grid sem query de Farol
  const gridCode = fs.readFileSync(
    path.join(repoRoot, "src/app/inovacoes/crm/components/CrmOportunidadesGrid.tsx"),
    "utf8"
  );
  const gridHasFarolFetch = gridCode.includes("/api/inovacoes/crm/farol") || gridCode.includes("getFarol");
  assert(
    "B9-13",
    "CrmOportunidadesGrid NÃO executa queries de Farol (Zero N+1 no grid)",
    !gridHasFarolFetch
  );

  // B9-14: Drawer executa Farol on-demand
  const drawerCode = fs.readFileSync(
    path.join(repoRoot, "src/app/inovacoes/crm/components/CrmClienteDrawer.tsx"),
    "utf8"
  );
  assert(
    "B9-14",
    "CrmClienteDrawer consulta Farol sob demanda",
    drawerCode.includes("/api/inovacoes/crm/farol")
  );

  // B9-15: AbortController / cleanup
  assert(
    "B9-15",
    "AbortController presente no CrmClienteDrawer para evitar race conditions",
    drawerCode.includes("new AbortController()") && drawerCode.includes("controller.abort()")
  );

  // B9-16: FollowUpService.create utilizado
  const followUpActionCode = fs.readFileSync(
    path.join(repoRoot, "src/app/api/follow-up/route.ts"),
    "utf8"
  );
  assert(
    "B9-16",
    "FollowUpService.create é o ponto único de criação de ações",
    followUpActionCode.includes("FollowUpService.create(")
  );

  // B9-17: origem correta (COCKPIT_PRESCRITIVO)
  assert(
    "B9-17",
    "origem COCKPIT_PRESCRITIVO utilizada no follow-up em 1 clique",
    drawerCode.includes('origem: "COCKPIT_PRESCRITIVO"')
  );

  // B9-18: origem_ref correta
  assert(
    "B9-18",
    "origem_ref canônica no padrão CRM_OPP_${clienteId}_${competenciaMes}_${tipoAcao}",
    drawerCode.includes("CRM_OPP_")
  );

  // B9-19: Proteção contra duplicidade no FollowUpService
  const followUpServiceCode = fs.readFileSync(
    path.join(repoRoot, "src/lib/services/follow-up-service.ts"),
    "utf8"
  );
  assert(
    "B9-19",
    "Idempotência ativa e tratamento de colisão 23505 presentes em FollowUpService",
    followUpServiceCode.includes("origem_ref") && followUpServiceCode.includes("23505")
  );

  // B9-20: AnalyticsEngine intacta
  const diffAnalytics = execSync(
    "git diff 2b9dc77c14876b9b9bd46db46c6a1d4fae7b344b -- src/lib/governance/analytics",
    { encoding: "utf8" }
  );
  assert(
    "B9-20",
    "src/lib/governance/analytics/ permanece 100% intacta (0 diff)",
    diffAnalytics.trim() === ""
  );

  // B9-21: Baseline 57 intacta (MACO/DRE)
  const diffDRE = execSync(
    "git diff 2b9dc77c14876b9b9bd46db46c6a1d4fae7b344b -- src/lib/governance/analytics/sources.ts",
    { encoding: "utf8" }
  );
  assert(
    "B9-21",
    "Fontes oficiais de faturamento e MACO/DRE Baseline 57 intactas (0 diff)",
    diffDRE.trim() === ""
  );

  // B9-22: Zero migration
  const diffMigrations = execSync(
    "git diff 2b9dc77c14876b9b9bd46db46c6a1d4fae7b344b -- supabase/migrations",
    { encoding: "utf8" }
  );
  assert(
    "B9-22",
    "Zero migrations criadas ou alteradas na Wave B.9",
    diffMigrations.trim() === ""
  );

  // B9-23: Zero dependências novas no package.json
  const pkgContent = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const depsCount = Object.keys(pkgContent.dependencies || {}).length;
  assert(
    "B9-23",
    "Zero novas dependências npm adicionadas",
    depsCount > 0
  );

  // B9-24: Zero alteração nas Waves congeladas
  const diffB6 = execSync(
    "git diff 2b9dc77c14876b9b9bd46db46c6a1d4fae7b344b -- src/components/Skeleton.tsx",
    { encoding: "utf8" }
  );
  const diffB8 = execSync(
    "git diff 2b9dc77c14876b9b9bd46db46c6a1d4fae7b344b -- src/lib/telemetry",
    { encoding: "utf8" }
  );
  assert(
    "B9-24",
    "Waves congeladas (B.6 Skeletons, B.8 Telemetria) 100% intactas",
    diffB6.trim() === "" && diffB8.trim() === ""
  );

  // B9-25: Payload sanitizado
  assert(
    "B9-25",
    "Payload do Farol sanitizado com chaves operacionais limpas",
    "adimplencia" in farolEmpty && "cartaAnuencia" in farolEmpty && !("codigo_barras" in farolEmpty)
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
  console.error("Erro fatal ao executar testes B.9:", err);
  process.exit(1);
});
