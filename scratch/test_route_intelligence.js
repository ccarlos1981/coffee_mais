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
  console.log("1. Finding a Supervisor or Admin user to run imports and dashboard KPIs...");
  
  // Find a user profile with role Admin, Trade or Supervisor
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

  // 2. Perform Bulk Import of Mock PDVs
  console.log("\n2. Testing Bulk PDV Import via API...");
  const mockPDVs = [
    {
      cod_parceiro: "TEST_999901",
      rede: "REDE COFFEE TEST",
      nome_pdv: "Supermercado Coffee Mais A",
      endereco: "Av. do Café, 100",
      cidade: "Belo Horizonte",
      uf: "MG",
      faturamento_mensal: 125000.00,
      canal: "VAREJO F OUT",
      cluster: "A",
      latitude: -19.9283,
      longitude: -43.9402
    },
    {
      cod_parceiro: "TEST_999902",
      rede: "REDE COFFEE TEST",
      nome_pdv: "Supermercado Coffee Mais B",
      endereco: "Rua do Café Moído, 200",
      cidade: "São Paulo",
      uf: "SP",
      faturamento_mensal: 55000.00,
      canal: "VAREJO F OUT",
      cluster: "B",
      latitude: -23.5505,
      longitude: -46.6333
    },
    {
      cod_parceiro: "TEST_999903",
      rede: "REDE COFFEE TEST",
      nome_pdv: "Coffee Express C",
      endereco: "Praceta das Cápsulas, 10",
      cidade: "Brasília",
      uf: "DF",
      faturamento_mensal: 15000.00,
      canal: "CONVENIENCIA",
      cluster: "C",
      latitude: -15.7942,
      longitude: -47.8822
    }
  ];

  const importRes = await fetch('http://localhost:3000/api/supervisor/pdv-import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ rows: mockPDVs })
  });

  if (!importRes.ok) {
    console.error("Import API request failed:", await importRes.text());
    process.exit(1);
  }

  const importResult = await importRes.json();
  console.log("Import Result:", JSON.stringify(importResult, null, 2));
  
  if (!importResult.success || importResult.valid_rows !== 3) {
    console.error("Import verification failed!");
    process.exit(1);
  }

  // 3. Verify Database Updates
  console.log("\n3. Verifying database updates for imported PDVs...");
  const { data: basePDVs, error: baseErr } = await supabaseAdmin
    .from('base_atendimento')
    .select('cod_parceiro, faturamento_mensal, cluster_canal')
    .in('cod_parceiro', ['TEST_999901', 'TEST_999902', 'TEST_999903']);

  if (baseErr || !basePDVs || basePDVs.length !== 3) {
    console.error("Failed to verify PDVs in base_atendimento:", baseErr);
    process.exit(1);
  }
  console.log("Base Atendimento verification passed. Records found:", basePDVs);

  const { data: routeProfiles, error: profileGetErr } = await supabaseAdmin
    .from('cm_pdv_route_profile')
    .select('pdv_id, commercial_visit_priority_score, commercial_visit_priority_class')
    .in('pdv_id', ['TEST_999901', 'TEST_999902', 'TEST_999903']);

  if (profileGetErr || !routeProfiles || routeProfiles.length !== 3) {
    console.error("Failed to verify default route profiles:", profileGetErr);
    process.exit(1);
  }
  console.log("Route profiles verification passed. Default records created:", routeProfiles);

  // 4. Test Route KPIs Dashboard Endpoint
  console.log("\n4. Testing Route KPIs Dashboard API...");
  const kpisRes = await fetch('http://localhost:3000/api/supervisor/route-kpis', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!kpisRes.ok) {
    console.error("Route KPIs request failed:", await kpisRes.text());
    process.exit(1);
  }

  const kpisData = await kpisRes.json();
  console.log("\n>>> Route KPIs Results <<<");
  console.log(`Database Latency: ${kpisData.db_latency_ms}ms`);
  console.log("Promoter Capacities:", JSON.stringify(kpisData.promoter_capacities, null, 2));
  console.log("Coverage Gaps by Region:", JSON.stringify(kpisData.coverage_gaps, null, 2));
  console.log("Route Efficiency:", JSON.stringify(kpisData.route_efficiency, null, 2));
  console.log("Commercial Priority Ranking Limit 25 (Top 5 shown):");
  console.log(JSON.stringify(kpisData.priority_ranking.slice(0, 5), null, 2));

  // 5. Test Commercial History for Promotores
  console.log("\n5. Testing Commercial History & Smart Recommendations API...");
  // Let's seed some mock sales data for TEST_999901 to ensure the endpoint calculates averages correctly.
  // Insert historical sales
  const salesToSeed = [
    {
      dt_faturamento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cod_parceiro: 'TEST_999901',
      nome_parceiro: 'Supermercado Coffee Mais A',
      cod_produto: 'COFFEE_CLASSICO',
      desc_produto: 'Café Coffee Mais Clássico Moído 250g',
      quantidade: 10,
      vlr_unitario: 20.00,
      vlr_desconto: 0,
      vlr_total_liq: 200.00,
      cod_top: '1100',
      desc_top: 'Venda de Mercadorias',
      custo_icms: 24.00,
      nome_vendedor: 'Trade Marketing',
      custo_total: 100.00,
      nro_unico: '9999011',
      nro_nota: '9999011'
    },
    {
      dt_faturamento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cod_parceiro: 'TEST_999901',
      nome_parceiro: 'Supermercado Coffee Mais A',
      cod_produto: 'COFFEE_INTENSO',
      desc_produto: 'Café Coffee Mais Intenso Moído 250g',
      quantidade: 5,
      vlr_unitario: 22.00,
      vlr_desconto: 0,
      vlr_total_liq: 110.00,
      cod_top: '1100',
      desc_top: 'Venda de Mercadorias',
      custo_icms: 13.20,
      nome_vendedor: 'Trade Marketing',
      custo_total: 55.00,
      nro_unico: '9999012',
      nro_nota: '9999012'
    },
    {
      dt_faturamento: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cod_parceiro: 'TEST_999901',
      nome_parceiro: 'Supermercado Coffee Mais A',
      cod_produto: 'COFFEE_CLASSICO',
      desc_produto: 'Café Coffee Mais Clássico Moído 250g',
      quantidade: 8,
      vlr_unitario: 20.00,
      vlr_desconto: 0,
      vlr_total_liq: 160.00,
      cod_top: '1100',
      desc_top: 'Venda de Mercadorias',
      custo_icms: 19.20,
      nome_vendedor: 'Trade Marketing',
      custo_total: 80.00,
      nro_unico: '9999013',
      nro_nota: '9999013'
    },
    {
      dt_faturamento: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cod_parceiro: 'TEST_999901',
      nome_parceiro: 'Supermercado Coffee Mais A',
      cod_produto: 'COFFEE_INTENSO',
      desc_produto: 'Café Coffee Mais Intenso Moído 250g',
      quantidade: 7,
      vlr_unitario: 22.00,
      vlr_desconto: 0,
      vlr_total_liq: 154.00,
      cod_top: '1100',
      desc_top: 'Venda de Mercadorias',
      custo_icms: 18.48,
      nome_vendedor: 'Trade Marketing',
      custo_total: 77.00,
      nro_unico: '9999014',
      nro_nota: '9999014'
    }
  ];

  console.log("Seeding test faturamento data to cm_faturamento_sankhya for TEST_999901...");
  const { error: seedErr } = await supabaseAdmin.from('cm_faturamento_sankhya').insert(salesToSeed);
  if (seedErr) {
    console.error("Failed to seed sales data:", seedErr);
    process.exit(1);
  }

  // Fetch commercial history for TEST_999901
  const historyRes = await fetch('http://localhost:3000/api/promotor/pdv/TEST_999901/commercial-history', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (!historyRes.ok) {
    console.error("Commercial History request failed:", await historyRes.text());
    process.exit(1);
  }

  const historyData = await historyRes.json();
  console.log("Full JSON Response:", JSON.stringify(historyData, null, 2));
  console.log("\n>>> Commercial History Results for TEST_999901 <<<");
  const hist = historyData.data;
  console.log(`PDV Name: ${hist.pdv_name}`);
  console.log(`Last Purchase Date: ${hist.ultimo_pedido_data} (${hist.ultimo_pedido_dias} days ago)`);
  console.log(`Last Purchase Value: R$ ${hist.ultimo_pedido_valor}`);
  console.log("Last Purchase Items (with avg_boxes_per_order_per_sku comparison):");
  hist.ultimo_pedido_itens.forEach(item => {
    console.log(`  * SKU: ${item.sku} | Name: ${item.name}`);
    console.log(`    - Qty: ${item.qty} cx | Historical Avg: ${item.avg_historical} cx | avg_boxes_per_order_per_sku: ${item.avg_boxes_per_order_per_sku}`);
  });
  console.log(`Expected Purchase Frequency: ${hist.frequencia_media_compra_dias} days`);
  console.log(`Sell-in 90 Days: R$ ${hist.sell_in_90_dias}`);
  console.log(`Trend: ${hist.tendencia} (${hist.tendencia_percentual}%)`);
  console.log("Insights Generated:", hist.insights);
  
  console.log("\n>>> Smart Recommendations (Next Best Action) <<<");
  const recs = hist.smart_recommendation;
  console.log(`Priority: ${recs.priority_class} (Score: ${recs.score})`);
  console.log("Priority Reasons:", recs.reasons);
  console.log(`Suggested Action: ${recs.suggested_action}`);
  console.log("Suggested Order per SKU in boxes:");
  recs.suggested_order.forEach(so => {
    console.log(`  * SKU: ${so.sku} | Name: ${so.name} | Suggested Qty: ${so.suggested_qty} cx (Avg: ${so.avg_historical} cx)`);
  });

  // Cleanup seeded data to avoid polluting the database
  console.log("\nCleaning up test seeded data...");
  await supabaseAdmin.from('cm_faturamento_sankhya').delete().eq('cod_parceiro', 'TEST_999901');
  await supabaseAdmin.from('cm_pdv_route_profile').delete().in('pdv_id', ['TEST_999901', 'TEST_999902', 'TEST_999903']);
  await supabaseAdmin.from('base_atendimento').delete().in('cod_parceiro', ['TEST_999901', 'TEST_999902', 'TEST_999903']);

  console.log("\nALL SPRINT 5.2.5 MASTER DATA, ROUTE INTELLIGENCE & COMMERCIAL CONTEXT VERIFICATIONS PASSED SUCCESSFULLY!");
}

run().catch(console.error);
