/**
 * Motor de Cálculo de Feriados e Dias Úteis Brasil (Coffee++)
 * Demanda 003 — Release 3
 */

export interface MonthBusinessDays {
  year: number;
  month: number;
  monthName: string;
  total_days: number;
  elapsed_days: number;
  remaining_days: number;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

/**
 * Retorna a data de Domingo de Páscoa para determinado ano utilizando o algoritmo de Meeus/Gauss
 */
export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Março, 4 = Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Retorna as datas (YYYY-MM-DD) dos feriados móveis baseados na Páscoa:
 * - Sexta-feira Santa (Páscoa - 2 dias)
 * - Terça-feira de Carnaval (Páscoa - 47 dias)
 * - Corpus Christi (Páscoa + 60 dias)
 */
export function getMovableHolidays(year: number): string[] {
  const easter = getEasterSunday(year);

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);

  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return [formatDate(goodFriday), formatDate(carnival), formatDate(corpusChristi)];
}

/**
 * Retorna as datas (YYYY-MM-DD) dos feriados nacionais fixos do Brasil
 */
export function getNationalHolidays(year: number): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = year;

  const fixed = [
    `${y}-01-01`, // Confraternização Universal
    `${y}-04-21`, // Tiradentes
    `${y}-05-01`, // Dia do Trabalhador
    `${y}-09-07`, // Independência do Brasil
    `${y}-10-12`, // Nossa Senhora Aparecida
    `${y}-11-02`, // Finados
    `${y}-11-15`, // Proclamação da República
    `${y}-11-20`, // Dia da Consciência Negra (Lei nº 14.759)
    `${y}-12-25`, // Natal
  ];

  return [...fixed, ...getMovableHolidays(year)];
}

/**
 * Consolida todos os feriados nacionais e customizados para o ano em um Set para consulta O(1)
 */
export function getHolidaysForYear(year: number, customHolidays: string[] = []): Set<string> {
  const national = getNationalHolidays(year);
  return new Set([...national, ...customHolidays]);
}

/**
 * Verifica se determinada data é dia útil (Segunda a Sexta e não feriado)
 */
export function isBusinessDay(date: Date, holidaysSet: Set<string>): boolean {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const formatted = `${y}-${m}-${d}`;

  return !holidaysSet.has(formatted);
}

/**
 * Calcula os dias úteis totais e dinâmicos para um mês específico
 */
export function calculateMonthBusinessDays(
  year: number,
  month: number,
  currentDate: Date = new Date(),
  customHolidays: string[] = []
): MonthBusinessDays {
  const holidaysSet = getHolidaysForYear(year, customHolidays);
  const daysInMonth = new Date(year, month, 0).getDate();

  let total_days = 0;
  let elapsed_days = 0;

  const curYear = currentDate.getFullYear();
  const curMonth = currentDate.getMonth() + 1;
  const curDay = currentDate.getDate();

  const isPastMonth = year < curYear || (year === curYear && month < curMonth);
  const isFutureMonth = year > curYear || (year === curYear && month > curMonth);
  const isCurrentMonth = year === curYear && month === curMonth;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (isBusinessDay(d, holidaysSet)) {
      total_days++;
      if (isPastMonth) {
        elapsed_days++;
      } else if (isCurrentMonth && day <= curDay) {
        elapsed_days++;
      }
    }
  }

  if (isFutureMonth) {
    elapsed_days = 0;
  }

  return {
    year,
    month,
    monthName: MONTH_NAMES[month - 1],
    total_days,
    elapsed_days,
    remaining_days: Math.max(0, total_days - elapsed_days),
  };
}

/**
 * Gera a matriz dos 12 meses do ano com cálculo estático de total_days e dinâmico de elapsed_days
 */
export function getFullYearBusinessDays(
  year: number,
  currentDate: Date = new Date(),
  customHolidays: string[] = []
): MonthBusinessDays[] {
  const result: MonthBusinessDays[] = [];
  for (let m = 1; m <= 12; m++) {
    result.push(calculateMonthBusinessDays(year, m, currentDate, customHolidays));
  }
  return result;
}
