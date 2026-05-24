"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Upload, Calendar, Save, CheckCircle2, Package, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { preencherApuracao } from "../../lancar/actions";
import { supabase } from "@/lib/supabase";

interface ApuracaoFormProps {
  investment: any;
}

export function ApuracaoForm({ investment }: ApuracaoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const [numeroAcordo, setNumeroAcordo] = useState(investment.numero_acordo || "");
  const [volumeVendido, setVolumeVendido] = useState(
    investment.volume_vendido_sellout ? investment.volume_vendido_sellout.toString().replace(".", ",") : ""
  );
  const [vencimento, setVencimento] = useState(investment.vencimento || "");
  const [dadosQuitacao, setDadosQuitacao] = useState(investment.dados_quitacao || "");
  
  // File uploads
  const [evidencias, setEvidencias] = useState<string[]>(investment.evidencias_urls || []);
  const [uploading, setUploading] = useState(false);

  const maskVolume = (raw: string) => {
    let value = raw.replace(/[^0-9,]/g, "");
    const parts = value.split(",");
    if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");
    return value;
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${investment.id}_evidencia_${Date.now()}_${i}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("comprovantes_investimento")
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        newUrls.push(fileName);
      }
      setEvidencias(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      setError("Erro ao fazer upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeEvidencia = (idx: number) => {
    setEvidencias(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!numeroAcordo.trim()) {
      setError("Número do Acordo é obrigatório.");
      return;
    }

    const formData = new FormData();
    formData.append("numero_acordo", numeroAcordo);
    formData.append("volume_vendido_sellout", volumeVendido);
    formData.append("vencimento", vencimento);
    formData.append("dados_quitacao", dadosQuitacao);
    formData.append("evidencias_urls", JSON.stringify(evidencias));

    startTransition(async () => {
      try {
        await preencherApuracao(investment.id, formData);
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
          <h1 className="text-xl font-bold text-foreground">Apuração da Ação</h1>
          <p className="text-sm text-muted mt-0.5">
            {investment.rede} — {investment.codigo ? `#${investment.codigo}` : ''} — Fase 3: Dossiê Comercial
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-elevated border border-border rounded-2xl p-4 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-xs text-muted block">Tipo</span>
          <span className="font-bold text-foreground">{investment.tipo_acao}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Período</span>
          <span className="font-medium text-foreground">
            {new Date(investment.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} — {new Date(investment.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted block">Investimento</span>
          <span className="font-black text-gold">{formatCurrency(Number(investment.valor_investimento) || 0)}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Pagamento</span>
          <span className="font-medium text-foreground">{investment.tipo_pagamento || 'Abatimento'}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-xl space-y-5">
        
        {/* Número do Acordo */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Número do Acordo *</label>
          <input
            type="text"
            value={numeroAcordo}
            onChange={(e) => setNumeroAcordo(e.target.value)}
            placeholder="Referência do contrato ou sistema"
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
            required
          />
        </div>

        {/* Evidências */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Evidências (Fotos / Relatórios)</label>
          
          {evidencias.length > 0 && (
            <div className="space-y-2">
              {evidencias.map((url, idx) => (
                <div key={idx} className="flex items-center justify-between bg-elevated border border-border rounded-lg px-3 py-2">
                  <span className="text-xs text-foreground truncate flex-1">{url.split('/').pop()}</span>
                  <button type="button" onClick={() => removeEvidencia(idx)} className="p-1 text-muted hover:text-danger transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-elevated hover:bg-border border-2 border-dashed border-border rounded-xl cursor-pointer transition-colors">
            {uploading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-gold" />
            ) : (
              <>
                <Upload className="w-5 h-5 text-muted" />
                <span className="text-sm text-muted font-medium">Adicionar arquivos</span>
              </>
            )}
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Volume Vendido */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Volume Vendido (Sell-out)</label>
            <div className="relative">
              <Package className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
              <input
                type="text"
                value={volumeVendido}
                onChange={(e) => setVolumeVendido(maskVolume(e.target.value))}
                placeholder="0"
                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </div>
          </div>

          {/* Vencimento */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Data de Vencimento</label>
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
            />
          </div>
        </div>

        {/* Dados para Quitação */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Dados para Quitação / Abatimento</label>
          <textarea
            value={dadosQuitacao}
            onChange={(e) => setDadosQuitacao(e.target.value)}
            placeholder="Informações bancárias, notas fiscais, observações..."
            rows={3}
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border">
          <button 
            type="submit"
            disabled={isPending}
            className="w-full bg-purple-500 text-white font-bold text-base rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-purple-600 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isPending ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                Enviar para Conferência
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
