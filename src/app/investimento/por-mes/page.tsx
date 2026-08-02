"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import {
  Filter,
  ChevronRight,
  BarChart3,
  Calendar,
  DollarSign,
  ArrowLeft,
  Info,
  TrendingUp,
  Building2,
  Wallet,
  CheckCircle2,
  HelpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";

const MONTHS_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const YEARS = [2026, 2025, 2024, 2023, 2022];

export interface InvestimentoFamiliaRow {
  familia: string;
  fatTT: number;
  investTT: number;
  pctInvTT: number;
  precoFlat: number;
  precoPromo: number;
  valorTotalFlat: number;
  pctInvVsFlat: number;
  volApurado: number;
  acoesCount: number;
}

export interface InvestimentoPorRedeRow {
  rede: string;
  gerente: string;
  uf: string;
  canal: string;
  fatTT: number;
  investTT: number;
  pctInvTT: number;
  precoFlat: number;
  precoPromo: number;
  valorTotalFlat: number;
  pctInvVsFlat: number;
  acoesElegiveisCount: number;
  familias: InvestimentoFamiliaRow[];
}

export interface InvestimentoPorRedeResult {
  rows: InvestimentoPorRedeRow[];
  grandTotal: {
    fatTT: number;
    investTT: number;
    pctInvTT: number;
    precoFlat: number;
    precoPromo: number;
    valorTotalFlat: number;
    pctInvVsFlat: number;
    acoesElegiveisCount: number;
    acoesDescartadasCount: number;
    qtdRedes: number;
    qtdFamilias: number;
  };
  filterOptions: {
    managers: string[];
    familias: string[];
    ufs: string[];
    channels: string[];
    matrizes: string[];
  };
}

type SortField = 'rede' | 'fatTT' | 'investTT' | 'pctInvTT' | 'precoFlat' | 'precoPromo' | 'pctInvVsFlat';
type SortDirection = 'asc' | 'desc';

export default function InvestimentoPorRedePage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [startMonth, setStartMonth] = useState<number>(currentMonth);
  const [startYear, setStartYear] = useState<number>(currentYear);
  const [endMonth, setEndMonth] = useState<number>(currentMonth);
  const [endYear, setEndYear] = useState<number>(currentYear);

  const [filterManager, setFilterManager] = useState<string[]>([]);
  const [filterUf, setFilterUf] = useState<string[]>([]);
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [filterMatriz, setFilterMatriz] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [dataResult, setDataResult] = useState<InvestimentoPorRedeResult | null>(null);

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('investTT');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Drill-down de arquitetura futura (para expandir ações por rede)
  const [expandedRedes, setExpandedRedes] = useState<Set<string>>(new Set());

  const toggleRede = (rede: string) => {
    setExpandedRedes(prev => {
      const next = new Set(prev);
      if (next.has(rede)) next.delete(rede);
      else next.add(rede);
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sDate = `${startYear}-${String(startMonth).padStart(2, '0')}`;
      const eDate = `${endYear}-${String(endMonth).padStart(2, '0')}`;

      const params = new URLSearchParams({
        startMonth: sDate,
        endMonth: eDate,
      });

      if (filterManager.length > 0) params.set("manager", filterManager.join(","));
      if (filterUf.length > 0) params.set("uf", filterUf.join(","));
      if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
      if (filterMatriz.length > 0) params.set("rede", filterMatriz.join(","));

      const res = await fetch(`/api/investimento/por-rede?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição: ${res.statusText}`);
      }
      const data: InvestimentoPorRedeResult = await res.json();
      setDataResult(data);
    } catch (err) {
      console.error("Erro ao carregar dados do AnalyticsEngine:", err);
    } finally {
      setLoading(false);
    }
  }, [startMonth, startYear, endMonth, endYear, filterManager, filterUf, filterChannel, filterMatriz]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterMatriz([]);
  };

  const activeFilterCount = filterManager.length + filterUf.length + filterChannel.length + filterMatriz.length;
  const hasActiveFilters = activeFilterCount > 0;

  // Dados ordenados dinamicamente
  const sortedRows = useMemo(() => {
    if (!dataResult?.rows) return [];
    return [...dataResult.rows].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [dataResult?.rows, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-fuchsia-400" /> : <ArrowDown className="w-3.5 h-3.5 text-fuchsia-400" />;
  };

  const getPctBadgeClass = (pct: number) => {
    if (pct <= 0) return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    if (pct < 10) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (pct <= 25) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  return (
    <div className="flex h-screen bg-background font-sans">
      {/* ═══ SIDEBAR FILTROS ═══ */}
      <aside className="w-[280px] flex-shrink-0 bg-background-elevated border-r border-border overflow-y-auto hidden lg:flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative z-20">
        <div className="p-6 sticky top-0 bg-background-elevated/80 backdrop-blur-xl border-b border-border z-10">
          <Link href="/investimento" className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
          </Link>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Filter className="w-5 h-5 text-fuchsia-500" />
              Filtros
            </h2>
            <ThemeToggle />
          </div>
          <p className="text-xs text-foreground-muted leading-relaxed">
            Filtros consolidados do Dashboard por Rede.
          </p>
        </div>

        <div className="p-6 flex-1 space-y-6">
          <div className="space-y-4">
            <div>
              <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Mês Inicial</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="dash-filter-select">
                  {MONTHS_NAMES.map((m, i) => <option key={`start-month-${i}`} value={i + 1}>{m}</option>)}
                </select>
                <select value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} className="dash-filter-select">
                  {YEARS.map(y => <option key={`start-year-${y}`} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="dash-sidebar-title">Mês Final</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} className="dash-filter-select">
                  {MONTHS_NAMES.map((m, i) => <option key={`end-month-${i}`} value={i + 1}>{m}</option>)}
                </select>
                <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} className="dash-filter-select">
                  {YEARS.map(y => <option key={`end-year-${y}`} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="dash-sidebar-title">Gerente</p>
              <MultiSelect value={filterManager} onChange={setFilterManager} options={dataResult?.filterOptions.managers || []} className="dash-filter-select" placeholder="Todos" />
            </div>

            <div>
              <p className="dash-sidebar-title">Região (UF)</p>
              <MultiSelect value={filterUf} onChange={setFilterUf} options={dataResult?.filterOptions.ufs || []} className="dash-filter-select" placeholder="Todas" />
            </div>

            <div>
              <p className="dash-sidebar-title">Canal</p>
              <MultiSelect value={filterChannel} onChange={setFilterChannel} options={dataResult?.filterOptions.channels || []} className="dash-filter-select" placeholder="Todos" />
            </div>

            <div>
              <p className="dash-sidebar-title">Rede</p>
              <MultiSelect value={filterMatriz} onChange={setFilterMatriz} options={dataResult?.filterOptions.matrizes || []} className="dash-filter-select" placeholder="Todas" />
            </div>
          </div>

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="cm-btn-clear w-full mt-4">
              <Filter style={{ width: 11, height: 11 }} />
              Limpar Filtros ({activeFilterCount})
            </button>
          )}

          <ExportButton 
            data={sortedRows.map(r => ({
              Rede: r.rede,
              Gerente: r.gerente,
              UF: r.uf,
              Canal: r.canal,
              Fat_TT: r.fatTT,
              Invest_TT: r.investTT,
              Pct_Inv_TT: `${r.pctInvTT}%`,
              Preco_Flat: r.precoFlat,
              Preco_Promo: r.precoPromo,
              Pct_Inv_vs_Preco_Flat: `${r.pctInvVsFlat}%`,
              Acoes_Elegiveis: r.acoesElegiveisCount
            }))}
            filename={`Investimento_por_Rede`}
            className="w-full mt-4 justify-center"
            variant="outline"
          />
        </div>
      </aside>

      {/* ═══ CONTEÚDO PRINCIPAL ═══ */}
      <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95 relative flex flex-col">
        <div className="p-6 sm:p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col space-y-6">
          
          {/* Cabeçalho Oficial */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <Building2 className="w-7 h-7 text-fuchsia-500" />
                Investimento por Rede
              </h1>
              <p className="text-sm text-foreground-secondary mt-1">
                Análise consolidada do faturamento, investimento executado e preços médios por rede.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-card hover:bg-card/80 border border-border px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
                title="Exportar PDF / Imprimir Relatório Executivo"
              >
                <Printer className="w-4 h-4 text-fuchsia-500" />
                <span>Exportar PDF</span>
              </button>
              <div className="flex items-center gap-2 text-xs text-foreground-muted bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Fonte Oficial: <strong>AnalyticsEngine V1</strong></span>
              </div>
            </div>
          </header>

          {/* Cards KPI Resumo (6 Indicadores Executivos) */}
          {dataResult && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-foreground-muted mb-1">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Fat TT</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-foreground">
                  {formatCurrency(dataResult.grandTotal.fatTT)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-foreground-muted mb-1">
                  <DollarSign className="w-4 h-4 text-fuchsia-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-500">Invest. TT</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-fuchsia-400">
                  {formatCurrency(dataResult.grandTotal.investTT)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-foreground-muted mb-1">
                  <TrendingUp className="w-4 h-4 text-cyan-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">% Inv. TT</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-foreground">
                  {formatPercent(dataResult.grandTotal.pctInvTT)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-foreground-muted mb-1">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">% Inv. vs Flat</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-foreground">
                  {formatPercent(dataResult.grandTotal.pctInvVsFlat)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-foreground-muted mb-1">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Qtd. Redes</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-foreground">
                  {dataResult.grandTotal.qtdRedes} <span className="text-xs font-normal text-foreground-muted">redes</span>
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-foreground-muted mb-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Ações Apuradas</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-foreground">
                  {dataResult.grandTotal.acoesElegiveisCount} <span className="text-xs font-normal text-foreground-muted">ações</span>
                </p>
              </div>
            </div>
          )}

          {/* Tabela de Investimento por Rede (Compact & Sticky Design) */}
          <div className="glass-card flex-1 flex flex-col overflow-hidden relative rounded-2xl border border-border shadow-sm">
            {loading ? (
              <div className="absolute inset-0 z-50 flex flex-col gap-3 items-center justify-center bg-background/60 backdrop-blur-sm">
                <div className="w-8 h-8 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-foreground-muted">Carregando dados da AnalyticsEngine...</p>
              </div>
            ) : null}

            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-30 bg-background-elevated border-b border-border shadow-sm">
                  <tr>
                    {/* 1. Rede / Drill-Down */}
                    <th 
                      onClick={() => handleSort('rede')}
                      className="p-3 font-bold text-foreground bg-background-elevated sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer group hover:bg-foreground/5 transition-colors w-[260px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Rede / Família</span>
                        {getSortIcon('rede')}
                      </div>
                    </th>

                    {/* 2. Fat TT */}
                    <th 
                      onClick={() => handleSort('fatTT')}
                      className="p-3 text-right font-bold text-foreground cursor-pointer group hover:bg-foreground/5 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div className="flex flex-col items-end leading-tight">
                          <span>Fat</span>
                          <span className="text-[10px] text-foreground-muted font-normal">TT</span>
                        </div>
                        {getSortIcon('fatTT')}
                        <div className="group/tip relative flex items-center">
                          <HelpCircle className="w-3.5 h-3.5 text-foreground-muted opacity-60 hover:opacity-100" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl border border-slate-700 z-50 normal-case font-normal leading-tight">
                            Faturamento total acumulado no período (fonte oficial AnalyticsEngine).
                          </div>
                        </div>
                      </div>
                    </th>

                    {/* 3. Invest. TT */}
                    <th 
                      onClick={() => handleSort('investTT')}
                      className="p-3 text-right font-bold text-fuchsia-400 cursor-pointer group hover:bg-foreground/5 transition-colors bg-fuchsia-500/5"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div className="flex flex-col items-end leading-tight">
                          <span>Invest.</span>
                          <span className="text-[10px] font-normal">TT</span>
                        </div>
                        {getSortIcon('investTT')}
                        <div className="group/tip relative flex items-center">
                          <HelpCircle className="w-3.5 h-3.5 text-fuchsia-400/80 hover:opacity-100" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block w-52 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl border border-slate-700 z-50 normal-case font-normal leading-tight">
                            Investimento total executado nas ações apuradas (Valor Unitário × Volume Real Apurado).
                          </div>
                        </div>
                      </div>
                    </th>

                    {/* 4. % Inv. TT */}
                    <th 
                      onClick={() => handleSort('pctInvTT')}
                      className="p-3 text-right font-bold text-foreground cursor-pointer group hover:bg-foreground/5 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div className="flex flex-col items-end leading-tight">
                          <span>% Inv.</span>
                          <span className="text-[10px] text-foreground-muted font-normal">TT</span>
                        </div>
                        {getSortIcon('pctInvTT')}
                        <div className="group/tip relative flex items-center">
                          <HelpCircle className="w-3.5 h-3.5 text-foreground-muted opacity-60 hover:opacity-100" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl border border-slate-700 z-50 normal-case font-normal leading-tight">
                            Percentual do investimento sobre o faturamento total (Invest. TT ÷ Fat TT).
                          </div>
                        </div>
                      </div>
                    </th>

                    {/* 5. Preço Flat */}
                    <th 
                      onClick={() => handleSort('precoFlat')}
                      className="p-3 text-right font-bold text-foreground cursor-pointer group hover:bg-foreground/5 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div className="flex flex-col items-end leading-tight">
                          <span>Preço</span>
                          <span className="text-[10px] text-foreground-muted font-normal">Flat</span>
                        </div>
                        {getSortIcon('precoFlat')}
                        <div className="group/tip relative flex items-center">
                          <HelpCircle className="w-3.5 h-3.5 text-foreground-muted opacity-60 hover:opacity-100" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block w-52 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl border border-slate-700 z-50 normal-case font-normal leading-tight">
                            Preço médio de tabela ponderado pelo volume real: Σ(Preço Flat × Volume) ÷ Σ(Volume).
                          </div>
                        </div>
                      </div>
                    </th>

                    {/* 6. Preço Promo */}
                    <th 
                      onClick={() => handleSort('precoPromo')}
                      className="p-3 text-right font-bold text-foreground cursor-pointer group hover:bg-foreground/5 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div className="flex flex-col items-end leading-tight">
                          <span>Preço</span>
                          <span className="text-[10px] text-foreground-muted font-normal">Promo</span>
                        </div>
                        {getSortIcon('precoPromo')}
                        <div className="group/tip relative flex items-center">
                          <HelpCircle className="w-3.5 h-3.5 text-foreground-muted opacity-60 hover:opacity-100" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block w-52 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl border border-slate-700 z-50 normal-case font-normal leading-tight">
                            Preço médio promocional ponderado pelo volume real: Σ(Preço Promo × Volume) ÷ Σ(Volume).
                          </div>
                        </div>
                      </div>
                    </th>

                    {/* 7. % Inv. vs Preço Flat */}
                    <th 
                      onClick={() => handleSort('pctInvVsFlat')}
                      className="p-3 text-right font-bold text-foreground cursor-pointer group hover:bg-foreground/5 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div className="flex flex-col items-end leading-tight">
                          <span>% Inv. vs</span>
                          <span className="text-[10px] text-foreground-muted font-normal">Flat</span>
                        </div>
                        {getSortIcon('pctInvVsFlat')}
                        <div className="group/tip relative flex items-center">
                          <HelpCircle className="w-3.5 h-3.5 text-foreground-muted opacity-60 hover:opacity-100" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block w-56 p-2.5 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl border border-slate-700 z-50 normal-case font-normal leading-tight">
                            <strong>Indicador Executivo:</strong> % do valor flat teórico (Σ Preço Flat × Volume Real) consumido pelo investimento realizado.
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {sortedRows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-foreground-muted">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Building2 className="w-8 h-8 opacity-40" />
                          <p className="font-semibold text-sm">Nenhuma rede encontrada para os filtros selecionados.</p>
                          <p className="text-xs">Tente ajustar o período ou limpar os filtros na barra lateral.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map(row => {
                      const isExpanded = expandedRedes.has(row.rede);
                      const hasFamilias = row.familias && row.familias.length > 0;

                      return (
                        <Fragment key={row.rede}>
                          {/* LINHA PAI — REDE */}
                          <tr 
                            onClick={() => toggleRede(row.rede)}
                            className="hover:bg-foreground/[0.03] transition-colors cursor-pointer group bg-card/60"
                          >
                            {/* 1. Rede */}
                            <td className="p-3 border-r border-border font-semibold text-foreground sticky left-0 bg-background-card group-hover:bg-background-elevated z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRede(row.rede);
                                  }}
                                  className="p-1 rounded hover:bg-foreground/10 text-foreground-muted hover:text-foreground transition-colors"
                                >
                                  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90 text-fuchsia-500 font-bold" : ""}`} />
                                </button>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-foreground group-hover:text-fuchsia-400 transition-colors truncate">
                                    {row.rede}
                                  </span>
                                  <span className="text-[10px] text-foreground-muted font-normal truncate">
                                    {row.gerente} {row.uf !== "N/I" ? `• ${row.uf}` : ''} {row.canal !== "N/I" ? `(${row.canal})` : ''}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. Fat TT */}
                            <td className="p-3 text-right font-semibold text-foreground">
                              {row.fatTT > 0 ? formatCurrency(row.fatTT) : <span className="text-foreground-muted font-normal">-</span>}
                            </td>

                            {/* 3. Invest. TT */}
                            <td className="p-3 text-right font-black text-fuchsia-400 bg-fuchsia-500/5">
                              {row.investTT > 0 ? formatCurrency(row.investTT) : <span className="text-foreground-muted font-normal">R$ 0</span>}
                            </td>

                            {/* 4. % Inv. TT */}
                            <td className="p-3 text-right font-bold">
                              {row.fatTT > 0 ? (
                                <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] ${getPctBadgeClass(row.pctInvTT)}`}>
                                  {formatPercent(row.pctInvTT)}
                                </span>
                              ) : (
                                <span className="text-foreground-muted font-normal">-</span>
                              )}
                            </td>

                            {/* 5. Preço Flat */}
                            <td className="p-3 text-right text-foreground-secondary font-medium">
                              {row.precoFlat > 0 ? formatCurrency(row.precoFlat, 2) : <span className="text-foreground-muted font-normal">-</span>}
                            </td>

                            {/* 6. Preço Promo */}
                            <td className="p-3 text-right text-foreground-secondary font-medium">
                              {row.precoPromo > 0 ? formatCurrency(row.precoPromo, 2) : <span className="text-foreground-muted font-normal">-</span>}
                            </td>

                            {/* 7. % Inv. vs Preço Flat */}
                            <td className="p-3 text-right font-bold text-foreground">
                              {row.valorTotalFlat > 0 ? (
                                <span className="text-indigo-400">
                                  {formatPercent(row.pctInvVsFlat)}
                                </span>
                              ) : (
                                <span className="text-foreground-muted font-normal">-</span>
                              )}
                            </td>
                          </tr>

                          {/* LINHAS FILHAS — FAMÍLIAS (DRILL-DOWN) */}
                          {isExpanded && hasFamilias && (
                            row.familias.map((fam) => (
                              <tr 
                                key={`${row.rede}-${fam.familia}`}
                                className="bg-background-elevated/40 hover:bg-background-elevated/80 transition-colors text-[11px]"
                              >
                                {/* 1. Nome da Família Indentado */}
                                <td className="p-2.5 border-r border-border sticky left-0 bg-background-elevated/90 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] pl-8">
                                  <div className="flex items-center gap-2 text-foreground-secondary">
                                    <span className="text-fuchsia-500/70 font-mono text-[10px]">↳</span>
                                    <span className="font-medium text-foreground-secondary">
                                      {fam.familia}
                                    </span>
                                  </div>
                                </td>

                                {/* 2. Fat TT */}
                                <td className="p-2.5 text-right font-medium text-foreground-secondary">
                                  {fam.fatTT > 0 ? formatCurrency(fam.fatTT) : <span className="text-foreground-muted">-</span>}
                                </td>

                                {/* 3. Invest. TT */}
                                <td className="p-2.5 text-right font-bold text-fuchsia-400/90 bg-fuchsia-500/[0.02]">
                                  {fam.investTT > 0 ? formatCurrency(fam.investTT) : <span className="text-foreground-muted font-normal">R$ 0</span>}
                                </td>

                                {/* 4. % Inv. TT */}
                                <td className="p-2.5 text-right">
                                  {fam.fatTT > 0 ? (
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${getPctBadgeClass(fam.pctInvTT)}`}>
                                      {formatPercent(fam.pctInvTT)}
                                    </span>
                                  ) : (
                                    <span className="text-foreground-muted">-</span>
                                  )}
                                </td>

                                {/* 5. Preço Flat */}
                                <td className="p-2.5 text-right text-foreground-muted">
                                  {fam.precoFlat > 0 ? formatCurrency(fam.precoFlat, 2) : <span className="text-foreground-muted">-</span>}
                                </td>

                                {/* 6. Preço Promo */}
                                <td className="p-2.5 text-right text-foreground-muted">
                                  {fam.precoPromo > 0 ? formatCurrency(fam.precoPromo, 2) : <span className="text-foreground-muted">-</span>}
                                </td>

                                {/* 7. % Inv. vs Preço Flat */}
                                <td className="p-2.5 text-right font-medium text-indigo-400/80">
                                  {fam.valorTotalFlat > 0 ? formatPercent(fam.pctInvVsFlat) : <span className="text-foreground-muted">-</span>}
                                </td>
                              </tr>
                            ))
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>

                {/* Rodapé Totais Gerais */}
                {dataResult && dataResult.rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                    <tr className="bg-background-elevated border-t-2 border-border font-bold">
                      <td className="p-3.5 border-r border-border text-foreground sticky left-0 bg-background-elevated z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] uppercase text-[11px] tracking-wider">
                        TOTAL GERAL
                      </td>
                      <td className="p-3.5 text-right text-foreground text-sm font-extrabold">
                        {formatCurrency(dataResult.grandTotal.fatTT)}
                      </td>
                      <td className="p-3.5 text-right text-fuchsia-400 text-sm font-black bg-fuchsia-500/10">
                        {formatCurrency(dataResult.grandTotal.investTT)}
                      </td>
                      <td className="p-3.5 text-right text-foreground">
                        <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] ${getPctBadgeClass(dataResult.grandTotal.pctInvTT)}`}>
                          {formatPercent(dataResult.grandTotal.pctInvTT)}
                        </span>
                      </td>
                      <td className="p-3.5 text-right text-foreground-secondary font-semibold">
                        {formatCurrency(dataResult.grandTotal.precoFlat, 2)}
                      </td>
                      <td className="p-3.5 text-right text-foreground-secondary font-semibold">
                        {formatCurrency(dataResult.grandTotal.precoPromo, 2)}
                      </td>
                      <td className="p-3.5 text-right text-indigo-400 font-extrabold">
                        {formatPercent(dataResult.grandTotal.pctInvVsFlat)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
