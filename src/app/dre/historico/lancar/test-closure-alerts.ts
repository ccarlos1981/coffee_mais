import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import crypto from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function runClosureAlertsTest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log("=== INICIANDO TESTE DE FECHAMENTO E ALERTAS DRE ===");

  const testAno = 2026;
  const testMes = 9;

  // 1. Limpar dados anteriores
  console.log("Limpando dados anteriores...");
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

  await supabase
    .from("cm_dre_alerts")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  // 2. Inserir registros de teste que disparem alertas
  console.log("Inserindo registros com anomalias de teste...");
  const { data: testRow } = await supabase
    .from("cm_dre_financeiro")
    .insert({
      dre_key: `${testAno}_${testMes}_MOCK_REDE_ADMIN_ALL_ALL_ALL`,
      ano: testAno,
      mes: testMes,
      codigo_matriz: "MOCK_REDE",
      gerente_id: "ADMIN",
      volume: 10,
      receita_bruta: 100,
      impostos: 10,
      investimento_comercial: 50, // 50% de investimento (limite é 45% -> INVESTIMENTO_EXCESSIVO)
      custo_produtos: 80, // receita_liquida = 100 - 10 - 50 = 40. margem_contribuicao = 40 - 80 = -40 (ebitda negativo -> MARGEM_CRITICA)
      frete: 5,
      dga: 10,
      custo_rede: 5,
      is_active: true,
      origem: "EXCEL"
    })
    .select("*")
    .single();

  // Executar localmente a lógica do motor de alertas (evitando cookies() context)
  console.log("Executando motor de alertas...");
  
  // A. Buscar registros ativos
  const { data: currentRows } = await supabase
    .from("cm_dre_financeiro")
    .select("*")
    .eq("ano", testAno)
    .eq("mes", testMes)
    .eq("is_active", true)
    .eq("is_deleted", false);

  const alertsToUpsert: any[] = [];

  currentRows?.forEach((row) => {
    const ebitdaVal = Number(row.ebitda) || 0;
    const receitaVal = Number(row.receita_bruta) || 0;
    const investVal = Number(row.investimento_comercial) || 0;

    // Margem EBITDA Crítica
    if (ebitdaVal < 0) {
      const alertHash = crypto
        .createHash("md5")
        .update(`${testAno}_${testMes}_MARGEM_CRITICA_${row.codigo_matriz}_${row.gerente_id}`)
        .digest("hex");

      alertsToUpsert.push({
        alert_hash: alertHash,
        ano: testAno,
        mes: testMes,
        alert_type: "MARGEM_CRITICA",
        severity: "CRITICAL",
        title: "EBITDA Negativo Detectado",
        description: `Operação gerou margem de contribuição ou EBITDA negativo de R$ ${ebitdaVal.toLocaleString("pt-BR")} mil na Rede.`,
        metadata: { ebitda: ebitdaVal, codigo_matriz: row.codigo_matriz },
      });
    }

    // Investimento Comercial Excessivo (>45%)
    if (receitaVal > 0) {
      const investRatio = investVal / receitaVal;
      if (investRatio > 0.45) {
        const alertHash = crypto
          .createHash("md5")
          .update(`${testAno}_${testMes}_INVESTIMENTO_EXCESSIVO_${row.codigo_matriz}_${row.gerente_id}`)
          .digest("hex");

        alertsToUpsert.push({
          alert_hash: alertHash,
          ano: testAno,
          mes: testMes,
          alert_type: "INVESTIMENTO_EXCESSIVO",
          severity: "CRITICAL",
          title: "Investimento comercial excessivo",
          description: `Investimento Comercial (R$ ${investVal.toLocaleString("pt-BR")}) representa ${(investRatio * 100).toFixed(1)}% da Receita Bruta, excedendo o limite crítico de 45%.`,
          metadata: { ratio: investRatio, receita: receitaVal, investimento: investVal, codigo_matriz: row.codigo_matriz },
        });
      }
    }
  });

  console.log(`- Total de alertas gerados: ${alertsToUpsert.length}`);
  for (const alert of alertsToUpsert) {
    await supabase.from("cm_dre_alerts").upsert(alert, { onConflict: "alert_hash" });
    console.log(`  * Tipo: ${alert.alert_type}, Severidade: ${alert.severity}, Descrição: ${alert.description}`);
  }

  // 3. Testar Fechamento de Mês via close_dre_month
  console.log("Executando close_dre_month RPC...");
  const snapshotJson = {
    resumo_geral: {
      volume: 10,
      receita_bruta: 100,
      ebitda: -55
    }
  };
  const checksum = crypto.createHash("md5").update(JSON.stringify(snapshotJson)).digest("hex");

  const { error: closeErr } = await supabase.rpc("close_dre_month", {
    p_ano: testAno,
    p_mes: testMes,
    p_closed_by: null, // Sistema / Admin MOCK
    p_notes: "Fechamento de Teste",
    p_snapshot_json: snapshotJson,
    p_snapshot_checksum: checksum
  });

  if (closeErr) {
    console.error("Erro ao fechar mês:", closeErr.message);
    return;
  }
  console.log("Mês fechado com sucesso!");

  // Verificar se gravou no banco
  const { data: closure } = await supabase
    .from("cm_dre_month_closure")
    .select("*")
    .eq("ano", testAno)
    .eq("mes", testMes)
    .single();

  console.log(`- Mês fechado (DB): ${closure.is_closed}`);
  console.log(`- Checksum (DB): ${closure.snapshot_checksum}`);
  console.log(`- Notas (DB): ${closure.notes}`);

  // 4. Testar Reabertura de Mês via reopen_dre_month
  console.log("Executando reopen_dre_month RPC...");
  const { error: reopenErr } = await supabase.rpc("reopen_dre_month", {
    p_ano: testAno,
    p_mes: testMes,
    p_reopened_by: null,
    p_reopen_reason: "Ajustes de auditoria fiscal de teste"
  });

  if (reopenErr) {
    console.error("Erro ao reabrir:", reopenErr.message);
    return;
  }
  console.log("Mês reaberto com sucesso!");

  // Verificar estado após reabertura
  const { data: closureAfter } = await supabase
    .from("cm_dre_month_closure")
    .select("*")
    .eq("ano", testAno)
    .eq("mes", testMes)
    .single();

  console.log(`- Mês fechado após reabertura: ${closureAfter.is_closed}`);
  console.log(`- Reaberto por: ${closureAfter.reopened_by}`);
  console.log(`- Motivo reabertura: ${closureAfter.reopen_reason}`);

  // Limpeza
  console.log("Limpando dados...");
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

  await supabase
    .from("cm_dre_alerts")
    .delete()
    .eq("ano", testAno)
    .eq("mes", testMes);

  console.log("=== TESTE CONCLUÍDO COM SUCESSO ===");
}

runClosureAlertsTest().catch(console.error);
