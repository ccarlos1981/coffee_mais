import { createClient } from "@supabase/supabase-js";
import { AnalyticsEngine } from "@/lib/governance/analytics";
import fs from "fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== RUNNING ANALYTICS ENGINE DIRECTLY FOR AUGUST 2026 ===");

  const filters = {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    startMonth: "2026-08",
    endMonth: "2026-08"
  };

  const rawData = await AnalyticsEngine.getVendasSummary(filters);

  console.log(`rowsCur count: ${rawData.rowsCur.length}`);
  console.log(`rowsCurClient count: ${rawData.rowsCurClient.length}`);
  console.log(`rowsPm count: ${rawData.rowsPm.length}`);
  console.log(`rowsPmClient count: ${rawData.rowsPmClient.length}`);

  console.log("\n--- rowsCur (mv_vendas_mensal) ---");
  console.log(rawData.rowsCur);

  console.log("\n--- rowsCurClient (mv_vendas_cliente_mensal) ---");
  console.log(rawData.rowsCurClient);

  console.log("\n--- rowsPmClient (Julho/2026) sample ---");
  console.log(rawData.rowsPmClient.slice(0, 15));

  fs.writeFileSync(
    "/Users/cristiano/.gemini/antigravity-ide/brain/d5b38990-d03d-4a3c-aaf2-7867656fc471/scratch/analytics_engine_output.json",
    JSON.stringify(rawData, null, 2)
  );
}

main().catch(console.error);
