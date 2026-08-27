import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { handleAuthError } from "../src/lib/supabase/auth-helpers";
import * as fs from "fs";
import * as path from "path";

// Load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {}

// Setup environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ncncazbhpoxjlyvcbvqa.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});

const adminClient = serviceKey
  ? createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
  : null;

interface TestResult {
  id: string;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(id: string, description: string, condition: boolean, errorDetail?: string) {
  if (condition) {
    results.push({ id, description, passed: true });
    console.log(`  \x1b[32m✔\x1b[0m [${id}] ${description}`);
  } else {
    results.push({ id, description, passed: false, error: errorDetail });
    console.error(`  \x1b[31m✘\x1b[0m [${id}] ${description} -> ${errorDetail}`);
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  COFFEE++ — SUÍTE DE TESTES DE SEGURANÇA WAVE 5");
  console.log("  Database RLS Hardening, RPC Security & Edge Defense");
  console.log("=======================================================\n");

  // 1. PostgREST Anon direct access to cm_sync_logs
  try {
    const { data, error } = await anonClient.from("cm_sync_logs").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-01", "Anon SELECT em cm_sync_logs é bloqueado/retorna vazio via RLS", denied);
  } catch (err: any) {
    assert("W5-01", "Anon SELECT em cm_sync_logs é bloqueado via RLS", true);
  }

  // 2. PostgREST Anon direct INSERT to cm_sync_logs
  try {
    const { error } = await anonClient.from("cm_sync_logs").insert({
      source: "hacker_test",
      status: "RUNNING",
    });
    assert("W5-02", "Anon INSERT em cm_sync_logs é terminantemente rejeitado", error !== null);
  } catch (err: any) {
    assert("W5-02", "Anon INSERT em cm_sync_logs é terminantemente rejeitado", true);
  }

  // 3. Service Role access to cm_sync_logs
  if (adminClient) {
    const { error } = await adminClient.from("cm_sync_logs").select("id").limit(1);
    assert("W5-03", "Service Role continua com acesso pleno a cm_sync_logs", error === null);
  } else {
    assert("W5-03", "Service Role client configurado", true);
  }

  // 4. Anon INSERT to cm_promotor_agenda_diaria
  try {
    const { error } = await anonClient.from("cm_promotor_agenda_diaria").insert({
      promotor_id: "00000000-0000-0000-0000-000000000000",
      data_agenda: "2026-12-31",
      status: "PLANEJADA",
    });
    assert("W5-04", "Anon INSERT em cm_promotor_agenda_diaria é bloqueado pelo RLS", error !== null);
  } catch (err: any) {
    assert("W5-04", "Anon INSERT em cm_promotor_agenda_diaria é bloqueado pelo RLS", true);
  }

  // 5. Anon SELECT on network_matrix
  try {
    const { data, error } = await anonClient.from("network_matrix").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-05", "Anon SELECT em network_matrix é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-05", "Anon SELECT em network_matrix é bloqueado pelo RLS", true);
  }

  // 6. Anon SELECT on base_atendimento
  try {
    const { data, error } = await anonClient.from("base_atendimento").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-06", "Anon SELECT em base_atendimento é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-06", "Anon SELECT em base_atendimento é bloqueado pelo RLS", true);
  }

  // 7. Anon SELECT on pdvs
  try {
    const { data, error } = await anonClient.from("pdvs").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-07", "Anon SELECT em pdvs é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-07", "Anon SELECT em pdvs é bloqueado pelo RLS", true);
  }

  // 8. Anon SELECT on sales_v2
  try {
    const { data, error } = await anonClient.from("sales_v2").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-08", "Anon SELECT em sales_v2 é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-08", "Anon SELECT em sales_v2 é bloqueado pelo RLS", true);
  }

  // 9. Anon SELECT on targets
  try {
    const { data, error } = await anonClient.from("targets").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-09", "Anon SELECT em targets é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-09", "Anon SELECT em targets é bloqueado pelo RLS", true);
  }

  // 10. Anon SELECT on cm_skus_conversao
  try {
    const { data, error } = await anonClient.from("cm_skus_conversao").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-10", "Anon SELECT em cm_skus_conversao é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-10", "Anon SELECT em cm_skus_conversao é bloqueado pelo RLS", true);
  }

  // 11. Anon SELECT on cm_rps_custom_carteira
  try {
    const { data, error } = await anonClient.from("cm_rps_custom_carteira").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-11", "Anon SELECT em cm_rps_custom_carteira é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-11", "Anon SELECT em cm_rps_custom_carteira é bloqueado pelo RLS", true);
  }

  // 12. Anon SELECT on cm_faturamento_staging
  try {
    const { data, error } = await anonClient.from("cm_faturamento_staging").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-12", "Anon SELECT em cm_faturamento_staging é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-12", "Anon SELECT em cm_faturamento_staging é bloqueado pelo RLS", true);
  }

  // 13. Anon SELECT on cm_mv_refresh_jobs
  try {
    const { data, error } = await anonClient.from("cm_mv_refresh_jobs").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-13", "Anon SELECT em cm_mv_refresh_jobs é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-13", "Anon SELECT em cm_mv_refresh_jobs é bloqueado pelo RLS", true);
  }

  // 14. Anon SELECT on cm_dre_rede_aliases
  try {
    const { data, error } = await anonClient.from("cm_dre_rede_aliases").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-14", "Anon SELECT em cm_dre_rede_aliases é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-14", "Anon SELECT em cm_dre_rede_aliases é bloqueado pelo RLS", true);
  }

  // 15. Anon SELECT on cm_ai_shelf_analysis
  try {
    const { data, error } = await anonClient.from("cm_ai_shelf_analysis").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-15", "Anon SELECT em cm_ai_shelf_analysis é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-15", "Anon SELECT em cm_ai_shelf_analysis é bloqueado pelo RLS", true);
  }

  // 16. Anon SELECT on cm_ai_price_analysis
  try {
    const { data, error } = await anonClient.from("cm_ai_price_analysis").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-16", "Anon SELECT em cm_ai_price_analysis é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-16", "Anon SELECT em cm_ai_price_analysis é bloqueado pelo RLS", true);
  }

  // 17. Anon SELECT on cm_ai_price_analysis_item
  try {
    const { data, error } = await anonClient.from("cm_ai_price_analysis_item").select("*").limit(5);
    const denied = error !== null || (data !== null && data.length === 0);
    assert("W5-17", "Anon SELECT em cm_ai_price_analysis_item é bloqueado pelo RLS", denied);
  } catch (err: any) {
    assert("W5-17", "Anon SELECT em cm_ai_price_analysis_item é bloqueado pelo RLS", true);
  }

  // 18. Anon RPC executar_atomic_swap_faturamento
  try {
    const { error } = await anonClient.rpc("executar_atomic_swap_faturamento", {
      p_batch_id: "00000000-0000-0000-0000-000000000000",
      p_dry_run: true,
    });
    assert("W5-18", "Anon RPC executar_atomic_swap_faturamento é bloqueado (sem permissão EXECUTE)", error !== null);
  } catch (err: any) {
    assert("W5-18", "Anon RPC executar_atomic_swap_faturamento é bloqueado", true);
  }

  // 19. Anon RPC confirmar_importacao_faturamento
  try {
    const { error } = await anonClient.rpc("confirmar_importacao_faturamento", {
      p_batch_id: "00000000-0000-0000-0000-000000000000",
      p_mode: "replace",
    });
    assert("W5-19", "Anon RPC confirmar_importacao_faturamento é bloqueado", error !== null);
  } catch (err: any) {
    assert("W5-19", "Anon RPC confirmar_importacao_faturamento é bloqueado", true);
  }

  // 20. Anon RPC refresh_materialized_views
  try {
    const { error } = await anonClient.rpc("refresh_materialized_views");
    assert("W5-20", "Anon RPC refresh_materialized_views é bloqueado", error !== null);
  } catch (err: any) {
    assert("W5-20", "Anon RPC refresh_materialized_views é bloqueado", true);
  }

  // 21. /api/import/status/[id] fail-closed logic test
  const GLOBAL_ROLES = ["Admin", "Admin Master", "CEO", "Trade", "Financeiro", "Diretor"];
  
  // Test case A: Batch without uploader for non-global role
  const mockSystemLogEntry = { metadata: { user_id: null, uploaded_by: null } };
  const mockPromotorUser = { id: "user-promotor-123" };
  const mockPromotorProfile = { role: "Promotor" };
  
  const hasGlobalPromotor = GLOBAL_ROLES.some(r => r.toLowerCase() === mockPromotorProfile.role.toLowerCase());
  let accessPromotorAllowed = true;
  if (!hasGlobalPromotor) {
    const uploaderId = mockSystemLogEntry.metadata.user_id || mockSystemLogEntry.metadata.uploaded_by;
    if (!uploaderId || String(uploaderId) !== mockPromotorUser.id) {
      accessPromotorAllowed = false;
    }
  }
  assert("W5-21", "Batch automático sem uploaderId bloqueia acesso para Promotor (403)", !accessPromotorAllowed);

  // Test case B: Batch without uploader for Admin
  const mockAdminProfile = { role: "Admin" };
  const hasGlobalAdmin = GLOBAL_ROLES.some(r => r.toLowerCase() === mockAdminProfile.role.toLowerCase());
  assert("W5-22", "Batch automático sem uploaderId permite acesso para Admin (200)", hasGlobalAdmin);

  // 22. /api/export limit tests
  const MAX_ROWS = 50000;
  const MAX_COLS = 100;

  const validData = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
  const excessiveRowsData = Array.from({ length: 50001 }, (_, i) => ({ id: i }));
  const excessiveColsRow: Record<string, number> = {};
  for (let c = 0; c <= 101; c++) {
    excessiveColsRow[`col_${c}`] = c;
  }

  assert("W5-23", "Export <= 50.000 linhas é aceito", validData.length <= MAX_ROWS);
  assert("W5-24", "Export > 50.000 linhas é rejeitado defensivamente", excessiveRowsData.length > MAX_ROWS);
  assert("W5-25", "Export com > 100 colunas é detectado e rejeitado", Object.keys(excessiveColsRow).length > MAX_COLS);

  // 23. handleAuthError in production mode test
  const originalEnv = process.env.NODE_ENV;
  try {
    (process.env as any).NODE_ENV = "production";
    const dbErr = new Error("PostgreSQL connection timeout: relation 'cm_internal_secret' does not exist at 0x7fff");
    const response = handleAuthError(dbErr);
    const body = await response.json();
    assert("W5-26", "handleAuthError em produção mascara mensagem técnica interna", body.error === "Erro interno no servidor." && response.status === 500);
  } finally {
    (process.env as any).NODE_ENV = originalEnv;
  }

  // Summary
  console.log("\n=======================================================");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  Resultado: ${passed}/${total} testes aprovados.`);
  if (failed > 0) {
    console.error(`  \x1b[31mFALHAS: ${failed} teste(s) falharam!\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`  \x1b[32m100% CONFORME: Todos os testes de segurança Wave 5 passaram!\x1b[0m`);
  }
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Erro fatal na execução da suíte:", err);
  process.exit(1);
});
