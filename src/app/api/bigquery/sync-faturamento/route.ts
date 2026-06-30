import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  queryFaturamentoDirect,
  queryFaturamentoStream,
  detectCancelledKeys,
  getRowCount,
  mapToFaturamentoRow,
  SYNC_CONFIG,
  shouldStop,
  sleep,
  type SyncTrigger,
} from "@/lib/bigquery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro max

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// ─── UPSERT with retry + exponential backoff ───
async function upsertBatch(
  supabase: ReturnType<typeof getSupabaseClient>,
  batch: ReturnType<typeof mapToFaturamentoRow>[]
): Promise<{ inserted: number; updated: number }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= SYNC_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const keys = batch.map((r) => r.chave_bq).filter(Boolean);
      const { data: existing } = await supabase
        .from("cm_faturamento_sankhya")
        .select("chave_bq")
        .in("chave_bq", keys);

      const existingKeys = new Set((existing || []).map((r: { chave_bq: string }) => r.chave_bq));

      const { error } = await supabase
        .from("cm_faturamento_sankhya")
        .upsert(batch, { onConflict: "chave_bq" });

      if (error) throw new Error(error.message);

      const updated = batch.filter((r) => existingKeys.has(r.chave_bq)).length;
      const inserted = batch.length - updated;
      return { inserted, updated };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < SYNC_CONFIG.MAX_RETRIES) {
        await sleep(SYNC_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError || new Error("UPSERT failed after retries");
}

// ─── Check consecutive failures and create alert ───
async function checkAndAlertConsecutiveFailures(
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<void> {
  try {
    // Get last 2 sync logs (excluding current RUNNING one)
    const { data: recentLogs } = await supabase
      .from("cm_sync_logs")
      .select("status")
      .neq("status", "RUNNING")
      .order("started_at", { ascending: false })
      .limit(2);

    if (!recentLogs || recentLogs.length < 2) return;

    // Check if both are errors
    const allErrors = recentLogs.every((log: { status: string }) => log.status === "ERROR");
    if (!allErrors) return;

    // Insert system alert for admin
    await supabase.from("cm_sync_logs").insert({
      source: "bigquery",
      status: "ERROR",
      triggered_by: "manual",
      error_message: "⚠️ ALERTA: 2 sincronizações consecutivas falharam. Verifique a conexão com BigQuery.",
      metadata: { type: "consecutive_failure_alert", auto_generated: true },
    });

    console.error("[BigQuery Sync] ALERT: 2 consecutive sync failures detected!");
  } catch {
    // Don't let alert check block the main flow
  }
}

// ─── Core sync logic (shared between manual + cron) ───
export async function executeSyncFaturamento(params: {
  startDate: string;
  endDate: string;
  triggeredBy: SyncTrigger;
  refreshMaterializedViews: boolean;
}): Promise<{
  logId: string;
  rowsFetched: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsDeleted: number;
  durationMs: number;
  partial: boolean;
}> {
  const supabase = getSupabaseClient();
  const startTime = Date.now();

  // 1. Create sync log entry
  const { data: logEntry, error: logError } = await supabase
    .from("cm_sync_logs")
    .insert({
      source: "bigquery",
      status: "RUNNING",
      period_start: params.startDate,
      period_end: params.endDate,
      triggered_by: params.triggeredBy,
    })
    .select("id")
    .single();

  if (logError || !logEntry) {
    throw new Error("Failed to create sync log: " + logError?.message);
  }

  const logId = logEntry.id;
  let rowsFetched = 0;
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsDeleted = 0;
  let partial = false;

  try {
    // 2. Determine period size to choose query method
    const daysDiff =
      (new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) /
      (1000 * 60 * 60 * 24);

    const allBqKeys: string[] = [];

    if (daysDiff <= 7) {
      // Small period: load all at once
      const rows = await queryFaturamentoDirect(params.startDate, params.endDate);
      rowsFetched = rows.length;

      // Collect all BigQuery keys for cancellation detection
      rows.forEach((r) => allBqKeys.push(`${r.nro_unico}_${r.sequencia}`));

      // Process in batches
      for (let i = 0; i < rows.length; i += SYNC_CONFIG.BATCH_SIZE) {
        if (shouldStop(startTime)) {
          partial = true;
          break;
        }

        const batch = rows.slice(i, i + SYNC_CONFIG.BATCH_SIZE).map(mapToFaturamentoRow);
        const result = await upsertBatch(supabase, batch);
        rowsInserted += result.inserted;
        rowsUpdated += result.updated;
      }
    } else {
      // Large period: use streaming
      for await (const batchRows of queryFaturamentoStream(
        params.startDate,
        params.endDate
      )) {
        if (shouldStop(startTime)) {
          partial = true;
          break;
        }

        rowsFetched += batchRows.length;
        batchRows.forEach((r) => allBqKeys.push(`${r.nro_unico}_${r.sequencia}`));

        const mappedBatch = batchRows.map(mapToFaturamentoRow);
        const result = await upsertBatch(supabase, mappedBatch);
        rowsInserted += result.inserted;
        rowsUpdated += result.updated;
      }
    }

    // 3. Handle cancelled/deleted notes
    // Find keys in Supabase for this period that are NOT in BigQuery anymore
    if (!partial && !shouldStop(startTime)) {
      const { data: supabaseRows } = await supabase
        .from("cm_faturamento_sankhya")
        .select("chave_bq")
        .gte("dt_faturamento", params.startDate)
        .lte("dt_faturamento", params.endDate)
        .not("chave_bq", "is", null);

      if (supabaseRows && supabaseRows.length > 0) {
        const supabaseKeys = new Set(supabaseRows.map((r: { chave_bq: string }) => r.chave_bq));
        const bqKeysSet = new Set(allBqKeys);

        // Keys in Supabase but NOT in BigQuery = cancelled/deleted
        const keysToDelete = [...supabaseKeys].filter((k) => !bqKeysSet.has(k));

        if (keysToDelete.length > 0) {
          // Delete in batches
          for (let i = 0; i < keysToDelete.length; i += SYNC_CONFIG.BATCH_SIZE) {
            const deleteBatch = keysToDelete.slice(i, i + SYNC_CONFIG.BATCH_SIZE);
            const { error: deleteError, count } = await supabase
              .from("cm_faturamento_sankhya")
              .delete({ count: "exact" })
              .in("chave_bq", deleteBatch);

            if (!deleteError) {
              rowsDeleted += count || 0;
            }
          }

          console.log(`[BigQuery Sync] Removed ${rowsDeleted} cancelled/deleted records`);
        }
      }
    }

    // 4. Refresh materialized views if requested
    if (params.refreshMaterializedViews && !partial) {
      await supabase.rpc("refresh_materialized_views");
    }

    // 5. Update sync log: SUCCESS
    const durationMs = Date.now() - startTime;
    await supabase
      .from("cm_sync_logs")
      .update({
        status: "SUCCESS",
        finished_at: new Date().toISOString(),
        rows_fetched: rowsFetched,
        rows_inserted: rowsInserted,
        rows_updated: rowsUpdated,
        metadata: {
          durationMs,
          partial,
          rowsDeleted,
          refreshedViews: params.refreshMaterializedViews,
        },
      })
      .eq("id", logId);

    return { logId, rowsFetched, rowsInserted, rowsUpdated, rowsDeleted, durationMs, partial };
  } catch (err: unknown) {
    // 6. Update sync log: ERROR
    const errorMsg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("cm_sync_logs")
      .update({
        status: "ERROR",
        finished_at: new Date().toISOString(),
        rows_fetched: rowsFetched,
        rows_inserted: rowsInserted,
        rows_updated: rowsUpdated,
        error_message: errorMsg,
        metadata: { durationMs: Date.now() - startTime, partial, rowsDeleted },
      })
      .eq("id", logId);

    // 7. Check for consecutive failures and alert
    await checkAndAlertConsecutiveFailures(supabase);

    throw err;
  }
}

// ─── POST handler for manual sync ───
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json(
        { success: false, error: "Dates must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const result = await executeSyncFaturamento({
      startDate,
      endDate,
      triggeredBy: "manual",
      refreshMaterializedViews: true,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    console.error("[BigQuery Sync] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
