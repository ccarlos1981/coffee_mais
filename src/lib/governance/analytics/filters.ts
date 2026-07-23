/**
 * Normalização e Construtores de Filtros SQL — Analytics Engine V1
 * 
 * Este arquivo padroniza o parseamento de filtros a partir de URLs ou payloads,
 * fornecendo utilitários robustos para construção de cláusulas SQL parametrizadas.
 * 
 * @see Regra de Governança Financeira (Seção 10)
 */

export interface AnalyticsFilters {
  startDate?: string | null;
  endDate?: string | null;
  startMonth?: string | null;
  endMonth?: string | null;
  referenceDate?: string | null;
  manager_id?: string | null;
  manager?: string | null;
  familia?: string | null;
  uf?: string | null;
  channel?: string | null;
  matriz?: string | null;
  product?: string | null;
  investmentPct?: number;
}

/**
 * Escapa com segurança valores de string para literais SQL.
 */
export function escapeSqlValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

/**
 * Normaliza e parseia os filtros recebidos via URLSearchParams.
 */
export function parseAnalyticsFiltersFromParams(searchParams: URLSearchParams): AnalyticsFilters {
  const startDate = searchParams.get('startDate') || searchParams.get('start_date');
  const endDate = searchParams.get('endDate') || searchParams.get('end_date');
  
  const startMonthParam = searchParams.get('startMonth');
  const endMonthParam = searchParams.get('endMonth');

  let startMonth = startMonthParam || (startDate ? startDate.substring(0, 7) : null);
  let endMonth = endMonthParam || (endDate ? endDate.substring(0, 7) : null);

  const manager_id = searchParams.get('manager_id') !== 'all' ? searchParams.get('manager_id') : null;
  const manager = searchParams.get('manager') !== 'all' ? searchParams.get('manager') : null;
  const familia = searchParams.get('familia') !== 'all' ? searchParams.get('familia') : null;
  const uf = searchParams.get('uf') !== 'all' ? searchParams.get('uf') : null;
  const channel = searchParams.get('channel') !== 'all' ? searchParams.get('channel') : null;
  const matriz = searchParams.get('matriz') !== 'all' ? searchParams.get('matriz') : (searchParams.get('rede') !== 'all' ? searchParams.get('rede') : null);
  const product = searchParams.get('product') !== 'all' ? searchParams.get('product') : null;

  const investment = parseFloat(searchParams.get('investment') || '0');
  const investmentPct = isNaN(investment) ? 0 : investment / 100;

  return {
    startDate,
    endDate,
    startMonth,
    endMonth,
    manager_id,
    manager,
    familia,
    uf,
    channel,
    matriz,
    product,
    investmentPct,
  };
}

/**
 * Construtor de cláusula SQL de intervalo de datas/meses.
 */
export function buildDateFilter(startMonth?: string | null, endMonth?: string | null, tableAlias?: string): string[] {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const clauses: string[] = [];

  if (startMonth) {
    clauses.push(`${prefix}mes >= ${escapeSqlValue(startMonth)}`);
  }
  if (endMonth) {
    clauses.push(`${prefix}mes <= ${escapeSqlValue(endMonth)}`);
  }
  return clauses;
}

/**
 * Construtor de filtro de Gerente padronizado.
 * `manager_id` é a chave primária oficial de busca.
 */
export function buildManagerFilter(manager_id?: string | null, manager?: string | null, tableAlias?: string): string | null {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  if (manager_id && manager_id !== 'all') {
    const ids = manager_id.split(',').map(m => escapeSqlValue(m.trim())).join(',');
    return `${prefix}manager_id IN (${ids})`;
  }
  if (manager && manager !== 'all') {
    const managers = manager.split(',').map(m => escapeSqlValue(m.trim())).join(',');
    // Permite correspondência por manager_id ou manager para manter retrocompatibilidade
    return `(${prefix}manager_id IN (${managers}) OR ${prefix}manager IN (${managers}))`;
  }
  return null;
}

/**
 * Construtor de filtro de Produto e Família.
 */
export function buildProductFilter(product?: string | null, familia?: string | null, tableAlias?: string): string[] {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const clauses: string[] = [];

  if (familia && familia !== 'all') {
    const familias = familia.split(',').map(f => escapeSqlValue(f.trim())).join(',');
    clauses.push(`${prefix}tipo_produto IN (${familias})`);
  }
  if (product && product !== 'all') {
    const products = product.split(',').map(p => escapeSqlValue(p.trim())).join(',');
    clauses.push(`${prefix}product IN (${products})`);
  }
  return clauses;
}

/**
 * Construtor de filtro de Canal.
 */
export function buildChannelFilter(channel?: string | null, tableAlias?: string): string | null {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  if (channel && channel !== 'all') {
    const channels = channel.split(',').map(c => escapeSqlValue(c.trim())).join(',');
    return `${prefix}channel IN (${channels})`;
  }
  return null;
}

/**
 * Construtor de filtro de UF.
 */
export function buildUfFilter(uf?: string | null, tableAlias?: string): string | null {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  if (uf && uf !== 'all') {
    const ufs = uf.split(',').map(u => escapeSqlValue(u.trim())).join(',');
    return `${prefix}uf IN (${ufs})`;
  }
  return null;
}

/**
 * Construtor de filtro de Rede/Matriz.
 */
export function buildRedeFilter(matriz?: string | null, tableAlias?: string): string | null {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  if (matriz && matriz !== 'all') {
    const redes = matriz.split(',').map(r => escapeSqlValue(r.trim())).join(',');
    return `${prefix}rede IN (${redes})`;
  }
  return null;
}
