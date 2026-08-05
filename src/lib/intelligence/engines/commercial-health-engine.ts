import { HealthScoreItem } from "../dto/intelligence-dto";
import { IntelligenceUtils } from "../utils/intelligence-utils";

export class CommercialHealthEngine {
  public static calculateHealthScores(context: any): HealthScoreItem[] {
    const exec = context.executive || context.executiveSummary;
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const redes = context.rankings?.redes || context.networkRanking || [];

    const nationalPace = exec.pace || 100;
    const nationalScore = IntelligenceUtils.clampScore(nationalPace);

    let nationalClass: HealthScoreItem["classificacao"] = "Saudável";
    if (nationalScore >= 100) nationalClass = "Excelente";
    else if (nationalScore < 80) nationalClass = "Crítico";
    else if (nationalScore < 90) nationalClass = "Atenção";

    const items: HealthScoreItem[] = [
      {
        entidade: "Brasil (Nacional)",
        tipo: "Brasil",
        healthScore: nationalScore,
        classificacao: nationalClass,
        indicadoresChave: {
          metaR$: exec.metaNacional,
          faturamentoR$: exec.faturamentoAtual,
          pacePct: exec.pace,
          forecastR$: exec.forecast,
          gapR$: exec.gapMeta
        }
      }
    ];

    mgrs.forEach((g: any) => {
      const p = g.pace || 100;
      const score = IntelligenceUtils.clampScore(p);
      let cls: HealthScoreItem["classificacao"] = "Saudável";
      if (score >= 100) cls = "Excelente";
      else if (score < 80) cls = "Crítico";
      else if (score < 90) cls = "Atenção";

      items.push({
        entidade: g.manager,
        tipo: "Gerente",
        healthScore: score,
        classificacao: cls,
        indicadoresChave: {
          metaR$: g.meta,
          faturamentoR$: g.faturamento || 0,
          pacePct: p,
          forecastR$: g.meta * (p / 100),
          gapR$: g.gap || 0
        }
      });
    });

    redes.slice(0, 10).forEach((r: any) => {
      const p = r.pace || 100;
      const score = IntelligenceUtils.clampScore(p);
      let cls: HealthScoreItem["classificacao"] = "Saudável";
      if (score >= 100) cls = "Excelente";
      else if (score < 80) cls = "Crítico";
      else if (score < 90) cls = "Atenção";

      items.push({
        entidade: r.rede,
        tipo: "Rede",
        healthScore: score,
        classificacao: cls,
        indicadoresChave: {
          metaR$: r.meta,
          faturamentoR$: r.faturamento || 0,
          pacePct: p,
          forecastR$: r.meta * (p / 100),
          gapR$: Math.max(0, r.meta - (r.faturamento || 0))
        }
      });
    });

    return items;
  }
}
