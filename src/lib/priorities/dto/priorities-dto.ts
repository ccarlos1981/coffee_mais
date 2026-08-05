export interface CommercialPriorityItem {
  id: string;
  rankPosition: number;
  entidade: string;
  tipo: 'Crescimento' | 'Recuperação' | 'Risco' | 'Share of Wallet' | 'Mix' | 'Preço' | 'Expansão' | 'Positivação';
  impactoFinanceiroR$: number;
  prioridade: 'ALTA' | 'MÉDIA' | 'BAIXA';
  justificativa: string;
  recomendacaoPratica: string;
  responsavel: string;
  prazoSugeridoDias: number;
  kpiImpactado: 'Receita' | 'Pace' | 'Gap Meta' | 'Share of Wallet' | 'Mix' | 'Positivação';
  confiancaPct: number;
}

export interface PrioritiesMetadata {
  version: string;
  generatedAt: string;
  processingTimeMs: number;
  totalPrioritiesCount: number;
  totalFinancialImpactR$: number;
  parityDeviationPct: number;
}

export interface CommercialPrioritiesViewModel {
  metadata: PrioritiesMetadata;
  topPriorities: CommercialPriorityItem[];
  summaryByOwner: Record<string, { count: number; impactoR$: number }>;
  summaryByKPI: Record<string, { count: number; impactoR$: number }>;
  telemetry: {
    rgmTimeMs: number;
    prioritiesTimeMs: number;
    totalTimeMs: number;
    parityDeviationPct: number;
  };
}
