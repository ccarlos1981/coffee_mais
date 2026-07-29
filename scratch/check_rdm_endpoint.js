const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkRdmEndpoint() {
  const res = await fetch('http://localhost:3000/api/processo-comercial/rdm?year=2026&month=7&manager=Julliano');
  if (!res.ok) {
    console.log("Response status:", res.status);
    const text = await res.text();
    console.log("Response text:", text);
    return;
  }
  const json = await res.json();
  console.log("RDM Endpoint Response for Julliano 2026-07:");
  console.log(JSON.stringify(json.data?.farol?.month?.invest, null, 2));
}

checkRdmEndpoint().catch(console.error);
