export class BriefingRules {
  public static formatExecutiveTone(pace: number, gapR$: number): string {
    if (pace >= 100) {
      return `Operação nacional performando com alta eficiência. Pace em ${pace.toFixed(1)}%.`;
    }
    return `Trajetória comercial exige atenção para atingimento de meta. Gap acumulado de R$ ${(gapR$ / 1000000).toFixed(2)}M.`;
  }
}
