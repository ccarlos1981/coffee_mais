import { RevenueSimulationResult } from "../dto/rgm-dto";

export class RevenueSimulatorEngine {
  public static runSimulation(
    pricePct: number,
    volPct: number,
    mixPct: number,
    newClients: number,
    baseRevenue: number = 10000000
  ): RevenueSimulationResult {
    const priceEffect = baseRevenue * (pricePct / 100);
    const volEffect = baseRevenue * (volPct / 100);
    const mixEffect = baseRevenue * (mixPct / 100);
    const clientEffect = newClients * 50000;

    const incrementalR$ = Math.round(priceEffect + volEffect + mixEffect + clientEffect);
    const receitaSimuladaR$ = baseRevenue + incrementalR$;
    const impactoMargemPct = Number(((pricePct * 0.8) + (mixPct * 0.5) + (volPct * 0.2)).toFixed(1));

    return {
      variacaoPrecoPct: pricePct,
      variacaoVolumePct: volPct,
      variacaoMixPct: mixPct,
      novosClientes: newClients,
      receitaSimuladaR$,
      incrementalR$,
      impactoMargemPct
    };
  }
}
