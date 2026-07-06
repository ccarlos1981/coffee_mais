import assert from "node:assert";
import { calcularCamposConsolidadosInvestimento, FamiliaDetalhe, SKUDetalhe } from "../src/lib/investimento/consolidacao";

console.log("🚀 Iniciando testes unitários do helper de consolidação de investimentos...\n");

let passedTests = 0;
let failedTests = 0;

function testCase(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    failedTests++;
  }
}

// 1. Apenas uma Família
testCase("Apenas uma Família", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "grao", familia_nome: "Grão", preco_flat: 10, preco_acao: 8, investimento: 2, expectativa_volume: 100 }
  ];
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  
  assert.strictEqual(res.familia_produto, "Grão");
  assert.strictEqual(res.preco_flat, 10);
  assert.strictEqual(res.preco_acao, 8);
  assert.strictEqual(res.valor_investimento, 2);
  assert.strictEqual(res.expectativa_volume, 100);
});

// 2. Apenas um SKU
testCase("Apenas um SKU", () => {
  const skus: SKUDetalhe[] = [
    { sku: "SKU001", preco_flat: 15, preco_acao: 12, investimento: 3, expectativa_volume: 50 }
  ];
  const res = calcularCamposConsolidadosInvestimento(null, skus);
  
  assert.strictEqual(res.familia_produto, "Múltiplos SKUs");
  assert.strictEqual(res.preco_flat, 15);
  assert.strictEqual(res.preco_acao, 12);
  assert.strictEqual(res.valor_investimento, 3);
  assert.strictEqual(res.expectativa_volume, 50);
});

// 3. Múltiplas Famílias (Volumes Iguais)
testCase("Múltiplas Famílias com volumes iguais (média aritmética)", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "grao", familia_nome: "Grão", preco_flat: 10, preco_acao: 8, investimento: 2, expectativa_volume: 100 },
    { familia_id: "capsula", familia_nome: "Cápsula", preco_flat: 20, preco_acao: 16, investimento: 4, expectativa_volume: 100 }
  ];
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  
  assert.strictEqual(res.familia_produto, "Grão, Cápsula");
  assert.strictEqual(res.preco_flat, 15); // (10*100 + 20*100) / 200 = 15
  assert.strictEqual(res.preco_acao, 12); // (8*100 + 16*100) / 200 = 12
  assert.strictEqual(res.valor_investimento, 3); // (2*100 + 4*100) / 200 = 3
  assert.strictEqual(res.expectativa_volume, 200);
});

// 4. Múltiplos SKUs (Volumes Iguais)
testCase("Múltiplos SKUs com volumes iguais", () => {
  const skus: SKUDetalhe[] = [
    { sku: "SKU001", preco_flat: 10, preco_acao: 8, investimento: 2, expectativa_volume: 200 },
    { sku: "SKU002", preco_flat: 30, preco_acao: 24, investimento: 6, expectativa_volume: 200 }
  ];
  const res = calcularCamposConsolidadosInvestimento(null, skus);
  
  assert.strictEqual(res.familia_produto, "Múltiplos SKUs");
  assert.strictEqual(res.preco_flat, 20); // (10 + 30) / 2 = 20
  assert.strictEqual(res.preco_acao, 16); // (8 + 24) / 2 = 16
  assert.strictEqual(res.valor_investimento, 4); // (2 + 6) / 2 = 4
  assert.strictEqual(res.expectativa_volume, 400);
});

// 5. Volumes Diferentes (média ponderada)
testCase("Média ponderada com volumes diferentes", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "grao", familia_nome: "Grão", preco_flat: 10, preco_acao: 8, investimento: 2, expectativa_volume: 100 },
    { familia_id: "capsula", familia_nome: "Cápsula", preco_flat: 20, preco_acao: 16, investimento: 5, expectativa_volume: 300 }
  ];
  // Pesos: Grão (1/4), Cápsula (3/4)
  // preco_flat: (10 * 100 + 20 * 300) / 400 = (1000 + 6000) / 400 = 17.5
  // preco_acao: (8 * 100 + 16 * 300) / 400 = (800 + 4800) / 400 = 14
  // valor_investimento: (2 * 100 + 5 * 300) / 400 = (200 + 1500) / 400 = 4.25
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  
  assert.strictEqual(res.preco_flat, 17.5);
  assert.strictEqual(res.preco_acao, 14);
  assert.strictEqual(res.valor_investimento, 4.25);
  assert.strictEqual(res.expectativa_volume, 400);
});

// 6. Valores Nulos / Indefinidos
testCase("Tratamento de valores nulos ou ausentes", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "grao", familia_nome: "Grão", preco_flat: null, preco_acao: undefined as any, investimento: null, expectativa_volume: 100 },
    { familia_id: "capsula", familia_nome: "Cápsula", preco_flat: 20, preco_acao: 10, investimento: 4, expectativa_volume: null as any }
  ];
  // Item 1: vol = 100, flat = 0, acao = 0, inv = 0
  // Item 2: vol = 0, flat = 20, acao = 10, inv = 4
  // Total vol = 100
  // Investimento total = 0 * 100 + 4 * 0 = 0 -> avg = 0
  // Flat total = 0 * 100 + 20 * 0 = 0 -> avg = 0
  // Acao total = 0 * 100 + 10 * 0 = 0 -> avg = 0
  const res = calcularCamposConsolidadosInvestimento(familias, null);
  
  assert.strictEqual(res.preco_flat, 0);
  assert.strictEqual(res.preco_acao, 0);
  assert.strictEqual(res.valor_investimento, 0);
  assert.strictEqual(res.expectativa_volume, 100);
});

// 7. Arrays Vazios ou Nulos
testCase("Arrays vazios ou nulos (valores default)", () => {
  const res1 = calcularCamposConsolidadosInvestimento(null, null);
  assert.strictEqual(res1.familia_produto, "Múltiplos SKUs");
  assert.strictEqual(res1.preco_flat, 0);
  assert.strictEqual(res1.preco_acao, 0);
  assert.strictEqual(res1.valor_investimento, 0);
  assert.strictEqual(res1.expectativa_volume, 0);

  const res2 = calcularCamposConsolidadosInvestimento([], []);
  assert.strictEqual(res2.familia_produto, "Múltiplos SKUs");
  assert.strictEqual(res2.expectativa_volume, 0);
});

// 8. Familia_produto Informada
testCase("Respeita familia_produto pré-informado", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "grao", familia_nome: "Grão", preco_flat: 10, preco_acao: 8, investimento: 2, expectativa_volume: 100 }
  ];
  const res = calcularCamposConsolidadosInvestimento(familias, null, "Linha Especial Gourmet");
  assert.strictEqual(res.familia_produto, "Linha Especial Gourmet");
});

// 9. Ambas as listas informadas (Misto)
testCase("Consolidação mista (Famílias e SKUs)", () => {
  const familias: FamiliaDetalhe[] = [
    { familia_id: "grao", familia_nome: "Grão", preco_flat: 10, preco_acao: 8, investimento: 2, expectativa_volume: 100 }
  ];
  const skus: SKUDetalhe[] = [
    { sku: "SKU001", preco_flat: 20, preco_acao: 16, investimento: 4, expectativa_volume: 100 }
  ];
  // Total vol = 200
  // flat: (1000 + 2000) / 200 = 15
  // acao: (800 + 1600) / 200 = 12
  // inv: (200 + 400) / 200 = 3
  const res = calcularCamposConsolidadosInvestimento(familias, skus);
  
  assert.strictEqual(res.preco_flat, 15);
  assert.strictEqual(res.preco_acao, 12);
  assert.strictEqual(res.valor_investimento, 3);
  assert.strictEqual(res.expectativa_volume, 200);
  assert.strictEqual(res.familia_produto, "Grão"); // Prioriza nome das famílias se houver
});

console.log(`\n======================================`);
console.log(`📊 RESULTADO DOS TESTES UNITÁRIOS:`);
console.log(`======================================`);
console.log(`🟢 Passaram: ${passedTests}`);
console.log(`🔴 Falharam: ${failedTests}`);
console.log(`======================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
