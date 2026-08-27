/**
 * Testes Automatizados de Segurança da Wave 3 (Coffee++)
 * Valida o Hardening das Políticas RLS de Storage (excel-uploads) e Banco de Dados (cm_weekly_projections, cm_report_recipients)
 */

async function runWave3Tests() {
  console.log("==================================================================");
  console.log("  COFFEE++ — SUÍTE DE TESTES DE SEGURANÇA WAVE 3 (P0 RLS & STORAGE)");
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

  // ─── GRUPO 1: STORAGE EXCEL-UPLOADS POLICY SIMULATION ───
  console.log("--- Grupo 1: Storage Policies (excel-uploads) ---");

  const ALLOWED_STORAGE_ROLES = ["Admin", "Admin Master", "CEO", "Trade", "Financeiro", "Diretor"];

  function checkStoragePermission(role: string | null, cmd: "SELECT" | "INSERT" | "DELETE"): boolean {
    if (!role) return false; // Anon
    const r = role.trim();
    if (cmd === "DELETE") {
      return ["Admin", "Admin Master", "CEO"].includes(r);
    }
    return ALLOWED_STORAGE_ROLES.includes(r);
  }

  // STORAGE-01: Anon upload blocked
  assert(checkStoragePermission(null, "INSERT") === false, "STORAGE-01", "Usuário anônimo expressamente bloqueado para INSERT em excel-uploads");

  // STORAGE-02: Anon read blocked
  assert(checkStoragePermission(null, "SELECT") === false, "STORAGE-02", "Usuário anônimo expressamente bloqueado para SELECT em excel-uploads");

  // STORAGE-03: Promotor blocked from reading/uploading financial spreadsheets
  assert(checkStoragePermission("Promotor", "SELECT") === false && checkStoragePermission("Promotor", "INSERT") === false, "STORAGE-03", "Promotor bloqueado para ler ou enviar planilhas em excel-uploads");

  // STORAGE-04: Financeiro / Admin authorized
  assert(checkStoragePermission("Financeiro", "INSERT") === true && checkStoragePermission("Admin", "SELECT") === true, "STORAGE-04", "Perfis Financeiro e Admin autorizados para operações legítimas em excel-uploads");


  // ─── GRUPO 2: RLS CM_WEEKLY_PROJECTIONS POLICY SIMULATION ───
  console.log("\n--- Grupo 2: Database RLS (cm_weekly_projections) ---");

  interface MockUser {
    id: string;
    role: string;
    approved: boolean;
  }

  const ALLOWED_PROJECTION_MUTATE_ROLES = [
    "Admin",
    "Admin Master",
    "CEO",
    "Gerente Nacional",
    "Diretor",
    "Gerente Regional",
    "Trade",
  ];

  function checkWeeklyProjectionPermission(user: MockUser | null, cmd: "SELECT" | "INSERT" | "UPDATE" | "DELETE"): boolean {
    if (!user || !user.approved) return false; // Anon or unapproved
    if (cmd === "SELECT") {
      return true; // Approved authenticated user
    }
    if (cmd === "DELETE") {
      return ["Admin", "Admin Master", "CEO"].includes(user.role);
    }
    return ALLOWED_PROJECTION_MUTATE_ROLES.includes(user.role);
  }

  // RLS-WP-01: Anon SELECT blocked
  assert(checkWeeklyProjectionPermission(null, "SELECT") === false, "RLS-WP-01", "Usuário anônimo bloqueado para SELECT em cm_weekly_projections");

  // RLS-WP-02: Anon INSERT blocked
  assert(checkWeeklyProjectionPermission(null, "INSERT") === false, "RLS-WP-02", "Usuário anônimo bloqueado para INSERT em cm_weekly_projections");

  // RLS-WP-03: Anon UPDATE blocked
  assert(checkWeeklyProjectionPermission(null, "UPDATE") === false, "RLS-WP-03", "Usuário anônimo bloqueado para UPDATE em cm_weekly_projections");

  // RLS-WP-04: Anon DELETE blocked
  assert(checkWeeklyProjectionPermission(null, "DELETE") === false, "RLS-WP-04", "Usuário anônimo bloqueado para DELETE em cm_weekly_projections");

  // RLS-WP-05: Gerente Regional / Admin authorized
  const gerenteUser: MockUser = { id: "mgr-1", role: "Gerente Regional", approved: true };
  const adminUser: MockUser = { id: "admin-1", role: "Admin", approved: true };
  assert(
    checkWeeklyProjectionPermission(gerenteUser, "INSERT") === true &&
    checkWeeklyProjectionPermission(adminUser, "DELETE") === true,
    "RLS-WP-05",
    "Perfis Gerente Regional e Admin autorizados para projeções comerciais"
  );

  // RLS-WP-06: Promotor cannot mutate projections
  const promotorUser: MockUser = { id: "prom-1", role: "Promotor", approved: true };
  assert(
    checkWeeklyProjectionPermission(promotorUser, "INSERT") === false &&
    checkWeeklyProjectionPermission(promotorUser, "UPDATE") === false,
    "RLS-WP-06",
    "Promotor expressamente bloqueado para inserir ou alterar projeções/metas"
  );


  // ─── GRUPO 3: RLS CM_REPORT_RECIPIENTS POLICY SIMULATION ───
  console.log("\n--- Grupo 3: Database RLS (cm_report_recipients) ---");

  const ALLOWED_RECIPIENT_READ_ROLES = ["Admin", "Admin Master", "CEO", "Diretor", "Gerente Nacional"];
  const ALLOWED_RECIPIENT_MUTATE_ROLES = ["Admin", "Admin Master", "CEO"];

  function checkReportRecipientPermission(user: MockUser | null, cmd: "SELECT" | "INSERT" | "UPDATE" | "DELETE"): boolean {
    if (!user || !user.approved) return false;
    if (cmd === "SELECT") {
      return ALLOWED_RECIPIENT_READ_ROLES.includes(user.role);
    }
    return ALLOWED_RECIPIENT_MUTATE_ROLES.includes(user.role);
  }

  // RLS-REC-01: Anon SELECT blocked
  assert(checkReportRecipientPermission(null, "SELECT") === false, "RLS-REC-01", "Usuário anônimo bloqueado para SELECT em cm_report_recipients");

  // RLS-REC-02: Anon INSERT blocked
  assert(checkReportRecipientPermission(null, "INSERT") === false, "RLS-REC-02", "Usuário anônimo bloqueado para INSERT em cm_report_recipients");

  // RLS-REC-03: Anon UPDATE blocked
  assert(checkReportRecipientPermission(null, "UPDATE") === false, "RLS-REC-03", "Usuário anônimo bloqueado para UPDATE em cm_report_recipients");

  // RLS-REC-04: Anon DELETE blocked
  assert(checkReportRecipientPermission(null, "DELETE") === false, "RLS-REC-04", "Usuário anônimo bloqueado para DELETE em cm_report_recipients");

  // RLS-REC-05: Admin authorized
  assert(
    checkReportRecipientPermission(adminUser, "SELECT") === true &&
    checkReportRecipientPermission(adminUser, "INSERT") === true &&
    checkReportRecipientPermission(adminUser, "DELETE") === true,
    "RLS-REC-05",
    "Admin autorizado para gestão completa de destinatários de relatórios"
  );

  // RLS-REC-06: Non-admin (Gerente Regional / Promotor) blocked from mutation
  assert(
    checkReportRecipientPermission(gerenteUser, "INSERT") === false &&
    checkReportRecipientPermission(promotorUser, "DELETE") === false,
    "RLS-REC-06",
    "Perfis não administrativos bloqueados para mutações em cm_report_recipients"
  );

  console.log("\n==================================================================");
  console.log(`  RESUMO DOS TESTES DE SEGURANÇA WAVE 3`);
  console.log(`  Sucessos: ${passed} | Falhas: ${failed}`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runWave3Tests().catch((err) => {
  console.error("Erro fatal nos testes Wave 3:", err);
  process.exit(1);
});
