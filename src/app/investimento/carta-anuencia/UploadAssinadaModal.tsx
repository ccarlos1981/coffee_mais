"use client";

import React, { useState } from "react";
import { X, UploadCloud, CheckCircle2, FileText, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CartaAnuenciaItem, uploadCartaAssinada } from "./actions";

interface UploadAssinadaModalProps {
  carta: CartaAnuenciaItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadAssinadaModal({ carta, onClose, onSuccess }: UploadAssinadaModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!carta) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
      if (!validTypes.includes(selected.type)) {
        toast.error("Formato de arquivo inválido. Selecione um PDF ou imagem (PNG/JPG).");
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Selecione um arquivo assinado para realizar o upload.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${carta.numero_carta.toLowerCase()}_${Date.now()}.${fileExt}`;
      const filePath = `assinadas/${fileName}`;

      // Upload para o bucket cartas-anuencia
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("cartas-anuencia")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        throw new Error(`Erro ao enviar arquivo para o Storage: ${uploadErr.message}`);
      }

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from("cartas-anuencia")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Atualizar status no banco via Server Action
      await uploadCartaAssinada(carta.id, publicUrl);

      toast.success("Carta de Anuência Assinada anexada com sucesso! Baixa automática realizada no Farol.");
      onSuccess();
    } catch (err: any) {
      console.error("Erro no upload de carta assinada:", err);
      toast.error(err.message || "Falha ao enviar carta assinada.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Anexar Carta Assinada pela Rede
              </h2>
              <p className="text-xs text-muted-foreground">
                {carta.numero_carta} — {carta.rede_nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Competência:</span>
              <strong className="text-foreground">{carta.competencia}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPJ:</span>
              <strong className="text-foreground">{carta.cnpj || "N/A"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status Atual:</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold uppercase text-[10px]">
                {carta.status}
              </span>
            </div>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-primary/50 transition-colors bg-card/40">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {file ? file.name : "Clique para selecionar o arquivo assinado"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Suporta arquivos PDF ou Imagem (PNG, JPG, WEBP) até 20MB
                </p>
              </div>
            </label>
          </div>

          {/* Warning */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Ao anexar o arquivo assinado, o status da carta será alterado automaticamente para <strong>ASSINADA</strong>, dando baixa no <strong>Farol</strong>.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!file || uploading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar e Dar Baixa
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
