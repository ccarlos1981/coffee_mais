"use client";

import { useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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
    setProgress(10);

    try {
      // 1. Create upload batch record
      const { data: batch, error: batchError } = await supabase
        .from("upload_batches")
        .insert({
          filename: file.name,
          file_type: file.name.split(".").pop()?.toLowerCase(),
          status: "processing",
        })
        .select()
        .single();

      if (batchError) throw new Error(`Erro ao registrar upload: ${batchError.message}`);
      setProgress(25);

      // 2. Upload file to Supabase Storage
      const filePath = `uploads/${batch.id}/${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("excel-uploads")
        .upload(filePath, file, { upsert: true });

      if (storageError) throw new Error(`Erro no upload: ${storageError.message}`);
      setProgress(50);
      setStatus("processing");

      // 3. Process file via API route (client-side parsing for MVP)
      // For MVP, we'll read the file locally using the browser FileReader
      // In production, this would call an Edge Function
      const formData = new FormData();
      formData.append("file", file);
      formData.append("batch_id", batch.id);

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

      // 4. Update batch status
      await supabase
        .from("upload_batches")
        .update({
          records_processed: resultData.recordsProcessed,
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id);

      setResult({
        batchId: batch.id,
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
      </main>
    </div>
  );
}
