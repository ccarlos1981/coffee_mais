import { CopilotRecommendation } from "../dto/copilot-dto";

export class RecommendationEngine {
  public static generateRecommendations(context: any): CopilotRecommendation[] {
    const exec = context.executive || context.executiveSummary;
    const rankings = context.rankings || { redes: context.networkRanking };

    return [
      {
        id: "REC-1",
        tipo: "Investimento",
        acaoRecomendada: rankings.redes && rankings.redes[0] ? `Aumentar investimento comercial na ${rankings.redes[0].rede}` : "Aumentar investimento em redes chave",
        entidade: (rankings.redes && rankings.redes[0]?.rede) || "Top Redes",
        justificativa: "Rede com alta conversão e Pace acima de 100%",
        impactoEstimadoR$: exec.metaNacional * 0.05
      },
      {
        id: "REC-2",
        tipo: "Negociação",
        acaoRecomendada: "Antecipar rodada de negociação no estado de SP",
        entidade: "SP",
        justificativa: "Representa 35% do volume previsto nacional",
        impactoEstimadoR$: exec.metaNacional * 0.08
      }
    ];
  }
}
