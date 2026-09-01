"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, CheckCircle2, Package, X, RefreshCw, DollarSign, CreditCard, Link as LinkIcon, AlertCircle } from "lucide-react";
import Link from "next/link";
import { preencherApuracao } from "../../lancar/actions";
import { supabase } from "@/lib/supabase";

interface ApuracaoFormProps {
  investment: any;
  matrizNome?: string;
  initialBoletos?: any[];
}

export function ApuracaoForm({ investment, matrizNome, initialBoletos = [] }: ApuracaoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const [numeroAcordo, setNumeroAcordo] = useState(investment.apuracao_numero_acordo || investment.numero_acordo || "");
  const [volumeVendido, setVolumeVendido] = useState(
    investment.apuracao_qtd_vendida 
      ? investment.apuracao_qtd_vendida.toString().replace(".", ",") 
      : investment.volume_vendido_sellout 
        ? investment.volume_vendido_sellout.toString().replace(".", ",") 
        : ""
  );
  const [valorRealizado, setValorRealizado] = useState(
    investment.apuracao_valor_realizado 
      ? investment.apuracao_valor_realizado.toString().replace(".", ",") 
      : investment.valor_realizado 
        ? investment.valor_realizado.toString().replace(".", ",") 
        : (investment.valor_investimento ? Number(investment.valor_investimento).toFixed(2).replace(".", ",") : "")
  );
  const [condicaoPagamento, setCondicaoPagamento] = useState(
    investment.condicao_pagamento || investment.tipo_pagamento || "Abatimento em Boleto"
  );
  const [semBoleto, setSemBoleto] = useState<boolean>(Boolean(investment.sem_boleto));
  const [postActionNotes, setPostActionNotes] = useState(investment.post_action_notes || "");
  
  // Boletos vinculados
  const [boletosAbertos] = useState<any[]>(initialBoletos);
  const [vinculosBoletos, setVinculosBoletos] = useState<Array<{ boleto_id: string; valor_associado: number }>>(() => {
    if (investment.apuracao_boleto_id) {
      return [{
        boleto_id: investment.apuracao_boleto_id,
        valor_associado: Number(investment.apuracao_valor_realizado || investment.valor_investimento || 0)
      }];
    }
    return [];
  });

  // File uploads
  const [evidencias, setEvidencias] = useState<string[]>(() => {
    if (Array.isArray(investment.evidencias_urls)) return investment.evidencias_urls;
    if (typeof investment.apuracao_evidencias_url === "string") {
      try {
        const parsed = JSON.parse(investment.apuracao_evidencias_url);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        if (investment.apuracao_evidencias_url.trim()) return [investment.apuracao_evidencias_url.trim()];
      }
    }
    return [];
  });
  const [uploading, setUploading] = useState(false);

  const maskVolume = (raw: string) => {
    let value = raw.replace(/[^0-9,]/g, "");
    const parts = value.split(",");
    if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");
    return value;
  };

  const maskCurrency = (raw: string) => {
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

  const handleToggleBoleto = (boleto: any) => {
    setVinculosBoletos(prev => {
      const exists = prev.some(v => v.boleto_id === boleto.id);
      if (exists) {
        return prev.filter(v => v.boleto_id !== boleto.id);
      } else {
        const parsedVal = parseFloat(valorRealizado.replace(/\./g, "").replace(",", ".")) || Number(investment.valor_investimento) || 0;
        return [...prev, { boleto_id: boleto.id, valor_associado: parsedVal }];
      }
    });
  };

  const handleBoletoValorChange = (boletoId: string, valStr: string) => {
    const cleanNum = parseFloat(valStr.replace(/\./g, "").replace(",", ".")) || 0;
    setVinculosBoletos(prev => prev.map(v => v.boleto_id === boletoId ? { ...v, valor_associado: cleanNum } : v));
  };

  const totalBoletosAssociado = useMemo(() => {
    return vinculosBoletos.reduce((acc, v) => acc + (Number(v.valor_associado) || 0), 0);
  }, [vinculosBoletos]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending || uploading) return;
    setError(null);
    
    if (!numeroAcordo.trim()) {
      setError("Dados do Acordo é obrigatório.");
      return;
    }

    if (!semBoleto && vinculosBoletos.length === 0 && boletosAbertos.length > 0) {
      setError("Por favor, vincule pelo menos um boleto ou sinalize que o cliente não possui boletos em aberto.");
      return;
    }

    const cleanQtd = volumeVendido.replace(/\./g, "").replace(",", ".");
    const cleanVal = valorRealizado.replace(/\./g, "").replace(",", ".");

    const formData = new FormData();
    formData.append("apuracao_numero_acordo", numeroAcordo.trim());
    formData.append("numero_acordo", numeroAcordo.trim());
    formData.append("apuracao_qtd_vendida", cleanQtd);
    formData.append("volume_vendido_sellout", cleanQtd);
    formData.append("apuracao_valor_realizado", cleanVal);
    formData.append("valor_realizado", cleanVal);
    formData.append("condicao_pagamento", condicaoPagamento);
    formData.append("sem_boleto", semBoleto ? "true" : "false");
    formData.append("post_action_notes", postActionNotes);
    formData.append("vinculos_boletos", JSON.stringify(vinculosBoletos));
    formData.append("apuracao_boleto_id", vinculosBoletos[0]?.boleto_id || "");
    formData.append("apuracao_evidencias_url", JSON.stringify(evidencias));
    formData.append("evidencias_urls", JSON.stringify(evidencias));

    startTransition(async () => {
      try {
        await preencherApuracao(investment.id, formData);
        router.push("/investimento");
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao salvar a apuração.");
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
            {matrizNome || investment.rede} — {investment.codigo ? `#${investment.codigo}` : ''} — Fase 3: Dossiê Comercial
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
          <span className="font-medium text-foreground flex items-center gap-1.5">
            {new Date(investment.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} — {new Date(investment.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
            {investment.date_mode === 'multiple' && (
              <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-bold border border-gold/20">Múltiplas</span>
            )}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted block">Investimento Planejado</span>
          <span className="font-black text-gold">{formatCurrency(Number(investment.valor_investimento) || 0)}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Pagamento</span>
          <span className="font-medium text-foreground">{investment.tipo_pagamento || 'Abatimento'}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
        
        {/* Dados do Acordo */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-foreground">Dados do Acordo / Referência *</label>
          <input
            type="text"
            value={numeroAcordo}
            onChange={(e) => setNumeroAcordo(e.target.value)}
            placeholder="Ex: Acordo Sell-Out Q3 / Ref. Contrato 2026"
            className="w-full bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
            required
          />
        </div>

        {/* Volume Vendido e Valor Realizado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Volume Vendido (Sell-out / Unidades)</label>
            <div className="relative">
              <Package className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <input
                type="text"
                value={volumeVendido}
                onChange={(e) => setVolumeVendido(maskVolume(e.target.value))}
                placeholder="0"
                className="w-full bg-elevated border border-border rounded-xl py-2.5 pl-9 pr-3 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Valor Realizado (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <input
                type="text"
                value={valorRealizado}
                onChange={(e) => setValorRealizado(maskCurrency(e.target.value))}
                placeholder="0,00"
                className="w-full bg-elevated border border-border rounded-xl py-2.5 pl-9 pr-3 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </div>
          </div>
        </div>

        {/* Condição de Pagamento */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Condição / Forma de Pagamento</label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-3 w-4 h-4 text-muted" />
            <input
              type="text"
              value={condicaoPagamento}
              onChange={(e) => setCondicaoPagamento(e.target.value)}
              placeholder="Ex: Abatimento em Boleto, Depósito em Conta Corrente, etc."
              className="w-full bg-elevated border border-border rounded-xl py-2.5 pl-9 pr-3 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </div>
        </div>

        {/* Seção de Vínculo de Boletos */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-bold text-foreground flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gold" />
                Vínculo de Boletos em Aberto
              </label>
              <p className="text-xs text-muted">Selecione os boletos da rede que receberão o abatimento comercial.</p>
            </div>
            {vinculosBoletos.length > 0 && (
              <span className="text-xs font-bold text-gold bg-gold/10 px-2.5 py-1 rounded-lg border border-gold/20">
                Total Associado: {formatCurrency(totalBoletosAssociado)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-elevated rounded-xl border border-border">
            <input
              type="checkbox"
              id="sem_boleto_checkbox"
              checked={semBoleto}
              onChange={(e) => {
                setSemBoleto(e.target.checked);
                if (e.target.checked) setVinculosBoletos([]);
              }}
              className="w-4 h-4 rounded text-gold focus:ring-gold/50 cursor-pointer"
            />
            <label htmlFor="sem_boleto_checkbox" className="text-xs text-foreground font-medium cursor-pointer">
              Cliente não possui boletos em aberto (Pagamento via Depósito / Sem Abatimento)
            </label>
          </div>

          {!semBoleto && (
            <div className="space-y-2">
              {boletosAbertos.length === 0 ? (
                <div className="p-4 bg-elevated/50 border border-dashed border-border rounded-xl text-center">
                  <p className="text-xs text-muted">Nenhum boleto em aberto encontrado para esta rede no momento.</p>
                  <p className="text-[11px] text-muted/70 mt-1">Marque a opção acima se a liquidação for realizada via depósito ou sem boleto.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {boletosAbertos.map((boleto) => {
                    const isSelected = vinculosBoletos.some(v => v.boleto_id === boleto.id);
                    const vinculoItem = vinculosBoletos.find(v => v.boleto_id === boleto.id);
                    return (
                      <div 
                        key={boleto.id}
                        className={`p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected ? "bg-gold/10 border-gold/40 shadow-sm" : "bg-elevated border-border hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleBoleto(boleto)}
                            className="mt-0.5 w-4 h-4 rounded text-gold focus:ring-gold/50 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-foreground">Boleto #{boleto.numero_boleto || boleto.nro_nota}</span>
                            <span className="text-muted ml-2 font-mono">Venc: {boleto.vencimento ? new Date(boleto.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                            <div className="text-[11px] text-muted mt-0.5">
                              Valor Total: <strong className="text-foreground">{formatCurrency(Number(boleto.valor_total || boleto.valor_liquido || 0))}</strong>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="text-[11px] text-muted">Valor a Abater:</span>
                            <input
                              type="text"
                              value={vinculoItem?.valor_associado ? String(vinculoItem.valor_associado).replace(".", ",") : ""}
                              onChange={(e) => handleBoletoValorChange(boleto.id, e.target.value)}
                              placeholder="0,00"
                              className="w-24 bg-card border border-gold/40 rounded-lg px-2 py-1 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-gold"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Anexar Acordo / Evidências */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-foreground">Anexar Acordo / Evidências</label>
            <p className="text-xs text-muted">Adicione todos os documentos e evidências necessários para comprovar a ação.</p>
            <span className="text-[11px] text-muted/80 italic block">PDF, imagens e formatos permitidos.</span>
          </div>
          
          {evidencias.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {evidencias.map((url, idx) => {
                const isPdf = url.toLowerCase().endsWith('.pdf');
                const ext = url.split('.').pop()?.toUpperCase() || 'FILE';
                const parts = url.split('_');
                const displayName = parts.length >= 4 ? parts.slice(3).join('_') : (url.split('/').pop() || url);

                return (
                  <div key={idx} className="flex items-center justify-between bg-elevated border border-border rounded-xl px-3 py-2 text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span>{isPdf ? "📄" : "🖼️"}</span>
                      <span className="text-xs text-foreground font-medium truncate" title={displayName}>{displayName}</span>
                      <span className="text-[10px] text-muted uppercase font-mono">{ext}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold text-xs">✓</span>
                      <button type="button" onClick={() => removeEvidencia(idx)} className="p-1 text-muted hover:text-danger transition-colors" title="Remover anexo">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-elevated hover:bg-border border-2 border-dashed border-border rounded-xl cursor-pointer transition-colors group">
            {uploading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-gold" />
            ) : (
              <>
                <Upload className="w-5 h-5 text-muted group-hover:text-gold transition-colors" />
                <span className="text-sm text-muted group-hover:text-foreground font-medium transition-colors">
                  {evidencias.length > 0 ? "+ Adicionar mais arquivos" : "Selecionar arquivos (PDF ou Imagem)..."}
                </span>
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

        {/* Observações */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Observações da Apuração</label>
          <textarea
            value={postActionNotes}
            onChange={(e) => setPostActionNotes(e.target.value)}
            rows={3}
            className="w-full bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50 resize-y min-h-[80px] max-h-[200px]"
            placeholder="Digite aqui informações complementares sobre a apuração..."
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border">
          <button 
            type="submit"
            disabled={isPending || uploading}
            className="w-full bg-purple-600 text-white font-bold text-base rounded-xl py-3.5 flex items-center justify-center gap-2 hover:bg-purple-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20"
          >
            {isPending ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                Enviar para Conferência (Fase 4)
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
