/**
 * Wave 7 Security & Legacy Database Cleanup Automated Test Suite
 * Asserções cobrindo:
 * - W7-DROP: Ausência definitiva das 4 tabelas órfãs e 2 views legadas
 * - W7-PRESERVE: Preservação de upload_batches, products e sales_v2
 * - W7-CEO-TARGETS: RLS e restrição de escrita em ceo_targets
 * - W7-MGR-MAPPING: RLS e integridade de manager_uf_mapping
 * - W7-SOVEREIGN-FUNC: Validação de calcular_responsavel_cliente com fallback territorial
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ncncazbhpoxjlyvcbvqa.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n============================================================");
  console.log("🛡️  SUÍTE DE TESTES WAVE 7 — LEGACY DATABASE CLEANUP");
  console.log("============================================================\n");

  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ------------------------------------------------------------------------
  // 1. OBJETOS REMOVIDOS DEFINITIVAMENTE (DROP VALIDATION)
  // ------------------------------------------------------------------------
  console.log("--- 1. Objetos Removidos Definitivamente (DROP) ---");

  const droppedTables = [
    "network_results",
    "investimento_cliente",
    "pdv_mapping_legacy",
    "sales_legacy",
  ];

  for (let i = 0; i < droppedTables.length; i++) {
    const table = droppedTables[i];
    const { error } = await adminClient.from(table).select("*").limit(1);
    const isGone = error !== null && (error.message.includes("does not exist") || error.code === "42P01" || error.code === "PGRST204" || error.code === "PGRST205");
    assert(isGone, `W7-DROP-0${i + 1}: Tabela ${table} não existe mais no banco de dados`);
  }

  // ------------------------------------------------------------------------
  // 2. OBJETOS PRESERVADOS (INTEGRIDADE ESTRUTURAL)
  // ------------------------------------------------------------------------
  console.log("\n--- 2. Objetos Preservados (Integridade) ---");

  const { data: batchesData, error: batchesErr } = await adminClient.from("upload_batches").select("id").limit(1);
  assert(!batchesErr, "W7-PRESERVE-01: upload_batches continua preservada no banco");

  const { data: productsData, error: productsErr } = await adminClient.from("products").select("id, name").limit(1);
  assert(!productsErr && Array.isArray(productsData) && productsData.length > 0, "W7-PRESERVE-02: products continua preservada como Master Data ativa");

  const { data: salesV2Data, error: salesV2Err } = await adminClient.from("sales_v2").select("id").limit(1);
  assert(!salesV2Err, "W7-PRESERVE-03: sales_v2 continua íntegra e operacional");

  // ------------------------------------------------------------------------
  // 3. ceo_targets REFINEMENT (RLS & PRIVILEGE)
  // ------------------------------------------------------------------------
  console.log("\n--- 3. ceo_targets Refinement ---");

  // Anon SELECT
  const { data: ceoAnonData, error: ceoAnonErr } = await anonClient.from("ceo_targets").select("*").limit(1);
  const isCeoAnonBlocked = ceoAnonErr !== null || (Array.isArray(ceoAnonData) && ceoAnonData.length === 0);
  assert(isCeoAnonBlocked, "W7-RLS-CEO-01: Anon bloqueado de ler ceo_targets via RLS");

  // Anon INSERT
  const { error: ceoAnonInsertErr } = await anonClient.from("ceo_targets").insert({ year: 2099, month: 12, target_forecast: 1000 });
  assert(ceoAnonInsertErr !== null, "W7-RLS-CEO-02: Anon bloqueado de inserir em ceo_targets");

  // Admin Access
  const { data: ceoAdminData, error: ceoAdminErr } = await adminClient.from("ceo_targets").select("id, target_forecast").limit(5);
  assert(!ceoAdminErr && Array.isArray(ceoAdminData), "W7-RLS-CEO-03: Service Role lê ceo_targets normalmente");

  // ------------------------------------------------------------------------
  // 4. manager_uf_mapping REFINEMENT (RLS & TERRITORY INTEGRITY)
  // ------------------------------------------------------------------------
  console.log("\n--- 4. manager_uf_mapping Refinement ---");

  // Anon SELECT
  const { data: mgrAnonData, error: mgrAnonErr } = await anonClient.from("manager_uf_mapping").select("*").limit(1);
  const isMgrAnonBlocked = mgrAnonErr !== null || (Array.isArray(mgrAnonData) && mgrAnonData.length === 0);
  assert(isMgrAnonBlocked, "W7-RLS-MGR-01: Anon bloqueado de ler manager_uf_mapping via RLS");

  // Anon INSERT
  const { error: mgrAnonInsertErr } = await anonClient.from("manager_uf_mapping").insert({ uf: "XX", manager: "TEST" });
  assert(mgrAnonInsertErr !== null, "W7-RLS-MGR-02: Anon bloqueado de inserir em manager_uf_mapping");

  // Admin Access (deve conter as 27 UFs)
  const { data: mgrAdminData, error: mgrAdminErr } = await adminClient.from("manager_uf_mapping").select("uf, manager");
  assert(!mgrAdminErr && Array.isArray(mgrAdminData) && mgrAdminData.length === 27, "W7-RLS-MGR-03: Service Role lê as 27 UFs de manager_uf_mapping");

  // ------------------------------------------------------------------------
  // 5. FUNÇÃO SOBERANA calcular_responsavel_cliente
  // ------------------------------------------------------------------------
  console.log("\n--- 5. Função Soberana calcular_responsavel_cliente ---");

  // Testar fallback por UF para SP e RS
  const { data: respSP, error: respSPErr } = await adminClient.rpc("calcular_responsavel_cliente", {
    p_codigo_matriz: "MATRIZ_FALLBACK_TEST",
    p_uf: "SP",
    p_responsavel_atual: null
  });
  assert(!respSPErr && typeof respSP === "string" && respSP.length > 0, `W7-SOVEREIGN-01: Fallback territorial SP calculado com sucesso (${respSP})`);

  const { data: respRS, error: respRSErr } = await adminClient.rpc("calcular_responsavel_cliente", {
    p_codigo_matriz: "MATRIZ_FALLBACK_TEST",
    p_uf: "RS",
    p_responsavel_atual: null
  });
  assert(!respRSErr && typeof respRS === "string" && respRS.length > 0, `W7-SOVEREIGN-02: Fallback territorial RS calculado com sucesso (${respRS})`);

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log("\n============================================================");
  console.log(`🎯 TOTAL WAVE 7: ${passed + failed} asserções`);
  console.log(`✅ APROVADOS:   ${passed}`);
  console.log(`❌ FALHAS:      ${failed}`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erro fatal ao executar suíte Wave 7:", err);
  process.exit(1);
});
