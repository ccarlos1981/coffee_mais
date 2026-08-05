export interface OpportunityItem {
  id: string;
  entidade: string;
  tipo: 'Rede Subatendida' | 'Cliente Potencial' | 'Região Baixa Penetração' | 'Recuperação' | 'Expansão';
  impactoFinanceiroR$: number;
  impactoVolumeKg: number;
  impactoMargemPct: number;
  confiancaPct: number;
  prioridade: 'ALTA' | 'MÉDIA' | 'BAIXA';
  descricao: string;
}

export interface WhiteSpaceItem {
  id: string;
  ufOuRegiao: string;
  categoriaSKU: string;
  mixAtual: string[];
  mixRecomendado: string[];
  potencialFinanceiroR$: number;
}

export interface ShareOfWalletItem {
  id: string;
  rede: string;
  shareAtualPct: number;
  sharePotencialPct: number;
  gapSharePct: number;
  receitaAdicionalR$: number;
}

export interface PriorityMatrixItem {
  id: string;
  oportunidade: string;
  entidade: string;
  impactoFinanceiroR$: number;
  facilidadeExecucao: 'ALTA' | 'MÉDIA' | 'BAIXA';
  quadrante: 'Quick Wins' | 'Alto Impacto' | 'Longo Prazo' | 'Manutenção';
}

export interface PriceOpportunityItem {
  id: string;
  entidadeOuSKU: string;
  precoAtualR$: number;
  precoMedioMercadoR$: number;
  desvioPrecoPct: number;
  perdaMargemR$: number;
  recomendacaoReajuste: string;
}

export interface MixOpportunityItem {
  id: string;
  clienteOuRede: string;
  skusAusentes: string[];
  potencialCrossSellR$: number;
  potencialUpSellR$: number;
  recomendacaoMix: string;
}

export interface RevenueSimulationResult {
  variacaoPrecoPct: number;
  variacaoVolumePct: number;
  variacaoMixPct: number;
  novosClientes: number;
  receitaSimuladaR$: number;
  incrementalR$: number;
  impactoMargemPct: number;
}

export interface RGMExecutiveActionPlan {
  prioridadesSemanais: string[];
  prioridadesMensais: string[];
  planoNacional: string[];
  planoPorGerente: Record<string, string[]>;
  impactoTotalEsperadoR$: number;
}

export interface CEOBoardData {
  receitaPotencialR$: number;
  receitaRecuperavelR$: number;
  receitaEmRiscoR$: number;
  receitaConfirmadaR$: number;
  quickWinsCount: number;
  estrategicasCount: number;
  rankingNacionalPotencial: { entidade: string; potencialR$: number; prioridade: string }[];
}

export interface RGMMetadata {
  version: string;
  generatedAt: string;
  processingTimeMs: number;
  deterministicMode: boolean;
  parityDeviationPct: number;
}

export interface RGMViewModel {
  metadata: RGMMetadata;
  ceoBoard: CEOBoardData;
  opportunities: OpportunityItem[];
  whiteSpace: WhiteSpaceItem[];
  shareOfWallet: ShareOfWalletItem[];
  priorityMatrix: PriorityMatrixItem[];
  priceOpportunities: PriceOpportunityItem[];
  mixOpportunities: MixOpportunityItem[];
  simulation: {
    baseScenario: RevenueSimulationResult;
    runCustomSimulation: (pricePct: number, volPct: number, mixPct: number, newClients: number) => RevenueSimulationResult;
  };
  executiveActionPlan: RGMExecutiveActionPlan;
  telemetry: {
    decisionPlatformTimeMs: number;
    rgmTimeMs: number;
    totalTimeMs: number;
    parityDeviationPct: number;
  };
}
