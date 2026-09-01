"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Upload, 
  CheckCircle2, 
  Banknote, 
  RefreshCw, 
  CreditCard, 
  Layers, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  Clock,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { 
  confirmarPagamento, 
  obterPlanoFinanceiroCampanha, 
  registrarPagamentoFinanceiro, 
  cancelarParcelasFuturas 
} from "../../lancar/actions";
import { supabase } from "@/lib/supabase";

interface PagamentoFormProps {
  investment: any;
  matrizNome?: string;
}

export function PagamentoForm({ investment, matrizNome }: PagamentoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [observacoes, setObservacoes] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Plano financeiro
  const [loadingPlano, setLoadingPlano] = useState(false);
  const [planoData, setPlanoData] = useState<{ campanha: any; parcelas: any[]; pagamentos: any[] } | null>(null);
  const [valorBaixa, setValorBaixa] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>(new Date().toISOString().slice(0, 10));

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  // Carregar plano financeiro da campanha
  useEffect(() => {
    if (investment?.campanha_id) {
      setLoadingPlano(true);
      obterPlanoFinanceiroCampanha(investment.campanha_id)
        .then((res) => {
          if (res.success && res.data) {
            setPlanoData(res.data);
            // Pre-selecionar o saldo da primeira parcela pendente
            const pendente = res.data.parcelas?.find((p: any) => p.status_parcela === "PENDENTE" || p.status_parcela === "PARCIALMENTE_PAGA");
            if (pendente) {
              setValorBaixa(Number(pendente.saldo_remanescente || pendente.valor_previsto).toFixed(2));
            } else {
              setValorBaixa(Number(investment.valor_investimento || 0).toFixed(2));
            }
          }
        })
        .catch((err) => console.error("Erro ao carregar plano financeiro:", err))
        .finally(() => setLoadingPlano(false));
    } else {
      setValorBaixa(Number(investment?.valor_investimento || 0).toFixed(2));
    }
  }, [investment]);

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

  const handleBaixaFinanceira = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const valorNum = parseFloat(valorBaixa.replace(/[R\$\s\.]/g, "").replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) {
      setError("Por favor, informe um valor de pagamento válido maior que zero.");
      return;
    }

    startTransition(async () => {
      try {
        // Se houver campanha_id, invocar a baixa transacional com alocação FIFO
        if (investment.campanha_id) {
          const res = await registrarPagamentoFinanceiro({
            campanhaId: investment.campanha_id,
            valorPago: valorNum,
            dataPagamento: dataPagamento,
            comprovanteUrl: comprovanteUrl || null,
            observacoes: observacoes || null
          });

          if (!res.success) {
            throw new Error(res.message || "Falha ao registrar baixa financeira.");
          }
        }

        // Atualizar status da ação comercial
        const formData = new FormData();
        formData.append("financeiro_observacoes", observacoes);
        formData.append("financeiro_comprovante_url", comprovanteUrl);
        await confirmarPagamento(investment.id, formData);

        setSuccessMsg("Pagamento registrado e baixa financeira executada com sucesso!");
        setTimeout(() => {
          router.push("/investimento");
        }, 1200);
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao salvar o pagamento.");
      }
    });
  };

  const handleQuitacaoAntecipada = async () => {
    if (!investment.campanha_id) return;
    const confirmQuitacao = window.confirm("Deseja confirmar a quitação antecipada desta negociação? As parcelas futuras ainda não pagas serão canceladas (soft-cancel).");
    if (!confirmQuitacao) return;

    startTransition(async () => {
      try {
        const res = await cancelarParcelasFuturas(investment.campanha_id, "Quitação antecipada autorizada pelo Financeiro");
        if (!res.success) {
          throw new Error(res.message || "Falha ao cancelar parcelas futuras.");
        }
        setSuccessMsg("Quitação antecipada realizada com sucesso!");
        // Recarregar plano
        const reload = await obterPlanoFinanceiroCampanha(investment.campanha_id);
        if (reload.success && reload.data) setPlanoData(reload.data);
      } catch (err: any) {
        setError(err.message || "Erro ao processar quitação antecipada.");
      }
    });
  };

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
          <h1 className="text-xl font-bold text-foreground">Confirmar Pagamento & Baixa Financeira</h1>
          <p className="text-sm text-muted mt-0.5">
            {matrizNome || investment.rede} — {investment.codigo ? `#${investment.codigo}` : ''} — Fase 5: Financeiro
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-elevated border border-border rounded-2xl p-4 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-xs text-muted block">Investimento da Ação</span>
          <span className="font-black text-gold text-lg">{formatCurrency(Number(investment.valor_investimento) || 0)}</span>
        </div>
        {planoData?.campanha && (
          <div>
            <span className="text-xs text-muted block">Saldo Devedor Total</span>
            <span className={`font-black text-lg ${planoData.campanha.saldo_financeiro_devedor <= 0.01 ? "text-emerald-400" : "text-amber-400"}`}>
              {formatCurrency(planoData.campanha.saldo_financeiro_devedor || 0)}
            </span>
          </div>
        )}
        <div>
          <span className="text-xs text-muted block">Forma de Pagamento</span>
          <span className="font-bold text-foreground">{investment.tipo_pagamento || 'Transf. Bancária'}</span>
        </div>
        {investment.mes_referencia && (
          <div>
            <span className="text-xs text-muted block">Mês Ref.</span>
            <span className="font-bold text-foreground">{investment.mes_referencia}</span>
          </div>
        )}
      </div>

      {/* Grade de Parcelas da Negociação (se houver) */}
      {planoData && planoData.parcelas && planoData.parcelas.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-gold" />
              Plano de Parcelas da Negociação ({planoData.parcelas.length} parcelas)
            </div>
            {planoData.parcelas.some((p: any) => p.status_parcela === "PENDENTE") && (
              <button
                type="button"
                onClick={handleQuitacaoAntecipada}
                disabled={isPending}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Quitar Parcelas Futuras Antecipadamente
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-border/60 rounded-xl bg-elevated/40">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted bg-elevated">
                  <th className="py-2 px-3">Parcela</th>
                  <th className="py-2 px-3">Vencimento</th>
                  <th className="py-2 px-3">Valor Previsto</th>
                  <th className="py-2 px-3">Valor Pago</th>
                  <th className="py-2 px-3">Saldo Remanescente</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {planoData.parcelas.map((p: any) => (
                  <tr key={p.id} className="hover:bg-elevated/70 transition-colors">
                    <td className="py-2 px-3 font-bold text-foreground">{p.numero_parcela}/{p.total_parcelas}</td>
                    <td className="py-2 px-3 text-muted">{p.data_vencimento}</td>
                    <td className="py-2 px-3 font-medium">{formatCurrency(p.valor_previsto)}</td>
                    <td className="py-2 px-3 text-emerald-400 font-medium">{formatCurrency(p.valor_pago_acumulado)}</td>
                    <td className="py-2 px-3 font-bold text-gold">{formatCurrency(p.saldo_remanescente)}</td>
                    <td className="py-2 px-3 text-right">
                      {p.status_parcela === "QUITADA" ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">QUITADA</span>
                      ) : p.status_parcela === "PARCIALMENTE_PAGA" ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px]">PARCIAL</span>
                      ) : p.status_parcela.startsWith("CANCELADA") ? (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-500/20 text-zinc-400 font-bold text-[10px]">CANCELADA</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold text-[10px]">PENDENTE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleBaixaFinanceira} className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
          <DollarSign className="w-4 h-4 text-gold" />
          Dados da Baixa Financeira
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Valor do Pagamento */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">
              Valor a Baixar (R$) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gold" />
              <input
                type="text"
                required
                value={valorBaixa}
                onChange={(e) => setValorBaixa(e.target.value)}
                placeholder="0,00"
                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-gold font-bold text-base focus:border-gold focus:ring-1 focus:ring-gold transition-all"
              />
            </div>
            <span className="text-[11px] text-muted block">
              Pagamentos amortizam as parcelas em ordem cronológica (FIFO).
            </span>
          </div>

          {/* Data do Pagamento */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">
              Data da Efetivação <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
              <input
                type="date"
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground text-sm focus:border-gold focus:ring-1 focus:ring-gold transition-all [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

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
                  <span className="text-sm text-muted font-medium">Anexar comprovante bancário</span>
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
          <label className="block text-sm font-medium text-muted">Observações da Liquidação</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Baixa parcial referente à NF 1234..."
            rows={3}
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border">
          <button 
            type="submit"
            disabled={isPending || uploading}
            className="w-full bg-emerald-500 text-white font-bold text-base rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
          >
            {isPending ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Banknote className="w-6 h-6" />
                Confirmar Baixa & Liquidação Financeira
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
