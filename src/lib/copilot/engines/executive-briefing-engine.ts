import { ExecutiveBriefing } from "../dto/copilot-dto";

export class ExecutiveBriefingEngine {
  public static generateBriefing(context: any): ExecutiveBriefing {
    const exec = context.executive || context.executiveSummary;
    const rankings = context.rankings || { redes: context.networkRanking };
    return {
      titulo: "Briefing Executivo Nacional — Coffee++",
      dataGeracao: new Date().toLocaleDateString("pt-BR"),
      resumoNacional: `Meta Nacional de R$ ${(exec.metaNacional / 1000000).toFixed(2)}M com Faturamento Atual de R$ ${(exec.faturamentoAtual / 1000000).toFixed(2)}M e Pace de ${exec.pace}%.`,
      principaisCrescimentos: [
        rankings.redes && rankings.redes[0] ? `Rede ${rankings.redes[0].rede} performando acima da média` : "Vendas em expansão"
      ],
      principaisRiscos: [
        exec.pace < 90 ? `Pace acumulado de ${exec.pace}% necessita aceleração` : "Sem riscos críticos detectados"
      ],
      topOportunidades: [
        "Aumento de faturamento com expansão de positivação por SKU"
      ],
      gapMeta: exec.gapMeta,
      forecastFechamento: exec.forecast,
      proximasAcoes: [
        "Revisar alocação de verbas na RPS",
        "Acompanhar positividade dos 10 maiores clientes"
      ]
    };
  }
}
