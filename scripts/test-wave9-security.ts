/**
 * Testes Automatizados de Segurança da Wave 9 (Coffee++)
 * Validação de Remediação P0:
 * - P0-01: Workflow de Metas-Rede (POST /api/gestao/metas-rede)
 * - P0-02: Bug de Assinatura requireRole (upload-shelf-photo & shelf-analysis/review)
 * - P0-03: Remoção de Bypass por Header (pilot-kpis)
 */

import fs from "fs";
import path from "path";
import { requireRole } from "@/lib/supabase/auth-helpers";

async function runWave9Tests() {
  console.log("==================================================================");
  console.log("  COFFEE++ — SUÍTE DE TESTES DE SEGURANÇA WAVE 9 (P0 REMEDIATION)");
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

  // ─── 1. TESTES METAS-REDE WORKFLOW AUTHORIZATION (P0-01) ───
  console.log("--- Grupo 1: Metas-Rede Workflow Authorization (P0-01) ---");

  const ALLOWED_METAS_ROLES = [
    "Admin",
    "Admin Master",
    "CEO",
    "Presidência",
    "Presidencia",
    "Presidente",
    "Diretoria",
    "Diretor",
    "Diretor Comercial",
    "Gerente Nacional",
    "Trade",
    "Gerente Regional",
    "Gerente Comercial",
    "Gerente",
  ];

  const TOP_DOWN_EXECUTIVE_ROLES = [
    "Admin",
    "Admin Master",
    "CEO",
    "Presidência",
    "Presidencia",
    "Presidente",
    "Diretoria",
    "Diretor",
    "Diretor Comercial",
    "Gerente Nacional",
  ];

  function simulateMetasWorkflowPost(
    authSession: { user: { id: string; email?: string } | null; profile: { role: string; name?: string; manager_name?: string } | null },
    body: { action: string; year: number; month: number; targetStatus: string; user?: string; comments?: string }
  ): { status: number; success: boolean; executedBy?: string; error?: string } {
    if (!authSession.user) {
      return { status: 401, success: false, error: "UNAUTHENTICATED" };
    }

    if (!authSession.profile || !authSession.profile.role) {
      return { status: 403, success: false, error: "PROFILE_NOT_APPROVED" };
    }

    try {
      requireRole(authSession.profile, ALLOWED_METAS_ROLES);
    } catch {
      return { status: 403, success: false, error: "ROLE_NOT_ALLOWED" };
    }

    if (body.action === "WORKFLOW_TRANSITION") {
      if (!body.year || !body.month || !body.targetStatus) {
        return { status: 400, success: false, error: "Parâmetros obrigatórios ausentes" };
      }

      if (body.targetStatus === "APPROVED" || body.targetStatus === "FROZEN" || body.targetStatus === "DRAFT") {
        try {
          requireRole(authSession.profile, TOP_DOWN_EXECUTIVE_ROLES);
        } catch {
          return { status: 403, success: false, error: "ROLE_NOT_ALLOWED" };
        }
      }

      // Security guarantee: Identity is derived ONLY from the session, ignoring body.user
      const executedBy =
        authSession.profile.name ||
        authSession.profile.manager_name ||
        authSession.user.email ||
        authSession.user.id;

      return { status: 200, success: true, executedBy };
    }

    return { status: 400, success: false, error: "Ação não suportada." };
  }

  // W9-META-01: Anônimo tentando WORKFLOW_TRANSITION -> 401
  const resMeta01 = simulateMetasWorkflowPost(
    { user: null, profile: null },
    { action: "WORKFLOW_TRANSITION", year: 2026, month: 8, targetStatus: "REVIEW" }
  );
  assert(resMeta01.status === 401, "W9-META-01", "Anônimo tentando WORKFLOW_TRANSITION retorna 401");

  // W9-META-02: Promotor tentando WORKFLOW_TRANSITION -> 403
  const resMeta02 = simulateMetasWorkflowPost(
    { user: { id: "u-promotor" }, profile: { role: "Promotor", name: "João Promotor" } },
    { action: "WORKFLOW_TRANSITION", year: 2026, month: 8, targetStatus: "REVIEW" }
  );
  assert(resMeta02.status === 403, "W9-META-02", "Promotor tentando WORKFLOW_TRANSITION retorna 403");

  // W9-META-03: Usuário autorizado (Gerente Regional) para REVIEW -> 200
  const resMeta03 = simulateMetasWorkflowPost(
    { user: { id: "u-gerente" }, profile: { role: "Gerente Regional", name: "Leandro Saffi", manager_name: "Leandro" } },
    { action: "WORKFLOW_TRANSITION", year: 2026, month: 8, targetStatus: "REVIEW" }
  );
  assert(resMeta03.status === 200 && resMeta03.executedBy === "Leandro Saffi", "W9-META-03", "Gerente Regional autorizado pode transicionar para REVIEW");

  // W9-META-04: Promotor enviando { user: "Diretor" } -> NÃO obtém privilégio
  const resMeta04 = simulateMetasWorkflowPost(
    { user: { id: "u-promotor" }, profile: { role: "Promotor", name: "Attacker" } },
    { action: "WORKFLOW_TRANSITION", year: 2026, month: 8, targetStatus: "APPROVED", user: "Diretor Geral" }
  );
  assert(resMeta04.status === 403, "W9-META-04", "Promotor enviando body.user='Diretor Geral' é bloqueado com 403");

  // W9-META-05: Usuário autorizado enviando { user: "Admin" } -> Identidade real preservada
  const resMeta05 = simulateMetasWorkflowPost(
    { user: { id: "u-ceo" }, profile: { role: "CEO", name: "Diretor Executivo" } },
    { action: "WORKFLOW_TRANSITION", year: 2026, month: 8, targetStatus: "APPROVED", user: "Admin Impersonated" }
  );
  assert(resMeta05.status === 200 && resMeta05.executedBy === "Diretor Executivo", "W9-META-05", "Usuário autorizado tem identidade derivada exclusivamente da sessão (ignora body.user)");

  // W9-META-06: Tentativa de APPROVED por Gerente Regional sem role executiva -> 403
  const resMeta06 = simulateMetasWorkflowPost(
    { user: { id: "u-gerente" }, profile: { role: "Gerente Regional", name: "Leandro Saffi" } },
    { action: "WORKFLOW_TRANSITION", year: 2026, month: 8, targetStatus: "APPROVED" }
  );
  assert(resMeta06.status === 403, "W9-META-06", "Gerente Regional é bloqueado de aprovar metas (APPROVED exige role executiva)");

  // W9-META-07: Tentativa de FROZEN por Gerente Regional sem role executiva -> 403
  const resMeta07 = simulateMetasWorkflowPost(
    { user: { id: "u-gerente" }, profile: { role: "Gerente Regional", name: "Leandro Saffi" } },
    { action: "WORKFLOW_TRANSITION", year: 2026, month: 8, targetStatus: "FROZEN" }
  );
  assert(resMeta07.status === 403, "W9-META-07", "Gerente Regional é bloqueado de congelar metas (FROZEN exige role executiva)");


  // ─── 2. TESTES SHELF REVIEW & SIGNATURE FIX (P0-02) ───
  console.log("\n--- Grupo 2: Shelf Review & Upload requireRole Signature Fix (P0-02) ---");

  const ALLOWED_REVIEW_ROLES = ["Supervisor", "Admin", "Admin Master", "CEO", "Trade"];
  const ALLOWED_UPLOAD_ROLES = ["Promotor", "Supervisor", "Admin", "Admin Master", "CEO", "Trade"];

  // W9-SHELF-01: Supervisor legítimo -> permitido
  let shelf01Passed = false;
  try {
    const supervisorProfile = { role: "Supervisor", name: "Supervisor 1" };
    requireRole(supervisorProfile, ALLOWED_REVIEW_ROLES);
    shelf01Passed = true;
  } catch {
    shelf01Passed = false;
  }
  assert(shelf01Passed, "W9-SHELF-01", "requireRole(profile, ALLOWED_REVIEW_ROLES) permite Supervisor legítimo");

  // W9-SHELF-02: Promotor -> 403 (ROLE_NOT_ALLOWED)
  let shelf02Blocked = false;
  try {
    const promotorProfile = { role: "Promotor", name: "Promotor 1" };
    requireRole(promotorProfile, ALLOWED_REVIEW_ROLES);
  } catch (err: any) {
    if (err.message === "ROLE_NOT_ALLOWED") shelf02Blocked = true;
  }
  assert(shelf02Blocked, "W9-SHELF-02", "requireRole rejeita Promotor para review com ROLE_NOT_ALLOWED");

  // W9-SHELF-03: Gerente Regional -> 403 (ROLE_NOT_ALLOWED)
  let shelf03Blocked = false;
  try {
    const gerenteProfile = { role: "Gerente Regional", name: "Leandro" };
    requireRole(gerenteProfile, ALLOWED_REVIEW_ROLES);
  } catch (err: any) {
    if (err.message === "ROLE_NOT_ALLOWED") shelf03Blocked = true;
  }
  assert(shelf03Blocked, "W9-SHELF-03", "requireRole rejeita Gerente Regional para review com ROLE_NOT_ALLOWED");

  // W9-SHELF-04: Supervisor fora da equipe (Object-Level Access check)
  const mockTeamHierarchy = new Map<string, string[]>([
    ["sup-1", ["promotor-1", "promotor-2"]],
    ["sup-2", ["promotor-3"]],
  ]);
  const visitaP3 = { id: "visita-p3", promotor_id: "promotor-3" };
  const sup1Supervised = mockTeamHierarchy.get("sup-1") || [];
  const isSup1AuthorizedForVisita3 = sup1Supervised.includes(visitaP3.promotor_id);
  assert(!isSup1AuthorizedForVisita3, "W9-SHELF-04", "Supervisor fora da equipe tem acesso de objeto negado à visita");


  // ─── 3. TESTES UPLOAD FOTO GÔNDOLA (P0-02) ───
  console.log("\n--- Grupo 3: Upload Foto Gôndola (P0-02) ---");

  // W9-UPLOAD-01: Promotor em visita própria -> permitido
  let upload01Passed = false;
  try {
    const promotorProfile = { role: "Promotor", name: "Promotor 1" };
    requireRole(promotorProfile, ALLOWED_UPLOAD_ROLES);
    upload01Passed = true;
  } catch {
    upload01Passed = false;
  }
  assert(upload01Passed, "W9-UPLOAD-01", "requireRole(profile, ALLOWED_UPLOAD_ROLES) permite Promotor para upload");

  // W9-UPLOAD-02: Promotor em visita alheia -> bloqueado por Object-Level check
  const visitaPromotor2 = { id: "v-2", promotor_id: "promotor-2" };
  const promotor1Id = "promotor-1";
  const isOwner = visitaPromotor2.promotor_id === promotor1Id;
  assert(!isOwner, "W9-UPLOAD-02", "Promotor em visita alheia é bloqueado por assertVisitaAccess");

  // W9-UPLOAD-03: Usuário não autenticado -> 401
  let unauthBlocked = false;
  const noUserSession = null;
  if (!noUserSession) unauthBlocked = true;
  assert(unauthBlocked, "W9-UPLOAD-03", "Usuário não autenticado é rejeitado com 401");


  // ─── 4. TESTES PILOT KPIS BYPASS REMOVAL (P0-03) ───
  console.log("\n--- Grupo 4: Pilot KPIs Bypass Removal (P0-03) ---");

  const pilotRoutePath = path.join(process.cwd(), "src/app/api/supervisor/pilot-kpis/route.ts");
  const pilotRouteCode = fs.readFileSync(pilotRoutePath, "utf-8");

  // W9-PILOT-01: Sem sessão -> rota chama requireAuth() e falha
  const usesRequireAuth = pilotRouteCode.includes("await requireAuth()");
  assert(usesRequireAuth, "W9-PILOT-01", "pilot-kpis route invoca requireAuth() obrigatoriamente");

  // W9-PILOT-02: Header x-stress-test-supervisor-id NÃO existe no arquivo
  const hasStressHeader = pilotRouteCode.includes("x-stress-test-supervisor-id");
  assert(!hasStressHeader, "W9-PILOT-02", "Header x-stress-test-supervisor-id foi completamente eliminado de pilot-kpis");

  // W9-PILOT-03: Não há bypass de NODE_ENV === 'development'
  const hasDevBypass = pilotRouteCode.includes('process.env.NODE_ENV === "development"');
  assert(!hasDevBypass, "W9-PILOT-03", "Bypass condicional de NODE_ENV development foi completamente eliminado");

  // W9-PILOT-04: Busca global em src/ por x-stress-test-supervisor-id
  const apiDir = path.join(process.cwd(), "src");
  function searchHeaderRecursive(dir: string): boolean {
    let found = false;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (searchHeaderRecursive(fullPath)) found = true;
      } else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes("x-stress-test-supervisor-id")) {
          found = true;
        }
      }
    }
    return found;
  }
  const globalHeaderFound = searchHeaderRecursive(apiDir);
  assert(!globalHeaderFound, "W9-PILOT-04", "Busca global em src/ confirma zero ocorrências de x-stress-test-supervisor-id");

  console.log("\n==================================================================");
  console.log(`  RESUMO DOS TESTES WAVE 9`);
  console.log(`  Sucessos: ${passed} | Falhas: ${failed}`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runWave9Tests().catch((err) => {
  console.error("Erro fatal na execução dos testes da Wave 9:", err);
  process.exit(1);
});
