import { createAdminClient } from "@/lib/supabase/admin";

export interface KPICalculationDetail {
  kpi_key: string;
  display_name: string;
  category: string;
  raw_value: number;
  score: number;
  weight: number;
  is_enabled: boolean;
  target_value: number;
  warning_threshold: number;
  critical_threshold: number;
}

export interface CompanyScoreResult {
  overall_score: number;
  kpis: KPICalculationDetail[];
}

/**
 * Mathematically interpolates a KPI value between target, warning, and critical thresholds.
 * Handles both "lower is better" (e.g. rupture_rate, price_gap) and "higher is better" (e.g. share_of_shelf, coverage_rate) cases.
 */
export function interpolateScore(
  val: number,
  target: number,
  warning: number,
  critical: number,
  lowerIsBetter: boolean
): number {
  // Clamp boundaries first to avoid extra range checks
  if (lowerIsBetter) {
    if (val <= target) return 100;
    if (val >= critical) return 0;
    
    if (warning > target && val <= warning) {
      return 100 - ((val - target) / (warning - target)) * 50;
    } else if (critical > warning && val > warning) {
      return 50 - ((val - warning) / (critical - warning)) * 50;
    } else {
      // Fallback simple linear interpolation
      if (critical === target) return 0;
      return 100 - ((val - target) / (critical - target)) * 100;
    }
  } else {
    if (val >= target) return 100;
    if (val <= critical) return 0;
    
    if (target > warning && val >= warning) {
      return 50 + ((val - warning) / (target - warning)) * 50;
    } else if (warning > critical && val < warning) {
      return ((val - critical) / (warning - critical)) * 50;
    } else {
      // Fallback simple linear interpolation
      if (target === critical) return 0;
      return ((val - critical) / (target - critical)) * 100;
    }
  }
}

/**
 * Determines whether a KPI key grows "lower is better" or "higher is better".
 */
export function isLowerIsBetter(kpiKey: string): boolean {
  const lowerBetterKeys = ["rupture_rate", "price_gap"];
  return lowerBetterKeys.includes(kpiKey);
}

/**
 * Calculates the overall score and detailed breakdown for a company
 * based on its enabled KPIs and active weights in the database.
 */
export async function calculateCompanyScore(
  companyId: string,
  entityData: Record<string, number>
): Promise<CompanyScoreResult> {
  const supabase = createAdminClient();

  // 1. Fetch active KPI configs for this company
  const { data: configs, error } = await supabase
    .from("cm_company_kpi_config")
    .select(`
      id,
      weight,
      target_value,
      warning_threshold,
      critical_threshold,
      is_enabled,
      kpi:cm_kpi_definition!cm_company_kpi_config_kpi_id_fkey (
        kpi_key,
        display_name,
        category
      )
    `)
    .eq("company_id", companyId)
    .eq("is_enabled", true);

  if (error) {
    console.error("Error fetching company KPI configs:", error);
    throw error;
  }

  const kpis: KPICalculationDetail[] = [];
  let weightedScoreSum = 0;
  let totalWeight = 0;

  // 2. Loop through and calculate each KPI score
  configs?.forEach((item: any) => {
    if (!item.kpi) return;
    const kpiKey = item.kpi.kpi_key;
    const weight = Number(item.weight || 0.00);
    const target = Number(item.target_value || 0.00);
    const warning = Number(item.warning_threshold || 0.00);
    const critical = Number(item.critical_threshold || 0.00);

    // Get raw value from entityData, defaulting to target_value if not provided
    const rawValue = entityData[kpiKey] !== undefined ? entityData[kpiKey] : target;
    const lowerBetter = isLowerIsBetter(kpiKey);
    const score = interpolateScore(rawValue, target, warning, critical, lowerBetter);

    kpis.push({
      kpi_key: kpiKey,
      display_name: item.kpi.display_name,
      category: item.kpi.category,
      raw_value: rawValue,
      score: Number(score.toFixed(2)),
      weight,
      is_enabled: item.is_enabled,
      target_value: target,
      warning_threshold: warning,
      critical_threshold: critical,
    });

    if (weight > 0) {
      weightedScoreSum += score * weight;
      totalWeight += weight;
    }
  });

  // 3. Consolidated Overall Score
  const overallScore = totalWeight > 0 ? (weightedScoreSum / totalWeight) : 0;

  return {
    overall_score: Number(overallScore.toFixed(2)),
    kpis,
  };
}
