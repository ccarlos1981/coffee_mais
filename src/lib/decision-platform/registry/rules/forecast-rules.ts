export class ForecastRules {
  public static evaluateForecastConfidence(pace: number): { confidencePct: number; ruleId: string } {
    if (pace >= 90 && pace <= 110) {
      return { confidencePct: 98, ruleId: "FC-01" };
    } else if (pace >= 80) {
      return { confidencePct: 92, ruleId: "FC-02" };
    }
    return { confidencePct: 85, ruleId: "FC-03" };
  }
}
