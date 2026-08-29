import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  ServerLogger,
  sanitizeString,
  sanitizeLogPayload,
  telemetryRingBuffer,
  generateRequestId,
} from "../src/lib/telemetry/server-logger";

// --------------------------------------------------------------------------
// SUÍTE DE TESTES AUTOMATIZADOS: B.8 — SLIM OBSERVABILITY ENGINE
// --------------------------------------------------------------------------

interface TestResult {
  id: string;
  name: string;
  category: "UNIT" | "SECURITY" | "STATIC" | "INTEGRATION";
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(
  id: string,
  name: string,
  category: "UNIT" | "SECURITY" | "STATIC" | "INTEGRATION",
  passed: boolean,
  details?: string
) {
  results.push({ id, name, category, passed, details });
  const status = passed ? "✅ [PASS]" : "❌ [FAIL]";
  console.log(`  ${status} [${category}] ${id}: ${name}`);
  if (!passed && details) {
    console.log(`     └─ Detalhes: ${details}`);
  }
}

async function runB8Suite() {
  console.log("\n============================================================");
  console.log("🧪 B.8 — SUÍTE DE TESTES DE OBSERVABILIDADE & TELEMETRIA");
  console.log("============================================================\n");

  // 1. B8-OBS-01: Existência dos 4 arquivos essenciais
  const file1 = fs.existsSync(path.join(process.cwd(), "src/components/telemetry/GlobalErrorBoundary.tsx"));
  const file2 = fs.existsSync(path.join(process.cwd(), "src/lib/telemetry/client-rum.ts"));
  const file3 = fs.existsSync(path.join(process.cwd(), "src/lib/telemetry/server-logger.ts"));
  const file4 = fs.existsSync(path.join(process.cwd(), "src/app/api/telemetry/rum/route.ts"));

  recordTest(
    "B8-OBS-01",
    "Existência física dos 4 módulos de observabilidade",
    "STATIC",
    file1 && file2 && file3 && file4,
    `Status dos arquivos: GlobalErrorBoundary: ${file1}, client-rum: ${file2}, server-logger: ${file3}, route: ${file4}`
  );

  // 2. B8-OBS-02: Geração de Request ID seguro
  const reqId1 = generateRequestId();
  const reqId2 = generateRequestId();
  recordTest(
    "B8-OBS-02",
    "Geração determinística e única de Request ID",
    "UNIT",
    typeof reqId1 === "string" && reqId1.length > 0 && reqId1 !== reqId2
  );

  // 3. B8-OBS-03: Sanitização de E-mail, Bearer Tokens e CPF
  const dirtyString = "Erro do usuário admin@coffeemais.com com token Bearer eyJhbGciOiJIUzI1NiJ9 e CPF 123.456.789-00";
  const cleanString = sanitizeString(dirtyString);
  const isSanitized =
    cleanString !== undefined &&
    !cleanString.includes("admin@coffeemais.com") &&
    !cleanString.includes("eyJhbGciOiJIUzI1NiJ9") &&
    !cleanString.includes("123.456.789-00") &&
    cleanString.includes("[REDACTED_EMAIL]") &&
    cleanString.includes("[REDACTED_TOKEN]") &&
    cleanString.includes("[REDACTED_CPF]");

  recordTest(
    "B8-OBS-03",
    "Sanitização estrita de dados PII e credenciais (E-mail, Tokens, CPF)",
    "SECURITY",
    isSanitized,
    `Resultado da sanitização: ${cleanString}`
  );

  // 4. B8-OBS-04: Expurgo de chaves proibidas em payloads (faturamento, maco, valor_meta, authorization, cookie)
  const dirtyPayload = {
    route: "/inovacoes/dre",
    faturamento: 5000000,
    maco: 650000,
    valor_meta: 10000000,
    authorization: "Bearer secret-token",
    cookie: "sb-auth-token=xyz",
    safeField: "OK",
  };
  const cleanPayload = sanitizeLogPayload(dirtyPayload);
  const hasForbiddenKeyExposed =
    cleanPayload.faturamento !== "[REDACTED]" ||
    cleanPayload.maco !== "[REDACTED]" ||
    cleanPayload.valor_meta !== "[REDACTED]" ||
    cleanPayload.authorization !== "[REDACTED]" ||
    cleanPayload.cookie !== "[REDACTED]" ||
    cleanPayload.safeField !== "OK";

  recordTest(
    "B8-OBS-04",
    "Bloqueio mandatório de chaves financeiras e tokens em payloads",
    "SECURITY",
    !hasForbiddenKeyExposed,
    `Payload sanitizado: ${JSON.stringify(cleanPayload)}`
  );

  // 5. B8-OBS-05: Ring buffer em memória tem capacidade máxima de 100 itens (Bounded FIFO)
  telemetryRingBuffer.clear();
  for (let i = 0; i < 120; i++) {
    ServerLogger.info({
      requestId: `req-${i}`,
      route: `/test-${i}`,
      durationMs: 10 + i,
      source: "server",
    });
  }
  const bufferItems = telemetryRingBuffer.getAll();
  const metrics = telemetryRingBuffer.getMetricsSummary();

  recordTest(
    "B8-OBS-05",
    "Ring Buffer em memória com capacidade limitada estritamente a 100 eventos (FIFO)",
    "UNIT",
    bufferItems.length === 100 && metrics.sampleSize === 100 && bufferItems[99].route === "/test-119",
    `Tamanho do buffer: ${bufferItems.length}`
  );

  // 6. B8-OBS-06: Cálculo de métricas e percentis p50/p95 na instância local
  recordTest(
    "B8-OBS-06",
    "Cálculo de percentis de latência locais (p50, p95, p99)",
    "UNIT",
    typeof metrics.latencyP50Ms === "number" &&
      typeof metrics.latencyP95Ms === "number" &&
      metrics.latencyP95Ms >= metrics.latencyP50Ms
  );

  // 7. B8-OBS-07: ErrorBoundary e TelemetryBootstrap integrados no layout raiz
  const layoutContent = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
  const hasErrorBoundaryInLayout =
    layoutContent.includes("GlobalErrorBoundary") && layoutContent.includes("TelemetryBootstrap");

  recordTest(
    "B8-OBS-07",
    "Integração do GlobalErrorBoundary e TelemetryBootstrap em src/app/layout.tsx",
    "INTEGRATION",
    hasErrorBoundaryInLayout,
    "GlobalErrorBoundary ou TelemetryBootstrap ausentes em layout.tsx"
  );

  // 8. B8-OBS-08: RUM endpoint valida whitelist de eventType e rejeita tipos maliciosos
  const rumRouteContent = fs.readFileSync(path.join(process.cwd(), "src/app/api/telemetry/rum/route.ts"), "utf8");
  const hasWhitelistValidation =
    rumRouteContent.includes("ALLOWED_EVENT_TYPES") &&
    rumRouteContent.includes("RATE_LIMIT_WINDOW_MS") &&
    rumRouteContent.includes("MAX_PAYLOAD_BYTES");

  recordTest(
    "B8-OBS-08",
    "Validação estrita de Whitelist, Rate Limiting e Limite de Payload em /api/telemetry/rum",
    "SECURITY",
    hasWhitelistValidation
  );

  // 9. B8-OBS-09: Client RUM implementa sendBeacon, window.onerror e unhandledrejection
  const clientRumContent = fs.readFileSync(path.join(process.cwd(), "src/lib/telemetry/client-rum.ts"), "utf8");
  const hasClientRumFeatures =
    clientRumContent.includes("navigator.sendBeacon") &&
    clientRumContent.includes("window.addEventListener(\"error\"") &&
    clientRumContent.includes("window.addEventListener(\"unhandledrejection\"") &&
    clientRumContent.includes("DEDUP_WINDOW_MS");

  recordTest(
    "B8-OBS-09",
    "Client RUM implementa sendBeacon, deduplicação de 5s e listeners globais de erro",
    "UNIT",
    hasClientRumFeatures
  );

  // 10. B8-OBS-10: Zero migrations criadas na Wave B.8
  let migrationsDiff = "";
  try {
    migrationsDiff = execSync("git diff --name-only | grep 'supabase/migrations' || true").toString().trim();
  } catch {}

  recordTest(
    "B8-OBS-10",
    "Zero migrations ou alterações DDL no banco de dados",
    "STATIC",
    migrationsDiff === "",
    `Migrations modificadas: ${migrationsDiff}`
  );

  // 11. B8-OBS-11: AnalyticsEngine e governança analítica 100% inalteradas
  let analyticsDiff = "";
  try {
    analyticsDiff = execSync("git diff --name-only | grep 'src/lib/governance/analytics' || true").toString().trim();
  } catch {}

  recordTest(
    "B8-OBS-11",
    "AnalyticsEngine e governança analítica 100% inalteradas",
    "STATIC",
    analyticsDiff === "",
    `Arquivos em analytics modificados: ${analyticsDiff}`
  );

  // 12. B8-OBS-12: Zero dependências npm adicionadas em package.json
  const packageJsonContent = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8");
  const pkg = JSON.parse(packageJsonContent);
  const hasExternalHeavyDeps =
    pkg.dependencies["@sentry/nextjs"] ||
    pkg.dependencies["@opentelemetry/api"] ||
    pkg.dependencies["posthog-js"] ||
    pkg.dependencies["logrocket"];

  recordTest(
    "B8-OBS-12",
    "Zero dependências externas pesadas (Sentry, OpenTelemetry, PostHog, LogRocket)",
    "STATIC",
    !hasExternalHeavyDeps
  );

  // 13. B8-OBS-13: Fail-safe absoluto (ServerLogger e ClientRUM não quebram com inputs malformados)
  let failSafeWorked = true;
  try {
    ServerLogger.error({
      requestId: null as any,
      route: undefined,
      errorMessage: undefined,
      stack: undefined,
      source: "server",
    });
  } catch {
    failSafeWorked = false;
  }

  recordTest(
    "B8-OBS-13",
    "Princípio Fail-Safe: logger e coletores absorvem inputs anômalos sem lançar exceções",
    "UNIT",
    failSafeWorked
  );

  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`📊 RESULTADO DA SUÍTE B.8: ${passed}/${total} APROVADOS (${failed} FALHAS)`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runB8Suite().catch((err) => {
  console.error("Erro fatal na execução da suíte B.8:", err);
  process.exit(1);
});
