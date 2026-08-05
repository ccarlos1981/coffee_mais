export class MixRules {
  public static evaluateMixHealth(skuPositivityPct: number): { recommendation: string; ruleId: string } {
    if (skuPositivityPct < 60) {
      return { recommendation: "EXPAND_SKU_POSITIVITY", ruleId: "MX-01" };
    }
    return { recommendation: "MAINTAIN_SKU_MIX", ruleId: "MX-02" };
  }
}
