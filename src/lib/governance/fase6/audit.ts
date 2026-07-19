import { createAdminClient } from "@/lib/supabase/admin";
import { logGovernanceError } from "../logging";
import { ERROR_CODES } from "../constants";
import { FinancialMovement } from "./conciliation";

export interface AuditResult {
  acaoId: string;
  clientCode: string;
  plannedValue: number;
  plannedStart: string;
  plannedEnd: string;
  praticadoValue: number;
  deviationValue: number;
  deviationPercent: number;
  periodOverlapStatus: "IN_RANGE" | "PARTIAL" | "OUT_OF_RANGE";
  auditStatus: "CONFORME" | "DIVERGENTE";
  auditedAt: string;
}

/**
 * Sprint 6.3 Motor de Auditoria Operacional
 * Compares the consolidated financial movement (from Motor de Conciliação)
 * against the planned campaign action values and dates from `cm_acoes_investimento`.
 * 
 * CRITICAL RULE: Consumes exclusively the consolidated output of the conciliation engine,
 * with NO direct database queries to faturamento tables.
 */
export async function auditVigencia(
  financialMovement: FinancialMovement,
  plannedAcaoId: string
): Promise<AuditResult> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch action details from cm_acoes_investimento
    const { data: acao, error } = await supabase
      .from("cm_acoes_investimento")
      .select("id, data_inicio, data_fim, valor_investimento")
      .eq("id", plannedAcaoId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!acao) {
      throw new Error(`Ação de investimento ${plannedAcaoId} não localizada.`);
    }

    const plannedValue = Number(acao.valor_investimento || 0);
    const plannedStart = String(acao.data_inicio || "");
    const plannedEnd = String(acao.data_fim || "");

    const praticadoValue = financialMovement.praticadoValue;
    const deviationValue = praticadoValue - plannedValue;
    const deviationPercent = plannedValue > 0
      ? Math.round((Math.abs(deviationValue) / plannedValue) * 100)
      : 0;

    // 2. Evaluate temporal overlap between planned and real faturamento period
    const plannedStartSec = new Date(plannedStart).getTime();
    const plannedEndSec = new Date(plannedEnd).getTime();
    const realStartSec = new Date(financialMovement.periodStart).getTime();
    const realEndSec = new Date(financialMovement.periodEnd).getTime();

    let periodOverlapStatus: "IN_RANGE" | "PARTIAL" | "OUT_OF_RANGE" = "OUT_OF_RANGE";

    if (realStartSec >= plannedStartSec && realEndSec <= plannedEndSec) {
      // Real period is completely inside planned period
      periodOverlapStatus = "IN_RANGE";
    } else if (
      (realStartSec >= plannedStartSec && realStartSec <= plannedEndSec) ||
      (realEndSec >= plannedStartSec && realEndSec <= plannedEndSec) ||
      (realStartSec <= plannedStartSec && realEndSec >= plannedEndSec)
    ) {
      // Overlaps partially
      periodOverlapStatus = "PARTIAL";
    } else {
      // Out of range completely
      periodOverlapStatus = "OUT_OF_RANGE";
    }

    // 3. Determine overall audit status (CONFORME if deviation is within a nominal tolerance)
    const auditStatus = deviationPercent === 0 && periodOverlapStatus === "IN_RANGE"
      ? "CONFORME"
      : "DIVERGENTE";

    return {
      acaoId: plannedAcaoId,
      clientCode: financialMovement.clientCode,
      plannedValue,
      plannedStart,
      plannedEnd,
      praticadoValue,
      deviationValue,
      deviationPercent,
      periodOverlapStatus,
      auditStatus,
      auditedAt: new Date().toISOString()
    };

  } catch (err: any) {
    logGovernanceError("AUDIT_ENGINE", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message, err);
    throw err;
  }
}
