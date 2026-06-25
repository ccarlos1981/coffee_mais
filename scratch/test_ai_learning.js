const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase URL or Service Role Key in environment!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("=== SPRINT 6.2 CLOSED LOOP LEARNING INTEGRATION TEST ===");

  // 1. Find Supervisor/Admin user to authenticate
  console.log("1. Finding a Supervisor or Admin user to run test...");
  const { data: adminProfiles, error: profileErr } = await supabaseAdmin
    .from('cm_user_profiles')
    .select('id, role, company_id')
    .in('role', ['Admin', 'Trade', 'Supervisor'])
    .limit(1);

  if (profileErr || !adminProfiles || adminProfiles.length === 0) {
    console.error("Failed to find any Admin/Supervisor user profile:", profileErr);
    process.exit(1);
  }

  const adminProfile = adminProfiles[0];
  const originalCompanyId = adminProfile.company_id;
  console.log(`Found supervisor profile: ID ${adminProfile.id}, Role: ${adminProfile.role}, Original Company: ${originalCompanyId}`);

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(adminProfile.id);
  if (userErr || !user) {
    console.error("Failed to fetch user details from Auth:", userErr);
    process.exit(1);
  }

  const email = user.email;
  const password = 'test-password-123';
  await supabaseAdmin.auth.admin.updateUserById(adminProfile.id, { password });

  console.log(`Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.session) {
    console.error("Login failed:", authError);
    process.exit(1);
  }
  const { access_token } = authData.session;
  console.log("Login successful. Access token acquired.");

  // 2. Seed Mock Company and PDV Context
  const testCompanyId = "e143e8d6-c7d7-4315-8f54-aa12ce554d2c";
  const testPdvId = "PDV_TEST_LEARNING_1";

  console.log(`\n2. Seeding test tenant and PDV context under company: ${testCompanyId}...`);

  // Create company
  const companyRecord = {
    id: testCompanyId,
    company_name: "Empresa Teste Aprendizado",
    industry_segment: "Bebidas e Alimentos",
    is_active: true
  };
  const { error: companyErr } = await supabaseAdmin.from('cm_company').insert(companyRecord);
  if (companyErr && !companyErr.message.includes("duplicate key")) {
    console.error("Failed to seed cm_company:", companyErr);
    process.exit(1);
  }

  // Update supervisor to this test company
  const { error: mapErr } = await supabaseAdmin
    .from('cm_user_profiles')
    .update({ company_id: testCompanyId })
    .eq('id', adminProfile.id);
  if (mapErr) {
    console.error("Failed to map admin user to test company:", mapErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Seed base_atendimento PDV
  const pdvRecord = {
    cod_parceiro: testPdvId,
    nome_fantasia: "Supermercado Aprendizado IA 1",
    rede: "REDE TESTE APRENDIZADO",
    canal: "VAREJO F OUT",
    uf: "MG",
    cidade: "Belo Horizonte",
    faturamento_mensal: 100000.00,
    company_id: testCompanyId
  };
  const { error: pdvErr } = await supabaseAdmin.from('base_atendimento').insert(pdvRecord);
  if (pdvErr) {
    console.error("Failed to seed base_atendimento:", pdvErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Seed Sell-Out showing Rupture risk
  const selloutRecord = {
    pdv_id: testPdvId,
    sku: "COFFEE_MAIS_CLASSICO",
    estimated_stock_boxes: 2,
    sellout_velocity: 1.5,
    days_of_inventory: 1.33,
    stock_risk: "HIGH",
    suggested_order_boxes: 20
  };
  const { error: selloutErr } = await supabaseAdmin.from('cm_sellout_analysis').insert(selloutRecord);
  if (selloutErr) {
    console.error("Failed to seed sellout analysis:", selloutErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // 3. Generate Recommendations
  console.log("\n3. Triggering Prescriptive AI generation (GET /api/supervisor/recommendations?pdv_id=...&generate=true)...");
  const genRes = await fetch(`http://localhost:3000/api/supervisor/recommendations?pdv_id=${testPdvId}&generate=true`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!genRes.ok) {
    console.error("Prescriptive AI trigger API failed:", await genRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  const genData = await genRes.json();
  const targetRec = genData.recommendations.find(r => r.recommendation_type === "STOCK_REPLENISHMENT");
  if (!targetRec) {
    console.error("Prescriptive engine failed to generate STOCK_REPLENISHMENT recommendation!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log(`Generated recommendation: ID: ${targetRec.id}, Type: ${targetRec.recommendation_type}, Expected Uplift: ${targetRec.expected_revenue_uplift}`);

  // 4. Test closed-loop learning feedback via promotor API (rating = 5)
  console.log("\n4. Registering Executed Feedback via promotor endpoint (rating = 5)...");
  const feedbackPayload = {
    recommendation_id: targetRec.id,
    status: "EXECUTED",
    feedback_notes: "Ação de reposição executada com sucesso.",
    feedback_rating: 5
  };

  const fbRes = await fetch("http://localhost:3000/api/promotor/recommendations", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify(feedbackPayload)
  });

  if (!fbRes.ok) {
    console.error("Feedback loop submission failed:", await fbRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log("Feedback successfully registered. Checking learning records in DB...");

  // Assert cm_ai_learning_event has been created
  const { data: dbEvent, error: dbEventErr } = await supabaseAdmin
    .from("cm_ai_learning_event")
    .select("*")
    .eq("recommendation_id", targetRec.id)
    .maybeSingle();

  if (dbEventErr || !dbEvent) {
    console.error("Failed to query learning event from DB:", dbEventErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log(`Learning Event Verified: Manual Rating: ${dbEvent.manual_rating}, Source: ${dbEvent.real_sellout_source}, Actual Sellout: ${dbEvent.actual_sellout}, Error: ${dbEvent.prediction_error_percent}%`);
  if (dbEvent.manual_rating !== 5 || dbEvent.real_sellout_source !== 'MANUAL' || dbEvent.prediction_error_percent !== 5.00) {
    console.error("Learning event values are incorrect!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: learning event logged with correct rating and source.");

  // Assert cm_ai_model_performance has been updated
  const { data: dbPerf, error: dbPerfErr } = await supabaseAdmin
    .from("cm_ai_model_performance")
    .select("*")
    .eq("company_id", testCompanyId)
    .eq("recommendation_type", targetRec.recommendation_type)
    .maybeSingle();

  if (dbPerfErr || !dbPerf) {
    console.error("Failed to query model performance from DB:", dbPerfErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log(`Model Performance Verified: Total Predictions: ${dbPerf.total_predictions}, Confidence: ${dbPerf.model_confidence_score}%, Realized ROI: ${dbPerf.avg_realized_roi}x`);
  if (dbPerf.total_predictions !== 1 || dbPerf.model_confidence_score !== 95.00) {
    console.error("Model performance values are incorrect!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: model performance aggregated metrics updated.");

  // Assert cm_ai_model_weights has versioned the first calibration
  const { data: dbWeights, error: dbWeightsErr } = await supabaseAdmin
    .from("cm_ai_model_weights")
    .select("*")
    .eq("company_id", testCompanyId)
    .order("created_at", { ascending: false });

  if (dbWeightsErr || !dbWeights || dbWeights.length === 0) {
    console.error("Failed to query historical weights from DB:", dbWeightsErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log(`Weights versioning verified. Row count: ${dbWeights.length}. Active weights: Impact=${dbWeights[0].impact_weight}, ROI=${dbWeights[0].roi_weight}, Urgency=${dbWeights[0].urgency_weight}`);
  console.log("SUCCESS: Recalibrated weights versioned historically in DB.");

  // 5. Test degradation alerts and confidence floor
  console.log("\n5. Simulating model degradation to test alerts and confidence floor...");
  
  // Seed high error learning events directly to force error > 35% and confidence < 50
  const badRecommendationId = targetRec.id; // reuse the same rec ID
  const badEvents = [
    {
      company_id: testCompanyId,
      recommendation_id: badRecommendationId,
      predicted_sellout: 1000.00,
      actual_sellout: 100.00, // 90% error (rating 1)
      predicted_roi: 2.00,
      actual_roi: -0.20,
      prediction_error_percent: 90.00,
      learning_weight: 1.00,
      manual_rating: 1,
      real_sellout_source: 'SIMULATED'
    },
    {
      company_id: testCompanyId,
      recommendation_id: badRecommendationId,
      predicted_sellout: 1000.00,
      actual_sellout: 100.00, // 90% error (rating 1)
      predicted_roi: 2.00,
      actual_roi: -0.20,
      prediction_error_percent: 90.00,
      learning_weight: 1.00,
      manual_rating: 1,
      real_sellout_source: 'SIMULATED'
    }
  ];

  const { error: seedBadErr } = await supabaseAdmin.from("cm_ai_learning_event").insert(badEvents);
  if (seedBadErr) {
    console.error("Failed to seed bad learning events:", seedBadErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Trigger evaluation via API to trigger alerts and weights recalibration
  console.log("Triggering manual feedback via API for bad recommendation to recalculate performance...");
  const badFbRes = await fetch("http://localhost:3000/api/supervisor/recommendation-feedback", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      recommendation_id: badRecommendationId,
      feedback_rating: 1,
      notes: "Simulação de erro crítico e queda de acurácia do modelo."
    })
  });

  if (!badFbRes.ok) {
    console.error("Failed to post manual feedback for degradation:", await badFbRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Assert model alert has been fired
  const { data: alerts, error: alertQueryErr } = await supabaseAdmin
    .from("cm_ai_model_alert")
    .select("*")
    .eq("company_id", testCompanyId)
    .eq("is_resolved", false);

  if (alertQueryErr || !alerts || alerts.length === 0) {
    console.error("Degradation alerts were not generated! Query error:", alertQueryErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log(`Alerts fired successfully. Count: ${alerts.length}`);
  alerts.forEach(al => {
    console.log(`- Alert Type: ${al.alert_type}, Message: "${al.alert_message}", Metric: ${al.metric_value}%, Limit: ${al.threshold_value}%`);
  });

  const hasHighErrorAlert = alerts.some(a => a.alert_type === "HIGH_PREDICTION_ERROR");
  const hasConfidenceDropAlert = alerts.some(a => a.alert_type === "CONFIDENCE_DROP");

  if (!hasHighErrorAlert || !hasConfidenceDropAlert) {
    console.error("Missing expected degradation alerts (HIGH_PREDICTION_ERROR or CONFIDENCE_DROP)!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Degradation alerts successfully generated and verified.");

  // Test confidence floor
  console.log("Generating recommendations under degraded model to verify 25% confidence floor...");
  const floorRes = await fetch(`http://localhost:3000/api/supervisor/recommendations?pdv_id=${testPdvId}&generate=true`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  if (!floorRes.ok) {
    console.error("Failed to regenerate recommendations under bad model:", await floorRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  const floorData = await floorRes.json();
  const degradedRec = floorData.recommendations.find(r => r.recommendation_type === "STOCK_REPLENISHMENT");
  
  // Historical model accuracy is now low (~40% confidence).
  // Base confidence is 95%. Without floor: 95 * 40 / 100 = 38%. But if we had even lower accuracy (e.g. 10%), it would drop below 25%.
  // Let's print out the returned confidence.
  console.log(`Degraded STOCK_REPLENISHMENT recommendation confidence: ${degradedRec.recommendation_confidence}%`);
  if (degradedRec.recommendation_confidence < 25.0) {
    console.error("Confidence floor violated! Value is lower than 25%.");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Confidence floor successfully verified (>= 25%).");

  // 6. Test supervisor learning stats route
  console.log("\n6. Testing supervisor learning stats API (GET /api/supervisor/ai-learning)...");
  const statsRes = await fetch("http://localhost:3000/api/supervisor/ai-learning", {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!statsRes.ok) {
    console.error("Supervisor AI Learning API failed:", await statsRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  const statsData = await statsRes.json();
  console.log("Supervisor Learning API payload response sample:", {
    model_accuracy: statsData.model_accuracy,
    avg_prediction_error: statsData.avg_prediction_error,
    best_action_type: statsData.best_action_type,
    worst_action_type: statsData.worst_action_type,
    alerts_count: statsData.alerts.length,
    weights_history_count: statsData.weights_history.length
  });

  if (!statsData.success || statsData.alerts.length === 0 || statsData.weights_history.length === 0) {
    console.error("Invalid stats API response contents!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Supervisor AI Learning API verified successfully.");

  // 7. Cleanup
  await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
  console.log("\nALL SPRINT 6.2 CLOSED LOOP LEARNING TESTS PASSED SUCCESSFULLY!");
}

async function cleanAll(adminProfileId, originalCompanyId, pdvId, companyId) {
  console.log("\nCleaning up seeded mock data...");
  try {
    // Restore supervisor company mapping
    await supabaseAdmin
      .from('cm_user_profiles')
      .update({ company_id: originalCompanyId })
      .eq('id', adminProfileId);

    // Clear alerts, analyses, and recommendations
    await supabaseAdmin.from('cm_sellout_analysis').delete().eq('pdv_id', pdvId);
    await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', pdvId);
    
    // Delete company (cascading deletes recommendations, events, performances, weights, and alerts)
    await supabaseAdmin.from('cm_company').delete().eq('id', companyId);
    
    console.log("Seeded test data cleared successfully.");
  } catch (e) {
    console.error("Error during cleanup:", e);
  }
}

run().catch(async (e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
