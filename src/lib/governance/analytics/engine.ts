/**
 * Analytics Engine V1 — Motor de Alto Nível de Consultas Analíticas
 * 
 * Camada definitiva e obrigatória para execução de relatórios e dados comerciais.
 * Nenhuma rota de API deverá construir SQL diretamente; todas utilizarão a AnalyticsEngine.
 * 
 * @see Regra de Governança Financeira (Seção 10 e Blindagem Analytics Engine V1)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { OFFICIAL_ANALYTICS_SOURCES, resolveOfficialSource } from './sources';
import { AnalyticsFilters, escapeSqlValue } from './filters';
import { buildWhereClause } from './query-builder';
import { buildMacoSqlExpression } from './metrics';

function getSupabaseClient() {
  return createAdminClient();
}

export class AnalyticsEngine {
  /**
   * Executa uma query SQL via RPC segura `execute_readonly_query`.
   */
  public static async executeSql<T = any>(sql: string): Promise<T[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });
    if (error) {
      console.error(`[AnalyticsEngine Error] Query failed:\n${sql}\nError:`, error);
      throw new Error(`[AnalyticsEngine Error] ${error.message}`);
    }
    return (data || []) as T[];
  }

  /**
   * 1. Dashboard Vendas — Resumo Consolidado com PM/PY
   */
  static async getVendasSummary(filters: AnalyticsFilters) {
    const curStartMonth = filters.startMonth || (filters.startDate ? filters.startDate.substring(0, 7) : null);
    const curEndMonth = filters.endMonth || (filters.endDate ? filters.endDate.substring(0, 7) : null);

    if (!curStartMonth || !curEndMonth) {
      throw new Error("[AnalyticsEngine] Parâmetros de data 'startDate'/'endDate' ou 'startMonth'/'endMonth' são obrigatórios.");
    }

    const [sYear, sMonth] = curStartMonth.split('-').map(Number);
    const [eYear, eMonth] = curEndMonth.split('-').map(Number);

    const pmStartMonth = `${sMonth === 1 ? sYear - 1 : sYear}-${String(sMonth === 1 ? 12 : sMonth - 1).padStart(2, '0')}`;
    const pmEndMonth = `${eMonth === 1 ? eYear - 1 : eYear}-${String(eMonth === 1 ? 12 : eMonth - 1).padStart(2, '0')}`;
    const pyStartMonth = `${sYear - 1}-${String(sMonth).padStart(2, '0')}`;
    const pyEndMonth = `${eYear - 1}-${String(eMonth).padStart(2, '0')}`;

    const curFilters = { ...filters, startMonth: curStartMonth, endMonth: curEndMonth };
    const pmFilters = { ...filters, startMonth: pmStartMonth, endMonth: pmEndMonth };
    const pyFilters = { ...filters, startMonth: pyStartMonth, endMonth: pyEndMonth };

    const whereCur = buildWhereClause(curFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL);
    const whereCurClient = buildWhereClause(curFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL);
    const wherePm = buildWhereClause(pmFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL);
    const wherePmClient = buildWhereClause(pmFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL);
    const wherePy = buildWhereClause(pyFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL);
    const wherePyClient = buildWhereClause(pyFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL);

    const sqlCur = `SELECT * FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL} ${whereCur}`;
    const sqlCurClient = `
      SELECT mes, COALESCE(manager, 'Outros') as manager, COALESCE(manager_id, '9999') as manager_id,
             COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
             SUM(fat) as fat, SUM(qty) as qty, SUM(maco) as maco, SUM(valor_venda_futura) as valor_venda_futura
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL} ${whereCurClient}
      GROUP BY mes, COALESCE(manager, 'Outros'), COALESCE(manager_id, '9999'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    const sqlPm = `SELECT mes, manager, manager_id, fat, qty, maco FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL} ${wherePm}`;
    const sqlPmClient = `
      SELECT mes, COALESCE(manager, 'Outros') as manager, COALESCE(manager_id, '9999') as manager_id,
             COALESCE(rede, nome_parceiro, 'Não Mapeado') as client, SUM(fat) as fat, SUM(qty) as qty, SUM(maco) as maco
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL} ${wherePmClient}
      GROUP BY mes, COALESCE(manager, 'Outros'), COALESCE(manager_id, '9999'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    const sqlPy = `SELECT mes, manager, manager_id, fat, qty, maco FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL} ${wherePy}`;
    const sqlPyClient = `
      SELECT mes, COALESCE(manager, 'Outros') as manager, COALESCE(manager_id, '9999') as manager_id,
             COALESCE(rede, nome_parceiro, 'Não Mapeado') as client, SUM(fat) as fat, SUM(qty) as qty, SUM(maco) as maco
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL} ${wherePyClient}
      GROUP BY mes, COALESCE(manager, 'Outros'), COALESCE(manager_id, '9999'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    const [rowsCur, rowsCurClient, rowsPm, rowsPmClient, rowsPy, rowsPyClient, paceResult] = await Promise.all([
      this.executeSql(sqlCur),
      this.executeSql(sqlCurClient),
      this.executeSql(sqlPm),
      this.executeSql(sqlPmClient),
      this.executeSql(sqlPy),
      this.executeSql(sqlPyClient),
      this.calculatePace(filters),
    ]);

    return {
      rowsCur, rowsCurClient, rowsPm, rowsPmClient, rowsPy, rowsPyClient,
      paceResult,
      investmentPct: filters.investmentPct || 0,
    };
  }

  /**
   * Função ÚNICA e CENTRALIZADA para cálculo do indicador PACE.
   * Regras Oficiais Homologadas:
   * - Mês anterior ao atual: PACE = REAL (remanescente = 0).
   * - Mês posterior ao atual (mês futuro): REAL = 0, PACE = faturamento total realizado no mês imediatamente anterior (Forecast/Baseline).
   * - Mês atual: PACE = REAL acumulado (faturamento de 01 até a Data de Referência Oficial) + Remanescente do mês anterior (cutOffDay + 1 até o último dia do mês anterior). Em nenhuma hipótese o PACE utilizará o faturamento total do mês corrente.
   * - Data de Referência Oficial (refDay): Data de fechamento/processamento da base da AnalyticsEngine.
   * - Proibição de Recálculo do REAL: O REAL é consumido diretamente do acumulado da linha (mv_vendas_mensal / mv_vendas_cliente_mensal), sem execução de segunda consulta.
   * - Fórmulas exatas de agregação por segmento:
   *   paceFat = realFat + remanescenteFat
   *   paceQty = realQty + remanescenteQty
   *   paceMaco = realMaco + remanescenteMaco (proibido usar margem média ou percentual).
   */
  static async calculatePace(filters: AnalyticsFilters) {
    const curStartMonth = filters.startMonth || (filters.startDate ? filters.startDate.substring(0, 7) : null);
    if (!curStartMonth) {
      return {
        rowsPmRemainderManager: [],
        rowsPmRemainderClient: [],
        rowsPmRemainderFamilia: [],
        refDay: 0,
        cutOffDay: 0,
        isPastMonth: false,
        isFutureMonth: false,
      };
    }

    const [sYear, sMonth] = curStartMonth.split('-').map(Number);
    const now = new Date();
    const currentRealYear = now.getFullYear();
    const currentRealMonth = now.getMonth() + 1;

    const pmStartMonth = `${sMonth === 1 ? sYear - 1 : sYear}-${String(sMonth === 1 ? 12 : sMonth - 1).padStart(2, '0')}`;
    const [pmYear, pmMonth] = pmStartMonth.split('-').map(Number);
    const lastDayOfPm = new Date(pmYear, pmMonth, 0).getDate();

    const isPastMonth = sYear < currentRealYear || (sYear === currentRealYear && sMonth < currentRealMonth);
    const isFutureMonth = sYear > currentRealYear || (sYear === currentRealYear && sMonth > currentRealMonth);

    if (isPastMonth) {
      return {
        rowsPmRemainderManager: [],
        rowsPmRemainderClient: [],
        rowsPmRemainderFamilia: [],
        refDay: lastDayOfPm,
        cutOffDay: lastDayOfPm,
        isPastMonth: true,
        isFutureMonth: false,
      };
    }

    // Determinar a DATA DE REFERÊNCIA OFICIAL da AnalyticsEngine (processamento/fechamento da base).
    // Proibido depender diretamente de MAX(dia) em public.sales para evitar instabilidade por cargas parciais.
    let refDay = 0;
    if (isFutureMonth) {
      refDay = 0;
    } else {
      if (filters.referenceDate) {
        const refDateObj = new Date(filters.referenceDate);
        if (!isNaN(refDateObj.getTime())) {
          refDay = refDateObj.getDate();
        }
      }

      if (!refDay) {
        const sqlOfficialRef = `
          SELECT MAX(finished_at) as last_refresh 
          FROM public.cm_mv_refresh_jobs 
          WHERE status = 'SUCCESS'
        `;
        try {
          const resRef = await this.executeSql<{ last_refresh: string }>(sqlOfficialRef);
          if (resRef[0]?.last_refresh) {
            const refreshDate = new Date(resRef[0].last_refresh);
            if (refreshDate.getFullYear() === sYear && (refreshDate.getMonth() + 1) === sMonth) {
              refDay = refreshDate.getDate();
            }
          }
        } catch {
          // ignora fallback
        }
      }

      if (!refDay) {
        refDay = now.getDate();
      }
    }

    const cutOffDay = isFutureMonth ? 0 : Math.min(refDay, lastDayOfPm);

    if (!isFutureMonth && cutOffDay >= lastDayOfPm) {
      return {
        rowsPmRemainderManager: [],
        rowsPmRemainderClient: [],
        rowsPmRemainderFamilia: [],
        refDay,
        cutOffDay,
        isPastMonth: false,
        isFutureMonth: false,
      };
    }

    const dayStartPrev = cutOffDay + 1;
    const dayEndPrev = lastDayOfPm;

    const pmRemainderFilters = { ...filters, startMonth: pmStartMonth, endMonth: pmStartMonth };
    const wherePmRemainderBase = buildWhereClause(pmRemainderFilters, OFFICIAL_ANALYTICS_SOURCES.SALES_REALTIME);

    const investmentPct = filters.investmentPct || 0;
    const macoSql = investmentPct > 0
      ? `SUM(COALESCE(maco, 0) - (COALESCE(net_value, 0) * ${investmentPct}))`
      : `SUM(COALESCE(maco, 0))`;

    const sqlPmRemainderManager = `
      SELECT COALESCE(manager_id, '9999') as manager_id, COALESCE(manager, 'Outros') as manager,
             SUM(COALESCE(net_value, 0)) as pace_fat, SUM(COALESCE(quantity, 0)) as pace_qty, ${macoSql} as pace_maco
      FROM ${OFFICIAL_ANALYTICS_SOURCES.SALES_REALTIME} ${wherePmRemainderBase} AND dia >= ${dayStartPrev} AND dia <= ${dayEndPrev}
      GROUP BY COALESCE(manager_id, '9999'), COALESCE(manager, 'Outros')
    `;

    const sqlPmRemainderClient = `
      SELECT COALESCE(manager_id, '9999') as manager_id, COALESCE(manager, 'Outros') as manager,
             COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
             SUM(COALESCE(net_value, 0)) as pace_fat, SUM(COALESCE(quantity, 0)) as pace_qty, ${macoSql} as pace_maco
      FROM ${OFFICIAL_ANALYTICS_SOURCES.SALES_REALTIME} ${wherePmRemainderBase} AND dia >= ${dayStartPrev} AND dia <= ${dayEndPrev}
      GROUP BY COALESCE(manager_id, '9999'), COALESCE(manager, 'Outros'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    const sqlPmRemainderFamilia = `
      SELECT COALESCE(tipo_produto, 'Outros') as familia,
             SUM(COALESCE(net_value, 0)) as pace_fat, SUM(COALESCE(quantity, 0)) as pace_qty, ${macoSql} as pace_maco
      FROM ${OFFICIAL_ANALYTICS_SOURCES.SALES_REALTIME} ${wherePmRemainderBase} AND dia >= ${dayStartPrev} AND dia <= ${dayEndPrev}
      GROUP BY COALESCE(tipo_produto, 'Outros')
    `;

    const [rowsPmRemainderManager, rowsPmRemainderClient, rowsPmRemainderFamilia] = await Promise.all([
      this.executeSql(sqlPmRemainderManager).catch(() => []),
      this.executeSql(sqlPmRemainderClient).catch(() => []),
      this.executeSql(sqlPmRemainderFamilia).catch(() => []),
    ]);

    return {
      rowsPmRemainderManager,
      rowsPmRemainderClient,
      rowsPmRemainderFamilia,
      refDay,
      cutOffDay,
      isPastMonth,
      isFutureMonth,
    };
  }

  /**
   * 2. Dashboard Rede — Totais e Desmembramentos por Matriz
   */
  static async getMatrizData(filters: AnalyticsFilters, enableHistory: boolean = false) {
    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const mainSource = resolveOfficialSource({ hasProductFilter });
    const investmentPct = filters.investmentPct || 0;
    const macoExpr = buildMacoSqlExpression(investmentPct);

    let historyStartMonth = filters.startMonth;
    if (enableHistory && filters.endMonth) {
      const dateObj = new Date(`${filters.endMonth}-01`);
      dateObj.setMonth(dateObj.getMonth() - 11);
      historyStartMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    }

    const whereClause = buildWhereClause(filters, mainSource);
    const historyFilters = { ...filters, startMonth: historyStartMonth };
    const historyWhereClause = buildWhereClause(historyFilters, mainSource);

    const sqlTotals = `
      SELECT SUM(fat) as fat, SUM(qty) as qty, ${macoExpr} as maco
      FROM ${mainSource} ${whereClause}
    `;

    const sqlByMatriz = `
      SELECT COALESCE(rede, 'Não Mapeado') as matriz, SUM(fat) as fat, SUM(qty) as qty, ${macoExpr} as maco
      FROM ${mainSource} ${whereClause}
      GROUP BY COALESCE(rede, 'Não Mapeado')
    `;

    const sqlByManager = `
      SELECT COALESCE(manager, 'Outros') as name, SUM(fat) as fat
      FROM ${mainSource} ${whereClause}
      GROUP BY COALESCE(manager, 'Outros')
    `;

    const sqlByFamilia = `
      SELECT COALESCE(tipo_produto, 'Outros') as familia, SUM(fat) as fat
      FROM ${mainSource} ${whereClause}
      GROUP BY COALESCE(tipo_produto, 'Outros')
    `;

    const sqlByMonth = `
      SELECT mes as month, SUM(fat) as fat, SUM(qty) as qty, ${macoExpr} as maco
      FROM ${mainSource} ${historyWhereClause}
      GROUP BY mes ORDER BY mes
    `;

    const productSource = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
    const productWhereClause = buildWhereClause(filters, productSource);
    const sqlByProduct = `
      SELECT product, SUM(fat) as fat, SUM(qty) as qty
      FROM ${productSource} ${productWhereClause}
      GROUP BY product ORDER BY fat DESC LIMIT 15
    `;

    const [resTotals, resByMatriz, resByManager, resByFamilia, resByMonth, resProduct] = await Promise.all([
      this.executeSql(sqlTotals),
      this.executeSql(sqlByMatriz),
      this.executeSql(sqlByManager),
      this.executeSql(sqlByFamilia),
      this.executeSql(sqlByMonth),
      this.executeSql(sqlByProduct).catch(() => []),
    ]);

    return {
      totals: resTotals[0] || { fat: 0, qty: 0, maco: 0 },
      byMatriz: resByMatriz,
      byManager: resByManager,
      byFamilia: resByFamilia,
      byMonth: resByMonth,
      topProducts: resProduct,
    };
  }

  /**
   * 3. Dashboard Histórico — Agregação Mensal
   */
  static async getHistoryData(filters: AnalyticsFilters) {
    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const targetSource = resolveOfficialSource({ hasProductFilter });
    const investmentPct = filters.investmentPct || 0;
    const whereClause = buildWhereClause(filters, targetSource);

    const sql = `
      SELECT mes, ano, tipo_produto, rede, manager,
             SUM(fat) as fat, SUM(qty) as qty,
             ${buildMacoSqlExpression(investmentPct)} as maco
      FROM ${targetSource} ${whereClause}
      GROUP BY mes, ano, tipo_produto, rede, manager
      ORDER BY mes
    `;

    return this.executeSql(sql);
  }

  /**
   * 4. Dashboard Histórico Rede — Comparativo 2025 vs 2026
   */
  static async getHistoryMatrizData(filters: AnalyticsFilters) {
    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const targetSource = resolveOfficialSource({ hasProductFilter });
    
    const yearFilters = { ...filters, startMonth: '2025-01', endMonth: '2026-12' };
    const whereClause = buildWhereClause(yearFilters, targetSource);

    const sql = `
      SELECT ano, mes_num,
             SUM(fat) as fat, SUM(qty) as qty
      FROM ${targetSource} ${whereClause}
      GROUP BY ano, mes_num
    `;

    return this.executeSql(sql);
  }

  /**
   * 5. Dashboard Histórico por Rede — Comparativo por Matriz
   */
  static async getHistoryMatrizComparisonData(filters: AnalyticsFilters, startMonthStr: string = '01', endMonthStr: string = '12') {
    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const hasMatrizFilter = Boolean(filters.matriz && filters.matriz !== 'all');
    const targetSource = resolveOfficialSource({ hasProductFilter });

    if (hasMatrizFilter) {
      const yearFilters = { ...filters, startMonth: `2025-${startMonthStr}`, endMonth: `2026-${endMonthStr}` };
      const whereClause = buildWhereClause(yearFilters, targetSource);

      const sql = `
        SELECT ano, mes_num,
               SUM(fat) as fat, SUM(qty) as qty
        FROM ${targetSource} ${whereClause}
        GROUP BY ano, mes_num
      `;
      return { mode: 'monthly' as const, rows: await this.executeSql(sql) };
    } else {
      const yearFilters = { ...filters, startMonth: `2025-${startMonthStr}`, endMonth: `2026-${endMonthStr}` };
      const whereClause = buildWhereClause(yearFilters, targetSource, { ignoreProductFilter: false });

      const sql = `
        SELECT rede as matriz, ano,
               SUM(fat) as fat, SUM(qty) as qty
        FROM ${targetSource} ${whereClause}
        GROUP BY rede, ano
      `;
      return { mode: 'top10' as const, rows: await this.executeSql(sql) };
    }
  }

  /**
   * 6. Dashboard Positivação
   */
  static async getPositivacaoData(filters: AnalyticsFilters) {
    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const clientSource = resolveOfficialSource({ hasProductFilter, hasClientOutput: true });
    const whereClause = buildWhereClause(filters, clientSource);

    const sqlTotals = `
      SELECT COUNT(DISTINCT nome_parceiro) as clientes, COUNT(DISTINCT rede) as matrizes,
             SUM(fat) as fat, COUNT(DISTINCT mes) as meses
      FROM ${clientSource} ${whereClause}
    `;

    const sqlByMonth = `
      SELECT mes as month, COUNT(DISTINCT nome_parceiro) as clientes, COUNT(DISTINCT rede) as matrizes,
             SUM(fat) as fat, SUM(qty) as qty
      FROM ${clientSource} ${whereClause}
      GROUP BY mes ORDER BY mes
    `;

    const sqlByManager = `
      SELECT COALESCE(manager, 'Outros') as manager, COUNT(DISTINCT nome_parceiro) as clientes,
             COUNT(DISTINCT rede) as matrizes, SUM(fat) as fat
      FROM ${clientSource} ${whereClause}
      GROUP BY COALESCE(manager, 'Outros')
    `;

    const sqlManagerMonthly = `
      SELECT COALESCE(manager, 'Outros') as manager, mes as month, COUNT(DISTINCT nome_parceiro) as clientes
      FROM ${clientSource} ${whereClause}
      GROUP BY COALESCE(manager, 'Outros'), mes
    `;

    const skuSource = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
    const skuWhereClause = buildWhereClause(filters, skuSource);

    const sqlTopSkus = `
      SELECT product as sku, SUM(qty) as total_qty
      FROM ${skuSource} ${skuWhereClause}
      GROUP BY product ORDER BY total_qty DESC LIMIT 10
    `;

    const sqlBatalhaMonthly = `
      SELECT product as sku, mes as month, COUNT(DISTINCT nome_parceiro) as clientes
      FROM ${skuSource} ${skuWhereClause}
      GROUP BY product, mes
    `;

    const [resTotals, resByMonth, resByManager, resManagerMonthly, resTopSkus, resBatalhaMonthly] = await Promise.all([
      this.executeSql(sqlTotals),
      this.executeSql(sqlByMonth),
      this.executeSql(sqlByManager),
      this.executeSql(sqlManagerMonthly),
      this.executeSql(sqlTopSkus),
      this.executeSql(sqlBatalhaMonthly),
    ]);

    return {
      totals: resTotals[0] || { clientes: 0, matrizes: 0, fat: 0, meses: 0 },
      byMonth: resByMonth,
      byManager: resByManager,
      managerMonthly: resManagerMonthly,
      topSkus: resTopSkus,
      batalhaMonthly: resBatalhaMonthly,
    };
  }

  /**
   * 6.1 Detalhamento de Positivação
   */
  static async getPositivacaoDetailData(filters: AnalyticsFilters, selectedManager: string, type: string, limit: number, offset: number, page: number = 1) {
    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const clientTable = resolveOfficialSource({ hasProductFilter, hasClientOutput: true });
    
    const baseWhere = buildWhereClause(filters, clientTable);
    const managerCond = selectedManager === 'Outros' 
      ? "COALESCE(manager, 'Outros') = 'Outros'" 
      : `manager = ${escapeSqlValue(selectedManager)}`;
    
    const whereClause = `${baseWhere} AND ${managerCond}`;
    const targetColumn = type === 'matriz' ? 'rede' : 'nome_parceiro';

    const sqlCount = `
      SELECT COUNT(DISTINCT ${targetColumn}) as total
      FROM ${clientTable}
      ${whereClause}
    `;

    const countRes = await this.executeSql(sqlCount);
    const totalRecords = Number(countRes[0]?.total || 0);

    let sqlData = '';
    if (type === 'client') {
      sqlData = `
        SELECT nome_parceiro as name, MAX(rede) as matriz, MAX(uf) as uf, SUM(fat) as total_fat
        FROM ${clientTable}
        ${whereClause}
        GROUP BY nome_parceiro ORDER BY total_fat DESC LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      sqlData = `
        SELECT rede as name, SUM(fat) as total_fat
        FROM ${clientTable}
        ${whereClause}
        GROUP BY rede ORDER BY total_fat DESC LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const rows = await this.executeSql(sqlData);
    let rowsWithDetail: any[] = [];

    if (type === 'client' && rows && rows.length > 0) {
      const clientNames = rows.map((r: any) => escapeSqlValue(r.name)).join(',');
      const sqlDetail = `
        SELECT DISTINCT nome_parceiro, mes, product
        FROM ${OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL}
        ${baseWhere} AND ${managerCond} AND nome_parceiro IN (${clientNames})
      `;

      const detailRows = await this.executeSql(sqlDetail);
      const clientMonthsMap = new Map<string, Set<string>>();
      const clientSkusMap = new Map<string, Set<string>>();

      for (const d of (detailRows || [])) {
        const clientName = d.nome_parceiro;
        if (!clientMonthsMap.has(clientName)) clientMonthsMap.set(clientName, new Set());
        if (!clientSkusMap.has(clientName)) clientSkusMap.set(clientName, new Set());

        if (d.mes) clientMonthsMap.get(clientName)!.add(d.mes);
        if (d.product) clientSkusMap.get(clientName)!.add(d.product);
      }

      rowsWithDetail = rows.map((r: any) => ({
        name: r.name,
        matriz: r.matriz || 'Não Mapeado',
        uf: r.uf || '-',
        total_fat: Number(r.total_fat || 0),
        monthsCount: clientMonthsMap.get(r.name)?.size || 0,
        skusCount: clientSkusMap.get(r.name)?.size || 0,
      }));
    } else if (type === 'matriz' && rows && rows.length > 0) {
      const matrizNames = rows.map((r: any) => escapeSqlValue(r.name)).join(',');
      const sqlMatrizDetail = `
        SELECT rede, COUNT(DISTINCT nome_parceiro) as clients_count, COUNT(DISTINCT product) as skus_count
        FROM ${OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL}
        ${baseWhere} AND ${managerCond} AND rede IN (${matrizNames})
        GROUP BY rede
      `;

      const matrizDetailRows = await this.executeSql(sqlMatrizDetail);
      const matrizDetailMap = new Map<string, { clientsCount: number; skusCount: number }>();
      for (const d of (matrizDetailRows || [])) {
        matrizDetailMap.set(d.rede, {
          clientsCount: Number(d.clients_count || 0),
          skusCount: Number(d.skus_count || 0),
        });
      }

      rowsWithDetail = rows.map((r: any) => {
        const d = matrizDetailMap.get(r.name) || { clientsCount: 0, skusCount: 0 };
        return {
          name: r.name,
          matriz: r.name,
          uf: '-',
          total_fat: Number(r.total_fat || 0),
          monthsCount: d.clientsCount,
          skusCount: d.skusCount,
        };
      });
    }

    return {
      data: rowsWithDetail,
      total: totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit),
    };
  }

  /**
   * 7. Dashboard SKU PDV
   */
  static async getSkuPdvData(filters: AnalyticsFilters) {
    const skuSource = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
    const whereClause = buildWhereClause(filters, skuSource);

    const sqlTotals = `
      SELECT COUNT(DISTINCT product) as total_skus, COUNT(DISTINCT nome_parceiro) as total_pdvs,
             COUNT(DISTINCT rede) as total_redes, SUM(fat) as fat, SUM(qty) as qty
      FROM ${skuSource} ${whereClause}
    `;

    const sqlBySku = `
      SELECT product as sku, COALESCE(tipo_produto, 'Outros') as familia,
             COUNT(DISTINCT nome_parceiro) as pdvs, COUNT(DISTINCT rede) as redes,
             SUM(fat) as fat, SUM(qty) as qty
      FROM ${skuSource} ${whereClause}
      GROUP BY product, COALESCE(tipo_produto, 'Outros') ORDER BY fat DESC
    `;

    const sqlByFamilia = `
      SELECT COALESCE(tipo_produto, 'Outros') as familia, COUNT(DISTINCT product) as skus,
             COUNT(DISTINCT nome_parceiro) as pdvs, SUM(fat) as fat, SUM(qty) as qty
      FROM ${skuSource} ${whereClause}
      GROUP BY COALESCE(tipo_produto, 'Outros') ORDER BY fat DESC
    `;

    const sqlByMonth = `
      SELECT mes as month, COUNT(DISTINCT product) as skus, COUNT(DISTINCT nome_parceiro) as pdvs,
             SUM(fat) as fat, SUM(qty) as qty
      FROM ${skuSource} ${whereClause}
      GROUP BY mes ORDER BY mes
    `;

    const [resTotals, resBySku, resByFamilia, resByMonth] = await Promise.all([
      this.executeSql(sqlTotals),
      this.executeSql(sqlBySku),
      this.executeSql(sqlByFamilia),
      this.executeSql(sqlByMonth),
    ]);

    return {
      totals: resTotals[0] || { total_skus: 0, total_pdvs: 0, total_redes: 0, fat: 0, qty: 0 },
      bySku: resBySku,
      byFamilia: resByFamilia,
      byMonth: resByMonth,
    };
  }

  /**
   * 7.1 Detalhamento de SKU PDV
   */
  static async getSkuPdvDetailData(filters: AnalyticsFilters, selectedManager: string, type: string, limit: number, offset: number, page: number = 1) {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
    
    const baseWhere = buildWhereClause(filters, targetSource);
    const companyWhere = buildWhereClause({ startMonth: filters.startMonth, endMonth: filters.endMonth, product: filters.product, familia: filters.familia }, targetSource);
    
    const managerCond = selectedManager === 'Outros' 
      ? "COALESCE(manager, 'Outros') = 'Outros'" 
      : `manager = ${escapeSqlValue(selectedManager)}`;
    
    const whereClause = `${baseWhere} AND ${managerCond}`;
    const targetColumn = type === 'matriz' ? 'rede' : 'nome_parceiro';

    const sqlPortfolio = `
      SELECT COUNT(DISTINCT product) as total_portfolio
      FROM ${targetSource}
      ${companyWhere}
    `;

    const sqlCount = `
      SELECT COUNT(DISTINCT ${targetColumn}) as total
      FROM ${targetSource}
      ${whereClause}
    `;

    const [resPortfolio, resCount] = await Promise.all([
      this.executeSql(sqlPortfolio),
      this.executeSql(sqlCount),
    ]);

    const totalPortfolio = Number(resPortfolio[0]?.total_portfolio || 0);
    const totalRecords = Number(resCount[0]?.total || 0);

    let sqlData = '';
    if (type === 'client') {
      sqlData = `
        WITH client_ranks AS (
          SELECT 
            nome_parceiro as name,
            MAX(rede) as matriz,
            MAX(uf) as uf,
            SUM(fat::numeric) as total_fat,
            COUNT(DISTINCT product) as skus_sold
          FROM ${targetSource}
          ${whereClause}
          GROUP BY nome_parceiro
        )
        SELECT name, matriz, uf, total_fat, skus_sold
        FROM client_ranks
        ORDER BY total_fat DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      sqlData = `
        WITH matriz_ranks AS (
          SELECT 
            rede as name,
            rede as matriz,
            '-' as uf,
            SUM(fat::numeric) as total_fat,
            COUNT(DISTINCT product) as skus_sold,
            COUNT(DISTINCT nome_parceiro) as pdv_count
          FROM ${targetSource}
          ${whereClause}
          GROUP BY rede
        )
        SELECT name, matriz, uf, total_fat, skus_sold, pdv_count
        FROM matriz_ranks
        ORDER BY total_fat DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const rows = await this.executeSql(sqlData);

    const rowsFormatted = (rows || []).map((r: any) => {
      const skusSold = Number(r.skus_sold || 0);
      const pctPenetration = totalPortfolio > 0 ? (skusSold / totalPortfolio) * 100 : 0;
      return {
        name: r.name,
        matriz: r.matriz || 'Não Mapeado',
        uf: r.uf || '-',
        total_fat: Number(r.total_fat || 0),
        skus_sold: skusSold,
        total_portfolio: totalPortfolio,
        pct_penetration: pctPenetration,
        pdv_count: r.pdv_count !== undefined ? Number(r.pdv_count) : undefined,
      };
    });

    return {
      data: rowsFormatted,
      total: totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit),
      totalPortfolio,
    };
  }

  /**
   * 8. Dashboard Preço por Matriz
   */
  static async getPrecoMatrizData(filters: AnalyticsFilters) {
    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const targetSource = resolveOfficialSource({ hasProductFilter });
    const whereClause = buildWhereClause(filters, targetSource);

    const sql = `
      SELECT mes as month,
             COALESCE(channel, 'Outros') as channel,
             COALESCE(rede, 'Não Mapeado') as matriz,
             COALESCE(tipo_produto, 'Outros') as family,
             SUM(fat) as fat, SUM(qty) as qty
      FROM ${targetSource} ${whereClause}
      GROUP BY mes, COALESCE(channel, 'Outros'), COALESCE(rede, 'Não Mapeado'), COALESCE(tipo_produto, 'Outros')
      ORDER BY mes, matriz
    `;

    return this.executeSql(sql);
  }

  /**
   * 9. Dashboard Meta CIA
   */
  static async getMetaCiaData(filters: AnalyticsFilters) {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL;
    const whereClause = buildWhereClause(filters, targetSource);

    const sql = `
      SELECT mes as month, SUM(fat) as fat, SUM(qty) as qty
      FROM ${targetSource} ${whereClause}
      GROUP BY mes ORDER BY mes
    `;

    return this.executeSql(sql);
  }

  /**
   * 10. Sparkline Data
   */
  static async getSparklineData(filters: AnalyticsFilters) {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL;
    const whereClause = buildWhereClause(filters, targetSource);

    const sql = `
      SELECT mes, SUM(fat) as fat
      FROM ${targetSource} ${whereClause}
      GROUP BY mes ORDER BY mes ASC
    `;

    return this.executeSql(sql);
  }

  /**
   * 11. Filtros Globais — Período Máximo e Opções de Filtro
   */
  static async getGlobalFilterData() {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL;
    
    const sqlMaxDate = `SELECT MAX(mes) as max_date FROM ${targetSource}`;
    const sqlManagers = `SELECT DISTINCT manager, manager_id FROM ${targetSource} WHERE manager IS NOT NULL ORDER BY manager`;
    const sqlFamilias = `SELECT DISTINCT tipo_produto as familia FROM ${targetSource} WHERE tipo_produto IS NOT NULL ORDER BY tipo_produto`;
    const sqlUfs = `SELECT DISTINCT uf FROM ${targetSource} WHERE uf IS NOT NULL ORDER BY uf`;
    const sqlChannels = `SELECT DISTINCT channel FROM ${targetSource} WHERE channel IS NOT NULL ORDER BY channel`;
    const sqlRedes = `SELECT DISTINCT rede FROM ${targetSource} WHERE rede IS NOT NULL ORDER BY rede`;

    const productSource = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
    const sqlProducts = `SELECT DISTINCT product FROM ${productSource} WHERE product IS NOT NULL ORDER BY product`;

    const [resMaxDate, resManagers, resFamilias, resUfs, resChannels, resRedes, resProducts] = await Promise.all([
      this.executeSql(sqlMaxDate),
      this.executeSql(sqlManagers),
      this.executeSql(sqlFamilias),
      this.executeSql(sqlUfs),
      this.executeSql(sqlChannels),
      this.executeSql(sqlRedes),
      this.executeSql(sqlProducts),
    ]);

    return {
      maxDate: resMaxDate[0]?.max_date || null,
      managers: resManagers.map(r => r.manager),
      familias: resFamilias.map(r => r.familia),
      ufs: resUfs.map(r => r.uf),
      channels: resChannels.map(r => r.channel),
      redes: resRedes.map(r => r.rede),
      products: resProducts.map(r => r.product),
    };
  }

  /**
   * 12. Farol de Cartas de Anuência — Média Mensal de Compras (Últimos 12 meses)
   * 
   * Filtra redes com média de faturamento mensal dos últimos 12 meses >= R$ 80.000,
   * utilizando a fonte homologada VENDAS_CLIENTE_MENSAL em estrito respeito à Governança Financeira.
   */
  static async getFarolAnuenciaRedes(filters?: { manager?: string; uf?: string; channel?: string; minMedia?: number }) {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL;
    const minMedia = filters?.minMedia !== undefined ? filters.minMedia : 80000;
    
    let whereConditions: string[] = ["rede IS NOT NULL AND rede != ''"];
    if (filters?.manager) {
      whereConditions.push(`manager = ${escapeSqlValue(filters.manager)}`);
    }
    if (filters?.uf) {
      whereConditions.push(`uf = ${escapeSqlValue(filters.uf)}`);
    }
    if (filters?.channel) {
      whereConditions.push(`channel = ${escapeSqlValue(filters.channel)}`);
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const sql = `
      WITH l12m AS (
        SELECT 
          COALESCE(rede, nome_parceiro) as rede,
          MAX(manager) as manager,
          MAX(uf) as uf,
          MAX(channel) as channel,
          SUM(fat) as total_fat_12m,
          COUNT(DISTINCT mes) as meses_com_venda,
          (SUM(fat) / 12.0) as media_mensal_12m
        FROM ${targetSource}
        ${whereClause}
        GROUP BY COALESCE(rede, nome_parceiro)
      )
      SELECT 
        rede,
        manager,
        uf,
        channel,
        total_fat_12m,
        meses_com_venda,
        ROUND(media_mensal_12m::numeric, 2) as media_mensal
      FROM l12m
      WHERE media_mensal_12m >= ${minMedia}
      ORDER BY media_mensal_12m DESC
    `;

    return this.executeSql<{
      rede: string;
      manager: string | null;
      uf: string | null;
      channel: string | null;
      total_fat_12m: number;
      meses_com_venda: number;
      media_mensal: number;
    }>(sql);
  }

  /**
   * 13. Mapeamento de Metadados de Redes (Gerente e UF)
   */
  static async getMapeamentoRedesMeta() {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL;
    const sql = `
      SELECT DISTINCT 
        COALESCE(rede, nome_parceiro) as rede, 
        manager, 
        uf 
      FROM ${targetSource} 
      WHERE rede IS NOT NULL AND rede != ''
    `;
    return this.executeSql<{ rede: string; manager: string | null; uf: string | null }>(sql);
  }

  /**
   * 14. Filtros Disponíveis de Gerentes e UFs
   */
  static async getFiltrosGerenteUf() {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL;
    const sql = `
      SELECT 
        ARRAY_AGG(DISTINCT manager) FILTER (WHERE manager IS NOT NULL AND manager != '') as gerentes,
        ARRAY_AGG(DISTINCT uf) FILTER (WHERE uf IS NOT NULL AND uf != '') as ufs
      FROM ${targetSource}
    `;
    const res = await this.executeSql<{ gerentes: string[]; ufs: string[] }>(sql);
    return {
      gerentes: (res[0]?.gerentes || []).sort(),
      ufs: (res[0]?.ufs || []).sort(),
    };
  }
}
