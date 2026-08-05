import { RGMExecutiveActionPlan } from "../dto/rgm-dto";

export class ExecutiveActionPlanEngine {
  public static generateActionPlan(opportunities: any[]): RGMExecutiveActionPlan {
    const topPrioritiesWeekly = [
      "Ajustar precificação média dos produtos Gourmet em redes de SP",
      "Expansão do mix de Cápsulas Alumínio na Rede ZAFFARI",
      "Revisar positivação de clientes em atraso no estado de MG"
    ];

    const topPrioritiesMonthly = [
      "Alcançar 100% da Meta Nacional via aceleração de volume",
      "Formalizar novos acordos comerciais com Top 10 Redes",
      "Consolidar participação de mercado no segmento Especiais"
    ];

    const planoNacional = [
      "Ação 1: Reunião semanal de alinhamento de metas da RPS com gerentes",
      "Ação 2: Monitoramento presencial de positivação por supervisor",
      "Ação 3: Liberação de investimentos estratégicos condicionados a volume"
    ];

    const totalImpact = opportunities.reduce((acc: number, opp: any) => acc + (opp.impactoFinanceiroR$ || 0), 0);

    return {
      prioridadesSemanais: topPrioritiesWeekly,
      prioridadesMensais: topPrioritiesMonthly,
      planoNacional,
      planoPorGerente: {
        "Leandro": ["Acelerar positivação ZAFFARI", "Ajuste de tabela SP"],
        "Julliano": ["Expandir mix CARREFOUR", "Negociação comercial RJ"]
      },
      impactoTotalEsperadoR$: Math.round(totalImpact || 2500000)
    };
  }
}
