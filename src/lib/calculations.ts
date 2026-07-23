/**
 * Cálculos comerciais core do Coffee Mais
 */

/** 
 * MaCo = Faturamento Total - Impostos - Investimento - Frete - CMV/CPV
 */
export function calcMaCo(params: {
  revenue: number;
  taxes?: number;
  investment?: number;
  freight?: number;
  cmv?: number;
}): number {
  return (
    params.revenue -
    (params.taxes || 0) -
    (params.investment || 0) -
    (params.freight || 0) -
    (params.cmv || 0)
  );
}

/**
 * MaCo/Kg = MaCo / Volume em Kg
 */
export function calcMaCoPerKg(maco: number, weightKg: number): number {
  if (weightKg <= 0) return 0;
  return maco / weightKg;
}

/**
 * R$/Kg = Faturamento / Volume em Kg
 */
export function calcPricePerKg(revenue: number, weightKg: number): number {
  if (weightKg <= 0) return 0;
  return revenue / weightKg;
}

/**
 * @deprecated DESCONTINUADO — O PACE oficial do Coffee++ é calculado exclusivamente via `AnalyticsEngine.calculatePace`
 * (Projeção Histórica Baseada no Remanescente do Mês Anterior).
 */
export function calcPace(
  actual: number,
  totalBusinessDays: number,
  elapsedBusinessDays: number
): number {
  if (elapsedBusinessDays <= 0) return 0;
  return (actual / elapsedBusinessDays) * totalBusinessDays;
}

/**
 * % Participação = (Parte / Total) × 100
 */
export function calcParticipation(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}
