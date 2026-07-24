import { createClient } from "@supabase/supabase-js";
import { ImportService } from "../src/lib/services/import-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const batchId = "55555555-5555-5555-5555-555555555555";
  
  // 1. Create cm_sync_logs
  await supabase.from("cm_sync_logs").insert({
    id: batchId,
    source: "excel",
    status: "PENDING_CONFIRMATION",
    total_rows: 50000,
    triggered_by: "manual",
    metadata: {}
  });

  // 2. Insert 50k rows in staging
  console.log("Inserting 50k rows in staging...");
  const { error } = await supabase.rpc("execute_sql", { 
    sql: `
    INSERT INTO public.cm_faturamento_staging (id, batch_id, cod_cfop, dt_faturamento, quantidade, vlr_total_liq, cod_parceiro, cod_produto, nro_unico, nro_nota, cod_top)
    SELECT gen_random_uuid(), '${batchId}'::uuid, 'CFOP_1', '2026-07-24', 1, 10.0, 'PARTNER', 'PROD', i::text, i::text, 'TOP'
    FROM generate_series(1, 50000) i;`
  });
  // Since we don't have execute_sql RPC directly in JS easily, I'll use raw query tool or just run it via MCP.
}
run();
