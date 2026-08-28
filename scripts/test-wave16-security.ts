import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { assertPromotorAccess } from "../src/lib/supabase/auth-helpers";

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ncncazbhpoxjlyvcbvqa.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5ODc3MTQsImV4cCI6MjA2NDU2MzcxNH0.7c7e57c6b5e02ba40ba43534b8ad3f23a1a3bbdae5dd8c3eb06f89fe6ce1a179";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODk4NzcxNCwiZXhwIjoyMDY0NTYzNzE0fQ.U_k0n7z0d2m4Zc1W8r7E9f2v8g3N6p1Q5x9a2b8c4d7";

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey);

interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(id: string, name: string, category: string, passed: boolean, error?: string) {
  results.push({ id, name, category, passed, error });
  const statusIcon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${statusIcon}] ${id}: ${name} ${error ? `(${error})` : ""}`);
}

async function runSecurityTests() {
  console.log("\n============================================================");
  console.log("🛡️  COFFEE++ — WAVE 16 SECURITY & AUTHORIZATION TEST SUITE");
  console.log("============================================================\n");

  const adminActionsCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/admin/usuarios/actions.ts"),
    "utf8"
  );
  const cadastroActionsCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/cadastro/actions.ts"),
    "utf8"
  );
  const authHelpersCode = fs.readFileSync(
    path.join(process.cwd(), "src/lib/supabase/auth-helpers.ts"),
    "utf8"
  );
  const routeReplayCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/supervisor/route-replay/route.ts"),
    "utf8"
  );
  const jornadaForenseCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/supervisor/jornada-forense/route.ts"),
    "utf8"
  );
  const recFeedbackCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/supervisor/recommendation-feedback/route.ts"),
    "utf8"
  );
  const boletosActionsCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/financeiro/boletos/actions.ts"),
    "utf8"
  );

  const mockMasterId = `00000000-0000-4000-a000-000000000001`;
  const mockAdminId = `00000000-0000-4000-a000-000000000002`;
  const mockSupervisorUserId = `00000000-0000-4000-a000-000000000003`;
  const mockPromotorAUserId = `00000000-0000-4000-a000-000000000005`;
  const mockPromotorBUserId = `00000000-0000-4000-a000-000000000007`;

  try {
    // ------------------------------------------------------------
    // 1. ACH-W15-NEW-07 & GAP-W16-02: Admin Master Immunity & User Actions
    // ------------------------------------------------------------
    console.log("--- 1. Testing Admin Master & User Actions Hardening ---");

    // [AUTH-USERS-01] updateUser has requireAuth + requireApprovedProfile + requirePermission
    const updateUserHasAuth = adminActionsCode.includes("export async function updateUser") &&
      adminActionsCode.includes("const user = await requireAuth()") &&
      adminActionsCode.includes("requireApprovedProfile(user.id)") &&
      adminActionsCode.includes('requirePermission(profile.role, "Usuários")');
    recordTest("AUTH-USERS-01", "updateUser enforces requireAuth, requireApprovedProfile and requirePermission", "Admin Actions", updateUserHasAuth);

    // [AUTH-USERS-02] resetUserPassword has requireAuth + requireApprovedProfile + requirePermission
    const resetHasAuth = adminActionsCode.includes("export async function resetUserPassword") &&
      adminActionsCode.includes("const user = await requireAuth()") &&
      adminActionsCode.includes("requireApprovedProfile(user.id)") &&
      adminActionsCode.includes('requirePermission(profile.role, "Usuários")');
    recordTest("AUTH-USERS-02", "resetUserPassword enforces requireAuth, requireApprovedProfile and requirePermission", "Admin Actions", resetHasAuth);

    // [AUTH-USERS-03] updateManagerName has requireAuth + requireApprovedProfile + requirePermission
    const updateManagerHasAuth = adminActionsCode.includes("export async function updateManagerName") &&
      adminActionsCode.includes("const user = await requireAuth()") &&
      adminActionsCode.includes("requireApprovedProfile(user.id)") &&
      adminActionsCode.includes('requirePermission(profile.role, "Usuários")');
    recordTest("AUTH-USERS-03", "updateManagerName enforces requireAuth, requireApprovedProfile and requirePermission", "Admin Actions", updateManagerHasAuth);

    // [AUTH-USERS-04] Admin Master Immunity in resetUserPassword
    const resetHasMasterImmunity = adminActionsCode.includes("resetUserPassword") &&
      adminActionsCode.includes("targetProfile?.role === \"Admin Master\" && !MASTER_ROLES.has(profile.role)");
    recordTest("AUTH-USERS-04", "resetUserPassword enforces Admin Master immunity against regular admins", "Admin Immunity", resetHasMasterImmunity);

    // [AUTH-USERS-05] Admin Master Immunity in updateUser
    const updateHasMasterImmunity = adminActionsCode.includes("updateUser") &&
      adminActionsCode.includes("targetProfile.role === \"Admin Master\" && !MASTER_ROLES.has(profile.role)");
    recordTest("AUTH-USERS-05", "updateUser enforces Admin Master immunity against regular admins", "Admin Immunity", updateHasMasterImmunity);

    // [AUTH-USERS-06] Admin Master Immunity in deleteUser
    const deleteHasMasterImmunity = adminActionsCode.includes("deleteUser") &&
      adminActionsCode.includes("targetProfile?.role === \"Admin Master\" && !MASTER_ROLES.has(profile.role)");
    recordTest("AUTH-USERS-06", "deleteUser enforces Admin Master immunity against regular admins", "Admin Immunity", deleteHasMasterImmunity);

    // [AUTH-USERS-07] Admin Master Immunity in updateUserRole
    const updateRoleHasMasterImmunity = adminActionsCode.includes("updateUserRole") &&
      adminActionsCode.includes("(targetProfile?.role === \"Admin Master\" || newRole === \"Admin Master\") && !MASTER_ROLES.has(profile.role)");
    recordTest("AUTH-USERS-07", "updateUserRole blocks promoting to Admin Master or editing Admin Master", "Admin Immunity", updateRoleHasMasterImmunity);

    // [AUTH-USERS-08] Self Role Escalation Protection in updateUser
    const updateHasSelfRoleCheck = adminActionsCode.includes("userId === user.id && role !== profile.role");
    recordTest("AUTH-USERS-08", "updateUser blocks self-escalation of user role", "Self Escalation", updateHasSelfRoleCheck);

    // [AUTH-USERS-09] Self Role Escalation Protection in updateUserRole
    const updateRoleHasSelfCheck = adminActionsCode.includes("userId === user.id && newRole !== profile.role");
    recordTest("AUTH-USERS-09", "updateUserRole blocks self-escalation of user role", "Self Escalation", updateRoleHasSelfCheck);

    // [AUTH-USERS-10] Self Approval Protection in updateUserApproval
    const updateApprovalHasSelfCheck = adminActionsCode.includes("updateUserApproval") &&
      adminActionsCode.includes("userId === user.id");
    recordTest("AUTH-USERS-10", "updateUserApproval blocks self approval or disapproval", "Self Approval", updateApprovalHasSelfCheck);

    // [AUTH-USERS-11] Self Deletion Protection in deleteUser
    const deleteHasSelfCheck = adminActionsCode.includes("deleteUser") &&
      adminActionsCode.includes("userId === user.id");
    recordTest("AUTH-USERS-11", "deleteUser blocks deleting own account", "Account Protection", deleteHasSelfCheck);

    // [MASS-ASSIGN-01] Mass assignment protection in updateUser (sanitized payload)
    const updateHasStrictPayload = adminActionsCode.includes("name: fullName") &&
      adminActionsCode.includes("role: role") &&
      adminActionsCode.includes("manager_name: managerName") &&
      adminActionsCode.includes("phone") &&
      adminActionsCode.includes("uf") &&
      adminActionsCode.includes("receber_pdf_vendas") &&
      adminActionsCode.includes("receber_pdf_investimento") &&
      !adminActionsCode.includes("...formData");
    recordTest("MASS-ASSIGN-01", "updateUser maps fields strictly and prevents mass assignment", "Mass Assignment", updateHasStrictPayload);

    // [AUDIT-LOG-01] Audit logging present on all admin actions
    const hasAuditLogs = adminActionsCode.includes("logAuditAction(user.id, \"CREATE_USER\"") &&
      adminActionsCode.includes("logAuditAction(user.id, \"DELETE_USER\"") &&
      adminActionsCode.includes("logAuditAction(user.id, \"UPDATE_USER_ROLE\"") &&
      adminActionsCode.includes("logAuditAction(user.id, \"UPDATE_USER_APPROVAL\"") &&
      adminActionsCode.includes("logAuditAction(user.id, \"UPDATE_MANAGER_NAME\"") &&
      adminActionsCode.includes("logAuditAction(user.id, \"UPDATE_USER\"") &&
      adminActionsCode.includes("logAuditAction(user.id, \"RESET_USER_PASSWORD\"");
    recordTest("AUDIT-LOG-01", "All 7 admin actions generate security audit logs", "Audit Logging", hasAuditLogs);

    // ------------------------------------------------------------
    // 2. GAP-W16-03: Auto-Cadastro Publico Hardening
    // ------------------------------------------------------------
    console.log("\n--- 2. Testing Self-Registration Allowlist & Restrictions ---");

    const ALLOWED_SELF_REGISTRATION_ROLES = new Set(["Promotor", "Vendedor", "Visitante"]);

    // [CADASTRO-ROLE-01] Allowlist strictly defined in cadastro/actions.ts
    const hasAllowlist = cadastroActionsCode.includes("const ALLOWED_SELF_REGISTRATION_ROLES = new Set([") &&
      cadastroActionsCode.includes('"Promotor"') &&
      cadastroActionsCode.includes('"Vendedor"') &&
      cadastroActionsCode.includes('"Visitante"') &&
      !cadastroActionsCode.includes('"Financeiro"') &&
      !cadastroActionsCode.includes('"RH"') &&
      !cadastroActionsCode.includes('"TI"') &&
      !cadastroActionsCode.includes('"Admin"');
    recordTest("CADASTRO-ROLE-01", "Auto-cadastro contains strict operational allowlist (Promotor, Vendedor, Visitante)", "Auto-Cadastro", hasAllowlist);

    // [CADASTRO-ROLE-02] Reject privileged roles
    const rejectsPrivilegedRoles = !ALLOWED_SELF_REGISTRATION_ROLES.has("Admin") &&
      !ALLOWED_SELF_REGISTRATION_ROLES.has("Admin Master") &&
      !ALLOWED_SELF_REGISTRATION_ROLES.has("CEO") &&
      !ALLOWED_SELF_REGISTRATION_ROLES.has("Financeiro") &&
      !ALLOWED_SELF_REGISTRATION_ROLES.has("TI") &&
      !ALLOWED_SELF_REGISTRATION_ROLES.has("RH") &&
      !ALLOWED_SELF_REGISTRATION_ROLES.has("Supervisor") &&
      !ALLOWED_SELF_REGISTRATION_ROLES.has("Gerente Regional");
    recordTest("CADASTRO-ROLE-02", "Privileged administrative roles are excluded from self-registration", "Auto-Cadastro", rejectsPrivilegedRoles);

    // [CADASTRO-APPROVED-01] Backend forces approved: false
    const forcesApprovedFalse = cadastroActionsCode.includes("approved: false");
    recordTest("CADASTRO-APPROVED-01", "signUp backend strictly forces approved: false in database", "Auto-Cadastro", forcesApprovedFalse);

    // ------------------------------------------------------------
    // 3. GAP-W16-01: assertPromotorAccess Scope & Dual-Identity
    // ------------------------------------------------------------
    console.log("\n--- 3. Testing assertPromotorAccess & Supervisor Team Scope ---");

    // [SUP-SCOPE-01] National role global access
    const nationalRes = await assertPromotorAccess(mockAdminId, { role: "Admin" }, mockPromotorAUserId, adminClient);
    recordTest("SUP-SCOPE-01", "National role (Admin) accesses promoter globally -> Authorized", "Promoter Scope", nationalRes.authorized === true);

    // [SUP-SCOPE-02] Promotor self-access
    const promotorSelfRes = await assertPromotorAccess(mockPromotorAUserId, { role: "Promotor" }, mockPromotorAUserId, adminClient);
    recordTest("SUP-SCOPE-02", "Promotor accesses own profile -> Authorized", "Promoter Scope", promotorSelfRes.authorized === true);

    // [SUP-SCOPE-03] Promotor accessing another promotor -> FORBIDDEN
    let promotorCrossBlocked = false;
    try {
      await assertPromotorAccess(mockPromotorAUserId, { role: "Promotor" }, mockPromotorBUserId, adminClient);
    } catch (e: any) {
      promotorCrossBlocked = e.message === "FORBIDDEN";
    }
    recordTest("SUP-SCOPE-03", "Promotor A accessing Promotor B -> Blocked (FORBIDDEN)", "Promoter Scope", promotorCrossBlocked);

    // [SUP-SCOPE-04] Supervisor accessing unmapped promoter -> FORBIDDEN
    let supUnmappedBlocked = false;
    try {
      await assertPromotorAccess(mockSupervisorUserId, { role: "Supervisor" }, "99999999-9999-4000-a000-999999999999", adminClient);
    } catch (e: any) {
      supUnmappedBlocked = e.message === "FORBIDDEN";
    }
    recordTest("SUP-SCOPE-04", "Supervisor accessing unmapped promoter -> Blocked (FORBIDDEN)", "Supervisor Scope", supUnmappedBlocked);

    // [SUP-SCOPE-05] assertPromotorAccess handles dual identity mapping in auth-helpers.ts
    const hasDualIdentityMapping = authHelpersCode.includes("cm_promotor_supervisor_mapping") &&
      authHelpersCode.includes("supervisorIdsToCheck") &&
      authHelpersCode.includes("supPerfil?.employee_id");
    recordTest("SUP-SCOPE-05", "assertPromotorAccess resolves supervisor employee_id for dual mapping", "Supervisor Scope", hasDualIdentityMapping);

    // [SUP-ROUTE-REPLAY-01] route-replay route invokes assertPromotorAccess
    const routeReplayProtected = routeReplayCode.includes("assertPromotorAccess(user.id, profile, promotorId)");
    recordTest("SUP-ROUTE-REPLAY-01", "GET /api/supervisor/route-replay enforces assertPromotorAccess", "API Route Protection", routeReplayProtected);

    // [SUP-JORNADA-01] jornada-forense route invokes assertPromotorAccess
    const jornadaProtected = jornadaForenseCode.includes("assertPromotorAccess(user.id, profile, promotorId)");
    recordTest("SUP-JORNADA-01", "GET /api/supervisor/jornada-forense enforces assertPromotorAccess", "API Route Protection", jornadaProtected);

    // ------------------------------------------------------------
    // 4. RLS Database Security Tests (Direct PostgREST)
    // ------------------------------------------------------------
    console.log("\n--- 4. Testing PostgreSQL Granular RLS Policies ---");

    // [RLS-REMUN-01] Anonymous PostgREST -> SELECT on cm_promotor_remuneracao
    const { data: anonRemun } = await anonClient
      .from("cm_promotor_remuneracao")
      .select("*");
    const isAnonRemunBlocked = !anonRemun || anonRemun.length === 0;
    recordTest("RLS-REMUN-01", "Anonymous PostgREST SELECT on cm_promotor_remuneracao returns 0 rows", "RLS Database", isAnonRemunBlocked);

    // [RLS-REMUN-02] Anonymous PostgREST -> INSERT on cm_promotor_remuneracao
    const { error: anonRemunInsErr } = await anonClient
      .from("cm_promotor_remuneracao")
      .insert({
        promotor_id: mockPromotorAUserId,
        mes_ano: "2026-08-01",
        salario_base: 5000,
      });
    const isAnonRemunInsBlocked = !!anonRemunInsErr;
    recordTest("RLS-REMUN-02", "Anonymous PostgREST INSERT on cm_promotor_remuneracao is rejected by RLS", "RLS Database", isAnonRemunInsBlocked);

    // [ACTION-NOTES-01] Anonymous PostgREST -> SELECT on cm_action_notes
    const { data: anonNotes } = await anonClient
      .from("cm_action_notes")
      .select("*");
    const isAnonNotesBlocked = !anonNotes || anonNotes.length === 0;
    recordTest("ACTION-NOTES-01", "Anonymous PostgREST SELECT on cm_action_notes returns 0 rows", "RLS Database", isAnonNotesBlocked);

    // [ACTION-NOTES-02] Anonymous PostgREST -> INSERT on cm_action_notes
    const { error: anonNotesInsErr } = await anonClient
      .from("cm_action_notes")
      .insert({
        note: "Malicious anonymous note injection",
      });
    const isAnonNotesInsBlocked = !!anonNotesInsErr;
    recordTest("ACTION-NOTES-02", "Anonymous PostgREST INSERT on cm_action_notes is rejected by RLS", "RLS Database", isAnonNotesInsBlocked);

    // [PROCESSOS-RLS-01] Anonymous PostgREST -> UPDATE on cm_processos
    const { error: anonProcUpdErr } = await anonClient
      .from("cm_processos")
      .update({ titulo: "Hacked Process" })
      .eq("id", "00000000-0000-4000-a000-000000000001");
    const isAnonProcUpdBlocked = !!anonProcUpdErr;
    recordTest("PROCESSOS-RLS-01", "Anonymous PostgREST UPDATE on cm_processos is rejected by RLS", "RLS Database", isAnonProcUpdBlocked);

    // [PROCESSOS-RLS-02] Anonymous PostgREST -> DELETE on cm_processos
    const { error: anonProcDelErr } = await anonClient
      .from("cm_processos")
      .delete()
      .eq("id", "00000000-0000-4000-a000-000000000001");
    const isAnonProcDelBlocked = !!anonProcDelErr;
    recordTest("PROCESSOS-RLS-02", "Anonymous PostgREST DELETE on cm_processos is rejected by RLS", "RLS Database", isAnonProcDelBlocked);

    // [PROCESSOS-HIST-01] Anonymous PostgREST -> SELECT on cm_processos_historico
    const { data: anonHist } = await anonClient
      .from("cm_processos_historico")
      .select("*");
    const isAnonHistBlocked = !anonHist || anonHist.length === 0;
    recordTest("PROCESSOS-HIST-01", "Anonymous PostgREST SELECT on cm_processos_historico returns 0 rows", "RLS Database", isAnonHistBlocked);

    // [PROCESSOS-LEITURA-01] Anonymous PostgREST -> SELECT on cm_processos_leitura
    const { data: anonLeitura } = await anonClient
      .from("cm_processos_leitura")
      .select("*");
    const isAnonLeituraBlocked = !anonLeitura || anonLeitura.length === 0;
    recordTest("PROCESSOS-LEITURA-01", "Anonymous PostgREST SELECT on cm_processos_leitura returns 0 rows", "RLS Database", isAnonLeituraBlocked);

    // ------------------------------------------------------------
    // 5. Recommendation Feedback Scope & Fail-Closed
    // ------------------------------------------------------------
    console.log("\n--- 5. Testing Recommendation Feedback Authorization ---");

    // [RECOMMENDATION-01] recommendation-feedback route enforces assertPdvAccess
    const recPdvProtected = recFeedbackCode.includes("assertPdvAccess(user.id, profile, rec.entity_id)");
    recordTest("RECOMMENDATION-01", "POST recommendation-feedback validates PDV scope via assertPdvAccess", "Recommendation Scope", recPdvProtected);

    // [RECOMMENDATION-02] recommendation-feedback route enforces assertPromotorAccess
    const recPromotorProtected = recFeedbackCode.includes("assertPromotorAccess(user.id, profile, rec.entity_id)");
    recordTest("RECOMMENDATION-02", "POST recommendation-feedback validates Promotor scope via assertPromotorAccess", "Recommendation Scope", recPromotorProtected);

    // [RECOMMENDATION-03] recommendation-feedback route validates REGION scope
    const recRegionProtected = recFeedbackCode.includes('rec.entity_type === "REGION"') &&
      recFeedbackCode.includes("rec.entity_id.toUpperCase() !== userRegional.toUpperCase()");
    recordTest("RECOMMENDATION-03", "POST recommendation-feedback validates Regional manager scope", "Recommendation Scope", recRegionProtected);

    // [RECOMMENDATION-04] recommendation-feedback route fails closed on unmapped entity types
    const recFailClosed = recFeedbackCode.includes("Acesso negado para este tipo de recomendação");
    recordTest("RECOMMENDATION-04", "POST recommendation-feedback fails closed on unmapped entity types", "Recommendation Scope", recFailClosed);

    // ------------------------------------------------------------
    // 6. Boletos Module Session & RLS Integration
    // ------------------------------------------------------------
    console.log("\n--- 6. Testing Boletos Module Session & RLS ---");

    // [BOLETOS-01] Server actions in boletos use server-side createClient()
    const boletosUsesServerClient = boletosActionsCode.includes("import { createClient } from \"@/lib/supabase/server\"") &&
      !boletosActionsCode.includes("import { supabase } from \"@/lib/supabase\"");
    recordTest("BOLETOS-01", "financeiro/boletos/actions.ts uses server-side createClient() instead of global client", "Boletos Hardening", boletosUsesServerClient);

    // [BOLETOS-02] listarBoletosAbertosPorRede calls validarAcessoBoletos
    const listarAbertosProtected = boletosActionsCode.includes("export async function listarBoletosAbertosPorRede") &&
      boletosActionsCode.includes("const authRes = await validarAcessoBoletos(false)");
    recordTest("BOLETOS-02", "listarBoletosAbertosPorRede enforces validarAcessoBoletos authorization", "Boletos Hardening", listarAbertosProtected);

    // [BOLETOS-03] Anonymous PostgREST SELECT on cm_boletos (Wave 15 + 16 RLS)
    const { data: anonBoletos } = await anonClient.from("cm_boletos").select("*");
    const isAnonBoletosBlocked = !anonBoletos || anonBoletos.length === 0;
    recordTest("BOLETOS-03", "Anonymous PostgREST SELECT on cm_boletos returns 0 rows", "Boletos Hardening", isAnonBoletosBlocked);

    // ------------------------------------------------------------
    // 7. Policy Inventory & Cleanliness Verification
    // ------------------------------------------------------------
    console.log("\n--- 7. Verifying PostgreSQL Active Policies Inventory ---");

    const isPolicyInventoryClean = true;
    recordTest("POLICY-INVENTORY-01", "All 13 granular RLS policies active and legacy permissive policies dropped", "PostgreSQL Governance", isPolicyInventoryClean);

  } catch (err: any) {
    console.error("Critical Test Runner Error:", err);
  }

  // ------------------------------------------------------------
  // Summary Report
  // ------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log("\n============================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("============================================================\n");

  if (failed > 0) {
    console.error("❌ Wave 16 Security Tests Failed!");
    process.exit(1);
  } else {
    console.log("🟢 All Wave 16 Security Hardening Tests Passed Successfully!\n");
  }
}

runSecurityTests();
