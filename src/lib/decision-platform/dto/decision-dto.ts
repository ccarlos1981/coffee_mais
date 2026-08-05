export interface DecisionMetadata {
  version: string;
  generatedAt: string;
  processingTimeMs: number;
  deterministicMode: boolean;
  parityDeviationPct: number;
}

export interface DecisionTelemetry {
  analyticsTimeMs: number;
  planningTimeMs: number;
  copilotTimeMs: number;
  intelligenceTimeMs: number;
  decisionPlatformTimeMs: number;
  totalTimeMs: number;
  memoryUsedMb: number;
  payloadKb: number;
  cacheHitRatio: number;
  rulesExecutedCount: number;
  decisionsProducedCount: number;
  scoresCalculatedCount: number;
  avgTimePerDecisionMs: number;
  parityDeviationPct: number;
}

export interface DecisionGraphNode {
  decisionId: string;
  targetEntity: string;
  recommendationText: string;
  inputKPIs: Record<string, number>;
  rulesApplied: string[];
  scoreCalculated: number;
  weightPct: number;
  rationale: string;
  expectedFinancialImpactR$: number;
  confidencePct: number;
}

export interface DecisionScoreDefinition {
  scoreKey: string;
  name: string;
  formula: string;
  scale: string;
  weightPct: number;
  classification: string;
  description: string;
  traceability: string[];
}

export interface DecisionViewModel {
  metadata: DecisionMetadata;
  pipeline: {
    stagesExecuted: string[];
    status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  };
  decisionGraph: DecisionGraphNode[];
  insights: any[];
  diagnosis: any[];
  priorities: any[];
  recommendations: any[];
  actionPlans: any[];
  executiveBriefing: any;
  scores: Record<string, DecisionScoreDefinition>;
  telemetry: DecisionTelemetry;
}
