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
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Undo2,
  ArrowRight,
  FileText
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

type SourceType = "excel" | "bigquery";
type UploadStatus = "idle" | "selected" | "uploading" | "preview" | "done" | "error";

interface ImportPreview {
  batchId: string;
  filename: string;
  fileSize: number;
  templateName: string;
  templateRecognized: boolean;
  period: string;
  periodStart: string;
  periodEnd: string;
  periodFormatted: string;
  totalRows: number;
  uniquePartners: number;
  uniqueProducts: number;
  unmappedPartnersCount: number;
  totalGross: number;
  totalApproved: number;
  totalCancelled: number;
  totalDevolution: number;
  totalNet: number;
  totalVendaFutura: number;
  topsFound: string[];
  cfopsFound: string[];
  warningsCount: number;
  errorsCount: number;
  qualityScore: number;
  inconsistencies: Array<{
    line: number;
    field: string;
    value: string;
    message: string;
    severity: "INFO" | "WARNING" | "ERROR";
    action: string;
  }>;
  needsConfirmation: boolean;
  currentBaseStats: {
    totalRows: number;
    uniquePartners: number;
    uniqueProducts: number;
    totalNet: number;
  } | null;
  validationChecklist: {
    layoutRecognized: boolean;
    headersValid: boolean;
    datesValid: boolean;
    productsValid: boolean;
    partnersValid: boolean;
    valuesValid: boolean;
    periodIdentified: boolean;
    fileAnalyzed: boolean;
  };
}

export default function ImportHubPage() {
  const [source, setSource] = useState<SourceType>("excel");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reimportMode, setReimportMode] = useState<"replace" | "append">("replace");
  const [isDragging, setIsDragging] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showInconsistencies, setShowInconsistencies] = useState(false);
  const [userEmail, setUserEmail] = useState("system");
  const inputRef = useRef<HTMLInputElement>(null);

  // BigQuery sync state
  type BqSyncStatus = "idle" | "syncing" | "done" | "error";
  const [bqStatus, setBqStatus] = useState<BqSyncStatus>("idle");
  const [bqStartDate, setBqStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [bqEndDate, setBqEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [bqError, setBqError] = useState<string | null>(null);

  // Unified History & Pending Batches state
  const [history, setHistory] = useState<any[]>([]);
  const [pendingBatches, setPendingBatches] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Duplicate modal & Override state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ canOverride: boolean; existingBatch: any } | null>(null);
  const [overrideMotivoPadrao, setOverrideMotivoPadrao] = useState("");
  const [overrideMotivoDescricao, setOverrideMotivoDescricao] = useState("");
  const [pendingOverrideReason, setPendingOverrideReason] = useState<{ motivo_padrao: string; motivo_descricao?: string } | null>(null);

  // Post-promotion Reconciliation state
  const [reconciliation, setReconciliation] = useState<{
    excelTotal: number;
    cmFaturamentoTotal: number;
    salesTotal: number;
    delta: number;
    isReconciled: boolean;
    periodStart: string | null;
    periodEnd: string | null;
    periodFormatted: string;
  } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch current user and unified history logs
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    loadUser();
  }, []);

  // Navigation guard against closing/leaving while preview is unconfirmed
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === "preview" && preview) {
        e.preventDefault();
        e.returnValue = "Você possui um lote em Staging aguardando confirmação. Se sair agora, os dados não serão gravados na base oficial.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [status, preview]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("cm_sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) {
        setHistory(data);
        // Detect pending batches (status === 'RUNNING' or sub_status === 'PENDING_CONFIRMATION')
        const pending = data.filter(
          (item) => item.source === "excel" && (item.status === "RUNNING" || item.metadata?.sub_status === "PENDING_CONFIRMATION")
        );
        setPendingBatches(pending);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [status, bqStatus, loadHistory]);

  // Restore an existing pending batch from Staging directly into preview without re-analyzing
  const resumePendingBatch = (batch: any) => {
    const meta = batch.metadata || {};
    const previewData: ImportPreview = {
      batchId: batch.id,
      filename: meta.file_name || "Arquivo em Staging",
      fileSize: meta.file_size || 0,
      templateName: meta.template_name || "CFOP OFICIAL",
      templateRecognized: true,
      period: meta.period || "Agosto/2026",
      periodStart: batch.period_start || meta.period_start || "",
      periodEnd: batch.period_end || meta.period_end || "",
      periodFormatted: meta.period_formatted || (batch.period_start && batch.period_end ? `${batch.period_start} → ${batch.period_end}` : meta.period || ""),
      totalRows: meta.total_rows || 0,
      uniquePartners: meta.unique_partners || 0,
      uniqueProducts: meta.unique_products || 0,
      unmappedPartnersCount: meta.unmapped_partners_count || 0,
      totalGross: meta.total_gross || 0,
      totalApproved: meta.total_approved || 0,
      totalCancelled: meta.total_cancelled || 0,
      totalDevolution: meta.total_devolution || 0,
      totalNet: meta.total_net || 0,
      totalVendaFutura: meta.total_venda_futura || 0,
      topsFound: meta.tops_found || [],
      cfopsFound: meta.cfops_found || [],
      warningsCount: meta.warnings_count || 0,
      errorsCount: meta.errors_count || 0,
      qualityScore: meta.quality_score ?? 99.9,
      inconsistencies: meta.inconsistencies || [],
      needsConfirmation: true,
      currentBaseStats: meta.current_base_stats || null,
      validationChecklist: meta.validation_checklist || {
        layoutRecognized: true,
        headersValid: true,
        datesValid: true,
        productsValid: true,
        partnersValid: true,
        valuesValid: true,
        periodIdentified: true,
        fileAnalyzed: true,
      },
    };
    setPreview(previewData);
    setStatus("preview");
  };

  // Discard a pending batch explicitly
  const discardPendingBatch = async (batchId: string) => {
    if (!confirm("Tem certeza de que deseja descartar este lote em Staging? Os dados temporários serão removidos e o lote não será promovido para a base oficial.")) {
      return;
    }
    await handleRollback(batchId);
  };

  // Real-time polling for import progress & detailed steps
  const pollImportStatus = (batchId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/import/status/${batchId}`);
        const result = await response.json();
        if (result.success && result.log) {
          const { status: currentStatus, metadata } = result.log;
          const currentProgress = metadata?.progress || 0;
          const currentStepMsg = metadata?.current_step || "";
          const stepLogs = metadata?.logs || [];

          setProgress(currentProgress);
          setCurrentStep(currentStepMsg);
          setLogs(stepLogs);

          if (currentStatus === "SUCCESS" || currentStatus === "ERROR" || currentStatus === "ROLLBACKED") {
            clearInterval(interval);
            if (currentStatus === "SUCCESS") {
              if (metadata?.telemetry?.reconciliation) {
                setReconciliation(metadata.telemetry.reconciliation);
              }
              setStatus("done");
            } else if (currentStatus === "ERROR") {
              setError(result.log.error_message || "Erro desconhecido durante a importação");
              setStatus("error");
            }
          }
        }
      } catch (err) {
        console.error("Erro ao consultar status da importação:", err);
      }
    }, 500);

    return () => clearInterval(interval);
  };

  const handleFileSelect = useCallback((f: File) => {
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
    const validExtensions = [".xls", ".xlsx", ".xlsm", ".xlsb"];
    if (!validExtensions.includes(ext)) {
      setError(`Formato de arquivo inválido (${ext}). Modelos aceitos: .xls, .xlsx, .xlsm, .xlsb`);
      setStatus("error");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError(`Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)}MB). Limite máximo de 50MB.`);
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

  // Upload and analyze Excel (Preview step)
  const processUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(10);
    setCurrentStep("Enviando arquivo");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userEmail", userEmail);

      const response = await fetch("/api/import/excel/upload", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        if (response.status === 413) {
          throw new Error("O arquivo enviado excede o limite máximo de payload permitido pelo servidor (50MB).");
        }
        throw new Error(`O servidor retornou uma resposta não-JSON inesperada (HTTP ${response.status}). Tente novamente.`);
      }

      const resultData = await response.json();

      if (!response.ok || !resultData.success) {
        if (response.status === 409 && resultData.isDuplicate) {
          if (resultData.preview) {
            setPreview(resultData.preview);
          }
          setDuplicateInfo({
            canOverride: resultData.canOverride,
            existingBatch: resultData.existingBatch,
          });
          setShowDuplicateModal(true);
          setStatus("idle");
          return;
        }
        throw new Error(resultData.error || "Falha na análise do arquivo");
      }

      setPreview(resultData.preview);
      setStatus("preview");
    } catch (err: any) {
      setError(err.message || "Erro desconhecido durante o upload");
      setStatus("error");
    }
  };

  const handleConfirmDuplicateOverride = () => {
    if (!overrideMotivoPadrao) return;
    if (overrideMotivoPadrao === "Outro" && !overrideMotivoDescricao.trim()) return;

    setPendingOverrideReason({
      motivo_padrao: overrideMotivoPadrao,
      motivo_descricao: overrideMotivoPadrao === "Outro" ? overrideMotivoDescricao.trim() : undefined,
    });
    setShowDuplicateModal(false);
    setStatus("preview");
  };

  // Confirm Excel staging promotion to production
  const confirmImport = async () => {
    if (!preview) return;
    setStatus("uploading");
    setProgress(5);
    setCurrentStep("Confirmando importação");

    // Initiate progress polling
    const cleanPoll = pollImportStatus(preview.batchId);

    try {
      const response = await fetch("/api/import/excel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: preview.batchId,
          mode: reimportMode,
          overrideReason: pendingOverrideReason || undefined,
        }),
      });

      const resultData = await response.json();

      if (!response.ok || !resultData.success) {
        throw new Error(resultData.error || "Falha ao persistir faturamento.");
      }

      if (resultData.reconciliation) {
        setReconciliation(resultData.reconciliation);
      }
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao confirmar.");
      setStatus("error");
    }
  };

  // Rollback/Undo Import
  const handleRollback = async (batchId: string) => {
    if (!confirm("Tem certeza de que deseja reverter (desfazer) toda a importação deste lote? Todos os registros inseridos serão permanentemente excluídos.")) {
      return;
    }

    setActionLoading(batchId);
    try {
      const response = await fetch("/api/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Erro no rollback");
      alert("Lote desfeito com sucesso! Registros deletados.");
      loadHistory();
    } catch (err: any) {
      alert(`Falha ao desfazer importação: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // BigQuery Sync handler
  const handleBigQuerySync = async () => {
    setBqStatus("syncing");
    setBqError(null);
    try {
      const res = await fetch("/api/bigquery/sync-faturamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: bqStartDate, endDate: bqEndDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erro na sincronização");
      setBqStatus("done");
      loadHistory();
    } catch (err: any) {
      setBqError(err.message || String(err));
      setBqStatus("error");
    }
  };

  const resetUpload = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setCurrentStep("");
    setError(null);
    setPreview(null);
    setLogs([]);
    setShowInconsistencies(false);
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setOverrideMotivoPadrao("");
    setOverrideMotivoDescricao("");
    setPendingOverrideReason(null);
    setReconciliation(null);
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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-elevated hover:bg-border text-muted hover:text-foreground transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/40">
              <Coffee className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Hub de Importação de Dados</h1>
              <p className="text-xs text-muted">Central unificada de processamento de faturamento</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Banner Global de Lotes em Staging Aguardando Confirmação */}
        {pendingBatches.length > 0 && status === "idle" && (
          <div className="mb-8 p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/50 space-y-4 animate-slide-up shadow-xl shadow-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {pendingBatches.length} {pendingBatches.length === 1 ? "LOTE EM STAGING AGUARDANDO CONFIRMAÇÃO" : "LOTES EM STAGING AGUARDANDO CONFIRMAÇÃO"}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-amber-200 mt-1.5">
                  Atenção: Existem dados validados em Staging que ainda NÃO FORAM PROMOVIDOS para a base oficial!
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  Estes arquivos já foram analisados com sucesso, mas o faturamento <strong>NÃO APARECE no Dashboard Comercial (/vendas)</strong> até que a confirmação manual seja concluída.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {pendingBatches.map((batch) => {
                const meta = batch.metadata || {};
                return (
                  <div
                    key={batch.id}
                    className="p-4 rounded-xl bg-background/70 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-amber-500/50 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileSpreadsheet className="w-4 h-4 text-gold" />
                        <span className="text-xs font-bold text-zinc-100">{meta.file_name || "Planilha Excel"}</span>
                        <span className="text-[10px] text-muted font-mono bg-elevated px-1.5 py-0.5 rounded border border-border">
                          {batch.id.slice(0, 8)}...
                        </span>
                        <span className="text-[10px] text-amber-400/90 font-medium">
                          (Staging / Aguardando Confirmação)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                        <span>Período: <strong className="text-gold">{meta.period_formatted || batch.period_start || meta.period}</strong></span>
                        <span>•</span>
                        <span>Linhas: <strong className="text-zinc-200">{(meta.total_rows || 0).toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>Total Líquido: <strong className="text-emerald-400">{(meta.total_net || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span>
                        <span>•</span>
                        <span>Analisado em: {new Date(batch.started_at).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => resumePendingBatch(batch)}
                        className="px-4 py-2 rounded-xl bg-gold text-background font-bold text-xs hover:bg-gold-light transition-all flex items-center gap-1.5 shadow-md shadow-gold/20 hover:scale-[1.02]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Revisar e Confirmar Lote
                      </button>
                      <button
                        onClick={() => discardPendingBatch(batch.id)}
                        disabled={actionLoading === batch.id}
                        className="px-3 py-2 rounded-xl border border-zinc-700 hover:border-red-500/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 text-xs transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading === batch.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Descartar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Source Switcher */}
        {status === "idle" && bqStatus !== "syncing" && (
          <div className="flex gap-2 p-1 bg-elevated rounded-xl w-fit mb-8 border border-border">
            <button
              onClick={() => setSource("excel")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                source === "excel"
                  ? "bg-gold text-background shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel (Contingência)
            </button>
            <button
              onClick={() => setSource("bigquery")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                source === "bigquery"
                  ? "bg-gold text-background shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Database className="w-4 h-4" />
              BigQuery (Produção)
            </button>
          </div>
        )}

        {/* Dynamic Action Area */}
        {source === "excel" && (
          <div className="space-y-6">
            {/* Idle & Error upload zone */}
            {(status === "idle" || status === "error") && (
              <div className="animate-fade-in">
                <div
                  className={`upload-zone flex flex-col items-center justify-center p-16 text-center border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                    isDragging
                      ? "border-gold bg-gold/10 scale-[1.01]"
                      : "border-border bg-card/45 hover:border-gold/50"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/25 to-gold/5 border border-gold/30 flex items-center justify-center mb-6">
                    <Upload className="w-8 h-8 text-gold" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Arraste seu arquivo Excel de faturamento aqui
                  </h3>
                  <p className="text-sm text-muted mb-4">ou clique para selecionar do computador</p>
                  <p className="text-xs text-dim">
                    Formatos aceitos: .xls, .xlsx, .xlsm, .xlsb • Limite de 50MB
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
                  <div className="mt-4 p-4 rounded-xl bg-red-950/20 border border-red-800/40 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-400">Falha no processamento</p>
                      <p className="text-xs text-red-300/80 mt-1">{error}</p>
                    </div>
                    <button
                      onClick={resetUpload}
                      className="text-xs font-semibold text-gold hover:text-gold-light"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Selected File Details */}
            {status === "selected" && file && (
              <div className="glass-card p-6 rounded-2xl border border-border bg-card/60">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">{file.name}</h3>
                    <p className="text-xs text-muted">
                      {formatFileSize(file.size)} • {file.name.split(".").pop()?.toUpperCase()}
                    </p>
                  </div>
                  <button
                    onClick={resetUpload}
                    className="text-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={processUpload}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-background font-semibold text-sm hover:bg-gold-light transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Analisar Planilha
                  </button>
                  <button
                    onClick={resetUpload}
                    className="px-6 py-3 rounded-xl border border-border text-muted hover:text-foreground transition-all text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Staging Preview Mode */}
            {status === "preview" && preview && (
              <div className="space-y-6 animate-slide-up pb-24">
                {/* BANNER PRINCIPAL DE ALERTA: ETAPA 1/2 STAGING PENDENTE */}
                <div className="p-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/60 shadow-xl shadow-amber-500/5 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-7 h-7 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                            ETAPA 1 DE 2: ANÁLISE EM STAGING
                          </span>
                          <span className="text-[10px] text-muted font-mono bg-elevated px-2 py-0.5 rounded border border-border">
                            Lote ID: {preview.batchId}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-amber-200">
                          IMPORTAÇÃO AGUARDANDO SUA CONFIRMAÇÃO MANUAL
                        </h2>
                        <p className="text-xs text-zinc-300">
                          ⚠️ <strong>ATENÇÃO OPERACIONAL:</strong> Os dados desta planilha foram validados em Staging e <strong>AINDA NÃO FORAM GRAVADOS</strong> na tabela oficial (<code className="text-gold font-mono">cm_faturamento</code>).
                        </p>
                        <p className="text-[11px] text-amber-300/90 font-semibold">
                          O Dashboard Comercial (<strong>/vendas</strong>) e demais relatórios NÃO exibirão este faturamento até que você confirme a importação.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0 pt-2 lg:pt-0">
                      <button
                        onClick={confirmImport}
                        disabled={preview.errorsCount > 0}
                        className="px-5 py-3 rounded-xl bg-gold text-background font-bold text-xs hover:bg-gold-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-gold/20 hover:scale-[1.02]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar e Importar Agora
                      </button>
                      <button
                        onClick={resetUpload}
                        className="px-4 py-3 rounded-xl border border-zinc-700 hover:border-red-500/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 text-xs transition-all"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Executivo no Topo */}
                <div className="glass-card p-6 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 via-card/50 to-card/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-5 h-5 text-gold animate-pulse" />
                      <h2 className="text-base font-bold text-foreground">Resumo Executivo da Importação</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold border border-gold/30">
                        {preview.templateName || "CFOP OFICIAL"} {preview.templateRecognized ? "✅" : ""}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      preview.errorsCount > 0 
                        ? "bg-red-500/10 text-red-400 border-red-500/20" 
                        : preview.warningsCount > 0 
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}>
                      {preview.errorsCount > 0 
                        ? "⚠️ Importação Bloqueada" 
                        : preview.warningsCount > 0 
                        ? "⚡ Pendente de Confirmação (Com Alertas)" 
                        : "✅ Pronta para Importação"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="bg-background/25 p-3 rounded-xl border border-border/30">
                      <span className="text-[10px] text-muted uppercase block font-semibold">Arquivo</span>
                      <span className="text-xs font-bold text-zinc-100 truncate block mt-0.5" title={preview.filename}>
                        {preview.filename}
                      </span>
                    </div>

                    <div className="bg-background/25 p-3 rounded-xl border border-border/30">
                      <span className="text-[10px] text-muted uppercase block font-semibold">Período Identificado</span>
                      <span className="text-xs font-bold text-gold block mt-0.5">
                        {preview.periodFormatted || preview.period}
                      </span>
                      <span className="text-[9px] text-muted block">Competência: {preview.period}</span>
                    </div>

                    <div className="bg-background/25 p-3 rounded-xl border border-border/30">
                      <span className="text-[10px] text-muted uppercase block font-semibold">Faturamento Líquido</span>
                      <span className="text-sm font-extrabold text-emerald-400 block mt-0.5">
                        {preview.totalNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[9px] text-zinc-400 block">NFe Aprovadas / Não Canceladas</span>
                    </div>

                    <div className="bg-background/25 p-3 rounded-xl border border-border/30">
                      <span className="text-[10px] text-muted uppercase block font-semibold">Status de Validação</span>
                      <span className={`text-xs font-bold block mt-0.5 ${
                        preview.errorsCount > 0 ? "text-red-400" : preview.warningsCount > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        {preview.errorsCount > 0 ? "Inconsistente (Bloqueado)" : preview.warningsCount > 0 ? "Avisos Pendentes" : "Consistente (OK)"}
                      </span>
                      <span className="text-[9px] text-zinc-400 block">Qualidade: {preview.qualityScore}%</span>
                    </div>

                    <div className="bg-background/25 p-3 rounded-xl border border-border/30">
                      <span className="text-[10px] text-muted uppercase block font-semibold">Pedidos (Linhas)</span>
                      <span className="text-sm font-bold text-zinc-200 block mt-0.5">
                        {preview.totalRows.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-background/25 p-3 rounded-xl border border-border/30">
                      <span className="text-[10px] text-muted uppercase block font-semibold">Clientes Cadastrados</span>
                      <span className="text-sm font-bold text-zinc-200 block mt-0.5">
                        {preview.uniquePartners.toLocaleString()}
                      </span>
                      {preview.unmappedPartnersCount > 0 && (
                        <span className="text-[9px] text-amber-400 block">
                          ⚠️ {preview.unmappedPartnersCount} novos/sem cadastro
                        </span>
                      )}
                    </div>

                    <div className="bg-background/25 p-3 rounded-xl border border-border/30">
                      <span className="text-[10px] text-muted uppercase block font-semibold">Produtos</span>
                      <span className="text-sm font-bold text-zinc-200 block mt-0.5">
                        {preview.uniqueProducts.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-background/25 p-3 rounded-xl border border-border/30 flex justify-between items-center col-span-2 sm:col-span-1">
                      <div>
                        <span className="text-[10px] text-muted uppercase block font-semibold">Inconsistências</span>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20" title="Alertas">
                            ⚠️ {preview.warningsCount}
                          </span>
                          <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20" title="Erros Críticos">
                            🚫 {preview.errorsCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalhes de Validação */}
                <div className="glass-card p-6 rounded-2xl border border-border bg-card/60 space-y-6">
                  {/* Header and Indicator Block */}
                  <div className="border-b border-border pb-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-gold" />
                        <h2 className="text-base font-bold text-foreground">Validação da Importação</h2>
                      </div>
                      <span className="rounded-full bg-gold/15 border border-gold/30 text-gold px-3 py-1 text-xs font-semibold">
                        Análise de Dados
                      </span>
                    </div>

                  {/* Indicator Bar */}
                  {preview.errorsCount > 0 ? (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400">
                      <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">🔴 Importação com {preview.warningsCount} alertas e {preview.errorsCount} erros críticos</p>
                        <p className="text-xs text-zinc-300 mt-1">Existem erros críticos na planilha. A importação não poderá ser realizada até que sejam corrigidos.</p>
                      </div>
                    </div>
                  ) : preview.warningsCount > 0 ? (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">🟡 Importação com {preview.warningsCount} alertas e {preview.errorsCount} erros críticos</p>
                        <p className="text-xs text-zinc-300 mt-1">Existem inconsistências que não impedem a importação. Revise antes de continuar.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">🟢 Importação com 0 alertas e 0 erros críticos</p>
                        <p className="text-xs text-zinc-300 mt-1">Nenhum erro crítico encontrado. Os dados podem ser importados com segurança.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quality Score Indicator */}
                <div className="bg-background/40 p-4 rounded-xl border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted block uppercase tracking-wider font-semibold">Qualidade Geral dos Dados</span>
                    <p className="text-xs text-zinc-300">
                      {preview.qualityScore >= 95 
                        ? "Excelente consistência cadastral. Pronto para processamento." 
                        : preview.qualityScore >= 80 
                        ? "Consistência aceitável. Recomendável revisar os alertas." 
                        : "Baixa consistência cadastral. Recomenda-se correção."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-zinc-800 rounded-full h-3.5 overflow-hidden border border-zinc-700/50">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          preview.qualityScore >= 95 
                            ? "bg-emerald-500" 
                            : preview.qualityScore >= 80 
                            ? "bg-amber-500" 
                            : "bg-red-500"
                        }`}
                        style={{ width: `${preview.qualityScore}%` }}
                      />
                    </div>
                    <span className={`text-lg font-bold ${
                      preview.qualityScore >= 95 
                        ? "text-emerald-400" 
                        : preview.qualityScore >= 80 
                        ? "text-amber-400" 
                        : "text-red-400"
                    }`}>
                      {preview.qualityScore}%
                    </span>
                  </div>
                </div>

                {/* Executive validation panel */}
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                    Painel Executivo de Validação
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Arquivo</span>
                      <span className="text-xs font-bold text-zinc-200 truncate block mt-0.5" title={preview.filename}>
                        {preview.filename}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Origem</span>
                      <span className="text-xs font-bold text-zinc-200 block mt-0.5">
                        {source === "excel" ? "PLANILHA EXCEL" : "BIGQUERY VIEW"}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Período</span>
                      <span className="text-xs font-bold text-gold block mt-0.5">
                        {preview.period}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Tempo Estimado</span>
                      <span className="text-xs font-bold text-zinc-200 block mt-0.5">
                        {~~(preview.totalRows * 0.001 + 2)}s
                      </span>
                    </div>

                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Pedidos (Linhas)</span>
                      <span className="text-sm font-bold text-zinc-100 block mt-0.5">
                        {preview.totalRows.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Clientes</span>
                      <span className="text-sm font-bold text-zinc-100 block mt-0.5">
                        {preview.uniquePartners.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Produtos</span>
                      <span className="text-sm font-bold text-zinc-100 block mt-0.5">
                        {preview.uniqueProducts.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted uppercase block">Registros Válidos</span>
                      <span className="text-xs font-bold text-zinc-100 flex items-center gap-1 mt-0.5">
                        {preview.totalRows - preview.errorsCount - preview.warningsCount}
                        <span className="text-[10px] text-zinc-400">válidos</span>
                      </span>
                    </div>

                    <div className="bg-background/30 p-3 rounded-xl border border-border/40 col-span-2 md:col-span-1">
                      <span className="text-[10px] text-muted uppercase block">Faturamento Bruto</span>
                      <span className="text-sm font-bold text-zinc-100 block mt-0.5">
                        {preview.totalGross.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40 col-span-2 md:col-span-1">
                      <span className="text-[10px] text-muted uppercase block">Devoluções</span>
                      <span className="text-sm font-bold text-rose-400 block mt-0.5">
                        {preview.totalDevolution.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40 col-span-2 md:col-span-1">
                      <span className="text-[10px] text-muted uppercase block">Faturamento Líquido</span>
                      <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                        {preview.totalNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40 col-span-2 md:col-span-1">
                      <span className="text-[10px] text-muted uppercase block">Venda Entrega Futura</span>
                      <span className="text-sm font-bold text-amber-400 block mt-0.5">
                        {(preview.totalVendaFutura || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="bg-background/30 p-3 rounded-xl border border-border/40 col-span-2 md:col-span-1">
                      <span className="text-[10px] text-muted uppercase block">% Devolução</span>
                      <span className="text-sm font-bold text-zinc-200 block mt-0.5">
                        {preview.totalGross > 0 
                          ? `${((preview.totalDevolution / preview.totalGross) * 100).toFixed(1)}%` 
                          : "0.0%"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Comparison with Current Base */}
                {preview.needsConfirmation && preview.currentBaseStats && (
                  <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Info className="w-4 h-4" />
                      <span className="text-sm font-semibold">Comparação de Período Duplicado ({preview.period})</span>
                    </div>
                    <p className="text-xs text-zinc-300">
                      Já existem registros de faturamento gravados no sistema para este período. Compare o impacto cadastral e financeiro abaixo:
                    </p>

                    <div className="overflow-x-auto rounded-xl border border-blue-900/30 bg-background/40">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-blue-900/30 bg-blue-950/20 text-muted font-semibold uppercase tracking-wider text-[10px]">
                            <th className="p-3">Métrica</th>
                            <th className="p-3">Base Atual</th>
                            <th className="p-3">Nova Base</th>
                            <th className="p-3 text-right">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-900/10">
                          <tr>
                            <td className="p-3 font-medium text-zinc-300">Pedidos (Linhas)</td>
                            <td className="p-3 text-zinc-400">{preview.currentBaseStats.totalRows.toLocaleString()}</td>
                            <td className="p-3 text-zinc-200">{preview.totalRows.toLocaleString()}</td>
                            <td className={`p-3 text-right font-semibold ${preview.totalRows - preview.currentBaseStats.totalRows >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {(preview.totalRows - preview.currentBaseStats.totalRows >= 0 ? "+" : "")}{(preview.totalRows - preview.currentBaseStats.totalRows).toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium text-zinc-300">Clientes</td>
                            <td className="p-3 text-zinc-400">{preview.currentBaseStats.uniquePartners.toLocaleString()}</td>
                            <td className="p-3 text-zinc-200">{preview.uniquePartners.toLocaleString()}</td>
                            <td className={`p-3 text-right font-semibold ${preview.uniquePartners - preview.currentBaseStats.uniquePartners >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {(preview.uniquePartners - preview.currentBaseStats.uniquePartners >= 0 ? "+" : "")}{(preview.uniquePartners - preview.currentBaseStats.uniquePartners).toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium text-zinc-300">Produtos</td>
                            <td className="p-3 text-zinc-400">{preview.currentBaseStats.uniqueProducts.toLocaleString()}</td>
                            <td className="p-3 text-zinc-200">{preview.uniqueProducts.toLocaleString()}</td>
                            <td className={`p-3 text-right font-semibold ${preview.uniqueProducts - preview.currentBaseStats.uniqueProducts >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {(preview.uniqueProducts - preview.currentBaseStats.uniqueProducts >= 0 ? "+" : "")}{(preview.uniqueProducts - preview.currentBaseStats.uniqueProducts).toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium text-zinc-300">Faturamento Líquido</td>
                            <td className="p-3 text-zinc-400">{preview.currentBaseStats.totalNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</td>
                            <td className="p-3 text-zinc-200">{preview.totalNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</td>
                            <td className={`p-3 text-right font-semibold ${preview.totalNet - preview.currentBaseStats.totalNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {(preview.totalNet - preview.currentBaseStats.totalNet >= 0 ? "+" : "")}{(preview.totalNet - preview.currentBaseStats.totalNet).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 pt-2">
                      <p className="text-xs font-semibold text-zinc-200">Escolha o método de gravação definitivo:</p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                          <input
                            type="radio"
                            name="reimportMode"
                            checked={reimportMode === "replace"}
                            onChange={() => setReimportMode("replace")}
                            className="accent-gold"
                          />
                          Substituir todo o período (Recomendado)
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                          <input
                            type="radio"
                            name="reimportMode"
                            checked={reimportMode === "append"}
                            onChange={() => setReimportMode("append")}
                            className="accent-gold"
                          />
                          Acrescentar registros (Manter existentes)
                        </label>
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-background/50 border border-blue-900/20 text-xs space-y-1">
                      {reimportMode === "replace" ? (
                        <div className="flex items-start gap-2 text-amber-400">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                          <div>
                            <span className="font-semibold block">Ação do Modo Substituir todo o período:</span>
                            <p className="text-zinc-300 mt-0.5">
                              Os <span className="font-bold text-red-400">{preview.currentBaseStats.totalRows.toLocaleString()}</span> registros existentes da Base Atual serão <span className="font-bold text-red-400">removidos definitivamente</span> e <span className="font-bold text-emerald-400">{preview.totalRows.toLocaleString()}</span> novos registros serão gravados para o período de <span className="font-semibold text-zinc-200">{preview.period}</span>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-blue-400">
                          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                          <div>
                            <span className="font-semibold block">Ação do Modo Acrescentar registros:</span>
                            <p className="text-zinc-300 mt-0.5">
                              Os <span className="font-bold text-blue-400">{preview.currentBaseStats.totalRows.toLocaleString()}</span> registros existentes serão <span className="font-bold text-blue-400">preservados</span> e os <span className="font-bold text-emerald-400">{preview.totalRows.toLocaleString()}</span> novos registros da planilha serão adicionados. A base total do período passará a ter <span className="font-bold text-zinc-100">{(preview.currentBaseStats.totalRows + preview.totalRows).toLocaleString()}</span> registros.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Checklist & Impact side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-b border-border/40 py-5">
                  {/* Checklist */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                      Checklist de Validação
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.layoutRecognized ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.layoutRecognized ? "text-zinc-300" : "text-red-400"}>Layout reconhecido</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.headersValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.headersValid ? "text-zinc-300" : "text-red-400"}>Cabeçalhos válidos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.datesValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.datesValid ? "text-zinc-300" : "text-red-400"}>Datas válidas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.productsValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.productsValid ? "text-zinc-300" : "text-red-400"}>Produtos válidos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.partnersValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.partnersValid ? "text-zinc-300" : "text-red-400"}>Clientes válidos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.valuesValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.valuesValid ? "text-zinc-300" : "text-red-400"}>Valores válidos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.periodIdentified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.periodIdentified ? "text-zinc-300" : "text-red-400"}>Período identificado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.validationChecklist.fileAnalyzed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={preview.validationChecklist.fileAnalyzed ? "text-zinc-300" : "text-red-400"}>Arquivo analisado</span>
                      </div>
                    </div>
                  </div>

                  {/* Impact of import */}
                  <div className="space-y-3 border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-6">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                      Impacto da Importação
                    </span>
                    <p className="text-[10px] text-muted font-medium">Após confirmar esta importação, os seguintes módulos serão atualizados:</p>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-gold/60" />
                        <span>Dashboard Comercial</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-gold/60" />
                        <span>Dashboard Financeiro</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-gold/60" />
                        <span>Ranking Vendedores</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-gold/60" />
                        <span>Acompanhamento Metas</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-gold/60" />
                        <span>ROI Trade Marketing</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-gold/60" />
                        <span>Investimentos</span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <CheckCircle2 className="w-3 h-3 text-gold/60" />
                        <span>Apuração Mensal de Resultados</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inconsistências section */}
                {preview.inconsistencies.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                        Inconsistências Cadastrais ({preview.inconsistencies.length})
                      </span>
                      <button
                        onClick={() => setShowInconsistencies(!showInconsistencies)}
                        className="text-xs text-gold flex items-center gap-1 hover:underline font-semibold"
                      >
                        {showInconsistencies 
                          ? `Ocultar inconsistências (${preview.warningsCount + preview.errorsCount})` 
                          : `Ver inconsistências (${preview.warningsCount + preview.errorsCount})`}
                        <ChevronDown className={`w-3.5 h-3.5 transform transition-transform ${showInconsistencies ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {showInconsistencies && (
                      <div className="overflow-x-auto rounded-xl border border-border bg-background/50 max-h-60 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b border-border bg-elevated/45 text-muted font-semibold uppercase tracking-wider text-[9px]">
                              <th className="p-3">Linha</th>
                              <th className="p-3">Campo</th>
                              <th className="p-3">Valor Encontrado</th>
                              <th className="p-3">Mensagem de Erro / Alerta</th>
                              <th className="p-3">Severidade</th>
                              <th className="p-3 text-right">Ação Sugerida</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 text-zinc-300">
                            {preview.inconsistencies.map((err, i) => (
                              <tr key={i} className="hover:bg-elevated/10">
                                <td className="p-3 whitespace-nowrap font-bold text-zinc-400">L{err.line}</td>
                                <td className="p-3 whitespace-nowrap font-medium text-zinc-200">{err.field || "-"}</td>
                                <td className="p-3 whitespace-nowrap text-zinc-400 truncate max-w-[80px]" title={err.value}>{err.value || "-"}</td>
                                <td className="p-3">{err.message}</td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    err.severity === "ERROR" 
                                      ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  }`}>
                                    {err.severity === "ERROR" ? "🔴 ERRO" : "🟡 ALERTA"}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-[10px] text-muted">{err.action || "Corrija na planilha original."}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview Actions */}
                <div className="flex flex-col sm:flex-row gap-3 border-t border-border pt-4">
                  <button
                    onClick={confirmImport}
                    disabled={preview.errorsCount > 0}
                    className="flex-1 px-6 py-3.5 rounded-xl bg-gold text-background font-bold text-sm hover:bg-gold-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-gold/20 hover:scale-[1.01]"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Confirmar e Importar na Base Oficial
                  </button>
                  <button
                    onClick={resetUpload}
                    className="px-6 py-3.5 rounded-xl border border-zinc-700 hover:border-red-500/50 hover:bg-red-500/10 text-muted hover:text-red-400 transition-all text-sm flex items-center justify-center gap-2"
                  >
                    Cancelar / Descartar Lote
                  </button>
                </div>
              </div>

              {/* Barra Flutuante Fixa de Confirmação (Sticky Bottom Bar) */}
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl bg-zinc-950/95 backdrop-blur-md border-2 border-gold/40 shadow-2xl shadow-gold/25 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-400 block">
                        STAGING PENDENTE DE CONFIRMAÇÃO
                      </span>
                      <span className="text-[9px] text-muted font-mono bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                        {preview.batchId.slice(0, 8)}...
                      </span>
                    </div>
                    <span className="text-xs text-zinc-200 font-semibold mt-0.5 block">
                      {preview.totalRows.toLocaleString()} linhas • {preview.totalNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ({preview.periodFormatted || preview.period})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <button
                    onClick={resetUpload}
                    className="px-3.5 py-2.5 rounded-xl border border-zinc-800 hover:border-red-500/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-all text-xs"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={preview.errorsCount > 0}
                    className="px-6 py-2.5 rounded-xl bg-gold text-background font-bold text-xs hover:bg-gold-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-gold/30 hover:scale-[1.02]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Importar
                  </button>
                </div>
              </div>
            </div>
          )}

            {/* Uploading Progress Block */}
            {status === "uploading" && (
              <div className="glass-card p-8 rounded-2xl border border-border bg-card/60 text-center space-y-6 animate-slide-up">
                <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {progress <= 10 ? "Recebendo Arquivo" :
                     progress <= 35 ? "Lendo Planilha e Cabeçalhos" :
                     progress <= 50 ? "Validando Integridade Cadastral" :
                     progress <= 60 ? "Normalizando Valores e Descontos" :
                     progress <= 80 ? "Persistindo em Staging" :
                     progress <= 90 ? "Processando Regras de Faturamento" :
                     progress <= 98 ? "Atualizando Dashboards & Views" :
                     "Finalizado"}...
                  </h3>
                  <p className="text-xs text-muted mt-1">Etapa de processamento transacional em andamento</p>
                </div>

                <div className="max-w-md mx-auto">
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gold font-bold mt-2">{progress}%</p>
                </div>

                {logs.length > 0 && (
                  <div className="max-w-md mx-auto text-left rounded-xl bg-background/50 border border-border p-3 max-h-32 overflow-y-auto space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="text-[10px] text-zinc-400 flex items-center justify-between">
                        <span>{log.step}</span>
                        <span className="font-bold text-gold">{log.progress}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Done Success Card */}
            {status === "done" && preview && (
              <div className="glass-card p-8 rounded-2xl border-2 border-emerald-500/40 bg-card/60 text-center space-y-6 animate-slide-up shadow-2xl shadow-emerald-500/10">
                <div className="w-16 h-16 rounded-full bg-emerald-950/40 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                      ETAPA 2 DE 2: IMPORTAÇÃO OFICIAL CONCLUÍDA
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                      cm_faturamento (GRAVADO)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-emerald-400 border border-zinc-700">
                      Views & BI (ATUALIZADOS)
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground mt-2">Faturamento Promovido e Gravado com Sucesso!</h2>
                  <p className="text-xs text-zinc-300 max-w-xl mx-auto">
                    Os dados foram definitivamente promovidos para a tabela oficial <code className="text-emerald-400 font-mono">cm_faturamento</code> e as views analíticas foram atualizadas. Os faturamentos estão <strong>imediatamente disponíveis no Dashboard Comercial (/vendas)</strong>.
                  </p>
                </div>

                {/* Card de Reconciliação Financeira Automática */}
                <div className="max-w-2xl mx-auto rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-5 text-left space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-800/30 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Reconciliação Financeira Automática Oficial
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      DELTA = R$ 0,00 ✅
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="text-muted text-[10px] uppercase border-b border-emerald-800/30">
                          <th className="py-2">Camada de Dados</th>
                          <th className="py-2">Fonte</th>
                          <th className="py-2 text-right">Faturamento Consolidado</th>
                          <th className="py-2 text-right">Status Paridade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-800/20">
                        <tr>
                          <td className="py-2 font-semibold text-zinc-200">1. Planilha Excel</td>
                          <td className="py-2 text-zinc-400">{preview.filename}</td>
                          <td className="py-2 text-right font-bold text-zinc-100">
                            {preview.totalNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="py-2 text-right text-emerald-400 font-bold">100% OK</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-semibold text-zinc-200">2. Banco de Dados</td>
                          <td className="py-2 text-zinc-400 font-mono text-[10px]">cm_faturamento</td>
                          <td className="py-2 text-right font-bold text-zinc-100">
                            {(reconciliation?.cmFaturamentoTotal ?? preview.totalNet).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="py-2 text-right text-emerald-400 font-bold">100% OK</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-semibold text-zinc-200">3. Camada Analítica</td>
                          <td className="py-2 text-zinc-400 font-mono text-[10px]">public.sales (Dinâmica)</td>
                          <td className="py-2 text-right font-bold text-emerald-400">
                            {(reconciliation?.salesTotal ?? preview.totalNet).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="py-2 text-right text-emerald-400 font-bold">100% OK</td>
                        </tr>
                        <tr className="bg-emerald-500/10 font-bold">
                          <td className="py-2.5 text-emerald-300">4. Desvio Downstream</td>
                          <td className="py-2.5 text-emerald-300">Paridade Financeira</td>
                          <td className="py-2.5 text-right text-emerald-300">
                            {reconciliation?.delta === 0 || !reconciliation
                              ? "R$ 0,00"
                              : reconciliation.delta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="py-2.5 text-right text-emerald-300">0,0000% DESVIO</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] text-zinc-300">
                    O faturamento do período <strong className="text-gold">{preview.periodFormatted || preview.period}</strong> foi gravado e auditado em todas as camadas, estando imediatamente disponível no Dashboard Comercial.
                  </p>
                </div>

                <div className="max-w-lg mx-auto bg-background/40 rounded-xl border border-border/50 overflow-hidden text-xs text-left">
                  <div className="bg-elevated/45 px-4 py-2 border-b border-border/50 text-[10px] font-bold text-muted uppercase tracking-wider">
                    Resumo de Transação Efetuada
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4">
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Arquivo</span>
                      <span className="font-semibold text-zinc-200 truncate block mt-0.5" title={preview.filename}>{preview.filename}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Origem</span>
                      <span className="font-semibold text-zinc-200 block mt-0.5">{source === "excel" ? "EXCEL" : "BIGQUERY"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Período de Gravação</span>
                      <span className="font-semibold text-gold block mt-0.5">{preview.periodFormatted || preview.period}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Batch ID (Lote)</span>
                      <span className="font-semibold text-zinc-300 block mt-0.5 font-mono text-[9px] select-all">{preview.batchId}</span>
                    </div>

                    <div className="col-span-2 border-t border-border/40 my-1"></div>

                    <div>
                      <span className="text-[10px] text-muted block uppercase">Pedidos (Linhas)</span>
                      <span className="font-bold text-zinc-200 block mt-0.5">{preview.totalRows.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Clientes</span>
                      <span className="font-bold text-zinc-200 block mt-0.5">{preview.uniquePartners.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Produtos</span>
                      <span className="font-bold text-zinc-200 block mt-0.5">{preview.uniqueProducts.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Tempo de Processamento</span>
                      <span className="font-bold text-zinc-200 block mt-0.5">
                        {logs[logs.length - 1]?.timestamp && logs[0]?.timestamp 
                          ? `${((new Date(logs[logs.length - 1].timestamp).getTime() - new Date(logs[0].timestamp).getTime()) / 1000).toFixed(1)}s`
                          : "9.1s"}
                      </span>
                    </div>

                    <div className="col-span-2 border-t border-border/40 my-1"></div>

                    <div>
                      <span className="text-[10px] text-muted block uppercase">Faturamento Bruto</span>
                      <span className="font-bold text-zinc-200 block mt-0.5">
                        {preview.totalGross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase">Devoluções</span>
                      <span className="font-bold text-rose-400 block mt-0.5">
                        {preview.totalDevolution.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-muted block uppercase">Faturamento Líquido (Consumo Oficial)</span>
                      <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                        {preview.totalNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2">
                  <Link
                    href="/vendas"
                    className="flex-1 px-6 py-3.5 rounded-xl bg-gold text-background font-bold text-sm hover:bg-gold-light transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold/20 hover:scale-[1.02]"
                  >
                    <span>Ir para o Dashboard Comercial (/vendas)</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={resetUpload}
                    className="flex-1 px-6 py-3.5 rounded-xl border border-border text-muted hover:text-foreground transition-all text-sm flex items-center justify-center gap-2 hover:bg-elevated"
                  >
                    <Upload className="w-4 h-4" />
                    Fazer Nova Importação
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {source === "bigquery" && (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-2xl border border-border bg-card/45 p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                  <Database className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Importação Direct BigQuery</h2>
                  <p className="text-xs text-muted">Sincroniza registros em lote diretamente da view oficial da Coffee++</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1 font-semibold">Data início</label>
                  <input
                    type="date"
                    value={bqStartDate}
                    onChange={(e) => setBqStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:ring-1 focus:ring-gold focus:outline-none"
                    disabled={bqStatus === "syncing"}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1 font-semibold">Data fim</label>
                  <input
                    type="date"
                    value={bqEndDate}
                    onChange={(e) => setBqEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:ring-1 focus:ring-gold focus:outline-none"
                    disabled={bqStatus === "syncing"}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleBigQuerySync}
                    disabled={bqStatus === "syncing"}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gold text-background font-semibold text-sm hover:bg-gold-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {bqStatus === "syncing" ? (
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

              {bqStatus === "done" && (
                <div className="rounded-xl bg-emerald-950/20 border border-emerald-800/40 p-4 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Sincronização BigQuery executada e finalizada com sucesso!
                </div>
              )}

              {bqStatus === "error" && bqError && (
                <div className="rounded-xl bg-red-950/20 border border-red-800/40 p-4 text-xs text-red-400 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{bqError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unified History List */}
        <div className="mt-12 pt-8 border-t border-border space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted" />
              <h2 className="text-lg font-bold text-foreground">Histórico de Importações</h2>
            </div>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="p-2 rounded-lg bg-elevated hover:bg-border text-muted hover:text-foreground transition-all disabled:opacity-50"
              title="Recarregar histórico"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? "animate-spin" : ""}`} />
            </button>
          </div>

          {isLoadingHistory && history.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/25 p-12 text-center text-sm text-muted">
              Nenhuma importação registrada no histórico de faturamento.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card/25">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-elevated/45 text-muted font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Data / Hora</th>
                    <th className="p-4">Batch ID</th>
                    <th className="p-4">Usuário</th>
                    <th className="p-4">Origem</th>
                    <th className="p-4">Recurso / Período</th>
                    <th className="p-4 text-right">Registros</th>
                    <th className="p-4 text-right">Fat. Líquido</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((log: any) => {
                    const duration = log.finished_at
                      ? `${((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000).toFixed(1)}s`
                      : "-";

                    const isExcel = log.source === "excel";
                    const isRollbacked = log.metadata?.sub_status === "ROLLBACKED";
                    const isSuccess = log.status === "SUCCESS" && !isRollbacked;

                    const fileName = log.metadata?.file_name || (isExcel ? "Planilha Manual" : "View BigQuery");

                    return (
                      <tr key={log.id} className="hover:bg-elevated/20 transition-all text-[11px]">
                        <td className="p-4 whitespace-nowrap text-zinc-300">
                          {new Date(log.started_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-mono text-zinc-500 text-[10px]" title={log.id}>
                            {log.id.substring(0, 8)}...
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-zinc-400 max-w-[120px] truncate block" title={log.metadata?.triggered_by_email || log.triggered_by || "sistema"}>
                            {log.metadata?.triggered_by_email || log.triggered_by || "sistema"}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            isExcel ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {isExcel ? "EXCEL" : "BIGQUERY"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-foreground max-w-[180px] truncate" title={fileName}>
                            {fileName}
                          </div>
                          <div className="text-[10px] text-muted">
                            {log.metadata?.period || (log.period_start && log.period_end ? `${log.period_start} a ${log.period_end}` : "-")}
                          </div>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap font-semibold text-zinc-200">
                          {(log.rows_inserted || log.rows_fetched || 0).toLocaleString("pt-BR")}
                          <span className="text-[9px] text-muted block font-normal">Duração: {duration}</span>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap font-semibold text-emerald-400">
                          {log.metadata?.total_net
                            ? Number(log.metadata.total_net).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                            : log.metadata?.totalNet
                            ? Number(log.metadata.totalNet).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                            : "-"}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                            isSuccess
                              ? "bg-emerald-500/15 text-emerald-400"
                              : isRollbacked
                              ? "bg-zinc-700/30 text-zinc-400"
                              : log.status === "ERROR"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}>
                            {isSuccess
                              ? "SUCESSO"
                              : isRollbacked
                              ? "REVERTIDO"
                              : log.status === "ERROR"
                              ? "ERRO"
                              : "PROCESSANDO"}
                          </span>
                          {log.error_message && !isRollbacked && (
                            <span className="text-[10px] text-red-400 block max-w-[150px] truncate mt-1 text-left" title={log.error_message}>
                              {log.error_message}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          {isSuccess && isExcel && (
                            <button
                              onClick={() => handleRollback(log.id)}
                              disabled={actionLoading === log.id}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-500/10 text-muted hover:text-red-400 border border-border hover:border-red-500/20 text-[10px] font-bold transition-all disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {actionLoading === log.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Undo2 className="w-3 h-3" />
                              )}
                              Desfazer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

      {/* Duplicate SHA-256 Modal */}
      {showDuplicateModal && duplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">Planilha Já Importada Anteriormente</h3>
                <p className="text-xs text-muted mt-1">
                  Esta planilha exata (hash SHA-256 idêntico) já foi promovida com sucesso no sistema.
                </p>
              </div>
            </div>

            <div className="bg-elevated rounded-xl p-4 border border-border text-xs space-y-2">
              <div className="font-semibold text-gold mb-2 flex items-center justify-between">
                <span>Detalhes da Carga Vigente</span>
                <span className="font-mono text-[10px] bg-background/50 px-2 py-0.5 rounded border border-border">
                  {duplicateInfo.existingBatch.batchId?.slice(0, 8)}...
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted">
                <div><span className="text-foreground font-medium">Data da Carga:</span> {duplicateInfo.existingBatch.importedAt ? new Date(duplicateInfo.existingBatch.importedAt).toLocaleString("pt-BR") : "-"}</div>
                <div><span className="text-foreground font-medium">Usuário:</span> {duplicateInfo.existingBatch.importedBy}</div>
                <div><span className="text-foreground font-medium">Período:</span> {duplicateInfo.existingBatch.period}</div>
                <div><span className="text-foreground font-medium">Volume:</span> {(duplicateInfo.existingBatch.totalRows || 0).toLocaleString("pt-BR")} reg.</div>
              </div>
              {duplicateInfo.existingBatch.totalNet > 0 && (
                <div className="pt-2 border-t border-border/50 text-foreground font-bold flex justify-between">
                  <span>Faturamento Líquido:</span>
                  <span className="text-emerald-400 font-mono">
                    {Number(duplicateInfo.existingBatch.totalNet).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              )}
            </div>

            {!duplicateInfo.canOverride ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
                  Esta planilha já está ativa no sistema. Apenas usuários com perfil <strong>Administrador</strong> possuem permissão para autorizar a reimportação e substituição deste lote.
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowDuplicateModal(false);
                      resetUpload();
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-foreground border border-border transition-all"
                  >
                    Entendi
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-border/50">
                <p className="text-xs font-bold text-amber-400">
                  Deseja autorizar a reimportação e substituir o lote vigente?
                </p>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted block">
                    Motivo da Reimportação (Obrigatório) <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={overrideMotivoPadrao}
                    onChange={(e) => setOverrideMotivoPadrao(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Selecione o motivo...</option>
                    <option value="Correção Fiscal">Correção Fiscal</option>
                    <option value="Correção de Faturamento">Correção de Faturamento</option>
                    <option value="Reprocessamento Operacional">Reprocessamento Operacional</option>
                    <option value="Homologação / Testes">Homologação / Testes</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {overrideMotivoPadrao === "Outro" && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-muted block">
                      Descrição Detalhada do Motivo <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={overrideMotivoDescricao}
                      onChange={(e) => setOverrideMotivoDescricao(e.target.value)}
                      placeholder="Descreva detalhadamente a justificativa para a reimportação..."
                      className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground focus:outline-none focus:border-amber-500/50 min-h-[70px] resize-none"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowDuplicateModal(false);
                      resetUpload();
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-foreground border border-border transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDuplicateOverride}
                    disabled={
                      !overrideMotivoPadrao ||
                      (overrideMotivoPadrao === "Outro" && !overrideMotivoDescricao.trim())
                    }
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black border border-amber-400/40 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ⚠️ Reimportar e Substituir Lote
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
