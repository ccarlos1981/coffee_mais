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
import { AnalyticsFilters, escapeSqlValue, buildManagerFilter, buildUfFilter, buildRedeFilter } from './filters';
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
   * 11.1 Módulo Analítico Histórico de Famílias (Hist Família)
   * Consome exclusivamente a fonte oficial POSITIVACAO_SKU_MENSAL.
   */
  static async getHistoricoFamiliaData(filters: AnalyticsFilters) {
    const curStartMonth = filters.startMonth || (filters.startDate ? filters.startDate.substring(0, 7) : null);
    const curEndMonth = filters.endMonth || (filters.endDate ? filters.endDate.substring(0, 7) : null);

    if (!curStartMonth || !curEndMonth) {
      throw new Error("[AnalyticsEngine] Parâmetros 'startMonth'/'endMonth' ou 'startDate'/'endDate' são obrigatórios.");
    }

    const [sYear, sMonth] = curStartMonth.split('-').map(Number);
    const [eYear, eMonth] = curEndMonth.split('-').map(Number);

    // Mês/Período anterior (MoM)
    const numMonths = (eYear - sYear) * 12 + (eMonth - sMonth) + 1;
    const momStartD = new Date(sYear, sMonth - 1 - numMonths, 1);
    const momEndD = new Date(eYear, eMonth - 1 - numMonths, 1);
    const momStartMonth = `${momStartD.getFullYear()}-${String(momStartD.getMonth() + 1).padStart(2, '0')}`;
    const momEndMonth = `${momEndD.getFullYear()}-${String(momEndD.getMonth() + 1).padStart(2, '0')}`;

    // Mesmo período ano anterior (YoY)
    const yoyStartMonth = `${sYear - 1}-${String(sMonth).padStart(2, '0')}`;
    const yoyEndMonth = `${eYear - 1}-${String(eMonth).padStart(2, '0')}`;

    const curFilters = { ...filters, startMonth: curStartMonth, endMonth: curEndMonth };
    const momFilters = { ...filters, startMonth: momStartMonth, endMonth: momEndMonth };
    const yoyFilters = { ...filters, startMonth: yoyStartMonth, endMonth: yoyEndMonth };

    const targetSource = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
    const whereCur = buildWhereClause(curFilters, targetSource);
    const whereMom = buildWhereClause(momFilters, targetSource);
    const whereYoy = buildWhereClause(yoyFilters, targetSource);

    // Query Totais
    const sqlTotals = `
      SELECT 
        COUNT(DISTINCT COALESCE(tipo_produto, 'Outros')) as familias,
        COUNT(DISTINCT nome_parceiro) as clientes,
        COUNT(DISTINCT rede) as matrizes,
        SUM(fat) as fat,
        SUM(qty) as qty,
        COUNT(DISTINCT mes) as meses
      FROM ${targetSource} ${whereCur}
    `;

    // Query Total Empresa (Não filtrado)
    const sqlTotalEmpresa = `
      SELECT SUM(fat) as total_empresa_fat
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL}
      WHERE mes >= ${escapeSqlValue(curStartMonth)} AND mes <= ${escapeSqlValue(curEndMonth)}
    `;

    // Query por Família (Período Atual)
    const sqlByFamilia = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        SUM(fat) as fat,
        SUM(qty) as qty,
        COUNT(DISTINCT nome_parceiro) as clientes,
        COUNT(DISTINCT rede) as matrizes,
        COUNT(DISTINCT product) as skus
      FROM ${targetSource} ${whereCur}
      GROUP BY COALESCE(tipo_produto, 'Outros')
      ORDER BY fat DESC
    `;

    // Query MoM
    const sqlMomByFamilia = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        SUM(fat) as fat,
        SUM(qty) as qty,
        COUNT(DISTINCT nome_parceiro) as clientes
      FROM ${targetSource} ${whereMom}
      GROUP BY COALESCE(tipo_produto, 'Outros')
    `;

    // Query YoY
    const sqlYoyByFamilia = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        SUM(fat) as fat,
        SUM(qty) as qty,
        COUNT(DISTINCT nome_parceiro) as clientes
      FROM ${targetSource} ${whereYoy}
      GROUP BY COALESCE(tipo_produto, 'Outros')
    `;

    // Query Mensal (Evolução & Heatmap)
    const sqlMonthly = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        mes as month,
        SUM(fat) as fat,
        SUM(qty) as qty,
        COUNT(DISTINCT nome_parceiro) as clientes
      FROM ${targetSource} ${whereCur}
      GROUP BY COALESCE(tipo_produto, 'Outros'), mes
      ORDER BY mes ASC
    `;

    // Query Treemap & Drill-down (Família -> SKU)
    const sqlSkuBreakdown = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        product as sku,
        SUM(fat) as fat,
        SUM(qty) as qty,
        COUNT(DISTINCT nome_parceiro) as clientes
      FROM ${targetSource} ${whereCur}
      GROUP BY COALESCE(tipo_produto, 'Outros'), product
      ORDER BY fat DESC
    `;

    // Query Drill-down Nível 3 (Família -> SKU -> Clientes)
    const sqlClientBreakdown = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        product as sku,
        nome_parceiro as cliente,
        MAX(rede) as rede,
        MAX(uf) as uf,
        SUM(fat) as fat,
        SUM(qty) as qty
      FROM ${targetSource} ${whereCur}
      GROUP BY COALESCE(tipo_produto, 'Outros'), product, nome_parceiro
      ORDER BY fat DESC
    `;

    // Query Região Líder (Insights)
    const sqlTopUf = `
      SELECT COALESCE(uf, 'SP') as uf, SUM(fat) as fat
      FROM ${targetSource} ${whereCur}
      GROUP BY COALESCE(uf, 'SP')
      ORDER BY fat DESC LIMIT 1
    `;

    // Execução por lotes otimizados para evitar saturação de conexões concorrentes no Supabase RPC
    const resTotals = await this.executeSql(sqlTotals);
    const resTotalEmpresa = await this.executeSql(sqlTotalEmpresa);
    const resByFamilia = await this.executeSql(sqlByFamilia);
    const resTopUf = await this.executeSql(sqlTopUf);

    const [resMom, resYoy] = await Promise.all([
      this.executeSql(sqlMomByFamilia),
      this.executeSql(sqlYoyByFamilia)
    ]);

    const [resMonthly, resSkuBreakdown] = await Promise.all([
      this.executeSql(sqlMonthly),
      this.executeSql(sqlSkuBreakdown)
    ]);

    const totals = {
      familias: Number(resTotals[0]?.familias || 0),
      clientes: Number(resTotals[0]?.clientes || 0),
      matrizes: Number(resTotals[0]?.matrizes || 0),
      fat: Number(resTotals[0]?.fat || 0),
      qty: Number(resTotals[0]?.qty || 0),
      meses: Number(resTotals[0]?.meses || 1) || 1,
      totalEmpresaFat: Number(resTotalEmpresa[0]?.total_empresa_fat || resTotals[0]?.fat || 0),
    };

    const totalFat = totals.fat || 1;
    const totalEmpresaFat = totals.totalEmpresaFat || totalFat;

    // Indexar MoM e YoY por Família
    const momMap = new Map<string, { fat: number; qty: number; clientes: number }>();
    resMom.forEach((r: any) => {
      momMap.set(r.familia, {
        fat: Number(r.fat || 0),
        qty: Number(r.qty || 0),
        clientes: Number(r.clientes || 0)
      });
    });

    const yoyMap = new Map<string, { fat: number; qty: number; clientes: number }>();
    resYoy.forEach((r: any) => {
      yoyMap.set(r.familia, {
        fat: Number(r.fat || 0),
        qty: Number(r.qty || 0),
        clientes: Number(r.clientes || 0)
      });
    });

    // Processar Famílias com Métricas e Crescimentos
    let acumuladoFat = 0;
    const familias = resByFamilia.map((r: any) => {
      const fat = Number(r.fat || 0);
      const qty = Number(r.qty || 0);
      const clientes = Number(r.clientes || 0);
      const matrizes = Number(r.matrizes || 0);
      const skus = Number(r.skus || 0);

      acumuladoFat += fat;

      const pctFiltrado = (fat / totalFat) * 100;
      const pctEmpresa = (fat / totalEmpresaFat) * 100;
      const pctAcumulado = (acumuladoFat / totalFat) * 100;

      const mom = momMap.get(r.familia);
      const yoy = yoyMap.get(r.familia);

      const momFatGrowth = mom && mom.fat > 0 ? ((fat - mom.fat) / mom.fat) * 100 : null;
      const yoyFatGrowth = yoy && yoy.fat > 0 ? ((fat - yoy.fat) / yoy.fat) * 100 : null;

      const momQtyGrowth = mom && mom.qty > 0 ? ((qty - mom.qty) / mom.qty) * 100 : null;
      const yoyQtyGrowth = yoy && yoy.qty > 0 ? ((qty - yoy.qty) / yoy.qty) * 100 : null;

      return {
        familia: r.familia,
        fat,
        qty,
        clientes,
        matrizes,
        skus,
        ticketMedio: clientes > 0 ? fat / clientes : 0,
        precoMedio: qty > 0 ? fat / qty : 0,
        pctFiltrado,
        pctEmpresa,
        pctAcumulado,
        isPareto80: pctAcumulado <= 82,
        momFatGrowth,
        yoyFatGrowth,
        momQtyGrowth,
        yoyQtyGrowth,
      };
    });

    // Pareto 80/20 list
    const pareto80 = familias.filter((f: any) => f.isPareto80 || f.pctAcumulado <= 85);

    // Insights Automáticos
    const familiaLider = familias[0] || null;
    
    // Maior crescimento MoM / YoY
    const comCrescimento = [...familias].filter((f: any) => f.momFatGrowth !== null).sort((a: any, b: any) => (b.momFatGrowth || 0) - (a.momFatGrowth || 0));
    const maiorCrescimento = comCrescimento[0] || null;

    // Maior queda MoM / YoY
    const comQueda = [...familias].filter((f: any) => f.momFatGrowth !== null).sort((a: any, b: any) => (a.momFatGrowth || 0) - (b.momFatGrowth || 0));
    const maiorQueda = comQueda[0] || null;

    const regiaoLider = resTopUf[0] ? { uf: resTopUf[0].uf, fat: Number(resTopUf[0].fat || 0) } : null;

    // Insights em formato de bullet executivo
    const insightsBullet: string[] = [];
    if (familiaLider) {
      insightsBullet.push(`A família ${familiaLider.familia} é a líder do período, representando ${familiaLider.pctFiltrado.toFixed(1)}% do faturamento das famílias filtradas.`);
    }
    if (pareto80.length > 0) {
      const paretoNomes = pareto80.map((f: any) => f.familia).join(', ');
      insightsBullet.push(`Curva Pareto 80/20: As famílias [ ${paretoNomes} ] acumulam ~80% da receita total comercializada.`);
    }
    if (maiorCrescimento && (maiorCrescimento.momFatGrowth || 0) > 0) {
      insightsBullet.push(`Destaque MoM: A família ${maiorCrescimento.familia} teve a maior aceleração com +${maiorCrescimento.momFatGrowth?.toFixed(1)}% de crescimento.`);
    }
    if (maiorQueda && (maiorQueda.momFatGrowth || 0) < 0) {
      insightsBullet.push(`Atenção Desaceleração: A família ${maiorQueda.familia} variou ${maiorQueda.momFatGrowth?.toFixed(1)}% em relação ao período anterior.`);
    }
    if (regiaoLider) {
      const pctUf = (regiaoLider.fat / totalFat) * 100;
      insightsBullet.push(`Concentração Regional: A UF ${regiaoLider.uf} foi o maior polo comprador com ${pctUf.toFixed(1)}% das vendas.`);
    }

    return {
      totals,
      familias,
      pareto: familias.map((f: any) => ({
        familia: f.familia,
        fat: f.fat,
        pctFiltrado: f.pctFiltrado,
        pctAcumulado: f.pctAcumulado,
        isPareto80: f.isPareto80,
      })),
      monthly: resMonthly.map((r: any) => ({
        familia: r.familia,
        month: r.month,
        fat: Number(r.fat || 0),
        qty: Number(r.qty || 0),
        clientes: Number(r.clientes || 0)
      })),
      skuBreakdown: resSkuBreakdown.map((r: any) => ({
        familia: r.familia,
        sku: r.sku,
        fat: Number(r.fat || 0),
        qty: Number(r.qty || 0),
        clientes: Number(r.clientes || 0)
      })),
      insights: {
        familiaLider,
        maiorCrescimento,
        maiorQueda,
        regiaoLider,
        bulletPoints: insightsBullet,
      }
    };
  }

  /**
   * 11.2 Detalhamento de Clientes Compradores do SKU (Lazy Loading sob demanda)
   */
  static async getFamiliaClientBreakdownData(filters: AnalyticsFilters, familia: string, sku: string, limit: number = 20) {
    const targetSource = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;
    const baseWhere = buildWhereClause(filters, targetSource);

    const familiaCond = familia === 'Outros' 
      ? "COALESCE(tipo_produto, 'Outros') = 'Outros'" 
      : `tipo_produto = ${escapeSqlValue(familia)}`;

    const skuCond = `product = ${escapeSqlValue(sku)}`;

    const sqlClientBreakdown = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        product as sku,
        nome_parceiro as cliente,
        MAX(rede) as rede,
        MAX(uf) as uf,
        SUM(fat) as fat,
        SUM(qty) as qty
      FROM ${targetSource}
      ${baseWhere} AND ${familiaCond} AND ${skuCond}
      GROUP BY COALESCE(tipo_produto, 'Outros'), product, nome_parceiro
      ORDER BY fat DESC
      LIMIT ${limit}
    `;

    return this.executeSql(sqlClientBreakdown);
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

  /**
   * 15. Sistema Inovações — Cockpit Comercial (Fase 1: Backend Read-Only)
   * 
   * Consolida métricas executivas, saúde da carteira, ranking comercial
   * e oportunidades calculadas sem alterar nenhuma tabela ou módulo existente.
   * 
   * @see Seção 54 do AGENTS.md (Sistema Inovações)
   */
  static async getCockpitComercial(filters: AnalyticsFilters): Promise<CockpitComercialData> {
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
    const defaultCurrentMonth = `${defaultYear}-${defaultMonth}`;

    const curStartMonth = filters.startMonth || (filters.startDate ? filters.startDate.substring(0, 7) : defaultCurrentMonth);
    const curEndMonth = filters.endMonth || (filters.endDate ? filters.endDate.substring(0, 7) : defaultCurrentMonth);

    const [sYear, sMonth] = curStartMonth.split('-').map(Number);
    const [eYear, eMonth] = curEndMonth.split('-').map(Number);

    // Calcular período anterior (PM) de igual duração
    const numMonths = (eYear - sYear) * 12 + (eMonth - sMonth) + 1;
    let pmStartYear = sYear;
    let pmStartMonthNum = sMonth - numMonths;
    while (pmStartMonthNum <= 0) {
      pmStartYear -= 1;
      pmStartMonthNum += 12;
    }
    let pmEndYear = eYear;
    let pmEndMonthNum = eMonth - numMonths;
    while (pmEndMonthNum <= 0) {
      pmEndYear -= 1;
      pmEndMonthNum += 12;
    }

    const pmStartMonth = `${pmStartYear}-${String(pmStartMonthNum).padStart(2, '0')}`;
    const pmEndMonth = `${pmEndYear}-${String(pmEndMonthNum).padStart(2, '0')}`;

    // Calcular período dos últimos 3 meses fechados para o Rolling FAT 3M (Seção 15)
    let rollingEndYear = eYear;
    let rollingEndMonthNum = eMonth;
    let rollingStartYear = eYear;
    let rollingStartMonthNum = eMonth - 2;
    while (rollingStartMonthNum <= 0) {
      rollingStartYear -= 1;
      rollingStartMonthNum += 12;
    }
    const rollingStartMonth = `${rollingStartYear}-${String(rollingStartMonthNum).padStart(2, '0')}`;
    const rollingEndMonth = `${rollingEndYear}-${String(rollingEndMonthNum).padStart(2, '0')}`;

    const curFilters = { ...filters, startMonth: curStartMonth, endMonth: curEndMonth };
    const pmFilters = { ...filters, startMonth: pmStartMonth, endMonth: pmEndMonth };
    const rollingFilters = { ...filters, startMonth: rollingStartMonth, endMonth: rollingEndMonth };

    const whereCurMensal = buildWhereClause(curFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL);
    const whereCurClient = buildWhereClause(curFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL);
    const wherePmMensal = buildWhereClause(pmFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL);
    const wherePmClient = buildWhereClause(pmFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL);
    const whereRollingClient = buildWhereClause(rollingFilters, OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL);

    // 1. Faturamento Período Atual e Período Anterior
    const sqlFatCur = `SELECT SUM(fat) as total_fat FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL} ${whereCurMensal}`;
    const sqlFatPm = `SELECT SUM(fat) as total_fat FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL} ${wherePmMensal}`;

    // 2. Desempenho por Cliente no Período Atual e Anterior
    const sqlClientsCur = `
      SELECT 
        COALESCE(rede, nome_parceiro, 'Não Mapeado') as rede,
        nome_parceiro,
        COALESCE(manager, 'Outros') as manager,
        SUM(fat) as fat_atual
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL} ${whereCurClient}
      GROUP BY COALESCE(rede, nome_parceiro, 'Não Mapeado'), nome_parceiro, COALESCE(manager, 'Outros')
    `;

    const sqlClientsPm = `
      SELECT 
        nome_parceiro,
        SUM(fat) as fat_anterior
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL} ${wherePmClient}
      GROUP BY nome_parceiro
    `;

    // 3. Rolling FAT 3M por Rede (Respeitando a Seção 15 do AGENTS.md)
    const sqlRedesRolling = `
      SELECT 
        COALESCE(rede, 'OUTROS') as rede,
        SUM(fat) as rolling_fat_3m
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL} ${whereRollingClient}
      GROUP BY COALESCE(rede, 'OUTROS')
    `;

    // 4. Desempenho por Gerente no Período
    const sqlGerentes = `
      SELECT 
        COALESCE(manager, 'Outros') as manager,
        SUM(fat) as faturamento
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL} ${whereCurMensal}
      GROUP BY COALESCE(manager, 'Outros')
      ORDER BY faturamento DESC
    `;

    // 5. Atividade Comercial dos Clientes (cm_clientes_atividade)
    let sqlAtividade = `
      SELECT 
        c.id as cliente_id,
        c.nome_parceiro,
        c.matriz as rede,
        c.manager_name as manager,
        a.ultima_compra::text as ultima_compra,
        a.dias_sem_comprar,
        COALESCE(a.situacao_comercial, 'Sem vendas') as situacao_comercial,
        COALESCE(a.valor_faturado_12m, 0) as valor_faturado_12m
      FROM public.cm_clientes c
      LEFT JOIN public.cm_clientes_atividade a ON c.id = a.cliente_id
    `;

    const atividadeWhere: string[] = ['1=1'];
    if (filters.manager_id || filters.manager) {
      const mgrClause = buildManagerFilter(filters.manager_id, filters.manager, 'c');
      if (mgrClause) atividadeWhere.push(mgrClause);
    }
    if (filters.uf) {
      const ufClause = buildUfFilter(filters.uf, 'c');
      if (ufClause) atividadeWhere.push(ufClause);
    }
    if (filters.matriz && filters.matriz !== 'all') {
      const redesEscaped = filters.matriz.split(',').map(r => escapeSqlValue(r.trim())).join(',');
      atividadeWhere.push(`c.matriz IN (${redesEscaped})`);
    }
    sqlAtividade += ' WHERE ' + atividadeWhere.join(' AND ');

    // Execução paralela de todas as consultas read-only
    const [
      resFatCur,
      resFatPm,
      resClientsCur,
      resClientsPm,
      resRedesRolling,
      resGerentes,
      resAtividade
    ] = await Promise.all([
      this.executeSql<{ total_fat: number }>(sqlFatCur),
      this.executeSql<{ total_fat: number }>(sqlFatPm),
      this.executeSql<{ rede: string; nome_parceiro: string; manager: string; fat_atual: number }>(sqlClientsCur),
      this.executeSql<{ nome_parceiro: string; fat_anterior: number }>(sqlClientsPm),
      this.executeSql<{ rede: string; rolling_fat_3m: number }>(sqlRedesRolling),
      this.executeSql<{ manager: string; faturamento: number }>(sqlGerentes),
      this.executeSql<{
        cliente_id: string;
        nome_parceiro: string;
        rede: string | null;
        manager: string | null;
        ultima_compra: string | null;
        dias_sem_comprar: number | null;
        situacao_comercial: string;
        valor_faturado_12m: number;
      }>(sqlAtividade)
    ]);

    const faturamentoAtual = Number(resFatCur[0]?.total_fat || 0);
    const faturamentoAnterior = Number(resFatPm[0]?.total_fat || 0);
    const crescimentoNominal = faturamentoAtual - faturamentoAnterior;
    const crescimentoPercentual = faturamentoAnterior > 0
      ? (crescimentoNominal / faturamentoAnterior) * 100
      : 0;

    // Mapeamento de Faturamento Anterior por Cliente
    const pmMap = new Map<string, number>();
    resClientsPm.forEach(r => {
      pmMap.set(r.nome_parceiro, Number(r.fat_anterior || 0));
    });

    // Mapeamento de Faturamento Atual por Cliente
    const curClientMap = new Map<string, { rede: string; manager: string; fat: number }>();
    resClientsCur.forEach(r => {
      curClientMap.set(r.nome_parceiro, {
        rede: r.rede,
        manager: r.manager,
        fat: Number(r.fat_atual || 0)
      });
    });

    // Contagem de Clientes por Situação Comercial
    let clientesAtivos = 0;
    let clientesAtencao = 0;
    let clientesInativos = 0;

    resAtividade.forEach(a => {
      const sit = a.situacao_comercial;
      if (sit === 'Ativo') clientesAtivos += 1;
      else if (sit === 'Atenção') clientesAtencao += 1;
      else if (sit === 'Inativo') clientesInativos += 1;
    });

    const totalClientesCompradores = resClientsCur.length;
    const ticketMedio = totalClientesCompradores > 0
      ? faturamentoAtual / totalClientesCompradores
      : 0;

    // Construção da Saúde da Carteira
    const saudeCarteira: CockpitComercialData['saudeCarteira'] = resAtividade.map(a => {
      const curData = curClientMap.get(a.nome_parceiro);
      const fatAtual = curData ? curData.fat : 0;
      const fatAnterior = pmMap.get(a.nome_parceiro) || 0;

      let varianciaPercentual = 0;
      if (fatAnterior > 0) {
        varianciaPercentual = ((fatAtual - fatAnterior) / fatAnterior) * 100;
      } else if (fatAtual > 0) {
        varianciaPercentual = 100;
      }

      let classificacaoSaude: CockpitComercialData['saudeCarteira'][0]['classificacaoSaude'] = 'Ativo';
      if (varianciaPercentual <= -20 && (fatAnterior >= 1000 || fatAtual >= 1000)) {
        classificacaoSaude = 'Em Risco';
      } else if (varianciaPercentual >= 15 && fatAtual >= 1000) {
        classificacaoSaude = 'Em Expansão';
      } else if (a.situacao_comercial === 'Atenção') {
        classificacaoSaude = 'Atenção';
      } else if (a.situacao_comercial === 'Inativo' || a.situacao_comercial === 'Sem vendas') {
        classificacaoSaude = 'Inativo';
      }

      return {
        clienteId: a.cliente_id,
        nomeParceiro: a.nome_parceiro,
        rede: curData?.rede || a.rede,
        manager: curData?.manager || a.manager,
        ultimaCompra: a.ultima_compra,
        diasSemComprar: a.dias_sem_comprar !== null ? Number(a.dias_sem_comprar) : null,
        situacaoComercial: a.situacao_comercial,
        valorFaturadoPeriodo: fatAtual,
        valorFaturado12m: Number(a.valor_faturado_12m || 0),
        varianciaPercentual: Number(varianciaPercentual.toFixed(2)),
        classificacaoSaude,
      };
    });

    // Ordenação do Ranking de Redes (Regra Oficial da Seção 15 do AGENTS.md)
    const redesComRolling = resRedesRolling.map(r => ({
      rede: r.rede,
      rollingFat3m: Number(r.rolling_fat_3m || 0)
    }));

    const totalRollingFat = redesComRolling.reduce((acc, r) => acc + r.rollingFat3m, 0);

    // Separar redes normais e a rede "OUTROS"
    const redesNormais = redesComRolling.filter(r => r.rede.toUpperCase() !== 'OUTROS');
    const redeOutros = redesComRolling.find(r => r.rede.toUpperCase() === 'OUTROS');

    // Ordenar redes normais: Rolling FAT 3M desc, desempate alfabético pt-BR
    redesNormais.sort((a, b) => {
      if (Math.abs(b.rollingFat3m - a.rollingFat3m) > 0.001) {
        return b.rollingFat3m - a.rollingFat3m;
      }
      return a.rede.localeCompare(b.rede, 'pt-BR');
    });

    const redesOrdenadasFinal = [...redesNormais];
    if (redeOutros) {
      redesOrdenadasFinal.push(redeOutros);
    }

    const rankingRedes: CockpitComercialData['ranking']['redes'] = redesOrdenadasFinal.map((r, idx) => ({
      rede: r.rede,
      rollingFat3m: Number(r.rollingFat3m.toFixed(2)),
      share: totalRollingFat > 0 ? Number(((r.rollingFat3m / totalRollingFat) * 100).toFixed(2)) : 0,
      rankingPosition: idx + 1
    }));

    // Ranking de Clientes (Top 20)
    const clientesOrdenados = resClientsCur
      .map(c => ({
        nomeParceiro: c.nome_parceiro,
        faturamento: Number(c.fat_atual || 0),
        share: faturamentoAtual > 0 ? Number(((Number(c.fat_atual || 0) / faturamentoAtual) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 20);

    // Ranking de Gerentes
    const gerentesOrdenados = resGerentes.map(g => ({
      manager: g.manager,
      faturamento: Number(g.faturamento || 0),
      share: faturamentoAtual > 0 ? Number(((Number(g.faturamento || 0) / faturamentoAtual) * 100).toFixed(2)) : 0
    }));

    // Motor de Oportunidades Calculadas
    const oportunidades: CockpitComercialData['oportunidades'] = [];

    // Oportunidade 1: Reativação de Clientes Valiosos (12M >= 10k e Atenção/Inativo)
    saudeCarteira
      .filter(c => (c.situacaoComercial === 'Atenção' || c.situacaoComercial === 'Inativo') && c.valorFaturado12m >= 10000)
      .sort((a, b) => b.valorFaturado12m - a.valorFaturado12m)
      .slice(0, 10)
      .forEach(c => {
        oportunidades.push({
          tipo: 'REATIVACAO',
          titulo: `Reativação: ${c.nomeParceiro}`,
          descricao: `Cliente sem compras há ${c.diasSemComprar ?? 'X'} dias. Histórico faturado de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.valorFaturado12m)} nos últimos 12 meses.`,
          clienteOuRede: c.nomeParceiro,
          valorImpactoPotencial: c.valorFaturado12m,
          nivelPrioridade: c.valorFaturado12m >= 50000 ? 'ALTA' : 'MEDIA'
        });
      });

    // Oportunidade 2: Alerta de Queda Crítica (Queda >= 20% e Fat Anterior >= 5k)
    saudeCarteira
      .filter(c => c.classificacaoSaude === 'Em Risco' && c.varianciaPercentual <= -20)
      .sort((a, b) => a.varianciaPercentual - b.varianciaPercentual)
      .slice(0, 10)
      .forEach(c => {
        const fatAnteriorEst = pmMap.get(c.nomeParceiro) || 0;
        const impactoNominal = fatAnteriorEst - c.valorFaturadoPeriodo;
        oportunidades.push({
          tipo: 'QUEDA_CRITICA',
          titulo: `Risco de Queda: ${c.nomeParceiro}`,
          descricao: `Queda de ${Math.abs(c.varianciaPercentual).toFixed(1)}% no período em relação ao período anterior (Redução de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(impactoNominal)}).`,
          clienteOuRede: c.nomeParceiro,
          valorImpactoPotencial: impactoNominal,
          nivelPrioridade: impactoNominal >= 20000 ? 'ALTA' : 'MEDIA'
        });
      });

    // Oportunidade 3: Expansão Acelerada (Crescimento >= 15% e Fat Periodo >= 5k)
    saudeCarteira
      .filter(c => c.classificacaoSaude === 'Em Expansão')
      .sort((a, b) => b.varianciaPercentual - a.varianciaPercentual)
      .slice(0, 10)
      .forEach(c => {
        oportunidades.push({
          tipo: 'EXPANSAO',
          titulo: `Oportunidade de Expansão: ${c.nomeParceiro}`,
          descricao: `Crescimento de +${c.varianciaPercentual.toFixed(1)}% no período. Faturamento atual atingiu ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.valorFaturadoPeriodo)}.`,
          clienteOuRede: c.nomeParceiro,
          valorImpactoPotencial: c.valorFaturadoPeriodo,
          nivelPrioridade: c.valorFaturadoPeriodo >= 30000 ? 'ALTA' : 'MEDIA'
        });
      });

    return {
      metrics: {
        faturamentoAtual: Number(faturamentoAtual.toFixed(2)),
        faturamentoAnterior: Number(faturamentoAnterior.toFixed(2)),
        crescimentoNominal: Number(crescimentoNominal.toFixed(2)),
        crescimentoPercentual: Number(crescimentoPercentual.toFixed(2)),
        clientesAtivos,
        clientesAtencao,
        clientesInativos,
        ticketMedio: Number(ticketMedio.toFixed(2)),
      },
      saudeCarteira,
      ranking: {
        redes: rankingRedes,
        clientes: clientesOrdenados,
        gerentes: gerentesOrdenados,
      },
      oportunidades,
    };
  }

  /**
   * 16. Sistema Inovações — DRE Comercial (Fase 2: Backend Read-Only)
   * 
   * Consolida a Demonstração do Resultado Comercial com apuração de MACO
   * (Margem de Contribuição) por diferentes dimensões comerciais sem alterar nenhuma tabela.
   * 
   * Fórmula Oficial de MACO:
   * MACO = Faturamento Líquido - CPV - Impostos - Frete (3% fixo) - Investimento Comercial
   * 
   * @see Seção 56 do AGENTS.md
   */
  static async getDreComercial(filters: AnalyticsFilters): Promise<DreComercialData> {
    let mesStart = filters.startMonth || (filters.startDate ? filters.startDate.substring(0, 7) : null);
    let mesEnd = filters.endMonth || (filters.endDate ? filters.endDate.substring(0, 7) : null);
    if (!mesStart) {
      const now = new Date();
      mesStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!mesEnd) mesEnd = mesStart;

    const dtStart = `${mesStart}-01`;
    const [y, m] = mesEnd.split('-').map(Number);
    const dtNext = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    // 1. Apuração Sintética de Faturamento, Impostos e Custo da View Oficial
    let sqlSintetica = `
      SELECT 
        COALESCE(SUM(COALESCE(vlr_total_liq, 0) + COALESCE(vlr_desconto, 0)), 0) as fat_bruto,
        COALESCE(SUM(COALESCE(vlr_desconto, 0)), 0) as descontos,
        COALESCE(SUM(COALESCE(vlr_total_liq, 0)), 0) as fat_liquido,
        COALESCE(SUM(COALESCE(custo_icms, 0) + CASE WHEN COALESCE(vlr_total_st, 0) >= ABS(COALESCE(vlr_total_liq, 0)) THEN 0 ELSE COALESCE(vlr_total_st, 0) END), 0) as impostos,
        COALESCE(SUM(COALESCE(custo_total, 0)), 0) as cpv
      FROM ${resolveOfficialSource(OFFICIAL_ANALYTICS_SOURCES.VW_FATURAMENTO_COMERCIAL_OFICIAL)}
      WHERE dt_faturamento >= ${escapeSqlValue(dtStart)} AND dt_faturamento < ${escapeSqlValue(dtNext)}
    `;
    if (filters.matriz && filters.matriz !== 'all') {
      const redesEscaped = filters.matriz.split(',').map(r => escapeSqlValue(r.trim())).join(',');
      sqlSintetica += ` AND cod_parceiro IN (SELECT CAST(id AS TEXT) FROM public.cm_clientes WHERE matriz IN (${redesEscaped}))`;
    }

    // 2. Apuração dos Investimentos Comerciais Aprovados (cm_acoes_investimento)
    let sqlInvestimentos = `
      SELECT COALESCE(SUM(COALESCE(valor_investimento, 0)), 0) as total_investimento
      FROM public.cm_acoes_investimento
      WHERE COALESCE(verba_aprovada, true) = true
        AND mes_referencia >= ${escapeSqlValue(mesStart)}
        AND mes_referencia <= ${escapeSqlValue(mesEnd)}
    `;
    if (filters.matriz && filters.matriz !== 'all') {
      const redesEscaped = filters.matriz.split(',').map(r => escapeSqlValue(r.trim())).join(',');
      sqlInvestimentos += ` AND codigo_matriz IN (${redesEscaped})`;
    }

    const [rowsSintetica, rowsInvest] = await Promise.all([
      this.executeSql<{ fat_bruto: number; descontos: number; fat_liquido: number; impostos: number; cpv: number }>(sqlSintetica),
      this.executeSql<{ total_investimento: number }>(sqlInvestimentos),
    ]);

    const rSint = rowsSintetica[0] || { fat_bruto: 0, descontos: 0, fat_liquido: 0, impostos: 0, cpv: 0 };
    const rInv = rowsInvest[0] || { total_investimento: 0 };

    const faturamentoBruto = Number(rSint.fat_bruto) || 0;
    const descontos = Number(rSint.descontos) || 0;
    const faturamentoLiquido = Number(rSint.fat_liquido) || 0;
    const impostos = Number(rSint.impostos) || 0;
    const cpv = Number(rSint.cpv) || 0;
    const margemBruta = faturamentoLiquido - cpv;
    const frete = faturamentoLiquido * DRE_FRETE_PERCENTUAL;
    const investimentoComercial = Number(rInv.total_investimento) || 0;
    const macoTotal = faturamentoLiquido - cpv - impostos - frete - investimentoComercial;
    const margemMacoMedia = faturamentoLiquido > 0 ? (macoTotal / faturamentoLiquido) * 100 : 0;

    // 3. Montagem da DRE Sintética em Cascata
    const sintetica: DreComercialLinha[] = [
      {
        label: "(+) Faturamento Bruto Comercial",
        valor: Number(faturamentoBruto.toFixed(2)),
        percentual: faturamentoLiquido > 0 ? Number(((faturamentoBruto / faturamentoLiquido) * 100).toFixed(2)) : 100,
        tipo: "RECEITA",
      },
      {
        label: "(-) Descontos Comerciais",
        valor: Number(descontos.toFixed(2)),
        percentual: faturamentoLiquido > 0 ? Number(((descontos / faturamentoLiquido) * 100).toFixed(2)) : 0,
        tipo: "DEDUCAO",
      },
      {
        label: "(=) RECEITA COMERCIAL LÍQUIDA",
        valor: Number(faturamentoLiquido.toFixed(2)),
        percentual: 100,
        tipo: "SUBTOTAL",
      },
      {
        label: "(-) Deduções Fiscais & Impostos",
        valor: Number(impostos.toFixed(2)),
        percentual: faturamentoLiquido > 0 ? Number(((impostos / faturamentoLiquido) * 100).toFixed(2)) : 0,
        tipo: "DEDUCAO",
      },
      {
        label: "(-) Custo dos Produtos Vendidos (CPV)",
        valor: Number(cpv.toFixed(2)),
        percentual: faturamentoLiquido > 0 ? Number(((cpv / faturamentoLiquido) * 100).toFixed(2)) : 0,
        tipo: "DEDUCAO",
      },
      {
        label: "(=) MARGEM BRUTA",
        valor: Number(margemBruta.toFixed(2)),
        percentual: faturamentoLiquido > 0 ? Number(((margemBruta / faturamentoLiquido) * 100).toFixed(2)) : 0,
        tipo: "SUBTOTAL",
      },
      {
        label: "(-) Frete & Logística (3,00% Fixo)",
        valor: Number(frete.toFixed(2)),
        percentual: 3,
        tipo: "DEDUCAO",
      },
      {
        label: "(-) Investimentos Comerciais / Trade",
        valor: Number(investimentoComercial.toFixed(2)),
        percentual: faturamentoLiquido > 0 ? Number(((investimentoComercial / faturamentoLiquido) * 100).toFixed(2)) : 0,
        tipo: "DEDUCAO",
      },
      {
        label: "(=) MARGEM DE CONTRIBUIÇÃO (MACO)",
        valor: Number(macoTotal.toFixed(2)),
        percentual: Number(margemMacoMedia.toFixed(2)),
        tipo: "RESULTADO",
      },
    ];

    // 4. Apuração Dimensional por Cliente (Top 50)
    let sqlDimensional = `
      SELECT 
        COALESCE(nome_parceiro, 'Outros') as nome,
        COALESCE(SUM(COALESCE(vlr_total_liq, 0) + COALESCE(vlr_desconto, 0)), 0) as fat_bruto,
        COALESCE(SUM(COALESCE(vlr_total_liq, 0)), 0) as fat_liquido,
        COALESCE(SUM(COALESCE(custo_icms, 0) + CASE WHEN COALESCE(vlr_total_st, 0) >= ABS(COALESCE(vlr_total_liq, 0)) THEN 0 ELSE COALESCE(vlr_total_st, 0) END), 0) as impostos,
        COALESCE(SUM(COALESCE(custo_total, 0)), 0) as cpv
      FROM ${resolveOfficialSource(OFFICIAL_ANALYTICS_SOURCES.VW_FATURAMENTO_COMERCIAL_OFICIAL)}
      WHERE dt_faturamento >= ${escapeSqlValue(dtStart)} AND dt_faturamento < ${escapeSqlValue(dtNext)}
    `;
    if (filters.matriz && filters.matriz !== 'all') {
      const redesEscaped = filters.matriz.split(',').map(r => escapeSqlValue(r.trim())).join(',');
      sqlDimensional += ` AND cod_parceiro IN (SELECT CAST(id AS TEXT) FROM public.cm_clientes WHERE matriz IN (${redesEscaped}))`;
    }
    sqlDimensional += ` GROUP BY nome_parceiro ORDER BY fat_liquido DESC LIMIT 50`;

    const rowsDim = await this.executeSql<{ nome: string; fat_bruto: number; fat_liquido: number; impostos: number; cpv: number }>(sqlDimensional);

    const taxaInvestimentoGlobal = faturamentoLiquido > 0 ? investimentoComercial / faturamentoLiquido : 0;

    const dimensionais: DreComercialDimensional[] = rowsDim.map((r, idx) => {
      const fLiq = Number(r.fat_liquido) || 0;
      const fBrut = Number(r.fat_bruto) || 0;
      const imp = Number(r.impostos) || 0;
      const c = Number(r.cpv) || 0;
      const mBruta = fLiq - c;
      const fr = fLiq * DRE_FRETE_PERCENTUAL;
      const invCom = fLiq * taxaInvestimentoGlobal;
      const maco = fLiq - c - imp - fr - invCom;
      const pctMaco = fLiq > 0 ? (maco / fLiq) * 100 : 0;

      return {
        id: `dim-${idx}-${r.nome}`,
        nome: r.nome,
        faturamentoBruto: Number(fBrut.toFixed(2)),
        faturamentoLiquido: Number(fLiq.toFixed(2)),
        impostos: Number(imp.toFixed(2)),
        cpv: Number(c.toFixed(2)),
        margemBruta: Number(mBruta.toFixed(2)),
        frete: Number(fr.toFixed(2)),
        investimentoComercial: Number(invCom.toFixed(2)),
        maco: Number(maco.toFixed(2)),
        margemMacoPercentual: Number(pctMaco.toFixed(2)),
      };
    });

    return {
      sintetica,
      totais: {
        faturamentoBruto: Number(faturamentoBruto.toFixed(2)),
        faturamentoLiquido: Number(faturamentoLiquido.toFixed(2)),
        impostos: Number(impostos.toFixed(2)),
        cpv: Number(cpv.toFixed(2)),
        margemBruta: Number(margemBruta.toFixed(2)),
        frete: Number(frete.toFixed(2)),
        investimentoComercial: Number(investimentoComercial.toFixed(2)),
        macoTotal: Number(macoTotal.toFixed(2)),
        margemMacoMedia: Number(margemMacoMedia.toFixed(2)),
      },
      dimensionais,
    };
  }

  /**
   * Apuração Analítica do CRM Comercial — Sistema Inovações (Fase 3)
   * 
   * Transforma os indicadores do Cockpit Comercial e da DRE Comercial em recomendações
   * comerciais prescritivas ordenadas pelo Score Oficial de Impacto Comercial (0 a 100).
   * 
   * @see Seção 58 do AGENTS.md
   */
  static async getCrmComercial(filters: AnalyticsFilters): Promise<CrmComercialData> {
    // 1. Consumir Cockpit Comercial e DRE Comercial em paralelo
    const [cockpitData, dreData] = await Promise.all([
      this.getCockpitComercial(filters),
      this.getDreComercial(filters),
    ]);

    // 2. Mapeamento de Oportunidades Prescritivas do Cockpit e DRE
    const oportunidades: CrmOportunidade[] = [];
    const dreDimMap = new Map(dreData.dimensionais.map((d) => [d.nome.toUpperCase(), d]));

    cockpitData.saudeCarteira.forEach((sc, idx) => {
      const dreItem = dreDimMap.get(sc.nomeParceiro.toUpperCase()) || dreDimMap.get((sc.rede || "").toUpperCase());
      const margemMaco = dreItem ? dreItem.margemMacoPercentual : 0;
      const macoVal = dreItem ? dreItem.maco : 0;
      const diasSemComprar = sc.diasSemComprar || 0;
      const faturamento3M = sc.valorFaturado12m / 4; // Estimativa 3M baseada no acumulado

      let tipoRecomendacao = "";
      let titulo = "";
      let descricao = "";
      let prioridade: "ALTA" | "MEDIA" | "BAIXA" | "OPORTUNIDADE" = "BAIXA";
      let valorImpactoPotencial = 0;

      if (sc.classificacaoSaude === "Inativo" || diasSemComprar > 45) {
        tipoRecomendacao = "REC-01";
        titulo = `🚨 Reativação Urgente: ${sc.nomeParceiro}`;
        descricao = `Cliente sem faturamento há ${diasSemComprar} dias. Histórico mensal recente de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sc.valorFaturadoPeriodo || sc.valorFaturado12m / 12)}.`;
        prioridade = "ALTA";
        valorImpactoPotencial = (sc.valorFaturado12m / 12) * 2;
      } else if (sc.classificacaoSaude === "Em Risco" || sc.varianciaPercentual <= -25) {
        tipoRecomendacao = "REC-02";
        titulo = `📉 Reversão de Queda: ${sc.nomeParceiro}`;
        descricao = `Queda de ${Math.abs(sc.varianciaPercentual).toFixed(1)}% no faturamento. Contato comercial imediato necessário.`;
        prioridade = "ALTA";
        valorImpactoPotencial = Math.abs((sc.valorFaturadoPeriodo * sc.varianciaPercentual) / 100);
      } else if (margemMaco < 25 || macoVal < 0) {
        tipoRecomendacao = "REC-04";
        titulo = `💰 Recomposição de Margem MACO: ${sc.nomeParceiro}`;
        descricao = `Margem MACO atual em ${margemMaco.toFixed(1)}%. Renegociar custos de CPV/Frete ou revisar descontos.`;
        prioridade = "MEDIA";
        valorImpactoPotencial = Math.abs(sc.valorFaturadoPeriodo * 0.15);
      } else if (sc.classificacaoSaude === "Atenção") {
        tipoRecomendacao = "REC-05";
        titulo = `📦 Expansão de Mix de Produtos: ${sc.nomeParceiro}`;
        descricao = `Cliente ativo com baixo sortimento de SKUs. Apresentar lançamentos de cafés especiais.`;
        prioridade = "MEDIA";
        valorImpactoPotencial = sc.valorFaturadoPeriodo * 0.20;
      } else if (sc.classificacaoSaude === "Em Expansão" || sc.varianciaPercentual >= 30) {
        tipoRecomendacao = "REC-09";
        titulo = `🚀 Aceleração de Expansão: ${sc.nomeParceiro}`;
        descricao = `Crescimento de ${sc.varianciaPercentual.toFixed(1)}% no período. Oportunidade para aumentar linha contratada.`;
        prioridade = "OPORTUNIDADE";
        valorImpactoPotencial = sc.valorFaturadoPeriodo * 0.30;
      }

      if (tipoRecomendacao) {
        // Cálculo do Score Oficial de Impacto Comercial (0 a 100)
        // 1. Financeiro (40%)
        let scoreFin = 20;
        if (valorImpactoPotencial >= 100000) scoreFin = 100;
        else if (valorImpactoPotencial >= 50000) scoreFin = 80;
        else if (valorImpactoPotencial >= 20000) scoreFin = 60;
        else if (valorImpactoPotencial >= 5000) scoreFin = 40;

        // 2. Criticidade (30%)
        let scoreCrit = 40;
        if (prioridade === "ALTA") scoreCrit = 100;
        else if (prioridade === "MEDIA") scoreCrit = 70;
        else if (prioridade === "OPORTUNIDADE") scoreCrit = 30;

        // 3. Relevância Estratégica (20%)
        let scoreRelev = 25;
        if (faturamento3M >= 200000) scoreRelev = 100;
        else if (faturamento3M >= 50000) scoreRelev = 75;
        else if (faturamento3M >= 10000) scoreRelev = 50;

        // 4. Urgência (10%)
        let scoreUrg = 30;
        if (diasSemComprar > 60) scoreUrg = 100;
        else if (diasSemComprar >= 30) scoreUrg = 70;

        const scoreImpacto = Math.min(
          100,
          Math.round(scoreFin * 0.4 + scoreCrit * 0.3 + scoreRelev * 0.2 + scoreUrg * 0.1)
        );

        oportunidades.push({
          id: `crm-${sc.clienteId}-${idx}`,
          clienteId: sc.clienteId,
          clienteNome: sc.nomeParceiro,
          matrizNome: sc.rede || sc.nomeParceiro,
          gerenteNome: sc.manager || "Sem Gerente",
          canal: "Varejo",
          uf: "BR",
          tipoRecomendacao,
          titulo,
          descricao,
          prioridade,
          scoreImpacto,
          valorImpactoPotencial: Number(valorImpactoPotencial.toFixed(2)),
          margemMacoAtual: Number(margemMaco.toFixed(1)),
          diasSemComprar,
        });
      }
    });

    // Ordenação Obrigatória pelo Score Oficial (Decrescente)
    oportunidades.sort((a, b) => b.scoreImpacto - a.scoreImpacto);

    // 3. Apuração do Resumo da Carteira
    const totalClientesCarteira = cockpitData.saudeCarteira.length;
    const totalClientesAtivos = cockpitData.saudeCarteira.filter((c) => c.classificacaoSaude === "Ativo").length;
    const totalClientesEmRisco = cockpitData.saudeCarteira.filter((c) => c.classificacaoSaude === "Em Risco" || c.classificacaoSaude === "Atenção").length;
    const totalClientesInativos = cockpitData.saudeCarteira.filter((c) => c.classificacaoSaude === "Inativo").length;
    const potencialRecuperacaoMaco = oportunidades.reduce((acc, o) => acc + o.valorImpactoPotencial, 0);

    const scoreSaudeGlobal = totalClientesCarteira > 0
      ? Math.round((totalClientesAtivos / totalClientesCarteira) * 100)
      : 100;

    // 4. Ranking de Gerentes por Score de Saúde
    const gerenteMap = new Map<string, { total: number; ativos: number; macoTotal: number; opsCount: number }>();
    cockpitData.saudeCarteira.forEach((sc) => {
      const g = sc.manager || "Outros";
      const curr = gerenteMap.get(g) || { total: 0, ativos: 0, macoTotal: 0, opsCount: 0 };
      curr.total += 1;
      if (sc.classificacaoSaude === "Ativo" || sc.classificacaoSaude === "Em Expansão") curr.ativos += 1;
      gerenteMap.set(g, curr);
    });

    oportunidades.forEach((o) => {
      const curr = gerenteMap.get(o.gerenteNome);
      if (curr) {
        if (o.prioridade === "ALTA") curr.opsCount += 1;
      }
    });

    const rankingGerentesScore = Array.from(gerenteMap.entries()).map(([gerente, val]) => ({
      gerente,
      totalClientes: val.total,
      scoreSaude: val.total > 0 ? Math.round((val.ativos / val.total) * 100) : 100,
      macoMedioPct: dreData.totais.margemMacoMedia,
      oportunidadesPrioritarias: val.opsCount,
    })).sort((a, b) => b.scoreSaude - a.scoreSaude);

    return {
      resumo: {
        totalClientesCarteira,
        totalClientesAtivos,
        totalClientesEmRisco,
        totalClientesInativos,
        potencialRecuperacaoMaco: Number(potencialRecuperacaoMaco.toFixed(2)),
        scoreSaudeGlobal,
      },
      oportunidades,
      rankingGerentesScore,
    };
  }
}

export const DRE_FRETE_PERCENTUAL = 0.03; // 3.00% fixo (Seção 56 do AGENTS.md)

export interface DreComercialLinha {
  label: string;
  valor: number;
  percentual: number;
  tipo: "RECEITA" | "DEDUCAO" | "SUBTOTAL" | "RESULTADO";
}

export interface DreComercialDimensional {
  id: string;
  nome: string;
  faturamentoBruto: number;
  faturamentoLiquido: number;
  impostos: number;
  cpv: number;
  margemBruta: number;
  frete: number;
  investimentoComercial: number;
  maco: number;
  margemMacoPercentual: number;
}

export interface DreComercialData {
  sintetica: DreComercialLinha[];
  totais: {
    faturamentoBruto: number;
    faturamentoLiquido: number;
    impostos: number;
    cpv: number;
    margemBruta: number;
    frete: number;
    investimentoComercial: number;
    macoTotal: number;
    margemMacoMedia: number;
  };
  dimensionais: DreComercialDimensional[];
}

export interface CockpitComercialData {
  metrics: {
    faturamentoAtual: number;
    faturamentoAnterior: number;
    crescimentoNominal: number;
    crescimentoPercentual: number;
    clientesAtivos: number;
    clientesAtencao: number;
    clientesInativos: number;
    ticketMedio: number;
  };
  saudeCarteira: Array<{
    clienteId: string;
    nomeParceiro: string;
    rede: string | null;
    manager: string | null;
    ultimaCompra: string | null;
    diasSemComprar: number | null;
    situacaoComercial: string;
    valorFaturadoPeriodo: number;
    valorFaturado12m: number;
    varianciaPercentual: number;
    classificacaoSaude: 'Ativo' | 'Atenção' | 'Inativo' | 'Em Risco' | 'Em Expansão';
  }>;
  ranking: {
    redes: Array<{ rede: string; rollingFat3m: number; share: number; rankingPosition: number }>;
    clientes: Array<{ nomeParceiro: string; faturamento: number; share: number }>;
    gerentes: Array<{ manager: string; faturamento: number; share: number }>;
  };
  oportunidades: Array<{
    tipo: 'REATIVACAO' | 'QUEDA_CRITICA' | 'BAIXO_MIX' | 'EXPANSAO';
    titulo: string;
    descricao: string;
    clienteOuRede: string;
    valorImpactoPotencial: number;
    nivelPrioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  }>;
}

export interface CrmOportunidade {
  id: string;
  clienteId: string;
  clienteNome: string;
  matrizNome: string;
  gerenteNome: string;
  canal: string;
  uf: string;
  tipoRecomendacao: string;
  titulo: string;
  descricao: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA" | "OPORTUNIDADE";
  scoreImpacto: number;
  valorImpactoPotencial: number;
  margemMacoAtual: number;
  diasSemComprar: number;
}

export interface CrmResumoCarteira {
  totalClientesCarteira: number;
  totalClientesAtivos: number;
  totalClientesEmRisco: number;
  totalClientesInativos: number;
  potencialRecuperacaoMaco: number;
  scoreSaudeGlobal: number;
}

export interface CrmComercialData {
  resumo: CrmResumoCarteira;
  oportunidades: CrmOportunidade[];
  rankingGerentesScore: Array<{
    gerente: string;
    totalClientes: number;
    scoreSaude: number;
    macoMedioPct: number;
    oportunidadesPrioritarias: number;
  }>;
}



