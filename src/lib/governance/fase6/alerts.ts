import { AuditResult } from "./audit";
import { FinancialRecord } from "./conciliation";

export interface Alert {
  type: "Informativo" | "Atenção" | "Crítico" | "Bloqueante";
  source: "FINANCIAL" | "TEMPORAL" | "GOVERNANCE" | "DATA_QUALITY";
  title: string;
  description: string;
  code: string;
  timestamp: string;
}

export interface AlertGovernanceSettings {
  financeTolerancePercent: number; // default: 5%
  temporalToleranceDays: number;  // default: 7 days
}

/**
 * Sprint 6.4 Motor de Alertas e Severidades
 * Evaluates the results of the Motor de Auditoria and applies classification
 * rules based on governance parameters.
 * 
 * CRITICAL RULE: This component is exclusively responsible for severity classification.
 * No audit comparison logic is performed here.
 */
export async function classifyAlerts(
  auditResult: AuditResult,
  records: FinancialRecord[],
  settings: AlertGovernanceSettings = { financeTolerancePercent: 5, temporalToleranceDays: 7 }
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const nowStr = new Date().toISOString();

  // 1. Validate Bloqueante Level Rules
  if (auditResult.plannedValue <= 0) {
    alerts.push({
      type: "Bloqueante",
      source: "GOVERNANCE",
      title: "Orçamento Inválido",
      description: "Orçamento planejado inválido (igual ou menor que zero) para a ação selecionada.",
      code: "ALERT_ZERO_BUDGET",
      timestamp: nowStr
    });
  }

  // Check for duplicate invoice numbers in the consolidated records
  const invoiceNumbers = records.map(r => r.nro_nota).filter(n => n && n !== "");
  const duplicates = invoiceNumbers.filter((item, index) => invoiceNumbers.indexOf(item) !== index);
  if (duplicates.length > 0) {
    alerts.push({
      type: "Bloqueante",
      source: "DATA_QUALITY",
      title: "Duplicidade Fiscal",
      description: `Duplicidade de notas fiscais detectada: Notas [${Array.from(new Set(duplicates)).join(", ")}].`,
      code: "ALERT_DUPLICATE_INVOICES",
      timestamp: nowStr
    });
  }

  // 2. Validate Crítico Level Rules
  if (auditResult.deviationPercent >= settings.financeTolerancePercent) {
    alerts.push({
      type: "Crítico",
      source: "FINANCIAL",
      title: "Estouro de Verba Crítico",
      description: `Desvio financeiro crítico excedeu a tolerância de ${settings.financeTolerancePercent}% (Desvio real: ${auditResult.deviationPercent}%).`,
      code: "ALERT_FINANCIAL_CRITICAL",
      timestamp: nowStr
    });
  }

  if (auditResult.periodOverlapStatus === "OUT_OF_RANGE") {
    alerts.push({
      type: "Crítico",
      source: "TEMPORAL",
      title: "Fora de Vigência Severo",
      description: "Desvio temporal crítico. O período de faturamento real está totalmente fora da vigência planejada da ação.",
      code: "ALERT_TEMPORAL_CRITICAL",
      timestamp: nowStr
    });
  }

  // 3. Validate Atenção Level Rules
  if (
    auditResult.deviationPercent >= 1.0 &&
    auditResult.deviationPercent < settings.financeTolerancePercent
  ) {
    alerts.push({
      type: "Atenção",
      source: "FINANCIAL",
      title: "Desvio Financeiro Moderado",
      description: `Desvio financeiro moderado detectado dentro do limite de tolerância (Desvio real: ${auditResult.deviationPercent}%).`,
      code: "ALERT_FINANCIAL_ATTENTION",
      timestamp: nowStr
    });
  }

  if (auditResult.periodOverlapStatus === "PARTIAL") {
    alerts.push({
      type: "Atenção",
      source: "TEMPORAL",
      title: "Vigência Parcial",
      description: "Desvio temporal moderado. O faturamento real ocorreu parcialmente fora das datas vigentes da ação.",
      code: "ALERT_TEMPORAL_ATTENTION",
      timestamp: nowStr
    });
  }

  // 4. Validate Informativo Level Rules
  if (auditResult.deviationPercent > 0 && auditResult.deviationPercent < 1.0) {
    alerts.push({
      type: "Informativo",
      source: "FINANCIAL",
      title: "Variação Financeira Marginal",
      description: `Pequena variação financeira marginal de ${auditResult.deviationPercent}% detectada.`,
      code: "ALERT_FINANCIAL_INFO",
      timestamp: nowStr
    });
  }

  return alerts;
}
