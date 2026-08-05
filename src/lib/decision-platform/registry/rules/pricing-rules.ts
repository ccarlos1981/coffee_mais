export class PricingRules {
  public static evaluatePricingVariance(priceVariancePct: number): { status: string; ruleId: string } {
    if (priceVariancePct < -5) {
      return { status: "DISCOUNT_EXCESSIVE", ruleId: "PR-01" };
    } else if (priceVariancePct > 5) {
      return { status: "PREMIUM_REALIZED", ruleId: "PR-02" };
    }
    return { status: "BALANCED_PRICING", ruleId: "PR-03" };
  }
}
