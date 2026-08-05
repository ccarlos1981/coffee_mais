import { TimelineEvent } from "../dto/copilot-dto";

export class TimelineEngine {
  public static generateTimeline(context: any): TimelineEvent[] {
    const exec = context.executive || context.executiveSummary;
    return [
      {
        id: "TL-1",
        timestamp: new Date().toISOString(),
        tipo: "Meta",
        descricao: "Fechamento e consolidação das metas por rede via RPS",
        valorNovo: `R$ ${(exec.metaNacional / 1000000).toFixed(2)}M`
      },
      {
        id: "TL-2",
        timestamp: new Date().toISOString(),
        tipo: "Forecast",
        descricao: "Atualização do modelo preditivo de vendas",
        valorNovo: `R$ ${(exec.forecast / 1000000).toFixed(2)}M`
      }
    ];
  }
}
