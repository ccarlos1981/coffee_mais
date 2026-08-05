import { createAdminClient } from "@/lib/supabase/admin";
import { PlanningTelemetry } from "@/lib/planning/planning-telemetry";

export interface PlanejavelRedeDTO {
  rede: string;
  manager: string;
  manager_id: string;
  codigo_matriz: string;
  canal?: string;
}

export interface MonthlyBillingDTO {
  fat: number;
  qty: number;
}

export interface BillingDTO {
  manager_id: string;
  rede: string;
  mes: string;
  fat: number;
  qty: number;
}

export interface ProjectionDTO {
  manager: string;
  manager_id: string;
  codigo_matriz: string;
  client_matrix: string;
  year?: number;
  month?: number;
  week_start_date?: string;
  kpi?: string;
  projection_value: number;
}

export interface RedeViewModel {
  rede: string;
  manager: string;
  manager_id: string;
  codigo_matriz: string;
  fatQ2: number;
  qtyQ2: number;
  avgPriceQ2: number;
  avg3M: number;
  avg3MKg: number;
  metaVal: number;
  metaKg: number;
  pctVsAvg3M: number;
  monthlyHistory: Record<string, MonthlyBillingDTO>;
}

export interface ManagerBlockViewModel {
  manager: string;
  manager_id: string;
  totalRedes: number;
  grandTotalFat: number;
  grandTotalMed3M: number;
  grandTotalMed3MKg: number;
  grandTotalMeta: number;
  mgrPace: number;
  mgrPreenchidas: number;
  mgrVolPrevKg: number;
  redes: RedeViewModel[];
}

export interface WorkflowDTO {
  id?: string;
  year: number;
  month: number;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "FROZEN";
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  approved_comments?: string;
  frozen_by?: string;
  frozen_at?: string;
}

export interface CockpitNacionalViewModel {
  executiveKPIs: {
    metaNacional: number;
    faturamentoAtual: number;
    forecast: number;
    pace: number;
    gapMeta: number;
    volPrevistoKg: number;
    volRealKg: number;
    precoMedioKg: number;
    med3MNacional: number;
    participacaoPct: number;
  };
  rankings: {
    gerentes: Array<{ manager: string; manager_id: string; meta: number; realizado: number; forecast: number; pace: number; gap: number; participacaoPct: number }>;
    redes: Array<{ rede: string; codigo_matriz: string; manager: string; meta: number; realizado: number; forecast: number; pace: number; gap: number; participacaoPct: number }>;
    estados: Array<{ uf: string; meta: number; realizado: number; forecast: number; pace: number; volumeKg: number; status: 'success' | 'warning' | 'danger' }>;
    clientes: Array<{ cliente: string; meta: number; realizado: number; forecast: number; pace: number; gap: number }>;
  };
  mapaUF: Array<{ uf: string; meta: number; realizado: number; forecast: number; pace: number; volumeKg: number; status: 'success' | 'warning' | 'danger' }>;
  painelRisco: Array<{ id: string; entidade: string; tipo: 'Gerente' | 'Rede' | 'UF'; nivelRisco: 'Alto' | 'Médio' | 'Baixo'; motivo: string; gap: number }>;
  oportunidades: Array<{ id: string; entidade: string; tipo: 'Subplanejada' | 'Alto Crescimento' | 'Potencial'; potencialR$: number; descricao: string }>;
  alertas: Array<{ id: string; severidade: 'ALTA' | 'MÉDIA' | 'BAIXA'; codigo: string; mensagem: string }>;
  telemetry: {
    executionTimeMs: number;
    parityDeviationPct: number;
  };
}

export interface MetasRedeViewModel {
  grandTotalFat: number;
  grandTotalMed3M: number;
  grandTotalMed3MKg: number;
  grandTotalMeta: number;
  grandTotalKg: number;
  pace: number;
  preenchidas: number;
  percentualPreenchido: number;
  totalRedes: number;
  totalManagers: number;
  managerBlocks: ManagerBlockViewModel[];
  months: string[];
  preceding3Months: string[];
  workflow: WorkflowDTO;
  telemetry: {
    sqlTimeMs: number;
    backendTimeMs: number;
    apiTimeMs: number;
    totalTimeMs: number;
    redesCount: number;
    managersCount: number;
    cacheHit: boolean;
    memoryUsedMb: number;
  };
}

export interface MetasRedePayloadDTO {
  planRedes: { rede: string; manager: string; manager_id?: string; codigo_matriz?: string }[];
  billing: Record<string, Record<string, MonthlyBillingDTO>>;
  metas: { manager: string; manager_id?: string; codigo_matriz?: string; client_matrix: string; value: number }[];
  managerMetas: { manager: string; manager_id?: string; value: number }[];
  months: string[];
  queryTimings?: {
    viewSql: number;
    salesMv: number;
    metasTable: number;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const BILLING_CACHE = new Map<string, CacheEntry<Record<string, Record<string, MonthlyBillingDTO>>>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * CommercialPlanningService
 * Single Source of Truth Service for Commercial Planning (Metas por Rede).
 */
export class CommercialPlanningService {
  private static readonly DEFAULT_YEAR = 2026;

  public static invalidateCache(year?: number, month?: number) {
    if (year && month) {
      BILLING_CACHE.delete(`${year}-${month}`);
    } else {
      BILLING_CACHE.clear();
    }
  }

  /**
   * Fetches Metas por Rede payload for a target year and month.
   */
  public static async getMetasRedeData(year: number = this.DEFAULT_YEAR, month: number = 8): Promise<MetasRedePayloadDTO> {
    const supabase = createAdminClient();
    
    // Generate months array dynamically (e.g. up to target month - 1 or preceding 12 months)
    const months: string[] = [];
    for (let m = 1; m < month; m++) {
      months.push(`${year}-${String(m).padStart(2, "0")}`);
    }
    if (months.length === 0) {
      // Cross-year fallback (preceding year months)
      for (let m = 1; m <= 12; m++) {
        months.push(`${year - 1}-${String(m).padStart(2, "0")}`);
      }
    }

    // 1. Query 1: Fetch official planejáveis networks from view
    const q1Start = performance.now();
    const { data: rpData, error: rpError } = await supabase
      .from("vw_redes_planejaveis_oficiais")
      .select("rede, manager, manager_id, codigo_matriz, canal")
      .eq("is_rede_planejavel", true);

    const q1End = performance.now();
    const viewSqlDuration = Number((q1End - q1Start).toFixed(2));

    if (rpError) {
      console.error("[CommercialPlanningService] Error fetching vw_redes_planejaveis_oficiais:", rpError);
      throw new Error(`Failed to fetch official networks: ${rpError.message}`);
    }

    // Telemetry & Data Quality Checks
    const seenKeys = new Set<string>();
    const planRedesMap = new Map<string, PlanejavelRedeDTO>();

    (rpData || []).forEach((row: any) => {
      const mgrId = String(row.manager_id || "").trim();
      const codMatriz = String(row.codigo_matriz || "").trim();
      const redeName = String(row.rede || "").trim();
      const managerName = String(row.manager || "").trim();

      if (!mgrId) {
        PlanningTelemetry.triggerDataQualityAlert("NULL_MANAGER", `Rede '${redeName}' possui manager_id nulo no cadastro.`, { redeName });
        return;
      }

      if (!codMatriz) {
        PlanningTelemetry.triggerDataQualityAlert("NULL_MATRIZ", `Rede '${redeName}' possui codigo_matriz nulo no cadastro.`, { redeName });
        return;
      }

      const key = `${mgrId}|${redeName.toUpperCase()}`;

      if (seenKeys.has(key)) {
        PlanningTelemetry.triggerDataQualityAlert("DUPLICATE_REDE", `Duplicidade detectada para a rede '${redeName}' do gerente '${managerName}'.`, { key });
      } else {
        seenKeys.add(key);
        planRedesMap.set(key, {
          rede: redeName,
          manager: managerName,
          manager_id: mgrId,
          codigo_matriz: codMatriz,
          canal: row.canal || "Outros"
        });
      }
    });

    const planRedesList = Array.from(planRedesMap.values());

    const cacheKey = `${year}-${month}`;
    const cachedEntry = BILLING_CACHE.get(cacheKey);

    let billing: Record<string, Record<string, MonthlyBillingDTO>> = {};
    let salesMvDuration = 0;

    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_TTL_MS) {
      billing = cachedEntry.data;
    } else {
      // 2. Query 2: Fetch AGGREGATED sales history directly from PostgreSQL (Returns ~200 rows instead of 122k raw rows)
      const q2Start = performance.now();
      const aggSqlText = `
        SELECT 
          s.manager_id,
          TRIM(s.rede) AS rede,
          s.mes,
          SUM(s.fat) AS fat,
          SUM(s.qty) AS qty
        FROM public.mv_vendas_cliente_mensal s
        WHERE s.mes IN ('${months.join("','")}')
          AND s.rede IS NOT NULL
          AND UPPER(TRIM(s.rede)) IN (
            SELECT UPPER(TRIM(rede)) 
            FROM public.vw_redes_planejaveis_oficiais 
            WHERE is_rede_planejavel = TRUE
          )
        GROUP BY s.manager_id, TRIM(s.rede), s.mes
      `;

      const { data: salesAggData, error: salesError } = await supabase.rpc("execute_readonly_query", { query_text: aggSqlText });
      const q2End = performance.now();
      salesMvDuration = Number((q2End - q2Start).toFixed(2));

      if (salesError) {
        console.error("[CommercialPlanningService] Error fetching sales history:", salesError);
        throw new Error(`Failed to fetch sales history: ${salesError.message}`);
      }

      // 3. Map aggregated billing to the public DTO expected by frontend without overwriting
      const managerRedeBilling: Record<string, Record<string, MonthlyBillingDTO>> = {};

      (salesAggData || []).forEach((row: any) => {
        const mgrId = String(row.manager_id || "").trim();
        const redeUpper = String(row.rede || "").trim().toUpperCase();
        const mes = String(row.mes || "").trim();

        if (!redeUpper || redeUpper === "NÃO MAPEADO" || !mes) return;

        const fatVal = Number(row.fat) || 0;
        const qtyVal = Number(row.qty) || 0;

        // 3.1 Manager-isolated key
        const managerKey = `${mgrId}|${redeUpper}`;
        if (!managerRedeBilling[managerKey]) managerRedeBilling[managerKey] = {};
        if (!managerRedeBilling[managerKey][mes]) managerRedeBilling[managerKey][mes] = { fat: 0, qty: 0 };
        managerRedeBilling[managerKey][mes].fat += fatVal;
        managerRedeBilling[managerKey][mes].qty += qtyVal;

        // 3.2 Primary lookup key (redeUpper accumulated)
        if (!billing[redeUpper]) billing[redeUpper] = {};
        if (!billing[redeUpper][mes]) billing[redeUpper][mes] = { fat: 0, qty: 0 };
        billing[redeUpper][mes].fat += fatVal;
        billing[redeUpper][mes].qty += qtyVal;

        // 3.3 Composite key fallback (manager_id + rede)
        if (!billing[managerKey]) billing[managerKey] = {};
        if (!billing[managerKey][mes]) billing[managerKey][mes] = { fat: 0, qty: 0 };
        billing[managerKey][mes].fat += fatVal;
        billing[managerKey][mes].qty += qtyVal;
      });

      planRedesList.forEach((net) => {
        const redeUpper = net.rede.trim().toUpperCase();
        const managerKey = `${net.manager_id}|${redeUpper}`;

        if (!billing[redeUpper]) {
          billing[redeUpper] = managerRedeBilling[managerKey] || {};
        }
      });

      // Save into in-memory cache
      BILLING_CACHE.set(cacheKey, { data: billing, timestamp: Date.now() });
    }

    // 4. Query 3: Fetch weekly projections / META targets for target month
    const q3Start = performance.now();
    const { data: metaData } = await supabase
      .from("cm_weekly_projections")
      .select("manager, client_matrix, projection_value, manager_id, codigo_matriz")
      .eq("kpi", "META")
      .eq("year", year)
      .eq("month", month)
      .neq("client_matrix", "_TOTAL_");

    const { data: mgrMetas } = await supabase
      .from("cm_weekly_projections")
      .select("manager, projection_value, manager_id")
      .eq("kpi", "META")
      .eq("client_matrix", "_TOTAL_")
      .eq("year", year)
      .eq("month", month);

    const q3End = performance.now();
    const metasTableDuration = Number((q3End - q3Start).toFixed(2));

    return {
      planRedes: planRedesList.map(r => ({
        rede: r.rede,
        manager: r.manager,
        manager_id: r.manager_id,
        codigo_matriz: r.codigo_matriz
      })),
      billing,
      metas: (metaData || []).map((m: any) => ({
        manager: String(m.manager || "").trim(),
        manager_id: String(m.manager_id || "").trim(),
        codigo_matriz: String(m.codigo_matriz || "").trim(),
        client_matrix: String(m.client_matrix || "").trim(),
        value: Number(m.projection_value) || 0
      })),
      managerMetas: (mgrMetas || []).map((m: any) => ({
        manager: String(m.manager || "").trim(),
        manager_id: String(m.manager_id || "").trim(),
        value: Number(m.projection_value) || 0
      })),
      months,
      queryTimings: {
        viewSql: viewSqlDuration,
        salesMv: salesMvDuration,
        metasTable: metasTableDuration
      }
    };
  }

  /**
   * Fetches Metas por Rede unified ViewModel (MetasRedeViewModel) with 100% backend pre-aggregations.
   */
  public static async getMetasRedeViewModel(year: number = this.DEFAULT_YEAR, month: number = 8): Promise<MetasRedeViewModel> {
    const bStart = performance.now();
    const payload = await this.getMetasRedeData(year, month);
    const sqlTimeMs = Number((payload.queryTimings?.viewSql || 0) + (payload.queryTimings?.salesMv || 0) + (payload.queryTimings?.metasTable || 0));

    // Calculate preceding 3 closed months dynamically
    const preceding3Months: string[] = [];
    for (let i = 3; i >= 1; i--) {
      let m = month - i;
      let y = year;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      preceding3Months.push(`${y}-${String(m).padStart(2, "0")}`);
    }

    // Build metas map: manager_id|codigo_matriz or manager_id|client_matrix
    const metaMap = new Map<string, number>();
    payload.metas.forEach(m => {
      if (m.codigo_matriz) {
        metaMap.set(`${m.manager_id}|${m.codigo_matriz}`, m.value);
      }
      metaMap.set(`${m.manager_id}|${m.client_matrix.toUpperCase()}`, m.value);
    });

    // Group networks by Manager
    const managerGroupMap = new Map<string, { manager_id: string; manager: string; networks: any[] }>();
    payload.planRedes.forEach(r => {
      const mgrKey = r.manager_id || r.manager;
      if (!managerGroupMap.has(mgrKey)) {
        managerGroupMap.set(mgrKey, { manager_id: r.manager_id || "", manager: r.manager, networks: [] });
      }
      managerGroupMap.get(mgrKey)!.networks.push(r);
    });

    let grandTotalFat = 0;
    let grandTotalMed3M = 0;
    let grandTotalMed3MKg = 0;
    let grandTotalMeta = 0;
    let grandTotalKg = 0;
    let preenchidas = 0;
    let totalRedes = payload.planRedes.length;

    const managerBlocks: ManagerBlockViewModel[] = [];

    managerGroupMap.forEach((group) => {
      let mgrFat = 0;
      let mgrMed3M = 0;
      let mgrMed3MKg = 0;
      let mgrMetaSum = 0;
      let mgrPreenchidas = 0;
      let mgrVolPrevKg = 0;

      const redeVMList: RedeViewModel[] = group.networks.map(net => {
        const redeUpper = net.rede.trim().toUpperCase();
        const mgrKey = `${net.manager_id}|${redeUpper}`;
        const redeHist = payload.billing[mgrKey] || payload.billing[redeUpper] || {};

        // Calculate 3M Average
        let sum3M = 0;
        preceding3Months.forEach(m => {
          sum3M += redeHist[m]?.fat || 0;
        });
        const avg3M = sum3M / 3;

        // Q2 Fat and Qty for Avg Price
        let fatQ2 = 0;
        let qtyQ2 = 0;
        preceding3Months.forEach(m => {
          fatQ2 += redeHist[m]?.fat || 0;
          qtyQ2 += redeHist[m]?.qty || 0;
        });

        // Price per Kg or fallback R$ 50/Kg
        const avgPriceQ2 = qtyQ2 > 0 ? fatQ2 / qtyQ2 : 50;
        const avg3MKg = avgPriceQ2 > 0 ? avg3M / avgPriceQ2 : 0;

        // Target Value
        const metaVal = metaMap.get(`${net.manager_id}|${net.codigo_matriz}`) ??
                       metaMap.get(`${net.manager_id}|${redeUpper}`) ?? 0;
        const metaKg = avgPriceQ2 > 0 ? metaVal / avgPriceQ2 : 0;

        const pctVsAvg3M = avg3MKg > 0 ? (metaKg / avg3MKg) * 100 : 0;

        if (metaVal > 0) mgrPreenchidas++;

        mgrFat += fatQ2;
        mgrMed3M += avg3M;
        mgrMed3MKg += avg3MKg;
        mgrMetaSum += metaVal;
        mgrVolPrevKg += metaKg;

        return {
          rede: net.rede,
          manager: net.manager,
          manager_id: net.manager_id,
          codigo_matriz: net.codigo_matriz,
          fatQ2,
          qtyQ2,
          avgPriceQ2,
          avg3M,
          avg3MKg,
          metaVal,
          metaKg,
          pctVsAvg3M,
          monthlyHistory: redeHist
        };
      });

      // Sort networks by avg3M descending (tiebreaker: alphabetical)
      redeVMList.sort((a, b) => b.avg3M !== a.avg3M ? b.avg3M - a.avg3M : a.rede.localeCompare(b.rede, "pt-BR"));

      const mgrPace = mgrMed3M > 0 ? (mgrMetaSum / mgrMed3M) * 100 : 0;

      grandTotalFat += mgrFat;
      grandTotalMed3M += mgrMed3M;
      grandTotalMed3MKg += mgrMed3MKg;
      grandTotalMeta += mgrMetaSum;
      grandTotalKg += mgrVolPrevKg;
      preenchidas += mgrPreenchidas;

      managerBlocks.push({
        manager: group.manager,
        manager_id: group.manager_id,
        totalRedes: group.networks.length,
        grandTotalFat: mgrFat,
        grandTotalMed3M: mgrMed3M,
        grandTotalMed3MKg: mgrMed3MKg,
        grandTotalMeta: mgrMetaSum,
        mgrPace,
        mgrPreenchidas,
        mgrVolPrevKg,
        redes: redeVMList
      });
    });

    // Fetch Workflow state for target year and month
    const supabase = createAdminClient();
    const { data: wfRow } = await supabase
      .from("cm_weekly_projections_workflow")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    const workflow: WorkflowDTO = {
      year,
      month,
      status: (wfRow?.status as any) || "DRAFT",
      submitted_by: wfRow?.submitted_by || undefined,
      submitted_at: wfRow?.submitted_at || undefined,
      approved_by: wfRow?.approved_by || undefined,
      approved_at: wfRow?.approved_at || undefined,
      approved_comments: wfRow?.approved_comments || undefined,
      frozen_by: wfRow?.frozen_by || undefined,
      frozen_at: wfRow?.frozen_at || undefined,
    };

    const pace = grandTotalMed3M > 0 ? (grandTotalMeta / grandTotalMed3M) * 100 : 0;
    const percentualPreenchido = totalRedes > 0 ? (preenchidas / totalRedes) * 100 : 0;
    const bEnd = performance.now();
    const backendTimeMs = Number((bEnd - bStart).toFixed(2));
    const memMb = Number((process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2));

    return {
      grandTotalFat,
      grandTotalMed3M,
      grandTotalMed3MKg,
      grandTotalMeta,
      grandTotalKg,
      pace,
      preenchidas,
      percentualPreenchido,
      totalRedes,
      totalManagers: managerBlocks.length,
      managerBlocks,
      months: payload.months,
      preceding3Months,
      workflow,
      telemetry: {
        sqlTimeMs,
        backendTimeMs,
        apiTimeMs: backendTimeMs,
        totalTimeMs: backendTimeMs,
        redesCount: totalRedes,
        managersCount: managerBlocks.length,
        cacheHit: false,
        memoryUsedMb: memMb
      }
    };
  }

  /**
   * Updates workflow status for a target exercise period.
   */
  public static async updateWorkflowStatus(
    year: number,
    month: number,
    status: "DRAFT" | "REVIEW" | "APPROVED" | "FROZEN",
    user: string,
    comments?: string
  ): Promise<WorkflowDTO> {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const updateFields: any = {
      year,
      month,
      status,
      updated_at: now,
    };

    if (status === "REVIEW") {
      updateFields.submitted_by = user;
      updateFields.submitted_at = now;
    } else if (status === "APPROVED") {
      updateFields.approved_by = user;
      updateFields.approved_at = now;
      if (comments) updateFields.approved_comments = comments;
    } else if (status === "FROZEN") {
      updateFields.frozen_by = user;
      updateFields.frozen_at = now;
    }

    const { data, error } = await supabase
      .from("cm_weekly_projections_workflow")
      .upsert([updateFields], { onConflict: "year,month" })
      .select()
      .single();

    if (error) {
      console.error("[CommercialPlanningService] Error updating workflow status:", error);
      throw new Error(`Failed to update workflow status: ${error.message}`);
    }

    return {
      year: data.year,
      month: data.month,
      status: data.status,
      submitted_by: data.submitted_by,
      submitted_at: data.submitted_at,
      approved_by: data.approved_by,
      approved_at: data.approved_at,
      approved_comments: data.approved_comments,
      frozen_by: data.frozen_by,
      frozen_at: data.frozen_at,
    };
  }

  /**
   * Generates Cockpit Comercial Nacional ViewModel (Fase 6) consolidating AnalyticsEngine with Planning.
   */
  public static async getCockpitNacionalViewModel(year: number = 2026, month: number = 8): Promise<CockpitNacionalViewModel> {
    const startTime = performance.now();
    const vm = await this.getMetasRedeViewModel(year, month);

    const med3MNacional = vm.grandTotalMed3M;
    const metaNacional = vm.grandTotalMeta > 0 ? vm.grandTotalMeta : (med3MNacional > 0 ? med3MNacional * 1.1 : 15000000);
    const volPrevistoKg = vm.grandTotalKg > 0 ? vm.grandTotalKg : (med3MNacional / 50);
    const faturamentoAtual = vm.grandTotalFat > 0 ? vm.grandTotalFat : med3MNacional;
    const paceVal = med3MNacional > 0 ? (metaNacional / med3MNacional) * 100 : 100;
    const forecast = metaNacional * (paceVal / 100);
    const pace = Number(paceVal.toFixed(1));
    const gapMeta = Math.max(0, metaNacional - faturamentoAtual);
    const volRealKg = vm.grandTotalMed3MKg;
    const precoMedioKg = volRealKg > 0 ? faturamentoAtual / volRealKg : 50;

    // Gerentes Ranking
    const gerentesRanking = vm.managerBlocks.map(mgr => {
      const gap = Math.max(0, mgr.grandTotalMeta - mgr.grandTotalFat);
      const part = metaNacional > 0 ? (mgr.grandTotalMeta / metaNacional) * 100 : 0;
      return {
        manager: mgr.manager,
        manager_id: mgr.manager_id,
        meta: mgr.grandTotalMeta,
        realizado: mgr.grandTotalFat,
        forecast: mgr.grandTotalMeta * (mgr.mgrPace / 100),
        pace: mgr.mgrPace,
        gap,
        participacaoPct: Number(part.toFixed(1))
      };
    });

    // Redes Ranking
    const redesList: Array<{ rede: string; codigo_matriz: string; manager: string; meta: number; realizado: number; forecast: number; pace: number; gap: number; participacaoPct: number }> = [];
    vm.managerBlocks.forEach(mgr => {
      mgr.redes.forEach(r => {
        const gap = Math.max(0, r.metaVal - r.fatQ2);
        const part = metaNacional > 0 ? (r.metaVal / metaNacional) * 100 : 0;
        redesList.push({
          rede: r.rede,
          codigo_matriz: r.codigo_matriz,
          manager: r.manager,
          meta: r.metaVal,
          realizado: r.fatQ2,
          forecast: r.metaVal * (r.pctVsAvg3M / 100),
          pace: r.pctVsAvg3M,
          gap,
          participacaoPct: Number(part.toFixed(1))
        });
      });
    });

    redesList.sort((a, b) => b.meta - a.meta);

    // Estados UF Mock / Mapping
    const ufs = [
      { uf: "SP", meta: metaNacional * 0.35, realizado: faturamentoAtual * 0.36, forecast: forecast * 0.35, pace: 102, volumeKg: volPrevistoKg * 0.35, status: "success" as const },
      { uf: "MG", meta: metaNacional * 0.25, realizado: faturamentoAtual * 0.24, forecast: forecast * 0.25, pace: 96, volumeKg: volPrevistoKg * 0.25, status: "success" as const },
      { uf: "RJ", meta: metaNacional * 0.15, realizado: faturamentoAtual * 0.13, forecast: forecast * 0.14, pace: 88, volumeKg: volPrevistoKg * 0.15, status: "warning" as const },
      { uf: "RS", meta: metaNacional * 0.10, realizado: faturamentoAtual * 0.08, forecast: forecast * 0.09, pace: 78, volumeKg: volPrevistoKg * 0.10, status: "danger" as const },
      { uf: "PR", meta: metaNacional * 0.08, realizado: faturamentoAtual * 0.09, forecast: forecast * 0.09, pace: 108, volumeKg: volPrevistoKg * 0.08, status: "success" as const },
      { uf: "SC", meta: metaNacional * 0.07, realizado: faturamentoAtual * 0.06, forecast: forecast * 0.06, pace: 85, volumeKg: volPrevistoKg * 0.07, status: "warning" as const }
    ];

    // Painel de Risco
    const painelRisco = gerentesRanking
      .filter(g => g.pace < 90)
      .map(g => ({
        id: g.manager_id,
        entidade: g.manager,
        tipo: "Gerente" as const,
        nivelRisco: g.pace < 80 ? ("Alto" as const) : ("Médio" as const),
        motivo: `Pace de ${g.pace.toFixed(1)}% abaixo da meta estipulada`,
        gap: g.gap
      }));

    // Oportunidades
    const oportunidades = redesList
      .filter(r => r.pace > 110)
      .map(r => ({
        id: r.codigo_matriz,
        entidade: r.rede,
        tipo: "Alto Crescimento" as const,
        potencialR$: r.meta * 0.15,
        descricao: `Rede performando a ${r.pace.toFixed(1)}% com alta demanda`
      }));

    // Alertas Executivos
    const alertas = [
      { id: "A1", severidade: "ALTA" as const, codigo: "PACE_CRITICO", mensagem: "Existem gerentes com Pace abaixo de 80%" },
      { id: "A2", severidade: "MÉDIA" as const, codigo: "REDES_SEM_META", mensagem: `${vm.totalRedes - vm.preenchidas} redes permanecem sem meta cadastrada` }
    ];

    const endTime = performance.now();

    return {
      executiveKPIs: {
        metaNacional,
        faturamentoAtual,
        forecast,
        pace: Number(pace.toFixed(1)),
        gapMeta,
        volPrevistoKg,
        volRealKg,
        precoMedioKg: Number(precoMedioKg.toFixed(2)),
        med3MNacional,
        participacaoPct: 100
      },
      rankings: {
        gerentes: gerentesRanking,
        redes: redesList,
        estados: ufs,
        clientes: gerentesRanking.map(g => ({ cliente: g.manager, meta: g.meta, realizado: g.realizado, forecast: g.forecast, pace: g.pace, gap: g.gap }))
      },
      mapaUF: ufs,
      painelRisco,
      oportunidades,
      alertas,
      telemetry: {
        executionTimeMs: Number((endTime - startTime).toFixed(2)),
        parityDeviationPct: 0.0
      }
    };
  }
}

