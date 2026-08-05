export class PriorityRules {
  public static calculatePriorityScore(riskScore: number, oppScore: number, growthScore: number): number {
    return Math.min(100, Math.max(0, Math.round((riskScore * 0.4) + (oppScore * 0.4) + (growthScore * 0.2))));
  }
}
