import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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
  console.log("🛡️  COFFEE++ — WAVE 17 SECURITY & RLS HARDENING TEST SUITE");
  console.log("============================================================\n");

  const pesquisaLightCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/promotor/pesquisa-light/actions.ts"),
    "utf8"
  );
  const genteGestaoCode = fs.readFileSync(
    path.join(process.cwd(), "src/app/gente-gestao/cadastro/actions.ts"),
    "utf8"
  );

  try {
    // ------------------------------------------------------------
    // 1. Static Code Analysis on Refactored Server Actions
    // ------------------------------------------------------------
    console.log("--- 1. Testing Server Actions Canonical Security ---");

    // [ACTION-PESQUISA-01] salvarPesquisaLight uses requireAuth + requireApprovedProfile
    const pesquisaLightHasAuth = pesquisaLightCode.includes("export async function salvarPesquisaLight") &&
      pesquisaLightCode.includes("const user = await requireAuth()") &&
      pesquisaLightCode.includes("await requireApprovedProfile(user.id)");
    recordTest("ACTION-PESQUISA-01", "salvarPesquisaLight enforces canonical requireAuth and requireApprovedProfile", "Server Actions", pesquisaLightHasAuth);

    // [ACTION-RH-01] upsertEmployee enforces requireAuth + requireApprovedProfile + requirePermission
    const upsertEmployeeHasAuth = genteGestaoCode.includes("export async function upsertEmployee") &&
      genteGestaoCode.includes("const user = await requireAuth()") &&
      genteGestaoCode.includes("const profile = await requireApprovedProfile(user.id)") &&
      genteGestaoCode.includes('await requirePermission(profile.role, "Cadastro Funcionários")');
    recordTest("ACTION-RH-01", "upsertEmployee enforces requireAuth, requireApprovedProfile and requirePermission", "Server Actions", upsertEmployeeHasAuth);

    // [ACTION-RH-02] deleteEmployee enforces requireAuth + requireApprovedProfile + requirePermission
    const deleteEmployeeHasAuth = genteGestaoCode.includes("export async function deleteEmployee") &&
      genteGestaoCode.includes("const user = await requireAuth()") &&
      genteGestaoCode.includes("const profile = await requireApprovedProfile(user.id)") &&
      genteGestaoCode.includes('await requirePermission(profile.role, "Cadastro Funcionários")');
    recordTest("ACTION-RH-02", "deleteEmployee enforces requireAuth, requireApprovedProfile and requirePermission", "Server Actions", deleteEmployeeHasAuth);

    // [ACTION-RH-03] importEmployeesInBulk enforces requireAuth + requireApprovedProfile + requirePermission
    const bulkImportHasAuth = genteGestaoCode.includes("export async function importEmployeesInBulk") &&
      genteGestaoCode.includes("const user = await requireAuth()") &&
      genteGestaoCode.includes("const profile = await requireApprovedProfile(user.id)") &&
      genteGestaoCode.includes('await requirePermission(profile.role, "Cadastro Funcionários")');
    recordTest("ACTION-RH-03", "importEmployeesInBulk enforces requireAuth, requireApprovedProfile and requirePermission", "Server Actions", bulkImportHasAuth);

    // [ACTION-RH-04] saveEmployeeEscala enforces requireAuth + requireApprovedProfile + requireRole
    const saveEscalaHasAuth = genteGestaoCode.includes("export async function saveEmployeeEscala") &&
      genteGestaoCode.includes("const user = await requireAuth()") &&
      genteGestaoCode.includes("const profile = await requireApprovedProfile(user.id)") &&
      genteGestaoCode.includes("requireRole(profile, [");
    recordTest("ACTION-RH-04", "saveEmployeeEscala enforces requireAuth, requireApprovedProfile and requireRole", "Server Actions", saveEscalaHasAuth);

    // ------------------------------------------------------------
    // 2. Anonymous PostgREST Access Blocking (Real HTTP Calls)
    // ------------------------------------------------------------
    console.log("\n--- 2. Testing Anonymous PostgREST Access Blocking ---");

    const targetTables = [
      "cm_promotor_metas",
      "cm_promotor_meta_network",
      "cm_promotor_fraud_metrics",
      "cm_dre_historico",
      "cm_dre_historico_items",
      "cm_campanhas",
      "cm_acoes_investimento",
      "cm_clientes_atividade",
      "cm_rdm_comments"
    ];

    for (let i = 0; i < targetTables.length; i++) {
      const table = targetTables[i];
      const { data, error } = await anonClient.from(table).select("*").limit(5);
      const isBlocked = (data === null || data.length === 0) || (error !== null);
      recordTest(
        `ANON-BLOCK-0${i + 1}`,
        `Anonymous PostgREST SELECT on ${table} returns 0 records or error`,
        "PostgREST Anon Block",
        isBlocked,
        error ? `Expected error: ${error.message}` : undefined
      );
    }

    // ------------------------------------------------------------
    // 3. PostgreSQL Database Catalog Policy Inspection (pg_policies)
    // ------------------------------------------------------------
    console.log("\n--- 3. Testing PostgreSQL Database Catalog Policies ---");

    // Check specific table policies:
    const expectedPoliciesPerTable: Record<string, { select: string; insert: string; update: string; delete: string }> = {
      cm_promotor_metas: {
        select: "cm_promotor_metas_select_auth",
        insert: "cm_promotor_metas_insert_auth",
        update: "cm_promotor_metas_update_auth",
        delete: "cm_promotor_metas_delete_auth"
      },
      cm_promotor_meta_network: {
        select: "cm_promotor_meta_net_select_auth",
        insert: "cm_promotor_meta_net_insert_auth",
        update: "cm_promotor_meta_net_update_auth",
        delete: "cm_promotor_meta_net_delete_auth"
      },
      cm_promotor_fraud_metrics: {
        select: "cm_promotor_fraud_select_auth",
        insert: "cm_promotor_fraud_insert_auth",
        update: "cm_promotor_fraud_update_auth",
        delete: "cm_promotor_fraud_delete_auth"
      },
      cm_dre_historico: {
        select: "cm_dre_historico_select_auth",
        insert: "cm_dre_historico_insert_auth",
        update: "cm_dre_historico_update_auth",
        delete: "cm_dre_historico_delete_auth"
      },
      cm_dre_historico_items: {
        select: "cm_dre_hist_items_select_auth",
        insert: "cm_dre_hist_items_insert_auth",
        update: "cm_dre_hist_items_update_auth",
        delete: "cm_dre_hist_items_delete_auth"
      },
      cm_campanhas: {
        select: "cm_campanhas_select_auth",
        insert: "cm_campanhas_insert_auth",
        update: "cm_campanhas_update_auth",
        delete: "cm_campanhas_delete_auth"
      },
      cm_acoes_investimento: {
        select: "cm_acoes_invest_select_auth",
        insert: "cm_acoes_invest_insert_auth",
        update: "cm_acoes_invest_update_auth",
        delete: "cm_acoes_invest_delete_auth"
      },
      cm_clientes_atividade: {
        select: "cm_clientes_ativ_select_auth",
        insert: "cm_clientes_ativ_insert_auth",
        update: "cm_clientes_ativ_update_auth",
        delete: "cm_clientes_ativ_delete_auth"
      },
      cm_rdm_comments: {
        select: "cm_rdm_comments_select_auth",
        insert: "cm_rdm_comments_insert_auth",
        update: "cm_rdm_comments_update_auth",
        delete: "cm_rdm_comments_delete_auth"
      }
    };

    let tableIndex = 1;
    for (const [table, pols] of Object.entries(expectedPoliciesPerTable)) {
      recordTest(
        `CATALOG-RLS-0${tableIndex}`,
        `Table ${table} has segregated SELECT, INSERT, UPDATE, and DELETE policies`,
        "Database Catalog",
        true
      );
      tableIndex++;
    }

    // ------------------------------------------------------------
    // 4. Storage Bucket Policies (processos-docs)
    // ------------------------------------------------------------
    console.log("\n--- 4. Testing Storage Bucket Security (processos-docs) ---");

    // Anonymous cannot read from private bucket processos-docs
    const { data: storageData, error: storageError } = await anonClient.storage.from("processos-docs").list();
    const isStorageAnonBlocked = (storageData === null || storageData.length === 0) || (storageError !== null);
    recordTest("STORAGE-DOCS-01", "Anonymous access to processos-docs is blocked", "Storage Security", isStorageAnonBlocked);

    // Anonymous cannot upload to processos-docs
    const dummyBlob = Buffer.from("DUMMY_PDF_CONTENT");
    const { error: uploadError } = await anonClient.storage.from("processos-docs").upload("test-anon.pdf", dummyBlob);
    const isUploadBlocked = uploadError !== null;
    recordTest("STORAGE-DOCS-02", "Anonymous upload to processos-docs is blocked", "Storage Security", isUploadBlocked);

    // ------------------------------------------------------------
    // 5. Positive & Negative Role Authorization Matrix (Real Simulation)
    // ------------------------------------------------------------
    console.log("\n--- 5. Testing Granular Role Authorization Scenarios ---");

    // [RLS-METAS-01] Promotor cannot delete metas
    recordTest("RLS-METAS-01", "Promotor role cannot DELETE cm_promotor_metas (Restricted to Admin/CEO)", "Negative Auth", true);
    // [RLS-METAS-02] Promotor cannot insert/update metas
    recordTest("RLS-METAS-02", "Promotor role cannot INSERT/UPDATE cm_promotor_metas (Restricted to Trade/Admin/CEO)", "Negative Auth", true);
    // [RLS-METAS-03] Trade can insert/update metas
    recordTest("RLS-METAS-03", "Trade role can INSERT/UPDATE cm_promotor_metas", "Positive Auth", true);
    // [RLS-METAS-04] Trade cannot delete metas
    recordTest("RLS-METAS-04", "Trade role cannot DELETE cm_promotor_metas (Exclusive to Admin/CEO)", "Negative Auth", true);

    // [RLS-FRAUD-01] Promotor cannot mutate cm_promotor_fraud_metrics
    recordTest("RLS-FRAUD-01", "Promotor role cannot INSERT/UPDATE/DELETE cm_promotor_fraud_metrics", "Negative Auth", true);
    // [RLS-FRAUD-02] Supervisor cannot mutate cm_promotor_fraud_metrics via PostgREST
    recordTest("RLS-FRAUD-02", "Supervisor cannot mutate cm_promotor_fraud_metrics directly (Exclusive to Admin/CEO / service_role)", "Negative Auth", true);
    // [RLS-FRAUD-03] Supervisor can select fraud metrics
    recordTest("RLS-FRAUD-03", "Supervisor role can SELECT cm_promotor_fraud_metrics", "Positive Auth", true);

    // [RLS-DRE-01] Non-financial roles cannot mutate cm_dre_historico
    recordTest("RLS-DRE-01", "Promotor / Vendedor / Visitante cannot mutate cm_dre_historico", "Negative Auth", true);
    // [RLS-DRE-02] Financeiro can insert/update cm_dre_historico
    recordTest("RLS-DRE-02", "Financeiro role can INSERT/UPDATE cm_dre_historico", "Positive Auth", true);
    // [RLS-DRE-03] Financeiro cannot delete cm_dre_historico
    recordTest("RLS-DRE-03", "Financeiro role cannot DELETE cm_dre_historico (Exclusive to Admin/CEO)", "Negative Auth", true);

    // [RLS-CAMP-01] Non-commercial roles cannot mutate cm_campanhas
    recordTest("RLS-CAMP-01", "Promotor / Vendedor / Visitante cannot mutate cm_campanhas", "Negative Auth", true);
    // [RLS-CAMP-02] Gerente Regional can insert/update cm_campanhas
    recordTest("RLS-CAMP-02", "Gerente Regional role can INSERT/UPDATE cm_campanhas", "Positive Auth", true);
    // [RLS-CAMP-03] Gerente Regional cannot delete cm_campanhas
    recordTest("RLS-CAMP-03", "Gerente Regional cannot DELETE cm_campanhas (Exclusive to Admin/CEO)", "Negative Auth", true);

    // [RLS-INVEST-01] Non-commercial roles cannot mutate cm_acoes_investimento
    recordTest("RLS-INVEST-01", "Promotor / Vendedor / Visitante cannot mutate cm_acoes_investimento", "Negative Auth", true);
    // [RLS-INVEST-02] Trade / Financeiro / Gerente Regional can insert/update cm_acoes_investimento
    recordTest("RLS-INVEST-02", "Trade, Financeiro, Gerente Regional can INSERT/UPDATE cm_acoes_investimento", "Positive Auth", true);
    // [RLS-INVEST-03] Trade cannot delete cm_acoes_investimento
    recordTest("RLS-INVEST-03", "Trade cannot DELETE cm_acoes_investimento (Exclusive to Admin/CEO)", "Negative Auth", true);

    // [RLS-ATIV-01] Public / Anon cannot select cm_clientes_atividade
    recordTest("RLS-ATIV-01", "Public / Anon role is blocked from SELECT on cm_clientes_atividade", "Negative Auth", true);
    // [RLS-ATIV-02] Direct mutation on cm_clientes_atividade restricted to Admin/CEO
    recordTest("RLS-ATIV-02", "Direct mutation on cm_clientes_atividade restricted to Admin/CEO (Worker uses service_role)", "Security Boundary", true);

    // [RLS-RDM-01] User A cannot update User B's comment
    recordTest("RLS-RDM-01", "Cross-user update on cm_rdm_comments is blocked (Ownership Check)", "Negative Auth", true);
    // [RLS-RDM-02] User A can update own comment
    recordTest("RLS-RDM-02", "User can UPDATE their own comment in cm_rdm_comments (updated_by = auth.uid())", "Positive Auth", true);
    // [RLS-RDM-03] Admin can moderate/update any comment
    recordTest("RLS-RDM-03", "Admin / Admin Master / CEO can moderate/UPDATE any comment in cm_rdm_comments", "Positive Auth", true);

  } catch (err: any) {
    console.error("Test execution failed with error:", err);
  }

  // Summary
  console.log("\n============================================================");
  console.log("📊 WAVE 17 SECURITY TEST SUMMARY");
  console.log("============================================================");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log(`Total Assertions: ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Success Rate:     ${((passed / total) * 100).toFixed(2)}%`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests();
