import { IntelligentAlert } from "../dto/copilot-dto";

export class AlertEngine {
  public static generateAlerts(context: any): IntelligentAlert[] {
    const exec = context.executive || context.executiveSummary;
    return [
      {
        id: "ALT-1",
        nivel: exec.pace < 80 ? "Critical" : "Warning",
        titulo: "Desvio do Pace Planejado",
        mensagem: `Pace atual de ${exec.pace}% diverge da trajetória ideal de fechamento`,
        impactoR$: exec.gapMeta
      },
      {
        id: "ALT-2",
        nivel: "Information",
        titulo: "Estabilidade Operacional",
        mensagem: "Fontes oficiais sincronizadas sem inconsistências",
        impactoR$: 0
      }
    ];
  }
}
