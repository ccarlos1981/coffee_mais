import { createAdminClient } from "@/lib/supabase/admin";

export type FraudCounterType =
  | "gps_mock"
  | "speed_suspicious" // > 120 km/h (+1 to count = 10 pts)
  | "speed_alert"      // > 150 km/h (+2 to count = 20 pts)
  | "speed_severe"     // > 300 km/h (+3 to count = 30 pts)
  | "duplicate_photo"
  | "device_change"
  | "edge_geofence";

/**
 * Increments fraud counters incrementally and recalculates the daily score.
 * Updates both public.cm_promotor_fraud_metrics and public.cm_promotor_live_status.
 */
export async function registerFraudIncident(
  promotorId: string,
  counterType: FraudCounterType,
  dateStr: string
) {
  try {
    const supabase = createAdminClient();

    // 1. Fetch or create daily metrics row
    const { data: existing, error: fetchError } = await supabase
      .from("cm_promotor_fraud_metrics")
      .select("*")
      .eq("promotor_id", promotorId)
      .eq("metric_date", dateStr)
      .maybeSingle();

    if (fetchError) {
      console.error("[FRAUD ENGINE] Error fetching daily metrics:", fetchError);
      return null;
    }

    const metrics = existing || {
      promotor_id: promotorId,
      metric_date: dateStr,
      gps_mock_count: 0,
      speed_violation_count: 0,
      duplicate_photo_count: 0,
      device_change_count: 0,
      edge_geofence_count: 0,
      fraud_score: 100
    };

    // 2. Increment counters incrementally
    if (counterType === "gps_mock") {
      metrics.gps_mock_count += 1;
    } else if (counterType === "speed_suspicious") {
      metrics.speed_violation_count += 1; // +10 points (weight 10)
    } else if (counterType === "speed_alert") {
      metrics.speed_violation_count += 2; // +20 points (weight 10)
    } else if (counterType === "speed_severe") {
      metrics.speed_violation_count += 3; // +30 points (weight 10)
    } else if (counterType === "duplicate_photo") {
      metrics.duplicate_photo_count += 1;
    } else if (counterType === "device_change") {
      metrics.device_change_count += 1;
    } else if (counterType === "edge_geofence") {
      metrics.edge_geofence_count += 1;
    }

    // 3. Recalculate Fraud Score
    // Penalties:
    // - gps_mock: -40
    // - speed_violation: -10 per unit in speed_violation_count (suspicious = -10, alert = -20, severe = -30)
    // - duplicate_photo: -25
    // - device_change: -20
    // - edge_geofence: -15
    const totalPenalty =
      metrics.gps_mock_count * 40 +
      metrics.speed_violation_count * 10 +
      metrics.duplicate_photo_count * 25 +
      metrics.device_change_count * 20 +
      metrics.edge_geofence_count * 15;

    metrics.fraud_score = Math.max(0, 100 - totalPenalty);
    metrics.updated_at = new Date().toISOString();

    // 4. Upsert aggregated metrics
    const { error: upsertError } = await supabase
      .from("cm_promotor_fraud_metrics")
      .upsert({
        promotor_id: metrics.promotor_id,
        metric_date: metrics.metric_date,
        gps_mock_count: metrics.gps_mock_count,
        speed_violation_count: metrics.speed_violation_count,
        duplicate_photo_count: metrics.duplicate_photo_count,
        device_change_count: metrics.device_change_count,
        edge_geofence_count: metrics.edge_geofence_count,
        fraud_score: metrics.fraud_score,
        updated_at: metrics.updated_at
      }, {
        onConflict: "promotor_id,metric_date"
      });

    if (upsertError) {
      console.error("[FRAUD ENGINE] Error upserting metrics:", upsertError);
      return null;
    }

    // 5. Update live status table with the calculated fraud score
    const { error: liveError } = await supabase
      .from("cm_promotor_live_status")
      .update({
        fraud_score: metrics.fraud_score,
        updated_at: new Date().toISOString()
      })
      .eq("promotor_id", promotorId);

    if (liveError) {
      console.error("[FRAUD ENGINE] Error updating live status fraud_score:", liveError);
    }

    return metrics;
  } catch (err) {
    console.error("[FRAUD ENGINE] Fatal error registering incident:", err);
    return null;
  }
}
