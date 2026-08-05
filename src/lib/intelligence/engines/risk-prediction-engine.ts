import { RiskPredictionItem } from "../dto/intelligence-dto";

export class RiskPredictionEngine {
  public static predictRisks(context: any): RiskPredictionItem[] {
    const exec = context.executive || context.executiveSummary;
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const redes = context.rankings?.redes || context.networkRanking || [];
    const risks: RiskPredictionItem[] = [];

    if (exec.pace < 90) {
      risks.push({
        id: "RISK-NAT-1",
        entidade: "Brasil (Nacional)",
        tipo: "Brasil" as any,
        categoriaRisco: "Meta Não Atingida",
        nivelRisco: exec.pace < 80 ? "Crítico" : "Alto",
        impactoR$: exec.gapMeta,
        motivo: `Pace nacional em ${exec.pace}%, projetando gap de R$ ${(exec.gapMeta / 1000000).toFixed(2)}M.`
      });
    }

    mgrs.filter((g: any) => g.pace < 85).forEach((g: any, idx: number) => {
      risks.push({
        id: `RISK-MGR-${idx + 1}`,
        entidade: g.manager,
        tipo: "Gerente",
        categoriaRisco: "Meta Não Atingida",
        nivelRisco: g.pace < 75 ? "Crítico" : "Alto",
        impactoR$: g.gap || 0,
        motivo: `Gerente ${g.manager} está com Pace de ${g.pace.toFixed(1)}%.`
      });
    });

    redes.filter((r: any) => r.pace < 85).slice(0, 5).forEach((r: any, idx: number) => {
      const gap = Math.max(0, r.meta - (r.faturamento || 0));
      risks.push({
        id: `RISK-REDE-${idx + 1}`,
        entidade: r.rede,
        tipo: "Rede",
        categoriaRisco: "Queda Volume",
        nivelRisco: r.pace < 75 ? "Crítico" : "Alto",
        impactoR$: gap,
        motivo: `Rede ${r.rede} com Pace de ${r.pace.toFixed(1)}%.`
      });
    });

    if (risks.length === 0) {
      risks.push({
        id: "RISK-STABLE-1",
        entidade: "Operação Comercial",
        tipo: "Brasil" as any,
        categoriaRisco: "Preço Médio",
        nivelRisco: "Médio",
        impactoR$: 0,
        motivo: "Nenhum risco de ruptura crítica identificado no período."
      });
    }

    return risks;
  }
}
