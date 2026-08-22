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
  dimension?: string | null;
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

  const isAll = (val: string | null) => !val || ['all', 'todos', 'todas'].includes(val.trim().toLowerCase());

  const manager_id = !isAll(searchParams.get('manager_id')) ? searchParams.get('manager_id') : null;
  const manager = !isAll(searchParams.get('manager')) ? searchParams.get('manager') : null;
  const familia = !isAll(searchParams.get('familia')) ? searchParams.get('familia') : null;
  const uf = !isAll(searchParams.get('uf')) ? searchParams.get('uf') : null;
  const channel = !isAll(searchParams.get('channel')) ? searchParams.get('channel') : null;
  const matriz = !isAll(searchParams.get('matriz')) ? searchParams.get('matriz') : (!isAll(searchParams.get('rede')) ? searchParams.get('rede') : null);
  const product = !isAll(searchParams.get('product')) ? searchParams.get('product') : null;
  const dimension = searchParams.get('dimension') || searchParams.get('selectedDimension');

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
    dimension,
  };
}

import { OFFICIAL_ANALYTICS_SOURCES } from './sources';

/**
 * Construtor de cláusula SQL de intervalo de datas/meses.
 */
export function buildDateFilter(startMonth?: string | null, endMonth?: string | null, tableAlias?: string, targetTable?: string): string[] {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const clauses: string[] = [];

  if (targetTable === OFFICIAL_ANALYTICS_SOURCES.SALES_REALTIME) {
    if (startMonth) {
      const formatted = startMonth.includes('-') ? startMonth.replace('-', '_') : startMonth;
      clauses.push(`${prefix}ano_mes >= ${escapeSqlValue(formatted)}`);
    }
    if (endMonth) {
      const formatted = endMonth.includes('-') ? endMonth.replace('-', '_') : endMonth;
      clauses.push(`${prefix}ano_mes <= ${escapeSqlValue(formatted)}`);
    }
  } else {
    const monthCol = `${prefix}mes`;
    if (startMonth) {
      clauses.push(`${monthCol} >= ${escapeSqlValue(startMonth)}`);
    }
    if (endMonth) {
      clauses.push(`${monthCol} <= ${escapeSqlValue(endMonth)}`);
    }
  }
  return clauses;
}

import { buildCommercialRoleSqlFilter } from '@/lib/domain/commercial-structure';

/**
 * Construtor de filtro de Gerente padronizado.
 * `manager_id` ou chave composta de CommercialRole (ex: "1002-KA", "1002-DIST") é a referência de busca.
 */
export function buildManagerFilter(manager_id?: string | null, manager?: string | null, tableAlias?: string, targetTable?: string): string | null {
  const targetFilter = manager_id && manager_id !== 'all' ? manager_id : (manager && manager !== 'all' ? manager : null);
  if (!targetFilter) return null;

  return buildCommercialRoleSqlFilter(targetFilter, tableAlias, targetTable);
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
    const channelsArray = channel.split(',').map(c => c.trim());
    const channelsSql = channelsArray.map(c => escapeSqlValue(c)).join(',');
    if (tableAlias === 'c') {
      const isKaSelected = channelsArray.some(c => c.toUpperCase() === 'KA' || c.toUpperCase().includes('KEY ACCOUNT'));
      if (isKaSelected) {
        return `(${prefix}tipo_parceiro IN (${channelsSql}) OR ${prefix}tipo_parceiro ILIKE '%KA%' OR ${prefix}ka = 'Sim' OR ${prefix}ka = 'S')`;
      }
      return `${prefix}tipo_parceiro IN (${channelsSql})`;
    }
    return `${prefix}channel IN (${channelsSql})`;
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
    if (tableAlias === 'c') {
      return `${prefix}matriz IN (${redes})`;
    }
    return `${prefix}rede IN (${redes})`;
  }
  return null;
}
