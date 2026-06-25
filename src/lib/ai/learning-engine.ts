import { createAdminClient } from "@/lib/supabase/admin";

export interface PrescriptiveWeights {
  impact: number;
  roi: number;
  urgency: number;
  ease: number;
  strategic: number;
}

/**
 * Evaluates the performance of a completed recommendation.
 * Compares expected vs realized ROI and sellout, logs learning event,
 * updates aggregated performance, and raises/resolves alerts.
 */
export async function evaluateExecutedRecommendation(
  recommendationId: string,
  source: "MANUAL" | "REAL_SALES" | "SIMULATED" = "MANUAL"
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Fetch Recommendation details
  const { data: rec, error: recErr } = await supabase
    .from("cm_ai_recommendation")
    .select("*")
    .eq("id", recommendationId)
    .single();

  if (recErr || !rec) {
    console.error(`Recommendation ${recommendationId} not found:`, recErr);
    return;
  }

  // 2. Fetch Feedback details
  const { data: fb } = await supabase
    .from("cm_ai_recommendation_feedback")
    .select("*")
    .eq("recommendation_id", recommendationId)
    .maybeSingle();

  const rating = fb?.feedback_rating || 5;

  // 3. Establish predicted values
  const predicted_sellout = Number(rec.expected_revenue_uplift || 0.00);
  const predicted_roi = Number(rec.estimated_roi || 0.00);
  const estimated_cost = Math.max(1.00, Number(rec.estimated_cost || 0.00));

  // 4. Calculate actual values based on manual execution rating
  // 5 stars -> 1.05, 4 stars -> 0.95, 3 stars -> 0.80, 2 stars -> 0.60, 1 star -> 0.40
  let ratingFactor = 1.05;
  if (rating === 4) ratingFactor = 0.95;
  else if (rating === 3) ratingFactor = 0.80;
  else if (rating === 2) ratingFactor = 0.60;
  else if (rating === 1) ratingFactor = 0.40;

  const actual_sellout = predicted_sellout * ratingFactor;
  const actual_margin_gain = actual_sellout * 0.40; // Assumed 40% margin
  const actual_roi = (actual_margin_gain - estimated_cost) / estimated_cost;
  
  // Prediction error percentage
  const prediction_error_percent = predicted_sellout > 0 
    ? (Math.abs(predicted_sellout - actual_sellout) / predicted_sellout) * 100.00
    : 0.00;

  // 5. Log granular learning event
  const { error: eventErr } = await supabase
    .from("cm_ai_learning_event")
    .insert({
      company_id: rec.company_id,
      recommendation_id: rec.id,
      predicted_sellout: Number(predicted_sellout.toFixed(2)),
      actual_sellout: Number(actual_sellout.toFixed(2)),
      predicted_roi: Number(predicted_roi.toFixed(2)),
      actual_roi: Number(actual_roi.toFixed(2)),
      prediction_error_percent: Number(prediction_error_percent.toFixed(2)),
      learning_weight: 1.0,
      manual_rating: rating,
      real_sellout_source: source
    });

  if (eventErr) {
    console.error("Error creating learning event:", eventErr);
    return;
  }

  // 6. Fetch all learning events for this company and recommendation type to recalculate stats
  const { data: events, error: fetchEventsErr } = await supabase
    .from("cm_ai_learning_event")
    .select("prediction_error_percent, predicted_roi, actual_roi, cm_ai_recommendation!inner(recommendation_type)")
    .eq("company_id", rec.company_id)
    .eq("cm_ai_recommendation.recommendation_type", rec.recommendation_type);

  if (fetchEventsErr || !events) {
    console.error("Error fetching historical events:", fetchEventsErr);
    return;
  }

  const total_predictions = events.length;
  const successful_predictions = events.filter(e => Number(e.prediction_error_percent) <= 20.00).length;
  
  const total_error = events.reduce((sum, e) => sum + Number(e.prediction_error_percent), 0);
  const avg_prediction_error = total_predictions > 0 ? total_error / total_predictions : 0.00;

  const total_expected_roi = events.reduce((sum, e) => sum + Number(e.predicted_roi), 0);
  const avg_expected_roi = total_predictions > 0 ? total_expected_roi / total_predictions : 0.00;

  const total_realized_roi = events.reduce((sum, e) => sum + Number(e.actual_roi), 0);
  const avg_realized_roi = total_predictions > 0 ? total_realized_roi / total_predictions : 0.00;

  // Confidence score decreases as error increases
  const model_confidence_score = Math.max(10.00, Math.min(100.00, 100.00 - avg_prediction_error));

  // 7. Upsert performance record
  const { error: perfErr } = await supabase
    .from("cm_ai_model_performance")
    .upsert({
      company_id: rec.company_id,
      recommendation_type: rec.recommendation_type,
      total_predictions,
      successful_predictions,
      avg_prediction_error: Number(avg_prediction_error.toFixed(2)),
      avg_expected_roi: Number(avg_expected_roi.toFixed(2)),
      avg_realized_roi: Number(avg_realized_roi.toFixed(2)),
      model_confidence_score: Number(model_confidence_score.toFixed(2)),
      updated_at: new Date().toISOString()
    }, { onConflict: "company_id,recommendation_type" });

  if (perfErr) {
    console.error("Error upserting model performance:", perfErr);
    return;
  }

  // 8. Handle alerts (CONFIDENCE_DROP & HIGH_PREDICTION_ERROR)
  
  // Alert: Confidence Drop (< 50)
  if (model_confidence_score < 50.00) {
    const alertMessage = `Model confidence score for ${rec.recommendation_type} dropped below critical threshold. Current: ${model_confidence_score.toFixed(1)}%`;
    
    const { data: existingAlert } = await supabase
      .from("cm_ai_model_alert")
      .select("id")
      .eq("company_id", rec.company_id)
      .eq("alert_type", "CONFIDENCE_DROP")
      .eq("recommendation_type", rec.recommendation_type)
      .eq("is_resolved", false)
      .limit(1)
      .maybeSingle();

    if (!existingAlert) {
      await supabase.from("cm_ai_model_alert").insert({
        company_id: rec.company_id,
        alert_type: "CONFIDENCE_DROP",
        recommendation_type: rec.recommendation_type,
        alert_message: alertMessage,
        metric_value: Number(model_confidence_score.toFixed(2)),
        threshold_value: 50.00,
        is_resolved: false
      });
    }
  } else {
    // Auto-resolve confidence drop alerts
    await supabase
      .from("cm_ai_model_alert")
      .update({ is_resolved: true })
      .eq("company_id", rec.company_id)
      .eq("alert_type", "CONFIDENCE_DROP")
      .eq("recommendation_type", rec.recommendation_type)
      .eq("is_resolved", false);
  }

  // Alert: High Prediction Error (> 35%)
  if (avg_prediction_error > 35.00) {
    const alertMessage = `High average prediction error detected for ${rec.recommendation_type}. Current: ${avg_prediction_error.toFixed(1)}%`;
    
    const { data: existingAlert } = await supabase
      .from("cm_ai_model_alert")
      .select("id")
      .eq("company_id", rec.company_id)
      .eq("alert_type", "HIGH_PREDICTION_ERROR")
      .eq("recommendation_type", rec.recommendation_type)
      .eq("is_resolved", false)
      .limit(1)
      .maybeSingle();

    if (!existingAlert) {
      await supabase.from("cm_ai_model_alert").insert({
        company_id: rec.company_id,
        alert_type: "HIGH_PREDICTION_ERROR",
        recommendation_type: rec.recommendation_type,
        alert_message: alertMessage,
        metric_value: Number(avg_prediction_error.toFixed(2)),
        threshold_value: 35.00,
        is_resolved: false
      });
    }
  } else {
    // Auto-resolve high error alerts
    await supabase
      .from("cm_ai_model_alert")
      .update({ is_resolved: true })
      .eq("company_id", rec.company_id)
      .eq("alert_type", "HIGH_PREDICTION_ERROR")
      .eq("recommendation_type", rec.recommendation_type)
      .eq("is_resolved", false);
  }

  // Alert: MODEL_DRIFT (Prediction Error > 30% or Confidence < 50)
  if (avg_prediction_error > 30.00 || model_confidence_score < 50.00) {
    const alertMessage = `Model drift detected for ${rec.recommendation_type}. Average prediction error: ${avg_prediction_error.toFixed(1)}%, Model confidence: ${model_confidence_score.toFixed(1)}%`;
    const { data: existingDrift } = await supabase
      .from("cm_ai_model_alert")
      .select("id")
      .eq("company_id", rec.company_id)
      .eq("alert_type", "MODEL_DRIFT")
      .eq("recommendation_type", rec.recommendation_type)
      .eq("is_resolved", false)
      .limit(1)
      .maybeSingle();

    if (!existingDrift) {
      await supabase.from("cm_ai_model_alert").insert({
        company_id: rec.company_id,
        alert_type: "MODEL_DRIFT",
        recommendation_type: rec.recommendation_type,
        alert_message: alertMessage,
        metric_value: Number(avg_prediction_error.toFixed(2)),
        threshold_value: 30.00,
        is_resolved: false
      });
    }
  } else {
    // Auto-resolve MODEL_DRIFT alerts
    await supabase
      .from("cm_ai_model_alert")
      .update({ is_resolved: true })
      .eq("company_id", rec.company_id)
      .eq("alert_type", "MODEL_DRIFT")
      .eq("recommendation_type", rec.recommendation_type)
      .eq("is_resolved", false);
  }

  // Trigger weight recalibration based on new performance
  await getRecalibratedWeights(rec.company_id);
}

/**
 * Returns dynamic weights for the prescriptive engine based on average model performance.
 * Persists historical changes to cm_ai_model_weights.
 */
export async function getRecalibratedWeights(companyId: string): Promise<PrescriptiveWeights> {
  const supabase = createAdminClient();

  // 1. Fetch current performances
  const { data: perfs, error: perfErr } = await supabase
    .from("cm_ai_model_performance")
    .select("avg_prediction_error")
    .eq("company_id", companyId);

  let avgError = 20.00; // default baseline error (20%) if no data
  if (!perfErr && perfs && perfs.length > 0) {
    const totalError = perfs.reduce((sum, p) => sum + Number(p.avg_prediction_error), 0);
    avgError = totalError / perfs.length;
  }

  // 2. Adjust weights based on overall prediction error
  let baseWeights: PrescriptiveWeights;

  if (avgError < 15.00) {
    // Model is highly reliable -> prioritize ROI and financial Impact
    baseWeights = {
      impact: 0.35,
      roi: 0.25,
      urgency: 0.20,
      ease: 0.10,
      strategic: 0.10
    };
  } else if (avgError > 30.00) {
    // Model is noisy -> rely less on financial projections, prioritize operations & urgency
    baseWeights = {
      impact: 0.20,
      roi: 0.15,
      urgency: 0.35,
      ease: 0.15,
      strategic: 0.15
    };
  } else {
    // Default baseline weights
    baseWeights = {
      impact: 0.30,
      roi: 0.20,
      urgency: 0.25,
      ease: 0.125,
      strategic: 0.125
    };
  }

  // Load previous weights and enforce max_kpi_weight_shift policy
  let weights = { ...baseWeights };
  try {
    const { data: latest } = await supabase
      .from("cm_ai_model_weights")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prev = latest ? {
      impact: Number(latest.impact_weight),
      roi: Number(latest.roi_weight),
      urgency: Number(latest.urgency_weight),
      ease: Number(latest.execution_weight),
      strategic: Number(latest.strategic_weight)
    } : {
      impact: 0.30,
      roi: 0.20,
      urgency: 0.25,
      ease: 0.125,
      strategic: 0.125
    };

    const { getAIGovernancePolicies } = await import("./governance-engine");
    const policies = await getAIGovernancePolicies(companyId);
    const maxShift = (policies.max_kpi_weight_shift || 5) / 100; // default 5%

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    const targetWeights = {
      impact: clamp(baseWeights.impact, prev.impact - maxShift, prev.impact + maxShift),
      roi: clamp(baseWeights.roi, prev.roi - maxShift, prev.roi + maxShift),
      urgency: clamp(baseWeights.urgency, prev.urgency - maxShift, prev.urgency + maxShift),
      ease: clamp(baseWeights.ease, prev.ease - maxShift, prev.ease + maxShift),
      strategic: clamp(baseWeights.strategic, prev.strategic - maxShift, prev.strategic + maxShift)
    };

    const sum = targetWeights.impact + targetWeights.roi + targetWeights.urgency + targetWeights.ease + targetWeights.strategic;
    if (sum > 0) {
      weights = {
        impact: Number((targetWeights.impact / sum).toFixed(4)),
        roi: Number((targetWeights.roi / sum).toFixed(4)),
        urgency: Number((targetWeights.urgency / sum).toFixed(4)),
        ease: Number((targetWeights.ease / sum).toFixed(4)),
        strategic: Number((targetWeights.strategic / sum).toFixed(4))
      };
    }
  } catch (err) {
    console.error("Failed to load/apply governance weight shift policies:", err);
  }

  // 3. Log historical changes in cm_ai_model_weights if weights actually changed
  try {
    const { data: latest } = await supabase
      .from("cm_ai_model_weights")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const changed = !latest ||
      Math.abs(Number(latest.impact_weight) - weights.impact) > 0.0001 ||
      Math.abs(Number(latest.roi_weight) - weights.roi) > 0.0001 ||
      Math.abs(Number(latest.urgency_weight) - weights.urgency) > 0.0001 ||
      Math.abs(Number(latest.execution_weight) - weights.ease) > 0.0001 ||
      Math.abs(Number(latest.strategic_weight) - weights.strategic) > 0.0001;

    if (changed) {
      await supabase
        .from("cm_ai_model_weights")
        .insert({
          company_id: companyId,
          impact_weight: weights.impact,
          roi_weight: weights.roi,
          urgency_weight: weights.urgency,
          execution_weight: weights.ease,
          strategic_weight: weights.strategic
        });
    }
  } catch (err) {
    console.error("Failed to version recalibrated weights:", err);
  }

  return weights;
}
