"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, CheckCircle2, Banknote, RefreshCw } from "lucide-react";
import Link from "next/link";
import { confirmarPagamento } from "../../lancar/actions";
import { supabase } from "@/lib/supabase";

interface PagamentoFormProps {
  investment: any;
}

export function PagamentoForm({ investment }: PagamentoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const [observacoes, setObservacoes] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${investment.id}_pagamento_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("comprovantes_investimento")
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      setComprovanteUrl(fileName);
    } catch (err: any) {
      setError("Erro ao fazer upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("financeiro_observacoes", observacoes);
    formData.append("financeiro_comprovante_url", comprovanteUrl);

    startTransition(async () => {
      try {
        await confirmarPagamento(investment.id, formData);
        router.push("/investimento");
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao salvar.");
      }
    });
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/investimento" 
          className="p-2 rounded-xl bg-elevated border border-border text-muted hover:text-foreground hover:bg-border transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Confirmar Pagamento</h1>
          <p className="text-sm text-muted mt-0.5">
            {investment.rede} — {investment.codigo ? `#${investment.codigo}` : ''} — Fase 5: Financeiro
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-elevated border border-border rounded-2xl p-4 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-xs text-muted block">Investimento</span>
          <span className="font-black text-gold text-lg">{formatCurrency(Number(investment.valor_investimento) || 0)}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Pagamento</span>
          <span className="font-bold text-foreground">{investment.tipo_pagamento || 'Abatimento'}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Nº Acordo</span>
          <span className="font-bold text-foreground">{investment.numero_acordo || '-'}</span>
        </div>
        {investment.vencimento && (
          <div>
            <span className="text-xs text-muted block">Vencimento</span>
            <span className="font-bold text-foreground">{new Date(investment.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-xl space-y-5">
        
        {/* Comprovante */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Comprovante de Pagamento</label>
          {comprovanteUrl ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium truncate flex-1">{comprovanteUrl.split('/').pop()}</span>
              <button type="button" onClick={() => setComprovanteUrl("")} className="text-xs text-muted hover:text-foreground">Trocar</button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-elevated hover:bg-border border-2 border-dashed border-border rounded-xl cursor-pointer transition-colors">
              {uploading ? (
                <RefreshCw className="w-5 h-5 animate-spin text-gold" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted" />
                  <span className="text-sm text-muted font-medium">Anexar comprovante</span>
                </>
              )}
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações sobre o pagamento..."
            rows={3}
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border">
          <button 
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-500 text-white font-bold text-base rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isPending ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Banknote className="w-6 h-6" />
                Confirmar Pagamento
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
