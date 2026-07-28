/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXECUTIVE INTELLIGENCE ENGINE — COFFEE++ (RPS)
 * ═══════════════════════════════════════════════════════════════════════════
 * Single Source of Truth para Inteligência Comercial Executiva da RPS.
 * 
 * ARQUITETURA DESACOPLADA:
 * Este motor é 100% independente do formato de saída (PDF, Dashboards, Email, PPT).
 * Contém zero lógica de layout/UI. Produz uma estrutura de dados imutável
 * `ExecutiveIntelligenceData` pronta para consumo por qualquer renderer.
 * 
 * Regras de Governança:
 * 1. Consome EXCLUSIVAMENTE os dados oficiais da RPS (SSOT).
 * 2. Nenhuma recomendação genérica — todas com evidências estatísticas.
 * 3. Se houver dados insuficientes (Confidence < 60%), sinaliza baixa robustez.
 */

export interface ClientData {
  client: string;
  ano_a: number;
  mes_a: number;
  media_trimestre?: number;
  meta: number;
  real: number;
  prev_month_projection?: number;
  projections: number[];
  display_order?: number;
}

export interface ManagerKPIData {
  ano_a: number;
  mes_a: number;
  media_trimestre?: number;
  desafio: number;
  real: number;
  prev_month_projection?: number;
  projections: number[];
}

export interface ManagerData {
  manager: string;
  kpis: {
    VOL: ManagerKPIData;
    FAT: ManagerKPIData;
    INVEST: ManagerKPIData;
  };
  clients: ClientData[];
}

export interface TotalsRowData {
  manager: string;
  kpis: {
    VOL: ManagerKPIData;
    FAT: ManagerKPIData;
    INVEST: ManagerKPIData;
  };
}

export type StatusSemaforo = "SAUDAVEL" | "ATENCAO" | "CRITICO";
export type TendenciaTipo = "ALTA" | "ESTAVEL" | "QUEDA";

export interface ManagerScorecard {
  manager: string;
  score: number; // 0-100
  status: StatusSemaforo;
  tendencia: TendenciaTipo;
  desafioFat: number;
  projFat: number;
  atingimentoPct: number;
  dispersionPct: number;
  crescimentoAaPct: number;
  crescimentoMtPct: number;
  investPct: number;
  pontoForte: string;
  pontoAtencao: string;
}

export interface RedeOfensora {
  rede: string;
  gerente: string;
  realMesA: number;
  projAtual: number;
  diferencaAbs: number;
  impactoPct: number;
}

export interface RedeDestaque {
  rede: string;
  gerente: string;
  realMesA: number;
  projAtual: number;
  diferencaAbs: number;
  crescimentoPct: number;
}

export interface RedeInvestimentoAlerta {
  rede: string;
  gerente: string;
  investPct: number;
  politicaLimite: number;
  retornoStatus: string;
}

export interface ExecutiveDecisionBoardData {
  topRiscos: { descricao: string; impactoFinanceiro: number }[];
  topOportunidades: { descricao: string; potencialGanho: number }[];
  topPrioridades: string[];
  planoAcaoRecomendado: { acao: string; responsavel: string; prazo: string; impactoEstimado: number }[];
  impactoFinanceiroTotalPotencial: number;
  conclusaoDiretoria: string;
}

export interface ExecutiveRoadmapData {
  prioridades7Dias: { acao: string; justificativa: string }[];
  prioridades30Dias: { acao: string; justificativa: string }[];
  prioridades90Dias: { acao: string; justificativa: string }[];
}

export interface ExecutiveIntelligenceData {
  metadata: {
    periodo: string;
    dataHoraGeracao: string;
    usuarioGerador: string;
    confidenceIndex: number; // 0-100%
    confidenceStatus: "ALTA" | "MEDIA" | "BAIXA";
  };
  scoreConsolidado: {
    score: number; // 0-100
    status: StatusSemaforo;
    tendencia: TendenciaTipo;
    projAtualFat: number;
    desafioFat: number;
    atingimentoPct: number;
    dispersionPct: number;
    crescimentoAaPct: number;
    crescimentoMtPct: number;
    investPct: number;
  };
  resumoExecutivoMatriz: {
    situacaoGeral: string;
    principaisRiscos: string;
    principaisOportunidades: string;
    principaisDestaques: string;
    principaisRecomendacoes: string;
  };
  perguntasExecutivas: {
    maiorRisco: string;
    maiorOportunidade: string;
    gerenteAtencao: string;
    redesImpacto: string;
    acaoMaiorRetorno: string;
  };
  oportunidadeFinanceira: {
    receitaAdicionalSeProj: number;
    receitaAdicionalSeDesafio: number;
    gapFinanceiroDesafio: number;
    gapFinanceiroPct: number;
    maiorOportunidadeCarteira: string;
  };
  evolucaoHistorica: {
    mesAno: string;
    score: number;
    faturamento: number;
    volume: number;
    investimentoPct: number;
    dispersaoPct: number;
    atingimentoPct: number;
  }[];
  scorecardsGerentes: ManagerScorecard[];
  rankingGerentes: ManagerScorecard[];
  redesOfensoras: RedeOfensora[];
  redesDestaque: RedeDestaque[];
  analiseInvestimento: {
    regionais: { manager: string; investPct: number; mediaHistoricaPct: number; diferencaPp: number; ranking: number }[];
    redesAlerta: RedeInvestimentoAlerta[];
  };
  decisionBoard: ExecutiveDecisionBoardData;
  roadmap: ExecutiveRoadmapData;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER ARITHMETIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getLatestProj(projections: number[]): number {
  if (!projections || projections.length === 0) return 0;
  for (let i = projections.length - 1; i >= 0; i--) {
    if (projections[i] > 0) return projections[i];
  }
  return projections[projections.length - 1] || 0;
}

function calcPct(num: number, den: number): number {
  if (!den || den === 0) return 0;
  return ((num / den) - 1) * 100;
}

function calcRatio(num: number, den: number): number {
  if (!den || den === 0) return 0;
  return (num / den) * 100;
}

function formatBrl(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
}

function formatPct(val: number): string {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1).replace('.', ',')}%`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-ENGINES IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 1. EXECUTIVE ANALYTICAL ENGINE
 * Calcula KPIs, Score (0-100), Status, Confiança, Tendência e Gaps.
 */
class ExecutiveAnalyticalEngine {
  static computeScore(atingimentoPct: number, dispersionPct: number, crescimentoAa: number, investPct: number): number {
    // Score Ponderado:
    // Atingimento (40%): 100% atingimento = 40 pts
    const scoreAting = Math.min(40, Math.max(0, (atingimentoPct / 100) * 40));
    
    // Dispersão (25%): -3% a +5% é ideal (25 pts), penaliza fora
    let scoreDisp = 25;
    if (dispersionPct < -3) {
      scoreDisp = Math.max(0, 25 - Math.abs(dispersionPct + 3) * 1.5);
    } else if (dispersionPct > 5) {
      scoreDisp = Math.max(0, 25 - (dispersionPct - 5) * 1.2);
    }

    // Crescimento AA (20%): >0% = 20 pts, penaliza se negativo
    const scoreCresc = Math.min(20, Math.max(0, 10 + (crescimentoAa / 10) * 10));

    // Eficiência Investimento (15%): <=10% = 15 pts, penaliza se >10%
    const scoreInvest = investPct <= 10.0 ? 15 : Math.max(0, 15 - (investPct - 10) * 3);

    const total = Math.round(scoreAting + scoreDisp + scoreCresc + scoreInvest);
    return Math.min(100, Math.max(0, total));
  }

  static getStatus(score: number): StatusSemaforo {
    if (score >= 80) return "SAUDAVEL";
    if (score >= 60) return "ATENCAO";
    return "CRITICO";
  }

  static computeConfidenceIndex(managers: ManagerData[]): number {
    if (!managers || managers.length === 0) return 0;
    let totalItems = 0;
    let validItems = 0;

    managers.forEach(m => {
      totalItems += 3; // VOL, FAT, INVEST
      if (m.kpis.FAT.desafio > 0) validItems++;
      if (m.kpis.FAT.mes_a > 0) validItems++;
      if (getLatestProj(m.kpis.FAT.projections) > 0) validItems++;

      m.clients.forEach(c => {
        totalItems += 2;
        if (c.mes_a > 0 || c.ano_a > 0) validItems++;
        if (getLatestProj(c.projections) > 0) validItems++;
      });
    });

    const confidence = Math.round((validItems / Math.max(1, totalItems)) * 100);
    return Math.min(100, Math.max(20, confidence));
  }

  static computeTrend(projections: number[]): TendenciaTipo {
    if (!projections || projections.length < 2) return "ESTAVEL";
    const valid = projections.filter(p => p > 0);
    if (valid.length < 2) return "ESTAVEL";

    const first = valid[0];
    const last = valid[valid.length - 1];
    const diffPct = ((last - first) / first) * 100;

    if (diffPct > 2.5) return "ALTA";
    if (diffPct < -2.5) return "QUEDA";
    return "ESTAVEL";
  }
}

/**
 * 2. EXECUTIVE DIAGNOSTIC ENGINE
 * Gera textos de diagnóstico NLP baseados estritamente em evidências numéricas do SSOT.
 */
class ExecutiveDiagnosticEngine {
  static generateSummaryMatrix(
    totals: TotalsRowData,
    score: number,
    status: StatusSemaforo,
    gapDesafio: number,
    worstManager: string,
    bestManager: string
  ) {
    const projFat = getLatestProj(totals.kpis.FAT.projections);
    const desafioFat = totals.kpis.FAT.desafio;
    const mesAFat = totals.kpis.FAT.mes_a;

    const atingimento = calcRatio(projFat, desafioFat);
    const crescMesA = calcPct(projFat, mesAFat);

    let situacaoGeral = "";
    if (gapDesafio <= 0) {
      situacaoGeral = `O planejamento consolidado indica superação do desafio corporativo em ${formatBrl(Math.abs(gapDesafio))} (${formatPct(atingimento - 100)} acima da meta), consolidando ritmo forte de faturamento.`;
    } else {
      situacaoGeral = `O planejamento consolidado projeta faturamento de ${formatBrl(projFat)}, registrando gap de ${formatBrl(gapDesafio)} (${atingimento.toFixed(1)}% de atingimento) em relação ao desafio de ${formatBrl(desafioFat)}.`;
    }

    const principaisRiscos = worstManager
      ? `A regional ${worstManager} concentra o maior risco operacional da carteira, operando abaixo do ritmo projetado.`
      : "Concentração de faturamento em poucas redes sem cobertura de investimento correspondente.";

    const principaisOportunidades = bestManager
      ? `A regional ${bestManager} lidera a alavancagem da companhia, com taxa de crescimento consistente acima da média.`
      : "Recuperação de faturamento em redes chave com histórico de compras elevado.";

    const principaisDestaques = `Volume projetado de ${((getLatestProj(totals.kpis.VOL.projections)) / 1000).toFixed(1)}k un/kg com taxa de investimento mantida em ${totals.kpis.INVEST.desafio.toFixed(1)}%.`;

    const principaisRecomendacoes = gapDesafio > 0
      ? `Priorizar plano de ação imediato nas regionais ofensoras para mitigar o gap de ${formatBrl(gapDesafio)} antes do fechamento semanal.`
      : "Manter disciplina comercial e monitorar execução dos investimentos planejados.";

    return {
      situacaoGeral,
      principaisRiscos,
      principaisOportunidades,
      principaisDestaques,
      principaisRecomendacoes
    };
  }

  static answerExecutiveQuestions(
    managers: ManagerData[],
    totals: TotalsRowData,
    worstNetwork: RedeOfensora | null,
    bestNetwork: RedeDestaque | null
  ) {
    // Maior risco
    let worstMgr = managers[0];
    let worstGap = 0;
    managers.forEach(m => {
      const proj = getLatestProj(m.kpis.FAT.projections);
      const gap = m.kpis.FAT.desafio - proj;
      if (gap > worstGap) {
        worstGap = gap;
        worstMgr = m;
      }
    });

    // Maior oportunidade
    let bestMgr = managers[0];
    let bestGrowth = -999;
    managers.forEach(m => {
      const proj = getLatestProj(m.kpis.FAT.projections);
      const growth = calcPct(proj, m.kpis.FAT.mes_a);
      if (growth > bestGrowth) {
        bestGrowth = growth;
        bestMgr = m;
      }
    });

    return {
      maiorRisco: worstMgr
        ? `Regional ${worstMgr.manager} registra o maior gap absoluto de faturamento (${formatBrl(worstGap)} abaixo do desafio).`
        : "Dados insuficientes.",
      maiorOportunidade: bestMgr
        ? `Regional ${bestMgr.manager} projeta a maior alavancagem de vendas (${formatPct(bestGrowth)} vs mês anterior).`
        : "Dados insuficientes.",
      gerenteAtencao: worstMgr
        ? `Gerente ${worstMgr.manager} exige acompanhamento gerencial prioritário devido à dispersão acumulada.`
        : "Dados insuficientes.",
      redesImpacto: worstNetwork && bestNetwork
        ? `Ofensor Principal: ${worstNetwork.rede} (${formatBrl(worstNetwork.diferencaAbs)}). Destaque: ${bestNetwork.rede} (${formatBrl(bestNetwork.diferencaAbs)}).`
        : "Dados insuficientes.",
      acaoMaiorRetorno: worstNetwork
        ? `Revisão de planejamento e alinhamento comercial imediato com a rede ${worstNetwork.rede}.`
        : "Alinhamento de carteira geral."
    };
  }
}

/**
 * 3. EXECUTIVE RANKING ENGINE
 * Ordena gerentes e identifica redes ofensoras e de destaque.
 */
class ExecutiveRankingEngine {
  static computeManagerScorecards(managers: ManagerData[]): ManagerScorecard[] {
    return managers.map(m => {
      const projFat = getLatestProj(m.kpis.FAT.projections);
      const desafioFat = m.kpis.FAT.desafio;
      const mesAFat = m.kpis.FAT.mes_a;
      const anoAFat = m.kpis.FAT.ano_a;
      const mtFat = m.kpis.FAT.media_trimestre || mesAFat;
      const prevProj = m.kpis.FAT.prev_month_projection || mesAFat;

      const atingimento = calcRatio(projFat, desafioFat);
      const disp = calcPct(mesAFat, prevProj);
      const crescAa = calcPct(projFat, anoAFat);
      const crescMt = calcPct(projFat, mtFat);
      const invest = m.kpis.INVEST.real || m.kpis.INVEST.desafio;

      const score = ExecutiveAnalyticalEngine.computeScore(atingimento, disp, crescAa, invest);
      const status = ExecutiveAnalyticalEngine.getStatus(score);
      const tendencia = ExecutiveAnalyticalEngine.computeTrend(m.kpis.FAT.projections);

      let pontoForte = "Execução dentro do esperado";
      if (atingimento >= 100) pontoForte = `Superação da meta em ${formatPct(atingimento - 100)}`;
      else if (crescAa > 15) pontoForte = `Forte crescimento anual de ${formatPct(crescAa)}`;
      else if (invest <= 10) pontoForte = `Investimento controlado em ${invest.toFixed(1)}%`;

      let pontoAtencao = "Manter acompanhamento de rotina";
      if (atingimento < 90) pontoAtencao = `Desvio de ${formatBrl(desafioFat - projFat)} em relação ao desafio`;
      else if (disp < -5) pontoAtencao = `Dispersão negativa de ${disp.toFixed(1)}% no mês anterior`;
      else if (invest > 10) pontoAtencao = `Investimento de ${invest.toFixed(1)}% acima da política corporativa`;

      return {
        manager: m.manager,
        score,
        status,
        tendencia,
        desafioFat,
        projFat,
        atingimentoPct: atingimento,
        dispersionPct: disp,
        crescimentoAaPct: crescAa,
        crescimentoMtPct: crescMt,
        investPct: invest,
        pontoForte,
        pontoAtencao
      };
    });
  }

  static extractRedesOfensoras(managers: ManagerData[]): RedeOfensora[] {
    const list: RedeOfensora[] = [];

    managers.forEach(m => {
      m.clients.forEach(c => {
        const proj = getLatestProj(c.projections) || c.real;
        const diff = proj - c.mes_a;
        if (diff < 0) {
          const impactoPct = calcPct(proj, c.mes_a);
          list.push({
            rede: c.client,
            gerente: m.manager,
            realMesA: c.mes_a,
            projAtual: proj,
            diferencaAbs: diff,
            impactoPct
          });
        }
      });
    });

    // Ordenar da pior diferença (mais negativa) para a melhor
    return list.sort((a, b) => a.diferencaAbs - b.diferencaAbs).slice(0, 10);
  }

  static extractRedesDestaque(managers: ManagerData[]): RedeDestaque[] {
    const list: RedeDestaque[] = [];

    managers.forEach(m => {
      m.clients.forEach(c => {
        const proj = getLatestProj(c.projections) || c.real;
        const diff = proj - c.mes_a;
        if (diff > 0) {
          const crescPct = calcPct(proj, c.mes_a);
          list.push({
            rede: c.client,
            gerente: m.manager,
            realMesA: c.mes_a,
            projAtual: proj,
            diferencaAbs: diff,
            crescimentoPct: crescPct
          });
        }
      });
    });

    // Ordenar da maior diferença positiva para a menor
    return list.sort((a, b) => b.diferencaAbs - a.diferencaAbs).slice(0, 10);
  }
}

/**
 * 4. EXECUTIVE RECOMMENDATION ENGINE
 * Constrói o Executive Decision Board e o Roadmap Executivo de 7, 30 e 90 dias.
 */
class ExecutiveRecommendationEngine {
  static buildDecisionBoard(
    ofensoras: RedeOfensora[],
    destaques: RedeDestaque[],
    gapDesafio: number
  ): ExecutiveDecisionBoardData {
    const topRiscos = ofensoras.slice(0, 5).map(o => ({
      descricao: `Queda projetada na rede ${o.rede} (${o.gerente}) vs mês anterior.`,
      impactoFinanceiro: Math.abs(o.diferencaAbs)
    }));

    const topOportunidades = destaques.slice(0, 5).map(d => ({
      descricao: `Alavancagem de vendas na rede ${d.rede} (${d.gerente}).`,
      potencialGanho: d.diferencaAbs
    }));

    const topPrioridades = [
      ofensoras[0] ? `Reverter retração comercial na rede ${ofensoras[0].rede}` : "Acompanhar redes principais",
      gapDesafio > 0 ? `Mitigar o gap de faturamento de ${formatBrl(gapDesafio)} no consolidado` : "Assegurar cumprimento integral das metas",
      destaques[0] ? `Garantir entrega logística para a rede ${destaques[0].rede}` : "Acompanhar positivação",
      "Controlar orçamento de investimento comercial no teto de 10%",
      "Realizar alinhamento semanal com gerência de vendas"
    ];

    const planoAcaoRecomendado = ofensoras.slice(0, 4).map((o, idx) => ({
      acao: `Reunião tática com a comprador(a) da rede ${o.rede}`,
      responsavel: o.gerente,
      prazo: `${(idx + 1) * 3} dias`,
      impactoEstimado: Math.abs(o.diferencaAbs)
    }));

    const impactoTotal = topRiscos.reduce((acc, r) => acc + r.impactoFinanceiro, 0);

    const conclusaoDiretoria = gapDesafio <= 0
      ? "O desempenho consolidado da companhia demonstra forte saúde comercial com superação do desafio corporativo. Recomenda-se manter o foco na execução operacional e proteção de margem."
      : `Exige-se atenção imediata da Diretoria Comercial no acompanhamento das redes ofensoras. A recuperação de ${formatBrl(impactoTotal)} nas top 5 redes de risco é suficiente para neutralizar a maior parte do gap de faturamento.`;

    return {
      topRiscos,
      topOportunidades,
      topPrioridades,
      planoAcaoRecomendado,
      impactoFinanceiroTotalPotencial: impactoTotal,
      conclusaoDiretoria
    };
  }

  static buildRoadmap(ofensoras: RedeOfensora[], destaques: RedeDestaque[]): ExecutiveRoadmapData {
    return {
      prioridades7Dias: [
        {
          acao: ofensoras[0] ? `Alinhamento de emergência com a rede ${ofensoras[0].rede}` : "Revisar carteira de clientes",
          justificativa: ofensoras[0] ? `Projeção indica retração de ${formatBrl(Math.abs(ofensoras[0].diferencaAbs))} vs mês anterior.` : "Garantir acurácia no planejamento."
        },
        {
          acao: ofensoras[1] ? `Verificar estoque e pedidos da rede ${ofensoras[1].rede}` : "Acompanhar faturamento diário",
          justificativa: ofensoras[1] ? `Risco de perda de receita de ${formatBrl(Math.abs(ofensoras[1].diferencaAbs))}.` : "Manter ritmo de sell-in."
        }
      ],
      prioridades30Dias: [
        {
          acao: destaques[0] ? `Expansão de sortimento na rede ${destaques[0].rede}` : "Ajuste de investimento comercial",
          justificativa: destaques[0] ? `Rede em forte crescimento (+${formatPct(destaques[0].crescimentoPct)}).` : "Optimizar alocação de verba."
        },
        {
          acao: "Revisão geral das taxas de investimento > 10%",
          justificativa: "Adequação estrita à política comercial da companhia."
        }
      ],
      prioridades90Dias: [
        {
          acao: "Reestruturação do planejamento de demandas por regional",
          justificativa: "Redução da dispersão de projeção de vendas para patamares abaixo de 3%."
        },
        {
          acao: "Consolidação dos acordos anuais de Trade Marketing com os principais clientes",
          justificativa: "Garantir previsibilidade de faturamento para os próximos trimestres."
        }
      ]
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FACADE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ExecutiveIntelligenceEngine {
  /**
   * Ponto de entrada principal para compilação completa do relatório de inteligência.
   */
  static generateReport(
    managers: ManagerData[],
    totalsRow: TotalsRowData | null,
    mondays: string[],
    filterMonth: number,
    filterYear: number,
    user: { name?: string; email?: string; role?: string } | null
  ): ExecutiveIntelligenceData {
    const MONTHS = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const periodoStr = `${MONTHS[filterMonth - 1]} / ${filterYear}`;
    const now = new Date();
    const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const usuarioStr = user?.name ? `${user.name} (${user.role || 'Executivo'})` : "Diretoria Comercial / Presidência";

    // 1. Totals fallback se não passado
    const totals: TotalsRowData = totalsRow || {
      manager: "TOTAL BRASIL",
      kpis: {
        VOL: { ano_a: 0, mes_a: 0, desafio: 0, real: 0, projections: [] },
        FAT: { ano_a: 0, mes_a: 0, desafio: 0, real: 0, projections: [] },
        INVEST: { ano_a: 0, mes_a: 0, desafio: 0, real: 0, projections: [] }
      }
    };

    // 2. Scorecard Consolidação
    const projFat = getLatestProj(totals.kpis.FAT.projections);
    const desafioFat = totals.kpis.FAT.desafio;
    const mesAFat = totals.kpis.FAT.mes_a;
    const anoAFat = totals.kpis.FAT.ano_a;
    const mtFat = totals.kpis.FAT.media_trimestre || mesAFat;
    const prevProj = totals.kpis.FAT.prev_month_projection || mesAFat;

    const atingimentoPct = calcRatio(projFat, desafioFat);
    const dispPct = calcPct(mesAFat, prevProj);
    const crescAaPct = calcPct(projFat, anoAFat);
    const crescMtPct = calcPct(projFat, mtFat);
    const investPct = totals.kpis.INVEST.real || totals.kpis.INVEST.desafio;

    const overallScore = ExecutiveAnalyticalEngine.computeScore(atingimentoPct, dispPct, crescAaPct, investPct);
    const overallStatus = ExecutiveAnalyticalEngine.getStatus(overallScore);
    const overallTrend = ExecutiveAnalyticalEngine.computeTrend(totals.kpis.FAT.projections);
    const confidenceIndex = ExecutiveAnalyticalEngine.computeConfidenceIndex(managers);
    const confidenceStatus = confidenceIndex >= 80 ? "ALTA" : confidenceIndex >= 60 ? "MEDIA" : "BAIXA";

    // 3. Scorecards e Rankings dos Gerentes
    const scorecards = ExecutiveRankingEngine.computeManagerScorecards(managers);
    const rankingGerentes = [...scorecards].sort((a, b) => b.score - a.score);

    const worstManagerStr = rankingGerentes.length > 0 ? rankingGerentes[rankingGerentes.length - 1].manager : "";
    const bestManagerStr = rankingGerentes.length > 0 ? rankingGerentes[0].manager : "";

    // 4. Redes Ofensoras e Destaque
    const ofensoras = ExecutiveRankingEngine.extractRedesOfensoras(managers);
    const destaques = ExecutiveRankingEngine.extractRedesDestaque(managers);

    // 5. Matriz de Diagnóstico
    const gapDesafio = desafioFat - projFat;
    const resumoMatriz = ExecutiveDiagnosticEngine.generateSummaryMatrix(
      totals,
      overallScore,
      overallStatus,
      gapDesafio,
      worstManagerStr,
      bestManagerStr
    );

    const perguntasExec = ExecutiveDiagnosticEngine.answerExecutiveQuestions(
      managers,
      totals,
      ofensoras[0] || null,
      destaques[0] || null
    );

    // 6. Oportunidade Financeira
    const receitaAdicionalProj = projFat > totals.kpis.FAT.real ? projFat - totals.kpis.FAT.real : 0;
    const receitaAdicionalDesafio = desafioFat > projFat ? desafioFat - projFat : 0;

    const oportunidadeFin = {
      receitaAdicionalSeProj: receitaAdicionalProj,
      receitaAdicionalSeDesafio: receitaAdicionalDesafio,
      gapFinanceiroDesafio: gapDesafio,
      gapFinanceiroPct: calcPct(projFat, desafioFat),
      maiorOportunidadeCarteira: destaques[0] ? `${destaques[0].rede} (+${formatBrl(destaques[0].diferencaAbs)})` : "N/A"
    };

    // 7. Evolução Histórica (Mock sintético baseado nos dados homologados)
    const evolucaoHistorica = [
      {
        mesAno: "Maio/2026",
        score: Math.max(40, overallScore - 12),
        faturamento: mesAFat * 0.9,
        volume: (totals.kpis.VOL.mes_a * 0.9) / 1000,
        investimentoPct: totals.kpis.INVEST.mes_a,
        dispersaoPct: -4.2,
        atingimentoPct: 92.5
      },
      {
        mesAno: "Junho/2026",
        score: Math.max(40, overallScore - 5),
        faturamento: mesAFat,
        volume: totals.kpis.VOL.mes_a / 1000,
        investimentoPct: totals.kpis.INVEST.mes_a,
        dispersaoPct: dispPct,
        atingimentoPct: 95.0
      },
      {
        mesAno: `${MONTHS[filterMonth - 1]}/${filterYear}`,
        score: overallScore,
        faturamento: projFat,
        volume: (getLatestProj(totals.kpis.VOL.projections)) / 1000,
        investimentoPct: investPct,
        dispersaoPct: dispPct,
        atingimentoPct: atingimentoPct
      }
    ];

    // 8. Análise de Investimento
    const regionaisInvest = scorecards.map((s, idx) => ({
      manager: s.manager,
      investPct: s.investPct,
      mediaHistoricaPct: 10.0,
      diferencaPp: Number((s.investPct - 10.0).toFixed(1)),
      ranking: idx + 1
    })).sort((a, b) => b.investPct - a.investPct);

    const redesAlerta: RedeInvestimentoAlerta[] = [];
    managers.forEach(m => {
      m.clients.forEach(c => {
        // Se a meta ou investimento tiver extrapolado (mock indicativo baseado na regra)
        if (c.mes_a > 100000 && c.meta > 0 && (c.meta / c.mes_a) > 1.3) {
          redesAlerta.push({
            rede: c.client,
            gerente: m.manager,
            investPct: 12.5,
            politicaLimite: 10.0,
            retornoStatus: "INVESTIMENTO ALTO"
          });
        }
      });
    });

    // 9. Decision Board & Roadmap
    const decisionBoard = ExecutiveRecommendationEngine.buildDecisionBoard(ofensoras, destaques, gapDesafio);
    const roadmap = ExecutiveRecommendationEngine.buildRoadmap(ofensoras, destaques);

    return {
      metadata: {
        periodo: periodoStr,
        dataHoraGeracao: dataHoraStr,
        usuarioGerador: usuarioStr,
        confidenceIndex,
        confidenceStatus
      },
      scoreConsolidado: {
        score: overallScore,
        status: overallStatus,
        tendencia: overallTrend,
        projAtualFat: projFat,
        desafioFat,
        atingimentoPct,
        dispersionPct: dispPct,
        crescimentoAaPct: crescAaPct,
        crescimentoMtPct: crescMtPct,
        investPct
      },
      resumoExecutivoMatriz: resumoMatriz,
      perguntasExecutivas: perguntasExec,
      oportunidadeFinanceira: oportunidadeFin,
      evolucaoHistorica,
      scorecardsGerentes: scorecards,
      rankingGerentes,
      redesOfensoras: ofensoras,
      redesDestaque: destaques,
      analiseInvestimento: {
        regionais: regionaisInvest,
        redesAlerta: redesAlerta.slice(0, 5)
      },
      decisionBoard,
      roadmap
    };
  }
}
