"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Coffee,
  Trash2,
  Database,
  RefreshCw,
  Clock,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
type UploadStatus = "idle" | "selected" | "uploading" | "processing" | "done" | "error";

interface UploadResult {
  batchId: string;
  recordsProcessed: number;
  sheetsDetected: string[];
  period?: { start: string; end: string };
}

export default function UploadPage() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // BigQuery sync state
  type SyncStatus = "idle" | "syncing" | "done" | "error";
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncStartDate, setSyncStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [syncEndDate, setSyncEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [syncResult, setSyncResult] = useState<{
    rowsInserted: number;
    rowsUpdated: number;
    rowsFetched: number;
    durationMs: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);

  // Fetch recent sync logs
  useEffect(() => {
    async function fetchLogs() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from("cm_sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      if (data) setSyncLogs(data);
    }
    fetchLogs();
  }, [syncStatus]);

  const handleBigQuerySync = async () => {
    setSyncStatus("syncing");
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/bigquery/sync-faturamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: syncStartDate, endDate: syncEndDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erro na sincronização");
      setSyncResult(data);
      setSyncStatus("done");
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
      setSyncStatus("error");
    }
  };

  const validExtensions = [".xls", ".xlsx", ".xlsm", ".xlsb"];
  const maxSize = 50 * 1024 * 1024; // 50MB

  const validateFile = (f: File): string | null => {
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      return `Formato inválido: ${ext}. Aceitos: .xls, .xlsx, .xlsm, .xlsb`;
    }
    if (f.size > maxSize) {
      return `Arquivo muito grande: ${(f.size / 1024 / 1024).toFixed(1)}MB. Máximo: 50MB`;
    }
    return null;
  };

  const handleFileSelect = useCallback((f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      setStatus("error");
      return;
    }
    setFile(f);
    setError(null);
    setStatus("selected");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  };

  const processUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(20);

    try {
      // Send file directly to API for processing
      const formData = new FormData();
      formData.append("file", file);

      setProgress(40);
      setStatus("processing");

      const response = await fetch("/api/process-excel", {
        method: "POST",
        body: formData,
      });

      setProgress(80);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro no processamento");
      }

      const resultData = await response.json();
      setProgress(100);

      setResult({
        batchId: resultData.batchId,
        recordsProcessed: resultData.recordsProcessed,
        sheetsDetected: resultData.sheetsDetected,
        period: resultData.period,
      });
      setStatus("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      setStatus("error");
    }
  };

  const resetUpload = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Upload de Dados
            </h1>
            <p className="text-xs text-muted">
              Importar planilhas Excel do Coffee Mais
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Upload Zone */}
        {(status === "idle" || status === "error") && (
          <div className="animate-fade-in">
            <div
              className={`upload-zone flex flex-col items-center justify-center p-16 text-center ${
                isDragging ? "dragging" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 flex items-center justify-center mb-6">
                <Upload className="w-8 h-8 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Arraste seu arquivo Excel aqui
              </h3>
              <p className="text-sm text-muted mb-4">
                ou clique para selecionar
              </p>
              <p className="text-xs text-dim">
                Formatos aceitos: .xls, .xlsx, .xlsm, .xlsb • Máximo: 50MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xls,.xlsx,.xlsm,.xlsb"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            {status === "error" && error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Erro no upload
                  </p>
                  <p className="text-xs text-red-300/80 mt-1">{error}</p>
                </div>
                <button
                  onClick={resetUpload}
                  className="ml-auto text-xs text-muted hover:text-foreground"
                >
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
        )}

        {/* File Selected - Preview */}
        {status === "selected" && file && (
          <div className="animate-slide-up">
            <div className="glass-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground truncate">
                    {file.name}
                  </h3>
                  <p className="text-xs text-muted">
                    {formatFileSize(file.size)} •{" "}
                    {file.name.split(".").pop()?.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={resetUpload}
                  className="text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={processUpload}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm hover:from-amber-400 hover:to-amber-500 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Processar Arquivo
                </button>
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 rounded-xl border border-border-light text-muted hover:text-foreground hover:border-foreground/30 transition-all text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Uploading / Processing */}
        {(status === "uploading" || status === "processing") && (
          <div className="animate-slide-up">
            <div className="glass-card p-8 text-center">
              <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {status === "uploading"
                  ? "Enviando arquivo..."
                  : "Processando dados..."}
              </h3>
              <p className="text-sm text-muted mb-6">
                {status === "uploading"
                  ? "Fazendo upload para o servidor"
                  : "Extraindo e normalizando dados da planilha"}
              </p>

              {/* Progress bar */}
              <div className="max-w-md mx-auto">
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-dim mt-2">{progress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {status === "done" && result && (
          <div className="animate-slide-up">
            <div className="glass-card p-8">
              <div className="text-center mb-8">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-1">
                  Upload concluído com sucesso!
                </h3>
                <p className="text-sm text-muted">
                  Os dados foram processados e estão disponíveis nos dashboards
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="p-4 rounded-xl bg-background text-center">
                  <p className="text-2xl font-bold text-gold">
                    {result.recordsProcessed.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Registros processados
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-background text-center">
                  <p className="text-2xl font-bold text-accent-blue">
                    {result.sheetsDetected.length}
                  </p>
                  <p className="text-xs text-muted mt-1">Abas detectadas</p>
                </div>
                <div className="p-4 rounded-xl bg-background text-center">
                  <p className="text-sm font-semibold text-accent-green">
                    {result.period
                      ? `${result.period.start} — ${result.period.end}`
                      : "-"}
                  </p>
                  <p className="text-xs text-muted mt-1">Período</p>
                </div>
              </div>

              {result.sheetsDetected.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-dim mb-2 uppercase tracking-wider">
                    Abas processadas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.sheetsDetected.map((sheet) => (
                      <span
                        key={sheet}
                        className="px-3 py-1 rounded-full text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                      >
                        {sheet}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetUpload}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm hover:from-amber-400 hover:to-amber-500 transition-all"
                >
                  Novo Upload
                </button>
                <Link
                  href="/"
                  className="px-6 py-3 rounded-xl border border-border-light text-muted hover:text-foreground hover:border-foreground/30 transition-all text-sm text-center"
                >
                  Voltar ao Menu
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* BigQuery Sync Section */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Sincronização BigQuery</h2>
              <p className="text-xs text-muted">Importar faturamento direto do Sankhya</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/80 p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-muted mb-1">Data início</label>
                <input
                  type="date"
                  value={syncStartDate}
                  onChange={(e) => setSyncStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground"
                  disabled={syncStatus === "syncing"}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-muted mb-1">Data fim</label>
                <input
                  type="date"
                  value={syncEndDate}
                  onChange={(e) => setSyncEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground"
                  disabled={syncStatus === "syncing"}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleBigQuerySync}
                  disabled={syncStatus === "syncing"}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm hover:from-blue-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {syncStatus === "syncing" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Sincronizar Agora
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sync result */}
            {syncStatus === "done" && syncResult && (
              <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/50 p-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">Sincronização concluída</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-emerald-300">{syncResult.rowsFetched.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-zinc-400">Buscadas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-300">{syncResult.rowsInserted.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-zinc-400">Inseridas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-300">{syncResult.rowsUpdated.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-zinc-400">Atualizadas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-zinc-300">{(syncResult.durationMs / 1000).toFixed(1)}s</p>
                    <p className="text-xs text-zinc-400">Duração</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sync error */}
            {syncStatus === "error" && syncError && (
              <div className="rounded-xl bg-red-900/20 border border-red-700/50 p-4 mt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">{syncError}</span>
                </div>
              </div>
            )}
          </div>

          {/* Recent sync logs */}
          {syncLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Últimas sincronizações
              </h3>
              <div className="space-y-2">
                {syncLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between rounded-lg border p-3 text-xs ${
                      log.status === "SUCCESS"
                        ? "border-emerald-800/40 bg-emerald-900/10"
                        : log.status === "ERROR"
                        ? "border-red-800/40 bg-red-900/10"
                        : "border-amber-800/40 bg-amber-900/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {log.status === "SUCCESS" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      {log.status === "ERROR" && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      {log.status === "RUNNING" && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                      <span className="text-zinc-300">
                        {new Date(log.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-zinc-400">
                        {log.triggered_by}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400">
                      <span>{(log.rows_fetched || 0).toLocaleString("pt-BR")} linhas</span>
                      {log.finished_at && (
                        <span>
                          {((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
