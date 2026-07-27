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
  VW_FATURAMENTO_COMERCIAL_OFICIAL: 'public.vw_faturamento_comercial_oficial',
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
    'dt_faturamento', 'invoice_date', 'ano', 'mes', 'dia', 'ano_mes', 'manager_id', 'manager', 'channel', 'uf', 'rede', 'nome_parceiro', 'product', 'tipo_produto', 'net_value', 'quantity', 'fat', 'qty', 'maco'
  ],
  [OFFICIAL_ANALYTICS_SOURCES.BASE_ATENDIMENTO]: [
    'cod_parceiro', 'nome_parceiro', 'fat', 'qty'
  ],
  [OFFICIAL_ANALYTICS_SOURCES.VW_FATURAMENTO_COMERCIAL_OFICIAL]: [
    'id', 'batch_id', 'cod_cfop', 'cfop_desc', 'dt_faturamento', 'nro_unico', 'nro_nota',
    'cod_parceiro', 'nome_parceiro', 'cod_produto', 'desc_produto', 'quantidade', 'vlr_unitario',
    'vlr_desconto', 'vlr_total_liq', 'cod_top', 'desc_top', 'custo_icms', 'cod_vendedor', 'nome_vendedor',
    'controle', 'custo_total', 'cod_natureza', 'desc_natureza', 'status_nfe', 'vlr_frete',
    'vlr_substituicao', 'vlr_total_st', 'cod_cr', 'centro_resultado', 'created_at', 'updated_at', 'chave_bq'
  ],
};

export interface ResolveSourceOptions {
  hasProductFilter?: boolean;
  hasClientOutput?: boolean;
  isRealtimeDaily?: boolean;
  isAtendimento?: boolean;
  isFaturamentoComercialOficial?: boolean;
}

/**
 * Comutador automático centralizado para seleção da fonte oficial.
 */
export function resolveOfficialSource(sourceOrOptions: OfficialSourceTable | ResolveSourceOptions = {}): OfficialSourceTable {
  if (typeof sourceOrOptions === 'string') {
    return sourceOrOptions;
  }
  const options = sourceOrOptions;
  if (options.isFaturamentoComercialOficial) {
    return OFFICIAL_ANALYTICS_SOURCES.VW_FATURAMENTO_COMERCIAL_OFICIAL;
  }
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

/**
 * Utilitário de Resolução de Nomes (Consumidores)
 * Converte o nome oficial (físico/SQL) para o formato esperado pelo supabase-js (sem prefixo public).
 * @param source Fonte oficial registrada (ex: 'public.mv_vendas_mensal')
 * @returns Identificador compatível com supabase-js (ex: 'mv_vendas_mensal')
 */
export function resolveSupabaseTableName(source: OfficialSourceTable | string): string {
  return source.replace(/^public\./, '');
}
