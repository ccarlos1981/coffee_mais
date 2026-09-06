import assert from "node:assert";
import { 
  calcularCamposConsolidadosInvestimento, 
  isAcaoAtrasada, 
  validarIntersecaoCompetencia, 
  FamiliaDetalhe 
} from "../src/lib/investimento/consolidacao";
import { validarParidadeNegociacao, ParcelaFinanceira, AcaoComercialItem } from "../src/lib/investimento/plano-financeiro-service";

console.log("🏛️ COFFEE++ — GATE 5.14B: BATERIA OFICIAL DE TESTES MANDATÓRIOS\n");

let passed = 0;
let failed = 0;

function runTest(num: number, name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] TESTE ${num}: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] TESTE ${num}: ${name}`);
    console.error(err);
    failed++;
  }
}

// TESTE 1: Investimento unitário R$10, Volume 387 -> valor_investimento = R$3.870
runTest(1, "Investimento unitário R$10, Volume 387 -> valor_investimento = R$3.870", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "grao", familia_nome: "Grão", preco_flat: 50, preco_acao: 40, investimento: 10, expectativa_volume: 387 }
  ];
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  assert.strictEqual(res.valor_investimento, 3870, `Esperado 3870, recebido ${res.valor_investimento}`);
  assert.strictEqual(res.expectativa_volume, 387);
  assert.strictEqual(res.preco_flat, 50);
  assert.strictEqual(res.preco_acao, 40);
});

// TESTE 2: Investimento unitário R$14, Volume 361 -> valor_investimento = R$5.054
runTest(2, "Investimento unitário R$14, Volume 361 -> valor_investimento = R$5.054", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "capsula", familia_nome: "Cápsula", preco_flat: 60, preco_acao: 46, investimento: 14, expectativa_volume: 361 }
  ];
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  assert.strictEqual(res.valor_investimento, 5054, `Esperado 5054, recebido ${res.valor_investimento}`);
  assert.strictEqual(res.expectativa_volume, 361);
});

// TESTE 3: Investimento unitário R$20, Volume 114 -> valor_investimento = R$2.280
runTest(3, "Investimento unitário R$20, Volume 114 -> valor_investimento = R$2.280", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "drip", familia_nome: "Drip Coffee", preco_flat: 70, preco_acao: 50, investimento: 20, expectativa_volume: 114 }
  ];
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  assert.strictEqual(res.valor_investimento, 2280, `Esperado 2280, recebido ${res.valor_investimento}`);
  assert.strictEqual(res.expectativa_volume, 114);
});

// TESTE 4: Ação R$500, Volume 1 -> valor_investimento = R$500
runTest(4, "Ação R$500, Volume 1 -> valor_investimento = R$500", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "aniv", familia_nome: "Aniversário", preco_flat: 0, preco_acao: 0, investimento: 500, expectativa_volume: 1 }
  ];
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  assert.strictEqual(res.valor_investimento, 500, `Esperado 500, recebido ${res.valor_investimento}`);
  assert.strictEqual(res.expectativa_volume, 1);
});

// TESTE 5: Duas ações: R$500 e R$300 -> total ações = R$800
runTest(5, "Duas ações (R$500 e R$300) -> total = R$800", () => {
  const acao1 = calcularCamposConsolidadosInvestimento([
    { familia_id: "f1", familia_nome: "Família 1", preco_flat: 50, preco_acao: 45, investimento: 5, expectativa_volume: 100 }
  ], null);
  const acao2 = calcularCamposConsolidadosInvestimento([
    { familia_id: "f2", familia_nome: "Família 2", preco_flat: 40, preco_acao: 37, investimento: 3, expectativa_volume: 100 }
  ], null);
  
  assert.strictEqual(acao1.valor_investimento, 500);
  assert.strictEqual(acao2.valor_investimento, 300);
  const total = acao1.valor_investimento + acao2.valor_investimento;
  assert.strictEqual(total, 800, `Esperado total 800, recebido ${total}`);
});

// TESTE 6: Duas ações + 2 parcelas (R$400 e R$400) -> paridade financeira estrita
runTest(6, "Duas ações (R$800) + 2 parcelas (R$400 cada) -> total ações = total parcelas = R$800", () => {
  const acoes: AcaoComercialItem[] = [
    { id: "1", tipo_acao: "Sell Out", familia_id: "grao", familia_nome: "Grão", preco_flat: 50, preco_acao: 45, expectativa_volume: 100, abrangencia: "Família", data_inicio: "2026-09-01", data_fim: "2026-09-10", valor_investimento: 500 },
    { id: "2", tipo_acao: "Degustação", familia_id: "capsula", familia_nome: "Cápsula", preco_flat: 40, preco_acao: 37, expectativa_volume: 100, abrangencia: "Família", data_inicio: "2026-09-05", data_fim: "2026-09-15", valor_investimento: 300 }
  ];
  const parcelas: ParcelaFinanceira[] = [
    { numero_parcela: 1, total_parcelas: 2, valor_previsto_original: 400, valor_previsto: 400, saldo_remanescente: 400, data_vencimento: "2026-09-15", tipo_pagamento: "Boleto", status_parcela: "PENDENTE" },
    { numero_parcela: 2, total_parcelas: 2, valor_previsto_original: 400, valor_previsto: 400, saldo_remanescente: 400, data_vencimento: "2026-10-15", tipo_pagamento: "Boleto", status_parcela: "PENDENTE" }
  ];
  const check = validarParidadeNegociacao(acoes, parcelas);
  assert.strictEqual(check.valido, true, `Paridade deveria ser válida. Diferença: ${check.diferenca}`);
  assert.strictEqual(check.diferenca, 0);
});

// TESTE 7: Ação retroativa dentro da competência (Competência 2026-09, Ação 01/09–03/09, Lançamento 06/09)
runTest(7, "Ação retroativa dentro da competência (Setembro: 01/09–03/09 lançada em 06/09) -> PERMITIDA", () => {
  const res = validarIntersecaoCompetencia("2026-09-01", "2026-09-03", "2026-09");
  assert.strictEqual(res.valido, true, "Ação retroativa dentro da competência deve ser permitida");
});

// TESTE 8: Ação futura dentro da competência (Competência 2026-09, Ação 10/09–12/09, Lançamento 06/09)
runTest(8, "Ação futura dentro da competência (Setembro: 10/09–12/09 lançada em 06/09) -> PERMITIDA", () => {
  const res = validarIntersecaoCompetencia("2026-09-10", "2026-09-12", "2026-09");
  assert.strictEqual(res.valido, true, "Ação futura dentro da competência deve ser permitida");
});

// TESTE 9: Ação retroativa encerrada (01/09–03/09 lançada em 06/09) -> Destaque visual vermelho (atrasada = true)
runTest(9, "Ação retroativa encerrada (01/09–03/09 lançada em 06/09) -> isAcaoAtrasada = true", () => {
  // Lançamento em 06/09 às 18:00 UTC (15:00 BRT)
  const atrasada = isAcaoAtrasada("2026-09-03", "2026-09-06T18:00:00Z");
  assert.strictEqual(atrasada, true, "Ação encerrada antes da data de registro deve ser marcada como atrasada");
  
  // Ação futura não deve ser atrasada
  const naoAtrasada = isAcaoAtrasada("2026-09-12", "2026-09-06T18:00:00Z");
  assert.strictEqual(naoAtrasada, false, "Ação futura não pode ser marcada como atrasada");
});

// TESTE 10: Duas ações criadas em 06/09 e 10/09 -> Data Registro da campanha = 06/09
runTest(10, "Duas ações (06/09 e 10/09) -> Data Registro consolidada = MIN = 06/09", () => {
  const acoes = [
    { id: "1", created_at: "2026-09-10T14:30:00Z" },
    { id: "2", created_at: "2026-09-06T09:15:00Z" }
  ];
  const dates = acoes.map(a => a.created_at).filter(Boolean);
  const dataRegistro = dates.length > 0 ? [...dates].sort()[0] : null;
  assert.strictEqual(dataRegistro, "2026-09-06T09:15:00Z");
  const dataFormatada = new Date(dataRegistro!).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  assert.strictEqual(dataFormatada, "06/09/2026");
});

// TESTE 11: Ação atravessando mês (28/09–02/10)
runTest(11, "Ação atravessando mês (28/09–02/10) -> Válida em 2026-09 e em 2026-10; Inválida em 2026-08", () => {
  const validaSetembro = validarIntersecaoCompetencia("2026-09-28", "2026-10-02", "2026-09");
  assert.strictEqual(validaSetembro.valido, true, "Deve ter vigência na competência 2026-09");

  const validaOutubro = validarIntersecaoCompetencia("2026-09-28", "2026-10-02", "2026-10");
  assert.strictEqual(validaOutubro.valido, true, "Deve ter vigência na competência 2026-10");

  const invalidaAgosto = validarIntersecaoCompetencia("2026-09-28", "2026-10-02", "2026-08");
  assert.strictEqual(invalidaAgosto.valido, false, "NÃO deve ter vigência na competência 2026-08");

  const invalidaNovembro = validarIntersecaoCompetencia("2026-09-28", "2026-10-02", "2026-11");
  assert.strictEqual(invalidaNovembro.valido, false, "NÃO deve ter vigência na competência 2026-11");
});

// TESTE 12: Idempotência e paridade: rejeição de divergência centesimal > R$0,01
runTest(12, "Idempotência e paridade: rejeição de divergência centesimal > R$0,01", () => {
  const acoes: AcaoComercialItem[] = [
    { id: "1", tipo_acao: "Sell Out", familia_id: "grao", familia_nome: "Grão", preco_flat: 50, preco_acao: 45, expectativa_volume: 100, abrangencia: "Família", data_inicio: "2026-09-01", data_fim: "2026-09-10", valor_investimento: 800 }
  ];
  const parcelasDivergentes: ParcelaFinanceira[] = [
    { numero_parcela: 1, total_parcelas: 2, valor_previsto_original: 400, valor_previsto: 400, saldo_remanescente: 400, data_vencimento: "2026-09-15", tipo_pagamento: "Boleto", status_parcela: "PENDENTE" },
    { numero_parcela: 2, total_parcelas: 2, valor_previsto_original: 400, valor_previsto: 399.98, saldo_remanescente: 399.98, data_vencimento: "2026-10-15", tipo_pagamento: "Boleto", status_parcela: "PENDENTE" }
  ];
  const check = validarParidadeNegociacao(acoes, parcelasDivergentes);
  assert.strictEqual(check.valido, false, "Divergência de R$0,02 deve ser rejeitada pelo Financial Guard");
  assert.strictEqual(check.diferenca, 0.02);

  // Com tolerância centesimal de R$0,01
  const parcelasToleradas: ParcelaFinanceira[] = [
    { numero_parcela: 1, total_parcelas: 2, valor_previsto_original: 400, valor_previsto: 400, saldo_remanescente: 400, data_vencimento: "2026-09-15", tipo_pagamento: "Boleto", status_parcela: "PENDENTE" },
    { numero_parcela: 2, total_parcelas: 2, valor_previsto_original: 400, valor_previsto: 399.99, saldo_remanescente: 399.99, data_vencimento: "2026-10-15", tipo_pagamento: "Boleto", status_parcela: "PENDENTE" }
  ];
  const checkTolerada = validarParidadeNegociacao(acoes, parcelasToleradas);
  assert.strictEqual(checkTolerada.valido, true, "Diferença de R$0,01 deve ser tolerada");
});

console.log("\n==================================================");
console.log(`📊 RESULTADO FINAL DOS 12 TESTES MANDATÓRIOS:`);
console.log(`==================================================`);
console.log(`🟢 Passaram: ${passed} / 12`);
console.log(`🔴 Falharam: ${failed} / 12`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 TODOS OS 12 TESTES OBRIGATÓRIOS DO GATE 5.14B FORAM APROVADOS COM SUCESSO!\n");
  process.exit(0);
}
