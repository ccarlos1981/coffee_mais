"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import {
  Filter, BarChart3, Upload, Home, DollarSign,
  History, Users, Target, TrendingUp, CheckCircle2, Calendar,
  Package, Layers, Sparkles, ChevronRight, Download, X, Eye
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { Skeleton, SkeletonChart, SkeletonTable } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { GlassTooltip } from "@/components/GlassTooltip";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList, ComposedChart, Line, AreaChart, Area
} from 'recharts';

import { formatCurrency, formatNumber } from "@/lib/formatters";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const YEARS = [2026, 2025, 2024, 2023, 2022];

// Paleta fixa e determinística de cores por Família
const FAMILY_COLOR_MAP: Record<string, string> = {
  "Cápsula": "#6366f1",      // Indigo
  "Moído": "#f59e0b",        // Amber / Gold
  "Grão": "#10b981",        // Emerald
  "Drip Coffee": "#ec4899",  // Pink
  "Drip": "#ec4899",         // Pink
  "Geisha": "#8b5cf6",       // Purple
  "Acessório": "#06b6d4",    // Cyan
  "Rituais": "#f97316",      // Orange
  "SuperCap": "#3b82f6",     // Blue
  "Capuchino": "#14b8a6",    // Teal
  "Solúvel": "#14b8a6",      // Teal
  "1 KG": "#84cc16",         // Lime
  "5 KG": "#a855f7",         // Purple Light
  "Café Verde": "#22c55e",   // Green
  "Outros": "#6b7280",       // Gray
};

const PALETTE_FALLBACKS = [
  "#6366f1", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f97316", "#3b82f6", "#14b8a6", "#84cc16"
];

function getFamilyColor(familiaName: string, index: number = 0): string {
  if (FAMILY_COLOR_MAP[familiaName]) {
    return FAMILY_COLOR_MAP[familiaName];
  }
  // Se for nome parcial (ex: "Capsula Gourmet")
  for (const key of Object.keys(FAMILY_COLOR_MAP)) {
    if (familiaName.toLowerCase().includes(key.toLowerCase())) {
      return FAMILY_COLOR_MAP[key];
    }
  }
  return PALETTE_FALLBACKS[index % PALETTE_FALLBACKS.length];
}

function getHeatColor(value: number, max: number): string {
  if (value === 0) return 'transparent';
  const intensity = Math.min(value / Math.max(max, 1), 1);
  const r = Math.round(240 - intensity * 190);
  const g = Math.round(245 - intensity * 110);
  const b = Math.round(250 - intensity * 90);
  return `rgb(${r}, ${g}, ${b})`;
}

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
  matrizes: string[];
}

interface FamiliaRow {
  familia: string;
  fat: number;
  qty: number;
  clientes: number;
  matrizes: number;
  skus: number;
  ticketMedio: number;
  precoMedio: number;
  pctFiltrado: number;
  pctEmpresa: number;
  pctAcumulado: number;
  isPareto80: boolean;
  momFatGrowth: number | null;
  yoyFatGrowth: number | null;
  momQtyGrowth: number | null;
  yoyQtyGrowth: number | null;
}

interface SkuBreakdownRow {
  familia: string;
  sku: string;
  fat: number;
  qty: number;
  clientes: number;
}

interface ClientBreakdownRow {
  familia: string;
  sku: string;
  cliente: string;
  rede: string;
  uf: string;
  fat: number;
  qty: number;
}

interface MonthlyRow {
  familia: string;
  month: string;
  fat: number;
  qty: number;
  clientes: number;
}

export default function HistoricoFamiliaPage() {
  const [loading, setLoading] = useState(true);

  // Período default: 13 meses, acabando no mês ANTERIOR ao atual
  const now = new Date();
  const endRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultEndYear = endRef.getFullYear();
  const defaultEndMonth = endRef.getMonth() + 1;
  const startD = new Date(defaultEndYear, defaultEndMonth - 1 - 12, 1);
  const defaultStartYear = startD.getFullYear();
  const defaultStartMonth = startD.getMonth() + 1;

  const [filterStartYear, setFilterStartYear] = useState(defaultStartYear);
  const [filterStartMonth, setFilterStartMonth] = useState(defaultStartMonth);
  const [filterEndYear, setFilterEndYear] = useState(defaultEndYear);
  const [filterEndMonth, setFilterEndMonth] = useState(defaultEndMonth);

  // Sidebar filters (persisted and synced)
  const [filterManager, setFilterManager] = usePersistedState<string[]>("db_filter_manager", []);
  const [filterFamilia, setFilterFamilia] = usePersistedState<string[]>("db_filter_familia", []);
  const [filterUf, setFilterUf] = usePersistedState<string[]>("db_filter_uf", []);
  const [filterChannel, setFilterChannel] = usePersistedState<string[]>("db_filter_channel", []);
  const [filterProduct, setFilterProduct] = usePersistedState<string[]>("db_filter_product", []);
  const [filterMatriz, setFilterMatriz] = usePersistedState<string[]>("db_filter_matriz", []);

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [], matrizes: []
  });

  const [totals, setTotals] = useState({
    familias: 0, clientes: 0, matrizes: 0, fat: 0, qty: 0, meses: 0, totalEmpresaFat: 0
  });

  const [familiasData, setFamiliasData] = useState<FamiliaRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [skuBreakdown, setSkuBreakdown] = useState<SkuBreakdownRow[]>([]);
  const [clientBreakdown, setClientBreakdown] = useState<ClientBreakdownRow[]>([]);
  const [insights, setInsights] = useState<{
    familiaLider: FamiliaRow | null;
    maiorCrescimento: FamiliaRow | null;
    maiorQueda: FamiliaRow | null;
    regiaoLider: { uf: string; fat: number } | null;
    bulletPoints: string[];
  }>({
    familiaLider: null, maiorCrescimento: null, maiorQueda: null, regiaoLider: null, bulletPoints: []
  });

  // UX Controls
  const [mainMetric, setMainMetric] = useState<'fat' | 'qty' | 'clientes'>('fat');
  const [showTop10Only, setShowTop10Only] = useState(true);
  const [sortField, setSortField] = useState<keyof FamiliaRow>('fat');
  const [sortAsc, setSortAsc] = useState(false);

  // Drill-down Drawer state
  const [selectedDrawerFamilia, setSelectedDrawerFamilia] = useState<string | null>(null);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const fetchRequestIdRef = useRef(0);

  const fetchFilters = useCallback(async () => {
    try {
      const stD = new Date(filterStartYear, filterStartMonth - 1, 1);
      const startDateStr = stD.toISOString().split("T")[0];
      const enD = new Date(filterEndYear, filterEndMonth, 0);
      const endDateStr = enD.toISOString().split("T")[0];

      const res = await fetch(`/api/dashboard/filters?startDate=${startDateStr}&endDate=${endDateStr}`);
      if (res.ok) {
        const json = await res.json();
        if (json.filters) setFilterOptions(json.filters);
      }
    } catch (e) {
      console.error("Erro ao buscar filtros:", e);
    }
  }, [filterStartYear, filterStartMonth, filterEndYear, filterEndMonth]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const requestId = ++fetchRequestIdRef.current;

    try {
      const stD = new Date(filterStartYear, filterStartMonth - 1, 1);
      const startMonth = `${filterStartYear}-${String(filterStartMonth).padStart(2, '0')}`;
      const endMonth = `${filterEndYear}-${String(filterEndMonth).padStart(2, '0')}`;

      const params = new URLSearchParams({
        startMonth,
        endMonth,
        t: String(Date.now())
      });

      if (filterManager.length > 0) params.set("manager", filterManager.join(","));
      if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));
      if (filterUf.length > 0) params.set("uf", filterUf.join(","));
      if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
      if (filterProduct.length > 0) params.set("product", filterProduct.join(","));
      if (filterMatriz.length > 0) params.set("matriz", filterMatriz.join(","));

      const res = await fetch(`/api/dashboard/historico-familia?${params}`);
      if (res.ok && requestId === fetchRequestIdRef.current) {
        const rawJson = await res.json();
        setTotals(rawJson.totals || { familias: 0, clientes: 0, matrizes: 0, fat: 0, qty: 0, meses: 0, totalEmpresaFat: 0 });
        setFamiliasData(rawJson.familias || []);
        setMonthlyData(rawJson.monthly || []);
        setSkuBreakdown(rawJson.skuBreakdown || []);
        setClientBreakdown(rawJson.clientBreakdown || []);
        setInsights(rawJson.insights || { familiaLider: null, maiorCrescimento: null, maiorQueda: null, regiaoLider: null, bulletPoints: [] });
      }
    } catch (e) {
      if (requestId === fetchRequestIdRef.current) {
        console.error("Erro ao buscar histórico de famílias:", e);
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filterStartYear, filterStartMonth, filterEndYear, filterEndMonth, filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
    setFilterMatriz([]);
  };

  const hasActiveFilters = filterManager.length > 0 || filterFamilia.length > 0 || filterUf.length > 0 || filterChannel.length > 0 || filterProduct.length > 0 || filterMatriz.length > 0;
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length;

  // Ordenação da Tabela Analítica
  const sortedFamilias = useMemo(() => {
    return [...familiasData].sort((a, b) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [familiasData, sortField, sortAsc]);

  const handleSort = (field: keyof FamiliaRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Ranking Principal (Top 10 / Todas)
  const rankingFamilias = useMemo(() => {
    const sorted = [...familiasData].sort((a, b) => (b[mainMetric] || 0) - (a[mainMetric] || 0));
    return showTop10Only ? sorted.slice(0, 10) : sorted;
  }, [familiasData, mainMetric, showTop10Only]);

  // Meses Únicos no Período
  const uniqueMonths = useMemo(() => {
    return Array.from(new Set(monthlyData.map(m => m.month))).sort();
  }, [monthlyData]);

  // Pivot de Evolução de Participação Mensal
  const stackedMonthlyData = useMemo(() => {
    const monthGroup: Record<string, Record<string, number>> = {};
    uniqueMonths.forEach(m => { monthGroup[m] = {}; });

    monthlyData.forEach(row => {
      if (!monthGroup[row.month]) monthGroup[row.month] = {};
      monthGroup[row.month][row.familia] = (monthGroup[row.month][row.familia] || 0) + row.fat;
    });

    return uniqueMonths.map(month => {
      const entry: Record<string, any> = { month };
      const monthTotal = Object.values(monthGroup[month] || {}).reduce((a, b) => a + b, 0) || 1;
      
      familiasData.forEach(f => {
        const val = monthGroup[month]?.[f.familia] || 0;
        entry[f.familia] = parseFloat(((val / monthTotal) * 100).toFixed(1));
      });
      return entry;
    });
  }, [monthlyData, uniqueMonths, familiasData]);

  // Exportação CSV/Excel
  const handleExportData = (format: 'excel' | 'csv') => {
    if (familiasData.length === 0) return;

    const headers = [
      "Família", "Faturamento R$", "Volume (Qtd)", "Clientes Compradores", "Matrizes", "SKUs",
      "Ticket Médio R$", "Preço Médio R$", "% Share Filtrado", "% Share Empresa", "% Acumulado",
      "Crescimento MoM %", "Crescimento YoY %"
    ];

    const rows = familiasData.map(f => [
      f.familia,
      f.fat.toFixed(2),
      f.qty.toFixed(2),
      f.clientes,
      f.matrizes,
      f.skus,
      f.ticketMedio.toFixed(2),
      f.precoMedio.toFixed(2),
      f.pctFiltrado.toFixed(2) + "%",
      f.pctEmpresa.toFixed(2) + "%",
      f.pctAcumulado.toFixed(2) + "%",
      f.momFatGrowth !== null ? f.momFatGrowth.toFixed(2) + "%" : "—",
      f.yoyFatGrowth !== null ? f.yoyFatGrowth.toFixed(2) + "%" : "—",
    ]);

    const separator = format === 'csv' ? ';' : ',';
    let content = headers.join(separator) + "\n";
    rows.forEach(r => {
      content += r.map(val => `"${val}"`).join(separator) + "\n";
    });

    const blob = new Blob(["\ufeff" + content], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Historico_Familias_${filterStartYear}_${filterStartMonth}_a_${filterEndYear}_${filterEndMonth}.${format === 'csv' ? 'csv' : 'xls'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Detalhes do Drawer para a família selecionada
  const drawerFamilySkus = useMemo(() => {
    if (!selectedDrawerFamilia) return [];
    return skuBreakdown.filter(s => s.familia === selectedDrawerFamilia);
  }, [skuBreakdown, selectedDrawerFamilia]);

  const drawerSkuClients = useMemo(() => {
    if (!selectedDrawerFamilia || !expandedSku) return [];
    return clientBreakdown.filter(c => c.familia === selectedDrawerFamilia && c.sku === expandedSku);
  }, [clientBreakdown, selectedDrawerFamilia, expandedSku]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "70px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            HISTÓRICO DE FAMÍLIAS
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            {MONTHS[filterStartMonth - 1]}/{filterStartYear} a {MONTHS[filterEndMonth - 1]}/{filterEndYear}
          </p>
        </div>
        <div className="cm-nav-right"><ThemeToggle /></div>
      </nav>

      {/* DASH BODY */}
      <div className="dash-body">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Mês Inicial</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            <select title="Mês Inicial" value={filterStartMonth} onChange={(e) => setFilterStartMonth(Number(e.target.value))} className="dash-filter-select">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m.slice(0, 3)}</option>)}
            </select>
            <select title="Ano Inicial" value={filterStartYear} onChange={(e) => setFilterStartYear(Number(e.target.value))} className="dash-filter-select">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <p className="dash-sidebar-title">Mês Final</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            <select title="Mês Final" value={filterEndMonth} onChange={(e) => setFilterEndMonth(Number(e.target.value))} className="dash-filter-select">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m.slice(0, 3)}</option>)}
            </select>
            <select title="Ano Final" value={filterEndYear} onChange={(e) => setFilterEndYear(Number(e.target.value))} className="dash-filter-select">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <p className="dash-sidebar-title">Gerente</p>
          <MultiSelect value={filterManager} onChange={setFilterManager} options={filterOptions.managers} className="dash-filter-select" placeholder="Todos" />

          <p className="dash-sidebar-title">Família</p>
          <MultiSelect value={filterFamilia} onChange={setFilterFamilia} options={filterOptions.familias} className="dash-filter-select" placeholder="Todas" />

          <p className="dash-sidebar-title">Região (UF)</p>
          <MultiSelect value={filterUf} onChange={setFilterUf} options={filterOptions.ufs} className="dash-filter-select" placeholder="Todos" />

          <p className="dash-sidebar-title">Canal</p>
          <MultiSelect value={filterChannel} onChange={setFilterChannel} options={filterOptions.channels} className="dash-filter-select" placeholder="Todas" />

          <p className="dash-sidebar-title">Rede</p>
          <MultiSelect value={filterMatriz} onChange={setFilterMatriz} options={filterOptions.matrizes} className="dash-filter-select" placeholder="Todas" />

          <p className="dash-sidebar-title">Linha SKU</p>
          <MultiSelect value={filterProduct} onChange={setFilterProduct} options={filterOptions.products} className="dash-filter-select" placeholder="Todos" />

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="cm-btn-clear" style={{ marginTop: 12 }}>
              <Filter style={{ width: 11, height: 11 }} /> Limpar Filtros ({activeFilterCount})
            </button>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main className="cm-main" style={{ paddingTop: 4 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
               <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[85px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[85px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[85px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[85px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[85px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[85px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
               </div>
               <SkeletonChart height={260} />
               <SkeletonTable />
            </div>
          ) : familiasData.length === 0 ? (
            <div style={{ padding: "40px 0" }}>
              <EmptyState 
                title="Sem dados de Famílias" 
                message="Nenhuma venda de produto/família registrada com os filtros selecionados." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <>
          {/* CARDS SUPERIORES EXECUTIVOS (6 CARDS) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
            <div className="glass-card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Famílias</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--foreground)" }}>{formatNumber(totals.familias, 0)}</p>
            </div>

            <div className="glass-card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Clientes Compradores</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatNumber(totals.clientes, 0)}</p>
            </div>

            <div className="glass-card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Matrizes Positivadas</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#3f51b5" }}>{formatNumber(totals.matrizes, 0)}</p>
            </div>

            <div className="glass-card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Faturamento Total</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#2e7d32" }}>{formatCurrency(totals.fat, 0)}</p>
            </div>

            <div className="glass-card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Volume Total (Qtd)</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0284c7" }}>{formatNumber(totals.qty, 0)}</p>
            </div>

            <div className="glass-card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Ticket Médio / Cliente</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#d97706" }}>{formatCurrency(totals.clientes > 0 ? totals.fat / totals.clientes : 0, 0)}</p>
            </div>
          </div>

          {/* CARD DESTAQUE: FAMÍLIA LÍDER E INSIGHTS AUTOMÁTICOS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 14 }}>
            {/* CARD FAMÍLIA LÍDER */}
            {insights.familiaLider && (
              <div className="glass-card" style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg, rgba(254, 243, 199, 0.4) 0%, rgba(253, 230, 138, 0.15) 100%)",
                borderColor: "rgba(217, 119, 6, 0.3)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Sparkles style={{ width: 14, height: 14, color: "#d97706" }} />
                    <span style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#b45309" }}>
                      Família Líder do Período
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--foreground)", marginBottom: 4 }}>
                    {insights.familiaLider.familia}
                  </h3>
                  <p style={{ fontSize: "1.2rem", fontWeight: 800, color: "#2e7d32", marginBottom: 10 }}>
                    {formatCurrency(insights.familiaLider.fat, 0)}
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 8, borderTop: "1px dashed rgba(217, 119, 6, 0.3)" }}>
                  <div>
                    <span style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", display: "block" }}>Share Filtrado</span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--foreground)" }}>{insights.familiaLider.pctFiltrado.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", display: "block" }}>Share Empresa Total</span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--foreground-secondary)" }}>{insights.familiaLider.pctEmpresa.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", display: "block" }}>Variação MoM</span>
                    <strong style={{ fontSize: "0.85rem", color: (insights.familiaLider.momFatGrowth || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                      {insights.familiaLider.momFatGrowth !== null ? `${insights.familiaLider.momFatGrowth >= 0 ? '+' : ''}${insights.familiaLider.momFatGrowth.toFixed(1)}%` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", display: "block" }}>Variação YoY</span>
                    <strong style={{ fontSize: "0.85rem", color: (insights.familiaLider.yoyFatGrowth || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                      {insights.familiaLider.yoyFatGrowth !== null ? `${insights.familiaLider.yoyFatGrowth >= 0 ? '+' : ''}${insights.familiaLider.yoyFatGrowth.toFixed(1)}%` : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* CARD INSIGHTS AUTOMÁTICOS */}
            <div className="glass-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Sparkles style={{ width: 14, height: 14, color: "#3f51b5" }} />
                <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)" }}>
                  Insights Automáticos da Inteligência Comercial
                </h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {insights.bulletPoints.map((bp, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.72rem", color: "var(--foreground)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3f51b5", marginTop: 5, flexShrink: 0 }} />
                    <span>{bp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GRÁFICO PRINCIPAL: RANKING DAS FAMÍLIAS */}
          <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 14, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)" }}>
                  Ranking das Famílias
                </h3>
                <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>
                  Exibindo {showTop10Only ? Math.min(10, familiasData.length) : familiasData.length} de {familiasData.length} famílias
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Metric Switcher */}
                <div style={{ display: "flex", background: "var(--border)", padding: 2, borderRadius: 6, fontSize: "0.65rem" }}>
                  <button 
                    onClick={() => setMainMetric('fat')}
                    style={{
                      padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontWeight: 600,
                      background: mainMetric === 'fat' ? "var(--card-bg, #fff)" : "transparent",
                      color: mainMetric === 'fat' ? "var(--foreground)" : "var(--foreground-muted)",
                      boxShadow: mainMetric === 'fat' ? "0 1px 2px rgba(0,0,0,0.1)" : "none"
                    }}
                  >
                    Faturamento R$
                  </button>
                  <button 
                    onClick={() => setMainMetric('qty')}
                    style={{
                      padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontWeight: 600,
                      background: mainMetric === 'qty' ? "var(--card-bg, #fff)" : "transparent",
                      color: mainMetric === 'qty' ? "var(--foreground)" : "var(--foreground-muted)",
                      boxShadow: mainMetric === 'qty' ? "0 1px 2px rgba(0,0,0,0.1)" : "none"
                    }}
                  >
                    Volume (Qtd)
                  </button>
                  <button 
                    onClick={() => setMainMetric('clientes')}
                    style={{
                      padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontWeight: 600,
                      background: mainMetric === 'clientes' ? "var(--card-bg, #fff)" : "transparent",
                      color: mainMetric === 'clientes' ? "var(--foreground)" : "var(--foreground-muted)",
                      boxShadow: mainMetric === 'clientes' ? "0 1px 2px rgba(0,0,0,0.1)" : "none"
                    }}
                  >
                    Clientes
                  </button>
                </div>

                {/* Top 10 Toggle */}
                <button 
                  onClick={() => setShowTop10Only(!showTop10Only)}
                  className="cm-btn-clear"
                  style={{ fontSize: "0.65rem", padding: "4px 10px" }}
                >
                  {showTop10Only ? "Mostrar Todas" : "Mostrar Top 10"}
                </button>
              </div>
            </div>

            {/* BARS LIST */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rankingFamilias.map((fam, idx) => {
                const color = getFamilyColor(fam.familia, idx);
                const maxVal = rankingFamilias[0]?.[mainMetric] || 1;
                const currentVal = fam[mainMetric] || 0;
                const barWidthPct = Math.max(2, (currentVal / maxVal) * 100);

                const displayVal = mainMetric === 'fat' 
                  ? formatCurrency(fam.fat, 0)
                  : mainMetric === 'qty'
                    ? formatNumber(fam.qty, 0)
                    : formatNumber(fam.clientes, 0);

                return (
                  <div 
                    key={fam.familia}
                    onClick={() => setSelectedDrawerFamilia(fam.familia)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                      borderRadius: 8, background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)",
                      cursor: "pointer", transition: "all 0.15s ease"
                    }}
                    className="hover:bg-accent/10"
                  >
                    <div style={{ width: 140, fontWeight: 700, fontSize: "0.75rem", color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, marginRight: 6 }} />
                      {fam.familia}
                    </div>

                    <div style={{ flex: 1, position: "relative", height: 22, background: "var(--border)", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center" }}>
                      <div style={{ width: `${barWidthPct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
                      <span style={{ position: "absolute", left: 10, fontSize: "0.7rem", fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                        {displayVal}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.68rem", whiteSpace: "nowrap" }}>
                      <div>
                        <span style={{ color: "var(--foreground-muted)", display: "block", fontSize: "0.58rem" }}>Share Filtrado</span>
                        <strong style={{ color: "var(--foreground)" }}>{fam.pctFiltrado.toFixed(1)}%</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--foreground-muted)", display: "block", fontSize: "0.58rem" }}>Share Empresa</span>
                        <strong style={{ color: "var(--foreground-secondary)" }}>{fam.pctEmpresa.toFixed(1)}%</strong>
                      </div>
                      <div style={{ minWidth: 60, textAlign: "right" }}>
                        <span style={{ color: "var(--foreground-muted)", display: "block", fontSize: "0.58rem" }}>MoM</span>
                        <span style={{ fontWeight: 700, color: (fam.momFatGrowth || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                          {fam.momFatGrowth !== null ? `${fam.momFatGrowth >= 0 ? '+' : ''}${fam.momFatGrowth.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, opacity: 0.4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ÁREA ANALÍTICA INFERIOR */}
          
          {/* 1. RANKING GERAL DAS FAMÍLIAS (TABELA ANALÍTICA) */}
          <div className="glass-card" style={{ padding: 0, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground-secondary)" }}>
                  Ranking Geral das Famílias
                </h3>
                <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>Clique em qualquer linha para abrir o detalhamento (Drill Down)</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => handleExportData('excel')} className="cm-btn-clear" style={{ fontSize: "0.65rem" }}>
                  <Download style={{ width: 11, height: 11 }} /> Excel
                </button>
                <button onClick={() => handleExportData('csv')} className="cm-btn-clear" style={{ fontSize: "0.65rem" }}>
                  <Download style={{ width: 11, height: 11 }} /> CSV
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", width: "100%", whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "var(--card-bg, #fff)", borderBottom: "1px solid var(--border)" }}>
                    <th onClick={() => handleSort('familia')} style={{ textAlign: "left", padding: "8px 12px", cursor: "pointer" }}>Família</th>
                    <th onClick={() => handleSort('clientes')} style={{ textAlign: "center", padding: "8px 8px", cursor: "pointer" }}>Clientes</th>
                    <th onClick={() => handleSort('matrizes')} style={{ textAlign: "center", padding: "8px 8px", cursor: "pointer" }}>Matrizes</th>
                    <th onClick={() => handleSort('qty')} style={{ textAlign: "right", padding: "8px 8px", cursor: "pointer" }}>Volume (Qtd)</th>
                    <th onClick={() => handleSort('fat')} style={{ textAlign: "right", padding: "8px 8px", cursor: "pointer" }}>Faturamento</th>
                    <th onClick={() => handleSort('pctFiltrado')} style={{ textAlign: "right", padding: "8px 8px", cursor: "pointer" }}>Share Filtrado</th>
                    <th onClick={() => handleSort('pctEmpresa')} style={{ textAlign: "right", padding: "8px 8px", cursor: "pointer" }}>Share Empresa</th>
                    <th onClick={() => handleSort('ticketMedio')} style={{ textAlign: "right", padding: "8px 8px", cursor: "pointer" }}>Ticket Médio</th>
                    <th onClick={() => handleSort('precoMedio')} style={{ textAlign: "right", padding: "8px 8px", cursor: "pointer" }}>Preço Médio</th>
                    <th onClick={() => handleSort('momFatGrowth')} style={{ textAlign: "center", padding: "8px 8px", cursor: "pointer" }}>MoM %</th>
                    <th onClick={() => handleSort('yoyFatGrowth')} style={{ textAlign: "center", padding: "8px 8px", cursor: "pointer" }}>YoY %</th>
                    <th style={{ textAlign: "center", padding: "8px 8px" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFamilias.map((fam, idx) => (
                    <tr 
                      key={fam.familia}
                      onClick={() => setSelectedDrawerFamilia(fam.familia)}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                      className="hover:bg-accent/10"
                    >
                      <td style={{ padding: "8px 12px", fontWeight: 700 }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: getFamilyColor(fam.familia, idx), marginRight: 6 }} />
                        {fam.familia}
                      </td>
                      <td style={{ textAlign: "center", padding: "8px 8px" }}>{formatNumber(fam.clientes, 0)}</td>
                      <td style={{ textAlign: "center", padding: "8px 8px" }}>{formatNumber(fam.matrizes, 0)}</td>
                      <td style={{ textAlign: "right", padding: "8px 8px" }}>{formatNumber(fam.qty, 0)}</td>
                      <td style={{ textAlign: "right", padding: "8px 8px", fontWeight: 700, color: "#2e7d32" }}>{formatCurrency(fam.fat, 0)}</td>
                      <td style={{ textAlign: "right", padding: "8px 8px" }}>{fam.pctFiltrado.toFixed(1)}%</td>
                      <td style={{ textAlign: "right", padding: "8px 8px", color: "var(--foreground-muted)" }}>{fam.pctEmpresa.toFixed(1)}%</td>
                      <td style={{ textAlign: "right", padding: "8px 8px" }}>{formatCurrency(fam.ticketMedio, 0)}</td>
                      <td style={{ textAlign: "right", padding: "8px 8px" }}>{formatCurrency(fam.precoMedio, 2)}</td>
                      <td style={{ textAlign: "center", padding: "8px 8px", fontWeight: 700, color: (fam.momFatGrowth || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                        {fam.momFatGrowth !== null ? `${fam.momFatGrowth >= 0 ? '+' : ''}${fam.momFatGrowth.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ textAlign: "center", padding: "8px 8px", fontWeight: 700, color: (fam.yoyFatGrowth || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                        {fam.yoyFatGrowth !== null ? `${fam.yoyFatGrowth >= 0 ? '+' : ''}${fam.yoyFatGrowth.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ textAlign: "center", padding: "8px 8px" }}>
                        <button className="cm-btn-clear" style={{ padding: "2px 6px", fontSize: "0.6rem" }}>
                          <Eye style={{ width: 10, height: 10, marginRight: 2 }} /> Drill Down
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. PARETO DAS FAMÍLIAS & 3. TREEMAP EXECUTIVO */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {/* PARETO CHART */}
            <div className="glass-card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", height: 280 }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: 8 }}>
                Pareto das Famílias (Curva 80/20)
              </h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={familiasData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="familia" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} unit="%" />
                    <Tooltip content={<GlassTooltip formatter={(val, name) => [name === 'fat' ? formatCurrency(Number(val), 0) : `${Number(val).toFixed(1)}%`, name === 'fat' ? 'Faturamento' : '% Acumulado']} />} />
                    <Bar yAxisId="left" dataKey="fat" radius={[4, 4, 0, 0]}>
                      {familiasData.map((f, idx) => (
                        <Cell key={`cell-${idx}`} fill={getFamilyColor(f.familia, idx)} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="pctAcumulado" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TREEMAP EXECUTIVO */}
            <div className="glass-card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", height: 280 }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: 8 }}>
                Treemap Executivo (Mix de Vendas)
              </h3>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, overflowY: "auto", paddingRight: 4 }}>
                {familiasData.map((fam, idx) => {
                  const color = getFamilyColor(fam.familia, idx);
                  return (
                    <div 
                      key={fam.familia}
                      onClick={() => setSelectedDrawerFamilia(fam.familia)}
                      style={{
                        background: color, padding: "10px 12px", borderRadius: 8, color: "#fff",
                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                        minHeight: 80, cursor: "pointer", transition: "transform 0.15s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                      }}
                      className="hover:scale-[1.02]"
                    >
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                        {fam.familia}
                      </span>
                      <div>
                        <strong style={{ fontSize: "0.95rem", display: "block", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                          {formatCurrency(fam.fat, 0)}
                        </strong>
                        <span style={{ fontSize: "0.6rem", opacity: 0.9 }}>
                          {fam.pctFiltrado.toFixed(1)}% Share • {fam.skus} SKUs
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. EVOLUÇÃO DA PARTICIPAÇÃO (ÁREA EMPILHADA) */}
          <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 14, height: 260, display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: 10 }}>
              Evolução da Participação das Famílias Mês a Mês (%)
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stackedMonthlyData} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} unit="%" />
                  <Tooltip content={<GlassTooltip formatter={(val, name) => [`${Number(val).toFixed(1)}%`, String(name)]} />} />
                  {familiasData.map((f, idx) => (
                    <Area 
                      key={f.familia} 
                      type="monotone" 
                      dataKey={f.familia} 
                      stackId="1" 
                      stroke={getFamilyColor(f.familia, idx)} 
                      fill={getFamilyColor(f.familia, idx)} 
                      fillOpacity={0.8} 
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. HEATMAP (FAMÍLIAS × MESES) */}
          <div className="glass-card" style={{ padding: 0, marginBottom: 14 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground-secondary)" }}>
                Heatmap Sazonal (Intensidade de Vendas Famílias × Meses)
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: "0.68rem", borderCollapse: "collapse", width: "100%", whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "var(--card-bg, #fff)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px" }}>Família</th>
                    {uniqueMonths.map(m => (
                      <th key={m} style={{ textAlign: "center", padding: "8px 6px", fontSize: "0.6rem" }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {familiasData.map((fam, idx) => {
                    const famMonthly = monthlyData.filter(m => m.familia === fam.familia);
                    const monthMap = new Map(famMonthly.map(m => [m.month, m.fat]));
                    const maxFat = Math.max(...Array.from(monthMap.values()), 1);

                    return (
                      <tr key={fam.familia} style={{ borderBottom: "1px dashed var(--border)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: getFamilyColor(fam.familia, idx), marginRight: 6 }} />
                          {fam.familia}
                        </td>
                        {uniqueMonths.map(m => {
                          const val = monthMap.get(m) || 0;
                          return (
                            <td 
                              key={m} 
                              style={{ 
                                textAlign: "center", padding: "6px 8px", fontWeight: 600,
                                background: getHeatColor(val, maxFat), color: val > 0 ? "#1e293b" : "var(--foreground-muted)"
                              }}
                            >
                              {val > 0 ? formatCurrency(val, 0) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
        </main>
      </div>

      {/* DRILL DOWN DRAWER (FAMÍLIA → SKU → CLIENTES) */}
      {selectedDrawerFamilia && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "520px", maxWidth: "90vw",
          background: "var(--card-bg, #ffffff)", borderLeft: "1px solid var(--border)",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.15)", zIndex: 100, display: "flex", flexDirection: "column"
        }}>
          {/* DRAWER HEADER */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "0.6rem", textTransform: "uppercase", fontWeight: 800, color: "var(--accent-gold)", letterSpacing: "0.05em" }}>
                Drill Down de Família
              </span>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--foreground)" }}>
                {selectedDrawerFamilia}
              </h2>
            </div>
            <button onClick={() => { setSelectedDrawerFamilia(null); setExpandedSku(null); }} className="cm-btn-clear">
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* DRAWER BODY */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            <h4 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: 10 }}>
              SKUs Pertencentes à Família ({drawerFamilySkus.length})
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {drawerFamilySkus.map(s => {
                const isExpanded = expandedSku === s.sku;

                return (
                  <div key={s.sku} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <div 
                      onClick={() => setExpandedSku(isExpanded ? null : s.sku)}
                      style={{ padding: "10px 12px", background: "rgba(0,0,0,0.02)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <strong style={{ fontSize: "0.75rem", display: "block", color: "var(--foreground)" }}>{s.sku}</strong>
                        <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>
                          {formatNumber(s.clientes, 0)} Clientes • {formatNumber(s.qty, 0)} Qtd
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#2e7d32" }}>{formatCurrency(s.fat, 0)}</span>
                        <ChevronRight style={{ width: 14, height: 14, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }} />
                      </div>
                    </div>

                    {/* NÍVEL 3: CLIENTES DO SKU */}
                    {isExpanded && (
                      <div style={{ padding: "10px 12px", background: "var(--background)", borderTop: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-muted)", display: "block", marginBottom: 6 }}>
                          Top Clientes Compradores do SKU
                        </span>
                        {drawerSkuClients.length === 0 ? (
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>Sem registros de clientes.</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {drawerSkuClients.slice(0, 10).map((c, cIdx) => (
                              <div key={cIdx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", padding: "3px 0", borderBottom: "1px dashed var(--border)" }}>
                                <span><strong>{c.cliente}</strong> ({c.uf})</span>
                                <span style={{ fontWeight: 700, color: "#2e7d32" }}>{formatCurrency(c.fat, 0)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM TAB BAR */}
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
        <Link href="/historico-familia" className="bottom-tab active"><Layers className="bottom-tab-icon" /> Hist. Família</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
