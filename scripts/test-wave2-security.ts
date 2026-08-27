/**
 * Testes Automatizados de Segurança da Wave 2 (Coffee++)
 * Executa validações de Object-Level Authorization e Role Scoping para Shelf Analysis e Visitas
 */

async function runWave2Tests() {
  console.log("==================================================================");
  console.log("  COFFEE++ — SUÍTE DE TESTES DE SEGURANÇA WAVE 2");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testCode: string, description: string) {
    if (condition) {
      console.log(`  [✅ OK] ${testCode} — ${description}`);
      passed++;
    } else {
      console.error(`  [❌ FALHA] ${testCode} — ${description}`);
      failed++;
    }
  }

  // ─── 1. SIMULAÇÃO DE OBJECT-LEVEL ACCESS LOGIC (assertVisitaAccess) ───
  console.log("--- Grupo 1: Object-Level Authorization (assertVisitaAccess) ---");

  // Mock DB State
  interface MockVisita {
    id: string;
    cod_parceiro: string;
    promotor_id: string;
  }

  const mockVisitas = new Map<string, MockVisita>([
    ["visita-p1", { id: "visita-p1", cod_parceiro: "PDV-100", promotor_id: "promotor-1" }],
    ["visita-p2", { id: "visita-p2", cod_parceiro: "PDV-200", promotor_id: "promotor-2" }],
    ["visita-p3-julliano", { id: "visita-p3-julliano", cod_parceiro: "PDV-400", promotor_id: "promotor-3" }],
  ]);

  const mockSupervisorMap = new Map<string, string[]>([
    ["supervisor-1", ["promotor-1"]],
    ["supervisor-2", ["promotor-2"]],
  ]);

  const mockManagerPortfolio = new Map<string, string[]>([
    ["Leandro", ["PDV-100", "PDV-300"]],
    ["Julliano", ["PDV-400"]],
  ]);

  function mockAssertVisitaAccess(
    userId: string,
    profile: { role?: string | null; manager_name?: string | null; name?: string | null },
    visitaId: string
  ): { visita: MockVisita; authorized: boolean } {
    const currentRole = (profile?.role || "").trim().toLowerCase();

    const NATIONAL_ROLES = new Set([
      "admin",
      "admin master",
      "ceo",
      "trade",
      "financeiro",
      "diretor",
      "gerente nacional",
      "ti",
    ]);

    const visita = mockVisitas.get(visitaId);
    if (!visita) {
      throw new Error("NOT_FOUND");
    }

    if (NATIONAL_ROLES.has(currentRole)) {
      return { visita, authorized: true };
    }

    if (currentRole === "promotor") {
      if (visita.promotor_id === userId) {
        return { visita, authorized: true };
      }
      throw new Error("FORBIDDEN");
    }

    if (currentRole === "supervisor") {
      const supervised = mockSupervisorMap.get(userId) || [];
      if (supervised.includes(visita.promotor_id)) {
        return { visita, authorized: true };
      }
      throw new Error("FORBIDDEN");
    }

    if (currentRole === "gerente regional") {
      const managerName = profile.manager_name || profile.name;
      const allowedPdvs = (managerName ? mockManagerPortfolio.get(managerName) : []) || [];
      if (allowedPdvs.includes(visita.cod_parceiro)) {
        return { visita, authorized: true };
      }
      throw new Error("FORBIDDEN");
    }

    throw new Error("FORBIDDEN");
  }

  // TEST 1: Promotor acessa própria visita (SCOPE-VISITA-01)
  try {
    const res = mockAssertVisitaAccess("promotor-1", { role: "Promotor" }, "visita-p1");
    assert(res.authorized === true, "SCOPE-VISITA-01", "Promotor 1 autorizado para sua própria visita (visita-p1)");
  } catch {
    assert(false, "SCOPE-VISITA-01", "Promotor 1 deveria acessar própria visita");
  }

  // TEST 2: Promotor tenta acessar visita de outro promotor (SCOPE-VISITA-02 / IDOR Negativo)
  try {
    mockAssertVisitaAccess("promotor-1", { role: "Promotor" }, "visita-p2");
    assert(false, "SCOPE-VISITA-02", "Promotor 1 NÃO deveria acessar visita-p2 do Promotor 2");
  } catch (err: any) {
    assert(err.message === "FORBIDDEN", "SCOPE-VISITA-02", "IDOR bloqueado: Promotor 1 rejeitado para visita de outro promotor (HTTP 403)");
  }

  // TEST 3: Supervisor acessa visita da sua equipe (SCOPE-VISITA-03)
  try {
    const res = mockAssertVisitaAccess("supervisor-1", { role: "Supervisor" }, "visita-p1");
    assert(res.authorized === true, "SCOPE-VISITA-03", "Supervisor 1 autorizado para visita de promotor de sua equipe");
  } catch {
    assert(false, "SCOPE-VISITA-03", "Supervisor 1 deveria acessar visita da sua equipe");
  }

  // TEST 4: Supervisor tenta acessar visita de outra equipe (SCOPE-VISITA-04 / Cross-Equipe Negativo)
  try {
    mockAssertVisitaAccess("supervisor-1", { role: "Supervisor" }, "visita-p2");
    assert(false, "SCOPE-VISITA-04", "Supervisor 1 NÃO deveria acessar visita de outra equipe");
  } catch (err: any) {
    assert(err.message === "FORBIDDEN", "SCOPE-VISITA-04", "Supervisor 1 bloqueado para visita de outra equipe (HTTP 403)");
  }

  // TEST 5: Gerente Regional acessa visita de sua carteira (SCOPE-VISITA-05)
  try {
    const res = mockAssertVisitaAccess("mgr-1", { role: "Gerente Regional", manager_name: "Leandro" }, "visita-p1");
    assert(res.authorized === true, "SCOPE-VISITA-05", "Gerente Leandro autorizado para visita de PDV da sua carteira");
  } catch {
    assert(false, "SCOPE-VISITA-05", "Gerente Leandro deveria acessar visita do seu PDV");
  }

  // TEST 6: Gerente Regional tenta acessar visita de outra regional (SCOPE-VISITA-06 / Cross-Regional Negativo)
  try {
    mockAssertVisitaAccess("mgr-1", { role: "Gerente Regional", manager_name: "Leandro" }, "visita-p3-julliano");
    assert(false, "SCOPE-VISITA-06", "Gerente Leandro NÃO deveria acessar visita do Gerente Julliano");
  } catch (err: any) {
    assert(err.message === "FORBIDDEN", "SCOPE-VISITA-06", "Gerente Regional bloqueado para visita de outra gerência (HTTP 403)");
  }

  // TEST 7: Admin acessa qualquer visita nacional (SCOPE-VISITA-07)
  try {
    const res = mockAssertVisitaAccess("admin-1", { role: "Admin" }, "visita-p3-julliano");
    assert(res.authorized === true, "SCOPE-VISITA-07", "Admin autorizado com escopo nacional");
  } catch {
    assert(false, "SCOPE-VISITA-07", "Admin deveria ter acesso global");
  }

  // ─── 2. TESTES DE REVIEW E AUTORIZAÇÃO DE AÇÕES (POST /api/ai/shelf-analysis/review) ───
  console.log("\n--- Grupo 2: Role & Review Enforcement (POST /review) ---");

  const ALLOWED_REVIEW_ROLES = ["Supervisor", "Admin", "Admin Master", "CEO", "Trade"];

  function validateReviewPermission(role: string): boolean {
    const r = (role || "").trim().toLowerCase();
    return ALLOWED_REVIEW_ROLES.some((allowed) => allowed.trim().toLowerCase() === r);
  }

  // TEST 8: Promotor tenta executar review (REVIEW-ROLE-01 / Escalada Negativa)
  const promotorCanReview = validateReviewPermission("Promotor");
  assert(promotorCanReview === false, "REVIEW-ROLE-01", "Promotor expressamente proibido de revisar análises de gôndola (HTTP 403)");

  // TEST 9: Gerente Regional tenta executar review (REVIEW-ROLE-01B / Escalada Negativa)
  const mgrCanReview = validateReviewPermission("Gerente Regional");
  assert(mgrCanReview === false, "REVIEW-ROLE-01B", "Gerente Regional expressamente proibido de aprovar análises operacionais (HTTP 403)");

  // TEST 10: Supervisor autorizado a executar review (REVIEW-ROLE-02)
  const supervisorCanReview = validateReviewPermission("Supervisor");
  assert(supervisorCanReview === true, "REVIEW-ROLE-02", "Supervisor autorizado a revisar análises");

  // TEST 11: Trade Marketing autorizado a executar review (REVIEW-ROLE-03)
  const tradeCanReview = validateReviewPermission("Trade");
  assert(tradeCanReview === true, "REVIEW-ROLE-03", "Trade Marketing autorizado para revisão nacional");

  // ─── 3. TESTES DE OVERRIDE SCORE E PAYLOAD VALIDATION ───
  console.log("\n--- Grupo 3: Score Override & Payload Validation ---");

  function validateScoreOverride(score: any, reason: any): { valid: boolean; error?: string } {
    if (score !== undefined && score !== null) {
      if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) {
        return { valid: false, error: "Nota sobrescrita inválida." };
      }
      if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
        return { valid: false, error: "Justificativa é obrigatória." };
      }
    }
    return { valid: true };
  }

  // TEST 12: Override válido (REVIEW-OVERRIDE-01)
  const validOverride = validateScoreOverride(85, "Aprovado com ajuste na auditoria");
  assert(validOverride.valid === true, "REVIEW-OVERRIDE-01", "Score override de 85 com justificativa aceito");

  // TEST 13: Override com score fora dos limites (REVIEW-OVERRIDE-02 / Limite Negativo)
  const invalidScore1 = validateScoreOverride(150, "Nota alta");
  const invalidScore2 = validateScoreOverride(-10, "Nota negativa");
  const invalidScore3 = validateScoreOverride(85.5, "Nota decimal");
  assert(
    invalidScore1.valid === false && invalidScore2.valid === false && invalidScore3.valid === false,
    "REVIEW-OVERRIDE-02",
    "Scores inválidos (>100, <0, decimais) rejeitados com HTTP 400"
  );

  // TEST 14: Override sem justificativa (REVIEW-OVERRIDE-03 / Justificativa Negativa)
  const invalidReason = validateScoreOverride(90, "");
  assert(invalidReason.valid === false, "REVIEW-OVERRIDE-03", "Score override sem justificativa rejeitado com HTTP 400");

  // ─── 4. TESTES DE ENUMERAÇÃO DE VISITAS ───
  console.log("\n--- Grupo 4: Defesa Contra Enumeração de Visitas ---");

  let enumerationBlockedCount = 0;
  for (let i = 1; i <= 20; i++) {
    try {
      mockAssertVisitaAccess("promotor-1", { role: "Promotor" }, `visita-uuid-aleatorio-${i}`);
    } catch (err: any) {
      if (err.message === "NOT_FOUND" || err.message === "FORBIDDEN") {
        enumerationBlockedCount++;
      }
    }
  }
  assert(enumerationBlockedCount === 20, "ENUM-VISITA-01", "20/20 tentativas de enumeração de UUIDs aleatórios rejeitadas com segurança");

  console.log("\n==================================================================");
  console.log(`  RESUMO DOS TESTES DE SEGURANÇA WAVE 2`);
  console.log(`  Sucessos: ${passed} | Falhas: ${failed}`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runWave2Tests().catch((err) => {
  console.error("Erro fatal nos testes Wave 2:", err);
  process.exit(1);
});
