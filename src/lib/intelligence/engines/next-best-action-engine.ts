import { NextBestActionItem } from "../dto/intelligence-dto";

export class NextBestActionEngine {
  public static generateNextBestActions(context: any): NextBestActionItem[] {
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const redes = context.rankings?.redes || context.networkRanking || [];
    const actions: NextBestActionItem[] = [];

    mgrs.slice(0, 5).forEach((g: any, idx: number) => {
      const targetRede = redes[idx] ? redes[idx].rede : "Rede Principal";
      actions.push({
        id: `NBA-${idx + 1}`,
        gerente: g.manager,
        redeOuEntidade: targetRede,
        acaoRecomendada: g.pace < 90 ? `Aumentar volume na ${targetRede}` : `Antecipar negociação comercial na ${targetRede}`,
        prioridade: g.pace < 85 ? "ALTA" : "MÉDIA",
        impactoEstimadoR$: Math.round(g.gap * 0.35 || g.meta * 0.05),
        justificativa: `Pace atual de ${g.pace.toFixed(1)}% com gap estimado de R$ ${(g.gap / 1000).toFixed(0)}k`,
        confiancaPct: 95
      });
    });

    if (actions.length === 0) {
      actions.push({
        id: "NBA-DEF-1",
        gerente: "Nacional",
        redeOuEntidade: "Top Redes",
        acaoRecomendada: "Revisar precificação média e positivação por SKU",
        prioridade: "ALTA",
        impactoEstimadoR$: 250000,
        justificativa: "Manter acompanhamento constante de positivação de carteira",
        confiancaPct: 100
      });
    }

    return actions.slice(0, 10);
  }
}
