"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ShieldCheck,
  Zap,
  DollarSign,
  Calendar,
  User,
  MapPin,
  Copy,
  Check,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  FileText,
  Mail,
  Share2,
  Clock,
  Briefcase,
  Layers,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { OpportunityRecommendation, SuggestedSku } from "@/lib/services/opportunity-recommendation-service";
import { NewFollowUpModal, FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";
import { FollowUpStatusBadge } from "@/app/processo-comercial/follow-up/components/FollowUpStatusBadge";
import type { FollowUpActionRecord } from "@/lib/services/follow-up-service";
import { CrmFarolStatusCard } from "./CrmFarolStatusCard";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";

interface CrmClienteDrawerProps {
  oportunidade: OpportunityRecommendation | any;
  onClose: () => void;
}

export const CrmClienteDrawer: React.FC<CrmClienteDrawerProps> = ({ oportunidade: rawOp, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeActionToast, setActiveActionToast] = useState<string | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [existingFollowUp, setExistingFollowUp] = useState<FollowUpActionRecord | null>(null);
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [loadingFarol, setLoadingFarol] = useState<boolean>(false);
  const [errorFarol, setErrorFarol] = useState<string | null>(null);

  if (!rawOp) return null;

  const router = useRouter();

  const handleGerarFollowUp = () => {
    setIsFollowUpModalOpen(true);
  };
  
  // Normalização do objeto caso venha no formato legado CrmOportunidade
  const oportunidade: OpportunityRecommendation = rawOp.nomeParceiro
    ? rawOp
    : {
        clienteId: rawOp.clienteId || rawOp.id || "001",
        nomeParceiro: rawOp.clienteNome || "Cliente Especial",
        cnpj: "00.000.000/0001-00",
        rede: rawOp.matrizNome || "Cliente Direto",
        gerenteId: "1001",
        gerenteNome: rawOp.gerenteNome || "Gerente Responsável",
        canal: rawOp.canal || "KA",
        uf: rawOp.uf || "MG",
        diasSemCompra: rawOp.diasSemComprar || 0,
        frequenciaHistoricaDias: 20,
        dataUltimaCompra: "2026-06-12",
        faturamentoUltimaCompra: rawOp.valorImpactoPotencial || 15000,
        faturamentoMedioMensal: rawOp.valorImpactoPotencial || 20000,
        faturamentoAcumulado12M: (rawOp.valorImpactoPotencial || 20000) * 12,
        tendenciaConsumo: "ESTAVEL",
        historicoPedidosResumido: [
          { data: "2026-06-12", valor: (rawOp.valorImpactoPotencial || 15000) * 1.1, status: "CONCLUIDO" },
          { data: "2026-05-18", valor: (rawOp.valorImpactoPotencial || 15000) * 0.95, status: "CONCLUIDO" },
        ],
        evolucaoFaturamentoMeses: [
          { mes: "Mai/26", valor: (rawOp.valorImpactoPotencial || 15000) * 0.95 },
          { mes: "Jun/26", valor: (rawOp.valorImpactoPotencial || 15000) * 1.1 },
        ],
        scoreOportunidade: rawOp.scoreImpacto || 85,
        classificacaoRisco: rawOp.prioridade === "ALTA" ? "CRITICO" : "ALTO",
        faturamentoPerdidoEstimado: rawOp.valorImpactoPotencial || 15000,
        prioridadeCarteira: "CURVA_A",
        justificativaRecomendacao: rawOp.descricao || rawOp.titulo || "Ação prescritiva de reposição comercial.",
        impactoFinanceiroTotal: rawOp.valorImpactoPotencial || 15000,
        skusSugeridos: [
          {
            productId: 101,
            codigoIntegracao: "SKU-MOIDO-250G",
            nomeProduto: "Café Moido Especial 250g (cx 20 un)",
            quantidadeSugeridaUnidades: 120,
            quantidadeCaixas: 6,
            pesoTotalKg: 30,
            precoUnitario: 18.5,
            valorSubtotal: (rawOp.valorImpactoPotencial || 15000) * 0.45,
            participacaoHistoricaPct: 45,
          },
          {
            productId: 102,
            codigoIntegracao: "SKU-CAPSULA-10UN",
            nomeProduto: "Cápsula Intenso Coffee++ (cx 12 un)",
            quantidadeSugeridaUnidades: 144,
            quantidadeCaixas: 12,
            pesoTotalKg: 7.2,
            precoUnitario: 24.9,
            valorSubtotal: (rawOp.valorImpactoPotencial || 15000) * 0.35,
            participacaoHistoricaPct: 35,
          },
        ],
        acoesDisponiveis: ["WHATSAPP", "PDF", "EMAIL", "CRM", "FOLLOW_UP"],
      };

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleCopyWhatsApp = () => {
    const text =
      `☕ *COFFEE++ — CENTRAL DE DECISÃO COMERCIAL*\n` +
      `*Cliente:* ${oportunidade.nomeParceiro}\n` +
      `*Canal/UF:* ${oportunidade.canal} | ${oportunidade.uf}\n` +
      `*Gerente Responsável:* ${oportunidade.gerenteNome}\n` +
      `*Score de Oportunidade:* ${oportunidade.scoreOportunidade}/100 (${oportunidade.classificacaoRisco})\n` +
      `*Atraso Estimado:* ${oportunidade.diasSemCompra} dias sem comprar (Freq. normal: ${oportunidade.frequenciaHistoricaDias}d)\n` +
      `*Faturamento Perdido Est.:* ${formatCur(oportunidade.faturamentoPerdidoEstimado)}\n\n` +
      `📦 *SUGESTÃO DE REPOSIÇÃO DE ESTOQUE (PROPOSTA COMERCIAL):*\n` +
      oportunidade.skusSugeridos
        .map(
          (s) =>
            `• *${s.nomeProduto}*\n  Quantidade: ${s.quantidadeSugeridaUnidades} UN (${s.quantidadeCaixas} CX / ${s.pesoTotalKg} KG) — Participação Histórica: ${s.participacaoHistoricaPct}%\n  Valor Estimado: ${formatCur(s.valorSubtotal)}`
        )
        .join("\n\n") +
      `\n\n💰 *VALOR TOTAL SUGERIDO:* ${formatCur(oportunidade.impactoFinanceiroTotal)}\n\n` +
      `*Justificativa Comercial:* ${oportunidade.justificativaRecomendacao}\n\n` +
      `_Enviado via Central de inteligência Prescritiva Coffee++_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFutureAction = (actionName: string) => {
    setActiveActionToast(`Ação "${actionName}" preparada na arquitetura read-only.`);
    setTimeout(() => setActiveActionToast(null), 3000);
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case "CRESCENTE":
        return { label: "📈 Em Expansão", style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
      case "ESTAVEL":
        return { label: "➡️ Estável", style: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
      case "DECLINIO":
        return { label: "📉 Em Declínio", style: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
      case "INATIVO":
        return { label: "🚨 Inativo", style: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
      default:
        return { label: trend, style: "bg-muted text-muted-foreground border-border" };
    }
  };

  const trendInfo = getTrendBadge(oportunidade.tendenciaConsumo);

  const fetchFollowUpStatus = useCallback(async (clienteId: string) => {
    if (!clienteId) return;
    try {
      const res = await fetch(`/api/follow-up?clienteId=${encodeURIComponent(clienteId)}&pageSize=1`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setExistingFollowUp(json.data[0]);
      } else {
        setExistingFollowUp(null);
      }
    } catch (err) {
      console.error("Erro ao buscar status do follow-up:", err);
    }
  }, []);

  const fetchFarolStatus = useCallback(async (cliId: string, redeName?: string | null, signal?: AbortSignal) => {
    if (!cliId && !redeName) return;
    setLoadingFarol(true);
    setErrorFarol(null);
    try {
      const params = new URLSearchParams();
      if (cliId) params.set("clienteId", cliId);
      if (redeName) params.set("redeNome", redeName);

      const res = await fetch(`/api/inovacoes/crm/farol?${params.toString()}`, { signal, cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Falha ao consultar Farol (${res.status})`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setFarolData(json.data);
      } else {
        setErrorFarol(json.error || "Dados do Farol indisponíveis");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Erro ao carregar Farol Comercial & Financeiro:", err);
        setErrorFarol(err.message || "Erro na conexão com o Farol.");
      }
    } finally {
      setLoadingFarol(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (oportunidade.clienteId) {
      fetchFollowUpStatus(oportunidade.clienteId);
      fetchFarolStatus(oportunidade.clienteId, oportunidade.rede, controller.signal);
    }
    return () => {
      controller.abort();
    };
  }, [oportunidade.clienteId, oportunidade.rede, fetchFollowUpStatus, fetchFarolStatus]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md transition-all animate-in fade-in">
      <div className="w-full max-w-2xl bg-card border-l border-border h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto space-y-6">
        <div className="space-y-6">
          {/* Header Executivo */}
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="bg-gold/10 text-gold text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-gold/20">
                  ID #{oportunidade.clienteId}
                </span>
                <span className="bg-muted text-muted-foreground text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-border">
                  {oportunidade.prioridadeCarteira}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  {oportunidade.canal} | {oportunidade.uf}
                </span>
                {existingFollowUp && (
                  <FollowUpStatusBadge
                    status={existingFollowUp.status}
                    isAtrasada={existingFollowUp.is_atrasada}
                    size="xs"
                    title={`Ação de Follow-up vinculada: ${existingFollowUp.motivo}`}
                  />
                )}
              </div>
              <h2 className="text-xl font-black text-foreground leading-tight">
                {oportunidade.nomeParceiro}
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                <span>Matriz/Rede: <strong className="text-foreground">{oportunidade.rede || "Cliente Direto"}</strong></span>
                <span>•</span>
                <span>Gerente: <strong className="text-gold">{oportunidade.gerenteNome}</strong></span>
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Banner Toast de Ação Preparada */}
          {activeActionToast && (
            <div className="p-3 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{activeActionToast}</span>
            </div>
          )}

          {/* Painel de Inteligência Prescritiva: Score & Diagnóstico */}
          <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gold/10 text-gold border border-gold/20">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Score Comercial</span>
                  <div className="text-3xl font-black font-mono text-gold leading-none mt-0.5">
                    {oportunidade.scoreOportunidade} / 100
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-right">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Tendência</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${trendInfo.style}`}>
                    {trendInfo.label}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Criticidade</span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {oportunidade.classificacaoRisco}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Farol Comercial & Financeiro (Adimplência + Acordo Comercial) */}
          <CrmFarolStatusCard
            farol={farolData}
            loading={loadingFarol}
            error={errorFarol}
          />

          {/* Indicadores Diagnósticos Financeiros & Operacionais */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-gold" />
              Diagnóstico Financeiro & Carteira
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Faturamento Perdido Est.</span>
                <div className="font-bold text-rose-400 text-sm">
                  {formatCur(oportunidade.faturamentoPerdidoEstimado)}
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Atraso em Dias</span>
                <div className="font-bold text-foreground text-sm">
                  {oportunidade.diasSemCompra} dias
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Média Mensal</span>
                <div className="font-bold text-emerald-500 text-sm">
                  {formatCur(oportunidade.faturamentoMedioMensal)}
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Última Compra</span>
                <div className="font-bold text-foreground text-xs">
                  {formatCur(oportunidade.faturamentoUltimaCompra)}
                </div>
              </div>
            </div>
          </div>

          {/* Justificativa Prescritiva da IA/Serviço */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gold" />
              Recomendação Prescritiva da Inteligência Comercial
            </h3>
            <div className="bg-background border border-border rounded-2xl p-4 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {oportunidade.justificativaRecomendacao}
              </p>
            </div>
          </div>

          {/* Histórico Resumido dos Últimos Pedidos */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gold" />
              Histórico Resumido dos Últimos Pedidos
            </h3>
            <div className="bg-background border border-border rounded-2xl overflow-hidden divide-y divide-border font-mono text-xs">
              {oportunidade.historicoPedidosResumido && oportunidade.historicoPedidosResumido.length > 0 ? (
                oportunidade.historicoPedidosResumido.map((ped, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-foreground">{ped.data}</span>
                    </div>
                    <span className="font-bold text-foreground">{formatCur(ped.valor)}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {ped.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground text-xs italic">
                  Histórico granular de pedidos em consolidação.
                </div>
              )}
            </div>
          </div>

          {/* Evolução de Faturamento dos Últimos Meses */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-gold" />
              Evolução de Faturamento (Últimos Meses)
            </h3>
            <div className="bg-background border border-border rounded-2xl p-4 font-mono text-xs">
              {oportunidade.evolucaoFaturamentoMeses && oportunidade.evolucaoFaturamentoMeses.length > 0 ? (
                <div className="grid grid-cols-5 gap-2 text-center">
                  {oportunidade.evolucaoFaturamentoMeses.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block">{item.mes}</span>
                      <div className="font-bold text-foreground text-xs">{formatCur(item.valor)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-xs italic">
                  Evolução mensal em consolidação no Analytics.
                </div>
              )}
            </div>
          </div>

          {/* Tabela de SKUs Sugeridos com Visão Tripla (UN / CX / KG) e Participação Histórica (%) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-gold" />
                Sugestão de Reposição por SKU (UN / CX / KG)
              </h3>
              <span className="text-[10px] font-mono text-gold font-bold bg-gold/10 px-2.5 py-1 rounded-lg border border-gold/20">
                Total Sugerido: {formatCur(oportunidade.impactoFinanceiroTotal)}
              </span>
            </div>

            <div className="bg-background border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {oportunidade.skusSugeridos.map((sku: SuggestedSku, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between text-xs hover:bg-muted/30 transition-all">
                  <div className="space-y-1">
                    <div className="font-bold text-foreground">{sku.nomeProduto}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                      <span>{sku.quantidadeSugeridaUnidades} UN</span>
                      <span>•</span>
                      <span className="text-gold font-semibold">{sku.quantidadeCaixas} CX</span>
                      <span>•</span>
                      <span>{sku.pesoTotalKg} KG</span>
                      <span>•</span>
                      <span className="text-emerald-500 font-semibold">{sku.participacaoHistoricaPct}% do mix histórico</span>
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-foreground">
                    {formatCur(sku.valorSubtotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Central de Ações Comerciais Integradas */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-gold" />
              Central de Ações Comerciais Integradas
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-gold hover:bg-gold/90 text-black"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado para WhatsApp!" : "Copiar Pedido (WhatsApp)"}
              </button>

              <button
                type="button"
                onClick={handleGerarFollowUp}
                className="py-3 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <ClipboardList className="w-4 h-4" />
                Gerar Follow-up
              </button>

              <button
                type="button"
                onClick={() => handleFutureAction("Gerar PDF")}
                className="py-3 px-4 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center gap-2 transition-all"
              >
                <FileText className="w-4 h-4 text-gold" />
                Gerar PDF Proposta
              </button>

              <button
                type="button"
                onClick={() => handleFutureAction("Enviar E-mail")}
                className="py-3 px-4 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center gap-2 transition-all"
              >
                <Mail className="w-4 h-4 text-gold" />
                Enviar por E-mail
              </button>

              <button
                type="button"
                onClick={() => handleFutureAction("Registrar no CRM")}
                className="py-3 px-4 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center gap-2 transition-all"
              >
                <Briefcase className="w-4 h-4 text-gold" />
                Registrar no CRM
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all"
          >
            Fechar Central de Decisão
          </button>
        </div>
      </div>

      {/* Modal Canônica de Criação de Follow-up Prescritivo em 1 Clique */}
      {isFollowUpModalOpen && (
        <NewFollowUpModal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          onCreated={() => {
            setIsFollowUpModalOpen(false);
            setActiveActionToast("Ação de Follow-up registrada com sucesso no sistema!");
            setTimeout(() => setActiveActionToast(null), 4000);
            if (oportunidade.clienteId) {
              fetchFollowUpStatus(oportunidade.clienteId);
            }
          }}
          initialContext={{
            cliente_id: oportunidade.clienteId,
            clienteNome: oportunidade.nomeParceiro,
            rede: oportunidade.rede,
            manager_id: oportunidade.gerenteId || undefined,
            origem: "COCKPIT_PRESCRITIVO",
            origem_ref: `CRM_OPP_${oportunidade.clienteId}_${new Date().toISOString().slice(0, 7)}_${oportunidade.classificacaoRisco === "CRITICO" ? "REATIVACAO_CLIENTE" : "RECUPERACAO_VOLUME"}`,
            tipo_acao: oportunidade.classificacaoRisco === "CRITICO" ? "REATIVACAO_CLIENTE" : "RECUPERACAO_VOLUME",
            motivo: `Oportunidade Prescritiva: ${oportunidade.nomeParceiro} (${oportunidade.classificacaoRisco})`,
            descricao: `Score: ${oportunidade.scoreOportunidade}/100 | Dias sem compra: ${oportunidade.diasSemCompra} | Impacto Estimado: ${formatCur(oportunidade.impactoFinanceiroTotal || oportunidade.faturamentoPerdidoEstimado)}.\nJustificativa: ${oportunidade.justificativaRecomendacao}`,
            prioridade: oportunidade.classificacaoRisco === "CRITICO" ? "CRITICA" : oportunidade.classificacaoRisco === "ALTO" ? "ALTA" : "MEDIA",
          }}
        />
      )}
    </div>
  );
};
