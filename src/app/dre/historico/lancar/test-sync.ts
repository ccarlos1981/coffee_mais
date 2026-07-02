import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function runTest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log("=== INICIANDO TESTE DE IDEMPOTÊNCIA E TRIGGERS ===");

  const testAno = 2026;
  const testMes = 7;

  // 1. Limpar dados anteriores de teste
  console.log("Limpando dados de teste...");
  await supabase
    .from("cm_dre_financeiro")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  await supabase
    .from("cm_dre_month_closure")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  // 2. Criar log de teste
  const { data: log } = await supabase
    .from("cm_dre_import_logs")
    .insert({
      filename: "Sync Teste Local",
      source: "bigquery",
      status: "uploaded",
    })
    .select("id")
    .single();

  if (!log) {
    console.error("Erro ao criar log");
    return;
  }

  // 3. Mock de dados recebidos do BigQuery
  const mockRows = [
    {
      codigo_matriz: "107395",
      gerente_id: "12",
      canal_id: "MODERNO",
      sku_id: "ALL",
      familia_id: "ALL",
      volume: 100,
      receita_bruta: 5000,
    },
    {
      codigo_matriz: "107395",
      gerente_id: "12",
      canal_id: "MODERNO",
      sku_id: "ALL",
      familia_id: "ALL",
      volume: 100, // Mesma chave, dados iguais - deve ignorar
      receita_bruta: 5000,
    }
  ];

  console.log("Executando Stored Procedure `sync_dre_sales_data`...");
  const { data: result1, error: err1 } = await supabase.rpc("sync_dre_sales_data", {
    p_ano: testAno,
    p_mes: testMes,
    p_import_log_id: log.id,
    p_uploaded_by: null,
    p_rows: mockRows,
  });

  if (err1) {
    console.error("Erro na SP:", err1.message);
    return;
  }
  console.log("Resultado da SP (1ª execução):", result1);

  // 4. Testar versionamento (Executar com dados atualizados)
  console.log("Atualizando dados e executando novamente para testar versionamento...");
  const mockRowsUpdated = [
    {
      codigo_matriz: "107395",
      gerente_id: "12",
      canal_id: "MODERNO",
      sku_id: "ALL",
      familia_id: "ALL",
      volume: 120, // Mudança de volume
      receita_bruta: 6000, // Mudança de receita
    }
  ];

  const { data: result2, error: err2 } = await supabase.rpc("sync_dre_sales_data", {
    p_ano: testAno,
    p_mes: testMes,
    p_import_log_id: log.id,
    p_uploaded_by: null,
    p_rows: mockRowsUpdated,
  });

  if (err2) {
    console.error("Erro na SP (2ª execução):", err2.message);
    return;
  }
  console.log("Resultado da SP (2ª execução):", result2);

  // 5. Verificar registros no Supabase
  const { data: records } = await supabase
    .from("cm_dre_financeiro")
    .select("*")
    .eq("ano", testAno)
    .eq("mes", testMes)
    .order("version", { ascending: true });

  console.log("Registros inseridos:");
  records?.forEach((rec) => {
    console.log(
      `- Versão: ${rec.version}, Ativo: ${rec.is_active}, Volume: ${rec.volume}, Receita Bruta: ${rec.receita_bruta}, Receita Líquida: ${rec.receita_liquida} (Trigger OK: ${rec.receita_liquida == rec.receita_bruta})`
    );
  });

  // 6. Testar bloqueio de fechamento mensal
  console.log("Testando bloqueio de escrita em mês fechado...");
  await supabase
    .from("cm_dre_month_closure")
    .insert({
      ano: testAno,
      mes: testMes,
      is_closed: true,
      snapshot_json: {},
      snapshot_checksum: "mock_checksum"
    });

  const { data: result3, error: err3 } = await supabase.rpc("sync_dre_sales_data", {
    p_ano: testAno,
    p_mes: testMes,
    p_import_log_id: log.id,
    p_uploaded_by: null,
    p_rows: mockRows,
  });

  if (err3) {
    console.log("Sucesso: A SP bloqueou a escrita de forma correta! Erro recebido:", err3.message);
  } else {
    console.error("Erro: A SP permitiu a escrita mesmo com o mês fechado!");
  }

  // Limpeza final do teste
  console.log("Limpando dados de teste...");
  await supabase
    .from("cm_dre_financeiro")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  await supabase
    .from("cm_dre_month_closure")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  console.log("=== TESTE CONCLUÍDO COM SUCESSO ===");
}

runTest();
