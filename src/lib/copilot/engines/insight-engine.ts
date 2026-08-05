import { CopilotInsight } from "../dto/copilot-dto";

export class InsightEngine {
  public static generateInsights(context: any): CopilotInsight[] {
    const exec = context.executive || context.executiveSummary;
    const rankings = context.rankings || { redes: context.networkRanking, gerentes: context.managerRanking };

    return [
      {
        id: "INS-1",
        categoria: "Crescimento",
        titulo: "Rede com Alto Desempenho",
        descricao: rankings.redes && rankings.redes[0] ? `A rede ${rankings.redes[0].rede} lidera com Pace de ${rankings.redes[0].pace}%` : "Crescimento acelerado na carteira",
        impactoR$: exec.metaNacional * 0.1,
        prioridade: "ALTA",
        entidade: (rankings.redes && rankings.redes[0]?.rede) || "Nacional"
      },
      {
        id: "INS-2",
        categoria: "Risco",
        titulo: "Pace em Desaceleração",
        descricao: exec.pace < 90 ? `Pace nacional em ${exec.pace}%, requer atenção no fechamento` : "Manter acompanhamento semanal",
        impactoR$: exec.gapMeta,
        prioridade: exec.pace < 80 ? "ALTA" : "MÉDIA",
        entidade: "Nacional"
      }
    ];
  }
}
