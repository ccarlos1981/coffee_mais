"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import { Filter,
  BarChart3,
  Upload,
  Home,
  DollarSign,
  History,
  Users,
  TrendingUp,
  Calendar, Package } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";
import { SkeletonChart } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { GlassTooltip } from "@/components/GlassTooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
  ReferenceLine,
} from "recharts";

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
  matrizes: string[];
}

interface MonthlyHistoryRow {
  mesNum: number;
  mesLabel: string;
  mesFull: string;
  prevMonthsList?: string[];
  fat2025: number;
  qty2025: number;
  price2025: number;
  fat2026: number;
  qty2026: number;
  price2026: number;
  fatVar: number;
  qtyVar: number;
  priceVar: number;
}

interface ChartDataRow {
  mesNum: number;
  mesLabel: string;
  mesFull: string;
  prevMonthsList?: string[];
  fat2025: number | null;
  qty2025: number | null;
  price2025: number | null;
  fat2026: number | null;
  qty2026: number | null;
  price2026: number | null;
  fatVar: number;
  qtyVar: number;
  priceVar: number;
  qtyAccum2025?: number | null;
  qtyAccum2026?: number | null;
  fatAccum2025?: number | null;
  fatAccum2026?: number | null;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const PREV_MONTHS_MAP: Record<string, string[]> = {
  "Jan": ["dez", "nov", "out"],
  "Fev": ["jan", "dez", "nov"],
  "Mar": ["fev", "jan", "dez"],
  "Abr": ["mar", "fev", "jan"],
  "Mai": ["abr", "mar", "fev"],
  "Jun": ["mai", "abr", "mar"],
  "Jul": ["jun", "mai", "abr"],
  "Ago": ["jul", "jun", "mai"],
  "Set": ["ago", "jul", "jun"],
  "Out": ["set", "ago", "jul"],
  "Nov": ["out", "set", "ago"],
  "Dez": ["nov", "out", "set"]
};

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, data, width } = props;
  const monthLabel = payload.value;
  const prevMonths = PREV_MONTHS_MAP[monthLabel] || [];

  const ticksCount = props.visibleTicksCount || data?.length || 7;
  const categoryWidth = width && width > 0 
    ? (width > 250 ? width / ticksCount : width) 
    : 110;
  const offset = categoryWidth * 0.25;

  if (monthLabel === "Acum.") {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={offset} y={0} dy={14} textAnchor="middle" fill="#000" fontSize={11} fontWeight={600}>
          Acum.
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Mês atual embaixo da barra correspondente (direita, offset positivo) */}
      <text x={offset} y={0} dy={14} textAnchor="middle" fill="#000" fontSize={11} fontWeight={600}>
        {monthLabel}
      </text>
      {/* Trimestre comparado embaixo da barra correspondente (esquerda, offset negativo) */}
      {prevMonths.map((m: string, i: number) => (
        <text
          key={i}
          x={-offset}
          y={0}
          dy={14 + i * 12}
          textAnchor="middle"
          fill="#000"
          fontSize={9}
          fontWeight={600}
        >
          {m}
        </text>
      ))}
    </g>
  );
};

export default function HistoricoMatrizDashboard() {
  const [loading, setLoading] = useState(true);
  const fetchRequestIdRef = useRef(0);

  // Sidebar filters (persisted in localStorage and synced)
  const defaultEndMonth = useMemo(() => new Date().getMonth() + 1, []);
  const [filterStartMonth, setFilterStartMonth] = usePersistedState<number>("db_filter_startMonth", 1);
  const [filterEndMonth, setFilterEndMonth] = usePersistedState<number>("db_filter_endMonth", defaultEndMonth);
  const [filterManager, setFilterManager] = usePersistedState<string[]>("db_filter_manager", []);
  const [filterFamilia, setFilterFamilia] = usePersistedState<string[]>("db_filter_familia", []);
  const [filterUf, setFilterUf] = usePersistedState<string[]>("db_filter_uf", []);
  const [filterChannel, setFilterChannel] = usePersistedState<string[]>("db_filter_channel", []);
  const [filterProduct, setFilterProduct] = usePersistedState<string[]>("db_filter_product", []);
  const [filterMatriz, setFilterMatriz] = usePersistedState<string[]>("db_filter_matriz", []);

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [], matrizes: []
  });

  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistoryRow[]>([]);

  // Fetch filters
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/filters`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) { console.error(e); }
  }, []);

  // Fetch YoY comparison data by month
  const fetchData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    if (filterManager.length > 0) params.set("manager", filterManager.join(","));
    if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));
    if (filterUf.length > 0) params.set("uf", filterUf.join(","));
    if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
    if (filterProduct.length > 0) params.set("product", filterProduct.join(","));
    if (filterMatriz.length > 0) params.set("matriz", filterMatriz.join(","));
    params.set("startMonth", String(filterStartMonth));
    params.set("endMonth", String(filterEndMonth));

    try {
      const res = await fetch(`/api/dashboard/history-matriz?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (requestId !== fetchRequestIdRef.current) return;
      if (json.success) {
        setMonthlyHistory(json.byMonth || []);
      } else {
        console.error("[Client History Matriz] API returned success: false, error:", json.error);
      }
    } catch (e) {
      if (requestId === fetchRequestIdRef.current) {
        console.error("[Client History Matriz] Fetch catch block error:", e);
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz, filterStartMonth, filterEndMonth]);

  useEffect(() => { Promise.resolve().then(() => fetchFilters()); }, [fetchFilters]);
  useEffect(() => { Promise.resolve().then(() => fetchData()); }, [fetchData]);

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
    setFilterMatriz([]);
    setFilterStartMonth(1);
    setFilterEndMonth(defaultEndMonth);
  };

  const hasActiveFilters = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].some(f => f.length > 0) || filterStartMonth !== 1 || filterEndMonth !== defaultEndMonth;
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length + (filterStartMonth !== 1 || filterEndMonth !== defaultEndMonth ? 1 : 0);

  // Calculos de KPIs totais
  const totals = useMemo(() => {
    const totalFat2025 = monthlyHistory.reduce((sum, item) => sum + item.fat2025, 0);
    const totalFat2026 = monthlyHistory.reduce((sum, item) => sum + item.fat2026, 0);
    const totalQty2025 = monthlyHistory.reduce((sum, item) => sum + item.qty2025, 0);
    const totalQty2026 = monthlyHistory.reduce((sum, item) => sum + item.qty2026, 0);

    const totalPrice2025 = totalQty2025 > 0 ? totalFat2025 / totalQty2025 : 0;
    const totalPrice2026 = totalQty2026 > 0 ? totalFat2026 / totalQty2026 : 0;

    const fatVar = totalFat2025 > 0 ? ((totalFat2026 - totalFat2025) / totalFat2025) * 100 : 0;
    const qtyVar = totalQty2025 > 0 ? ((totalQty2026 - totalQty2025) / totalQty2025) * 100 : 0;
    const priceVar = totalPrice2025 > 0 ? ((totalPrice2026 - totalPrice2025) / totalPrice2025) * 100 : 0;

    return {
      fat2025: totalFat2025,
      fat2026: totalFat2026,
      qty2025: totalQty2025,
      qty2026: totalQty2026,
      price2025: totalPrice2025,
      price2026: totalPrice2026,
      fatVar,
      qtyVar,
      priceVar,
    };
  }, [monthlyHistory]);

  const hasData = useMemo(() => {
    return monthlyHistory.some(item => item.fat2025 > 0 || item.fat2026 > 0 || item.qty2025 > 0 || item.qty2026 > 0);
  }, [monthlyHistory]);

  const showKPIs = monthlyHistory.length > 0 && hasData;

  const periodLabel = useMemo(() => {
    if (filterStartMonth === filterEndMonth) {
      return MONTHS[filterStartMonth - 1];
    }
    return `${MONTHS[filterStartMonth - 1].slice(0, 3)} a ${MONTHS[filterEndMonth - 1].slice(0, 3)}`;
  }, [filterStartMonth, filterEndMonth]);

  const maxValues = useMemo(() => {
    let qty = 0;
    let fat = 0;
    let price = 0;
    for (const m of monthlyHistory) {
      qty = Math.max(qty, m.qty2025, m.qty2026);
      fat = Math.max(fat, m.fat2025, m.fat2026);
      price = Math.max(price, m.price2025, m.price2026);
    }
    return { qty, fat, price };
  }, [monthlyHistory]);

  const chartData = useMemo<ChartDataRow[]>(() => {
    if (monthlyHistory.length === 0) return [];

    const sumFat2025 = monthlyHistory.reduce((sum, item) => sum + item.fat2025, 0);
    const sumFat2026 = monthlyHistory.reduce((sum, item) => sum + item.fat2026, 0);
    const sumQty2025 = monthlyHistory.reduce((sum, item) => sum + item.qty2025, 0);
    const sumQty2026 = monthlyHistory.reduce((sum, item) => sum + item.qty2026, 0);

    const price2025 = sumQty2025 > 0 ? sumFat2025 / sumQty2025 : 0;
    const price2026 = sumQty2026 > 0 ? sumFat2026 / sumQty2026 : 0;

    const fatVar = sumFat2025 > 0 ? ((sumFat2026 - sumFat2025) / sumFat2025) * 100 : 0;
    const qtyVar = sumQty2025 > 0 ? ((sumQty2026 - sumQty2025) / sumQty2025) * 100 : 0;
    const priceVar = price2025 > 0 ? ((price2026 - price2025) / price2025) * 100 : 0;

    const months: ChartDataRow[] = monthlyHistory.map(m => ({
      ...m,
      qtyAccum2025: null,
      qtyAccum2026: null,
      fatAccum2025: null,
      fatAccum2026: null
    }));

    const accumulatedRow: ChartDataRow = {
      mesNum: 99,
      mesLabel: "Acum.",
      mesFull: "Acumulado do Período",
      fat2025: null,
      fat2026: null,
      qty2025: null,
      qty2026: null,
      price2025: price2025,
      price2026: price2026,
      fatVar,
      qtyVar,
      priceVar,
      qtyAccum2025: sumQty2025,
      qtyAccum2026: sumQty2026,
      fatAccum2025: sumFat2025,
      fatAccum2026: sumFat2026
    };

    return [...months, accumulatedRow];
  }, [monthlyHistory]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "80px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div className="cm-nav-links">
          <Link href="/vendas" className="cm-nav-link"><BarChart3 style={{ width: 12, height: 12 }} /> Dashboard</Link>
          <Link href="/metas" className="cm-nav-link">Metas</Link>
          <Link href="/upload" className="cm-nav-link"><Upload style={{ width: 12, height: 12 }} /> Upload</Link>
        </div>

        {/* Centered Title */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            Histórico por Matriz
          </h1>
          <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            Comparativo de Vendas vs Último Trimestre — <span style={{ opacity: 0.7 }}>*Valores /1k p/ Faturamento e Volumes</span>
          </p>
        </div>

        <div className="cm-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportButton data={monthlyHistory} filename="Historico_Matriz_Export" />
          <div style={{ fontSize: "0.58rem", color: "var(--foreground-dim)", textAlign: "right", lineHeight: 1.4 }}>
            <div style={{ color: "var(--foreground-muted)" }}>{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* BODY */}
      <div className="dash-body">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0, marginBottom: 4 }}>Período</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 12 }}>
            <select
              title="Mês Inicial"
              value={filterStartMonth}
              onChange={(e) => setFilterStartMonth(Number(e.target.value))}
              className="dash-filter-select"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m.slice(0, 3)}
                </option>
              ))}
            </select>
            <select
              title="Mês Final"
              value={filterEndMonth}
              onChange={(e) => setFilterEndMonth(Number(e.target.value))}
              className="dash-filter-select"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m.slice(0, 3)}
                </option>
              ))}
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

          <p className="dash-sidebar-title">Matriz</p>
          <MultiSelect 
            value={filterMatriz} 
            onChange={setFilterMatriz} 
            options={filterOptions.matrizes} 
            className="dash-filter-select"
            placeholder="Todas"
          />

          <p className="dash-sidebar-title">Linha SKU</p>
          <MultiSelect 
            value={filterProduct} 
            onChange={setFilterProduct} 
            options={filterOptions.products} 
            className="dash-filter-select"
            placeholder="Todos"
          />

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="cm-btn-clear">
              <Filter style={{ width: 11, height: 11 }} />
              Limpar Filtros ({activeFilterCount})
            </button>
          )}

          {hasActiveFilters && (
            <div className="sidebar-info-box">
              {(filterStartMonth !== 1 || filterEndMonth !== 12) && (
                <div>Período: <strong style={{color:"var(--foreground)"}}>{periodLabel}</strong></div>
              )}
              {filterManager.length > 0 && <div>Gerente: <strong style={{color:"var(--foreground)"}}>{filterManager.join(", ")}</strong></div>}
              {filterFamilia.length > 0 && <div>Família: <strong style={{color:"var(--foreground)"}}>{filterFamilia.join(", ")}</strong></div>}
              {filterUf.length > 0 && <div>UF: <strong style={{color:"var(--foreground)"}}>{filterUf.join(", ")}</strong></div>}
              {filterChannel.length > 0 && <div>Canal: <strong style={{color:"var(--foreground)"}}>{filterChannel.join(", ")}</strong></div>}
              {filterMatriz.length > 0 && <div>Matriz: <strong style={{color:"var(--foreground)"}}>{filterMatriz.join(", ")}</strong></div>}
              {filterProduct.length > 0 && <div>SKU: <strong style={{color:"var(--foreground)"}}>{filterProduct.join(", ")}</strong></div>}
            </div>
          )}
        </aside>

        {/* MAIN DASHBOARD */}
        <main className="dash-content">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, height: 90 }}>
                <div className="glass-card" style={{ height: 90 }} />
                <div className="glass-card" style={{ height: 90 }} />
                <div className="glass-card" style={{ height: 90 }} />
              </div>
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
            </div>
          ) : (!hasData || monthlyHistory.length === 0) ? (
            <div style={{ padding: "20px 0" }}>
              <EmptyState 
                title="Sem histórico para o período" 
                message="Nenhuma venda registrada com os filtros selecionados para 2025 e 2026. Tente remover alguns filtros." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
              
              {/* ═══ TOTAL KPI CARDS ═══ */}
              {showKPIs && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {/* FATURAMENTO */}
                  <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: "0.62rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>
                      Faturamento Acumulado (Mês Atual)
                    </p>
                    <p style={{ fontSize: "0.55rem", color: "var(--foreground-dim)", marginTop: -2, marginBottom: 6 }}>
                      Período: {periodLabel}
                    </p>
                    <p style={{ fontSize: "1.45rem", fontWeight: 800, color: "#d97706" }}>
                      {formatCurrency(totals.fat2026)}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
                      <span style={{ 
                        color: totals.fatVar >= 0 ? "var(--success)" : "var(--danger)",
                        background: totals.fatVar >= 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: "0.65rem",
                        fontWeight: 700
                      }}>
                        {totals.fatVar >= 0 ? "+" : ""}{totals.fatVar.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)" }}>vs Últ. Trim. ({formatCurrency(totals.fat2025 / 1000, 0)}k)</span>
                    </div>
                  </div>

                  {/* VOLUME */}
                  <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: "0.62rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>
                      Volume Acumulado (Mês Atual)
                    </p>
                    <p style={{ fontSize: "0.55rem", color: "var(--foreground-dim)", marginTop: -2, marginBottom: 6 }}>
                      Período: {periodLabel}
                    </p>
                    <p style={{ fontSize: "1.45rem", fontWeight: 800, color: "#0284c7" }}>
                      {formatNumber(totals.qty2026, 0)}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
                      <span style={{ 
                        color: totals.qtyVar >= 0 ? "var(--success)" : "var(--danger)",
                        background: totals.qtyVar >= 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: "0.65rem",
                        fontWeight: 700
                      }}>
                        {totals.qtyVar >= 0 ? "+" : ""}{totals.qtyVar.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)" }}>vs Últ. Trim. ({formatNumber(totals.qty2025, 0)})</span>
                    </div>
                  </div>

                  {/* PREÇO MÉDIO */}
                  <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: "0.62rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>
                      Preço Médio Acumulado (Mês Atual)
                    </p>
                    <p style={{ fontSize: "0.55rem", color: "var(--foreground-dim)", marginTop: -2, marginBottom: 6 }}>
                      Período: {periodLabel}
                    </p>
                    <p style={{ fontSize: "1.45rem", fontWeight: 800, color: "#65a30d" }}>
                      {formatCurrency(totals.price2026, 2)}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
                      <span style={{ 
                        color: totals.priceVar >= 0 ? "var(--success)" : "var(--danger)",
                        background: totals.priceVar >= 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: "0.65rem",
                        fontWeight: 700
                      }}>
                        {totals.priceVar >= 0 ? "+" : ""}{totals.priceVar.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)" }}>vs Últ. Trim. ({formatCurrency(totals.price2025, 2)})</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 1. VOLUME CHART (Qty) */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  VOLUME MENSAL (UNIDADES) — Mês Atual vs Último Trimestre
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData} margin={{ top: 20, right: 15, left: 15, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis xAxisId="left" dataKey="mesLabel" axisLine={false} tickLine={false} tick={<CustomXAxisTick data={chartData} />} height={60} />
                    <XAxis xAxisId="right" dataKey="mesLabel" hide={true} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatNumber(val, 0)} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatNumber(val, 0)} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [
                          formatNumber(Number(val), 0),
                          name === "qty2025" || name === "qtyAccum2025" ? "Último Trimestre" : "Mês Atual"
                        ]}
                        labelFormatter={(label, payload) => String(payload?.[0]?.payload?.mesFull || label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    {maxValues.qty > 0 && (
                      <ReferenceLine 
                        yAxisId="left"
                        y={maxValues.qty} 
                        stroke="#ef4444" 
                        strokeDasharray="3 3" 
                        label={{ 
                          value: `Record: ${formatNumber(maxValues.qty, 0)}`, 
                          position: 'top', 
                          fill: '#ef4444', 
                          fontSize: 9, 
                          fontWeight: 700 
                        }} 
                      />
                    )}
                    <Bar xAxisId="left" yAxisId="left" dataKey="qty2025" name="Último Trimestre" fill="#64748b" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="qty2025"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""}
                      />
                    </Bar>
                    <Bar xAxisId="left" yAxisId="left" dataKey="qty2026" name="Mês Atual" fill="#0284c7" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="qty2026"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""}
                      />
                      <LabelList
                        dataKey="qtyVar"
                        position="top"
                        fill="var(--foreground)"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }}
                      />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="qtyAccum2025" name="Último Trimestre" fill="#64748b" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList
                        dataKey="qtyAccum2025"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""}
                      />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="qtyAccum2026" name="Mês Atual" fill="#0284c7" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList
                        dataKey="qtyAccum2026"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""}
                      />
                      <LabelList
                        dataKey="qtyVar"
                        position="top"
                        fill="var(--foreground)"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 2. FATURAMENTO CHART (Fat) */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  FATURAMENTO MENSAL (R$ 000) — Mês Atual vs Último Trimestre
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData} margin={{ top: 20, right: 15, left: 15, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis xAxisId="left" dataKey="mesLabel" axisLine={false} tickLine={false} tick={<CustomXAxisTick data={chartData} />} height={60} />
                    <XAxis xAxisId="right" dataKey="mesLabel" hide={true} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => Math.round(val / 1000).toLocaleString("pt-BR")} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => Math.round(val / 1000).toLocaleString("pt-BR")} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [
                          formatCurrency(Number(val)),
                          name === "fat2025" || name === "fatAccum2025" ? "Último Trimestre" : "Mês Atual"
                        ]}
                        labelFormatter={(label, payload) => String(payload?.[0]?.payload?.mesFull || label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    {maxValues.fat > 0 && (
                      <ReferenceLine 
                        yAxisId="left"
                        y={maxValues.fat} 
                        stroke="#ef4444" 
                        strokeDasharray="3 3" 
                        label={{ 
                          value: `Record: ${formatCurrency(maxValues.fat)}`, 
                          position: 'top', 
                          fill: '#ef4444', 
                          fontSize: 9, 
                          fontWeight: 700 
                        }} 
                      />
                    )}
                    <Bar xAxisId="left" yAxisId="left" dataKey="fat2025" name="Último Trimestre" fill="#78350f" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="fat2025"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""}
                      />
                    </Bar>
                    <Bar xAxisId="left" yAxisId="left" dataKey="fat2026" name="Mês Atual" fill="#d97706" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="fat2026"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""}
                      />
                      <LabelList
                        dataKey="fatVar"
                        position="top"
                        fill="var(--foreground)"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }}
                      />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="fatAccum2025" name="Último Trimestre" fill="#78350f" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList
                        dataKey="fatAccum2025"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""}
                      />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="fatAccum2026" name="Mês Atual" fill="#d97706" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList
                        dataKey="fatAccum2026"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""}
                      />
                      <LabelList
                        dataKey="fatVar"
                        position="top"
                        fill="var(--foreground)"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 3. PREÇO MÉDIO CHART (Preço/Unid) */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  PREÇO MÉDIO MENSAL (R$/UNIDADE) — Mês Atual vs Último Trimestre
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData} margin={{ top: 20, right: 15, left: 15, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={<CustomXAxisTick data={chartData} />} height={60} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatCurrency(val, 2)} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [formatCurrency(Number(val), 2), name === "price2025" ? "Último Trimestre" : "Mês Atual"]}
                        labelFormatter={(label, payload) => String(payload?.[0]?.payload?.mesFull || label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    {maxValues.price > 0 && (
                      <ReferenceLine 
                        y={maxValues.price} 
                        stroke="#ef4444" 
                        strokeDasharray="3 3" 
                        label={{ 
                          value: `Record: ${formatCurrency(maxValues.price, 2)}`, 
                          position: 'top', 
                          fill: '#ef4444', 
                          fontSize: 9, 
                          fontWeight: 700 
                        }} 
                      />
                    )}
                    <Bar dataKey="price2025" name="Último Trimestre" fill="#3f6212" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="price2025"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                      />
                    </Bar>
                    <Bar dataKey="price2026" name="Mês Atual" fill="#65a30d" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="price2026"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                      />
                      <LabelList
                        dataKey="priceVar"
                        position="top"
                        fill="var(--foreground)"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}
        </main>
      </div>

      {/* ═══ BOTTOM TAB BAR ═══ */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Matriz</Link>
        <Link href="/historico-matriz" className="bottom-tab active"><History className="bottom-tab-icon" /> Hist. Matriz</Link>
        <Link href="/historico-por-matriz" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Matriz</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><Users className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
