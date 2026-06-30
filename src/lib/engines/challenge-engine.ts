/**
 * challenge-engine.ts
 * Motor de cálculos de performance comercial para os Promotores (Desafio Promotor).
 */

export interface PerformanceBadge {
  label: "META BATIDA" | "QUASE LÁ" | "ATENÇÃO" | "PRECISA MELHORAR" | "SEM META";
  colorClass: string;
}

export function calculateAchievement(realizado: number, meta: number): number | null {
  if (meta <= 0) return null;
  return (realizado / meta) * 100;
}

export function calculateBonusPercentage(achievement: number | null): number {
  if (achievement === null) return 0;
  if (achievement >= 100) return 100;
  if (achievement >= 90) return 70;
  if (achievement >= 80) return 50;
  return 0;
}

export function calculateMonthlyRemuneration(realizado: number, achievement: number | null): number {
  if (achievement === null || achievement < 100) return 0;
  return realizado * 0.06;
}

export function calculateQuarterlyBonus(
  julAch: number | null,
  agoAch: number | null,
  setAch: number | null
): number {
  if (
    julAch !== null && julAch >= 100 &&
    agoAch !== null && agoAch >= 100 &&
    setAch !== null && setAch >= 100
  ) {
    return 500.00;
  }
  return 0;
}

export function calculateProportionalFactor(
  month: number, // 1-12
  year: number,
  admissionDate?: string | null,
  terminationDate?: string | null
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = new Date(year, month - 1, 1).getTime();
  const monthEnd = new Date(year, month - 1, daysInMonth, 23, 59, 59).getTime();

  let workedStart = monthStart;
  let workedEnd = monthEnd;

  if (admissionDate) {
    const adm = new Date(admissionDate).getTime();
    if (adm > monthEnd) return 0; // Entrou depois do mês
    if (adm > monthStart) workedStart = adm;
  }

  if (terminationDate) {
    const term = new Date(terminationDate).getTime();
    if (term < monthStart) return 0; // Saiu antes do mês
    if (term < monthEnd) workedEnd = term;
  }

  const daysWorked = Math.ceil((workedEnd - workedStart) / (1000 * 60 * 60 * 24));
  
  if (daysWorked >= daysInMonth) return 1;
  if (daysWorked <= 0) return 0;
  
  return daysWorked / daysInMonth;
}

export function getPerformanceBadge(achievement: number | null): PerformanceBadge {
  if (achievement === null) return { label: "SEM META", colorClass: "bg-neutral-800 text-neutral-300 border-neutral-700" };
  if (achievement >= 100) return { label: "META BATIDA", colorClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]" };
  if (achievement >= 90) return { label: "QUASE LÁ", colorClass: "bg-blue-500/15 text-blue-500 border-blue-500/40" };
  if (achievement >= 80) return { label: "ATENÇÃO", colorClass: "bg-amber-500/15 text-amber-500 border-amber-500/40" };
  return { label: "PRECISA MELHORAR", colorClass: "bg-red-500/15 text-red-500 border-red-500/40" };
}

export function getProgressBarColor(achievement: number | null): string {
  if (achievement === null) return "bg-neutral-800";
  if (achievement >= 100) return "bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.5)]";
  if (achievement >= 90) return "bg-gradient-to-r from-blue-400 to-blue-600";
  if (achievement >= 80) return "bg-gradient-to-r from-amber-400 to-amber-500";
  return "bg-gradient-to-r from-red-500 to-red-600";
}

export interface MonthlyData {
  meta: number;
  realizado: number;
  achievement: number | null;
}

export interface PromotorRankingEntry {
  promotor_id: string;
  position: number;
  name: string;
  employee_code: string;
  supervisor: string;
  uf: string;
  region: string;
  
  // Monthly data
  jul: MonthlyData;
  ago: MonthlyData;
  set: MonthlyData;

  // Q3 Aggregated
  meta_q3: number;
  realizado_q3: number;
  achievement_q3: number | null;
  
  // Financial
  bonus_percent: number;
  estimated_bonus_value: number;
  
  // Visuals
  status: PerformanceBadge;
  progressColor: string;
}
