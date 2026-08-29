"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  BarChart3,
  Layers,
  Sparkles,
  User,
  Building2,
  Tag,
  Target,
  Plus,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { CommercialDomainService } from "@/lib/domain";
import { ExecutionControlDrawer } from "@/components/inovacoes/execution-control/ExecutionControlDrawer";
import { NewFollowUpModal, FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";
import type {
  FollowUpActionRecord,
  FollowUpKpis,
  FollowUpStatus,
  FollowUpOrigem,
  FollowUpPrioridade,
} from "@/lib/services/follow-up-service";

/* ───────────────── Visual Configuration Mappings ───────────────── */

const STATUS_CONFIG: Record<FollowUpStatus, { label: string; className: string; icon: any }> = {
  PENDENTE: { label: "Pendente", className: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Clock },
  EM_ANDAMENTO: { label: "Em Andamento", className: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Play },
  CONCLUIDA: { label: "Concluída", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  NAO_EFETIVA: { label: "Não Efetiva", className: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  CANCELADA: { label: "Cancelada", className: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: XCircle },
};

const PRIORIDADE_CONFIG: Record<FollowUpPrioridade, { label: string; className: string }> = {
  CRITICA: { label: "Crítica", className: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  ALTA: { label: "Alta", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  MEDIA: { label: "Média", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  BAIXA: { label: "Baixa", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const ORIGEM_LABELS: Record<string, string> = {
  COCKPIT_PRESCRITIVO: "Cockpit Prescritivo",
  RANKING_PERFORMANCE: "Ranking Performance",
  ALERTA_QUEDA: "Alerta Queda",
  RPS_COMPROMISSO: "RPS",
  MANUAL: "Manual",
};

const TIPO_LABELS: Record<string, string> = {
  REATIVACAO_CLIENTE: "Reativação",
  EXPANSAO_MIX: "Expansão Mix",
  RECUPERACAO_VOLUME: "Recuperação Volume",
  NEGOCIACAO_REDE: "Negociação Rede",
  VISITA_COMERCIAL: "Visita",
  ENVIO_PROPOSTA: "Proposta",
  OUTRO: "Outro",
};

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function ExecutionControlPage() {
  // ── Filters State ──
  const [filterManager, setFilterManager] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [filterPrioridade, setFilterPrioridade] = useState("all");
  const [filterSla, setFilterSla] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ACOES" | "RANKINGS" | "FUNIL">("ACOES");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ── Data State ──
  const [actions, setActions] = useState<FollowUpActionRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kpis, setKpis] = useState<FollowUpKpis | null>(null);
  const [totalOportunidades, setTotalOportunidades] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Manager Options from CommercialDomainService SSOT ──
  const [managerOptions, setManagerOptions] = useState<{ value: string; label: string }[]>([]);

  // ── Drawer & Modal State ──
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [initialContext, setInitialContext] = useState<FollowUpInitialContext | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const opts = CommercialDomainService.getManagerOptions();
    setManagerOptions(opts);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterManager !== "all") params.set("managerId", filterManager);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterOrigem !== "all") params.set("origem", filterOrigem);
      if (filterPrioridade !== "all") params.set("prioridade", filterPrioridade);
      if (searchQuery.trim()) params.set("searchCliente", searchQuery.trim());
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const kpiParams = new URLSearchParams();
      if (filterManager !== "all") kpiParams.set("managerId", filterManager);
      if (filterOrigem !== "all") kpiParams.set("origem", filterOrigem);

      const [actionsRes, kpisRes, crmRes] = await Promise.all([
        fetch(`/api/follow-up?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/follow-up/kpis?${kpiParams.toString()}`, { cache: "no-store" }),
        fetch("/api/inovacoes/crm?limit=1", { cache: "no-store" }).catch(() => null),
      ]);

      const actionsJson = await actionsRes.json();
      const kpisJson = await kpisRes.json();

      if (actionsJson.success) {
        setActions(actionsJson.data || []);
        setTotalItems(actionsJson.meta?.total || 0);
        setTotalPages(actionsJson.meta?.totalPages || 1);
      } else {
        setError(actionsJson.error || "Erro ao carregar lista de execuções.");
      }

      if (kpisJson.success) {
        setKpis(kpisJson.data || null);
      }

      if (crmRes) {
        const crmJson = await crmRes.json().catch(() => null);
        if (crmJson?.success && crmJson?.data?.resumoCarteira?.totalClientes) {
          setTotalOportunidades(crmJson.data.resumoCarteira.totalClientes);
        } else if (crmJson?.data?.oportunidades) {
          setTotalOportunidades(crmJson.data.oportunidades.length);
        }
      }
    } catch (err: any) {
      console.error("Erro ao buscar dados da Torre de Controle:", err);
      setError("Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filterManager, filterStatus, filterOrigem, filterPrioridade, searchQuery, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side SLA filtering on loaded page
  const todayStr = new Date().toISOString().slice(0, 10);
  const filteredActions = useMemo(() => {
    if (filterSla === "all") return actions;

    return actions.filter((act) => {
      const isAberta = ["PENDENTE", "EM_ANDAMENTO"].includes(act.status);
      if (filterSla === "ATRASADA") {
        return isAberta && act.prazo < todayStr;
      }
      if (filterSla === "VENCENDO") {
        return isAberta && act.prazo === todayStr;
      }
      if (filterSla === "NO_PRAZO") {
        return isAberta && act.prazo > todayStr;
      }
      if (filterSla === "CONCLUIDA_NO_PRAZO") {
        return act.status === "CONCLUIDA" && (act.concluded_at ? act.concluded_at.slice(0, 10) <= act.prazo : true);
      }
      if (filterSla === "CONCLUIDA_FORA_PRAZO") {
        return act.status === "CONCLUIDA" && act.concluded_at && act.concluded_at.slice(0, 10) > act.prazo;
      }
      return true;
    });
  }, [actions, filterSla, todayStr]);

  // SLA statistics derived from KPIs
  const totalAcoes = (kpis?.acoesAbertas || 0) + (kpis?.acoesConcluidas || 0);
  const taxaAderenciaSla = totalAcoes > 0
    ? Number((((totalAcoes - (kpis?.acoesAtrasadas || 0)) / totalAcoes) * 100).toFixed(1))
    : 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold text-xs shadow-2xl backdrop-blur-md flex items-center gap-2 border border-emerald-400/40 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/inovacoes/cockpit"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
                title="Voltar ao Cockpit"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-100">
                    Sales Execution Control Tower 360°
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    WAVE B.23
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Torre Executiva de Governança Comercial, Monitoramento de SLA & Efetividade Financeira
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <button
                onClick={() => {
                  setInitialContext(null);
                  setIsNewModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Ação
              </button>

              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors border border-slate-800"
                title="Atualizar dados"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-400" : ""}`} />
              </button>

              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Executive Summary Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3" aria-label="KPIs Executivos da Torre">
          {/* Total Ações */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Ações</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-100 font-mono">{totalAcoes}</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Abertas */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">Em Aberto</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-blue-400 font-mono">{kpis?.acoesAbertas || 0}</span>
              <Clock className="w-4 h-4 text-blue-500/60" />
            </div>
          </div>

          {/* Atrasadas */}
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Atrasadas</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-rose-400 font-mono">{kpis?.acoesAtrasadas || 0}</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
          </div>

          {/* Aderência SLA */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Aderência SLA</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-400 font-mono">{taxaAderenciaSla}%</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500/60" />
            </div>
          </div>

          {/* Concluídas */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Concluídas</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-400 font-mono">{kpis?.acoesConcluidas || 0}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500/60" />
            </div>
          </div>

          {/* Tempo Médio */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Tempo Médio</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-200 font-mono">{kpis?.tempoMedioResolucaoDias || 0}d</span>
              <Calendar className="w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Taxa Efetividade */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Efetividade</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400 font-mono">{kpis?.taxaEfetividade || 0}%</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          {/* Faturamento Recuperado */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Recuperado</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-bold text-emerald-300 font-mono truncate" title={formatCurrency(kpis?.faturamentoRecuperadoTotal)}>
                {formatCurrency(kpis?.faturamentoRecuperadoTotal)}
              </span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("ACOES")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === "ACOES"
                  ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              Monitoramento Operacional
            </button>
            <button
              onClick={() => setActiveTab("FUNIL")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === "FUNIL"
                  ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              Funil Comercial
            </button>
            <button
              onClick={() => setActiveTab("RANKINGS")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === "RANKINGS"
                  ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              Rankings & Canais
            </button>
          </div>
        </div>

        {/* Tab 1: Monitoramento Operacional */}
        {activeTab === "ACOES" && (
          <section className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente ou rede..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Gerente */}
              <select
                value={filterManager}
                onChange={(e) => {
                  setFilterManager(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todos os Gerentes</option>
                {managerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Status */}
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todos os Status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="CONCLUIDA">Concluída</option>
                <option value="NAO_EFETIVA">Não Efetiva</option>
                <option value="CANCELADA">Cancelada</option>
              </select>

              {/* SLA */}
              <select
                value={filterSla}
                onChange={(e) => setFilterSla(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todos os Prazos (SLA)</option>
                <option value="ATRASADA">Atrasada</option>
                <option value="VENCENDO">Vencendo Hoje</option>
                <option value="NO_PRAZO">No Prazo</option>
                <option value="CONCLUIDA_NO_PRAZO">Concluída no Prazo</option>
                <option value="CONCLUIDA_FORA_PRAZO">Concluída Fora do Prazo</option>
              </select>

              {/* Origem */}
              <select
                value={filterOrigem}
                onChange={(e) => {
                  setFilterOrigem(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas as Origens</option>
                <option value="COCKPIT_PRESCRITIVO">Cockpit Prescritivo</option>
                <option value="RANKING_PERFORMANCE">Ranking Performance</option>
                <option value="ALERTA_QUEDA">Alerta de Queda</option>
                <option value="RPS_COMPROMISSO">RPS Compromisso</option>
                <option value="MANUAL">Manual</option>
              </select>

              {/* Prioridade */}
              <select
                value={filterPrioridade}
                onChange={(e) => {
                  setFilterPrioridade(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas as Prioridades</option>
                <option value="CRITICA">Crítica</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </div>

            {/* Actions Grid / Table */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3.5">Cliente / Rede</th>
                      <th className="px-4 py-3.5">Gerente</th>
                      <th className="px-4 py-3.5">Tipo & Origem</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">SLA / Prazo</th>
                      <th className="px-4 py-3.5 text-right">Receita em Risco</th>
                      <th className="px-4 py-3.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                          Carregando ações de execução comercial...
                        </td>
                      </tr>
                    ) : filteredActions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          Nenhuma ação comercial encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredActions.map((action) => {
                        const statusObj = STATUS_CONFIG[action.status] || STATUS_CONFIG.PENDENTE;
                        const StatusIconComponent = statusObj.icon;
                        const isAtrasada = ["PENDENTE", "EM_ANDAMENTO"].includes(action.status) && action.prazo < todayStr;
                        const isVencendo = ["PENDENTE", "EM_ANDAMENTO"].includes(action.status) && action.prazo === todayStr;

                        return (
                          <tr
                            key={action.id}
                            className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                            onClick={() => setSelectedActionId(action.id)}
                          >
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-slate-200 line-clamp-1 group-hover:text-amber-400 transition-colors">
                                {action.cliente_nome}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Building2 className="w-3 h-3 text-slate-500" />
                                {action.rede || "Sem Rede"}
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3 h-3 text-slate-500" />
                                {action.manager_name || "—"}
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="text-slate-200 font-medium">{TIPO_LABELS[action.tipo_acao] || action.tipo_acao}</div>
                              <div className="text-[11px] text-slate-400">{ORIGEM_LABELS[action.origem] || action.origem}</div>
                            </td>

                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium border text-[11px] ${statusObj.className}`}>
                                <StatusIconComponent className="w-3 h-3" />
                                {statusObj.label}
                              </span>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1 font-mono text-slate-300">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {new Date(action.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                              </div>
                              {isAtrasada && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-400 mt-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> ATRASADA
                                </span>
                              )}
                              {isVencendo && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" /> VENCE HOJE
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-right font-mono font-semibold text-amber-400">
                              {formatCurrency(action.gap_original_reais)}
                            </td>

                            <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedActionId(action.id)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-400 hover:text-slate-950 font-medium text-slate-300 transition-colors text-[11px] inline-flex items-center gap-1"
                              >
                                Diagnóstico 360°
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
                <span>
                  Mostrando {filteredActions.length} de {totalItems} ações
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Funil Comercial de Conversão */}
        {activeTab === "FUNIL" && (
          <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                Funil de Conversão Comercial — Oportunidade até Resultado Financeiro
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Rastreamento ponta a ponta: do mapeamento de oportunidades prescritivas à recuperação efetiva de vendas
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {/* Etapa 1 */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 relative overflow-hidden">
                <div className="text-[11px] font-bold text-slate-400 uppercase">1. Oportunidades</div>
                <div className="text-2xl font-bold text-slate-100 font-mono mt-2">{totalOportunidades || "—"}</div>
                <p className="text-[11px] text-slate-400 mt-1">Mapeadas no CRM Prescritivo</p>
              </div>

              {/* Etapa 2 */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 relative overflow-hidden">
                <div className="text-[11px] font-bold text-blue-400 uppercase">2. Ações Criadas</div>
                <div className="text-2xl font-bold text-blue-400 font-mono mt-2">{totalAcoes}</div>
                <p className="text-[11px] text-slate-400 mt-1">Transformadas em Follow-Up</p>
              </div>

              {/* Etapa 3 */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 relative overflow-hidden">
                <div className="text-[11px] font-bold text-amber-400 uppercase">3. Em Andamento</div>
                <div className="text-2xl font-bold text-amber-400 font-mono mt-2">{kpis?.acoesAbertas || 0}</div>
                <p className="text-[11px] text-slate-400 mt-1">Em execução pela equipe</p>
              </div>

              {/* Etapa 4 */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 relative overflow-hidden">
                <div className="text-[11px] font-bold text-emerald-400 uppercase">4. Concluídas</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-2">{kpis?.acoesConcluidas || 0}</div>
                <p className="text-[11px] text-slate-400 mt-1">Finalizadas com desfecho</p>
              </div>

              {/* Etapa 5 */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 relative overflow-hidden">
                <div className="text-[11px] font-bold text-emerald-300 uppercase">5. Efetivas c/ Venda</div>
                <div className="text-2xl font-bold text-emerald-300 font-mono mt-2">{kpis?.clientesRecuperadosCount || 0}</div>
                <p className="text-[11px] text-emerald-400 font-medium mt-1">
                  {formatCurrency(kpis?.faturamentoRecuperadoTotal)} recuperados
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Tab 3: Rankings & Origens */}
        {activeTab === "RANKINGS" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking de Efetividade por Gerente */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Efetividade Comercial por Gerente
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Fonte: AnalyticsEngine</span>
              </div>

              {(!kpis?.rankingGerentesEfetividade || kpis.rankingGerentesEfetividade.length === 0) ? (
                <p className="text-xs text-slate-500 text-center py-6">Nenhum dado de recuperação disponível.</p>
              ) : (
                <div className="space-y-2.5">
                  {kpis.rankingGerentesEfetividade.map((mgr, idx) => (
                    <div
                      key={mgr.managerName || idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-300">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-200">{mgr.managerName}</div>
                          <div className="text-[11px] text-slate-400">
                            {mgr.recuperadosCount} de {mgr.elegiveisCount} recuperados ({mgr.taxaEfetividade}%)
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(mgr.faturamentoRecuperado)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Efetividade por Origem Comercial */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Desempenho por Origem Comercial
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Conversão de Canal</span>
              </div>

              {(!kpis?.efetividadePorOrigem || kpis.efetividadePorOrigem.length === 0) ? (
                <p className="text-xs text-slate-500 text-center py-6">Nenhum dado de canal disponível.</p>
              ) : (
                <div className="space-y-2.5">
                  {kpis.efetividadePorOrigem.map((orig, idx) => (
                    <div
                      key={orig.origem || idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{ORIGEM_LABELS[orig.origem] || orig.origem}</div>
                        <div className="text-[11px] text-slate-400">
                          {orig.recuperadosCount} de {orig.elegiveisCount} ações convertidas ({orig.taxaEfetividade}%)
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(orig.faturamentoRecuperado)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Execution Control Drawer 360 */}
      <ExecutionControlDrawer
        actionId={selectedActionId}
        onClose={() => setSelectedActionId(null)}
        onActionUpdated={() => {
          fetchData();
          setToastMessage("Ação comercial atualizada com sucesso!");
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* New Follow-Up Action Modal */}
      <NewFollowUpModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreated={() => {
          setIsNewModalOpen(false);
          fetchData();
          setToastMessage("Nova ação de Follow-up registrada com sucesso!");
          setTimeout(() => setToastMessage(null), 4000);
        }}
        initialContext={initialContext}
      />
    </div>
  );
}
