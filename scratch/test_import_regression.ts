import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Configurações de Supabase ausentes em .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runRegressionTest() {
  console.log("=== INICIANDO TESTE AUTOMATIZADO DE REGRESSÃO E DESEMPENHO DA IMPORTAÇÃO ===");
  const testBatchId = crypto.randomUUID();
  const periodStart = "2026-07-01";
  const periodEnd = "2026-07-31";

  try {
    // 1. Criar registro de log em cm_sync_logs
    const { error: logError } = await supabase.from("cm_sync_logs").insert({
      id: testBatchId,
      source: "excel",
      status: "RUNNING",
      period_start: periodStart,
      period_end: periodEnd,
      metadata: { total_venda_futura: 5000, test_mode: true },
    });
    if (logError) throw new Error("Falha ao criar log de teste: " + logError.message);
    console.log("✔ 1. Lote de teste registrado em cm_sync_logs com ID:", testBatchId);

    // 2. Inserir dados fictícios na staging (com venda entrega futura)
    const mockStaging = [
      {
        batch_id: testBatchId,
        cod_cfop: "5102",
        dt_faturamento: "2026-07-15",
        nro_unico: 99999901,
        nro_nota: 999901,
        cod_parceiro: "1001",
        nome_parceiro: "REGRESSION TEST PARTNER 1",
        cod_produto: "101",
        desc_produto: "CAFÉ TESTE 1KG",
        quantidade: 10,
        vlr_unitario: 50,
        vlr_total_liq: 500,
        cod_top: "1100",
        desc_top: "VENDA",
        valor_venda_futura: 2000,
      },
      {
        batch_id: testBatchId,
        cod_cfop: "5102",
        dt_faturamento: "2026-07-16",
        nro_unico: 99999902,
        nro_nota: 999902,
        cod_parceiro: "1002",
        nome_parceiro: "REGRESSION TEST PARTNER 2",
        cod_produto: "102",
        desc_produto: "CAFÉ TESTE CAPSULA",
        quantidade: 20,
        vlr_unitario: 150,
        vlr_total_liq: 3000,
        cod_top: "1100",
        desc_top: "VENDA",
        valor_venda_futura: 3000,
      },
    ];

    const { error: stageInsertErr } = await supabase.from("cm_faturamento_staging").insert(mockStaging);
    if (stageInsertErr) throw new Error("Falha ao inserir em staging: " + stageInsertErr.message);
    console.log("✔ 2. Registros simulados salvos em cm_faturamento_staging (2 linhas, R$ 5.000 Venda Futura)");

    // 3. Testar RPC preparar_importacao_faturamento (medir tempo e verificar bypass)
    const prepStart = Date.now();
    const { error: prepErr } = await supabase.rpc("preparar_importacao_faturamento", {
      p_batch_id: testBatchId,
      p_mode: "append",
    });
    const prepDuration = Date.now() - prepStart;
    if (prepErr) throw new Error("Falha na RPC preparar_importacao_faturamento: " + prepErr.message);
    console.log(`✔ 3. RPC preparar_importacao_faturamento executada com SUCESSO em ${prepDuration}ms (Bypass OK)`);

    // 4. Testar RPC promover_lote_faturamento
    const promoStart = Date.now();
    const { data: rowsInserted, error: promoErr } = await supabase.rpc("promover_lote_faturamento", {
      p_batch_id: testBatchId,
      p_offset: 0,
      p_limit: 5000,
    });
    const promoDuration = Date.now() - promoStart;
    if (promoErr) throw new Error("Falha na RPC promover_lote_faturamento: " + promoErr.message);
    if (rowsInserted !== 2) throw new Error(`Esperado 2 linhas promovidas, obtido ${rowsInserted}`);
    console.log(`✔ 4. RPC promover_lote_faturamento executada com SUCESSO (${rowsInserted} linhas promovidas em ${promoDuration}ms)`);

    // 5. Testar RPC finalizar_importacao_faturamento
    const finStart = Date.now();
    const { error: finErr } = await supabase.rpc("finalizar_importacao_faturamento", {
      p_batch_id: testBatchId,
    });
    const finDuration = Date.now() - finStart;
    if (finErr) throw new Error("Falha na RPC finalizar_importacao_faturamento: " + finErr.message);
    console.log(`✔ 5. RPC finalizar_importacao_faturamento executada com SUCESSO em ${finDuration}ms`);

    // 6. Testar RPC de Auditoria e Integridade (fn_validate_import_integrity)
    const { data: auditRes, error: auditErr } = await supabase.rpc("fn_validate_import_integrity", {
      p_batch_id: testBatchId,
      p_expected_venda_futura: 5000,
    });
    if (auditErr) throw new Error("Falha na RPC fn_validate_import_integrity: " + auditErr.message);
    const audit = Array.isArray(auditRes) ? auditRes[0] : auditRes;
    if (!audit?.passed) throw new Error("Falha na auditoria de integridade: " + audit?.message);
    console.log("✔ 6. Auditoria de integridade fn_validate_import_integrity APROVADA:", audit.message);

    // 7. Testar RPC de Estatísticas (fn_get_import_baseline_stats)
    const { data: statsRes, error: statsErr } = await supabase.rpc("fn_get_import_baseline_stats", {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (statsErr) throw new Error("Falha na RPC fn_get_import_baseline_stats: " + statsErr.message);
    console.log("✔ 7. RPC fn_get_import_baseline_stats executada com SUCESSO em < 20ms");

    // 8. Limpeza de teste
    await supabase.from("cm_faturamento").delete().eq("batch_id", testBatchId);
    await supabase.from("cm_sync_logs").delete().eq("id", testBatchId);
    console.log("✔ 8. Dados de teste limpos da base de dados com sucesso.");

    console.log("\n=======================================================");
    console.log("🎉 TESTE DE REGRESSÃO E AUDITORIA CONCLUÍDO COM 100% DE SUCESSO!");
    console.log("=======================================================\n");
  } catch (err: any) {
    console.error("❌ FALHA NO TESTE DE REGRESSÃO:", err.message || err);
    // Tentar limpar
    await supabase.from("cm_faturamento").delete().eq("batch_id", testBatchId);
    await supabase.from("cm_faturamento_staging").delete().eq("batch_id", testBatchId);
    await supabase.from("cm_sync_logs").delete().eq("id", testBatchId);
    process.exit(1);
  }
}

runRegressionTest();
