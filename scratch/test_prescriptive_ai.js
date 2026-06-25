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
  console.log("=== SPRINT 6.1 PRESCRIPTIVE AI INTEGRATION TEST (REFINADO) ===");
  
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

  // 2. Seed Mock Company and PDV Context for Prescriptive AI
  const testCompanyId = "e143e8d6-c7d7-4315-8f54-aa12ce554d2a";
  const testPdvId = "PDV_TEST_PRESCR_1";
  
  console.log(`\n2. Seeding test tenant and PDV context under company: ${testCompanyId}...`);
  
  // Create company if not exists
  const companyRecord = {
    id: testCompanyId,
    company_name: "Empresa Teste Prescritiva",
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
    nome_fantasia: "Supermercado Prescritivo IA 1",
    rede: "REDE TESTE PRESCRITIVA",
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
  console.log("Seeding cm_sellout_analysis showing active stock rupture...");
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

  // Seed daily agenda
  const { data: agenda } = await supabaseAdmin
    .from('cm_promotor_agenda_diaria')
    .select('id, promotor_id')
    .limit(1)
    .maybeSingle();

  const agendaId = agenda ? agenda.id : null;
  let employeeId = agenda ? agenda.promotor_id : null;

  if (!employeeId) {
    const { data: emp } = await supabaseAdmin
      .from('cm_employees')
      .select('id')
      .limit(1)
      .maybeSingle();
    employeeId = emp ? emp.id : null;
  }

  if (!agendaId || !employeeId) {
    console.error("No promotor agenda or employee found to seed visit!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Seed visit older than 14 days to trigger SLA extra visit rule
  const lastVisitDate = new Date();
  lastVisitDate.setDate(lastVisitDate.getDate() - 20); // 20 days ago (SLA is 14 days)

  const visitRecord = {
    id: "66666666-6666-6666-6666-666666666666",
    agenda_diaria_id: agendaId,
    cod_parceiro: testPdvId,
    status: "CONCLUIDA",
    created_at: lastVisitDate.toISOString(),
    checkin_servidor: lastVisitDate.toISOString(),
    checkout_servidor: lastVisitDate.toISOString()
  };
  const { error: visitErr } = await supabaseAdmin.from('cm_promotor_visita').insert(visitRecord);
  if (visitErr) {
    console.error("Failed to seed visit:", visitErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Shelf analysis with compliance 85% and low share (30%)
  const shelfRecord = {
    visita_id: "66666666-6666-6666-6666-666666666666",
    promotor_id: employeeId,
    photo_url: "https://coffeemais.com/shelf.jpg",
    total_facings: 10,
    coffee_mais_facings: 3,
    shelf_share_percent: 30.00, // < 35% triggers space expansion
    rupture_status: "OK",
    planogram_score: 85, // >= 80% pricing compliance eligibility
    ai_confidence: 0.98,
    analysis_status: "DONE",
    created_at: new Date().toISOString()
  };
  const { error: shelfErr } = await supabaseAdmin.from('cm_ai_shelf_analysis').insert(shelfRecord);
  if (shelfErr) {
    console.error("Failed to seed shelf analysis:", shelfErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Price analysis showing OVERPRICED
  const priceRecord = {
    pricing_risk: "OVERPRICED",
    commercial_opportunity: "OFFENSIVE",
    created_at: new Date().toISOString()
  };
  const { error: priceErr } = await supabaseAdmin.from('cm_ai_price_analysis').insert(priceRecord);
  if (priceErr) {
    console.error("Failed to seed price analysis:", priceErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Pricing alert for competitor promo
  const alertRecord = {
    sku: "COFFEE_MAIS_CLASSICO",
    tipo_alerta: "competitor_promo_detected",
    descricao: "Competidor com promoção ativa detectada no PDV.",
    is_resolvido: false,
    created_at: new Date().toISOString()
  };
  const { error: alertErr } = await supabaseAdmin.from('cm_ai_pricing_alert').insert(alertRecord);
  if (alertErr) {
    console.error("Failed to seed pricing alert:", alertErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // 3. Trigger Prescriptive AI via GET recommendations API with generate=true
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
  console.log(`Received recommendations list. Count: ${genData.recommendations.length}`);
  
  if (genData.recommendations.length === 0) {
    console.error("Prescriptive engine failed to generate recommendations!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  // Verify Fingerprint and Alternative Actions
  const sampleRec = genData.recommendations[0];
  console.log(`Fingerprint of first recommendation: ${sampleRec.recommendation_fingerprint}`);
  console.log(`Alternative actions count: ${sampleRec.alternative_actions ? sampleRec.alternative_actions.length : 0}`);
  if (!sampleRec.recommendation_fingerprint || !sampleRec.alternative_actions || sampleRec.alternative_actions.length === 0) {
    console.error("Fingerprint or Alternative Actions are missing or empty!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Fingerprint and Alternative Actions verified.");

  // 4. Test 7-Day Deduplication
  console.log("\n4. Testing 7-Day Deduplication of OPEN recommendations...");
  const dupRes = await fetch(`http://localhost:3000/api/supervisor/recommendations?pdv_id=${testPdvId}&generate=true`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  if (!dupRes.ok) {
    console.error("Deduplication check failed:", await dupRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  const dupData = await dupRes.json();
  console.log(`Second call recommendations count: ${dupData.recommendations.length} (Expected equal count: ${genData.recommendations.length})`);
  if (dupData.recommendations.length !== genData.recommendations.length) {
    console.error("Deduplication failed: generated extra duplicates!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: 7-day deduplication verified. No duplicates created.");

  // 5. Test Trade Action Simulator API (POST /api/supervisor/trade-simulator)
  console.log("\n5. Testing Multi-Parameter Trade Simulator API & company_id logging...");
  const targetRec = genData.recommendations[0];
  const simPayload = {
    action_type: "PRICE_REDUCTION",
    pdv_id: testPdvId,
    discount_percent: 10.0,
    extra_display_investment: 500.0,
    degustation_days: 3,
    promotor_hours: 8,
    recommendation_id: targetRec.id
  };
  const simRes = await fetch("http://localhost:3000/api/supervisor/trade-simulator", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify(simPayload)
  });

  if (!simRes.ok) {
    console.error("Simulator API request failed:", await simRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  const simData = await simRes.json();
  console.log("Simulator Response:", simData);

  // Assert simulation company_id is logged correctly
  const { data: dbSim, error: dbSimErr } = await supabaseAdmin
    .from("cm_trade_action_simulation")
    .select("company_id")
    .eq("recommendation_id", targetRec.id)
    .maybeSingle();

  if (dbSimErr || !dbSim) {
    console.error("Failed to fetch simulation from database:", dbSimErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log(`Logged simulation company_id in DB: ${dbSim.company_id} (Expected: ${testCompanyId})`);
  if (dbSim.company_id !== testCompanyId) {
    console.error("company_id is missing or incorrect in simulation log!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: company_id successfully persisted in cm_trade_action_simulation.");

  // 6. Test Promotor Dedicated APIs
  console.log("\n6. Testing dedicated mobile Promotor API (GET /api/promotor/recommendations?pdv_id=...)...");
  const promGetRes = await fetch(`http://localhost:3000/api/promotor/recommendations?pdv_id=${testPdvId}&status=OPEN`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!promGetRes.ok) {
    console.error("Promotor GET API failed:", await promGetRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  const promGetData = await promGetRes.json();
  console.log(`Promotor recommendations retrieved: ${promGetData.recommendations.length}`);
  if (promGetData.recommendations.length === 0) {
    console.error("Promotor recommendations list is empty!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log("\nTesting dedicated mobile Promotor POST Feedback API (/api/promotor/recommendations)...");
  const targetRecForFeedback = promGetData.recommendations[0];
  const feedbackPayload = {
    recommendation_id: targetRecForFeedback.id,
    status: "EXECUTED",
    feedback_notes: "Ação de trade executada pelo promotor via aplicativo mobile.",
    feedback_rating: 5
  };

  const promFbRes = await fetch("http://localhost:3000/api/promotor/recommendations", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify(feedbackPayload)
  });

  if (!promFbRes.ok) {
    console.error("Promotor POST Feedback API failed:", await promFbRes.text());
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  const promFbData = await promFbRes.json();
  console.log("Promotor Feedback Response Success:", promFbData.success);

  // Verify feedback is saved in cm_ai_recommendation_feedback table
  const { data: dbFeedback, error: dbFeedbackErr } = await supabaseAdmin
    .from("cm_ai_recommendation_feedback")
    .select("*")
    .eq("recommendation_id", targetRecForFeedback.id)
    .maybeSingle();

  if (dbFeedbackErr || !dbFeedback) {
    console.error("Failed to query feedback record in database:", dbFeedbackErr);
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }

  console.log(`Persisted Feedback: Rating=${dbFeedback.feedback_rating}, Notes="${dbFeedback.feedback_notes}", Company=${dbFeedback.company_id}`);
  if (dbFeedback.status !== "EXECUTED" || dbFeedback.feedback_rating !== 5 || dbFeedback.company_id !== testCompanyId) {
    console.error("Feedback database fields do not match inserted values!");
    await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Recommendation feedback normalisation verified.");

  // 7. Cleanup
  await cleanAll(adminProfile.id, originalCompanyId, testPdvId, testCompanyId);
  console.log("\nALL REFINED SPRINT 6.1 INTEGRATION TESTS PASSED SUCCESSFULLY!");
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
    await supabaseAdmin.from('cm_ai_pricing_alert').delete().eq('sku', 'COFFEE_MAIS_CLASSICO');
    await supabaseAdmin.from('cm_ai_price_analysis').delete().eq('pricing_risk', 'OVERPRICED');
    await supabaseAdmin.from('cm_ai_shelf_analysis').delete().eq('visita_id', '66666666-6666-6666-6666-666666666666');
    await supabaseAdmin.from('cm_promotor_visita').delete().eq('id', '66666666-6666-6666-6666-666666666666');
    await supabaseAdmin.from('cm_sellout_analysis').delete().eq('pdv_id', pdvId);
    await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', pdvId);
    
    // Delete company (cascading deletes recommendations, feedbacks, and simulations)
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
