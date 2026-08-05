import { PriorityMatrixItem } from "../dto/rgm-dto";

export class PriorityMatrixEngine {
  public static buildPriorityMatrix(opportunities: any[]): PriorityMatrixItem[] {
    return opportunities.map((opp: any, idx: number) => {
      const isHighImpact = opp.impactoFinanceiroR$ >= 500000;
      const isEasy = opp.confiancaPct >= 90;

      let quadrante: PriorityMatrixItem["quadrante"] = "Quick Wins";
      if (isHighImpact && isEasy) quadrante = "Quick Wins";
      else if (isHighImpact && !isEasy) quadrante = "Alto Impacto";
      else if (!isHighImpact && isEasy) quadrante = "Manutenção";
      else quadrante = "Longo Prazo";

      return {
        id: `PMAT-${idx + 1}`,
        oportunidade: opp.descricao || `Alavancagem ${opp.entidade}`,
        entidade: opp.entidade,
        impactoFinanceiroR$: opp.impactoFinanceiroR$,
        facilidadeExecucao: isEasy ? "ALTA" : "MÉDIA",
        quadrante
      };
    });
  }
}
