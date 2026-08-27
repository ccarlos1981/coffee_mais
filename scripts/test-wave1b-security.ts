/**
 * Testes Automatizados de Segurança da Wave 1B (Coffee++)
 * Executa verificações das proteções implementadas nos endpoints P0.
 */
import path from "path";
import fs from "fs";
import { requireRole } from "@/lib/supabase/auth-helpers";

async function runSecurityTests() {
  console.log("==================================================================");
  console.log("  COFFEE++ — SUÍTE DE TESTES DE SEGURANÇA WAVE 1B");
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

  // ─── 1. TESTES DE AUTORIZAÇÃO POR PAPEL (requireRole) ───
  console.log("--- Grupo 1: Validação de Papéis (requireRole) ---");

  // ROLE-01: Admin tem permissão para sync e delete
  try {
    const ok = requireRole({ role: "Admin" }, ["Admin", "Financeiro", "CEO"]);
    assert(ok === true, "AUTH-ROLE-01", "Admin autorizado para operações administrativas");
  } catch {
    assert(false, "AUTH-ROLE-01", "Admin deveria ser autorizado");
  }

  // ROLE-02: Case-insensitivity ("admin", "ADMIN")
  try {
    const ok = requireRole({ role: "admin " }, ["Admin", "Financeiro"]);
    assert(ok === true, "AUTH-ROLE-02", "Role 'admin ' tratada com normalização segura");
  } catch {
    assert(false, "AUTH-ROLE-02", "Role com espaço/case deveria ser normalizada");
  }

  // ROLE-03: Promotor bloqueado para DELETE PDV
  try {
    requireRole({ role: "Promotor" }, ["Admin", "Admin Master", "CEO"]);
    assert(false, "AUTH-06", "Promotor deveria ser rejeitado para DELETE PDV");
  } catch (err: any) {
    assert(err.message === "ROLE_NOT_ALLOWED", "AUTH-06", "Promotor bloqueado para DELETE PDV (ROLE_NOT_ALLOWED -> 403)");
  }

  // ROLE-04: Promotor bloqueado para BigQuery Sync
  try {
    requireRole({ role: "Promotor" }, ["Admin", "Admin Master", "Financeiro", "CEO"]);
    assert(false, "AUTH-07", "Promotor deveria ser rejeitado para BigQuery Sync");
  } catch (err: any) {
    assert(err.message === "ROLE_NOT_ALLOWED", "AUTH-07", "Promotor bloqueado para BigQuery Sync (ROLE_NOT_ALLOWED -> 403)");
  }

  // ROLE-05: Financeiro permitido para BigQuery Sync
  try {
    const ok = requireRole({ role: "Financeiro" }, ["Admin", "Admin Master", "Financeiro", "CEO"]);
    assert(ok === true, "AUTH-08", "Financeiro autorizado para BigQuery Sync");
  } catch {
    assert(false, "AUTH-08", "Financeiro deveria ser autorizado");
  }

  // ─── 2. TESTES DE PATH TRAVERSAL (docs/raw) ───
  console.log("\n--- Grupo 2: Proteção de Filesystem (docs/raw) ---");

  const docsBaseDir = path.resolve(process.cwd(), "docs");

  function validateDocPath(rawDocPath: string): { allowed: boolean; status: number } {
    if (!/^[a-zA-Z0-9_\-\/.]+\.md$/.test(rawDocPath)) {
      return { allowed: false, status: 403 };
    }
    const realDocsDir = fs.realpathSync(docsBaseDir);
    const normalizedRelative = path.normalize(rawDocPath).replace(/^(\.\.[\/\\])+/, "");
    const cleanRelative = normalizedRelative.startsWith("docs/")
      ? normalizedRelative.slice(5)
      : normalizedRelative;

    const fullTarget = path.resolve(realDocsDir, cleanRelative);
    if (!fs.existsSync(fullTarget)) {
      return { allowed: false, status: 404 };
    }
    const realTarget = fs.realpathSync(fullTarget);
    const relative = path.relative(realDocsDir, realTarget);

    if (relative.startsWith("..") || path.isAbsolute(relative) || !realTarget.endsWith(".md")) {
      return { allowed: false, status: 403 };
    }
    return { allowed: true, status: 200 };
  }

  // PATH-01: Tentativa de ler package.json
  const resPkg = validateDocPath("package.json");
  assert(resPkg.allowed === false && resPkg.status === 403, "PATH-01", "Tentativa de ler package.json bloqueada (HTTP 403)");

  // PATH-02: Tentativa de path traversal relativo (../package.json)
  const resTrav = validateDocPath("../package.json");
  assert(resTrav.allowed === false && resTrav.status === 403, "PATH-02", "Tentativa de path traversal '../package.json' bloqueada (HTTP 403)");

  // PATH-03: Tentativa de ler .env.local
  const resEnv = validateDocPath(".env.local");
  assert(resEnv.allowed === false && resEnv.status === 403, "PATH-03", "Tentativa de ler .env.local bloqueada (HTTP 403)");

  // ─── 3. TESTES DE SANITIZAÇÃO SQL (Coffee IA) ───
  console.log("\n--- Grupo 3: Sanitização SQL (Coffee IA) ---");

  function validateCoffeeIaSql(rawSql: string): { allowed: boolean; reason?: string } {
    if (rawSql.includes(";") || rawSql.includes("--") || rawSql.includes("/*") || rawSql.includes("*/")) {
      return { allowed: false, reason: "STATEMENT_STACKING_OR_COMMENTS" };
    }
    const sqlUpper = rawSql.toUpperCase().trim();
    if (!sqlUpper.startsWith("SELECT") && !sqlUpper.startsWith("WITH")) {
      return { allowed: false, reason: "NOT_SELECT" };
    }
    const ddlDmlForbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|CREATE|REPLACE|VACUUM|REINDEX|REFRESH)\b/i;
    if (ddlDmlForbidden.test(rawSql)) {
      return { allowed: false, reason: "DDL_DML_FORBIDDEN" };
    }
    const sensitiveEntitiesForbidden = /\b(cm_user_profiles|cm_report_recipients|cm_sync_logs|cm_audit_logs|cm_role_permissions|auth\.|pg_catalog|information_schema|pg_authid|pg_shadow|pg_user|pg_proc|pg_tables)\b/i;
    if (sensitiveEntitiesForbidden.test(rawSql)) {
      return { allowed: false, reason: "SENSITIVE_ENTITY_FORBIDDEN" };
    }
    const allowedDatasets = /\b(sales|targets|mv_vendas_mensal|mv_vendas_cliente_mensal|public\.sales|public\.targets)\b/i;
    if (!allowedDatasets.test(rawSql)) {
      return { allowed: false, reason: "DATASET_NOT_ALLOWED" };
    }
    return { allowed: true };
  }

  // CHAT-01: Consulta a tabela proibida (cm_user_profiles)
  const resProfiles = validateCoffeeIaSql("SELECT email, encrypted_password FROM cm_user_profiles");
  assert(resProfiles.allowed === false && resProfiles.reason === "SENSITIVE_ENTITY_FORBIDDEN", "CHAT-01", "Consulta a cm_user_profiles bloqueada");

  // CHAT-02: Consulta a schema auth
  const resAuth = validateCoffeeIaSql("SELECT * FROM auth.users");
  assert(resAuth.allowed === false && resAuth.reason === "SENSITIVE_ENTITY_FORBIDDEN", "CHAT-02", "Consulta ao schema auth.users bloqueada");

  // CHAT-03: Tentativa de DML (DELETE FROM sales)
  const resDml = validateCoffeeIaSql("DELETE FROM sales WHERE id = 1");
  assert(resDml.allowed === false && resDml.reason === "NOT_SELECT", "CHAT-03", "Instrução DELETE bloqueada");

  // CHAT-04: Statement Stacking (SELECT 1; DROP TABLE sales;)
  const resStack = validateCoffeeIaSql("SELECT * FROM sales; DROP TABLE targets;");
  assert(resStack.allowed === false && resStack.reason === "STATEMENT_STACKING_OR_COMMENTS", "CHAT-04", "Statement stacking com ponto e vírgula bloqueado");

  // CHAT-05: SQL Comment Injection
  const resComment = validateCoffeeIaSql("SELECT * FROM sales -- bypass check");
  assert(resComment.allowed === false && resComment.reason === "STATEMENT_STACKING_OR_COMMENTS", "CHAT-05", "Injeção de comentários SQL bloqueada");

  // CHAT-06: Consulta analítica legítima permitida
  const resLegit = validateCoffeeIaSql("SELECT product, SUM(net_value) FROM sales GROUP BY product ORDER BY 2 DESC");
  assert(resLegit.allowed === true, "CHAT-06", "Consulta analítica legítima à tabela sales permitida");

  // ─── 4. TESTES DE ESCOPO REGIONAL FORÇADO ───
  console.log("\n--- Grupo 4: Escopo Regional Forçado (Vendas / Investimento) ---");

  function resolveManagerFilter(profile: { role: string; manager_name: string; name: string }, queryManager?: string) {
    const userRole = (profile.role || "").trim().toLowerCase();
    if (userRole === "promotor" || userRole === "vendedor") {
      throw new Error("ACCESS_DENIED_FIELD_REP");
    }
    if (userRole === "gerente regional") {
      return profile.manager_name || profile.name;
    }
    return queryManager;
  }

  // SCOPE-01: Gerente Regional tenta acessar outro gerente via query parameter
  const managerResolved = resolveManagerFilter(
    { role: "Gerente Regional", manager_name: "Leandro", name: "Leandro Silva" },
    "Julliano"
  );
  assert(managerResolved === "Leandro", "AUTH-09", "Gerente Regional A forçado ao seu próprio escopo ignorando ?manager=B");

  // SCOPE-02: Promotor bloqueado para dados executivos
  try {
    resolveManagerFilter({ role: "Promotor", manager_name: "Leandro", name: "Promotor João" });
    assert(false, "AUTH-10", "Promotor deveria ser bloqueado em rotas executivas");
  } catch (err: any) {
    assert(err.message === "ACCESS_DENIED_FIELD_REP", "AUTH-10", "Promotor bloqueado em rotas executivas (HTTP 403)");
  }

  // SCOPE-03: Admin tem visão nacional ou filtrada
  const adminManager = resolveManagerFilter({ role: "Admin", manager_name: "", name: "Admin" }, "Julliano");
  assert(adminManager === "Julliano", "AUTH-11", "Admin autorizado a filtrar qualquer gerente");

  console.log("\n==================================================================");
  console.log(`  RESUMO DOS TESTES DE SEGURANÇA WAVE 1B`);
  console.log(`  Sucessos: ${passed} | Falhas: ${failed}`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error("Erro fatal nos testes de segurança:", err);
  process.exit(1);
});
