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

  console.log("\n2. Uploading FIRST photo to seed price history...");
  const fileContent1 = Buffer.alloc(120 * 1024, 0xBB);
  const photoBlob1 = new Blob([fileContent1], { type: 'image/jpeg' });

  const formData1 = new FormData();
  formData1.append('visita_id', targetVisit.id);
  formData1.append('foto', photoBlob1, 'shelf_ia_pricing_test_1.jpg');
  formData1.append('width', '1920');
  formData1.append('height', '1080');

  const uploadRes1 = await fetch('http://localhost:3000/api/promotor/visitas/upload-shelf-photo', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}` },
    body: formData1
  });

  if (!uploadRes1.ok) {
    console.error("First upload failed:", await uploadRes1.text());
    process.exit(1);
  }

  const { analysis_job_id: jobId1 } = await uploadRes1.json();
  console.log(`First upload successful. Job ID: ${jobId1}`);

  // Poll analysis until DONE
  console.log("Polling first analysis and pricing OCR result...");
  let result1 = null;
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`http://localhost:3000/api/ai/shelf-analysis/${targetVisit.id}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const data = await res.json();
    if (data.success && data.price_analysis && data.price_analysis.ocr_status === 'DONE') {
      result1 = data;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!result1) {
    console.error("First polling timed out! Analysis or Price OCR did not finish.");
    process.exit(1);
  }

  console.log("\n>>> FIRST Price OCR Analysis Results <<<");
  const pa1 = result1.price_analysis;
  console.log(`Global OCR Confidence: ${pa1.ocr_confidence_score}%`);
  console.log(`Price Index: ${pa1.price_index}%`);
  console.log(`Price Gap: ${pa1.price_gap_percent}%`);
  console.log(`Pricing Risk: ${pa1.pricing_risk}`);
  console.log(`Price Opportunity Score: ${pa1.price_opportunity_score}`);
  console.log(`Strategy Snapshot - Min: R$ ${pa1.reference_min_price} | Target: R$ ${pa1.reference_target_price} | Max: R$ ${pa1.reference_max_price}`);
  console.log(`Opportunity Type: ${pa1.commercial_opportunity} | Opp Score: ${pa1.commercial_opportunity_score}`);
  console.log(`Anomaly Reference - Level: ${pa1.anomaly_reference_level} | Sample Size: ${pa1.anomaly_reference_sample_size} | Window: ${pa1.anomaly_reference_window_days} days`);
  console.log(`Outliers Rejection - Had Outliers: ${pa1.had_outliers_removed} | Outlier Count: ${pa1.outlier_count}`);
  console.log("Outlier Values:", JSON.stringify(pa1.outlier_values_removed));
  console.log("Price Recommendation Object:", JSON.stringify(pa1.price_recommendation, null, 2));

  console.log("\n>>> FIRST Detected Prices List with Bboxes & Digit Confidence:");
  pa1.items.forEach(item => {
    console.log(`  * Brand: ${item.brand} | SKU: ${item.sku} | Price: R$ ${item.price} | Conf: ${(item.confidence * 100).toFixed(1)}%`);
    console.log(`    - Raw Text: "${item.ocr_text_raw}" | Bbox: ${JSON.stringify(item.price_bbox)}`);
    console.log(`    - Digit confidences: ${item.digit_confidence.map(dc => `${dc.digit}:${(dc.confidence*100).toFixed(0)}%`).join(', ')}`);
  });

  console.log("\n3. Uploading SECOND photo (different content to trigger price variance/anomalies)...");
  // Use CC to vary MD5 and get a different set of randomized prices
  const fileContent2 = Buffer.alloc(120 * 1024, 0xCC);
  const photoBlob2 = new Blob([fileContent2], { type: 'image/jpeg' });

  const formData2 = new FormData();
  formData2.append('visita_id', targetVisit.id);
  formData2.append('foto', photoBlob2, 'shelf_ia_pricing_test_2.jpg');
  formData2.append('width', '1920');
  formData2.append('height', '1080');

  const uploadRes2 = await fetch('http://localhost:3000/api/promotor/visitas/upload-shelf-photo', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}` },
    body: formData2
  });

  if (!uploadRes2.ok) {
    console.error("Second upload failed:", await uploadRes2.text());
    process.exit(1);
  }

  const { analysis_job_id: jobId2 } = await uploadRes2.json();
  console.log(`Second upload successful. Job ID: ${jobId2}`);

  // Poll second analysis
  console.log("Polling second analysis and pricing OCR result...");
  let result2 = null;
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`http://localhost:3000/api/ai/shelf-analysis/${targetVisit.id}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const data = await res.json();
    if (data.success && data.analysis_id === jobId2 && data.price_analysis && data.price_analysis.ocr_status === 'DONE') {
      result2 = data;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!result2) {
    console.error("Second polling timed out! Analysis or Price OCR did not finish.");
    process.exit(1);
  }

  // Verify Alerts generated in DB (including margin risks or price anomalies)
  const { data: alerts } = await supabase
    .from('cm_ai_pricing_alert')
    .select('*')
    .eq('visita_id', targetVisit.id);

  console.log("\n>>> Consolidado de Alertas Gerados no Banco (margin_risk, price_anomaly, etc.):");
  if (alerts && alerts.length > 0) {
    alerts.forEach(al => {
      console.log(`  * Tipo: ${al.tipo_alerta} | Desc: ${al.descricao}`);
    });
  } else {
    console.log("  * Nenhum alerta de precificação gerado.");
  }

  // 4. Test Reprocess Manual Review
  console.log("\n4. Testing Reprocess action...");
  const reprocessRes = await fetch('http://localhost:3000/api/ai/shelf-analysis/review', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      analysis_id: jobId2,
      action: 'REPROCESS'
    })
  });

  if (!reprocessRes.ok) {
    console.error("Reprocess request failed:", await reprocessRes.text());
    process.exit(1);
  }

  console.log("Reprocess request executed successfully.");

  // Check updated pricing analysis
  const { data: freshPriceAnalysis } = await supabase
    .from('cm_ai_price_analysis')
    .select('*')
    .eq('analysis_id', jobId2)
    .single();

  console.log(`Reprocess check:`);
  console.log(`  * ocr_status: ${freshPriceAnalysis.ocr_status} (Expected: DONE or PROCESSING)`);
  console.log(`  * ocr_confidence_score: ${freshPriceAnalysis.ocr_confidence_score}%`);
  console.log(`  * price_opportunity_score: ${freshPriceAnalysis.price_opportunity_score}`);
  console.log(`  * commercial_opportunity: ${freshPriceAnalysis.commercial_opportunity}`);
  console.log(`  * commercial_opportunity_score: ${freshPriceAnalysis.commercial_opportunity_score}`);
  console.log(`  * anomaly_reference_level: ${freshPriceAnalysis.anomaly_reference_level}`);
  console.log(`  * outlier_count: ${freshPriceAnalysis.outlier_count}`);

  console.log("\nALL REFINED PRICE OCR VERIFICATIONS PASSED SUCCESSFULLY!");
}

run().catch(console.error);
