require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing environment variables NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testAuditTrigger() {
  console.log("🚀 Starting database trigger and history audit tests...");

  // 1. Fetch a promoter ID to use
  const { data: promoters, error: pError } = await supabase.from('cm_user_profiles').select('id').eq('role', 'Promotor').limit(1);
  if (pError || !promoters || promoters.length === 0) {
    console.error("❌ Failed to fetch a promoter for testing:", pError);
    process.exit(1);
  }
  const testPromoterId = promoters[0].id;

  // 2. Insert dummy meta
  const testRede = "TEST_INTEGRITY_REDE";
  const testUf = "SP";
  const testMonth = 7;
  const testCycle = "2026_Q3_TEST";
  const testVersion = 999;

  console.log(`\n1. Creating test target: Promoter ID ${testPromoterId}, Month: ${testMonth}, Units: 500`);
  
  // Clean up any leftovers first
  await supabase.from('cm_promotor_metas').delete()
    .eq('promotor_id', testPromoterId)
    .eq('planning_cycle', testCycle);

  const { data: insertData, error: insertError } = await supabase
    .from('cm_promotor_metas')
    .insert([{
      promotor_id: testPromoterId,
      promotor_name_snapshot: "Test Promoter",
      rede: testRede,
      uf: testUf,
      planning_cycle: testCycle,
      version: testVersion,
      year: 2026,
      month: testMonth,
      status: "DRAFT",
      volume_target_units: 500,
      volume_target_boxes: 25,
      quarter_target: 25,
      quarter_gap: 25
    }])
    .select();

  if (insertError) {
    console.error("❌ Insert failed:", insertError.message);
    process.exit(1);
  }
  console.log("✅ Target row inserted successfully!");

  const targetId = insertData[0].id;

  // 3. Verify history insert
  console.log(`\n2. Verifying history row for INSERT (expecting null -> 500)`);
  const { data: insertHist, error: insertHistErr } = await supabase
    .from('cm_promotor_metas_history')
    .select('*')
    .eq('meta_id', targetId);

  if (insertHistErr) {
    console.error("❌ Failed to query history table:", insertHistErr);
    process.exit(1);
  }

  if (insertHist.length === 1 && insertHist[0].valor_anterior === null && parseFloat(insertHist[0].valor_novo) === 500) {
    console.log("✅ Trigger recorded INSERT correctly!");
  } else {
    console.error("❌ Trigger INSERT audit mismatch:", insertHist);
    process.exit(1);
  }

  // 4. Update meta value
  console.log(`\n3. Updating target units from 500 to 750`);
  const { error: updateError } = await supabase
    .from('cm_promotor_metas')
    .update({ volume_target_units: 750 })
    .eq('id', targetId);

  if (updateError) {
    console.error("❌ Update failed:", updateError.message);
    process.exit(1);
  }
  console.log("✅ Target row updated successfully!");

  // 5. Verify history update
  console.log(`\n4. Verifying history row for UPDATE (expecting 500 -> 750)`);
  const { data: updateHist, error: updateHistErr } = await supabase
    .from('cm_promotor_metas_history')
    .select('*')
    .eq('meta_id', targetId)
    .order('data_hora', { ascending: true });

  if (updateHistErr) {
    console.error("❌ Failed to query history table:", updateHistErr);
    process.exit(1);
  }

  if (updateHist.length === 2 && 
      parseFloat(updateHist[1].valor_anterior) === 500 && 
      parseFloat(updateHist[1].valor_novo) === 750) {
    console.log("✅ Trigger recorded UPDATE correctly!");
  } else {
    console.error("❌ Trigger UPDATE audit mismatch:", updateHist);
    process.exit(1);
  }

  // 6. Clean up
  console.log("\n5. Cleaning up test data...");
  const { error: cleanupError } = await supabase
    .from('cm_promotor_metas')
    .delete()
    .eq('id', targetId);

  if (cleanupError) {
    console.error("❌ Clean up failed:", cleanupError);
  } else {
    console.log("✅ Clean up completed successfully!");
  }

  console.log("\n📊 TRIGGER AUDIT TEST RESULT: 🟢 ALL TESTS PASSED!");
}

testAuditTrigger().catch(console.error);
