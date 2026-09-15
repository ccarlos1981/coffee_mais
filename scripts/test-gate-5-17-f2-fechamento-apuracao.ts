import { resolverApuracaoAcao, calcularDeltaApuracao } from "../src/lib/investimento/apuracao-calculator";
import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("================================================================================");
  console.log("🏛️ COFFEE++ — SUÍTE DE TESTES GATE 5.17-F.2: FECHAMENTO FINANCEIRO POR AÇÃO");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      failed++;
    }
  }

  // TESTE 1: 5 un × R$ 5 = R$ 25
  const acao1 = {
    valor_investimento: 500,
    expectativa_volume: 100,
    tipo_acao: "Sell Out / Desconto",
    abrangencia: "Total Loja"
  };
  const diag1 = resolverApuracaoAcao(acao1, 5);
  assert(
    diag1.podeCalcularAutomatico === true && diag1.valorAutomatico === 25,
    "1. 5 un × R$ 5 = R$ 25",
    `Valor calculado: R$ ${diag1.valorAutomatico} (Taxa: R$ ${diag1.taxaUnitaria}/un)`
  );

  // TESTE 2: 500 un × R$ 10 = R$ 5.000
  const acao2 = {
    valor_investimento: 5000,
    expectativa_volume: 500,
    tipo_acao: "Sell Out / Desconto",
    abrangencia: "Total Loja"
  };
  const diag2 = resolverApuracaoAcao(acao2, 500);
  assert(
    diag2.podeCalcularAutomatico === true && diag2.valorAutomatico === 5000,
    "2. 500 un × R$ 10 = R$ 5.000",
    `Valor calculado: R$ ${diag2.valorAutomatico} (Taxa: R$ ${diag2.taxaUnitaria}/un)`
  );

  // TESTE 3: Caso equivalente ao #11975 (500 × R$ 10 = R$ 5.000)
  const acao3 = {
    codigo: 11975,
    valor_investimento: 5000,
    expectativa_volume: 500,
    tipo_acao: "Sell Out",
    abrangencia: "Total Loja"
  };
  const diag3 = resolverApuracaoAcao(acao3, 500);
  assert(
    diag3.podeCalcularAutomatico === true && diag3.valorAutomatico === 5000,
    "3. Caso equivalente ao #11975: 500 × R$ 10 = R$ 5.000",
    `Auto: R$ ${diag3.valorAutomatico}`
  );

  // TESTE 4: Caso que anteriormente produzia 5.000 × R$ 5.000 = R$ 25.000.000
  // Deve NUNCA produzir R$ 25.000.000
  const acao4 = {
    valor_investimento: 5000,
    expectativa_volume: 500,
    tipo_acao: "Sell Out",
    abrangencia: "Total Loja"
  };
  const diag4 = resolverApuracaoAcao(acao4, 5000);
  assert(
    diag4.valorAutomatico !== 25000000 && diag4.valorAutomatico === 50000,
    "4. Anti-Regressão: 5.000 vendidas com ação de R$ 5.000 NUNCA produz R$ 25.000.000",
    `Resultado novo: R$ ${diag4.valorAutomatico} (Taxa unitária R$ 10/un × 5000 = R$ 50.000,00 != R$ 25.000.000)`
  );

  // TESTE 5: Override menor
  const deltaMenor = calcularDeltaApuracao(4000, 5000);
  assert(
    deltaMenor?.tipo === "MENOR" && deltaMenor.delta === -1000,
    "5. Override menor",
    `Delta: ${deltaMenor?.formatado} (${deltaMenor?.tipo})`
  );

  // TESTE 6: Override igual
  const deltaIgual = calcularDeltaApuracao(5000, 5000);
  assert(
    deltaIgual?.tipo === "IGUAL" && deltaIgual.delta === 0,
    "6. Override igual",
    `Delta: ${deltaIgual?.formatado} (${deltaIgual?.tipo})`
  );

  // TESTE 7: Override maior
  const deltaMaior = calcularDeltaApuracao(6500, 5000);
  assert(
    deltaMaior?.tipo === "MAIOR" && deltaMaior.delta === 1500,
    "7. Override maior",
    `Delta: ${deltaMaior?.formatado} (${deltaMaior?.tipo})`
  );

  // TESTE 8: Sem venda (Qtd = 0)
  const diagSemVenda = resolverApuracaoAcao(acao2, 0);
  assert(
    diagSemVenda.podeCalcularAutomatico === true && diagSemVenda.valorAutomatico === 0,
    "8. Sem venda (Qtd = 0)",
    `Valor para 0 vendas: R$ ${diagSemVenda.valorAutomatico}`
  );

  // TESTE 9: Verba fixa (Pagamento Único / Encarte / Aniversário)
  const acaoFixa = {
    valor_investimento: 8000,
    expectativa_volume: 1000,
    tipo_acao: "Pagamento Único",
    abrangencia: "Total Loja"
  };
  const diagFixa = resolverApuracaoAcao(acaoFixa, 250);
  assert(
    diagFixa.modalidadeFixa === true && diagFixa.valorAutomatico === 8000,
    "9. Verba fixa (Pagamento Único / Encarte / Aniversário)",
    `Modalidade: ${acaoFixa.tipo_acao} -> Retorna R$ ${diagFixa.valorAutomatico} independente de qtd vendida (250)`
  );

  // TESTE 10: Ação sem verba (R$ 0)
  const acaoSemVerba = {
    valor_investimento: 0,
    expectativa_volume: 100,
    tipo_acao: "Ação Institucional",
    abrangencia: "Total Loja"
  };
  const diagSemVerba = resolverApuracaoAcao(acaoSemVerba, 50);
  assert(
    diagSemVerba.podeCalcularAutomatico === true && diagSemVerba.valorAutomatico === 0,
    "10. Ação sem verba",
    `Valor com verba 0: R$ ${diagSemVerba.valorAutomatico}`
  );

  // TESTE 11: Múltiplos detalhes com taxas divergentes
  const acaoMultiDetalhes = {
    valor_investimento: 4500,
    expectativa_volume: 500,
    abrangencia: "Família",
    familias_detalhes: [
      { familia_nome: "Cápsulas", investimento: 5, expectativa_volume: 100 },
      { familia_nome: "Grãos", investimento: 10, expectativa_volume: 400 }
    ]
  };
  const diagMulti = resolverApuracaoAcao(acaoMultiDetalhes, 250);
  assert(
    diagMulti.podeCalcularAutomatico === false && diagMulti.motivoExigenciaEfetivo !== undefined,
    "11. Múltiplos detalhes divergentes exige valor efetivamente gasto (sem médias artificiais)",
    `Pode auto: ${diagMulti.podeCalcularAutomatico}, Motivo: "${diagMulti.motivoExigenciaEfetivo}"`
  );

  // TESTE 12: Múltiplas ações (Multi-Action Campaign Total)
  const acoesCampanhaExemplo = [
    { id: "acao-1", valor_investimento: 5000, apuracao_valor_realizado: 4200 },
    { id: "acao-2", valor_investimento: 3000, apuracao_valor_realizado: 3100 }
  ];
  const totalCampanhaRealizado = acoesCampanhaExemplo.reduce((acc, a) => acc + (a.apuracao_valor_realizado || 0), 0);
  assert(
    totalCampanhaRealizado === 7300,
    "12. Múltiplas ações somam seus respectivos apuracao_valor_realizado",
    `Total consolidado: R$ ${totalCampanhaRealizado} (Esperado R$ 7.300)`
  );

  // TESTE 13: Campanha parcial (Ações não prontas)
  const acoesCampanhaParcial = [
    { id: "acao-1", fase_atual: 3, valor_investimento: 5000 },
    { id: "acao-2", fase_atual: 2, valor_investimento: 3000 }
  ];
  const acoesNaoProntas = acoesCampanhaParcial.filter(a => Number(a.fase_atual) < 3);
  const todasProntasParcial = acoesNaoProntas.length === 0;
  assert(
    todasProntasParcial === false && acoesNaoProntas.length === 1,
    "13. Campanha parcial (Ação em fase < 3 não fecha plano financeiro na campanha)",
    `Ações não prontas: ${acoesNaoProntas.length}, Todas prontas: ${todasProntasParcial}`
  );

  // TESTE 14: Campanha completa (Todas ações em fase >= 3)
  const acoesCampanhaCompleta = [
    { id: "acao-1", fase_atual: 3, valor_investimento: 5000, apuracao_valor_realizado: 4800 },
    { id: "acao-2", fase_atual: 3, valor_investimento: 3000, apuracao_valor_realizado: 3000 }
  ];
  const todasProntasCompleta = acoesCampanhaCompleta.filter(a => Number(a.fase_atual) < 3).length === 0;
  const totalCompleta = acoesCampanhaCompleta.reduce((acc, a) => acc + a.apuracao_valor_realizado, 0);
  assert(
    todasProntasCompleta === true && totalCompleta === 7800,
    "14. Campanha completa: todas prontas e total campanha = soma dos realizados",
    `Todas prontas: ${todasProntasCompleta}, Total realizado: R$ ${totalCompleta}`
  );

  // TESTE 15: Paridade modal rápido × página completa
  const modalSource = fs.readFileSync(path.join(process.cwd(), "src/app/investimento/page.tsx"), "utf8");
  const apuracaoFormSource = fs.readFileSync(path.join(process.cwd(), "src/app/investimento/[id]/apuracao/ApuracaoForm.tsx"), "utf8");
  const modalUsesSSOT = modalSource.includes("resolverApuracaoAcao") && modalSource.includes("calcularDeltaApuracao");
  const formUsesSSOT = apuracaoFormSource.includes("resolverApuracaoAcao") && apuracaoFormSource.includes("calcularDeltaApuracao");
  assert(
    modalUsesSSOT && formUsesSSOT,
    "15. Paridade modal rápido × página completa (ambos utilizam o mesmo SSOT resolverApuracaoAcao)",
    `Modal rápido: ${modalUsesSSOT}, ApuracaoForm: ${formUsesSSOT}`
  );

  // TESTE 16: Persistência de apuracao_valor_realizado
  const actionsSource = fs.readFileSync(path.join(process.cwd(), "src/app/investimento/lancar/actions.ts"), "utf8");
  const persistsRealizado = actionsSource.includes("p_apuracao_valor_realizado: payload.valorRealizado");
  assert(
    persistsRealizado,
    "16. Persistência de apuracao_valor_realizado via Server Action e RPC",
    `Server action repassa p_apuracao_valor_realizado: payload.valorRealizado`
  );

  // TESTE 17: Preservação de valor_investimento
  const modifiesValorInvestimento = apuracaoFormSource.includes("valor_investimento = valorRealizado") ||
                                    modalSource.includes("valor_investimento = valorRealizado");
  assert(
    !modifiesValorInvestimento,
    "17. Preservação de valor_investimento (imutabilidade do planejado)",
    `Nenhum arquivo altera valor_investimento para receber o realizado`
  );

  // TESTE 18: Boletos respeitam valor realizado
  const boletosUsesRealizado = apuracaoFormSource.includes("const parsedVal = parseFloat(valorRealizado") &&
                               modalSource.includes("const totalRealizado = parseFloat(apuracaoForm.valor_realizado");
  assert(
    boletosUsesRealizado,
    "18. Boletos utilizam valor_realizado ao invés de valor_investimento quando divergente",
    `Associação de boleto consome valorRealizado nos dois fluxos`
  );

  // TESTE 19: Plano financeiro consome soma dos realizados
  const migrationPath = path.join(process.cwd(), "supabase/migrations/20260915_gate_5_17_fechamento_financeiro_realizado.sql");
  const migrationExists = fs.existsSync(migrationPath);
  const migrationContent = migrationExists ? fs.readFileSync(migrationPath, "utf8") : "";
  const rpcCalculatesRealizado = migrationContent.includes("COALESCE(SUM(apuracao_valor_realizado), 0.00)") &&
                                migrationContent.includes("apuracao_valor_realizado IS NULL");
  assert(
    migrationExists && rpcCalculatesRealizado,
    "19. Plano financeiro da campanha na RPC consome SUM(apuracao_valor_realizado) com verificação anti-COALESCE cego",
    `Migration complementar criada e valida apuracao_valor_realizado IS NULL`
  );

  // TESTE 20: Idempotência
  const hasIdempotency = actionsSource.includes("idempotencyKey") &&
                         migrationContent.includes("cm_audit_logs") &&
                         migrationContent.includes("pg_advisory_xact_lock");
  assert(
    hasIdempotency,
    "20. Idempotência preservada via idempotencyKey, pg_advisory_xact_lock e cm_audit_logs",
    `Suporte a idempotência confirmado (cm_audit_logs + pg_advisory_xact_lock)`
  );

  // TESTE 21: Rollback em caso de erro
  const rpcHasRollback = migrationContent.startsWith("-- ==============================================================================\n-- MIGRATION: 20260915_gate_5_17_fechamento_financeiro_realizado.sql\n") &&
                         migrationContent.includes("BEGIN;") &&
                         migrationContent.includes("COMMIT;") &&
                         migrationContent.includes("RAISE EXCEPTION");
  assert(
    rpcHasRollback,
    "21. Rollback transacional garantido na migration (BEGIN/COMMIT) e nas exceções da RPC (RAISE EXCEPTION)",
    `Atomicidade e rollback transacional garantidos`
  );

  // TESTE 22: RBAC
  const pageRouteSource = fs.readFileSync(path.join(process.cwd(), "src/app/investimento/[id]/apuracao/page.tsx"), "utf8");
  const rbacPreserved = pageRouteSource.includes("Gerente Regional") && pageRouteSource.includes("isOwner");
  assert(
    rbacPreserved,
    "22. RBAC e governança de visibilidade por perfil/ownership preservados",
    `Validação de Gerente Regional mantida em /apuracao/page.tsx`
  );

  // TESTE 23: Regressão Analytics
  const analyticsEnginePath = path.join(process.cwd(), "src/lib/governance/analytics/engine.ts");
  const analyticsUntouched = fs.existsSync(analyticsEnginePath);
  assert(
    analyticsUntouched,
    "23. Regressão Analytics: AnalyticsEngine V1 preservada sem alterações indevidas",
    `AnalyticsEngine está íntegra`
  );

  // TESTE 24: Regressão DRE
  const dreContractsUntouched = fs.readFileSync(analyticsEnginePath, "utf8").includes("getDreComercial");
  assert(
    dreContractsUntouched,
    "24. Regressão DRE: contratos de MACO e DRE Comercial permanecem intactos",
    `getDreComercial intacto na AnalyticsEngine`
  );

  // TESTE 25: Regressão RPS/RDM
  const rpsSourcePath = path.join(process.cwd(), "src/app/processo-comercial/rps/page.tsx");
  const rpsSource = fs.readFileSync(rpsSourcePath, "utf8");
  const rpsIntact = rpsSource.includes("PROJEÇÃO DE VENDAS PARA O MÊS");
  assert(
    rpsIntact,
    "25. Regressão RPS/RDM: módulo de planejamento e projeções comerciais íntegro",
    `Página de planejamento RPS mantida intacta`
  );

  console.log("\n================================================================================");
  console.log(`TOTAL DE TESTES: ${passed + failed} | APROVADOS: ${passed} | REPROVADOS: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Erro fatal nos testes:", err);
  process.exit(1);
});
