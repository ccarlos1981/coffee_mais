"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, CheckCircle2, Package, X, RefreshCw, DollarSign, CreditCard, Link as LinkIcon, AlertCircle, Layers, ShieldAlert, CheckCircle } from "lucide-react";
import Link from "next/link";
import { concluirFechamentoInvestimentoCompletoAction } from "../../lancar/actions";
import { PlanoFinanceiroSection } from "@/app/investimento/components/PlanoFinanceiroSection";
import { ParcelaFinanceira } from "@/lib/investimento/plano-financeiro-service";
import { supabase } from "@/lib/supabase";
import { resolverApuracaoAcao, calcularDeltaApuracao } from "@/lib/investimento/apuracao-calculator";

interface ApuracaoFormProps {
  investment: any;
  matrizNome?: string;
  initialBoletos?: any[];
  campanha?: any;
  isMultiAction?: boolean;
  todasAcoesProntas?: boolean;
  totalCampanha?: number;
  acoesAtivasCount?: number;
  acoesNaoProntasCount?: number;
  acoesCampanha?: any[];
}

export function ApuracaoForm({ 
  investment, 
  matrizNome, 
  initialBoletos = [],
  campanha,
  isMultiAction = false,
  todasAcoesProntas = true,
  totalCampanha,
  acoesAtivasCount = 1,
  acoesNaoProntasCount = 0,
  acoesCampanha = []
}: ApuracaoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Idempotency Key gerada uma única vez na montagem do componente (prevenção de duplo clique e retries)
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());

  // Diagnóstico inicial canônico
  const initialDiag = useMemo(() => {
    const rawQtd = investment.apuracao_qtd_vendida != null 
      ? Number(investment.apuracao_qtd_vendida) 
      : (investment.volume_vendido_sellout != null ? Number(investment.volume_vendido_sellout) : null);
    return resolverApuracaoAcao(investment, rawQtd);
  }, [investment]);

  // Se a ação não puder ser calculada automaticamente ou tiver override salvo
  const [overrideGastoEfetivo, setOverrideGastoEfetivo] = useState<boolean>(() => {
    if (!initialDiag.podeCalcularAutomatico) return true;
    if (investment.apuracao_valor_realizado != null && initialDiag.valorAutomatico !== null) {
      return Math.abs(Number(investment.apuracao_valor_realizado) - initialDiag.valorAutomatico) > 0.009;
    }
    return false;
  });

  const [valorGastoEfetivo, setValorGastoEfetivo] = useState<string>(() => {
    if (investment.apuracao_valor_realizado != null) {
      return Number(investment.apuracao_valor_realizado).toFixed(2);
    }
    return "";
  });

  const [numeroAcordo, setNumeroAcordo] = useState(investment.apuracao_numero_acordo || investment.numero_acordo || "");
  const [volumeVendido, setVolumeVendido] = useState<string>(() => {
    if (investment.apuracao_qtd_vendida != null) return investment.apuracao_qtd_vendida.toString().replace(".", ",");
    if (investment.volume_vendido_sellout != null) return investment.volume_vendido_sellout.toString().replace(".", ",");
    return "";
  });

  const [valorRealizado, setValorRealizado] = useState<string>(() => {
    if (investment.apuracao_valor_realizado != null) {
      return Number(investment.apuracao_valor_realizado).toFixed(2).replace(".", ",");
    }
    if (initialDiag.podeCalcularAutomatico && initialDiag.valorAutomatico !== null) {
      return initialDiag.valorAutomatico.toFixed(2).replace(".", ",");
    }
    return "";
  });

  const currentQtd = useMemo(() => {
    return volumeVendido ? parseFloat(volumeVendido.replace(/\./g, "").replace(",", ".")) : null;
  }, [volumeVendido]);

  const currentDiag = useMemo(() => {
    return resolverApuracaoAcao(investment, currentQtd);
  }, [investment, currentQtd]);

  const currentValorRealizadoNum = useMemo(() => {
    return valorRealizado ? parseFloat(valorRealizado.replace(/\./g, "").replace(",", ".")) || 0 : 0;
  }, [valorRealizado]);

  const currentDelta = useMemo(() => {
    return calcularDeltaApuracao(currentValorRealizadoNum, Number(investment.valor_investimento) || 0);
  }, [currentValorRealizadoNum, investment.valor_investimento]);

  // Total canônico da campanha: soma dos realizados das ações elegíveis
  const valorTotalCampanha = useMemo(() => {
    if (!acoesCampanha || acoesCampanha.length === 0) {
      return Math.round(currentValorRealizadoNum * 100) / 100;
    }

    const somaOutras = acoesCampanha
      .filter((a: any) => a.id !== investment.id)
      .reduce((acc: number, a: any) => {
        const val = a.apuracao_valor_realizado != null 
          ? Number(a.apuracao_valor_realizado) 
          : (Number(a.valor_investimento) || 0);
        return acc + val;
      }, 0);

    return Math.round((somaOutras + currentValorRealizadoNum) * 100) / 100;
  }, [acoesCampanha, investment.id, currentValorRealizadoNum]);

  const handleVolumeChange = (raw: string) => {
    const masked = maskVolume(raw);
    setVolumeVendido(masked);
    const cleanQtd = masked ? parseFloat(masked.replace(/\./g, "").replace(",", ".")) : null;
    const diag = resolverApuracaoAcao(investment, cleanQtd);

    if (!overrideGastoEfetivo && diag.podeCalcularAutomatico) {
      if (diag.valorAutomatico !== null) {
        setValorRealizado(diag.valorAutomatico.toFixed(2).replace(".", ","));
      } else {
        setValorRealizado("");
      }
    }
  };

  const handleOverrideToggle = (checked: boolean) => {
    setOverrideGastoEfetivo(checked);
    const cleanQtd = volumeVendido ? parseFloat(volumeVendido.replace(/\./g, "").replace(",", ".")) : null;
    const diag = resolverApuracaoAcao(investment, cleanQtd);

    if (checked) {
      const val = valorGastoEfetivo || (valorRealizado ? valorRealizado.replace(/\./g, "").replace(",", ".") : "");
      setValorGastoEfetivo(val);
      if (val) {
        setValorRealizado(parseFloat(val).toFixed(2).replace(".", ","));
      }
    } else {
      if (diag.podeCalcularAutomatico && diag.valorAutomatico !== null) {
        setValorRealizado(diag.valorAutomatico.toFixed(2).replace(".", ","));
      } else {
        setValorRealizado("");
      }
    }
  };

  const handleGastoEfetivoChange = (raw: string) => {
    setValorGastoEfetivo(raw);
    const cleanNum = parseFloat(raw) || 0;
    setValorRealizado(cleanNum > 0 ? cleanNum.toFixed(2).replace(".", ",") : (raw === "0" ? "0,00" : ""));
  };

  const [condicaoPagamento, setCondicaoPagamento] = useState(
    investment.condicao_pagamento || investment.tipo_pagamento || "Abatimento em Boleto"
  );
  const [semBoleto, setSemBoleto] = useState<boolean>(Boolean(investment.sem_boleto));
  const [postActionNotes, setPostActionNotes] = useState(investment.post_action_notes || "");
  
  // Boletos vinculados (Ownership: Apuração Comercial)
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

  // Estado das parcelas financeiras para o fechamento
  const [parcelas, setParcelas] = useState<ParcelaFinanceira[]>(() => {
    const initialTotal = Math.round((totalCampanha ?? Number(investment.valor_investimento) ?? 0) * 100) / 100;
    return [{
      numero_parcela: 1,
      total_parcelas: 1,
      valor_previsto_original: initialTotal,
      valor_previsto: initialTotal,
      valor_pago_acumulado: 0,
      saldo_remanescente: initialTotal,
      data_vencimento: investment.data_inicio || new Date().toISOString().slice(0, 10),
      tipo_pagamento: investment.tipo_pagamento || "Transf. Bancária",
      status_parcela: "PENDENTE"
    }];
  });

  // Sincronização automática para plano à vista (1 parcela) quando o total realizado da campanha atualiza
  useEffect(() => {
    if (parcelas.length === 1 && parcelas[0].status_parcela === "PENDENTE") {
      setParcelas(prev => [{
        ...prev[0],
        valor_previsto_original: valorTotalCampanha,
        valor_previsto: valorTotalCampanha,
        saldo_remanescente: valorTotalCampanha
      }]);
    }
  }, [valorTotalCampanha]);

  // Reconciliação das parcelas
  const totalParcelasSoma = useMemo(() => {
    return Math.round(parcelas.reduce((acc, p) => acc + (Number(p.valor_previsto) || 0), 0) * 100) / 100;
  }, [parcelas]);

  const diferencaParcelas = useMemo(() => {
    return Math.round((valorTotalCampanha - totalParcelasSoma) * 100) / 100;
  }, [valorTotalCampanha, totalParcelasSoma]);

  const isPlanoEquilibrado = useMemo(() => {
    return Math.abs(diferencaParcelas) < 0.01;
  }, [diferencaParcelas]);

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

    // Validações do Plano Financeiro quando elegível (Caminho B)
    if (todasAcoesProntas) {
      if (!isPlanoEquilibrado) {
        setError(`A soma das parcelas (R$ ${totalParcelasSoma.toFixed(2)}) diverge do valor consolidado da campanha (R$ ${valorTotalCampanha.toFixed(2)}). Por favor, equilibre o plano financeiro antes de concluir.`);
        return;
      }

      if (parcelas.length === 0) {
        setError("Ao menos uma parcela deve ser informada no plano financeiro.");
        return;
      }

      if (parcelas.some(p => Number(p.valor_previsto) <= 0)) {
        setError("O valor previsto de cada parcela deve ser maior que zero.");
        return;
      }
    }

    const cleanQtd = volumeVendido.trim() 
      ? parseInt(volumeVendido.replace(/\./g, "")) || null 
      : null;
    const cleanVal = valorRealizado.trim() 
      ? parseFloat(valorRealizado.replace(/\./g, "").replace(",", ".")) 
      : null;

    if (cleanVal === null || isNaN(cleanVal) || cleanVal < 0) {
      setError("Por favor, informe um valor realizado válido para a apuração.");
      return;
    }

    if (!currentDiag.podeCalcularAutomatico && cleanVal <= 0) {
      setError(currentDiag.motivoExigenciaEfetivo || "É obrigatório informar o Valor Efetivamente Gasto para esta ação.");
      return;
    }

    // Estruturação do Payload do Plano Financeiro:
    // Se todasAcoesProntas for true: envia plano financeiro completo (CAMINHO B)
    // Se não (Multi-Action parcial): envia planoFinanceiro = null (CAMINHO A)
    const planoFinanceiroPayload = todasAcoesProntas ? {
      tipo_plano: (parcelas.length > 1 ? "PARCELADO" : "A_VISTA") as "A_VISTA" | "PARCELADO",
      parcelas: parcelas.map((p, idx) => ({
        numero_parcela: p.numero_parcela || idx + 1,
        valor_previsto: Number(p.valor_previsto),
        data_vencimento: p.data_vencimento || new Date().toISOString().slice(0, 10),
        tipo_pagamento: p.tipo_pagamento || "Transf. Bancária",
        observacoes: p.observacoes || undefined
      }))
    } : null;

    startTransition(async () => {
      try {
        const res = await concluirFechamentoInvestimentoCompletoAction({
          acaoId: investment.id,
          numeroAcordo: numeroAcordo.trim(),
          qtdVendida: cleanQtd,
          valorRealizado: cleanVal,
          evidencias: evidencias.length > 0 ? JSON.stringify(evidencias) : null,
          condicaoPagamento: condicaoPagamento || null,
          semBoleto: semBoleto,
          postActionNotes: postActionNotes || null,
          vinculos: vinculosBoletos.map(v => ({
            boleto_id: v.boleto_id,
            valor_associado: Number(v.valor_associado) || 0
          })),
          planoFinanceiro: planoFinanceiroPayload,
          idempotencyKey: idempotencyKey
        });

        if (!res.success) {
          setError(res.error || res.message || "Falha ao concluir fechamento da ação.");
          return;
        }

        router.push("/investimento");
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao salvar o fechamento.");
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
          <span className="text-xs text-muted block">Investimento da Ação</span>
          <span className="font-black text-gold">{formatCurrency(Number(investment.valor_investimento) || 0)}</span>
        </div>
        {isMultiAction && (
          <div>
            <span className="text-xs text-muted block">Total Consolidado Campanha</span>
            <span className="font-black text-emerald-400 flex items-center gap-1">
              {formatCurrency(valorTotalCampanha)}
              <span className="text-[10px] font-medium text-muted">({acoesAtivasCount} ações)</span>
            </span>
          </div>
        )}
        <div>
          <span className="text-xs text-muted block">Pagamento</span>
          <span className="font-medium text-foreground">{investment.tipo_pagamento || 'Abatimento'}</span>
        </div>
        {isMultiAction && (
          <div className="w-full pt-2 border-t border-border/60 flex items-center gap-2">
            <span className="text-xs font-bold text-muted flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-gold" />
              Negociação Multi-Ação:
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
              todasAcoesProntas 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
            }`}>
              {todasAcoesProntas ? "Todas as ações em apuração (Plano Financeiro Elegível)" : `${acoesNaoProntasCount} ação(ões) ainda em execução`}
            </span>
          </div>
        )}
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

        {/* Volume Vendido, Valor Realizado e Override */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Volume Vendido (Sell-out / Unidades)</label>
              <div className="relative">
                <Package className="absolute left-3 top-3 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={volumeVendido}
                  onChange={(e) => handleVolumeChange(e.target.value)}
                  placeholder="0"
                  className="w-full bg-elevated border border-border rounded-xl py-2.5 pl-9 pr-3 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-muted">Valor Realizado Automático</label>
                <span className="text-[10px] text-muted font-medium" title={currentDiag.descricaoVerba}>
                  {currentDiag.descricaoVerba}
                </span>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-muted" />
                <input
                  type="text"
                  readOnly
                  value={
                    currentDiag.valorAutomatico !== null
                      ? formatCurrency(currentDiag.valorAutomatico)
                      : (currentDiag.podeCalcularAutomatico ? "Aguardando volume" : "Não determinável automaticamente")
                  }
                  className={`w-full bg-elevated border border-border rounded-xl py-2.5 pl-9 pr-3 font-bold text-sm cursor-not-allowed ${
                    !currentDiag.podeCalcularAutomatico
                      ? "text-amber-500 text-xs"
                      : "text-emerald-400"
                  }`}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* Bloco de Override: Valor Efetivamente Gasto */}
          <div className="p-3.5 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-3">
            <div className="flex items-start gap-2.5">
              <input
                id="form_check_override_gasto"
                type="checkbox"
                checked={overrideGastoEfetivo || !currentDiag.podeCalcularAutomatico}
                disabled={!currentDiag.podeCalcularAutomatico}
                onChange={(e) => handleOverrideToggle(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-purple-500/30 text-purple-600 focus:ring-purple-500/50 bg-background cursor-pointer"
              />
              <label htmlFor="form_check_override_gasto" className="text-xs text-foreground cursor-pointer select-none">
                <span className="font-bold text-purple-300 block">
                  Informar valor efetivamente gasto
                </span>
                <span className="text-muted block text-[11px] mt-0.5">
                  {!currentDiag.podeCalcularAutomatico
                    ? (currentDiag.motivoExigenciaEfetivo || "Obrigatório informar o valor efetivo nesta modalidade.")
                    : "Marque para registrar o desembolso real quando divergir do cálculo automático."}
                </span>
              </label>
            </div>

            {(overrideGastoEfetivo || !currentDiag.podeCalcularAutomatico) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-purple-300">Valor Efetivamente Gasto (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-purple-300" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorGastoEfetivo}
                      onChange={(e) => handleGastoEfetivoChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-background border border-purple-500/40 rounded-xl py-2 pl-9 pr-3 text-sm font-bold text-gold focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                {currentDelta && (
                  <div className="flex flex-col justify-center bg-background/50 p-2.5 rounded-lg border border-border">
                    <span className="text-[11px] text-muted font-medium">Variação vs Planejado:</span>
                    <span className={`text-xs font-bold ${
                      currentDelta.tipo === "MENOR" ? "text-emerald-400" :
                      currentDelta.tipo === "MAIOR" ? "text-amber-400" : "text-foreground"
                    }`}>
                      {currentDelta.formatado}
                    </span>
                  </div>
                )}
              </div>
            )}
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

        {/* Seção de Vínculo de Boletos (Ownership: Apuração Comercial) */}
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

        {/* Seção de Situação e Plano Financeiro da Campanha */}
        <div className="space-y-3 pt-2 border-t border-border">
          {!todasAcoesProntas ? (
            /* CAMINHO A: Multi-Ação Parcial */
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-200">NEGOCIAÇÃO MULTI-AÇÃO EM EXECUÇÃO</h3>
              </div>
              <p className="text-xs text-amber-300/90 leading-relaxed">
                Esta campanha possui <strong>{acoesNaoProntasCount}</strong> outra(s) ação(ões) que ainda não atingiram a etapa de apuração (fase atual abaixo de 3).
              </p>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Ao concluir esta apuração, a ação atual avançará para a <strong>Fase 4 (Conferência Trade)</strong> e seus boletos vinculados serão salvos. A campanha permanecerá com status <strong>PENDENTE</strong> e zero parcelas. O Plano Financeiro definitivo da negociação master (valor consolidado de <strong>{formatCurrency(valorTotalCampanha)}</strong>) será configurado assim que todas as ações elegíveis chegarem à etapa de apuração.
              </p>
            </div>
          ) : (
            /* CAMINHO B: Single Action ou Multi-Ação 100% Pronta */
            <div className="space-y-3">
              {isMultiAction && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong className="block text-emerald-200 font-bold mb-0.5">Campanha Pronta para Fechamento Financeiro</strong>
                    Todas as <strong>{acoesAtivasCount}</strong> ações ativas desta campanha atingiram a fase de apuração. O valor consolidado da campanha é de <strong>{formatCurrency(valorTotalCampanha)}</strong>. Defina abaixo o plano financeiro para quitação contábil.
                  </div>
                </div>
              )}
              <PlanoFinanceiroSection
                totalAcoes={valorTotalCampanha}
                dataInicioGlobal={investment.data_inicio || new Date().toISOString().slice(0, 10)}
                tipoPagamentoGlobal={condicaoPagamento || investment.tipo_pagamento || "Transf. Bancária"}
                parcelas={parcelas}
                onChangeParcelas={setParcelas}
                disabled={isPending || uploading}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border">
          <button 
            type="submit"
            disabled={
              isPending || 
              uploading || 
              !numeroAcordo.trim() || 
              (!semBoleto && vinculosBoletos.length === 0 && boletosAbertos.length > 0) || 
              (todasAcoesProntas && !isPlanoEquilibrado) ||
              (!currentDiag.podeCalcularAutomatico && (!valorRealizado || currentValorRealizadoNum <= 0))
            }
            className="w-full bg-purple-600 text-white font-bold text-base rounded-xl py-3.5 flex items-center justify-center gap-2 hover:bg-purple-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20"
          >
            {isPending ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                {todasAcoesProntas 
                  ? "Concluir Apuração & Fechamento Financeiro (Fase 4)" 
                  : "Concluir Apuração da Ação (Fase 4)"
                }
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
