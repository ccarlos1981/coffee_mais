import { CommercialActionPlanItem } from "../dto/intelligence-dto";

export class ActionPlanEngine {
  public static generateActionPlans(context: any): CommercialActionPlanItem[] {
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const exec = context.executive || context.executiveSummary;

    const plans: CommercialActionPlanItem[] = [];

    mgrs.slice(0, 3).forEach((g: any, idx: number) => {
      plans.push({
        id: `AP-${idx + 1}`,
        objetivo: `Atingir 100% da Meta na Carteira do Gerente ${g.manager}`,
        responsavel: g.manager,
        prazoDias: 15,
        impactoEsperadoR$: Math.round(g.gap || exec.metaNacional * 0.05),
        indicadoresAfetados: ["Faturamento", "Pace", "Gap Meta"],
        prioridade: g.pace < 85 ? "ALTA" : "MÉDIA"
      });
    });

    if (plans.length === 0) {
      plans.push({
        id: "AP-DEF-1",
        objetivo: "Expandir Positivação por SKU no Território Nacional",
        responsavel: "Gerente Nacional",
        prazoDias: 30,
        impactoEsperadoR$: 500000,
        indicadoresAfetados: ["Positivação", "Volume", "Faturamento"],
        prioridade: "ALTA"
      });
    }

    return plans;
  }
}
