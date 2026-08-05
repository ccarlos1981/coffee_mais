import { CommercialScoreItem } from "../dto/copilot-dto";

export class CommercialScoreEngine {
  public static generateScores(context: any): CommercialScoreItem[] {
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    return mgrs.map((g: any) => {
      const scoreVal = Math.min(100, Math.max(0, Math.round(g.pace)));
      let classificacao: CommercialScoreItem['classificacao'] = 'Bom';
      if (scoreVal >= 100) classificacao = 'Excelente';
      else if (scoreVal < 80) classificacao = 'Crítico';
      else if (scoreVal < 90) classificacao = 'Atenção';

      return {
        entidade: g.manager,
        tipo: 'Gerente' as const,
        score: scoreVal,
        classificacao,
        fatores: [`Pace de ${g.pace.toFixed(1)}%`, `Gap de R$ ${(g.gap / 1000).toFixed(0)}k`]
      };
    });
  }
}
