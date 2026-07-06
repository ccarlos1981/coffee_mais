const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTests() {
  console.log("=== STARTING BATCH INVESTMENT IMPORT REGRESSION TEST ===");
  const testJobIds = [];

  // Generate a baseline mock payload
  const mockAcao = {
    rede: "36.994.849 LUCIANA DE ANGELIS",
    codigo_matriz: "50224.2",
    mes_referencia: "2027-06",
    data_inicio: "2027-06-01",
    data_fim: "2027-06-30",
    tipo_acao: "Sell Out",
    tipo_pagamento: "Boleto",
    abrangencia: "Família",
    familia_produto: "Grão",
    preco_flat: 6.00,
    preco_acao: 0.00,
    valor_investimento: 6.00,
    expectativa_volume: 500,
    is_planejamento: false,
    fase_atual: 1,
    familias_detalhes: [],
    skus_detalhes: []
  };

  try {
    // SCENARIO 1: First Import (Should succeed)
    console.log("\n[Scenario 1] Running first import with hash: test_hash_scenario_1...");
    const hash1 = "test_hash_scenario_1_" + Date.now();
    const { data: jobId1, error: error1 } = await supabase.rpc('importar_lote_investimentos', {
      job_data: {
        nome_arquivo: "test_file_1.xlsx",
        file_hash: hash1,
        registros_count: 1,
        investimento_total: 6.00,
        created_by: null,
        ip_address: "127.0.0.1"
      },
      acoes_data: [mockAcao]
    });

    if (error1) {
      throw new Error(`Scenario 1 failed: ${error1.message}`);
    }
    console.log(`[Scenario 1] Success! Created job ID: ${jobId1}`);
    testJobIds.push(jobId1);

    // SCENARIO 2: Duplicate Hash Import (Should fail)
    console.log("\n[Scenario 2] Running duplicate import using same hash...");
    // We simulate the Server Action behavior:
    const { data: existingJob, error: checkError } = await supabase
      .from("cm_import_jobs")
      .select("id")
      .eq("file_hash", hash1)
      .single();

    if (existingJob) {
      console.log("[Scenario 2] Correctly intercepted duplicate hash before database insertion!");
    } else {
      throw new Error("Scenario 2 failed: Duplicate hash was not detected in existing jobs.");
    }

    // Attempting direct database insert of duplicate hash to check database constraints
    const { error: dbError } = await supabase.from('cm_import_jobs').insert({
      nome_arquivo: "test_file_dup.xlsx",
      file_hash: hash1,
      registros_count: 1,
      investimento_total: 6.00,
      status: "sucesso"
    });

    if (dbError && dbError.code === '23505') {
      console.log(`[Scenario 2] Success! Database unique constraint (23505) correctly blocked duplicate hash. Msg: ${dbError.message}`);
    } else if (!dbError) {
      throw new Error("Scenario 2 failed: Database allowed insertion of duplicate hash!");
    } else {
      throw new Error(`Scenario 2 failed with unexpected error: ${dbError.message}`);
    }

    // SCENARIO 3: Five Consecutive Imports (Should all succeed)
    console.log("\n[Scenario 3] Running 5 consecutive imports with unique hashes...");
    for (let i = 1; i <= 5; i++) {
      const consecutiveHash = `test_hash_consec_${i}_${Date.now()}`;
      console.log(` -> Importing batch ${i}/5 with hash: ${consecutiveHash}`);
      const { data: cJobId, error: cError } = await supabase.rpc('importar_lote_investimentos', {
        job_data: {
          nome_arquivo: `test_consecutive_${i}.xlsx`,
          file_hash: consecutiveHash,
          registros_count: 1,
          investimento_total: 6.00,
          created_by: null,
          ip_address: "127.0.0.1"
        },
        acoes_data: [mockAcao]
      });

      if (cError) {
        throw new Error(`Scenario 3 Batch ${i} failed: ${cError.message}`);
      }
      console.log(`    Success! Created job ID: ${cJobId}`);
      testJobIds.push(cJobId);
    }
    console.log("[Scenario 3] Success! All 5 consecutive imports completed successfully.");

    // SCENARIO 4: Invalid Date Format Casting (Should trigger RPC error)
    console.log("\n[Scenario 4] Importing item with invalid date format (testing constraint / format errors)...");
    const badAcao = { ...mockAcao, data_inicio: "invalid-date-format" };
    const badHash = "test_hash_bad_" + Date.now();
    const { data: badJobId, error: badError } = await supabase.rpc('importar_lote_investimentos', {
      job_data: {
        nome_arquivo: "test_bad.xlsx",
        file_hash: badHash,
        registros_count: 1,
        investimento_total: 6.00,
        created_by: null,
        ip_address: "127.0.0.1"
      },
      acoes_data: [badAcao]
    });

    if (badError) {
      console.log(`[Scenario 4] Success! RPC correctly failed with error code: ${badError.code}. Msg: ${badError.message}`);
    } else {
      testJobIds.push(badJobId);
      throw new Error("Scenario 4 failed: RPC accepted invalid date string!");
    }

  } catch (err) {
    console.error("\n!!! TEST SUITE FAILED WITH EXCEPTION !!!");
    console.error(err);
  } finally {
    // CLEANUP
    console.log("\n=== CLEANING UP TEST DATA ===");
    if (testJobIds.length > 0) {
      console.log(`Deleting ${testJobIds.length} test job(s) and associated actions...`);
      const { error: cleanActionsError } = await supabase
        .from('cm_acoes_investimento')
        .delete()
        .in('import_batch_id', testJobIds);

      if (cleanActionsError) {
        console.error("Error cleaning test actions:", cleanActionsError.message);
      }

      const { error: cleanJobsError } = await supabase
        .from('cm_import_jobs')
        .delete()
        .in('id', testJobIds);

      if (cleanJobsError) {
        console.error("Error cleaning test jobs:", cleanJobsError.message);
      }
      console.log("Cleanup completed.");
    }
    console.log("\n=== REGRESSION TEST RUN COMPLETED ===");
  }
}

runTests();
