export interface PrioritizationItem {
  id: string;
  entidade: string;
  tipo: 'Gerente' | 'Rede' | 'UF' | 'Cliente';
  priorityScore: number;   // 0-100
  opportunityScore: number;// 0-100
  riskScore: number;       // 0-100
  growthScore: number;     // 0-100
  explicacao: string;
}

export interface NextBestActionItem {
  id: string;
  gerente: string;
  redeOuEntidade: string;
  acaoRecomendada: string;
  prioridade: 'ALTA' | 'MÉDIA' | 'BAIXA';
  impactoEstimadoR$: number;
  justificativa: string;
  confiancaPct: number;
}

export interface ExplainableFactorItem {
  kpi: string;
  variacaoPct: number;
  variacaoR$: number;
  causaPrincipal: string;
  redesImpactantes: string[];
  gerentesImpactantes: string[];
  ufsImpactantes: string[];
}

export interface HealthScoreItem {
  entidade: string;
  tipo: 'Brasil' | 'Gerente' | 'UF' | 'Rede' | 'Cliente';
  healthScore: number; // 0-100
  classificacao: 'Excelente' | 'Saudável' | 'Atenção' | 'Crítico';
  indicadoresChave: {
    metaR$: number;
    faturamentoR$: number;
    pacePct: number;
    forecastR$: number;
    gapR$: number;
  };
}

export interface RiskPredictionItem {
  id: string;
  entidade: string;
  tipo: 'Gerente' | 'Rede' | 'UF' | 'Cliente';
  categoriaRisco: 'Meta Não Atingida' | 'Queda Volume' | 'Preço Médio' | 'Mix Degradado';
  nivelRisco: 'Crítico' | 'Alto' | 'Médio';
  impactoR$: number;
  motivo: string;
}

export interface ExecutiveBriefingItem {
  resumoNacional: string;
  maioresCrescimentos: string[];
  maioresQuedas: string[];
  principaisRiscos: string[];
  principaisOportunidades: string[];
  recomendacoesChave: string[];
  prioridadesDaSemana: string[];
}

export interface CommercialActionPlanItem {
  id: string;
  objetivo: string;
  responsavel: string;
  prazoDias: number;
  impactoEsperadoR$: number;
  indicadoresAfetados: string[];
  prioridade: 'ALTA' | 'MÉDIA' | 'BAIXA';
}

export interface CEOInsightItem {
  id: string;
  categoria: 'Expansão' | 'Concentração Risco' | 'Gargalo Meta' | 'Oportunidade Top';
  insightText: string;
  percentualRelevancia: number;
  impactoFinanceiroR$: number;
}

export interface IntelligenceMetadata {
  version: string;
  generatedAt: string;
  processingTimeMs: number;
  deterministicMode: boolean;
  parityDeviationPct: number;
}

export interface IntelligenceTelemetry {
  analyticsTimeMs: number;
  planningTimeMs: number;
  copilotTimeMs: number;
  intelligenceTimeMs: number;
  totalTimeMs: number;
  parityDeviationPct: number;
}

export interface CommercialIntelligenceViewModel {
  metadata: IntelligenceMetadata;
  executive: {
    metaNacional: number;
    faturamentoAtual: number;
    paceNacional: number;
    forecastNacional: number;
    gapNacional: number;
  };
  prioritization: PrioritizationItem[];
  nextBestActions: NextBestActionItem[];
  explainable: ExplainableFactorItem[];
  health: HealthScoreItem[];
  risks: RiskPredictionItem[];
  actionPlans: CommercialActionPlanItem[];
  briefing: ExecutiveBriefingItem;
  ceoInsights: CEOInsightItem[];
  telemetry: IntelligenceTelemetry;
}
