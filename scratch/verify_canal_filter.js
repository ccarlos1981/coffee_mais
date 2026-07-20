require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log("=== VERIFYING CANAL FILTER (TIPO_PARCEIRO) ===");

  try {
    // 1. Fetch unique channels from cm_clientes
    const { data: channels, error: err1 } = await supabase
      .from("cm_clientes")
      .select("tipo_parceiro")
      .not("tipo_parceiro", "is", null)
      .not("tipo_parceiro", "eq", "");
    
    if (err1) throw err1;

    const unique = Array.from(new Set(channels.map(r => r.tipo_parceiro))).filter(Boolean);
    console.log("Found unique channels:", unique);

    if (unique.length > 0) {
      console.log("✅ Unique channels found!");
      
      // 2. Select clients filtered by one of the unique channels
      const targetChannel = unique[0];
      console.log(`Filtering by channel: "${targetChannel}"`);

      const { data: filtered, error: err2 } = await supabase
        .from("cm_clientes")
        .select("id, codigo, nome_parceiro, tipo_parceiro")
        .eq("tipo_parceiro", targetChannel)
        .limit(3);

      if (err2) throw err2;
      
      console.log("Results sample:", filtered);
      if (filtered.every(c => c.tipo_parceiro === targetChannel)) {
        console.log("✅ Filter query returned correct channel matches!");
      } else {
        console.log("❌ Filter query contains mismatched channels!");
      }
    } else {
      console.log("❌ No unique channels found in cm_clientes!");
    }

  } catch (err) {
    console.error("Error during verification:", err.message);
  }
}

verify();
