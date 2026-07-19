import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import { logGovernanceError } from "../logging";
import { ERROR_CODES } from "../constants";
import { consolidateFinancialMovement, FinancialMovement, FinancialRecord } from "./conciliation";
import { auditVigencia, AuditResult } from "./audit";
import { classifyAlerts, Alert } from "./alerts";

export interface ActionAuditDetail {
  acaoId: string;
  plannedValue: number;
  plannedStart: string;
  plannedEnd: string;
  praticadoValue: number;
  deviationPercent: number;
  auditStatus: "CONFORME" | "DIVERGENTE";
  alerts: Alert[];
  financialMovement: {
    salesValue: number;
    bonificationValue: number;
    devolutionValue: number;
    praticadoValue: number;
    records: FinancialRecord[];
  };
}

export interface ConciliationResult {
  executionId: string;
  matrixCode: string;
  periodStart: string;
  periodEnd: string;
  processedAt: string;
  executedBy: string;
  summary: {
    actionsAudited: number;
    actionsConforme: number;
    actionsDivergente: number;
    complianceRate: number;
    totalValuePlanned: number;
    totalValuePraticado: number;
    deviationPercent: number;
    alertsCount: number;
  };
  details: {
    financialMovement: FinancialMovement;
    actions: ActionAuditDetail[];
  };
}

/**
 * Sprint 6.6 Orquestrador com Multi-Ações e KPIs
 * Coordinates the execution of Phase 6 motors.
 */
export async function runConciliation(
  matrixCode: string,
  periodStart: string,
  periodEnd: string,
  userId: string,
  plannedAcaoId?: string
): Promise<ConciliationResult> {
  const adminClient = createAdminClient();
  const executionId = randomUUID();

  try {
    // 1. Verify admin role before starting
    const { data: adminCheck } = await adminClient
      .from("cm_user_profiles")
      .select("approved, role")
      .eq("id", userId)
      .maybeSingle();

    if (!adminCheck || !adminCheck.approved) {
      throw new Error("Usuário não possui privilégios de governança ativos.");
    }

    // 2. Fetch actions to audit
    let targetAcoes: any[] = [];
    if (plannedAcaoId) {
      const { data: singleAcao } = await adminClient
        .from("cm_acoes_investimento")
        .select("id, data_inicio, data_fim, valor_investimento")
        .eq("id", plannedAcaoId)
        .maybeSingle();
      if (singleAcao) targetAcoes = [singleAcao];
    } else {
      // Find all actions for this matrix code that overlap with the period
      const { data: listAcoes } = await adminClient
        .from("cm_acoes_investimento")
        .select("id, data_inicio, data_fim, valor_investimento")
        .eq("codigo_matriz", matrixCode)
        .gte("data_fim", periodStart)
        .lte("data_inicio", periodEnd)
        .order("data_inicio", { ascending: true });
      if (listAcoes) targetAcoes = listAcoes;
    }

    // If no actions are found, try fallback lookup to avoid blocking the UI
    if (targetAcoes.length === 0) {
      const { data: fallbackAcoes } = await adminClient
        .from("cm_acoes_investimento")
        .select("id, data_inicio, data_fim, valor_investimento")
        .eq("codigo_matriz", matrixCode)
        .order("data_inicio", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1);
      if (fallbackAcoes && fallbackAcoes.length > 0) {
        targetAcoes = fallbackAcoes;
      }
    }

    if (targetAcoes.length === 0) {
      throw new Error(`Nenhuma ação de investimento ativa localizada para a matriz ${matrixCode} no período selecionado.`);
    }

    // 3. Consolidate overall billing movement for the matrix and period (Only 1 query to database)
    const overallMovement = await consolidateFinancialMovement(matrixCode, periodStart, periodEnd);

    // 4. Run audit and alerts for each target action
    const actionsDetails: ActionAuditDetail[] = [];
    let totalValuePlanned = 0;
    let totalValuePraticado = 0;
    let totalAlerts = 0;
    let actionsConforme = 0;
    let actionsDivergente = 0;

    for (const acao of targetAcoes) {
      const acaoStart = acao.data_inicio;
      const acaoEnd = acao.data_fim;

      // Segment faturamento records locally for this action's specific date range
      const segmentRecords = overallMovement.records.filter(
        r => r.dt_faturamento >= acaoStart && r.dt_faturamento <= acaoEnd
      );

      const salesValue = segmentRecords
        .filter(r => r.cod_top !== "1117" && r.cod_top !== "1200" && r.cod_top !== "1201")
        .reduce((sum, r) => sum + r.valor_liquido, 0);

      const bonificationValue = segmentRecords
        .filter(r => r.cod_top === "1117")
        .reduce((sum, r) => sum + r.valor_liquido, 0);

      const devolutionValue = segmentRecords
        .filter(r => r.cod_top === "1200" || r.cod_top === "1201")
        .reduce((sum, r) => sum + Math.abs(r.valor_liquido), 0);

      const praticadoValue = salesValue + bonificationValue - devolutionValue;

      const actionMovement: FinancialMovement = {
        clientCode: overallMovement.clientCode,
        periodStart: acaoStart,
        periodEnd: acaoEnd,
        records: segmentRecords,
        salesValue,
        bonificationValue,
        devolutionValue,
        praticadoValue
      };

      // Call Motor de Auditoria
      const auditResult = await auditVigencia(actionMovement, acao.id);

      // Call Motor de Alertas
      const alerts = await classifyAlerts(auditResult, segmentRecords);

      if (auditResult.auditStatus === "CONFORME") {
        actionsConforme++;
      } else {
        actionsDivergente++;
      }

      totalValuePlanned += auditResult.plannedValue;
      totalValuePraticado += praticadoValue;
      totalAlerts += alerts.length;

      actionsDetails.push({
        acaoId: acao.id,
        plannedValue: auditResult.plannedValue,
        plannedStart: acaoStart,
        plannedEnd: acaoEnd,
        praticadoValue,
        deviationPercent: auditResult.deviationPercent,
        auditStatus: auditResult.auditStatus,
        alerts,
        financialMovement: {
          salesValue,
          bonificationValue,
          devolutionValue,
          praticadoValue,
          records: segmentRecords
        }
      });
    }

    const actionsAudited = targetAcoes.length;
    const complianceRate = actionsAudited > 0 ? Math.round((actionsConforme / actionsAudited) * 100) : 0;
    const deviationPercent = totalValuePlanned > 0
      ? Math.round((Math.abs(totalValuePraticado - totalValuePlanned) / totalValuePlanned) * 100)
      : 0;

    const result: ConciliationResult = {
      executionId,
      matrixCode,
      periodStart,
      periodEnd,
      processedAt: new Date().toISOString(),
      executedBy: userId,
      summary: {
        actionsAudited,
        actionsConforme,
        actionsDivergente,
        complianceRate,
        totalValuePlanned,
        totalValuePraticado,
        deviationPercent,
        alertsCount: totalAlerts
      },
      details: {
        financialMovement: overallMovement,
        actions: actionsDetails
      }
    };

    return result;

  } catch (err: any) {
    logGovernanceError("ORCHESTRATOR_RUN", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message, err);
    throw err;
  }
}
