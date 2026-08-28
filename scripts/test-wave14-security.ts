/**
 * Test Suite: Wave 14 Security Hardening Verification
 * Validates remediation of ACH-W13-01 through ACH-W13-08
 */

import { validateSqlSecurity } from "../src/lib/ai/sql-validator";
import { sanitizeCellForExcel, sanitizeExportData } from "../src/app/api/export/route";
import * as fs from "fs";
import * as path from "path";

let passedCount = 0;
let totalCount = 0;

function assert(description: string, condition: boolean, extraInfo?: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    console.error(`  ❌ [FAIL] ${description} ${extraInfo ? `-> ${extraInfo}` : ""}`);
  }
}

console.log("\n=======================================================");
console.log("🛡️  COFFEE++ — SUÍTE DE TESTES FORENSES DA WAVE 14");
console.log("=======================================================\n");

// ─── 1. W14-AI-PARSER-* (Coffee IA Table Allowlist) ───
console.log("--- 1. W14-AI-PARSER: Coffee IA SQL Allowlist Tests ---");

const t1 = validateSqlSecurity("SELECT * FROM sales");
assert("W14-AI-PARSER-01: Single valid table query passes", t1.valid === true);

const t2 = validateSqlSecurity("SELECT * FROM sales JOIN targets ON sales.id = targets.id");
assert("W14-AI-PARSER-02: Multi-table valid query passes", t2.valid === true);

const t3 = validateSqlSecurity("SELECT * FROM cm_acoes_investimento");
assert("W14-AI-PARSER-03: Unauthorized table in FROM fails", t3.valid === false);

const t4 = validateSqlSecurity("SELECT * FROM sales JOIN cm_acoes_investimento ON 1=1");
assert("W14-AI-PARSER-04: Unauthorized table in JOIN fails", t4.valid === false);

const t5 = validateSqlSecurity("SELECT * FROM sales -- cm_acoes_investimento");
assert("W14-AI-PARSER-05: Comment evasion fails", t5.valid === false);

const t6 = validateSqlSecurity("SELECT * FROM cm_acoes_investimento WHERE 'sales' = 'sales'");
assert("W14-AI-PARSER-06: String literal spoofing fails", t6.valid === false);

const t7 = validateSqlSecurity('SELECT * FROM "cm_acoes_investimento"');
assert("W14-AI-PARSER-07: Quoted identifier fails", t7.valid === false);

const t8 = validateSqlSecurity("SELECT * FROM sales; DROP TABLE sales;");
assert("W14-AI-PARSER-08: Stacking query with semicolon fails", t8.valid === false);

const t9 = validateSqlSecurity("SELECT * FROM cm_user_profiles");
assert("W14-AI-PARSER-09: Sensitive user table query fails", t9.valid === false);

const t10 = validateSqlSecurity("WITH x AS (SELECT * FROM cm_acoes_investimento) SELECT * FROM sales");
assert("W14-AI-PARSER-10: CTE with unauthorized table fails", t10.valid === false);

// ─── 2. W14-FORMULA-* (Spreadsheet Formula Injection Sanitization) ───
console.log("\n--- 2. W14-FORMULA: Spreadsheet Formula Injection Sanitization ---");

const f1 = sanitizeCellForExcel("=SUM(A1:A10)");
assert("W14-FORMULA-01: Formula '=SUM(...)' is escaped", f1 === "'=SUM(A1:A10)");

const f2 = sanitizeCellForExcel("+cmd|' /C calc'!A0");
assert("W14-FORMULA-02: Formula '+cmd|...' is escaped", f2 === "'+cmd|' /C calc'!A0");

const f3 = sanitizeCellForExcel("-2+3+cmd|' /C calc'!A0");
assert("W14-FORMULA-03: String formula '-2+3...' is escaped", f3 === "'-2+3+cmd|' /C calc'!A0");

const f4 = sanitizeCellForExcel("@SUM(B1:B5)");
assert("W14-FORMULA-04: Formula '@SUM(...)' is escaped", f4 === "'@SUM(B1:B5)");

const f5 = sanitizeCellForExcel("\t=1+1");
assert("W14-FORMULA-05: Tab prefix formula is escaped", f5 === "'\t=1+1");

const f6 = sanitizeCellForExcel(-1250.50);
assert("W14-FORMULA-06: Numeric negative value (-1250.50) is NOT escaped", typeof f6 === "number" && f6 === -1250.50);

const f7 = sanitizeCellForExcel(50);
assert("W14-FORMULA-07: Numeric positive value (50) is NOT escaped", typeof f7 === "number" && f7 === 50);

const f8 = sanitizeExportData([
  { id: 1, name: "=cmd|' /C calc'!A0", amount: -500.25, normal: "Café Gourmet" }
]);
assert("W14-FORMULA-08: sanitizeExportData handles complex row object correctly", 
  f8[0].id === 1 && 
  f8[0].name === "'=cmd|' /C calc'!A0" && 
  f8[0].amount === -500.25 && 
  f8[0].normal === "Café Gourmet"
);

// ─── 3. W14-SQL-DEF-* (SECURITY DEFINER Search Path Migration) ───
console.log("\n--- 3. W14-SQL-DEF: SECURITY DEFINER Search Path Migration ---");

const migrationPath = path.join(__dirname, "../supabase/migrations/20260828_wave14_security_definer_search_path.sql");
const migrationExists = fs.existsSync(migrationPath);
assert("W14-SQL-DEF-01: Migration file exists", migrationExists);

if (migrationExists) {
  const content = fs.readFileSync(migrationPath, "utf8");
  const alterLines = content.split("\n").filter(l => l.startsWith("ALTER FUNCTION"));
  assert(`W14-SQL-DEF-02: Migration contains at least 35 ALTER FUNCTION statements (Found: ${alterLines.length})`, alterLines.length >= 35);
  const allHaveSearchPath = alterLines.every(l => l.includes("SET search_path = public, pg_temp;"));
  assert("W14-SQL-DEF-03: All ALTER FUNCTION statements specify 'SET search_path = public, pg_temp;'", allHaveSearchPath);
}

// ─── 4. W14-STATIC-AUDIT-* (Static Code Audit for Security Guards) ───
console.log("\n--- 4. W14-STATIC-AUDIT: Route Handlers Profile Approval & Scoping ---");

function checkFileContains(relPath: string, terms: string[]): boolean {
  const fullPath = path.join(__dirname, "..", relPath);
  if (!fs.existsSync(fullPath)) return false;
  const content = fs.readFileSync(fullPath, "utf8");
  return terms.every(t => content.includes(t));
}

assert(
  "W14-STATIC-01: src/lib/governance/auth.ts checks profile.approved === true",
  checkFileContains("src/lib/governance/auth.ts", ["!profile.approved"])
);

assert(
  "W14-STATIC-02: src/app/api/atendimento/import/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/atendimento/import/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-03: src/app/api/supervisor/order-kpis/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/supervisor/order-kpis/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-04: src/app/api/admin/ai-governance/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/admin/ai-governance/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-05: src/app/api/admin/kpi-config/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/admin/kpi-config/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-06: src/app/api/promotor/agenda/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/promotor/agenda/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-07: src/app/api/processos/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/processos/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-08: src/app/api/processos/[id]/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/processos/[id]/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-09: src/app/api/processos/import/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/processos/import/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-10: src/app/api/trade/boletos/importar/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/trade/boletos/importar/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-11: src/app/api/audit-network/route.ts uses requireApprovedProfile",
  checkFileContains("src/app/api/audit-network/route.ts", ["requireApprovedProfile"])
);

assert(
  "W14-STATIC-12: src/app/api/ranking-gerentes/[managerId]/route.ts enforces resolveCanonicalManager",
  checkFileContains("src/app/api/ranking-gerentes/[managerId]/route.ts", ["resolveCanonicalManager", "requireApprovedProfile"])
);

assert(
  "W14-STATIC-13: src/app/api/gente-gestao/ferias/route.ts enforces userDisplayName scoping",
  checkFileContains("src/app/api/gente-gestao/ferias/route.ts", ["requireApprovedProfile", "employee_name', userDisplayName"])
);

assert(
  "W14-STATIC-14: src/app/api/presidencia/route.ts enforces EXECUTIVE_ROLES",
  checkFileContains("src/app/api/presidencia/route.ts", ["EXECUTIVE_ROLES", "requireRole"])
);

// ─── FINAL SUMMARY ───
console.log("\n=======================================================");
console.log(`📊 RESULTADO DA SUÍTE DE TESTES WAVE 14: ${passedCount} / ${totalCount} APROVADOS`);
console.log("=======================================================\n");

if (passedCount === totalCount) {
  console.log("🟢 TODOS OS TESTES DA WAVE 14 PASSARAM COM SUCESSO!\n");
  process.exit(0);
} else {
  console.error("🔴 ALGUNS TESTES FALHARAM. VERIFIQUE OS LOGS.\n");
  process.exit(1);
}
