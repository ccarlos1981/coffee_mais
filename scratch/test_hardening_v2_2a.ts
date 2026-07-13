import fs from "fs";
import path from "path";
import Module from "module";

// Mock next/headers
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "next/headers") {
    return {
      cookies: async () => ({
        getAll: () => [],
        get: () => null,
        set: () => {},
      }),
      headers: async () => new Map(),
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// Carregar variáveis de ambiente do .env.local
try {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (err) {
  console.warn("Não foi possível carregar o .env.local:", err);
}

async function runTests() {
  console.log("=== INICIANDO TESTES FUNCIONAIS DE HARDENING V2.2A ===");

  // Import dinâmico das Server Actions
  const { criarAcaoInvestimento, importarInvestimentosEmLote } = await import("../src/app/investimento/lancar/actions");

  let results = { passed: 0, failed: 0 };

  // 1. Testar criarAcaoInvestimento sem autenticação
  try {
    const dummyFormData = new FormData();
    dummyFormData.append("rede", "ZAFFARI");
    dummyFormData.append("abrangencia", "Família");
    dummyFormData.append("data_inicio", "2026-07-01");
    dummyFormData.append("data_fim", "2026-07-31");
    dummyFormData.append("tipo_acao", "Encarte");
    dummyFormData.append("mes_referencia", "2026-07");

    const res = await criarAcaoInvestimento(dummyFormData);
    if (!res.success && res.error?.message?.includes("UNAUTHENTICATED")) {
      console.log("[PASS] criarAcaoInvestimento - Rejeitado com sucesso (Sem autenticação)");
      results.passed++;
    } else {
      console.error("[FAIL] criarAcaoInvestimento - Retornou resultado inesperado:", res);
      results.failed++;
    }
  } catch (err: any) {
    if (err.message?.includes("UNAUTHENTICATED")) {
      console.log("[PASS] criarAcaoInvestimento - Lançou erro de autenticação esperado");
      results.passed++;
    } else {
      console.error("[FAIL] criarAcaoInvestimento - Lançou erro inesperado:", err);
      results.failed++;
    }
  }

  // 2. Testar importarInvestimentosEmLote sem autenticação
  try {
    const res = await importarInvestimentosEmLote([]);
    console.error("[FAIL] importarInvestimentosEmLote - Retornou resultado em vez de falhar:", res);
    results.failed++;
  } catch (err: any) {
    if (err.message?.includes("UNAUTHENTICATED") || err.message?.includes("Não autenticado")) {
      console.log("[PASS] importarInvestimentosEmLote - Lançou erro de autenticação esperado");
      results.passed++;
    } else {
      console.error("[FAIL] importarInvestimentosEmLote - Lançou erro inesperado:", err);
      results.failed++;
    }
  }

  console.log(`\n=== RESULTADO FINAL V2.2A: ${results.passed} Passou, ${results.failed} Falhou ===`);
  if (results.failed > 0) process.exit(1);
}

runTests().catch(console.error);
