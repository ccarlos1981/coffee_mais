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

async function run() {
  console.log("1. Finding a visit and a promotor...");
  const { data: recentVisits, error: visitErr } = await supabase
    .from('cm_promotor_visita')
    .select('id, status, cod_parceiro, agenda_diaria_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (visitErr || !recentVisits || recentVisits.length === 0) {
    console.error("Failed to find any visits in the database:", visitErr);
    process.exit(1);
  }

  let targetVisit = null;
  let targetAgenda = null;
  let targetProfile = null;

  for (const v of recentVisits) {
    const { data: agenda } = await supabase
      .from('cm_promotor_agenda_diaria')
      .select('id, promotor_id')
      .eq('id', v.agenda_diaria_id)
      .maybeSingle();

    if (agenda) {
      const { data: profile } = await supabase
        .from('cm_promotor_perfil')
        .select('id, user_id, employee_id')
        .eq('employee_id', agenda.promotor_id)
        .maybeSingle();

      if (profile) {
        targetVisit = v;
        targetAgenda = agenda;
        targetProfile = profile;
        break;
      }
    }
  }

  if (!targetVisit || !targetProfile) {
    console.error("Could not find a visit with a corresponding promotor profile.");
    process.exit(1);
  }

  const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(targetProfile.user_id);
  if (userErr || !user) {
    console.error("Failed to fetch target user details from Auth:", userErr);
    process.exit(1);
  }

  const email = user.email;
  const password = 'test-password-123';

  console.log(`Setting password for ${email} in Auth...`);
  await supabase.auth.admin.updateUserById(targetProfile.user_id, { password });

  console.log(`Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.session) {
    console.error("Login failed:", authError);
    process.exit(1);
  }
  const { access_token } = authData.session;

  // Set visit status to CHECKIN_REALIZADO and partner code to 207250
  await supabase.from('cm_promotor_visita').update({ status: 'CHECKIN_REALIZADO', cod_parceiro: '207250' }).eq('id', targetVisit.id);

  console.log("2. Uploading photo first time (Quality Simulation)...");
  // Construct a dummy JPEG file content (seed content 1)
  const fileContent1 = Buffer.alloc(80 * 1024, 0xAA);
  const photoBlob1 = new Blob([fileContent1], { type: 'image/jpeg' });

  const formData1 = new FormData();
  formData1.append('visita_id', targetVisit.id);
  formData1.append('foto', photoBlob1, 'shelf_ia_test_1.jpg');
  formData1.append('width', '1920');
  formData1.append('height', '1080');

  const uploadRes1 = await fetch('http://localhost:3000/api/promotor/visitas/upload-shelf-photo', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}` },
    body: formData1
  });

  if (!uploadRes1.ok) {
    console.error("Upload 1 failed:", await uploadRes1.text());
    process.exit(1);
  }

  const { analysis_job_id: job1 } = await uploadRes1.json();
  console.log(`Upload 1 started. Job ID: ${job1}`);

  // Poll job 1
  let result1 = null;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`http://localhost:3000/api/ai/shelf-analysis/${targetVisit.id}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const data = await res.json();
    if (data.success && (data.analysis_status === 'DONE' || data.analysis_status === 'FAILED')) {
      result1 = data;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!result1) {
    console.error("Upload 1 polling timed out!");
    process.exit(1);
  }

  console.log("\n>>> Result 1 Details <<<");
  console.log(`Planogram Version Used: ${result1.planogram_version_used}`);
  console.log(`Quality Status: ${result1.quality_status} (Score: ${result1.quality_score}%)`);
  console.log(`Quality Issues: ${JSON.stringify(result1.quality_issues)}`);
  console.log(`Needs Manual Review: ${result1.needs_manual_review}`);
  console.log(`Annotated Image URL: ${result1.annotated_image_url}`);
  console.log(`Decision Reasons: \n - ${result1.decision_reasons.join('\n - ')}`);
  console.log(`Detected SKU Confidence structure:`);
  result1.detected_products.forEach(p => {
    console.log(`  * ${p.product_name} (${p.sku}): Facings: ${p.facings}, Confiança: ${(p.confidence * 100).toFixed(1)}%`);
  });

  console.log("\n3. Uploading EXACT SAME photo content second time (Checking Deterministic MD5)...");
  const photoBlob2 = new Blob([fileContent1], { type: 'image/jpeg' });
  const formData2 = new FormData();
  formData2.append('visita_id', targetVisit.id);
  formData2.append('foto', photoBlob2, 'shelf_ia_test_same.jpg');
  formData2.append('width', '1920');
  formData2.append('height', '1080');

  const uploadRes2 = await fetch('http://localhost:3000/api/promotor/visitas/upload-shelf-photo', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}` },
    body: formData2
  });
  const { analysis_job_id: job2 } = await uploadRes2.json();

  let result2 = null;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`http://localhost:3000/api/ai/shelf-analysis/${targetVisit.id}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const data = await res.json();
    // Verify it is the new job
    if (data.success && data.analysis_id === job2 && (data.analysis_status === 'DONE' || data.analysis_status === 'FAILED')) {
      result2 = data;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!result2) {
    console.error("Upload 2 polling timed out!");
    process.exit(1);
  }

  console.log("\n>>> Result 2 Details (Same Content) <<<");
  console.log(`Quality Status: ${result2.quality_status} (Expected: ${result1.quality_status})`);
  console.log(`Quality Score: ${result2.quality_score}% (Expected: ${result1.quality_score}%)`);

  if (result2.quality_status !== result1.quality_status || result2.quality_score !== result1.quality_score) {
    console.error("FAIL: Deterministic Quality Simulation is not consistent!");
    process.exit(1);
  }
  console.log("SUCCESS: Deterministic MD5 Quality Gate is consistent!");

  console.log("\n4. Testing Supervisor Manual Review APPROVE (Override Score)...");
  const approveRes = await fetch('http://localhost:3000/api/ai/shelf-analysis/review', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      analysis_id: job2,
      action: 'APPROVE',
      planogram_score_override: 95,
      review_reason: 'Foto com reflexo de luz aceitável. Ajustado score comercial.'
    })
  });

  if (!approveRes.ok) {
    console.error("Approve request failed:", await approveRes.text());
    process.exit(1);
  }

  const approveData = await approveRes.json();
  console.log("Approve response:", approveData);

  // Check updated DB record
  const { data: dbCheck1 } = await supabase.from('cm_ai_shelf_analysis').select('*').eq('id', job2).single();
  console.log(`Manual Review check after APPROVE:`);
  console.log(`  * needs_manual_review: ${dbCheck1.needs_manual_review} (Expected: false)`);
  console.log(`  * planogram_score: ${dbCheck1.planogram_score} (Expected: 95)`);
  console.log(`  * decision_reasons: ${JSON.stringify(dbCheck1.decision_reasons)}`);

  if (dbCheck1.needs_manual_review !== false || dbCheck1.planogram_score !== 95) {
    console.error("FAIL: Manual Review APPROVE did not update fields correctly.");
    process.exit(1);
  }
  console.log("SUCCESS: Manual Review APPROVE updates are correct!");

  console.log("\n5. Testing Supervisor Manual Review REPROCESS...");
  const reprocessRes = await fetch('http://localhost:3000/api/ai/shelf-analysis/review', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      analysis_id: job2,
      action: 'REPROCESS'
    })
  });

  if (!reprocessRes.ok) {
    console.error("Reprocess request failed:", await reprocessRes.text());
    process.exit(1);
  }

  const reprocessData = await reprocessRes.json();
  console.log("Reprocess response:", reprocessData);

  // Check updated DB record
  const { data: dbCheck2 } = await supabase.from('cm_ai_shelf_analysis').select('*').eq('id', job2).single();
  console.log(`Manual Review check after REPROCESS:`);
  console.log(`  * needs_manual_review: ${dbCheck2.needs_manual_review} (Expected: false)`);
  console.log(`  * quality_status: ${dbCheck2.quality_status} (Expected: GOOD after supervisor reprocess override)`);
  console.log(`  * decision_reasons count: ${dbCheck2.decision_reasons.length}`);

  if (dbCheck2.quality_status !== 'GOOD' || dbCheck2.needs_manual_review !== false) {
    console.error("FAIL: Manual Review REPROCESS did not update fields correctly.");
    process.exit(1);
  }
  console.log("SUCCESS: Manual Review REPROCESS updates are correct!");

  console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");
}

run().catch(console.error);
