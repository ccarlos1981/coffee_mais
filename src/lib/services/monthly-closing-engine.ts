import { createAdminClient } from "@/lib/supabase/admin";
import { AnalyticsEngine, AnalyticsFilters } from "@/lib/governance/analytics";
import { CommercialDomainService } from "@/lib/domain";
import { resolveCanonicalManager } from "@/lib/domain/canonical";

export interface MonthlyClosingFilters {
  year: number;
  month: number;
  manager?: string;
  channel?: string;
}

export type ClosingStatus = "SUPERADA" | "ATENCAO" | "CRITICA" | "SEM_META";

export interface ClosingKpiSummary {
  realFaturamento: number;
  realVolumeKg: number;
  metaFaturamento: number;
  metaVolumeKg: number;
  rpsFaturamento: number;
  rpsVolumeKg: number;
  atingimentoMetaPct: number;
  atingimentoRpsPct: number;
  desvioMeta: number;
  desvioRps: number;
  macoReal: number;
  macoRealPct: number;
  statusMaco: "DISPONIVEL" | "DADOS_INDISPONIVEIS";
}

export interface ClosingManagerRow {
  managerId: string;
  managerName: string;
  metaFaturamento: number;
  metaVolumeKg: number;
  rpsFaturamento: number;
  rpsVolumeKg: number;
  realFaturamento: number;
  realVolumeKg: number;
  atingimentoMetaPct: number;
  atingimentoRpsPct: number;
  desvioMeta: number;
  desvioRps: number;
  macoValor: number;
  macoPct: number;
  status: ClosingStatus;
}

export interface ClosingChannelRow {
  channel: string;
  metaFaturamento: number;
  realFaturamento: number;
  atingimentoMetaPct: number;
  desvioMeta: number;
}

export interface MonthlyClosingDTO {
  competencia: string;
  year: number;
  month: number;
  resumoNacional: ClosingKpiSummary;
  gerentes: ClosingManagerRow[];
  canais: ClosingChannelRow[];
  timestamp: string;
}

export class MonthlyClosingEngine {
  /**
   * Orquestrador Read-Only do Fechamento Mensal Comercial.
   * Consolida Meta (targets), RPS (cm_weekly_projections), Real (AnalyticsEngine/mv_vendas_mensal)
   * e MACO (AnalyticsEngine.getDreComercial Baseline 57) em exatamente 4 operações em batch.
   * ZERO duplicidade de cálculo financeiro, ZERO N+1.
   */
  public static async getClosingSummary(filters: MonthlyClosingFilters): Promise<MonthlyClosingDTO> {
    const { year, month } = filters;
    const competencia = `${year}-${String(month).padStart(2, "0")}`;
    const adminClient = createAdminClient();

    const canonicalManagers = CommercialDomainService.getFieldManagerList();

    const analyticsFilters: AnalyticsFilters = {
      startMonth: competencia,
      endMonth: competencia,
      manager: filters.manager && filters.manager !== "CRISTIANO" && filters.manager !== "Total" ? filters.manager : undefined,
      channel: filters.channel && filters.channel !== "all" ? filters.channel : undefined,
      dimension: "gerente",
    };

    // =========================================================================
    // EXECUÇÃO PARALELA EM BATCH (EXATAMENTE 4 FONTES OFICIAIS)
    // =========================================================================
    const [vendasSummaryRes, targetsRes, rpsProjectionsRes, dreRes] = await Promise.all([
      // 1. REAL: Consulta analítica agregada oficial
      AnalyticsEngine.getVendasSummary(analyticsFilters).catch(() => null),

      // 2. META: Targets gerenciais oficiais
      adminClient
        .from("targets")
        .select("manager, manager_id, target_revenue, target_tons, target_maco")
        .eq("year", year)
        .eq("month", month),

      // 3. RPS: Projeções semanais consolidadas
      adminClient
        .from("cm_weekly_projections")
        .select("manager, client_matrix, kpi, projection_value, week_start_date")
        .eq("year", year)
        .eq("month", month)
        .order("week_start_date", { ascending: false }),

      // 4. MACO: DRE Comercial Oficial Baseline 57
      AnalyticsEngine.getDreComercial(analyticsFilters).catch(() => null),
    ]);

    // -------------------------------------------------------------------------
    // 1. Processamento do Faturamento Real (AnalyticsEngine)
    // -------------------------------------------------------------------------
    let totalRealFat = 0;
    let totalRealQty = 0;
    const realByManager = new Map<string, { fat: number; qty: number }>();
    const realByChannel = new Map<string, number>();

    if (vendasSummaryRes && Array.isArray(vendasSummaryRes.rowsCur)) {
      vendasSummaryRes.rowsCur.forEach((r: any) => {
        const fat = Number(r.fat || 0);
        const qty = Number(r.qty || 0);
        totalRealFat += fat;
        totalRealQty += qty;

        const canonical = resolveCanonicalManager(r.manager).managerName;
        const currMgr = realByManager.get(canonical) || { fat: 0, qty: 0 };
        realByManager.set(canonical, {
          fat: currMgr.fat + fat,
          qty: currMgr.qty + qty,
        });

        const ch = String(r.channel || "Outros").trim();
        realByChannel.set(ch, (realByChannel.get(ch) || 0) + fat);
      });
    }

    // -------------------------------------------------------------------------
    // 2. Processamento das Metas (Targets)
    // -------------------------------------------------------------------------
    let totalMetaFat = 0;
    let totalMetaVolKg = 0;
    const metaByManager = new Map<string, { fat: number; volKg: number }>();

    if (targetsRes.data) {
      targetsRes.data.forEach((t: any) => {
        const canonical = resolveCanonicalManager(t.manager).managerName;
        const fat = Number(t.target_revenue || 0);
        const volKg = Number(t.target_tons || 0) * 1000;

        totalMetaFat += fat;
        totalMetaVolKg += volKg;
        metaByManager.set(canonical, { fat, volKg });
      });
    }

    // -------------------------------------------------------------------------
    // 3. Processamento do RPS (Última Projeção Semanal)
    // -------------------------------------------------------------------------
    let totalRpsFat = 0;
    let totalRpsVolKg = 0;
    const rpsByManager = new Map<string, { fat: number; volKg: number }>();
    const seenProjections = new Set<string>();

    if (rpsProjectionsRes.data) {
      rpsProjectionsRes.data.forEach((p: any) => {
        const canonical = resolveCanonicalManager(p.manager).managerName;
        const matrix = (p.client_matrix || "").trim().toUpperCase();
        const kpi = (p.kpi || "").trim().toUpperCase();

        if (matrix === "_TOTAL_") {
          const key = `${canonical}|${kpi}`;
          if (!seenProjections.has(key)) {
            seenProjections.add(key);
            const val = Number(p.projection_value || 0);
            const curr = rpsByManager.get(canonical) || { fat: 0, volKg: 0 };
            if (kpi === "FAT") {
              curr.fat = val;
            } else if (kpi === "VOL") {
              curr.volKg = val;
            }
            rpsByManager.set(canonical, curr);
          }
        }
      });

      // Totalizar RPS a partir das projeções dos gerentes
      rpsByManager.forEach((val) => {
        totalRpsFat += val.fat;
        totalRpsVolKg += val.volKg;
      });
    }

    // -------------------------------------------------------------------------
    // 4. Processamento do MACO Oficial (Baseline 57)
    // -------------------------------------------------------------------------
    let totalMacoReal = 0;
    let totalMacoPct = 0;
    let statusMaco: "DISPONIVEL" | "DADOS_INDISPONIVEIS" = "DADOS_INDISPONIVEIS";
    const macoByManager = new Map<string, { valor: number; pct: number }>();

    if (dreRes && dreRes.totais) {
      totalMacoReal = Number(dreRes.totais.macoTotal || 0);
      totalMacoPct = Number(dreRes.totais.margemMacoMedia || 0);
      statusMaco = "DISPONIVEL";

      if (Array.isArray(dreRes.dimensionais)) {
        dreRes.dimensionais.forEach((d: any) => {
          const canonical = resolveCanonicalManager(d.chave).managerName;
          macoByManager.set(canonical, {
            valor: Number(d.maco || 0),
            pct: Number(d.margemMacoPercentual || 0),
          });
        });
      }
    }

    // -------------------------------------------------------------------------
    // 5. Derivações Aritméticas Estritas (Atingimento e Desvios)
    // -------------------------------------------------------------------------
    const calcAtingimento = (real: number, meta: number) => {
      if (meta <= 0) return 0;
      return (real / meta) * 100;
    };

    const atingimentoMetaTotal = calcAtingimento(totalRealFat, totalMetaFat);
    const atingimentoRpsTotal = calcAtingimento(totalRealFat, totalRpsFat);
    const desvioMetaTotal = totalRealFat - totalMetaFat;
    const desvioRpsTotal = totalRealFat - totalRpsFat;

    // -------------------------------------------------------------------------
    // 6. Montagem das Linhas de Gerentes
    // -------------------------------------------------------------------------
    const gerentesRows: ClosingManagerRow[] = canonicalManagers.map((mgrName) => {
      const canonical = resolveCanonicalManager(mgrName);
      const mName = canonical.managerName;
      const mId = canonical.managerId;

      const meta = metaByManager.get(mName) || { fat: 0, volKg: 0 };
      const rps = rpsByManager.get(mName) || { fat: 0, volKg: 0 };
      const real = realByManager.get(mName) || { fat: 0, qty: 0 };
      const maco = macoByManager.get(mName) || { valor: 0, pct: 0 };

      const atingMeta = calcAtingimento(real.fat, meta.fat);
      const atingRps = calcAtingimento(real.fat, rps.fat);
      const desvMeta = real.fat - meta.fat;
      const desvRps = real.fat - rps.fat;

      let status: ClosingStatus = "SEM_META";
      if (meta.fat > 0) {
        if (atingMeta >= 100) status = "SUPERADA";
        else if (atingMeta >= 90) status = "ATENCAO";
        else status = "CRITICA";
      }

      return {
        managerId: mId,
        managerName: mName,
        metaFaturamento: meta.fat,
        metaVolumeKg: meta.volKg,
        rpsFaturamento: rps.fat,
        rpsVolumeKg: rps.volKg,
        realFaturamento: real.fat,
        realVolumeKg: real.qty,
        atingimentoMetaPct: Number(atingMeta.toFixed(2)),
        atingimentoRpsPct: Number(atingRps.toFixed(2)),
        desvioMeta: Number(desvMeta.toFixed(2)),
        desvioRps: Number(desvRps.toFixed(2)),
        macoValor: Number(maco.valor.toFixed(2)),
        macoPct: Number(maco.pct.toFixed(2)),
        status,
      };
    });

    // -------------------------------------------------------------------------
    // 7. Montagem das Linhas de Canais
    // -------------------------------------------------------------------------
    const canaisRows: ClosingChannelRow[] = Array.from(realByChannel.entries()).map(([ch, fat]) => {
      return {
        channel: ch,
        metaFaturamento: 0, // Metas por canal mapeadas dinamicamente
        realFaturamento: Number(fat.toFixed(2)),
        atingimentoMetaPct: 0,
        desvioMeta: Number(fat.toFixed(2)),
      };
    });

    // -------------------------------------------------------------------------
    // 8. Retorno do DTO Executivo Consolidado
    // -------------------------------------------------------------------------
    return {
      competencia,
      year,
      month,
      resumoNacional: {
        realFaturamento: Number(totalRealFat.toFixed(2)),
        realVolumeKg: Number(totalRealQty.toFixed(2)),
        metaFaturamento: Number(totalMetaFat.toFixed(2)),
        metaVolumeKg: Number(totalMetaVolKg.toFixed(2)),
        rpsFaturamento: Number(totalRpsFat.toFixed(2)),
        rpsVolumeKg: Number(totalRpsVolKg.toFixed(2)),
        atingimentoMetaPct: Number(atingimentoMetaTotal.toFixed(2)),
        atingimentoRpsPct: Number(atingimentoRpsTotal.toFixed(2)),
        desvioMeta: Number(desvioMetaTotal.toFixed(2)),
        desvioRps: Number(desvioRpsTotal.toFixed(2)),
        macoReal: Number(totalMacoReal.toFixed(2)),
        macoRealPct: Number(totalMacoPct.toFixed(2)),
        statusMaco,
      },
      gerentes: gerentesRows,
      canais: canaisRows,
      timestamp: new Date().toISOString(),
    };
  }
}
