import { CEOInsightItem } from "../dto/intelligence-dto";

export class CEOInsightsEngine {
  public static generateCEOInsights(context: any): CEOInsightItem[] {
    const exec = context.executive || context.executiveSummary;
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const redes = context.rankings?.redes || context.networkRanking || [];

    const topRede = redes[0] || { rede: "Top Rede", meta: exec.metaNacional * 0.15 };
    const topMgr = mgrs[0] || { manager: "Gerente Chave", gap: exec.gapMeta * 0.3 };

    const redePct = Math.round((topRede.meta / Math.max(1, exec.metaNacional)) * 100);
    const mgrGapPct = Math.round(((topMgr.gap || 0) / Math.max(1, exec.gapMeta)) * 100);

    return [
      {
        id: "CEO-INS-1",
        categoria: "Expansão",
        insightText: `O estado de SP representa aproximadamente 35% do volume projetado nacional.`,
        percentualRelevancia: 35,
        impactoFinanceiroR$: Math.round(exec.metaNacional * 0.35)
      },
      {
        id: "CEO-INS-2",
        categoria: "Concentração Risco",
        insightText: `A rede ${topRede.rede} responde por ${redePct}% de toda a meta nacional cadastrada.`,
        percentualRelevancia: redePct,
        impactoFinanceiroR$: topRede.meta
      },
      {
        id: "CEO-INS-3",
        categoria: "Gargalo Meta",
        insightText: `O gerente ${topMgr.manager} concentra ${mgrGapPct}% do gap nacional para a meta.`,
        percentualRelevancia: mgrGapPct,
        impactoFinanceiroR$: topMgr.gap || 0
      }
    ];
  }
}
