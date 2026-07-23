/**
 * Registry Oficial de Fontes Analíticas — Coffee++
 * 
 * Este arquivo é a ÚNICA fonte de verdade autorizada para os nomes e schemas
 * das views e tabelas analíticas oficiais do ecossistema Coffee++.
 * 
 * @see Regra de Governança Financeira (Seção 10 e Blindagem Analytics Engine V1)
 */

export const OFFICIAL_ANALYTICS_SOURCES = {
  VENDAS_MENSAL: 'public.mv_vendas_mensal',
  VENDAS_CLIENTE_MENSAL: 'public.mv_vendas_cliente_mensal',
  POSITIVACAO_SKU_MENSAL: 'public.mv_positivacao_sku_mensal',
  SALES_REALTIME: 'public.sales',
  BASE_ATENDIMENTO: 'base_atendimento.faturamento_mensal',
} as const;

export type OfficialSourceKey = keyof typeof OFFICIAL_ANALYTICS_SOURCES;
export type OfficialSourceTable = typeof OFFICIAL_ANALYTICS_SOURCES[OfficialSourceKey];

/**
 * Esquema oficial de colunas por fonte analítica.
 * Utilizado pelo mecanismo Fail-Fast para impedir consultas a colunas inexistentes.
 */
export const OFFICIAL_SOURCE_SCHEMAS: Record<OfficialSourceTable, string[]> = {
  [OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL]: [
    'mes', 'ano', 'manager', 'manager_id', 'rede', 'tipo_produto', 'uf', 'channel',
    'fat', 'qty', 'maco', 'valor_venda_futura', 'total_imposto', 'total_custo', 'total_frete', 'num_vendas'
  ],
  [OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL]: [
    'mes', 'ano', 'manager', 'manager_id', 'rede', 'nome_parceiro', 'tipo_produto', 'uf', 'channel',
    'fat', 'qty', 'maco', 'valor_venda_futura'
  ],
  [OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL]: [
    'mes', 'ano', 'manager', 'manager_id', 'rede', 'nome_parceiro', 'product', 'tipo_produto', 'uf', 'channel',
    'fat', 'qty', 'maco'
  ],
  [OFFICIAL_ANALYTICS_SOURCES.SALES_REALTIME]: [
    'dt_faturamento', 'manager_id', 'manager', 'channel', 'uf', 'rede', 'product', 'fat', 'qty'
  ],
  [OFFICIAL_ANALYTICS_SOURCES.BASE_ATENDIMENTO]: [
    'cod_parceiro', 'nome_parceiro', 'fat', 'qty'
  ],
};

export interface ResolveSourceOptions {
  hasProductFilter?: boolean;
  hasClientOutput?: boolean;
  isRealtimeDaily?: boolean;
  isAtendimento?: boolean;
}

/**
 * Comutador automático centralizado para seleção da fonte oficial.
 */
export function resolveOfficialSource(options: ResolveSourceOptions = {}): OfficialSourceTable {
  if (options.isAtendimento) {
    return OFFICIAL_ANALYTICS_SOURCES.BASE_ATENDIMENTO;
  }
  if (options.isRealtimeDaily) {
    return OFFICIAL_ANALYTICS_SOURCES.SALES_REALTIME;
  }
  if (options.hasProductFilter) {
    return OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
  }
  if (options.hasClientOutput) {
    return OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL;
  }
  return OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL;
}

/**
 * Validador Fail-Fast: Verifica se todas as colunas solicitadas existem na fonte informada.
 * Lança um erro explícito detalhando a anomalia e sugerindo a fonte correta.
 */
export function validateColumnSupport(targetTable: OfficialSourceTable, requestedColumns: string[]): void {
  const supportedCols = OFFICIAL_SOURCE_SCHEMAS[targetTable];
  if (!supportedCols) {
    throw new Error(
      `[AnalyticsEngine Fail-Fast] Fonte não homologada: '${targetTable}'. Utilize exclusivamente as fontes cadastradas no Registry Oficial.`
    );
  }

  for (const col of requestedColumns) {
    if (!supportedCols.includes(col)) {
      let suggestion = '';
      if (col === 'product') {
        suggestion = `Sugestão: Alterne para a fonte oficial '${OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL}' que contém a coluna de produtos (SKU).`;
      } else if (col === 'nome_parceiro') {
        suggestion = `Sugestão: Alterne para a fonte oficial '${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL}' ou '${OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL}'.`;
      }

      throw new Error(
        `[AnalyticsEngine Fail-Fast] Incompatibilidade de Schema: A coluna '${col}' não existe na fonte oficial '${targetTable}'. ${suggestion}`
      );
    }
  }
}
