export class RiskRules {
  public static evaluateRisk(pace: number, gapR$: number): { level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; ruleId: string } {
    if (pace < 75 || gapR$ > 2000000) {
      return { level: "CRITICAL", ruleId: "RK-01" };
    } else if (pace < 85 || gapR$ > 1000000) {
      return { level: "HIGH", ruleId: "RK-02" };
    } else if (pace < 95 || gapR$ > 300000) {
      return { level: "MEDIUM", ruleId: "RK-03" };
    }
    return { level: "LOW", ruleId: "RK-04" };
  }
}
