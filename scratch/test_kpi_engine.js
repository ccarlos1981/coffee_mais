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
  console.log("1. Finding a Supervisor or Admin user to run KPI engine test...");
  
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
  console.log(`Found supervisor profile: ID ${adminProfile.id}, Role: ${adminProfile.role}, Current Company: ${originalCompanyId}`);

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

  // 2. Seed Mock Company, KPIs, and Dashboard Widgets
  console.log("\n2. Seeding test tenant data for 'e143e8d6-c7d7-4315-8f54-aa12ce554d2a'...");

  // Seed company
  const companyRecord = {
    id: "e143e8d6-c7d7-4315-8f54-aa12ce554d2a", // unique test UUID
    company_name: "Empresa Teste KPI",
    industry_segment: "Bebidas e Alimentos",
    is_active: true
  };
  const { error: companyErr } = await supabaseAdmin.from('cm_company').insert(companyRecord);
  if (companyErr) {
    console.error("Failed to seed cm_company:", companyErr);
    process.exit(1);
  }

  // Map admin user to this test company
  const { error: mapErr } = await supabaseAdmin
    .from('cm_user_profiles')
    .update({ company_id: companyRecord.id })
    .eq('id', adminProfile.id);
  if (mapErr) {
    console.error("Failed to map admin user to test company:", mapErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Seed base_atendimento PDVs for this company
  const pdvData = [
    {
      cod_parceiro: "PDV_TEST_KPI_1",
      nome_fantasia: "Supermercado KPI Teste 1",
      rede: "REDE TESTE KPI",
      canal: "VAREJO F OUT",
      uf: "MG",
      cidade: "Belo Horizonte",
      faturamento_mensal: 80000.00,
      company_id: companyRecord.id
    },
    {
      cod_parceiro: "PDV_TEST_KPI_2",
      nome_fantasia: "Supermercado KPI Teste 2",
      rede: "REDE TESTE KPI",
      canal: "VAREJO F OUT",
      uf: "MG",
      cidade: "Belo Horizonte",
      faturamento_mensal: 50000.00,
      company_id: companyRecord.id
    }
  ];
  const { error: pdvErr } = await supabaseAdmin.from('base_atendimento').insert(pdvData);
  if (pdvErr) {
    console.error("Failed to seed base_atendimento for KPIs:", pdvErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Find daily agenda to seed visit
  const { data: agenda } = await supabaseAdmin
    .from('cm_promotor_agenda_diaria')
    .select('id, promotor_id')
    .limit(1)
    .maybeSingle();

  const agendaId = agenda ? agenda.id : null;
  const employeeId = agenda ? agenda.promotor_id : adminProfile.id;

  if (agendaId) {
    const visitRecord = {
      id: "55555555-5555-5555-5555-555555555555",
      agenda_diaria_id: agendaId,
      cod_parceiro: "PDV_TEST_KPI_1",
      status: "CONCLUIDA",
      checkin_servidor: new Date().toISOString(),
      checkout_servidor: new Date().toISOString()
    };
    const { error: visitErr } = await supabaseAdmin.from('cm_promotor_visita').insert(visitRecord);
    if (visitErr) {
      console.error("Failed to seed visit:", visitErr);
      await cleanAll(adminProfile.id, originalCompanyId);
      process.exit(1);
    }

    const shelfRecord = {
      visita_id: "55555555-5555-5555-5555-555555555555",
      promotor_id: employeeId,
      photo_url: "https://coffeemais.com/shelf.jpg",
      total_facings: 10,
      coffee_mais_facings: 4,
      shelf_share_percent: 40.00, // 40% shelf share
      rupture_status: "OK",
      planogram_score: 90,
      ai_confidence: 0.96,
      analysis_status: "DONE"
    };
    const { error: shelfErr } = await supabaseAdmin.from('cm_ai_shelf_analysis').insert(shelfRecord);
    if (shelfErr) {
      console.error("Failed to seed shelf analysis:", shelfErr);
      await cleanAll(adminProfile.id, originalCompanyId);
      process.exit(1);
    }
  }

  // Seed company KPI configurations
  const kpiConfigs = [
    {
      company_id: companyRecord.id,
      kpi_id: "11111111-1111-1111-1111-111111111111", // rupture_rate
      weight: 40.00,
      target_value: 0.05,
      warning_threshold: 0.15,
      critical_threshold: 0.25,
      is_enabled: true
    },
    {
      company_id: companyRecord.id,
      kpi_id: "22222222-2222-2222-2222-222222222222", // price_gap
      weight: 30.00,
      target_value: 0.02,
      warning_threshold: 0.08,
      critical_threshold: 0.15,
      is_enabled: true
    },
    {
      company_id: companyRecord.id,
      kpi_id: "55555555-5555-5555-5555-555555555555", // share_of_shelf
      weight: 30.00,
      target_value: 0.50,
      warning_threshold: 0.35,
      critical_threshold: 0.20,
      is_enabled: true
    },
    {
      company_id: companyRecord.id,
      kpi_id: "33333333-3333-3333-3333-333333333333", // sellout_velocity
      weight: 0.00,
      target_value: 10.00,
      warning_threshold: 5.00,
      critical_threshold: 2.00,
      is_enabled: false
    }
  ];

  const { error: configsErr } = await supabaseAdmin.from('cm_company_kpi_config').insert(kpiConfigs);
  if (configsErr) {
    console.error("Failed to seed KPI configs:", configsErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Seed company dashboard widget configurations (Custom sort order: ai_vision [1], route_intelligence [2], operacional [3])
  const widgetConfigs = [
    { company_id: companyRecord.id, widget_key: "ai_vision", widget_order: 1, is_enabled: true },
    { company_id: companyRecord.id, widget_key: "route_intelligence", widget_order: 2, is_enabled: true },
    { company_id: companyRecord.id, widget_key: "operacional", widget_order: 3, is_enabled: true },
    { company_id: companyRecord.id, widget_key: "investigativa", widget_order: 4, is_enabled: false },
    { company_id: companyRecord.id, widget_key: "executiva", widget_order: 5, is_enabled: false }
  ];

  const { error: widgetsErr } = await supabaseAdmin.from('cm_dashboard_widget_config').insert(widgetConfigs);
  if (widgetsErr) {
    console.error("Failed to seed widget configs:", widgetsErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // Seed cm_sellout_analysis records for company PDVs
  const selloutData = [
    { pdv_id: "PDV_TEST_KPI_1", sku: "COFFEE_MAIS_CLASSICO", estimated_stock_boxes: 5, sellout_velocity: 1.0, days_of_inventory: 5.0, stock_risk: "HIGH", suggested_order_boxes: 10 },
    { pdv_id: "PDV_TEST_KPI_2", sku: "COFFEE_MAIS_CLASSICO", estimated_stock_boxes: 15, sellout_velocity: 1.2, days_of_inventory: 12.5, stock_risk: "LOW", suggested_order_boxes: 0 }
  ];
  const { error: selloutErr } = await supabaseAdmin.from('cm_sellout_analysis').insert(selloutData);
  if (selloutErr) {
    console.error("Failed to seed sellout analysis:", selloutErr);
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  // 3. Test Dynamic KPI Score API
  console.log("\n3. Testing Company KPIs Calculation API (GET)...");
  const kpisRes = await fetch("http://localhost:3000/api/company/kpis", {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!kpisRes.ok) {
    console.error("Company KPIs API request failed:", await kpisRes.text());
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  const kpisData = await kpisRes.json();
  console.log("Full JSON Response from KPIs API:");
  console.log(JSON.stringify(kpisData, null, 2));

  // Verify Calculations
  const score = kpisData.data.overall_score;
  console.log(`\nVerified Overall Score: ${score} (Expected: ~45.0)`);
  if (Math.abs(score - 45.0) > 1.0) {
    console.error("KPI overall score calculation does not match expectations!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Dynamic KPI calculations verified.");

  // 4. Test Widgets API (GET)
  console.log("\n4. Testing Company Widgets Order API (GET)...");
  const widgetsRes = await fetch("http://localhost:3000/api/company/widgets", {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!widgetsRes.ok) {
    console.error("Widgets API request failed:", await widgetsRes.text());
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  const widgetsData = await widgetsRes.json();
  console.log("Widgets received:", widgetsData.widgets);
  
  // Verify order
  const orderKeys = widgetsData.widgets.map(w => w.widget_key);
  console.log("Order keys:", orderKeys);
  if (orderKeys[0] !== "ai_vision" || orderKeys[1] !== "route_intelligence" || orderKeys[2] !== "operacional") {
    console.error("Widget ordering did not match seeded configs!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Widget configurations and order verified.");

  // 5. Test Admin Configuration APIs (GET and POST)
  console.log("\n5. Testing Admin KPI Settings API...");
  const adminGetRes = await fetch("http://localhost:3000/api/admin/kpi-config", {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  if (!adminGetRes.ok) {
    console.error("Admin Get Config API failed:", await adminGetRes.text());
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  
  const adminGetData = await adminGetRes.json();
  console.log("Admin config (GET) received successfully.");

  // Let's modify weights and toggle use_real_ai to true
  console.log("Toggling 'use_real_ai' feature flag to true and updating weights...");
  const kpiUpdate = adminGetData.kpis.map(k => {
    if (k.kpi.kpi_key === 'rupture_rate') {
      return { ...k, weight: 50.00 }; // Change rupture weight to 50
    }
    return k;
  });

  const adminPostRes = await fetch("http://localhost:3000/api/admin/kpi-config", {
    method: "POST",
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      kpis: kpiUpdate,
      widgets: widgetsData.widgets,
      use_real_ai: true
    })
  });

  if (!adminPostRes.ok) {
    console.error("Admin Post Config API failed:", await adminPostRes.text());
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }

  console.log("Config post successful.");

  // Assert use_real_ai is active in DB
  const { data: flagActive } = await supabaseAdmin
    .from("cm_feature_flags")
    .select("is_active")
    .eq("flag_key", "use_real_ai")
    .single();

  console.log("AI Provider flag in database is_active:", flagActive.is_active);
  if (flagActive.is_active !== true) {
    console.error("Feature flag use_real_ai was not updated correctly!");
    await cleanAll(adminProfile.id, originalCompanyId);
    process.exit(1);
  }
  console.log("SUCCESS: Feature flag use_real_ai toggling verified.");

  // 6. Cleanup
  await cleanAll(adminProfile.id, originalCompanyId);
  console.log("\nALL SPRINT 6.0 INTEGRATION TESTS PASSED SUCCESSFULLY!");
}

async function cleanAll(adminProfileId, originalCompanyId) {
  console.log("\nCleaning up seeded mock data...");

  // Restore admin company mapping
  await supabaseAdmin
    .from('cm_user_profiles')
    .update({ company_id: originalCompanyId })
    .eq('id', adminProfileId);

  // Clear mock data in proper dependency order
  await supabaseAdmin.from('cm_ai_shelf_analysis').delete().eq('visita_id', '55555555-5555-5555-5555-555555555555');
  await supabaseAdmin.from('cm_promotor_visita').delete().eq('id', '55555555-5555-5555-5555-555555555555');
  await supabaseAdmin.from('cm_sellout_analysis').delete().eq('pdv_id', 'PDV_TEST_KPI_1');
  await supabaseAdmin.from('cm_sellout_analysis').delete().eq('pdv_id', 'PDV_TEST_KPI_2');
  await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', 'PDV_TEST_KPI_1');
  await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', 'PDV_TEST_KPI_2');

  // Delete test company (cascading deletes kpi configs and widgets)
  await supabaseAdmin.from('cm_company').delete().eq('id', "e143e8d6-c7d7-4315-8f54-aa12ce554d2a");

  // Reset feature flag
  await supabaseAdmin
    .from("cm_feature_flags")
    .update({ is_active: false })
    .eq("flag_key", "use_real_ai");
}

run().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
