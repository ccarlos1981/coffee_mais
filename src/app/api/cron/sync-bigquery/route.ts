import { NextResponse } from "next/server";
import { executeSyncFaturamento } from "@/app/api/bigquery/sync-faturamento/route";
import type { SyncTrigger } from "@/lib/bigquery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron endpoint for automatic BigQuery sync.
 *
 * Schedule (vercel.json):
 *   0 9 * * 1-5   → 06:00 BRT (cron_06, last 2 days)
 *   0 15 * * 1-5  → 12:00 BRT (cron_12, last 2 days)
 *   0 21 * * 1-5  → 18:00 BRT (cron_18, last 2 days)
 *   0 5 * * 1     → 02:00 BRT Monday (reconciliation, last 30 days)
 */
export async function GET(request: Request) {
  try {
    // Auth check (same pattern as existing crons)
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine mode from query param or current hour
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    const isReconciliation = mode === "reconciliation";

    // Calculate period
    const now = new Date();
    let daysBack: number;
    let triggeredBy: SyncTrigger;
    let refreshMaterializedViews: boolean;

    if (isReconciliation) {
      daysBack = 30;
      triggeredBy = "reconciliation";
      refreshMaterializedViews = true;
    } else {
      daysBack = 2;
      refreshMaterializedViews = false;

      // Determine trigger based on current UTC hour
      const utcHour = now.getUTCHours();
      if (utcHour >= 7 && utcHour <= 11) {
        triggeredBy = "cron_06";
      } else if (utcHour >= 13 && utcHour <= 17) {
        triggeredBy = "cron_12";
      } else {
        triggeredBy = "cron_18";
      }
    }

    const endDate = now.toISOString().split("T")[0];
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    console.log(
      `[BigQuery Cron] Starting sync: ${triggeredBy}, period: ${startDate} to ${endDate}`
    );

    const result = await executeSyncFaturamento({
      startDate,
      endDate,
      triggeredBy,
      refreshMaterializedViews,
    });

    console.log(
      `[BigQuery Cron] Complete: ${result.rowsInserted} inserted, ${result.rowsUpdated} updated, ${result.durationMs}ms`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    console.error("[BigQuery Cron] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
