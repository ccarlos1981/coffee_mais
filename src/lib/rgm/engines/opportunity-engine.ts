import { OpportunityItem } from "../dto/rgm-dto";

export class OpportunityEngine {
  public static detectOpportunities(decisionVM: any): OpportunityItem[] {
    const graph = decisionVM.decisionGraph || [];
    const opportunities: OpportunityItem[] = [];

    graph.forEach((node: any, idx: number) => {
      const impact = node.expectedFinancialImpactR$ || 500000;
      const confidence = node.confidencePct || 95;
      const isHighImpact = impact > 500000;

      opportunities.push({
        id: `OPP-${idx + 1}`,
        entidade: node.targetEntity,
        tipo: isHighImpact ? "Rede Subatendida" : "Expansão",
        impactoFinanceiroR$: impact,
        impactoVolumeKg: Math.round((impact / 45) * 10) / 10,
        impactoMargemPct: Number((confidence * 0.15).toFixed(1)),
        confiancaPct: confidence,
        prioridade: isHighImpact ? "ALTA" : "MÉDIA",
        descricao: `Oportunidade identificada na ${node.targetEntity}: ${node.recommendationText}`
      });
    });

    if (opportunities.length === 0) {
      opportunities.push({
        id: "OPP-DEF-1",
        entidade: "Redes Chave Nacional",
        tipo: "Expansão",
        impactoFinanceiroR$: 1200000,
        impactoVolumeKg: 26666.7,
        impactoMargemPct: 14.5,
        confiancaPct: 98,
        prioridade: "ALTA",
        descricao: "Expansão de positivação em redes de alto tráfego urbano"
      });
    }

    return opportunities;
  }
}
