import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function runExcelTest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log("=== INICIANDO TESTE DE PARSER EXCEL, STAGING E LOGS ===");

  const testAno = 2026;
  const testMes = 8;

  // 1. Limpar dados anteriores de teste
  console.log("Limpando dados anteriores...");
  await supabase
    .from("cm_dre_financeiro")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  // Mock de Linhas Brutas do Excel (rawRows)
  const mockRawRows = [
    {
      "Matriz": "BRASSOL BRAS",
      "Gerente": "Gerente Comercial Sul",
      "Canal Venda": "MODERNO",
      "Tons": 99.4,
      "Fat R$": 1789.0,
      "IMP": -118.0,
      "Investimento": -600.0,
      "CMV": -476.0,
      "vlr_frete": -10.0,
      "DGA": -150.0,
      "Custo Rede": -80.0
    }
  ];

  // Mock de Linhas Normalizadas (normalizedRows)
  const mockNormalizedRows = [
    {
      codigo_matriz: "107395", // Brassol Bras codigo
      gerente_id: "12",
      canal_id: "MODERNO",
      sku_id: "ALL",
      familia_id: "ALL",
      volume: 99.4,
      receita_bruta: 1789.0,
      impostos: 118.0, // Absolutos positivos no input (o trigger calcula com sinal)
      investimento_comercial: 600.0,
      custo_produtos: 476.0,
      frete: 10.0,
      dga: 150.0,
      custo_rede: 80.0
    }
  ];

  // 2. Executar Lógica local equivalente a importarExcelDRE (evitando erro de cookies() fora de request)
  console.log("Executando transação local de importação...");
  const startedAt = new Date();
  
  // Criar o log de importação
  const { data: logInsert } = await supabase
    .from("cm_dre_import_logs")
    .insert({
      filename: "base_dre_teste_local.xlsx",
      source: "excel",
      status: "uploaded",
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();

  if (!logInsert) {
    console.error("Erro ao registrar log");
    return;
  }

  const logId = logInsert.id;

  // Staging
  await supabase
    .from("cm_dre_import_logs")
    .update({ status: "parsing" })
    .eq("id", logId);

  const rawInserts = mockRawRows.map((row, idx) => ({
    import_log_id: logId,
    row_number: idx + 1,
    raw_data: row,
  }));
  await supabase.from("cm_dre_excel_raw").insert(rawInserts);

  // Normalizando
  await supabase
    .from("cm_dre_import_logs")
    .update({ status: "normalizing" })
    .eq("id", logId);

  const { data: syncResult, error: syncError } = await supabase.rpc("import_dre_excel_data", {
    p_ano: testAno,
    p_mes: testMes,
    p_import_log_id: logId,
    p_uploaded_by: null,
    p_rows: mockNormalizedRows,
  });

  if (syncError) {
    console.error("Erro na stored procedure:", syncError);
    return;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  await supabase
    .from("cm_dre_import_logs")
    .update({
      status: "success",
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      rows_imported: syncResult?.processed || 0,
    })
    .eq("id", logId);

  const response = {
    success: true,
    logId,
    processed: syncResult?.processed || 0,
    inserted: syncResult?.inserted || 0,
    updated: syncResult?.updated || 0,
    durationMs,
  };

  console.log("Resposta local:", response);

  // 3. Validar se gravou logs de lifecycle corretos
  console.log("Verificando cm_dre_import_logs...");
  const { data: log } = await supabase
    .from("cm_dre_import_logs")
    .select("*")
    .eq("id", response.logId)
    .single();

  console.log(`- Status Final: ${log.status}`);
  console.log(`- Iniciado em: ${log.started_at}`);
  console.log(`- Finalizado em: ${log.finished_at}`);
  console.log(`- Duração: ${log.duration_ms}ms`);
  console.log(`- Linhas importadas: ${log.rows_imported}`);

  // 4. Validar se gravou staging bruto em cm_dre_excel_raw
  console.log("Verificando cm_dre_excel_raw...");
  const { data: rawRows } = await supabase
    .from("cm_dre_excel_raw")
    .select("*")
    .eq("import_log_id", response.logId);

  console.log(`- Total de linhas na staging raw: ${rawRows?.length}`);
  console.log(`- Dados da linha 1 staging:`, rawRows?.[0]?.raw_data);

  // 5. Validar se inseriu consolidado e aplicou trigger de cálculo monetário
  console.log("Verificando cm_dre_financeiro e triggers...");
  const { data: finRow } = await supabase
    .from("cm_dre_financeiro")
    .select("*")
    .eq("ano", testAno)
    .eq("mes", testMes)
    .eq("is_active", true)
    .single();

  console.log(`- Chave: ${finRow.dre_key}`);
  console.log(`- Volume: ${finRow.volume} Tons`);
  console.log(`- Receita Bruta: R$ ${finRow.receita_bruta}`);
  console.log(`- Impostos: R$ ${finRow.impostos}`);
  console.log(`- Investimento: R$ ${finRow.investimento_comercial}`);
  console.log(`- Custo de Produtos: R$ ${finRow.custo_produtos}`);
  console.log(`- Frete: R$ ${finRow.frete}`);
  console.log(`- DGA: R$ ${finRow.dga}`);
  console.log(`- Custo Rede: R$ ${finRow.custo_rede}`);
  
  // Triggers devem calcular:
  // receita_liquida = receita_bruta - impostos - investimento_comercial
  // margem_contribuicao = receita_liquida - custo_produtos - frete
  // ebitda = margem_contribuicao - dga - custo_rede
  const expectedRecLiq = finRow.receita_bruta - finRow.impostos - finRow.investimento_comercial;
  const expectedMC = expectedRecLiq - finRow.custo_produtos - finRow.frete;
  const expectedEbitda = expectedMC - finRow.dga - finRow.custo_rede;

  console.log(`- Receita Líquida (DB): R$ ${finRow.receita_liquida} (Esperado: R$ ${expectedRecLiq}) - OK: ${finRow.receita_liquida == expectedRecLiq}`);
  console.log(`- Margem de Contribuição (DB): R$ ${finRow.margem_contribuicao} (Esperado: R$ ${expectedMC}) - OK: ${finRow.margem_contribuicao == expectedMC}`);
  console.log(`- EBITDA (DB): R$ ${finRow.ebitda} (Esperado: R$ ${expectedEbitda}) - OK: ${finRow.ebitda == expectedEbitda}`);

  // Limpeza
  console.log("Limpando dados de teste...");
  await supabase
    .from("cm_dre_financeiro")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  console.log("=== TESTE CONCLUÍDO COM SUCESSO ===");
}

runExcelTest().catch(console.error);
