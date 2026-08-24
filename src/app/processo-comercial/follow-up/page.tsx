"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardList,
  ArrowLeft,
  Plus,
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
  User,
  Tag,
  Building2,
  ShieldCheck,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { CommercialDomainService } from "@/lib/domain";
import { FollowUpDrawer } from "./components/FollowUpDrawer";
import { NewFollowUpModal, FollowUpInitialContext } from "./components/NewFollowUpModal";
import type {
  FollowUpActionRecord,
  FollowUpKpis,
  FollowUpStatus,
  FollowUpOrigem,
  FollowUpPrioridade,
} from "@/lib/services/follow-up-service";

/* ───────────────── Visual Configuration Mappings ───────────────── */

const STATUS_BADGE: Record<FollowUpStatus, { label: string; className: string }> = {
  PENDENTE: { label: "Pendente", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  EM_ANDAMENTO: { label: "Em Andamento", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  CONCLUIDA: { label: "Concluída", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  NAO_EFETIVA: { label: "Não Efetiva", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  CANCELADA: { label: "Cancelada", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const PRIORIDADE_BADGE: Record<FollowUpPrioridade, { label: string; className: string }> = {
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
  EXPANSAO_MIX: "Mix",
  RECUPERACAO_VOLUME: "Volume",
  NEGOCIACAO_REDE: "Rede",
  VISITA_COMERCIAL: "Visita",
  ENVIO_PROPOSTA: "Proposta",
  OUTRO: "Outro",
};

export default function FollowUpPage() {
  // ── Filters State ──
  const [filterManager, setFilterManager] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [filterPrioridade, setFilterPrioridade] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ── Data State ──
  const [actions, setActions] = useState<FollowUpActionRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kpis, setKpis] = useState<FollowUpKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Manager Options from CommercialDomainService SSOT ──
  const [managerOptions, setManagerOptions] = useState<{ value: string; label: string }[]>([]);

  // ── Modals & Drawers State ──
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [initialContext, setInitialContext] = useState<FollowUpInitialContext | null>(null);

  // Load manager options from SSOT and detect query params
  useEffect(() => {
    const opts = CommercialDomainService.getManagerOptions();
    setManagerOptions(opts);

    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const searchCli = sp.get("searchCliente") || sp.get("q");
      const origemParam = sp.get("origem") as FollowUpOrigem | null;
      const autoNew = sp.get("new") === "true";

      if (searchCli) setSearchQuery(searchCli);
      if (origemParam) setFilterOrigem(origemParam);

      if (autoNew || (searchCli && origemParam)) {
        setInitialContext({
          clienteNome: searchCli || undefined,
          origem: origemParam || undefined,
        });
        setIsNewModalOpen(true);
      }
    }
  }, []);

  // Fetch list and KPIs from backend APIs
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
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const [resList, resKpis] = await Promise.all([
        fetch(`/api/follow-up?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/follow-up/kpis?${params.toString()}`, { cache: "no-store" }),
      ]);

      const jsonList = await resList.json();
      const jsonKpis = await resKpis.json();

      if (jsonList.success) {
        setActions(jsonList.data || []);
        setTotalItems(jsonList.meta?.total || 0);
        setTotalPages(jsonList.meta?.totalPages || 1);
      } else {
        setError(jsonList.error || "Erro ao carregar lista de follow-ups.");
      }

      if (jsonKpis.success && jsonKpis.data) {
        setKpis(jsonKpis.data);
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados do follow-up:", err);
      setError("Falha de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filterManager, filterStatus, filterOrigem, filterPrioridade, searchQuery, dataInicio, dataFim, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilters = () => {
    setFilterManager("all");
    setFilterStatus("all");
    setFilterOrigem("all");
    setFilterPrioridade("all");
    setSearchQuery("");
    setDataInicio("");
    setDataFim("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      
      {/* ═══ HEADER ═══ */}
      <header className="border-b border-border/80 bg-background/95 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            <h1 className="text-lg font-black tracking-tight text-foreground">Follow-up Comercial</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Ação
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 p-6 space-y-6 max-w-[1600px] w-full mx-auto">
        
        {/* ═══ KPI CARDS (Operacionais + Efetividade) ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Card 1: Abertas */}
          <div className="glass-card p-3.5 space-y-1.5 border border-border/60 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Ações Abertas</span>
              <Clock className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-black text-foreground">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : (kpis?.acoesAbertas ?? 0)}
            </div>
            <div className="text-[10px] text-muted">Pendentes + Em Andamento</div>
          </div>

          {/* Card 2: Concluídas */}
          <div className="glass-card p-3.5 space-y-1.5 border border-border/60 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Concluídas</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : (kpis?.acoesConcluidas ?? 0)}
            </div>
            <div className="text-[10px] text-muted">Ações finalizadas</div>
          </div>

          {/* Card 3: Atrasadas */}
          <div className="glass-card p-3.5 space-y-1.5 border border-border/60 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Atrasadas</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : (kpis?.acoesAtrasadas ?? 0)}
            </div>
            <div className="text-[10px] text-muted">Prazo vencido</div>
          </div>

          {/* Card 4: Taxa Conclusão */}
          <div className="glass-card p-3.5 space-y-1.5 border border-border/60 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Taxa Conclusão</span>
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : `${kpis?.taxaConclusao ?? 0}%`}
            </div>
            <div className="text-[10px] text-muted">Média: {kpis?.tempoMedioResolucaoDias ?? 0}d</div>
          </div>

          {/* Card 5: Clientes Recuperados (Oficial) */}
          <div className="glass-card p-3.5 space-y-1.5 border border-emerald-500/30 rounded-xl bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Recuperados</span>
              <User className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : (kpis?.clientesRecuperadosCount ?? 0)}
            </div>
            <div className="text-[10px] text-muted">de {kpis?.totalElegiveisCount ?? 0} elegíveis (&gt;90d)</div>
          </div>

          {/* Card 6: Taxa Efetividade (%) */}
          <div className="glass-card p-3.5 space-y-1.5 border border-amber-500/30 rounded-xl bg-amber-500/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Efetividade %</span>
              <Tag className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : `${kpis?.taxaEfetividade ?? 0}%`}
            </div>
            <div className="text-[10px] text-muted">Recuperados / Elegíveis</div>
          </div>

          {/* Card 7: Faturamento Recuperado (Oficial) */}
          <div className="glass-card p-3.5 space-y-1.5 border border-emerald-500/40 rounded-xl bg-emerald-500/10 col-span-2 md:col-span-3 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Fat. Recuperado</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-emerald-400 truncate">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(kpis?.faturamentoRecuperadoTotal ?? 0)}
            </div>
            <div className="text-[10px] text-muted">Fonte: NFe (janela 30d pós)</div>
          </div>
        </div>


        {/* ═══ FILTER BAR ═══ */}
        <div className="glass-card p-4 space-y-3 border border-border/60 rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Filter className="w-4 h-4 text-amber-500" />
              Filtros Operacionais
            </div>

            <button
              onClick={handleResetFilters}
              className="text-xs text-muted hover:text-foreground font-semibold transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Gerente Dropdown (via CommercialDomainService SSOT) */}
            <div>
              <label className="text-[10px] font-bold text-muted uppercase mb-1 block">Gerente</label>
              <select
                value={filterManager}
                onChange={(e) => { setFilterManager(e.target.value); setPage(1); }}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todos os Gerentes</option>
                {managerOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div>
              <label className="text-[10px] font-bold text-muted uppercase mb-1 block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todos os Status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="CONCLUIDA">Concluída</option>
                <option value="NAO_EFETIVA">Não Efetiva</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            {/* Origem Dropdown */}
            <div>
              <label className="text-[10px] font-bold text-muted uppercase mb-1 block">Origem</label>
              <select
                value={filterOrigem}
                onChange={(e) => { setFilterOrigem(e.target.value); setPage(1); }}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas as Origens</option>
                <option value="COCKPIT_PRESCRITIVO">Cockpit Prescritivo</option>
                <option value="RANKING_PERFORMANCE">Ranking Performance</option>
                <option value="ALERTA_QUEDA">Alerta de Queda</option>
                <option value="RPS_COMPROMISSO">RPS Compromisso</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>

            {/* Prioridade Dropdown */}
            <div>
              <label className="text-[10px] font-bold text-muted uppercase mb-1 block">Prioridade</label>
              <select
                value={filterPrioridade}
                onChange={(e) => { setFilterPrioridade(e.target.value); setPage(1); }}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas as Prioridades</option>
                <option value="CRITICA">Crítica</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </div>

            {/* Busca por cliente */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-muted uppercase mb-1 block">Busca Cliente / Rede</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Nome do cliente ou rede..."
                  className="w-full pl-8 pr-3 py-1.5 bg-muted/10 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ GRID DE FOLLOW-UPS ═══ */}
        {error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-rose-400">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-bold rounded-lg border border-rose-500/30 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : loading ? (
          <div className="glass-card border border-border/60 rounded-xl p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <div className="text-xs font-bold text-muted uppercase tracking-widest animate-pulse">
              Carregando ações de follow-up...
            </div>
          </div>
        ) : actions.length === 0 ? (
          <div className="glass-card border border-border/60 rounded-xl p-12 text-center space-y-3">
            <ClipboardList className="w-12 h-12 text-muted/40 mx-auto" />
            <h3 className="text-base font-bold text-foreground">Nenhuma ação de follow-up encontrada</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Não existem registros correspondentes aos filtros selecionados. Tente ajustar os filtros ou registrar uma nova ação.
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 mt-2"
            >
              <Plus className="w-4 h-4" />
              Nova Ação
            </button>
          </div>
        ) : (
          <div className="glass-card border border-border/60 rounded-xl overflow-hidden shadow-lg">
            {/* Desktop Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/10 border-b border-border text-muted font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Prioridade</th>
                    <th className="px-4 py-3">Cliente / Rede</th>
                    <th className="px-4 py-3">Gerente</th>
                    <th className="px-4 py-3">Tipo de Ação</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Prazo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {actions.map((act) => {
                    const statusCfg = STATUS_BADGE[act.status];
                    const prioCfg = PRIORIDADE_BADGE[act.prioridade] || PRIORIDADE_BADGE.MEDIA;

                    return (
                      <tr
                        key={act.id}
                        onClick={() => setSelectedActionId(act.id)}
                        className="hover:bg-muted/5 transition-colors cursor-pointer"
                      >
                        {/* Prioridade */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${prioCfg.className}`}>
                            {prioCfg.label}
                          </span>
                        </td>

                        {/* Cliente / Rede */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{act.cliente_nome}</div>
                          {act.rede && <div className="text-[10px] text-muted">{act.rede}</div>}
                        </td>

                        {/* Gerente */}
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {act.manager_name}
                        </td>

                        {/* Tipo de Ação */}
                        <td className="px-4 py-3 text-muted">
                          {TIPO_LABELS[act.tipo_acao] || act.tipo_acao}
                        </td>

                        {/* Origem */}
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-medium text-muted bg-muted/10 px-2 py-0.5 rounded border border-border/40">
                            {ORIGEM_LABELS[act.origem] || act.origem}
                          </span>
                        </td>

                        {/* Prazo */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">
                            {new Date(act.prazo).toLocaleDateString("pt-BR")}
                          </div>
                          {act.is_atrasada && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-400 uppercase">
                              <Clock className="w-2.5 h-2.5" /> Atrasada
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.className}`}>
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Botão Detalhes */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedActionId(act.id);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded border border-amber-500/20 transition-colors"
                          >
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-muted/10 border-t border-border px-6 py-3 flex items-center justify-between text-xs">
              <div className="text-muted">
                Exibindo página <strong className="text-foreground">{page}</strong> de <strong className="text-foreground">{totalPages}</strong> ({totalItems} ações)
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-muted/20 hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed rounded border border-border text-foreground font-semibold transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-muted/20 hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed rounded border border-border text-foreground font-semibold transition-colors flex items-center gap-1"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══ FOOTER GOVERNANÇA ═══ */}
      <footer className="border-t border-border/40 py-3 px-6 text-center text-[10px] text-muted/60">
        <ShieldCheck className="w-3 h-3 inline mr-1 text-emerald-500" />
        Follow-up Comercial Inteligente — Commercial Domain SSOT & Analytics Engine V1
      </footer>

      {/* ═══ DRAWER & MODAL ═══ */}
      {selectedActionId && (
        <FollowUpDrawer
          actionId={selectedActionId}
          onClose={() => setSelectedActionId(null)}
          onActionUpdated={fetchData}
        />
      )}

      <NewFollowUpModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setInitialContext(null);
        }}
        onCreated={() => {
          setIsNewModalOpen(false);
          setInitialContext(null);
          fetchData();
        }}
        initialContext={initialContext}
      />
    </div>
  );
}
