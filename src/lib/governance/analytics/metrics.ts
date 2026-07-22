/**
 * Regras e Fórmulas de Métricas Oficiais — Analytics Engine V1
 * 
 * Este arquivo centraliza todas as fórmulas financeiras e comerciais do Coffee++,
 * garantindo alinhamento absoluto às regras do MyMetrics (Sankhya / Metabase).
 * 
 * @see Regra de Governança Financeira (Seção 10)
 */

export interface AggregatedMetrics {
  fat: number;
  qty: number;
  maco: number;
  vendaFutura?: number;
  ticketMedio?: number;
}

/**
 * Calcula a métrica de MACO (Margem de Contribuição) considerando a dedução de investimentos.
 * 
 * @param rawMaco Valor de MACO bruto da view oficial
 * @param fat Faturamento bruto/líquido consolidado
 * @param investmentPct Percentual de investimento comercial (ex: 0.05 para 5%)
 */
export function calculateMaco(rawMaco: number, fat: number, investmentPct: number = 0): number {
  if (investmentPct > 0) {
    return rawMaco - (fat * investmentPct);
  }
  return rawMaco;
}

/**
 * Expressão SQL padrão para agregação de MACO considerando percentual de investimento.
 */
export function buildMacoSqlExpression(investmentPct: number = 0, tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  if (investmentPct > 0) {
    return `SUM(${prefix}maco - (${prefix}fat * ${investmentPct}))`;
  }
  return `SUM(${prefix}maco)`;
}

/**
 * Calcula o Ticket Médio a partir de Faturamento e Positivação (Número de Clientes ou Vendas).
 */
export function calculateTicketMedio(totalFat: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return totalFat / totalCount;
}

/**
 * Expressão SQL padrão para Faturamento Líquido Real.
 */
export function buildFatSqlExpression(tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return `SUM(${prefix}fat)`;
}

/**
 * Expressão SQL padrão para Quantidade Comercial.
 */
export function buildQtySqlExpression(tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return `SUM(${prefix}qty)`;
}
