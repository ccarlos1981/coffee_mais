import { PrioritizationItem } from "../dto/intelligence-dto";
import { IntelligenceUtils } from "../utils/intelligence-utils";

export class PrioritizationEngine {
  public static calculatePrioritization(context: any): PrioritizationItem[] {
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const redes = context.rankings?.redes || context.networkRanking || [];

    const mgrItems: PrioritizationItem[] = mgrs.map((g: any, idx: number) => {
      const pace = g.pace || 100;
      const gap = g.gap || 0;
      const riskScore = IntelligenceUtils.clampScore(100 - pace);
      const opportunityScore = IntelligenceUtils.clampScore((gap / Math.max(1, g.meta)) * 100);
      const growthScore = IntelligenceUtils.clampScore(pace);
      const priorityScore = IntelligenceUtils.clampScore((riskScore * 0.4) + (opportunityScore * 0.4) + (growthScore * 0.2));

      return {
        id: `PRIO-MGR-${idx + 1}`,
        entidade: g.manager,
        tipo: "Gerente",
        priorityScore,
        opportunityScore,
        riskScore,
        growthScore,
        explicacao: `Gerente ${g.manager} possui Pace de ${pace.toFixed(1)}% e Gap de R$ ${(gap / 1000).toFixed(0)}k.`
      };
    });

    const redeItems: PrioritizationItem[] = redes.slice(0, 10).map((r: any, idx: number) => {
      const pace = r.pace || 100;
      const gap = Math.max(0, r.meta - r.faturamento);
      const riskScore = IntelligenceUtils.clampScore(100 - pace);
      const opportunityScore = IntelligenceUtils.clampScore((gap / Math.max(1, r.meta)) * 100);
      const growthScore = IntelligenceUtils.clampScore(pace);
      const priorityScore = IntelligenceUtils.clampScore((riskScore * 0.3) + (opportunityScore * 0.5) + (growthScore * 0.2));

      return {
        id: `PRIO-REDE-${idx + 1}`,
        entidade: r.rede,
        tipo: "Rede",
        priorityScore,
        opportunityScore,
        riskScore,
        growthScore,
        explicacao: `Rede ${r.rede} possui Meta de R$ ${(r.meta / 1000).toFixed(0)}k e Pace de ${pace.toFixed(1)}%.`
      };
    });

    return [...mgrItems, ...redeItems];
  }
}
