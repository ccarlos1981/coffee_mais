import { ExecutiveBriefingItem } from "../dto/intelligence-dto";

export class ExecutiveBriefingEngine {
  public static generateBriefing(context: any): ExecutiveBriefingItem {
    const exec = context.executive || context.executiveSummary;
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const redes = context.rankings?.redes || context.networkRanking || [];

    const topGrowths = redes.filter((r: any) => r.pace >= 100).slice(0, 3).map((r: any) => `${r.rede} (Pace ${r.pace.toFixed(1)}%)`);
    const topDrops = redes.filter((r: any) => r.pace < 85).slice(0, 3).map((r: any) => `${r.rede} (Pace ${r.pace.toFixed(1)}%)`);

    return {
      resumoNacional: `O faturamento nacional consolidado atingiu R$ ${(exec.faturamentoAtual / 1000000).toFixed(2)}M contra a Meta de R$ ${(exec.metaNacional / 1000000).toFixed(2)}M, representando um Pace de ${exec.pace.toFixed(1)}% e um Forecast de fechamento de R$ ${(exec.forecast / 1000000).toFixed(2)}M.`,
      maioresCrescimentos: topGrowths.length > 0 ? topGrowths : ["Carteira com estabilidade de vendas"],
      maioresQuedas: topDrops.length > 0 ? topDrops : ["Sem redes com queda acelerada superior a 15%"],
      principaisRiscos: [
        exec.pace < 90 ? `Gap acumulado de R$ ${(exec.gapMeta / 1000000).toFixed(2)}M exige aceleração` : "Operação alinhada à trajetória de metas"
      ],
      principaisOportunidades: [
        "Aumento da positivação de novos SKUs em clientes cadastrados na RPS"
      ],
      recomendacoesChave: [
        "Revisar alocação de investimentos comerciais no Top 10 Redes",
        "Monitorar o ritmo de pedidos da carteira semanalmente"
      ],
      prioridadesDaSemana: [
        "Foco em fechamento de negociações no estado de SP",
        "Acompanhar positividade dos gerentes com Pace em Atenção"
      ]
    };
  }
}
