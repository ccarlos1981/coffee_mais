import { ExplainableKPIItem } from "../dto/copilot-dto";

export class ExplainableKPIEngine {
  public static generateExplanations(context: any): Record<string, ExplainableKPIItem> {
    const exec = context.executive || context.executiveSummary;

    return {
      metaNacional: {
        kpiKey: "metaNacional",
        kpiLabel: "Meta Nacional",
        valorAtual: exec.metaNacional,
        origem: "Projeções cadastradas na RPS (cm_weekly_projections)",
        fatoresContribuintes: ["Desafio Comercial", "Soma das Redes Planejáveis"],
        tendencia: "Estável",
        impactoFinanceiro: `R$ ${(exec.metaNacional / 1000000).toFixed(2)}M projetados`,
        recomendacao: "Manter governança de cadastro na RPS"
      },
      faturamentoAtual: {
        kpiKey: "faturamentoAtual",
        kpiLabel: "Faturamento Realizado",
        valorAtual: exec.faturamentoAtual,
        origem: "MyMetrics / view mv_vendas_cliente_mensal",
        fatoresContribuintes: ["Pedidos faturados", "Bonificações TOP 1117"],
        tendencia: exec.pace >= 100 ? "Crescimento" : "Estável",
        impactoFinanceiro: `R$ ${(exec.faturamentoAtual / 1000000).toFixed(2)}M realizados`,
        recomendacao: "Incentivar positivação nas redes sem pedido"
      }
    };
  }
}
