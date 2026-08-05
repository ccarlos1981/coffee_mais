import { RedeViewModel, ManagerBlockViewModel } from "./commercial-planning-service";

export interface NetworkGrowthKPI {
  growthPct: number;
  growthStatus: 'ABOVE' | 'EQUAL' | 'BELOW';
}

export interface ManagerSummaryKPI {
  totalFatYTD: number;
  totalMed3M: number;
  targetMeta: number;
  currentMetaInputsSum: number;
  remainingBalance: number;
  growthPct: number;
  growthStatus: 'ABOVE' | 'EQUAL' | 'BELOW';
}

export class PlanningGoalAllocator {
  public static getNetworkKey(managerId?: string, managerName?: string, codigoMatriz?: string, redeName?: string): string {
    const mgr = managerId || managerName || "";
    const net = codigoMatriz || redeName || "";
    return `${mgr}|${net}`;
  }

  /**
   * Calculates growth percentage and visual status indicator vs 3M Average.
   */
  public static calculateNetworkGrowth(metaVal: number, avg3M: number): NetworkGrowthKPI {
    if (avg3M <= 0 || metaVal <= 0) {
      return {
        growthPct: 0,
        growthStatus: 'EQUAL'
      };
    }

    // Ensure raw R$ computation with 2 decimal places precision
    const growthPct = Number((((metaVal - avg3M) / avg3M) * 100).toFixed(2));
    let growthStatus: 'ABOVE' | 'EQUAL' | 'BELOW' = 'EQUAL';
    if (growthPct > 0.01) growthStatus = 'ABOVE';
    else if (growthPct < -0.01) growthStatus = 'BELOW';

    return { growthPct, growthStatus };
  }

  /**
   * Distributes a top-down manager meta target across networks proportionally based on Rolling 3M Average.
   */
  public static distributeManagerGoal(
    managerBlock: ManagerBlockViewModel,
    targetGoalR$: number
  ): { updatedRedes: RedeViewModel[]; metaInputsPatch: Record<string, number> } {
    const redes = managerBlock.redes || [];
    const totalMed3M = managerBlock.grandTotalMed3M || redes.reduce((acc, r) => acc + (r.avg3M || 0), 0);
    const metaInputsPatch: Record<string, number> = {};

    const updatedRedes = redes.map((net) => {
      const weight = totalMed3M > 0 ? (net.avg3M || 0) / totalMed3M : (redes.length > 0 ? 1 / redes.length : 0);
      const metaVal = Math.round(targetGoalR$ * weight);
      const metaKg = net.avgPriceQ2 > 0 ? metaVal / net.avgPriceQ2 : 0;
      const { growthPct, growthStatus } = this.calculateNetworkGrowth(metaVal, net.avg3M);

      const k1 = `${net.manager_id}|${net.codigo_matriz}|${net.rede}`;
      const k2 = `${net.manager}|${net.rede}`;
      const k3 = `${net.manager_id || net.manager}|${net.codigo_matriz || net.rede}`;
      metaInputsPatch[k1] = metaVal;
      metaInputsPatch[k2] = metaVal;
      metaInputsPatch[k3] = metaVal;

      return {
        ...net,
        metaVal,
        metaKg,
        pctVsAvg3M: growthPct,
        growthPct,
        growthStatus
      };
    });

    return { updatedRedes, metaInputsPatch };
  }

  /**
   * Computes manager summary metrics including YTD Sales, 3M Avg, Target Meta, and remaining balance.
   */
  public static calculateManagerSummary(
    managerBlock: ManagerBlockViewModel,
    metaInputs: Record<string, number>,
    targetManagerMetaInput?: number
  ): ManagerSummaryKPI {
    let currentMetaInputsSum = 0;
    let totalFatYTD = 0;

    (managerBlock.redes || []).forEach((r) => {
      const k1 = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
      const k2 = `${r.manager}|${r.rede}`;
      const k3 = `${r.manager_id || r.manager}|${r.codigo_matriz || r.rede}`;
      const val = metaInputs[k1] !== undefined
        ? metaInputs[k1]
        : (metaInputs[k2] !== undefined
          ? metaInputs[k2]
          : (metaInputs[k3] !== undefined ? metaInputs[k3] : (r.metaVal || 0)));
      
      currentMetaInputsSum += val;

      // Sum YTD Sales across all months
      Object.values(r.monthlyHistory || {}).forEach((m: any) => {
        totalFatYTD += Number(m.fat) || 0;
      });
    });

    const targetMeta = targetManagerMetaInput !== undefined && targetManagerMetaInput > 0
      ? targetManagerMetaInput
      : (managerBlock.grandTotalMeta > 0 ? managerBlock.grandTotalMeta : currentMetaInputsSum);

    const remainingBalance = targetMeta - currentMetaInputsSum;
    const totalMed3M = managerBlock.grandTotalMed3M || 0;
    const { growthPct, growthStatus } = this.calculateNetworkGrowth(currentMetaInputsSum, totalMed3M);

    return {
      totalFatYTD,
      totalMed3M,
      targetMeta,
      currentMetaInputsSum,
      remainingBalance,
      growthPct,
      growthStatus
    };
  }
}
