import { normalizarNome, getSimilarity, encontrarCorrespondenciaCliente } from "../src/lib/associacao/clienteMatching";
import { avaliarRegrasComerciais, ResponsavelRegra } from "../src/lib/associacao/motorResponsavel";
import { calcularScoreConfianca } from "../src/lib/associacao/scoreConfianca";
import { AutoAssociacaoService } from "../src/lib/associacao/autoAssociacaoService";

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING TS UNIT & INTEGRATION TESTS");
  console.log("=========================================\n");

  // 1. Test Normalization
  console.log("1. Testing Normalization...");
  const rawName = "SUPERMERCADO ABC LTDA S/A ME EIRELI ÉÉÀÀ";
  const normalized = normalizarNome(rawName);
  console.log(`  Raw: "${rawName}"`);
  console.log(`  Normalized: "${normalized}"`);
  if (normalized === "SUPERMERCADO ABC EEAA") {
    console.log("  ✅ Normalization Passed!");
  } else {
    console.log("  ❌ Normalization Failed!");
  }
  console.log();

  // 2. Test Similarity (Levenshtein)
  console.log("2. Testing Levenshtein Similarity...");
  const nameA = "COFFEE MAIS DISTRIBUIDORA";
  const nameB = "COFFEE MAIS COMERCIO";
  const sim = getSimilarity(nameA, nameB);
  console.log(`  Similarity between "${nameA}" and "${nameB}": ${(sim * 100).toFixed(2)}%`);
  if (sim > 0.80) {
    console.log("  ✅ Similarity calculation works!");
  } else {
    console.log("  ❌ Similarity calculation failed!");
  }
  console.log();

  // 3. Test Matching Cascade
  console.log("3. Testing Matching Cascade...");
  const mockClient = { codigo: 99999, cnpj: "12345678901234", nome_parceiro: "ZAFFARI SUPERMERCADOS", razao_social: null };
  const mockBaseAtendimento = [
    { cod_parceiro: "99999", nome_parceiro: "ZAFFARI SUPERMERCADOS", manager: "Luiz", canal: "KA", cnpj: null }
  ];
  const matchResult = encontrarCorrespondenciaCliente(mockClient, mockBaseAtendimento, []);
  console.log("  Match Result:", matchResult);
  if (matchResult && matchResult.matchingStrategy === 'codigo') {
    console.log("  ✅ Matching by code passed!");
  } else {
    console.log("  ❌ Matching by code failed!");
  }
  console.log();

  // 4. Test Rules Engine
  console.log("4. Testing Rules Engine...");
  const mockMatchedRecord = { nome_vendedor: "SHOPIFY" };
  const mockRules: ResponsavelRegra[] = [
    { id: "rule_1", prioridade: 10, tipo_regra: "VENDEDOR", campo_origem: "nome_vendedor", operador: "EQUALS", valor_origem: "SHOPIFY", responsavel_resultado: "Inside Sales", ativo: true, observacao: null }
  ];
  const ruleResult = avaliarRegrasComerciais(mockMatchedRecord, 'cm_faturamento', mockRules);
  console.log("  Rule Result:", ruleResult);
  if (ruleResult && ruleResult.responsavelSugerido === "Inside Sales") {
    console.log("  ✅ Rules engine evaluation passed!");
  } else {
    console.log("  ❌ Rules engine evaluation failed!");
  }
  console.log();

  // 5. Test Score Calculation
  console.log("5. Testing Score Calculation...");
  const mockMatchingResult = { matchedRecord: { cod_parceiro: "99999" }, origem: 'cm_faturamento' as const, matchingStrategy: 'codigo' as const, matchingScore: 1.0 };
  const mockFaturamentoHistory = [
    { total_faturamento: 150000, frequencia: 12, latest_date: new Date().toISOString() }
  ];
  const scoreResult = calcularScoreConfianca(mockMatchingResult, mockFaturamentoHistory);
  console.log("  Score Result:", scoreResult);
  if (scoreResult.confianca === 100) {
    console.log("  ✅ Score calculation and bonus passed (100% confidence)!");
  } else {
    console.log("  ❌ Score calculation failed!");
  }
  console.log();

  // 6. Test Live Service Dry Run (against actual Supabase database)
  console.log("6. Running Live Service Dry Run (AutoAssociacaoService)...");
  try {
    // Set environment variables for Next.js aliases inside Node (bypassed)
    
    const serviceRes = await AutoAssociacaoService.gerarSugestoes('faturamento', 12, 90);
    console.log("  Live Execution Stats:", serviceRes.stats);
    console.log(`  Live Suggestions Generated: ${serviceRes.suggestions.length}`);
    if (serviceRes.suggestions.length > 0) {
      console.log("  First Suggestion Preview:", serviceRes.suggestions[0]);
    }
    console.log("  ✅ Live Service run completed successfully!");
  } catch (err: any) {
    console.error("  ❌ Live Service run failed:", err.message);
  }
  console.log("\n=========================================");
}

runTests();
