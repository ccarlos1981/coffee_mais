/**
 * Construtor SQL Centralizado e Validador de Queries — Analytics Engine V1
 * 
 * Responsável por montar e validar cláusulas WHERE para consultas analíticas.
 * Integra o mecanismo de Fail-Fast para impedir violações de schema.
 * 
 * @see Regra de Governança Financeira (Seção 10)
 */

import { AnalyticsFilters, buildDateFilter, buildManagerFilter, buildProductFilter, buildChannelFilter, buildUfFilter, buildRedeFilter } from './filters';
import { OfficialSourceTable, validateColumnSupport } from './sources';

export interface BuildWhereOptions {
  tableAlias?: string;
  ignoreProductFilter?: boolean;
}

/**
 * Constrói a cláusula WHERE completa e valida a compatibilidade de colunas com a fonte oficial (Fail-Fast).
 * 
 * @param filters Filtros normalizados da consulta
 * @param targetTable Nome da fonte oficial do Registry
 * @param options Opções adicionais de montagem (alias, supressão)
 */
export function buildWhereClause(
  filters: AnalyticsFilters,
  targetTable: OfficialSourceTable,
  options: BuildWhereOptions = {}
): string {
  const tableAlias = options.tableAlias;
  const requestedColumns: string[] = [];

  // Mapear colunas exigidas pelos filtros ativos
  if (filters.startMonth || filters.endMonth) requestedColumns.push('mes');
  if (filters.manager_id || filters.manager) {
    requestedColumns.push('manager_id');
    requestedColumns.push('manager');
  }
  if (filters.familia) requestedColumns.push('tipo_produto');
  if (filters.uf) requestedColumns.push('uf');
  if (filters.channel) requestedColumns.push('channel');
  if (filters.matriz) requestedColumns.push('rede');
  
  if (filters.product && !options.ignoreProductFilter) {
    requestedColumns.push('product');
  }

  // 1. Executar validação Fail-Fast do schema
  validateColumnSupport(targetTable, requestedColumns);

  // 2. Construir cláusulas SQL
  const clauses: string[] = ['1=1'];

  // Intervalo de datas/meses
  const dateClauses = buildDateFilter(filters.startMonth, filters.endMonth, tableAlias, targetTable);
  clauses.push(...dateClauses);

  // Gerente (Manager ID / Manager Name / CommercialRole)
  const managerClause = buildManagerFilter(filters.manager_id, filters.manager, tableAlias, targetTable);
  if (managerClause) clauses.push(managerClause);

  // Produto e Família
  const productClauses = buildProductFilter(
    options.ignoreProductFilter ? null : filters.product,
    filters.familia,
    tableAlias
  );
  clauses.push(...productClauses);

  // Canal
  const channelClause = buildChannelFilter(filters.channel, tableAlias);
  if (channelClause) clauses.push(channelClause);

  // UF
  const ufClause = buildUfFilter(filters.uf, tableAlias);
  if (ufClause) clauses.push(ufClause);

  // Rede/Matriz
  const redeClause = buildRedeFilter(filters.matriz, tableAlias);
  if (redeClause) clauses.push(redeClause);

  return 'WHERE ' + clauses.join(' AND ');
}
