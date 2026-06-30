import { createClient } from "@/lib/supabase/server";
import { Database, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface SyncLog {
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_inserted: number;
  rows_updated: number;
  rows_fetched: number;
  triggered_by: string;
  error_message: string | null;
  metadata: { rowsDeleted?: number } | null;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  return `há ${diffDays}d`;
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTrigger(trigger: string): string {
  const map: Record<string, string> = {
    manual: "Manual",
    cron_06: "Cron 06h",
    cron_12: "Cron 12h",
    cron_18: "Cron 18h",
    reconciliation: "Reconciliação",
  };
  return map[trigger] || trigger;
}

/**
 * Server Component that displays the latest BigQuery sync status.
 * Shows a critical alert badge when 2+ consecutive syncs have failed.
 * Rendered on the Home page for Admin users only.
 */
export default async function SyncStatusWidget() {
  const supabase = await createClient();

  // Fetch last sync log
  const { data: log } = await supabase
    .from("cm_sync_logs")
    .select("status, started_at, finished_at, rows_inserted, rows_updated, rows_fetched, triggered_by, error_message, metadata")
    .order("started_at", { ascending: false })
    .limit(1)
    .single<SyncLog>();

  // Check for consecutive failures (last 2 non-RUNNING logs)
  const { data: recentLogs } = await supabase
    .from("cm_sync_logs")
    .select("status")
    .neq("status", "RUNNING")
    .order("started_at", { ascending: false })
    .limit(2);

  const consecutiveFailures =
    recentLogs &&
    recentLogs.length >= 2 &&
    recentLogs.every((l: { status: string }) => l.status === "ERROR");

  // No sync logs yet
  if (!log) {
    return (
      <div className="mb-6 rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4">
        <div className="flex items-center gap-3 text-zinc-400">
          <Database className="h-5 w-5" />
          <span className="text-sm">Nenhuma sincronização BigQuery registrada</span>
        </div>
      </div>
    );
  }

  const isSuccess = log.status === "SUCCESS";
  const isError = log.status === "ERROR";
  const isRunning = log.status === "RUNNING";
  const deletedCount = log.metadata?.rowsDeleted || 0;

  return (
    <div className="space-y-2 mb-6">
      {/* Consecutive failure alert */}
      {consecutiveFailures && (
        <div className="rounded-xl border border-red-600/60 bg-red-950/40 p-4 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">
              ⚠️ Sincronização BigQuery com falhas consecutivas
            </p>
            <p className="text-xs text-red-400/80 mt-0.5">
              As últimas 2 sincronizações falharam. Verifique credenciais e conexão com BigQuery.
            </p>
          </div>
          <Link
            href="/upload"
            className="ml-auto shrink-0 rounded-lg bg-red-800/50 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-700/50 transition-colors"
          >
            Ver detalhes
          </Link>
        </div>
      )}

      {/* Last sync status */}
      <div
        className={`rounded-xl border p-4 transition-colors ${
          isSuccess
            ? "border-emerald-700/50 bg-emerald-900/20"
            : isError
            ? "border-red-700/50 bg-red-900/20"
            : "border-amber-700/50 bg-amber-900/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isSuccess && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            {isError && <XCircle className="h-5 w-5 text-red-400" />}
            {isRunning && <Loader2 className="h-5 w-5 animate-spin text-amber-400" />}

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  Sincronização BigQuery
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isSuccess
                      ? "bg-emerald-800/60 text-emerald-300"
                      : isError
                      ? "bg-red-800/60 text-red-300"
                      : "bg-amber-800/60 text-amber-300"
                  }`}
                >
                  {isSuccess ? "Sucesso" : isError ? "Erro" : "Sincronizando..."}
                </span>
                <span className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-xs text-zinc-400">
                  {formatTrigger(log.triggered_by)}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                <span>{formatRelativeTime(log.started_at)}</span>
                <span>•</span>
                <span>{log.rows_fetched.toLocaleString("pt-BR")} linhas</span>
                {deletedCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-400">{deletedCount} removidas</span>
                  </>
                )}
                <span>•</span>
                <span>{formatDuration(log.started_at, log.finished_at)}</span>
              </div>

              {isError && log.error_message && (
                <p className="mt-1 text-xs text-red-400 line-clamp-1">
                  {log.error_message}
                </p>
              )}
            </div>
          </div>

          <Link
            href="/upload"
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700/50 hover:text-zinc-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Ver histórico
          </Link>
        </div>
      </div>
    </div>
  );
}
