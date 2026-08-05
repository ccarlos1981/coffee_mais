import { CEOBoardData } from "../dto/rgm-dto";

export class CEOBoardEngine {
  public static generateCEOBoard(opportunities: any[], decisionVM: any): CEOBoardData {
    const baseMeta = decisionVM.decisionGraph?.[0]?.inputKPIs?.impactoEstimadoR$ ? 10000000 : 10000000;
    const totalPotential = opportunities.reduce((acc: number, opp: any) => acc + (opp.impactoFinanceiroR$ || 0), 0);

    const quickWins = opportunities.filter((o: any) => o.confiancaPct >= 90);
    const strategic = opportunities.filter((o: any) => o.impactoFinanceiroR$ >= 500000);

    return {
      receitaPotencialR$: Math.round(baseMeta * 1.25),
      receitaRecuperavelR$: Math.round(totalPotential * 0.4),
      receitaEmRiscoR$: Math.round(baseMeta * 0.1),
      receitaConfirmadaR$: Math.round(baseMeta * 0.9),
      quickWinsCount: quickWins.length,
      estrategicasCount: strategic.length,
      rankingNacionalPotencial: opportunities.slice(0, 5).map((o: any) => ({
        entidade: o.entidade,
        potencialR$: o.impactoFinanceiroR$,
        prioridade: o.prioridade
      }))
    };
  }
}
