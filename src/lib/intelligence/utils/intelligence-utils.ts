/**
 * IntelligenceUtils
 * Pure deterministic mathematical helpers for intelligence score calculation.
 */
export class IntelligenceUtils {
  public static clampScore(value: number): number {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  public static formatCurrency(val: number): string {
    return `R$ ${(val / 1000000).toFixed(2)}M`;
  }

  public static formatPct(val: number): string {
    return `${val.toFixed(1)}%`;
  }
}
