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

// Carregar variáveis de ambiente do .env.local de forma síncrona ANTES de qualquer import dinâmico
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
  console.log("=== INICIANDO TESTES FUNCIONAIS DE HARDENING V2.1 ===");

  // Imports dinâmicos para garantir que as variáveis de ambiente já foram injetadas
  const { GET: getDRE } = await import("../src/app/api/dre/route");
  const { POST: uploadExcel } = await import("../src/app/api/import/excel/upload/route");
  const { POST: confirmExcel } = await import("../src/app/api/import/excel/confirm/route");
  const { POST: rollbackExcel } = await import("../src/app/api/import/rollback/route");
  const { GET: debugDashboard } = await import("../src/app/api/dashboard/debug/route");

  // Helper para criar requests mockados
  const createMockRequest = (method: string, url: string, headers: Record<string, string> = {}, body?: any) => {
    return new Request(url, {
      method,
      headers: new Headers(headers),
      body: body ? JSON.stringify(body) : undefined
    });
  };

  const results = { passed: 0, failed: 0 };

  const assertStatus = async (name: string, response: Response, expectedStatus: number) => {
    const status = response.status;
    let data;
    try {
      data = await response.json();
    } catch {
      data = "(no json)";
    }
    if (status === expectedStatus) {
      console.log(`[PASS] ${name} -> Status: ${status} (Esperado: ${expectedStatus})`);
      results.passed++;
    } else {
      console.error(`[FAIL] ${name} -> Status: ${status} (Esperado: ${expectedStatus}). Response:`, data);
      results.failed++;
    }
  };

  // 1. Testes Negativos (Sem Autenticação)
  console.log("\n--- Cenário 1: Chamadas Anônimas (Sem Autenticação) ---");

  const reqDREAnon = createMockRequest("GET", "http://localhost:3000/api/dre");
  const resDREAnon = await getDRE(reqDREAnon);
  await assertStatus("GET /api/dre - Anonymous", resDREAnon, 401);

  const reqUploadAnon = createMockRequest("POST", "http://localhost:3000/api/import/excel/upload") as any;
  const resUploadAnon = await uploadExcel(reqUploadAnon);
  await assertStatus("POST /api/import/excel/upload - Anonymous", resUploadAnon, 401);

  const reqConfirmAnon = createMockRequest("POST", "http://localhost:3000/api/import/excel/confirm", {}, { batchId: "test", mode: "append" }) as any;
  const resConfirmAnon = await confirmExcel(reqConfirmAnon);
  await assertStatus("POST /api/import/excel/confirm - Anonymous", resConfirmAnon, 401);

  const reqRollbackAnon = createMockRequest("POST", "http://localhost:3000/api/import/rollback", {}, { batchId: "test" }) as any;
  const resRollbackAnon = await rollbackExcel(reqRollbackAnon);
  await assertStatus("POST /api/import/rollback - Anonymous", resRollbackAnon, 401);

  const reqDebugAnon = createMockRequest("GET", "http://localhost:3000/api/dashboard/debug");
  const resDebugAnon = await debugDashboard(reqDebugAnon);
  await assertStatus("GET /api/dashboard/debug - Anonymous", resDebugAnon, 401);

  // 2. Testes de Validação de Método HTTP (405 Method Not Allowed)
  console.log("\n--- Cenário 2: Validação de Métodos HTTP (Métodos Inválidos) ---");

  const reqDREInvalid = createMockRequest("POST", "http://localhost:3000/api/dre", {}, {});
  const resDREInvalid = await getDRE(reqDREInvalid);
  await assertStatus("POST /api/dre - Invalid Method", resDREInvalid, 405);

  const reqUploadInvalid = createMockRequest("GET", "http://localhost:3000/api/import/excel/upload") as any;
  const resUploadInvalid = await uploadExcel(reqUploadInvalid);
  await assertStatus("GET /api/import/excel/upload - Invalid Method", resUploadInvalid, 405);

  console.log(`\n=== RESULTADO FINAL: ${results.passed} Passou, ${results.failed} Falhou ===`);
}

runTests().catch(console.error);
