import { createClient } from "@supabase/supabase-js";
import { ImportService } from "../src/lib/services/import-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const batchId = "be064fe3-87ce-4728-ad06-bf09229ef6bd";
  console.log("Triggering confirmImport for batch", batchId);
  try {
    const result = await ImportService.confirmImport(batchId, "replace");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
