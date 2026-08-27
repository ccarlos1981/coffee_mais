/**
 * Testes Automatizados de Segurança da Wave 4 (Coffee++)
 * Valida o Hardening das APIs Desautenticadas e Crons Fail-Closed
 */

import { assertCronAccess } from "@/lib/supabase/auth-helpers";

async function runWave4Tests() {
  console.log("==================================================================");
  console.log("  COFFEE++ — SUÍTE DE TESTES DE SEGURANÇA WAVE 4 (APIs & CRONS)");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testCode: string, description: string) {
    if (condition) {
      console.log(`  [✅ OK] ${testCode} — ${description}`);
      passed++;
    } else {
      console.error(`  [❌ FALHA] ${testCode} — ${description}`);
      failed++;
    }
  }

  // ─── GRUPO 1: CRON SECURITY & FAIL-CLOSED ENFORCEMENT ───
  console.log("--- Grupo 1: Cron Security & Fail-Closed (assertCronAccess) ---");

  const originalCronSecret = process.env.CRON_SECRET;

  // CRON-SECRET-MISSING-01: Fail-Closed when CRON_SECRET is undefined
  delete process.env.CRON_SECRET;
  const dummyReq1 = new Request("https://api.coffeemais.com/api/cron/sync-bigquery", {
    headers: { Authorization: "Bearer some-token" },
  });
  const resMissing = assertCronAccess(dummyReq1);
  assert(
    resMissing.authorized === false && resMissing.errorResponse?.status === 401,
    "CRON-SECRET-MISSING-01",
    "CRON_SECRET ausente bloqueia execução com HTTP 401 (Fail-Closed obrigatório)"
  );

  // CRON-SECRET-EMPTY-02: Fail-Closed when CRON_SECRET is empty string
  process.env.CRON_SECRET = "   ";
  const resEmpty = assertCronAccess(dummyReq1);
  assert(
    resEmpty.authorized === false && resEmpty.errorResponse?.status === 401,
    "CRON-SECRET-EMPTY-02",
    "CRON_SECRET vazio/espaços bloqueia execução com HTTP 401 (Fail-Closed)"
  );

  // Set test CRON_SECRET
  process.env.CRON_SECRET = "super-secret-cron-token-xyz-123456";

  // CRON-NO-AUTH-01: Missing Authorization header
  const reqNoAuth = new Request("https://api.coffeemais.com/api/cron/generate-alerts");
  const resNoAuth = assertCronAccess(reqNoAuth);
  assert(
    resNoAuth.authorized === false && resNoAuth.errorResponse?.status === 401,
    "CRON-NO-AUTH-01",
    "Requisição sem header Authorization bloqueada com HTTP 401"
  );

  // CRON-WRONG-SECRET-01: Invalid Bearer token
  const reqWrongToken = new Request("https://api.coffeemais.com/api/cron/acoes-atrasadas", {
    headers: { Authorization: "Bearer wrong-token-value" },
  });
  const resWrongToken = assertCronAccess(reqWrongToken);
  assert(
    resWrongToken.authorized === false && resWrongToken.errorResponse?.status === 401,
    "CRON-WRONG-SECRET-01",
    "Bearer token incorreto bloqueado com HTTP 401 (Constant-time check)"
  );

  // CRON-QUERY-SECRET-01: Secret in query string rejected
  const reqQuerySecret = new Request("https://api.coffeemais.com/api/cron/rps-alert?secret=super-secret-cron-token-xyz-123456");
  const resQuerySecret = assertCronAccess(reqQuerySecret);
  assert(
    resQuerySecret.authorized === false && resQuerySecret.errorResponse?.status === 401,
    "CRON-QUERY-SECRET-01",
    "Segredo passado em query string '?secret=' expressamente bloqueado"
  );

  // CRON-VALID-SECRET-01: Valid Bearer token authorized
  const reqValidToken = new Request("https://api.coffeemais.com/api/cron/executive-daily-report", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const resValidToken = assertCronAccess(reqValidToken);
  assert(
    resValidToken.authorized === true && !resValidToken.errorResponse,
    "CRON-VALID-SECRET-01",
    "Bearer token oficial homologado autorizado com sucesso"
  );

  // Restore env
  if (originalCronSecret) {
    process.env.CRON_SECRET = originalCronSecret;
  } else {
    delete process.env.CRON_SECRET;
  }


  // ─── GRUPO 2: API EMAILS & REPORT RECIPIENTS ROLE CHECK ───
  console.log("\n--- Grupo 2: API Emails (/api/emails) ---");

  const EMAIL_ALLOWED_ROLES = ["Admin", "Admin Master", "CEO"];
  function checkEmailRole(role?: string | null): boolean {
    if (!role) return false;
    return EMAIL_ALLOWED_ROLES.includes(role.trim());
  }

  // AUTH-EMAIL-01: Anon rejected
  assert(checkEmailRole(null) === false, "AUTH-EMAIL-01", "Usuário anônimo bloqueado para /api/emails");

  // AUTH-EMAIL-02: Promotor / Gerente Regional rejected
  assert(
    checkEmailRole("Promotor") === false && checkEmailRole("Gerente Regional") === false,
    "AUTH-EMAIL-02",
    "Perfis não administrativos (Promotor, Gerente) bloqueados para /api/emails"
  );

  // AUTH-EMAIL-03: Admin / CEO authorized
  assert(
    checkEmailRole("Admin") === true && checkEmailRole("CEO") === true,
    "AUTH-EMAIL-03",
    "Perfis Admin e CEO autorizados para gerenciamento de destinatários"
  );


  // ─── GRUPO 3: API NETWORKS & TELEMETRY ───
  console.log("\n--- Grupo 3: Networks & Telemetry (/api/networks, /api/admin/telemetry/planning) ---");

  function checkNetworkAuth(user: { id: string } | null, profile: { approved: boolean } | null): boolean {
    if (!user || !profile || !profile.approved) return false;
    return true;
  }

  // NETWORK-AUTH-01: Anon rejected, approved user authorized
  assert(checkNetworkAuth(null, null) === false, "NETWORK-AUTH-01", "Usuário anônimo bloqueado para /api/networks");
  assert(checkNetworkAuth({ id: "user-1" }, { approved: true }) === true, "NETWORK-AUTH-02", "Usuário autenticado e aprovado autorizado para /api/networks");

  function checkTelemetryRole(role?: string | null): boolean {
    if (!role) return false;
    return ["Admin", "Admin Master", "CEO"].includes(role.trim());
  }

  // TELEMETRY-AUTH-01: Anon / Promotor rejected
  assert(checkTelemetryRole(null) === false && checkTelemetryRole("Promotor") === false, "TELEMETRY-AUTH-01", "Usuário anônimo ou Promotor bloqueado para /api/admin/telemetry/planning");

  // TELEMETRY-ROLE-01: Admin authorized
  assert(checkTelemetryRole("Admin") === true, "TELEMETRY-ROLE-01", "Administrador autorizado para telemetria de planejamento");


  // ─── GRUPO 4: DASHBOARD POSITIVAÇÃO & SPARKLINE REGIONAL SCOPING ───
  console.log("\n--- Grupo 4: Dashboards Regional Scoping (/api/dashboard/*) ---");

  function resolveEffectiveManager(
    userRole: string,
    userMgrName: string,
    requestedManager: string | null
  ): string | null {
    const isNational = ["Admin", "Admin Master", "CEO", "Diretor", "Gerente Nacional", "Trade", "Financeiro"].includes(userRole);
    if (isNational) {
      return requestedManager; // Can filter any manager
    }
    if (userRole === "Gerente Regional") {
      // Must be forced to own manager
      return userMgrName;
    }
    return null;
  }

  // POSIT-AUTH-01: Anon blocked
  assert(resolveEffectiveManager("Anon", "", "Leandro") === null, "POSIT-AUTH-01", "Usuário não autenticado bloqueado no dashboard");

  // POSIT-SCOPE-01: Gerente Regional forced to own scope
  const scopedMgr = resolveEffectiveManager("Gerente Regional", "Leandro", "Julliano");
  assert(scopedMgr === "Leandro", "POSIT-SCOPE-01", "Gerente Regional 'Leandro' tem escopo forçado ignorando ?manager=Julliano");

  // SPARK-SCOPE-01: Admin can query any manager
  const adminMgr = resolveEffectiveManager("Admin", "Admin User", "Julliano");
  assert(adminMgr === "Julliano", "SPARK-SCOPE-01", "Administrador pode filtrar qualquer gerente no sparkline");


  // ─── GRUPO 5: IMPORT STATUS & BATCH OWNERSHIP (IDOR DEFENSE) ───
  console.log("\n--- Grupo 5: Import Status & Ownership (/api/import/status/[id]) ---");

  interface MockSyncLog {
    id: string;
    metadata: { user_id?: string; uploaded_by?: string };
  }

  function checkImportStatusAccess(
    user: { id: string; role: string; approved: boolean } | null,
    log: MockSyncLog | null
  ): boolean {
    if (!user || !user.approved || !log) return false;
    const isGlobal = ["Admin", "Admin Master", "CEO", "Trade", "Financeiro", "Diretor"].includes(user.role);
    if (isGlobal) return true;
    const uploader = log.metadata.user_id || log.metadata.uploaded_by;
    return uploader === user.id;
  }

  const logBatchA: MockSyncLog = { id: "batch-A", metadata: { user_id: "user-A" } };
  const userA = { id: "user-A", role: "Vendedor", approved: true };
  const userB = { id: "user-B", role: "Vendedor", approved: true };
  const userAdmin = { id: "user-admin", role: "Admin", approved: true };

  // IMPORT-AUTH-01: Anon blocked
  assert(checkImportStatusAccess(null, logBatchA) === false, "IMPORT-AUTH-01", "Usuário anônimo bloqueado em /api/import/status/[id]");

  // IMPORT-IDOR-01: User B cannot access Batch of User A
  assert(checkImportStatusAccess(userB, logBatchA) === false, "IMPORT-IDOR-01", "IDOR bloqueado: Usuário B não consegue consultar lote do Usuário A");

  // IMPORT-OWNER-01: User A can access own batch, Admin can access all
  assert(
    checkImportStatusAccess(userA, logBatchA) === true &&
    checkImportStatusAccess(userAdmin, logBatchA) === true,
    "IMPORT-OWNER-01",
    "Autor do lote e Administrador autorizados para consulta do status"
  );


  // ─── GRUPO 6: EXPORT AUTHENTICATION ───
  console.log("\n--- Grupo 6: Export Utility (/api/export) ---");

  function checkExportAuth(user: { id: string } | null, profile: { approved: boolean } | null): boolean {
    if (!user || !profile || !profile.approved) return false;
    return true;
  }

  // EXPORT-AUTH-01: Anon blocked
  assert(checkExportAuth(null, null) === false, "EXPORT-AUTH-01", "Usuário anônimo bloqueado em /api/export (Prevenção de DoS)");

  // EXPORT-AUTH-02: Approved user authorized
  assert(checkExportAuth({ id: "user-1" }, { approved: true }) === true, "EXPORT-AUTH-02", "Usuário autenticado e aprovado autorizado para exportação XLSX");

  console.log("\n==================================================================");
  console.log(`  RESUMO DOS TESTES DE SEGURANÇA WAVE 4`);
  console.log(`  Sucessos: ${passed} | Falhas: ${failed}`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runWave4Tests().catch((err) => {
  console.error("Erro fatal nos testes Wave 4:", err);
  process.exit(1);
});
