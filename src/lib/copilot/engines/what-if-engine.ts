import { WhatIfScenarioResult } from "../dto/copilot-dto";

export class WhatIfEngine {
  public static runCustomScenario(variationPct: number, context: any): WhatIfScenarioResult {
    const exec = context.executive || context.executiveSummary;
    const fatSim = exec.faturamentoAtual * (1 + variationPct / 100);
    const gapSim = Math.max(0, exec.metaNacional - fatSim);
    const paceSim = Number(((fatSim / (exec.med3MNacional || exec.metaNacional)) * 100).toFixed(1));
    const forecastSim = exec.metaNacional * (paceSim / 100);
    return {
      variacaoPct: variationPct,
      faturamentoSimulado: Number(fatSim.toFixed(2)),
      gapSimulado: Number(gapSim.toFixed(2)),
      paceSimulado: paceSim,
      forecastSimulado: Number(forecastSim.toFixed(2))
    };
  }

  public static generateScenarios(context: any): WhatIfScenarioResult[] {
    return [2, 5, 8, 10, 15, 20].map(v => this.runCustomScenario(v, context));
  }
}
