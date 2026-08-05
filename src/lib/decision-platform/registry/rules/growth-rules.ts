export class GrowthRules {
  public static evaluateGrowth(pace: number): { status: string; ruleId: string; description: string } {
    if (pace >= 105) {
      return { status: "EXPANSION_ACCELERATED", ruleId: "GR-01", description: "Pace superior a 105% indica crescimento acima do mercado" };
    } else if (pace >= 100) {
      return { status: "TARGET_ACHIEVED", ruleId: "GR-02", description: "Pace dentro do planejado 100%" };
    } else {
      return { status: "BELOW_TARGET", ruleId: "GR-03", description: "Pace abaixo do target exigindo ação corretiva" };
    }
  }
}
