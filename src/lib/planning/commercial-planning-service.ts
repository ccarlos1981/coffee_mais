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

export interface MetasRedePayloadDTO {
  planRedes: { rede: string; manager: string; manager_id?: string; codigo_matriz?: string }[];
  billing: Record<string, Record<string, MonthlyBillingDTO>>;
  metas: { manager: string; client_matrix: string; value: number }[];
  managerMetas: { manager: string; value: number }[];
  months: string[];
  queryTimings?: {
    viewSql: number;
    salesMv: number;
    metasTable: number;
  };
}

/**
 * CommercialPlanningService
 * Single Source of Truth Service for Commercial Planning (Metas por Rede).
 * 
 * Domain Rules:
 * 1. Fetches official planejáveis networks from `vw_redes_planejaveis_oficiais`.
 * 2. Fetches aggregated billing directly from PostgreSQL (`mv_vendas_cliente_mensal` aggregated by manager_id, rede, mes).
 * 3. Prevents massive client-side data loading (returns ~200 aggregated rows instead of 122k raw rows).
 * 4. Prevents key overwrites using composite & accumulated billing dictionary keys.
 */
export class CommercialPlanningService {
  private static readonly DEFAULT_YEAR = 2026;
  private static readonly DEFAULT_MONTHS = [
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07"
  ];

  /**
   * Fetches Metas por Rede payload for a target year.
   */
  public static async getMetasRedeData(year: number = this.DEFAULT_YEAR): Promise<MetasRedePayloadDTO> {
    const supabase = createAdminClient();
    const months = this.DEFAULT_MONTHS;

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
    const salesMvDuration = Number((q2End - q2Start).toFixed(2));

    if (salesError) {
      console.error("[CommercialPlanningService] Error fetching sales history:", salesError);
      throw new Error(`Failed to fetch sales history: ${salesError.message}`);
    }

    // 3. Map aggregated billing to the public DTO expected by frontend without overwriting
    const managerRedeBilling: Record<string, Record<string, MonthlyBillingDTO>> = {};
    const billing: Record<string, Record<string, MonthlyBillingDTO>> = {};

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

    // 4. Query 3: Fetch weekly projections / META targets (August)
    const q3Start = performance.now();
    const { data: metaData } = await supabase
      .from("cm_weekly_projections")
      .select("manager, client_matrix, value")
      .eq("kpi", "META")
      .eq("year", year)
      .eq("month", 8)
      .neq("client_matrix", "_TOTAL_");

    const { data: mgrMetas } = await supabase
      .from("cm_weekly_projections")
      .select("manager, value")
      .eq("kpi", "META")
      .eq("client_matrix", "_TOTAL_")
      .eq("year", year)
      .eq("month", 8);

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
        client_matrix: String(m.client_matrix || "").trim(),
        value: Number(m.value) || 0
      })),
      managerMetas: (mgrMetas || []).map((m: any) => ({
        manager: String(m.manager || "").trim(),
        value: Number(m.value) || 0
      })),
      months,
      queryTimings: {
        viewSql: viewSqlDuration,
        salesMv: salesMvDuration,
        metasTable: metasTableDuration
      }
    };
  }
}
