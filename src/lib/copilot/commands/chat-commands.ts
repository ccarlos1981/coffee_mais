import { ChatMessageResponse } from "../dto/copilot-dto";

export interface CommandHandler {
  canHandle(query: string): boolean;
  execute(query: string, context: any): ChatMessageResponse;
}

export class TopManagersCommand implements CommandHandler {
  canHandle(query: string): boolean {
    const q = query.toLowerCase();
    return q.includes("gerente") || q.includes("top manager") || q.includes("gestor");
  }
  execute(query: string, context: any): ChatMessageResponse {
    const mgrs = context.rankings?.gerentes || context.managerRanking || [];
    const topM = mgrs[0] || { manager: "Nacional", meta: 0, pace: 100 };
    return {
      pergunta: query,
      resposta: `O maior gerente em meta cadastrada é ${topM.manager} com R$ ${(topM.meta / 1000000).toFixed(2)}M e Pace de ${topM.pace.toFixed(1)}%.`,
      fonteDados: ["CommercialPlanningService", "cm_weekly_projections"],
      confiancaPct: 100,
      commandExecuted: "TopManagersCommand"
    };
  }
}

export class ForecastCommand implements CommandHandler {
  canHandle(query: string): boolean {
    const q = query.toLowerCase();
    return q.includes("forecast") || q.includes("previsão") || q.includes("fechamento");
  }
  execute(query: string, context: any): ChatMessageResponse {
    const exec = context.executive || context.executiveSummary;
    return {
      pergunta: query,
      resposta: `O Forecast estimado de fechamento nacional é de R$ ${(exec.forecast / 1000000).toFixed(2)}M (Pace atual: ${exec.pace}%).`,
      fonteDados: ["AnalyticsEngine", "CockpitService"],
      confiancaPct: 100,
      commandExecuted: "ForecastCommand"
    };
  }
}

export class GapCommand implements CommandHandler {
  canHandle(query: string): boolean {
    const q = query.toLowerCase();
    return q.includes("gap") || q.includes("falta") || q.includes("distante");
  }
  execute(query: string, context: any): ChatMessageResponse {
    const exec = context.executive || context.executiveSummary;
    return {
      pergunta: query,
      resposta: `O Gap para atingir 100% da meta nacional é de R$ ${(exec.gapMeta / 1000000).toFixed(2)}M.`,
      fonteDados: ["AnalyticsEngine", "cm_weekly_projections"],
      confiancaPct: 100,
      commandExecuted: "GapCommand"
    };
  }
}

export class RiskCommand implements CommandHandler {
  canHandle(query: string): boolean {
    const q = query.toLowerCase();
    return q.includes("risco") || q.includes("crítico") || q.includes("alerta");
  }
  execute(query: string, context: any): ChatMessageResponse {
    const risks = context.risks || context.riskPanel || [];
    const topRisk = risks[0] || { entidade: "Nacional", motivo: "Sem riscos críticos" };
    return {
      pergunta: query,
      resposta: `A entidade com maior risco é ${topRisk.entidade}: ${topRisk.motivo}.`,
      fonteDados: ["AnalyticsEngine", "CopilotRiskEngine"],
      confiancaPct: 100,
      commandExecuted: "RiskCommand"
    };
  }
}

export class RankingCommand implements CommandHandler {
  canHandle(query: string): boolean {
    const q = query.toLowerCase();
    return q.includes("ranking") || q.includes("rede") || q.includes("posição");
  }
  execute(query: string, context: any): ChatMessageResponse {
    const redes = context.rankings?.redes || context.networkRanking || [];
    const topRede = redes[0] || { rede: "Nacional", meta: 0, pace: 100 };
    return {
      pergunta: query,
      resposta: `A principal rede no ranking comercial é ${topRede.rede} com R$ ${(topRede.meta / 1000000).toFixed(2)}M e Pace de ${topRede.pace.toFixed(1)}%.`,
      fonteDados: ["AnalyticsEngine", "Rolling FAT 3M"],
      confiancaPct: 100,
      commandExecuted: "RankingCommand"
    };
  }
}
