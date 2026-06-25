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

// Test IDs
const testCompanyId = "e143e8d6-c7d7-4315-8f54-aa12ce554d2b";
const testPdvId = "PDV_TEST_GOV_1";
const visitId = "77777777-7777-7777-7777-777777777777";

async function run() {
  console.log("=== STARTING SPRINT 6.3 E2E GOVERNANCE TESTS ===");

  // 1. Find Supervisor / Admin user to perform HTTP requests
  console.log("\n1. Finding Supervisor or Admin user to run test...");
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
  console.log(`Found profile: ID ${adminProfile.id}, Role: ${adminProfile.role}, Original Company: ${originalCompanyId}`);

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(adminProfile.id);
  if (userErr || !user) {
    console.error("Failed to fetch user details from Auth:", userErr);
    process.exit(1);
  }

  const email = user.email;
  const password = 'test-password-123';

  console.log(`Setting password for ${email} in Auth...`);
  await supabaseAdmin.auth.admin.updateUserById(adminProfile.id, { password });

  console.log(`Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.session) {
    console.error("Login failed:", authError);
    process.exit(1);
  }
  const { access_token } = authData.session;
  console.log("Login successful. Access token acquired.");

  // 2. Seed Mock Tenant Data
  console.log(`\n2. Seeding test tenant data for company: ${testCompanyId}...`);

  // Seed company
  const companyRecord = {
    id: testCompanyId,
    company_name: "Empresa Teste Governança",
    industry_segment: "Bebidas e Alimentos",
    is_active: true
  };
  const { error: companyErr } = await supabaseAdmin.from('cm_company').insert(companyRecord);
  if (companyErr) {
    console.error("Failed to seed cm_company:", companyErr);
    process.exit(1);
  }

  // Map supervisor user to this test company
  const { error: mapErr } = await supabaseAdmin
    .from('cm_user_profiles')
    .update({ company_id: testCompanyId })
    .eq('id', adminProfile.id);
  if (mapErr) {
    console.error("Failed to map user to test company:", mapErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Seed master KPIs (upsert in case they are missing from definition master table)
  const masterKpis = [
    { id: '11111111-1111-1111-1111-111111111111', kpi_key: 'rupture_rate', display_name: 'Taxa de Ruptura', kpi_code: 'rupture_rate', kpi_name: 'Taxa de Ruptura', category: 'Operacional' },
    { id: '22222222-2222-2222-2222-222222222222', kpi_key: 'price_gap', display_name: 'Desvio de Preço (Price Gap)', kpi_code: 'price_gap', kpi_name: 'Desvio de Preço (Price Gap)', category: 'Preço' },
    { id: '55555555-5555-5555-5555-555555555555', kpi_key: 'share_of_shelf', display_name: 'Share of Shelf', kpi_code: 'share_of_shelf', kpi_name: 'Share of Shelf', category: 'Visibilidade' },
    { id: '77777777-7777-7777-7777-777777777777', kpi_key: 'ROI', display_name: 'Retorno sobre Investimento (ROI)', kpi_code: 'ROI', kpi_name: 'Retorno sobre Investimento (ROI)', category: 'Financeiro' }
  ];

  for (const master of masterKpis) {
    const { error: masterErr } = await supabaseAdmin.from('cm_kpi_definition').upsert(master, { onConflict: 'kpi_code' });
    if (masterErr) {
      console.error(`Failed to upsert KPI definition ${master.kpi_code}:`, masterErr);
      await cleanAll(adminProfile.id, originalCompanyId);
      process.exit(1);
    }
  }

  // Seed company KPI configurations
  const kpiConfigs = [
    { company_id: testCompanyId, kpi_id: '11111111-1111-1111-1111-111111111111', kpi_code: 'rupture_rate', weight: 40.00, target_value: 0.05, warning_threshold: 0.15, critical_threshold: 0.25, threshold_low: 0.05, threshold_medium: 0.15, threshold_high: 0.25, is_enabled: true },
    { company_id: testCompanyId, kpi_id: '22222222-2222-2222-2222-222222222222', kpi_code: 'price_gap', weight: 30.00, target_value: 0.02, warning_threshold: 0.08, critical_threshold: 0.15, threshold_low: 0.02, threshold_medium: 0.08, threshold_high: 0.15, is_enabled: true },
    { company_id: testCompanyId, kpi_id: '55555555-5555-5555-5555-555555555555', kpi_code: 'share_of_shelf', weight: 30.00, target_value: 0.50, warning_threshold: 0.35, critical_threshold: 0.50, threshold_low: 0.20, threshold_medium: 0.35, threshold_high: 0.50, is_enabled: true },
    { company_id: testCompanyId, kpi_id: '77777777-7777-7777-7777-777777777777', kpi_code: 'ROI', weight: 0.00, target_value: 2.50, warning_threshold: 1.50, critical_threshold: 2.50, threshold_low: 0.50, threshold_medium: 1.50, threshold_high: 2.50, is_enabled: false }
  ];

  const { error: configsErr } = await supabaseAdmin.from('cm_company_kpi_config').insert(kpiConfigs);
  if (configsErr) {
    console.error("Failed to seed KPI configs:", configsErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Seed default governance policies
  const policies = [
    { company_id: testCompanyId, policy_key: 'ai_autonomy_level', policy_value: 'SEMI_AUTONOMOUS' },
    { company_id: testCompanyId, policy_key: 'min_confidence_to_act', policy_value: 80 },
    { company_id: testCompanyId, policy_key: 'require_human_approval', policy_value: true },
    { company_id: testCompanyId, policy_key: 'max_discount_allowed', policy_value: 15 },
    { company_id: testCompanyId, policy_key: 'emergency_ai_stop', policy_value: false },
    { company_id: testCompanyId, policy_key: 'max_kpi_weight_shift', policy_value: 5 }
  ];

  const { error: polErr } = await supabaseAdmin.from('cm_ai_governance_policy').insert(policies);
  if (polErr) {
    console.error("Failed to seed policies:", polErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Seed PDV
  const pdvData = [{
    cod_parceiro: testPdvId,
    nome_fantasia: "Supermercado Gov Teste 1",
    rede: "REDE TESTE GOV",
    canal: "VAREJO F OUT",
    uf: "MG",
    cidade: "Belo Horizonte",
    faturamento_mensal: 80000.00,
    company_id: testCompanyId
  }];
  const { error: pdvErr } = await supabaseAdmin.from('base_atendimento').insert(pdvData);
  if (pdvErr) {
    console.error("Failed to seed base_atendimento:", pdvErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // 3. Test Case 1: KPI Config Weight Validation server-side
  console.log("\n3. Running Test Case 1: Weights Sum Validation...");
  
  // First, fetch the seeded configs to get IDs
  const getConfRes = await fetch("http://localhost:3000/api/admin/kpi-config", {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const getConfData = await getConfRes.json();
  const loadedKpis = getConfData.kpis;

  // Let's modify weights to sum to 90% (which is invalid)
  const invalidKpis = loadedKpis.map(k => {
    if (k.kpi_code === 'rupture_rate') {
      return { ...k, weight: 30.00 }; // 30 + 30 + 30 = 90%
    }
    return k;
  });

  console.log("Sending invalid weights sum update (90%)...");
  const updateRes1 = await fetch("http://localhost:3000/api/admin/kpi-config", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({ kpis: invalidKpis })
  });

  console.log(`Response Status: ${updateRes1.status}`);
  const updateData1 = await updateRes1.json();
  console.log(`Response Payload:`, updateData1);

  if (updateRes1.status !== 400 || updateData1.success !== false) {
    console.error("FAIL: API allowed updating weights that do not sum to 100%!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Server-side validation correctly blocked weight sum !== 100%.");

  // Send valid weights (40% + 30% + 30% = 100%)
  console.log("\nSending valid weights sum update (100%)...");
  const validKpis = loadedKpis.map(k => {
    if (k.kpi_code === 'rupture_rate') {
      return { ...k, weight: 40.00 };
    }
    return k;
  });

  const updateRes2 = await fetch("http://localhost:3000/api/admin/kpi-config", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({ kpis: validKpis })
  });

  console.log(`Response Status: ${updateRes2.status}`);
  const updateData2 = await updateRes2.json();
  console.log(`Response Payload:`, updateData2);

  if (updateRes2.status !== 200 || updateData2.success !== true) {
    console.error("FAIL: Valid weights sum update failed!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Valid weights updated successfully.");

  // Verify Snapshot Versioning
  console.log("\nVerifying if configuration version snapshot was saved...");
  const { data: versions, error: verErr } = await supabaseAdmin
    .from('cm_kpi_config_version')
    .select('version, config_snapshot')
    .eq('company_id', testCompanyId)
    .order('version', { ascending: false });

  if (verErr || !versions || versions.length === 0) {
    console.error("FAIL: Config version snapshot was not written to DB:", verErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  console.log(`Found config versions: ${versions.length}. Latest version: ${versions[0].version}`);
  console.log("Latest snapshot snippet:", JSON.stringify(versions[0].config_snapshot.kpis[0]));
  if (versions[0].version !== 1) {
    console.error(`FAIL: Expected snapshot version 1, got ${versions[0].version}`);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Snapshot versioning successfully verified.");

  // 4. Test Case 2: Update Governance Policies (Set emergency stop & autonomy level MANUAL)
  console.log("\n4. Running Test Case 2: Policies Update & Emergency Stop...");
  const policyUpdateRes = await fetch("http://localhost:3000/api/admin/ai-governance", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      policies: {
        ai_autonomy_level: "MANUAL",
        emergency_ai_stop: true
      }
    })
  });

  console.log(`Policy update status: ${policyUpdateRes.status}`);
  const policyUpdateData = await policyUpdateRes.json();
  console.log(`Policy update response:`, policyUpdateData);

  if (policyUpdateRes.status !== 200 || policyUpdateData.success !== true) {
    console.error("FAIL: Policy update failed!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Verify version snapshot is now incremented to 2
  const { data: versions2 } = await supabaseAdmin
    .from('cm_kpi_config_version')
    .select('version')
    .eq('company_id', testCompanyId)
    .order('version', { ascending: false });

  console.log(`Latest config version in DB is now: ${versions2?.[0]?.version}`);
  if (versions2?.[0]?.version !== 2) {
    console.error("FAIL: Version snapshot did not increment to 2 on policy update!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Policies updated and version snapshot incremented to 2.");

  // 5. Test Case 3: Prescriptive recommendation generation & emergency stop badging
  console.log("\n5. Running Test Case 3: Generating recommendations with active emergency stop...");

  // Seed context for recommendations (triggers stock replenishment and price reduction)
  // Sellout analysis with HIGH stock risk
  const selloutRecord = {
    pdv_id: testPdvId,
    sku: "COFFEE_MAIS_CLASSICO",
    estimated_stock_boxes: 2,
    sellout_velocity: 1.5,
    days_of_inventory: 1.33,
    stock_risk: "HIGH",
    suggested_order_boxes: 21
  };
  const { error: selloutErr } = await supabaseAdmin.from('cm_sellout_analysis').insert(selloutRecord);
  if (selloutErr) {
    console.error("Failed to seed sellout record:", selloutErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Fetch agenda
  const { data: agenda } = await supabaseAdmin
    .from('cm_promotor_agenda_diaria')
    .select('id, promotor_id')
    .limit(1)
    .maybeSingle();

  const agendaId = agenda ? agenda.id : null;
  let employeeId = agenda ? agenda.promotor_id : adminProfile.id;

  if (!agendaId) {
    console.error("No daily agenda found to seed visit!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Seed visit
  const visitRecord = {
    id: visitId,
    agenda_diaria_id: agendaId,
    cod_parceiro: testPdvId,
    status: "CONCLUIDA",
    checkin_servidor: new Date().toISOString(),
    checkout_servidor: new Date().toISOString()
  };
  const { error: visitErr } = await supabaseAdmin.from('cm_promotor_visita').insert(visitRecord);
  if (visitErr) {
    console.error("Failed to seed visit record:", visitErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Shelf analysis with planogram score = 85
  const shelfRecord = {
    visita_id: visitId,
    promotor_id: employeeId,
    photo_url: "https://coffeemais.com/shelf.jpg",
    total_facings: 10,
    coffee_mais_facings: 3,
    shelf_share_percent: 30.00,
    rupture_status: "OK",
    planogram_score: 85,
    ai_confidence: 0.98,
    analysis_status: "DONE",
    created_at: new Date().toISOString()
  };
  const { error: shelfErr } = await supabaseAdmin.from('cm_ai_shelf_analysis').insert(shelfRecord);
  if (shelfErr) {
    console.error("Failed to seed shelf record:", shelfErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Price analysis with risk OVERPRICED
  const priceRecord = {
    pricing_risk: "OVERPRICED",
    commercial_opportunity: "OFFENSIVE",
    created_at: new Date().toISOString()
  };
  const { error: priceErr } = await supabaseAdmin.from('cm_ai_price_analysis').insert(priceRecord);
  if (priceErr) {
    console.error("Failed to seed price analysis:", priceErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Call recommendation GET with generate=true
  console.log("Triggering recommendation generation...");
  const genRes = await fetch(`http://localhost:3000/api/supervisor/recommendations?pdv_id=${testPdvId}&generate=true`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!genRes.ok) {
    console.error("Generation API call failed:", await genRes.text());
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  const genData = await genRes.json();
  console.log(`Generated ${genData.recommendations.length} recommendations.`);

  // Let's query recommendations directly from database and verify badging/approval rules
  const { data: recs, error: recFetchErr } = await supabaseAdmin
    .from('cm_ai_recommendation')
    .select('*')
    .eq('entity_id', testPdvId)
    .eq('company_id', testCompanyId);

  if (recFetchErr || !recs || recs.length === 0) {
    console.error("FAIL: Recommendations were not created in the database!", recFetchErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  console.log("Checking approval fields for all generated recommendations...");
  for (const rec of recs) {
    console.log(`- Type: ${rec.recommendation_type}, requires_approval: ${rec.requires_approval}, status: ${rec.approval_status}, badge: ${rec.governance_badge}`);
    if (rec.requires_approval !== true || rec.approval_status !== "PENDING" || rec.governance_badge !== "Requires Approval") {
      console.error(`FAIL: Recommendation did not get blocked under emergency stop rule!`);
      await cleanAll(adminProfile.id, originalCompanyId);
      process.exit(1);
    }
  }
  console.log("SUCCESS: Emergency stop correctly forced PENDING status and 'Requires Approval' badge on all actions.");

  // Verify that the validation log is recorded
  const { data: decisionLogs, error: logErr } = await supabaseAdmin
    .from('cm_ai_decision_log')
    .select('*')
    .eq('company_id', testCompanyId);

  console.log(`Found ${decisionLogs?.length || 0} decision logs.`);
  if (logErr || !decisionLogs || decisionLogs.length === 0) {
    console.error("FAIL: Decision logs were not written:", logErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log(`Latest decision log payload:`, decisionLogs[0].decision_payload);
  console.log("SUCCESS: Decision logs written successfully.");

  // 6. Test Case 4: Enforce override_reason on rejection
  console.log("\n6. Running Test Case 4: Enforcing override_reason on rejection...");
  const targetRecommendation = recs[0];

  // Try rejection without override_reason
  console.log("Attempting rejection with missing override_reason...");
  const rejectRes1 = await fetch("http://localhost:3000/api/supervisor/recommendations", {
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      recommendation_id: targetRecommendation.id,
      approval_status: "REJECTED"
    })
  });

  console.log(`Rejection Response status: ${rejectRes1.status}`);
  const rejectData1 = await rejectRes1.json();
  console.log(`Rejection Response payload:`, rejectData1);

  if (rejectRes1.status !== 400 || rejectData1.success !== false) {
    console.error("FAIL: Allowed recommendation rejection without reason!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Rejection correctly blocked when override_reason is missing.");

  // Reject WITH reason
  console.log("\nRejecting with valid override_reason...");
  const rejectRes2 = await fetch("http://localhost:3000/api/supervisor/recommendations", {
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      recommendation_id: targetRecommendation.id,
      approval_status: "REJECTED",
      override_reason: "Preço incorreto ou fora da meta"
    })
  });

  console.log(`Rejection Response status: ${rejectRes2.status}`);
  const rejectData2 = await rejectRes2.json();
  console.log(`Rejection Response payload:`, rejectData2);

  if (rejectRes2.status !== 200 || rejectData2.success !== true) {
    console.error("FAIL: Valid rejection failed!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Check recommendation in DB is dismissed
  const { data: dbRejected } = await supabaseAdmin
    .from('cm_ai_recommendation')
    .select('status, approval_status, override_reason')
    .eq('id', targetRecommendation.id)
    .single();

  console.log(`Recommendation DB state: status = ${dbRejected.status}, approval_status = ${dbRejected.approval_status}, reason = '${dbRejected.override_reason}'`);
  if (dbRejected.status !== "DISMISSED" || dbRejected.approval_status !== "REJECTED" || dbRejected.override_reason !== "Preço incorreto ou fora da meta") {
    console.error("FAIL: DB state does not reflect rejection!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Rejection fully completed and validated.");

  // 7. Test Case 5: Supervisor Approval (Allows recommendation)
  console.log("\n7. Running Test Case 5: Supervisor Approval...");
  const approveRecommendation = recs[1] || recs[0]; // pick second recommendation

  const approveRes = await fetch("http://localhost:3000/api/supervisor/recommendations", {
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      recommendation_id: approveRecommendation.id,
      approval_status: "APPROVED"
    })
  });

  console.log(`Approval Response status: ${approveRes.status}`);
  const approveData = await approveRes.json();
  console.log(`Approval Response payload:`, approveData);

  if (approveRes.status !== 200 || approveData.success !== true) {
    console.error("FAIL: Valid approval failed!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Check DB state is active and requires_approval is false
  const { data: dbApproved } = await supabaseAdmin
    .from('cm_ai_recommendation')
    .select('status, approval_status, requires_approval')
    .eq('id', approveRecommendation.id)
    .single();

  console.log(`Recommendation DB state: status = ${dbApproved.status}, approval = ${dbApproved.approval_status}, requires_approval = ${dbApproved.requires_approval}`);
  if (dbApproved.status !== "OPEN" || dbApproved.approval_status !== "APPROVED" || dbApproved.requires_approval !== false) {
    console.error("FAIL: DB state does not reflect approval!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Recommendation successfully approved.");

  // 8. Test Case 6: Mobile API Filtration (Filters out PENDING/REJECTED actions)
  console.log("\n8. Running Test Case 6: Mobile API Filtration...");
  const mobRes = await fetch(`http://localhost:3000/api/promotor/recommendations?pdv_id=${testPdvId}`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!mobRes.ok) {
    console.error("FAIL: Mobile recommendations fetch failed:", await mobRes.text());
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  const mobData = await mobRes.json();
  console.log(`Mobile API returned ${mobData.recommendations.length} recommendations.`);
  for (const mRec of mobData.recommendations) {
    console.log(`- Mobile Rec: ID ${mRec.id}, Type: ${mRec.recommendation_type}, requires_approval: ${mRec.requires_approval}, status: ${mRec.approval_status}`);
    if (mRec.requires_approval === true || mRec.approval_status !== "APPROVED") {
      console.error("FAIL: Mobile API leaked pending or unapproved recommendations!");
      await cleanAll(adminProfile.id, originalCompanyId);
      process.exit(1);
    }
  }
  console.log("SUCCESS: Mobile API correctly filters out all unapproved or pending recommendations.");

  // 9. Test Case 7: Governance Alerts evaluation
  console.log("\n9. Running Test Case 7: Evaluating model and governance alerts...");
  
  // Verify if any alerts are created.
  // We rejected 1 out of 2 recommendations, so override rate is 50%. Since total >= 5 in evaluateGovernanceAlerts:
  // Let's seed 3 more recommendations and reject them to trigger OVERRIDE_RATE_HIGH (> 35% rejections out of >= 5).
  console.log("Creating 3 additional dummy recommendations to reach 5 total and trigger override rate alert...");
  const dummyRecs = [
    { company_id: testCompanyId, entity_type: 'PDV', entity_id: testPdvId, recommendation_type: 'TRADE_PROMOTION', priority_score: 80, urgency_level: 'MEDIUM', expected_sellout_uplift_percent: 10, expected_revenue_uplift: 100, expected_margin_uplift: 40, estimated_cost: 50, estimated_roi: 2, recommendation_confidence: 90, reasoning: [], recommended_action: {}, status: 'DISMISSED', approval_status: 'REJECTED', requires_approval: false, override_reason: 'dummy rejection 1' },
    { company_id: testCompanyId, entity_type: 'PDV', entity_id: testPdvId, recommendation_type: 'EXTRA_VISIT', priority_score: 80, urgency_level: 'MEDIUM', expected_sellout_uplift_percent: 10, expected_revenue_uplift: 100, expected_margin_uplift: 40, estimated_cost: 50, estimated_roi: 2, recommendation_confidence: 90, reasoning: [], recommended_action: {}, status: 'DISMISSED', approval_status: 'REJECTED', requires_approval: false, override_reason: 'dummy rejection 2' },
    { company_id: testCompanyId, entity_type: 'PDV', entity_id: testPdvId, recommendation_type: 'NEGOTIATE_SPACE', priority_score: 80, urgency_level: 'MEDIUM', expected_sellout_uplift_percent: 10, expected_revenue_uplift: 100, expected_margin_uplift: 40, estimated_cost: 50, estimated_roi: 2, recommendation_confidence: 90, reasoning: [], recommended_action: {}, status: 'DISMISSED', approval_status: 'REJECTED', requires_approval: false, override_reason: 'dummy rejection 3' }
  ];
  await supabaseAdmin.from('cm_ai_recommendation').insert(dummyRecs);

  // Re-trigger alert evaluation by PATCHing a recommendation again
  console.log("Re-triggering alert evaluation via PATCH...");
  await fetch("http://localhost:3000/api/supervisor/recommendations", {
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      recommendation_id: approveRecommendation.id,
      approval_status: "APPROVED" // Approved again to trigger evaluation
    })
  });

  const { data: alerts, error: alertFetchErr } = await supabaseAdmin
    .from('cm_ai_model_alert')
    .select('alert_type, alert_message, is_resolved')
    .eq('company_id', testCompanyId);

  console.log(`Found ${alerts?.length || 0} active alerts in DB:`);
  alerts?.forEach(a => {
    console.log(`- Alert: ${a.alert_type}, Message: '${a.alert_message}', Resolved: ${a.is_resolved}`);
  });

  if (alertFetchErr || !alerts || alerts.length === 0) {
    console.error("FAIL: Governance alerts were not successfully evaluated or inserted!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  const hasOverrideAlert = alerts.some(a => a.alert_type === 'OVERRIDE_RATE_HIGH');
  if (!hasOverrideAlert) {
    console.error("FAIL: Expected OVERRIDE_RATE_HIGH alert not found!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Governance alerts successfully evaluated and logged.");

  // 10. Clean up and restore
  await cleanAll(adminProfile.id, originalCompanyId);
  console.log("\n=== ALL E2E GOVERNANCE TESTS PASSED SUCCESSFULLY! ===");
}

async function cleanAll(adminProfileId, originalCompanyId) {
  console.log("\nCleaning up seeded mock data...");

  // Restore user profiles company mapping
  await supabaseAdmin
    .from('cm_user_profiles')
    .update({ company_id: originalCompanyId })
    .eq('id', adminProfileId);

  // Delete seeded records for company
  await supabaseAdmin.from('cm_ai_model_alert').delete().eq('company_id', testCompanyId);
  await supabaseAdmin.from('cm_ai_decision_log').delete().eq('company_id', testCompanyId);
  await supabaseAdmin.from('cm_kpi_config_version').delete().eq('company_id', testCompanyId);
  await supabaseAdmin.from('cm_ai_recommendation_feedback').delete().eq('company_id', testCompanyId);
  await supabaseAdmin.from('cm_ai_recommendation').delete().eq('company_id', testCompanyId);
  await supabaseAdmin.from('cm_ai_price_analysis').delete().eq('pricing_risk', 'OVERPRICED');
  await supabaseAdmin.from('cm_ai_shelf_analysis').delete().eq('visita_id', visitId);
  await supabaseAdmin.from('cm_promotor_visita').delete().eq('id', visitId);
  await supabaseAdmin.from('cm_sellout_analysis').delete().eq('pdv_id', testPdvId);
  await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', testPdvId);
  await supabaseAdmin.from('cm_ai_governance_policy').delete().eq('company_id', testCompanyId);
  await supabaseAdmin.from('cm_company_kpi_config').delete().eq('company_id', testCompanyId);
  await supabaseAdmin.from('cm_company').delete().eq('id', testCompanyId);
}

run().catch(async (err) => {
  console.error("UNEXPECTED RUN TIME ERROR:", err);
  process.exit(1);
});
