import { MetasRedeViewModel } from "@/lib/planning/commercial-planning-service";

export interface CopilotMetadata {
  version: string;
  generatedAt: string;
  processingTimeMs: number;
  dataSources: string[];
  parityDeviationPct: number;
}

export interface CopilotInsight {
  id: string;
  categoria: 'Crescimento' | 'Queda' | 'Risco' | 'Oportunidade' | 'Desvio Meta';
  titulo: string;
  descricao: string;
  impactoR$: number;
  prioridade: 'ALTA' | 'MÉDIA' | 'BAIXA';
  entidade: string;
}

export interface CopilotRecommendation {
  id: string;
  tipo: 'Investimento' | 'Negociação' | 'Meta' | 'Potencial' | 'Desaceleração';
  acaoRecomendada: string;
  entidade: string;
  justificativa: string;
  impactoEstimadoR$: number;
}

export interface ExplainableKPIItem {
  kpiKey: string;
  kpiLabel: string;
  valorAtual: number;
  origem: string;
  fatoresContribuintes: string[];
  tendencia: 'Crescimento' | 'Estável' | 'Queda';
  impactoFinanceiro: string;
  recomendacao: string;
}

export interface CommercialScoreItem {
  entidade: string;
  tipo: 'Gerente' | 'Rede' | 'UF' | 'Cliente';
  score: number; // 0-100
  classificacao: 'Excelente' | 'Bom' | 'Atenção' | 'Crítico';
  fatores: string[];
}

export interface IntelligentAlert {
  id: string;
  nivel: 'Critical' | 'Warning' | 'Information';
  titulo: string;
  mensagem: string;
  impactoR$: number;
}

export interface ExecutiveBriefing {
  titulo: string;
  dataGeracao: string;
  resumoNacional: string;
  principaisCrescimentos: string[];
  principaisRiscos: string[];
  topOportunidades: string[];
  gapMeta: number;
  forecastFechamento: number;
  proximasAcoes: string[];
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  tipo: 'Meta' | 'Forecast' | 'Pace' | 'Risco' | 'Evento';
  descricao: string;
  valorAnterior?: string;
  valorNovo?: string;
}

export interface ChatMessageResponse {
  pergunta: string;
  resposta: string;
  fonteDados: string[];
  confiancaPct: number;
  commandExecuted: string;
}

export interface WhatIfScenarioResult {
  variacaoPct: number;
  faturamentoSimulado: number;
  gapSimulado: number;
  paceSimulado: number;
  forecastSimulado: number;
}

export interface CopilotViewModel {
  metadata: CopilotMetadata;
  insights: CopilotInsight[];
  recommendations: CopilotRecommendation[];
  explanations: Record<string, ExplainableKPIItem>;
  scores: CommercialScoreItem[];
  alerts: IntelligentAlert[];
  briefing: ExecutiveBriefing;
  timeline: TimelineEvent[];
  chat: {
    suggestedQueries: string[];
    processQuery: (query: string) => ChatMessageResponse;
  };
  simulator: {
    scenarios: WhatIfScenarioResult[];
    runCustomScenario: (variationPct: number) => WhatIfScenarioResult;
  };
  telemetry: {
    analyticsTimeMs: number;
    planningTimeMs: number;
    copilotTimeMs: number;
    parityDeviationPct: number;
  };

  // Optimized backward compatibility getters without payload duplication
  explainableKPIs?: Record<string, ExplainableKPIItem>;
  commercialScores?: CommercialScoreItem[];
  intelligentAlerts?: IntelligentAlert[];
  executiveBriefing?: ExecutiveBriefing;
  chatEngine?: any;
  whatIfSimulator?: any;
}
