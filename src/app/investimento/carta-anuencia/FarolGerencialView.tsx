"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  FilePlus,
  RotateCcw,
  Sparkles,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import {
  obterDadosFarolGerencial,
  FarolGerencialResumo,
  FarolGerencialRegionalItem,
  FarolGerencialRedeItem,
  CartaAnuenciaItem,
} from "./actions";
import { formatarDataValidade } from "./validade-helper";

interface FarolGerencialViewProps {
  onEmitirCarta: (redeCode: string, competencia?: string) => void;
  onPreviewCarta: (carta: CartaAnuenciaItem) => void;
  competenciaDefault?: string;
}

export function FarolGerencialView({
  onEmitirCarta,
  onPreviewCarta,
  competenciaDefault,
}: FarolGerencialViewProps) {
  const [resumo, setResumo] = useState<FarolGerencialResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>(competenciaDefault || "Junho/2026");
  const [filterRegional, setFilterRegional] = useState<string>("TODAS");
  const [filterGerente, setFilterGerente] = useState<string>("TODOS");
  const [filterUf, setFilterUf] = useState<string>("TODAS");
  const [filterStatusCarta, setFilterStatusCarta] = useState<string>("TODOS");
  const [search, setSearch] = useState<string>("");

  // Expansão de regionais (todas abertas por padrão para visibilidade rápida)
  const [expandedRegionais, setExpandedRegionais] = useState<Record<string, boolean>>({});

  const carregarDados = async (comp?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await obterDadosFarolGerencial({
        competencia: comp || competenciaSelecionada,
      });
      setResumo(data);
      if (data.competencia && data.competencia !== competenciaSelecionada) {
        setCompetenciaSelecionada(data.competencia);
      }
      // Inicializar todas expandidas
      const expandMap: Record<string, boolean> = {};
      data.regionais.forEach((r) => {
        expandMap[r.id] = true;
      });
      setExpandedRegionais(expandMap);
    } catch (err: any) {
      console.error("Erro ao carregar Farol Gerencial:", err);
      setError(err.message || "Erro ao carregar dados do Farol Executivo Gerencial.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados(competenciaSelecionada);
  }, [competenciaSelecionada]);

  const toggleExpand = (regionalId: string) => {
    setExpandedRegionais((prev) => ({
      ...prev,
      [regionalId]: !prev[regionalId],
    }));
  };

  const expandAll = () => {
    if (!resumo) return;
    const expandMap: Record<string, boolean> = {};
    resumo.regionais.forEach((r) => {
      expandMap[r.id] = true;
    });
    setExpandedRegionais(expandMap);
  };

  const collapseAll = () => {
    setExpandedRegionais({});
  };

  const limparFiltros = () => {
    setFilterRegional("TODAS");
    setFilterGerente("TODOS");
    setFilterUf("TODAS");
    setFilterStatusCarta("TODOS");
    setSearch("");
  };

  // Lista de UFs disponíveis
  const ufsDisponiveis = useMemo(() => {
    if (!resumo) return [];
    const setUfs = new Set<string>();
    resumo.regionais.forEach((r) => {
      r.redes.forEach((rede) => {
        if (rede.uf) setUfs.add(rede.uf.toUpperCase());
      });
    });
    return Array.from(setUfs).sort();
  }, [resumo]);

  // Filtragem e recalculo local de visibilidade
  const regionaisFiltradas = useMemo(() => {
    if (!resumo) return [];

    return resumo.regionais
      .filter((reg) => {
        if (filterRegional !== "TODAS" && reg.regional !== filterRegional) return false;
        if (filterGerente !== "TODOS" && reg.gerente !== filterGerente) return false;
        return true;
      })
      .map((reg) => {
        const redesFiltradas = reg.redes.filter((r) => {
          if (filterUf !== "TODAS" && (r.uf || "").toUpperCase() !== filterUf.toUpperCase()) {
            return false;
          }
          if (filterStatusCarta === "COM_CARTA" && !r.possui_carta) return false;
          if (filterStatusCarta === "SEM_CARTA" && r.possui_carta) return false;
          if (filterStatusCarta === "ASSINADA" && r.carta?.status !== "ASSINADA") return false;
          if (filterStatusCarta === "EMITIDA" && r.carta?.status !== "EMITIDA") return false;

          if (search) {
            const s = search.toLowerCase().trim();
            const matchNome = r.rede.toLowerCase().includes(s);
            const matchCod = r.codigo_matriz.toLowerCase().includes(s);
            const matchCarta = r.carta?.numero_carta.toLowerCase().includes(s);
            const matchGerente = r.manager.toLowerCase().includes(s);
            if (!matchNome && !matchCod && !matchCarta && !matchGerente) return false;
          }
          return true;
        });

        return {
          ...reg,
          redesFiltradas,
        };
      })
      .filter((reg) => {
        // Se houver filtro de busca ou status, ocultar regionais sem redes correspondentes
        if (search || filterUf !== "TODAS" || filterStatusCarta !== "TODOS") {
          return reg.redesFiltradas.length > 0;
        }
        return true;
      });
  }, [resumo, filterRegional, filterGerente, filterUf, filterStatusCarta, search]);

  // Helpers de Badge de Status Farol
  const getBadgeFarol = (status: "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO", pct: number) => {
    switch (status) {
      case "VERDE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {pct >= 100 ? "Completa (100%)" : `Muito Alta (${pct}%)`}
          </span>
        );
      case "AMARELO":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Atenção ({pct}%)
          </span>
        );
      case "LARANJA":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Baixa ({pct}%)
          </span>
        );
      case "VERMELHO":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Crítico ({pct}%)
          </span>
        );
    }
  };

  const getBadgeStatusCarta = (carta: FarolGerencialRedeItem["carta"]) => {
    if (!carta) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
          <AlertCircle className="w-3 h-3" />
          🔴 SEM CARTA
        </span>
      );
    }

    if (carta.status === "ASSINADA") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          Assinada
        </span>
      );
    }

    if (carta.status === "ENVIADA") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
          <Clock className="w-3 h-3" />
          Enviada
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3" />
        Emitida
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Informativo Corporativo */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-primary/10 via-amber-500/5 to-purple-500/10 border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Farol Executivo Gerencial — Cobertura por Regional
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary/20 text-primary border border-primary/30">
                100% Auditado
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acompanhamento determinístico da cobertura documental das Redes Oficiais Planejáveis por Regional e Gerente de Contas
            </p>
          </div>
        </div>

        {/* Seletor de Competência */}
        <div className="flex items-center gap-2 self-end md:self-auto bg-card px-3 py-1.5 rounded-2xl border border-border shadow-sm">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
            Competência:
          </span>
          <select
            value={competenciaSelecionada}
            onChange={(e) => setCompetenciaSelecionada(e.target.value)}
            disabled={loading}
            className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
          >
            {resumo?.competencias_disponiveis.map((c) => (
              <option key={c.id} value={c.competencia} className="bg-popover text-popover-foreground">
                {c.competencia} {c.encerrada ? "(Encerrada)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Cards Consolidados no Topo */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-card border border-border animate-pulse p-4" />
          ))}
        </div>
      ) : resumo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Redes Esperadas */}
          <div
            onClick={() => setFilterStatusCarta("TODOS")}
            className={`p-5 rounded-2xl bg-card border transition-all cursor-pointer shadow-sm hover:shadow-md ${
              filterStatusCarta === "TODOS"
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Redes Esperadas
              </span>
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-foreground tracking-tight">
                {resumo.total_esperadas}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                Universo Oficial
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
              <span>View Oficial de Redes Planejáveis</span>
            </div>
          </div>

          {/* Card 2: No Sistema */}
          <div
            onClick={() => setFilterStatusCarta(filterStatusCarta === "COM_CARTA" ? "TODOS" : "COM_CARTA")}
            className={`p-5 rounded-2xl bg-card border transition-all cursor-pointer shadow-sm hover:shadow-md ${
              filterStatusCarta === "COM_CARTA"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5"
                : "border-border hover:border-emerald-500/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                No Sistema
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {resumo.total_no_sistema}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Cartas Ativas
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Clique para filtrar com carta</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Filtrar</span>
            </div>
          </div>

          {/* Card 3: Faltantes */}
          <div
            onClick={() => setFilterStatusCarta(filterStatusCarta === "SEM_CARTA" ? "TODOS" : "SEM_CARTA")}
            className={`p-5 rounded-2xl bg-card border transition-all cursor-pointer shadow-sm hover:shadow-md ${
              filterStatusCarta === "SEM_CARTA"
                ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5"
                : "border-border hover:border-rose-500/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Faltantes
              </span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {resumo.total_faltantes}
              </span>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                Sem Carta
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Clique para ver pendências</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">Filtrar</span>
            </div>
          </div>

          {/* Card 4: Cobertura Geral */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cobertura Geral
              </span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-foreground tracking-tight">
                {resumo.cobertura_geral_pct}%
              </span>
              {getBadgeFarol(resumo.status_farol_geral, resumo.cobertura_geral_pct)}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              <span>Meta Corporativa: 100% de quitação</span>
            </div>
          </div>

        </div>
      ) : null}

      {/* 3. Toolbar de Filtros Combinados em AND */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filtros do Farol Gerencial</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              Expandir Todas
            </button>
            <span className="text-border">|</span>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              Recolher Todas
            </button>
            <span className="text-border">|</span>
            <button
              onClick={limparFiltros}
              className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:opacity-80 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar Filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Busca Textual */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar rede, cód. ou carta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          {/* Filtro Regional */}
          <div>
            <select
              value={filterRegional}
              onChange={(e) => setFilterRegional(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer"
            >
              <option value="TODAS">Regional: Todas</option>
              <option value="Sul">Sul (Leandro Saffi)</option>
              <option value="Sudeste (SP)">Sudeste - SP (Julliano)</option>
              <option value="Sudeste / Nordeste">Sudeste / Nordeste (Luiz)</option>
              <option value="Centro-Oeste / Norte">Centro-Oeste / Norte (John Guedes)</option>
            </select>
          </div>

          {/* Filtro Gerente */}
          <div>
            <select
              value={filterGerente}
              onChange={(e) => setFilterGerente(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer"
            >
              <option value="TODOS">Gerente: Todos</option>
              <option value="Leandro Saffi">Leandro Saffi</option>
              <option value="Julliano">Julliano</option>
              <option value="Luiz">Luiz</option>
              <option value="John Guedes">John Guedes</option>
            </select>
          </div>

          {/* Filtro UF */}
          <div>
            <select
              value={filterUf}
              onChange={(e) => setFilterUf(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer"
            >
              <option value="TODAS">UF: Todas</option>
              {ufsDisponiveis.map((uf) => (
                <option key={uf} value={uf}>
                  UF: {uf}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Status da Carta */}
          <div>
            <select
              value={filterStatusCarta}
              onChange={(e) => setFilterStatusCarta(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer"
            >
              <option value="TODOS">Status: Todos</option>
              <option value="COM_CARTA">🟢 Com Carta (No Sistema)</option>
              <option value="SEM_CARTA">🔴 Sem Carta (Faltantes)</option>
              <option value="ASSINADA">Assinadas</option>
              <option value="EMITIDA">Emitidas / Em Andamento</option>
            </select>
          </div>

        </div>
      </div>

      {/* 4. Tabela Gerencial e Detalhamento por Regional */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border shadow-sm">
          <Building2 className="w-8 h-8 animate-pulse mx-auto mb-2 text-primary" />
          <span>Carregando Farol Executivo Gerencial...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-xs text-rose-600 dark:text-rose-400 bg-card rounded-2xl border border-rose-500/20 shadow-sm space-y-3">
          <ShieldAlert className="w-8 h-8 mx-auto text-rose-500" />
          <p className="font-bold text-sm">Erro ao carregar dados do Farol Gerencial</p>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => carregarDados()}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Tentar Novamente
          </button>
        </div>
      ) : regionaisFiltradas.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border shadow-sm space-y-2">
          <p>Nenhuma rede ou regional encontrada com os filtros selecionados.</p>
          <button
            onClick={limparFiltros}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {regionaisFiltradas.map((reg) => {
            const isExpanded = expandedRegionais[reg.id] ?? false;

            return (
              <div
                key={reg.id}
                className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden transition-all"
              >
                {/* Cabeçalho da Linha Regional (Acordeão) */}
                <div
                  onClick={() => toggleExpand(reg.id)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      className="p-1.5 rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                      title={isExpanded ? "Recolher" : "Expandir"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-foreground">
                          {reg.regional}
                        </h3>
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-muted text-muted-foreground">
                          Gerente: {reg.gerente}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {reg.redesFiltradas.length} de {reg.esperadas} redes exibidas
                      </p>
                    </div>
                  </div>

                  {/* KPIs da Regional */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
                    
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Esperadas
                      </span>
                      <span className="text-sm font-extrabold text-foreground">
                        {reg.esperadas}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        No Sistema
                      </span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {reg.no_sistema}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Faltantes
                      </span>
                      <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                        {reg.faltantes}
                      </span>
                    </div>

                    <div className="text-right min-w-[110px]">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Cobertura
                      </span>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        {getBadgeFarol(reg.status_farol, reg.cobertura_pct)}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Tabela de Detalhamento das Redes (visível se expandido) */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                          <th className="py-2.5 px-4">Rede Operacional</th>
                          <th className="py-2.5 px-3">Cód. Matriz</th>
                          <th className="py-2.5 px-3">UF</th>
                          <th className="py-2.5 px-3">Status da Carta</th>
                          <th className="py-2.5 px-3">Nº da Carta</th>
                          <th className="py-2.5 px-3">Competência</th>
                          <th className="py-2.5 px-3">Validade</th>
                          <th className="py-2.5 px-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {reg.redesFiltradas.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 px-4 text-center text-muted-foreground text-xs">
                              Nenhuma rede desta regional corresponde aos filtros de busca/status ativos.
                            </td>
                          </tr>
                        ) : (
                          reg.redesFiltradas.map((r) => {
                            const temCarta = Boolean(r.carta);

                            return (
                              <tr
                                key={`${r.manager}-${r.rede}-${r.codigo_matriz}`}
                                className={`transition-colors hover:bg-muted/20 ${
                                  !temCarta ? "bg-rose-500/[0.02]" : ""
                                }`}
                              >
                                {/* Nome da Rede */}
                                <td className="py-3 px-4 font-bold text-foreground">
                                  <div className="flex items-center gap-2">
                                    <span className={!temCarta ? "text-foreground font-extrabold" : "text-foreground"}>
                                      {r.rede}
                                    </span>
                                  </div>
                                </td>

                                {/* Código Matriz */}
                                <td className="py-3 px-3 text-muted-foreground font-mono text-[11px]">
                                  {r.codigo_matriz}
                                </td>

                                {/* UF */}
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
                                    {r.uf || "—"}
                                  </span>
                                </td>

                                {/* Status da Carta */}
                                <td className="py-3 px-3">
                                  {getBadgeStatusCarta(r.carta)}
                                </td>

                                {/* Número da Carta */}
                                <td className="py-3 px-3 font-mono text-[11px] font-semibold text-foreground">
                                  {r.carta?.numero_carta || "—"}
                                </td>

                                {/* Competência */}
                                <td className="py-3 px-3 text-muted-foreground">
                                  {r.carta?.competencia || competenciaSelecionada}
                                </td>

                                {/* Validade */}
                                <td className="py-3 px-3 text-muted-foreground text-[11px]">
                                  {r.carta?.validade_ate
                                    ? formatarDataValidade(r.carta.validade_ate)
                                    : "—"}
                                </td>

                                {/* Ações Rápidas */}
                                <td className="py-3 px-4 text-right">
                                  {temCarta && r.carta ? (
                                    <button
                                      onClick={() => onPreviewCarta(r.carta as unknown as CartaAnuenciaItem)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-primary hover:text-primary-foreground hover:bg-primary rounded-lg border border-primary/30 transition-colors"
                                      title="Visualizar Carta de Anuência"
                                    >
                                      <Eye className="w-3 h-3" />
                                      Visualizar
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onEmitirCarta(r.codigo_matriz, competenciaSelecionada)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-500/30 transition-colors shadow-sm"
                                      title="Emitir Carta de Anuência para esta rede"
                                    >
                                      <FilePlus className="w-3 h-3" />
                                      Emitir Carta
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
