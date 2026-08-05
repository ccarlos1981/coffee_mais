import { ExplainableFactorItem } from "../dto/intelligence-dto";

export class ExplainableEngine {
  public static generateExplanations(context: any): ExplainableFactorItem[] {
    const exec = context.executive || context.executiveSummary;
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const redes = context.rankings?.redes || context.networkRanking || [];

    const topRedes = redes.slice(0, 3).map((r: any) => r.rede);
    const topGerentes = mgrs.slice(0, 3).map((g: any) => g.manager);

    const variacaoPct = Number((exec.pace - 100).toFixed(1));
    const variacaoR$ = exec.faturamentoAtual - exec.metaNacional;

    return [
      {
        kpi: "Faturamento Nacional vs Meta",
        variacaoPct,
        variacaoR$,
        causaPrincipal: variacaoPct >= 0 ? "Desempenho forte nas principais redes parceiras" : "Desaceleração pontual no ritmo de compras de redes chave",
        redesImpactantes: topRedes.length > 0 ? topRedes : ["Nacional"],
        gerentesImpactantes: topGerentes.length > 0 ? topGerentes : ["Nacional"],
        ufsImpactantes: ["SP", "MG", "RJ"]
      }
    ];
  }
}
