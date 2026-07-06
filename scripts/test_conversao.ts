import assert from "node:assert";
import { ProdutoConversaoService, FatorConversao } from "../src/lib/services/produto-conversao-service";

console.log("🚀 Iniciando testes unitários do ProdutoConversaoService...\n");

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

// Mock factors for testing
const mockFatores: Record<number, FatorConversao[]> = {
  // Café 250g (Grão): peso = 0.25kg, 20 un por caixa, total caixa = 5kg, ativo
  1: [
    {
      id: "uuid-1",
      product_id: 1,
      codigo_integracao: "SKU-0001",
      peso_embalagem_kg: 0.2500,
      unidades_por_caixa: 20,
      peso_total_caixa_kg: 5.0000,
      vigencia_inicio: null,
      vigencia_fim: null,
      ativo: true
    }
  ],
  // Cápsula 50g: peso = 0.05kg, 12 un por caixa, total caixa = 0.6kg, ativo
  2: [
    {
      id: "uuid-2",
      product_id: 2,
      codigo_integracao: "SKU-0002",
      peso_embalagem_kg: 0.0500,
      unidades_por_caixa: 12,
      peso_total_caixa_kg: 0.6000,
      vigencia_inicio: null,
      vigencia_fim: null,
      ativo: true
    }
  ],
  // Produto inativo
  3: [
    {
      id: "uuid-3",
      product_id: 3,
      codigo_integracao: "SKU-0003",
      peso_embalagem_kg: 0.2500,
      unidades_por_caixa: 20,
      peso_total_caixa_kg: 5.0000,
      vigencia_inicio: null,
      vigencia_fim: null,
      ativo: false
    }
  ],
  // Produto com vigência futura (ex: amanhã até daqui a 10 dias)
  4: [
    {
      id: "uuid-4",
      product_id: 4,
      codigo_integracao: "SKU-0004",
      peso_embalagem_kg: 0.2500,
      unidades_por_caixa: 20,
      peso_total_caixa_kg: 5.0000,
      vigencia_inicio: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // Amanhã
      vigencia_fim: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
      ativo: true
    }
  ],
  // Produto com vigência expirada (ex: há 10 dias até ontem)
  5: [
    {
      id: "uuid-5",
      product_id: 5,
      codigo_integracao: "SKU-0005",
      peso_embalagem_kg: 0.2500,
      unidades_por_caixa: 20,
      peso_total_caixa_kg: 5.0000,
      vigencia_inicio: new Date(Date.now() - 86400000 * 10).toISOString().slice(0, 10),
      vigencia_fim: new Date(Date.now() - 86400000).toISOString().slice(0, 10), // Ontem
      ativo: true
    }
  ]
};

const service = new ProdutoConversaoService(mockFatores);

// 1. Unidades -> Caixas
testCase("Unidades para Caixas (Café 250g)", () => {
  const caixas = service.unidadesParaCaixas(1, 100);
  assert.strictEqual(caixas, 5); // 100 / 20 = 5
});

// 2. Caixas -> Unidades
testCase("Caixas para Unidades (Cápsulas)", () => {
  const unidades = service.caixasParaUnidades(2, 5);
  assert.strictEqual(unidades, 60); // 5 * 12 = 60
});

// 3. Kg -> Caixas
testCase("Kg para Caixas (Café 250g)", () => {
  const caixas = service.kgParaCaixas(1, 25);
  assert.strictEqual(caixas, 5); // 25kg / 5kg = 5 caixas
});

// 4. Caixas -> Kg
testCase("Caixas para Kg (Cápsulas)", () => {
  const kg = service.caixasParaKg(2, 10);
  assert.strictEqual(kg, 6); // 10 * 0.6kg = 6kg
});

// 5. Unidades -> Kg
testCase("Unidades para Kg (Café 250g)", () => {
  const kg = service.unidadesParaKg(1, 40);
  assert.strictEqual(kg, 10); // 40 * 0.25kg = 10kg
});

// 6. Kg -> Unidades
testCase("Kg para Unidades (Cápsulas)", () => {
  const unidades = service.kgParaUnidades(2, 3);
  assert.strictEqual(unidades, 60); // 3kg / 0.05kg = 60 unidades
});

// 7. Produto inativo (Erro Controlado)
testCase("Erro ao converter produto inativo", () => {
  assert.throws(() => {
    service.unidadesParaCaixas(3, 100);
  }, /Fator de conversão logística inativo/);
});

// 8. Produto não cadastrado (Erro Controlado)
testCase("Erro ao converter produto não cadastrado", () => {
  assert.throws(() => {
    service.unidadesParaCaixas(99, 100);
  }, /Fator de conversão logística não cadastrado/);
});

// 9. Produto com vigência futura (Erro Controlado)
testCase("Erro ao converter produto com vigência futura", () => {
  assert.throws(() => {
    service.unidadesParaCaixas(4, 100);
  }, /ainda não entrou em vigência/);
});

// 10. Produto com vigência expirada (Erro Controlado)
testCase("Erro ao converter produto expirado", () => {
  assert.throws(() => {
    service.unidadesParaCaixas(5, 100);
  }, /Fator de conversão logística expirado/);
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
