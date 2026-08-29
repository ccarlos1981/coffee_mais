"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Calendar,
  DollarSign,
  TrendingDown,
  Sparkles,
  Building2,
  User,
  MapPin,
  Clock,
  Package,
  Layers,
  ArrowRight,
  Send,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import type { FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";

export interface ActionCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: {
    id?: string | null;
    tipoAcao: string;
    clienteId?: string | null;
    codParceiro?: string | null;
    clienteNome: string;
    cnpj?: string | null;
    redeNome?: string | null;
    codigoMatriz?: string | null;
    gerenteNome?: string | null;
    canal?: string | null;
    uf?: string | null;
    cidade?: string | null;
    score?: number | null;
    prioridade?: string | null;
    classificacaoRisco?: string | null;
    justificativa?: string | null;
    faturamentoReal?: number | null;
    faturamentoPerdido?: number | null;
    diasSemComprar?: number | null;
    frequenciaHistoricaDias?: number | null;
    skusVendidos?: number | null;
    totalPortfolio?: number | null;
    pctPenetracao?: number | null;
    skusSugeridos?: Array<{
      productId?: number;
      codigoIntegracao?: string;
      nomeProduto: string;
      quantidadeSugeridaUnidades: number;
      quantidadeCaixas: number;
      pesoTotalKg: number;
      precoUnitario: number;
      valorSubtotal: number;
      participacaoHistoricaPct: number;
    }>;
    dataStr: string;
    origem?: string | null;
    origemRef?: string | null;
  } | null;
  onOpenFollowUp?: (context: FollowUpInitialContext) => void;
}

export function ActionCenterDrawer({
  isOpen,
  onClose,
  opportunity,
  onOpenFollowUp,
}: ActionCenterDrawerProps) {
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [loadingFarol, setLoadingFarol] = useState(false);
  const [farolError, setFarolError] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);

  // Consulta ao Farol Comercial & Financeiro (100% on-demand com AbortController)
  const fetchFarol = useCallback(
    async (signal?: AbortSignal) => {
      if (!opportunity) return;
      setLoadingFarol(true);
      setFarolError(null);

      try {
        const params = new URLSearchParams();
        if (opportunity.codParceiro) params.set("codParceiro", String(opportunity.codParceiro).trim());
        if (opportunity.clienteId) params.set("clienteId", String(opportunity.clienteId).trim());
        if (opportunity.codigoMatriz) params.set("codigoMatriz", String(opportunity.codigoMatriz).trim());
        if (opportunity.redeNome) params.set("redeNome", String(opportunity.redeNome).trim());
        if (selectedNetwork) params.set("redeNome", selectedNetwork.trim());

        const res = await fetch(`/api/inovacoes/crm/farol?${params.toString()}`, {
          signal,
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Farol retornou status ${res.status}`);
        }

        const json = await res.json();
        if (json.success && json.data) {
          setFarolData(json.data);
        } else {
          setFarolData(null);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Cancelamento silencioso ao desmontar ou trocar de oportunidade
          return;
        }
        console.error("Erro ao carregar Farol 360°:", err);
        setFarolError("Não foi possível carregar o diagnóstico financeiro completo.");
      } finally {
        setLoadingFarol(false);
      }
    },
    [opportunity, selectedNetwork]
  );

  useEffect(() => {
    if (!isOpen || !opportunity) {
      setFarolData(null);
      setFarolError(null);
      setSelectedNetwork(null);
      return;
    }

    const controller = new AbortController();
    fetchFarol(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isOpen, opportunity, fetchFarol]);

  // Fechar com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !opportunity) return null;

  const formatCur = (val?: number | null) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const formatPct = (val?: number | null) =>
    `${(val || 0).toFixed(1)}%`;

  // Mapeamento canônico do tipo de ação para Follow-Up
  const mapFollowUpTipo = (tipo: string): any => {
    switch (tipo?.toUpperCase()) {
      case "REATIVACAO":
      case "REATIVACAO_CLIENTE":
        return "REATIVACAO_CLIENTE";
      case "EXPANSAO":
      case "EXPANSAO_MIX":
        return "EXPANSAO_MIX";
      case "QUEDA_CRITICA":
      case "RECUPERACAO_VOLUME":
        return "RECUPERACAO_VOLUME";
      case "NEGOCIACAO_REDE":
        return "NEGOCIACAO_REDE";
      case "VISITA_COMERCIAL":
        return "VISITA_COMERCIAL";
      case "ENVIO_PROPOSTA":
        return "ENVIO_PROPOSTA";
      default:
        return "OUTRO";
    }
  };

  const handleActionFollowUp = () => {
    if (!onOpenFollowUp) return;

    const tipoAcaoCanonico = mapFollowUpTipo(opportunity.tipoAcao);
    const cleanCod = opportunity.codParceiro || opportunity.clienteId || "CLI";
    const cleanComp = (opportunity.dataStr || "2026-08").replace(/[^a-zA-Z0-9]/g, "_");
    const canonicalRef = `ACTIONCENTER_${tipoAcaoCanonico}_${cleanCod}_${cleanComp}`;

    const initialCtx: FollowUpInitialContext = {
      cliente_id: opportunity.clienteId || undefined,
      clienteNome: opportunity.clienteNome,
      rede: opportunity.redeNome || null,
      codigo: opportunity.codParceiro || opportunity.codigoMatriz || undefined,
      responsavel: opportunity.gerenteNome || null,
      tipo_acao: tipoAcaoCanonico,
      motivo: `Oportunidade Prescritiva: ${opportunity.clienteNome}`,
      descricao: opportunity.justificativa || `Ação comercial prescritiva gerada pelo Sales Action Center 360°.`,
      prazo: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      prioridade: opportunity.prioridade === "ALTA" || opportunity.classificacaoRisco === "CRITICO" ? "CRITICA" : "ALTA",
      origem: "COCKPIT_PRESCRITIVO",
      origem_ref: canonicalRef,
      gap_original_reais: opportunity.faturamentoPerdido || 0,
    };

    onOpenFollowUp(initialCtx);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Diagnóstico 360 da Oportunidade"
      aria-busy={loadingFarol}
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-card border-l border-border h-full shadow-2xl flex flex-col z-10 overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border/80 bg-background/50 sticky top-0 backdrop-blur-md z-10 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-gold/15 text-gold border border-gold/30 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-gold" />
                Sales Action Center 360°
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Score: {opportunity.score ?? 85}/100
              </span>
            </div>
            <h2 className="text-lg font-black text-foreground tracking-tight" title={opportunity.clienteNome}>
              {opportunity.clienteNome}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {opportunity.redeNome && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> {opportunity.redeNome}
                </span>
              )}
              {opportunity.gerenteNome && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" /> {opportunity.gerenteNome}
                </span>
              )}
              {opportunity.uf && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {opportunity.uf}
                </span>
              )}
              {opportunity.cnpj && (
                <span className="text-[11px] font-mono text-muted-foreground/80">
                  CNPJ: {opportunity.cnpj}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Fechar Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Card 1: Diagnóstico Prescritivo & Justificativa */}
          <div className="p-5 rounded-2xl bg-background/60 border border-border/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Diagnóstico & Justificativa de Ação
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Prioridade: {opportunity.prioridade || "ALTA"}
              </span>
            </div>

            <p className="text-sm text-foreground/90 leading-relaxed bg-card/60 p-3.5 rounded-xl border border-border/60">
              {opportunity.justificativa ||
                `Identificada oportunidade comercial prioritária com potencial de impacto de ${formatCur(
                  opportunity.faturamentoPerdido
                )}. Recomenda-se atuação comercial imediata.`}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Dias sem Compra</span>
                <span className="text-sm font-black text-rose-400">{opportunity.diasSemComprar ?? 0} dias</span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Freq. Média</span>
                <span className="text-sm font-bold text-foreground">{opportunity.frequenciaHistoricaDias ?? 20} dias</span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Faturamento Real</span>
                <span className="text-sm font-bold text-emerald-400">{formatCur(opportunity.faturamentoReal)}</span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Impacto Represado</span>
                <span className="text-sm font-black text-amber-400">{formatCur(opportunity.faturamentoPerdido)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Penetração de Mix & SKUs Sugeridos de Reposição */}
          <div className="p-5 rounded-2xl bg-background/60 border border-border/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Package className="w-4 h-4 text-gold" />
                Penetração de Catálogo & Sortimento
              </h3>
              <span className="text-xs font-bold text-foreground">
                {opportunity.skusVendidos ?? 0} / {opportunity.totalPortfolio ?? 28} SKUs ({formatPct(opportunity.pctPenetracao)})
              </span>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-gold h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, opportunity.pctPenetracao || 25))}%` }}
              />
            </div>

            {/* Listagem de SKUs Sugeridos com conversão física */}
            {opportunity.skusSugeridos && opportunity.skusSugeridos.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Sugestão de Reposição & Expansão de Mix
                </span>
                <div className="space-y-2">
                  {opportunity.skusSugeridos.map((sku, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-foreground block truncate" title={sku.nomeProduto}>
                          {sku.nomeProduto}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {sku.quantidadeSugeridaUnidades} un • {sku.quantidadeCaixas} cx ({sku.pesoTotalKg} kg)
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-emerald-400 block">{formatCur(sku.valorSubtotal)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {sku.participacaoHistoricaPct}% do mix
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Farol Comercial & Financeiro (Wave B.9 - On Demand) */}
          <div className="p-5 rounded-2xl bg-background/60 border border-border/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Farol Comercial & Financeiro (On-Demand)
              </h3>
              {loadingFarol && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-gold" /> Consultando títulos e acordos...
                </span>
              )}
            </div>

            {farolError ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {farolError}
              </div>
            ) : !farolData ? (
              <div className="p-4 text-center text-xs text-muted-foreground rounded-xl bg-card border border-border">
                {loadingFarol ? "Carregando diagnóstico..." : "Dados financeiros não vinculados."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Bloco Adimplência */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">Adimplência Operacional</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        farolData.adimplencia.status === "EM_DIA"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : farolData.adimplencia.status === "INADIMPLENTE"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {farolData.adimplencia.status === "EM_DIA"
                        ? "EM DIA"
                        : farolData.adimplencia.status === "INADIMPLENTE"
                        ? "INADIMPLENTE"
                        : "DADOS INDISPONÍVEIS"}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 text-foreground/80">
                    <div>
                      Títulos Vencidos:{" "}
                      <span className="font-bold text-foreground">
                        {farolData.adimplencia.titulosVencidosCount}
                      </span>
                    </div>
                    <div>
                      Maior Atraso:{" "}
                      <span className="font-bold text-foreground">
                        {farolData.adimplencia.maiorAtrasoDias} dias
                      </span>
                    </div>
                    {farolData.adimplencia.valorVencidoTotal ? (
                      <div>
                        Total Vencido:{" "}
                        <span className="font-bold text-rose-400">
                          {formatCur(farolData.adimplencia.valorVencidoTotal)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Bloco Carta de Anuência */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">Carta de Anuência</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        farolData.cartaAnuencia.status === "VIGENTE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : farolData.cartaAnuencia.status === "PENDENTE"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {farolData.cartaAnuencia.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 text-foreground/80">
                    <div>
                      Validade:{" "}
                      <span className="font-bold text-foreground">
                        {farolData.cartaAnuencia.validadeAte || "Sem registro"}
                      </span>
                    </div>
                    <div>
                      Dias para Expirar:{" "}
                      <span className="font-bold text-foreground">
                        {farolData.cartaAnuencia.diasParaExpirar ?? "—"}
                      </span>
                    </div>
                    <div>
                      Nº Documento:{" "}
                      <span className="font-bold text-foreground">
                        {farolData.cartaAnuencia.numeroCarta || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer com Botão de Despacho 1-Clique */}
        <div className="p-6 border-t border-border bg-background/80 sticky bottom-0 backdrop-blur-md flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            Fechar Diagnóstico
          </button>

          {onOpenFollowUp && (
            <button
              type="button"
              onClick={handleActionFollowUp}
              className="px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-hover text-gold-foreground text-xs font-black shadow-lg shadow-gold/20 flex items-center gap-2 transition-transform active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Despachar Follow-up com SLA</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
