"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  AlertTriangle,
  TrendingDown,
  Rocket,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Send,
  ShieldCheck,
  DollarSign,
  ArrowRight,
  Building2,
  User,
  MapPin,
  Package,
  Calendar,
  Home,
  BarChart3,
  History,
  Users,
  Target,
  TrendingUp,
  Upload,
  ChevronRight,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { ActionCenterDrawer } from "@/components/inovacoes/action-center/ActionCenterDrawer";
import { NewFollowUpModal, FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface OpportunityItem {
  id: string;
  clienteId: string;
  nomeParceiro: string;
  cnpj?: string;
  rede?: string | null;
  gerenteNome: string;
  canal: string;
  uf: string;
  diasSemCompra: number;
  frequenciaHistoricaDias: number;
  dataUltimaCompra?: string | null;
  faturamentoUltimaCompra?: number;
  faturamentoMedioMensal: number;
  faturamentoAcumulado12M: number;
  tendenciaConsumo?: string;
  scoreOportunidade: number;
  classificacaoRisco: "CRITICO" | "ALTO" | "MEDIO" | "BAIXO";
  faturamentoPerdidoEstimado: number;
  prioridadeCarteira: "CURVA_A" | "CURVA_B" | "CURVA_C";
  justificativaRecomendacao: string;
  impactoFinanceiroTotal: number;
  skusSugeridos?: any[];
  tipoRecomendacao?: string;
}

interface ResumoExecutivo {
  totalReceitaRepresada: number;
  clientesAtrasoCritico: number;
  clientesEmRisco: number;
  ticketMedioReposicao: number;
  totalOportunidades: number;
}

export default function ActionCenterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [resumo, setResumo] = useState<ResumoExecutivo | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedManager, setSelectedManager] = useState("ALL");
  const [selectedRisk, setSelectedRisk] = useState("ALL");
  const [selectedTipoAcao, setSelectedTipoAcao] = useState("ALL");
  const [sortBy, setSortBy] = useState<"score" | "impacto" | "atraso">("score");

  // Estados do Drawer & Follow-Up
  const [selectedOpportunity, setSelectedOpportunity] = useState<any | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpInitialContext, setFollowUpInitialContext] = useState<FollowUpInitialContext | null>(null);
  const [followUpToast, setFollowUpToast] = useState<string | null>(null);

  // Carregamento de dados a partir da API oficial do CRM
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (selectedManager !== "ALL") params.set("manager", selectedManager);
      if (selectedRisk !== "ALL") params.set("risk", selectedRisk);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/inovacoes/crm?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro ${res.status} ao carregar oportunidades.`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao processar oportunidades comerciais.");
      }

      if (json.oportunidades) {
        setOpportunities(json.oportunidades);
        setResumo(json.resumoExecutivo || null);
      }
    } catch (err: any) {
      console.error("Erro no Sales Action Center:", err);
      setError(err.message || "Erro de conexão ao carregar oportunidades.");
    } finally {
      setLoading(false);
    }
  }, [selectedManager, selectedRisk, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lista única de gerentes para o filtro
  const managersList = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((op) => {
      if (op.gerenteNome) set.add(op.gerenteNome);
    });
    return Array.from(set).sort();
  }, [opportunities]);

  // Filtragem e ordenação local das oportunidades
  const filteredOpportunities = useMemo(() => {
    return opportunities
      .filter((op) => {
        if (selectedTipoAcao !== "ALL") {
          const tipo = op.classificacaoRisco === "CRITICO" ? "REATIVACAO_CLIENTE" : "EXPANSAO_MIX";
          if (tipo !== selectedTipoAcao) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score") {
          return (b.scoreOportunidade || 0) - (a.scoreOportunidade || 0);
        }
        if (sortBy === "impacto") {
          return (b.faturamentoPerdidoEstimado || 0) - (a.faturamentoPerdidoEstimado || 0);
        }
        if (sortBy === "atraso") {
          return (b.diasSemCompra || 0) - (a.diasSemCompra || 0);
        }
        return 0;
      });
  }, [opportunities, selectedTipoAcao, sortBy]);

  // Score global médio
  const scoreGlobalMedio = useMemo(() => {
    if (opportunities.length === 0) return 85;
    const soma = opportunities.reduce((acc, op) => acc + (op.scoreOportunidade || 0), 0);
    return Math.round(soma / opportunities.length);
  }, [opportunities]);

  const handleOpenDrawer = (op: OpportunityItem) => {
    setSelectedOpportunity({
      id: op.clienteId,
      tipoAcao: op.classificacaoRisco === "CRITICO" ? "REATIVACAO_CLIENTE" : "EXPANSAO_MIX",
      clienteId: op.clienteId,
      codParceiro: op.clienteId,
      clienteNome: op.nomeParceiro,
      cnpj: op.cnpj,
      redeNome: op.rede,
      codigoMatriz: op.rede,
      gerenteNome: op.gerenteNome,
      canal: op.canal,
      uf: op.uf,
      score: op.scoreOportunidade,
      prioridade: op.classificacaoRisco === "CRITICO" ? "ALTA" : op.classificacaoRisco === "ALTO" ? "MEDIA" : "BAIXA",
      classificacaoRisco: op.classificacaoRisco,
      justificativa: op.justificativaRecomendacao,
      faturamentoReal: op.faturamentoMedioMensal,
      faturamentoPerdido: op.faturamentoPerdidoEstimado,
      diasSemComprar: op.diasSemCompra,
      frequenciaHistoricaDias: op.frequenciaHistoricaDias,
      skusVendidos: undefined,
      totalPortfolio: 28,
      pctPenetracao: 45,
      skusSugeridos: op.skusSugeridos || [],
      dataStr: "2026-08",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-20">
      {/* HEADER PRINCIPAL */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Sparkles className="w-5 h-5 text-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-foreground">
                  Sales Action Center 360°
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold border border-gold/30 uppercase">
                  Wave B.22
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Motor Executivo de Oportunidades Comerciais, Priorização de Carteira e Execução com SLA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Atualizar Oportunidades"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        {/* RESUMO EXECUTIVO — KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Oportunidades
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">
                {resumo?.totalOportunidades ?? opportunities.length}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">ativas</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Receita em Risco
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">
                {formatCurrency(resumo?.totalReceitaRepresada || 0, 0)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Atraso Crítico
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">
                {resumo?.clientesAtrasoCritico || 0}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">clientes</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Ticket Médio Reposição
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                {formatCurrency(resumo?.ticketMedioReposicao || 0, 0)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1 col-span-2 lg:col-span-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Score Global Carteira
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-gold">
                {scoreGlobalMedio}/100
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">Saudável</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS & PESQUISA */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente, rede, CNPJ, UF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filtro Gerente */}
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">Todos os Gerentes</option>
              {managersList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Filtro Risco */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">Todos os Riscos</option>
              <option value="CRITICO">Crítico</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Médio</option>
              <option value="BAIXO">Baixo</option>
            </select>

            {/* Ordenação */}
            <div className="flex items-center bg-background p-1 rounded-xl border border-border gap-1">
              <button
                type="button"
                onClick={() => setSortBy("score")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sortBy === "score" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Score
              </button>
              <button
                type="button"
                onClick={() => setSortBy("impacto")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sortBy === "impacto" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Impacto
              </button>
              <button
                type="button"
                onClick={() => setSortBy("atraso")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sortBy === "atraso" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Atraso
              </button>
            </div>
          </div>
        </div>

        {/* GRID DE OPORTUNIDADES */}
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground rounded-2xl bg-card border border-border">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gold" />
            Processando inteligência e ranking de oportunidades comerciais...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-400 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            {error}
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground rounded-2xl bg-card border border-border">
            Nenhuma oportunidade encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpportunities.map((op) => {
              const isCritico = op.classificacaoRisco === "CRITICO";
              const isAlto = op.classificacaoRisco === "ALTO";

              return (
                <div
                  key={op.id || op.clienteId}
                  className="bg-card border border-border hover:border-gold/50 transition-all rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                            op.scoreOportunidade >= 80
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : op.scoreOportunidade >= 60
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          Score: {op.scoreOportunidade}/100
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase">
                          {op.prioridadeCarteira || "CURVA_A"}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          isCritico
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : isAlto
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {op.classificacaoRisco}
                      </span>
                    </div>

                    {/* Nome e Metadados */}
                    <div>
                      <h3
                        className="text-sm font-black text-foreground truncate group-hover:text-gold transition-colors"
                        title={op.nomeParceiro}
                      >
                        {op.nomeParceiro}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        {op.rede && (
                          <span className="inline-flex items-center gap-0.5 truncate max-w-[120px]">
                            <Building2 className="w-3 h-3" /> {op.rede}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5">
                          <User className="w-3 h-3" /> {op.gerenteNome}
                        </span>
                        {op.uf && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> {op.uf}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Justificativa */}
                    <p className="text-xs text-foreground/80 line-clamp-2 bg-background/50 p-2.5 rounded-xl border border-border/60">
                      {op.justificativaRecomendacao}
                    </p>

                    {/* Métricas Principais */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="p-2 rounded-xl bg-background border border-border">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Dias sem Compra
                        </span>
                        <span className="font-bold text-rose-400">{op.diasSemCompra} dias</span>
                      </div>
                      <div className="p-2 rounded-xl bg-background border border-border">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Impacto Estimado
                        </span>
                        <span className="font-bold text-emerald-400">
                          {formatCurrency(op.faturamentoPerdidoEstimado, 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Ação 360° */}
                  <button
                    type="button"
                    onClick={() => handleOpenDrawer(op)}
                    className="w-full py-2 px-3 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-gold" />
                    <span>Diagnóstico 360° & Follow-up</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gold" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* BOTTOM TAB BAR CANÔNICA */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Rede</Link>
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Rede</Link>
        <Link href="/historico-por-matriz" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Rede</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/inovacoes/action-center" className="bottom-tab active"><Sparkles className="bottom-tab-icon" /> Ações</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>

      {/* ── Drawer Sales Action Center 360° (Wave B.22) ── */}
      {selectedOpportunity && (
        <ActionCenterDrawer
          isOpen={Boolean(selectedOpportunity)}
          onClose={() => setSelectedOpportunity(null)}
          opportunity={selectedOpportunity}
          onOpenFollowUp={(ctx) => {
            setFollowUpInitialContext(ctx);
            setIsFollowUpModalOpen(true);
          }}
        />
      )}

      {/* ── Modal Canônica de Criação de Follow-up (Wave B.12) ── */}
      {isFollowUpModalOpen && (
        <NewFollowUpModal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          onCreated={() => {
            setIsFollowUpModalOpen(false);
            setFollowUpToast("Ação prescritiva de Follow-up registrada com sucesso com SLA!");
            setTimeout(() => setFollowUpToast(null), 4000);
          }}
          initialContext={followUpInitialContext}
        />
      )}

      {/* ── Toast Feedback ── */}
      {followUpToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-500/90 text-white font-bold text-xs shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
          {followUpToast}
        </div>
      )}
    </div>
  );
}
