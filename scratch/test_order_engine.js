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
  console.log("1. Finding a Supervisor or Admin user to run order engine test...");
  
  const { data: adminProfiles, error: profileErr } = await supabaseAdmin
    .from('cm_user_profiles')
    .select('id, role')
    .in('role', ['Admin', 'Trade', 'Supervisor'])
    .limit(1);

  if (profileErr || !adminProfiles || adminProfiles.length === 0) {
    console.error("Failed to find any Admin/Supervisor user profile:", profileErr);
    process.exit(1);
  }

  const adminProfile = adminProfiles[0];
  console.log(`Found supervisor profile: ID ${adminProfile.id}, Role: ${adminProfile.role}`);

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

  // 2. Seed Mock PDV, planogram, sales, shelf photo analysis, sellout, and price analysis
  console.log("\n2. Seeding mock data for TEST_ORDER_PDV...");
  
  // Seed base_atendimento
  const pdvRecord = {
    cod_parceiro: "TEST_ORDER_PDV",
    rede: "REDE COFFEE TEST",
    nome_fantasia: "Supermercado Recomendacao Teste",
    endereco: "Av. de Vendas, 200",
    cidade: "Belo Horizonte",
    uf: "MG",
    faturamento_mensal: 150000.00,
    canal: "VAREJO F OUT",
    cluster_canal: "A"
  };

  const { error: pdvErr } = await supabaseAdmin.from('base_atendimento').insert(pdvRecord);
  if (pdvErr) {
    console.error("Failed to seed base_atendimento:", pdvErr);
    process.exit(1);
  }

  // Seed planogram
  const planogramRecord = {
    pdv_id: "TEST_ORDER_PDV",
    sku: "COFFEE_MAIS_CLASSICO",
    expected_facings: 4,
    shelf_number: 1
  };
  const { error: planErr } = await supabaseAdmin.from('cm_pdv_planograma').insert(planogramRecord);
  if (planErr) {
    console.error("Failed to seed planogram:", planErr);
    await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', 'TEST_ORDER_PDV');
    process.exit(1);
  }

  // Seed sales (Last purchase 10 days ago, quantity = 20)
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const saleRecord = {
    dt_faturamento: tenDaysAgo,
    cod_parceiro: 'TEST_ORDER_PDV',
    nome_parceiro: 'Supermercado Recomendacao Teste',
    cod_produto: 'COFFEE_MAIS_CLASSICO',
    desc_produto: 'Café Clássico Moído 250g',
    quantidade: 20,
    vlr_unitario: 20.00,
    vlr_desconto: 0,
    vlr_total_liq: 400.00,
    cod_top: '1100',
    desc_top: 'Venda de Mercadorias',
    custo_icms: 48.00,
    nome_vendedor: 'Trade Marketing',
    custo_total: 200.00,
    nro_unico: '9999222',
    nro_nota: '9999222'
  };

  const { error: saleErr } = await supabaseAdmin.from('cm_faturamento_sankhya').insert(saleRecord);
  if (saleErr) {
    console.error("Failed to seed sales data:", saleErr);
    await supabaseAdmin.from('cm_pdv_planograma').delete().eq('pdv_id', 'TEST_ORDER_PDV');
    await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', 'TEST_ORDER_PDV');
    process.exit(1);
  }

  // Find daily agenda to seed visit
  const { data: agenda, error: agendaErr } = await supabaseAdmin
    .from('cm_promotor_agenda_diaria')
    .select('id, promotor_id')
    .limit(1)
    .single();

  if (agendaErr || !agenda) {
    console.error("Failed to find daily agenda to seed visit:", agendaErr);
    await cleanAll(null);
    process.exit(1);
  }

  const agendaId = agenda.id;
  const employeeId = agenda.promotor_id;

  const visitRecord = {
    agenda_diaria_id: agendaId,
    cod_parceiro: 'TEST_ORDER_PDV',
    status: 'CONCLUIDA',
    checkin_servidor: new Date().toISOString(),
    checkout_servidor: new Date().toISOString()
  };

  const { data: visit, error: visitErr } = await supabaseAdmin.from('cm_promotor_visita').insert(visitRecord).select().single();
  if (visitErr || !visit) {
    console.error("Failed to seed visit record:", visitErr);
    await cleanAll(null);
    process.exit(1);
  }

  // Seed shelf analysis
  const shelfRecord = {
    visita_id: visit.id,
    promotor_id: employeeId,
    photo_url: 'https://coffeemais.com/mock-order-shelf.jpg',
    total_facings: 12,
    coffee_mais_facings: 8,
    shelf_share_percent: 40.00,
    rupture_status: 'PARCIAL',
    planogram_score: 85,
    ai_confidence: 0.95,
    analysis_status: 'DONE',
    detected_products: [
      {
        sku: 'COFFEE_MAIS_CLASSICO',
        product_name: 'Café Clássico Moído 250g',
        facings: 8,
        confidence: 0.95,
        shelf_number: 1,
        position_ok: true,
        competitor_intrusion: false
      }
    ]
  };

  const { data: shelfResult, error: shelfErr } = await supabaseAdmin.from('cm_ai_shelf_analysis').insert(shelfRecord).select().single();
  if (shelfErr || !shelfResult) {
    console.error("Failed to seed shelf analysis:", shelfErr);
    await cleanAll(visit.id);
    process.exit(1);
  }

  // Seed price analysis
  const priceRecord = {
    visita_id: visit.id,
    analysis_id: shelfResult.id,
    ocr_status: 'DONE',
    pricing_risk: 'COMPETITIVE',
    commercial_opportunity: 'STABLE',
    commercial_opportunity_score: 50.00
  };
  const { error: priceErr } = await supabaseAdmin.from('cm_ai_price_analysis').insert(priceRecord);
  if (priceErr) {
    console.error("Failed to seed price analysis:", priceErr);
    await cleanAll(visit.id);
    process.exit(1);
  }

  // Seed sellout analysis
  const selloutRecord = {
    pdv_id: 'TEST_ORDER_PDV',
    sku: 'COFFEE_MAIS_CLASSICO',
    estimated_stock_boxes: 8.00,
    sellout_velocity: 1.20,
    days_of_inventory: 6.70,
    stock_risk: 'HIGH',
    suggested_order_boxes: 9.00
  };
  const { error: selloutErr } = await supabaseAdmin.from('cm_sellout_analysis').insert(selloutRecord);
  if (selloutErr) {
    console.error("Failed to seed sellout analysis:", selloutErr);
    await cleanAll(visit.id);
    process.exit(1);
  }

  // 3. Test dynamic Promoter Order Recommendation API
  console.log("\n3. Testing Promoter Order Recommendation API...");
  const orderRes = await fetch(`http://localhost:3000/api/promotor/pdv/TEST_ORDER_PDV/order-recommendation?visita_id=${visit.id}`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!orderRes.ok) {
    console.error("Promoter Order Recommendation API request failed:", await orderRes.text());
    await cleanAll(visit.id);
    process.exit(1);
  }

  const orderData = await orderRes.json();
  console.log("Full JSON Response from API:");
  console.log(JSON.stringify(orderData, null, 2));

  if (!orderData.success || !orderData.recommendation) {
    console.error("Verification of promoter order recommendation API failed!");
    await cleanAll(visit.id);
    process.exit(1);
  }

  const rec = orderData.recommendation;
  const classicItem = rec.items.find(i => i.sku === 'COFFEE_MAIS_CLASSICO');

  if (!classicItem) {
    console.error("COFFEE_MAIS_CLASSICO order recommendation missing!");
    await cleanAll(visit.id);
    process.exit(1);
  }

  console.log("\n>>> Verified SKU Calculations <<<");
  console.log(`SKU: ${classicItem.sku}`);
  console.log(`Priority Score: ${classicItem.priority_score} (Expected: 55)`);
  console.log(`Suggested Boxes: ${classicItem.suggested_boxes} (Expected: 12)`);
  console.log(`Unit Price: ${classicItem.unit_price} (Expected: 60)`);
  console.log(`Subtotal: ${classicItem.subtotal} (Expected: 720)`);
  console.log(`Reasons: ${JSON.stringify(classicItem.reason)}`);

  console.log("\n>>> Verified Consolidated Recommendation <<<");
  console.log(`Total Recommended Value: ${rec.total_recommended_value} (Expected: 720)`);
  console.log(`Total Recommended Boxes: ${rec.total_recommended_boxes} (Expected: 12)`);
  console.log(`Urgency Level: ${rec.urgency_level} (Expected: MEDIUM)`);
  console.log(`Conversion Probability: ${rec.conversion_probability}% (Expected: 90%)`);

  if (
    classicItem.priority_score !== 55 ||
    classicItem.suggested_boxes !== 12 ||
    classicItem.unit_price !== 60 ||
    classicItem.subtotal !== 720 ||
    rec.total_recommended_value !== 720 ||
    rec.total_recommended_boxes !== 12 ||
    rec.urgency_level !== "MEDIUM" ||
    rec.conversion_probability !== 90
  ) {
    console.error("Calculation mismatch! Verification FAILED.");
    await cleanAll(visit.id);
    process.exit(1);
  }
  console.log("SUCCESS: Order recommendation calculations match perfectly!");

  // Verify DB entries
  console.log("\n>>> Database Record Verification <<<");
  const { data: dbRec } = await supabaseAdmin
    .from('cm_order_recommendation')
    .select('*')
    .eq('visita_id', visit.id)
    .single();
  console.log("Persisted Recommendation in DB:", dbRec);

  const { data: dbItems } = await supabaseAdmin
    .from('cm_order_recommendation_item')
    .select('*')
    .eq('recommendation_id', dbRec.id);
  console.log("Persisted Recommendation Items in DB:", dbItems);

  // 4. Test Supervisor KPIs API
  console.log("\n4. Testing Supervisor Order KPIs API...");
  const kpisRes = await fetch('http://localhost:3000/api/supervisor/order-kpis', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!kpisRes.ok) {
    console.error("Supervisor Order KPIs request failed:", await kpisRes.text());
    await cleanAll(visit.id);
    process.exit(1);
  }

  const kpisData = await kpisRes.json();
  console.log("\n>>> Supervisor KPIs Results <<<");
  console.log(`Latency: ${kpisData.db_latency_ms}ms`);
  console.log("Potential Revenue by Region:", JSON.stringify(kpisData.data.potential_revenue_by_region, null, 2));
  console.log("Conversion Probability Distribution:", JSON.stringify(kpisData.data.conversion_probability_distribution, null, 2));
  console.log("Top Opportunity PDVs:", JSON.stringify(kpisData.data.top_opportunity_pdvs, null, 2));
  console.log("Recommended SKUs Ranking:", JSON.stringify(kpisData.data.recommended_skus, null, 2));
  console.log("Lost Opportunities Board:", JSON.stringify(kpisData.data.lost_opportunities, null, 2));

  // Verify that our test PDV is aggregated in supervisor KPIs
  const testPdvKpi = kpisData.data.top_opportunity_pdvs.find(p => p.pdv_id === 'TEST_ORDER_PDV');
  if (!testPdvKpi) {
    console.error("TEST_ORDER_PDV missing from Supervisor top opportunities!");
    await cleanAll(visit.id);
    process.exit(1);
  }
  console.log("SUCCESS: Supervisor KPIs aggregated test data correctly.");

  // Cleanup
  await cleanAll(visit.id);
  console.log("\nALL SPRINT 5.4 ORDER ENGINE INTEGRATION TESTS PASSED SUCCESSFULLY!");
}

async function cleanAll(visitId) {
  console.log("\nCleaning up seeded mock data...");
  if (visitId) {
    const { data: rec } = await supabaseAdmin.from('cm_order_recommendation').select('id').eq('visita_id', visitId).maybeSingle();
    if (rec) {
      await supabaseAdmin.from('cm_order_recommendation_item').delete().eq('recommendation_id', rec.id);
    }
    await supabaseAdmin.from('cm_order_recommendation').delete().eq('visita_id', visitId);
    await supabaseAdmin.from('cm_ai_price_analysis').delete().eq('visita_id', visitId);
    
    const { data: shelf } = await supabaseAdmin.from('cm_ai_shelf_analysis').select('id').eq('visita_id', visitId).maybeSingle();
    if (shelf) {
      await supabaseAdmin.from('cm_ai_shelf_analysis').delete().eq('id', shelf.id);
    }
    await supabaseAdmin.from('cm_promotor_visita').delete().eq('id', visitId);
  }
  
  await supabaseAdmin.from('cm_sellout_analysis').delete().eq('pdv_id', 'TEST_ORDER_PDV');
  await supabaseAdmin.from('cm_faturamento_sankhya').delete().eq('cod_parceiro', 'TEST_ORDER_PDV');
  await supabaseAdmin.from('cm_pdv_planograma').delete().eq('pdv_id', 'TEST_ORDER_PDV');
  await supabaseAdmin.from('base_atendimento').delete().eq('cod_parceiro', 'TEST_ORDER_PDV');
}

run().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
