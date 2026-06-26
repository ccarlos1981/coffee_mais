import { createAdminClient } from "@/lib/supabase/admin";

export interface CompanyKPIConfig {
  id: string;
  kpi_code: string;
  weight: number;
  threshold_low: number;
  threshold_medium: number;
  threshold_high: number;
  target_value: number;
  is_enabled: boolean;
}

export interface GovernancePolicies {
  ai_autonomy_level: "MANUAL" | "ASSISTED" | "SEMI_AUTONOMOUS" | "FULLY_AUTONOMOUS";
  min_confidence_to_act: number;
  require_human_approval: boolean;
  max_discount_allowed: number;
  emergency_ai_stop: boolean;
  max_kpi_weight_shift: number;
}

/**
 * Loads company specific KPI configurations.
 */
export async function getCompanyKPIConfig(companyId: string): Promise<CompanyKPIConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cm_company_kpi_config")
    .select(`
      id,
      kpi_code,
      weight,
      threshold_low,
      threshold_medium,
      threshold_high,
      target_value,
      is_enabled
    `)
    .eq("company_id", companyId);

  if (error) {
    console.error(`Error loading KPI config for company ${companyId}:`, error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    kpi_code: row.kpi_code,
    weight: Number(row.weight || 0),
    threshold_low: Number(row.threshold_low || 0),
    threshold_medium: Number(row.threshold_medium || 0),
    threshold_high: Number(row.threshold_high || 0),
    target_value: Number(row.target_value || 0),
    is_enabled: Boolean(row.is_enabled)
  }));
}

/**
 * Loads AI governance policies for the company.
 */
export async function getAIGovernancePolicies(companyId: string): Promise<GovernancePolicies> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cm_ai_governance_policy")
    .select("policy_key, policy_value")
    .eq("company_id", companyId);

  // Default values matching prompt guidelines
  const policies: GovernancePolicies = {
    ai_autonomy_level: "SEMI_AUTONOMOUS",
    min_confidence_to_act: 80,
    require_human_approval: true,
    max_discount_allowed: 15,
    emergency_ai_stop: false,
    max_kpi_weight_shift: 5
  };

  if (error) {
    console.error(`Error loading policies for company ${companyId}:`, error);
    return policies;
  }

  data?.forEach(row => {
    const val = row.policy_value;
    if (row.policy_key === "ai_autonomy_level") {
      policies.ai_autonomy_level = val as "FULL" | "SUPERVISED" | "MANUAL";
    } else if (row.policy_key === "min_confidence_to_act") {
      policies.min_confidence_to_act = Number(val);
    } else if (row.policy_key === "require_human_approval") {
      policies.require_human_approval = val === true || val === "true";
    } else if (row.policy_key === "max_discount_allowed") {
      policies.max_discount_allowed = Number(val);
    } else if (row.policy_key === "emergency_ai_stop") {
      policies.emergency_ai_stop = val === true || val === "true";
    } else if (row.policy_key === "max_kpi_weight_shift") {
      policies.max_kpi_weight_shift = Number(val);
    }
  });

  return policies;
}

/**
 * Validates an AI decision recommendation against governance policies.
 * Persists validation result in cm_ai_decision_log.
 */
export async function validateAIDecision(
  recommendation: {
    recommendation_type: string;
    recommendation_confidence: number;
    recommended_action?: Record<string, unknown>;
    entity_id: string;
    entity_type: string;
  },
  companyId: string
): Promise<{ approved: boolean; reason: string; badge: string }> {
  const supabase = createAdminClient();
  const policies = await getAIGovernancePolicies(companyId);

  const type = recommendation.recommendation_type;
  const confidence = recommendation.recommendation_confidence;
  const discount = Number(recommendation.recommended_action?.discount_percent || 0);

  let approved = true;
  let reason = "Decisão aprovada automaticamente pelas regras de governança.";
  let badge = "Auto Approved";

  // 1. Check Global emergency AI stop
  if (policies.emergency_ai_stop) {
    approved = false;
    reason = "Parada emergencial de IA ativada globalmente (emergency_ai_stop = true).";
    badge = "Requires Approval";
  }
  // 2. Check Autonomy MANUAL
  else if (policies.ai_autonomy_level === "MANUAL") {
    approved = false;
    reason = "Nível de autonomia da IA configurado como MANUAL.";
    badge = "Requires Approval";
  }
  // 3. Check Confidence limits
  else if (confidence < policies.min_confidence_to_act) {
    approved = false;
    reason = `Confiança da recomendação (${confidence.toFixed(1)}%) menor que o limite mínimo exigido (${policies.min_confidence_to_act}%).`;
    badge = "Requires Approval";
  }
  // 4. Check Maximum discount allowed
  else if (discount > policies.max_discount_allowed) {
    approved = false;
    reason = `Desconto recomendado (${discount}%) excede o limite máximo permitido (${policies.max_discount_allowed}%).`;
    badge = "Requires Approval";

    // Trigger governance alert: EXCESSIVE_PRICE_CHANGE
    await supabase.from("cm_ai_model_alert").insert({
      company_id: companyId,
      alert_type: "EXCESSIVE_PRICE_CHANGE",
      recommendation_type: type,
      alert_message: `Tentativa de desconto excessivo recomendada para o PDV ${recommendation.entity_id}. Recomendado: ${discount}%, Limite: ${policies.max_discount_allowed}%`,
      metric_value: discount,
      threshold_value: policies.max_discount_allowed,
      is_resolved: false
    });
  }
  // 5. Check cumulative discount > 20% in the last 7 days
  else if (discount > 0) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: pastRecs } = await supabase
      .from("cm_ai_recommendation")
      .select("recommended_action")
      .eq("company_id", companyId)
      .eq("entity_type", recommendation.entity_type)
      .eq("entity_id", recommendation.entity_id)
      .eq("approval_status", "APPROVED")
      .gte("created_at", sevenDaysAgo.toISOString());

    let cumulativeDiscount = discount;
    pastRecs?.forEach(pr => {
      const act = pr.recommended_action as Record<string, unknown>;
      cumulativeDiscount += Number(act?.discount_percent || 0);
    });

    if (cumulativeDiscount > 20.00) {
      approved = false;
      reason = `Soma acumulada de descontos no PDV nos últimos 7 dias (${cumulativeDiscount.toFixed(1)}%) excede o limite de segurança de 20%.`;
      badge = "Requires Approval";

      await supabase.from("cm_ai_model_alert").insert({
        company_id: companyId,
        alert_type: "EXCESSIVE_PRICE_CHANGE",
        recommendation_type: type,
        alert_message: `Desconto acumulado de ${cumulativeDiscount.toFixed(1)}% nos últimos 7 dias para o PDV ${recommendation.entity_id} excede o limite de segurança de 20%.`,
        metric_value: cumulativeDiscount,
        threshold_value: 20.00,
        is_resolved: false
      });
    }
  }

  // 6. Autonomy level filtering
  if (approved) {
    if (policies.ai_autonomy_level === "ASSISTED") {
      approved = false;
      reason = "Nível de autonomia ASSISTED exige aprovação humana para todas as ações.";
      badge = "Requires Approval";
    } else if (policies.ai_autonomy_level === "SEMI_AUTONOMOUS") {
      const simpleActions = ["EXTRA_VISIT", "STOCK_REPLENISHMENT"];
      if (!simpleActions.includes(type)) {
        approved = false;
        reason = `Ação complexa (${type}) exige aprovação humana em modo SEMI_AUTONOMOUS.`;
        badge = "Requires Approval";
      } else {
        badge = "Auto Approved";
      }
    } else if (policies.ai_autonomy_level === "FULLY_AUTONOMOUS") {
      badge = "Auto Approved";
    }
  }

  // Persist decision in the log table
  await supabase.from("cm_ai_decision_log").insert({
    company_id: companyId,
    decision_type: type,
    input_payload: recommendation,
    decision_payload: { approved, reason, badge },
    model_confidence: confidence,
    approved_by_human: false
  });

  return { approved, reason, badge };
}

/**
 * Saves a versioned snapshot of the current KPI weights, thresholds, and governance policies.
 */
export async function saveConfigVersionSnapshot(companyId: string, userId: string | null): Promise<void> {
  const supabase = createAdminClient();

  // 1. Fetch current KPI configs
  const { data: kpis } = await supabase
    .from("cm_company_kpi_config")
    .select("*")
    .eq("company_id", companyId);

  // 2. Fetch current Governance Policies
  const { data: policies } = await supabase
    .from("cm_ai_governance_policy")
    .select("*")
    .eq("company_id", companyId);

  // 3. Find latest version number
  const { data: latest } = await supabase
    .from("cm_kpi_config_version")
    .select("version")
    .eq("company_id", companyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version || 0) + 1;

  const snapshot = {
    kpis: kpis || [],
    policies: policies || []
  };

  // 4. Save version
  await supabase.from("cm_kpi_config_version").insert({
    company_id: companyId,
    version: nextVersion,
    config_snapshot: snapshot,
    created_by: userId
  });
}

/**
 * Audits company statistics and raises/resolves governance alerts.
 */
export async function evaluateGovernanceAlerts(companyId: string): Promise<void> {
  const supabase = createAdminClient();

  // --- ALERT 1: AUTONOMOUS_ACTION_SPIKE ---
  const past24h = new Date();
  past24h.setHours(past24h.getHours() - 24);

  // Count last 24h auto-approved recommendations
  const { count: autoLast24h } = await supabase
    .from("cm_ai_recommendation")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("approval_status", "APPROVED")
    .eq("governance_badge", "Auto Approved")
    .gte("created_at", past24h.toISOString());

  // Count total historical auto-approved recommendations
  const { data: firstRec } = await supabase
    .from("cm_ai_recommendation")
    .select("created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let days = 7;
  if (firstRec) {
    const diff = Date.now() - new Date(firstRec.created_at).getTime();
    days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const { count: totalAuto } = await supabase
    .from("cm_ai_recommendation")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("approval_status", "APPROVED")
    .eq("governance_badge", "Auto Approved");

  const dailyAvg = (totalAuto || 0) / days;
  const currentCount = autoLast24h || 0;

  if (currentCount > 10 && currentCount > 2 * dailyAvg) {
    const alertMessage = `Spike in autonomous actions detected. Actions in last 24h: ${currentCount}, historical daily average: ${dailyAvg.toFixed(1)}`;
    const { data: existing } = await supabase
      .from("cm_ai_model_alert")
      .select("id")
      .eq("company_id", companyId)
      .eq("alert_type", "AUTONOMOUS_ACTION_SPIKE")
      .eq("is_resolved", false)
      .maybeSingle();

    if (!existing) {
      await supabase.from("cm_ai_model_alert").insert({
        company_id: companyId,
        alert_type: "AUTONOMOUS_ACTION_SPIKE",
        recommendation_type: "ALL",
        alert_message: alertMessage,
        metric_value: currentCount,
        threshold_value: Number((2 * dailyAvg).toFixed(2)),
        is_resolved: false
      });
    }
  } else {
    // Resolve spike alert
    await supabase
      .from("cm_ai_model_alert")
      .update({ is_resolved: true })
      .eq("company_id", companyId)
      .eq("alert_type", "AUTONOMOUS_ACTION_SPIKE")
      .eq("is_resolved", false);
  }

  // --- ALERT 2: OVERRIDE_RATE_HIGH ---
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: totalRecs } = await supabase
    .from("cm_ai_recommendation")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: rejectedRecs } = await supabase
    .from("cm_ai_recommendation")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("approval_status", "REJECTED")
    .gte("created_at", sevenDaysAgo.toISOString());

  const total = totalRecs || 0;
  const rejected = rejectedRecs || 0;
  const overrideRate = total > 0 ? (rejected / total) * 100.00 : 0.00;

  if (total >= 5 && overrideRate > 35.00) {
    const alertMessage = `High override rate detected. ${overrideRate.toFixed(1)}% of recommendations rejected by supervisor in the last 7 days.`;
    const { data: existing } = await supabase
      .from("cm_ai_model_alert")
      .select("id")
      .eq("company_id", companyId)
      .eq("alert_type", "OVERRIDE_RATE_HIGH")
      .eq("is_resolved", false)
      .maybeSingle();

    if (!existing) {
      await supabase.from("cm_ai_model_alert").insert({
        company_id: companyId,
        alert_type: "OVERRIDE_RATE_HIGH",
        recommendation_type: "ALL",
        alert_message: alertMessage,
        metric_value: Number(overrideRate.toFixed(2)),
        threshold_value: 35.00,
        is_resolved: false
      });
    }
  } else {
    // Resolve override alert
    await supabase
      .from("cm_ai_model_alert")
      .update({ is_resolved: true })
      .eq("company_id", companyId)
      .eq("alert_type", "OVERRIDE_RATE_HIGH")
      .eq("is_resolved", false);
  }
}
