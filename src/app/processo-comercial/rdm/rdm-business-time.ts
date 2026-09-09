/**
 * Utilitário de determinação da competência comercial oficial no fuso de São Paulo (America/Sao_Paulo).
 * Garante que viradas de mês/ano não sofram desvios por diferenças de fuso horário em relação a UTC.
 */

export const RDM_MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
] as const;

export function getCurrentBusinessCompetence(baseDate: Date = new Date()): {
  currentYear: number;
  currentMonth: number;
  currentMonthName: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
  });
  const parts = formatter.formatToParts(baseDate);
  const currentYear = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const currentMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
  const currentMonthName = RDM_MONTH_NAMES[currentMonth - 1] ?? '';
  return { currentYear, currentMonth, currentMonthName };
}
