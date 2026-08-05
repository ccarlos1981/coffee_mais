export class HealthRules {
  public static classifyHealthScore(score: number): 'Excelente' | 'Saudável' | 'Atenção' | 'Crítico' {
    if (score >= 100) return 'Excelente';
    if (score >= 90) return 'Saudável';
    if (score >= 80) return 'Atenção';
    return 'Crítico';
  }
}
