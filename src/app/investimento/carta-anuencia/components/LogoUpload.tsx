"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Image as ImageIcon, X, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getStoragePublicUrl } from "@/lib/storage-helpers";

interface LogoUploadProps {
  currentStoragePath?: string | null;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function LogoUpload({
  currentStoragePath,
  selectedFile,
  onFileSelect,
  disabled = false,
}: LogoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Efeito para sincronizar a URL de preview (arquivo novo ou storage_path existente)
  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (currentStoragePath) {
      setPreviewUrl(getStoragePublicUrl(currentStoragePath, "logos-redes"));
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile, currentStoragePath]);

  const validateFile = (file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const isValidType = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);

    if (!isValidType) {
      toast.error("Formato inválido. Selecione um arquivo PNG, JPG, JPEG, WEBP ou SVG.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Arquivo excede o limite máximo permitido de 10MB.");
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleRemove = () => {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-foreground">
        Logo Oficial da Rede (Upload de Imagem) <span className="text-rose-500">*</span>
      </label>

      <input
        type="file"
        ref={fileInputRef}
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative border border-border rounded-2xl p-4 bg-card/60 flex flex-col sm:flex-row items-center gap-4">
          {/* Container do Preview */}
          <div className="w-24 h-24 rounded-xl border border-border bg-background p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            <img
              src={previewUrl}
              alt="Logo da Rede"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Metadados e Informações */}
          <div className="flex-1 space-y-1 text-center sm:text-left min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-bold text-foreground truncate">
                {selectedFile ? selectedFile.name : "Logo Oficial Cadastrada"}
              </span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {selectedFile ? "Nova Imagem Selecionada" : "Cadastro Mestre"}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {selectedFile ? (
                <>Formato: {selectedFile.type || "Imagem"} • Tamanho: {formatFileSize(selectedFile.size)}</>
              ) : (
                <>Armazenada no Storage Oficial de Logos das Redes</>
              )}
            </p>

            <p className="text-[10px] text-muted-foreground/80 italic">
              Esta logo é vinculada permanentemente ao cadastro da Rede e gerará snapshot imutável para a carta.
            </p>

            {/* Ações: Substituir e Remover */}
            {!disabled && (
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                  Substituir Imagem
                </button>

                {selectedFile && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancelar Seleção
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Área de Drop / Seletor de Arquivo */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border hover:border-primary/50 bg-card/40 hover:bg-card"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs font-bold text-foreground">
              Clique para selecionar ou arraste a logo da rede aqui
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Formatos aceitos: PNG, JPG, JPEG, WEBP ou SVG (Máx. 10MB)
            </p>
          </div>

          <span className="mt-1 px-3 py-1 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground border border-border">
            Armazenamento permanente em logos-redes/
          </span>
        </div>
      )}
    </div>
  );
}
