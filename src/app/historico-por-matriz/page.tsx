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

interface MatrizComparisonRow {
  matriz: string;
  qty2025: number;
  qty2026: number;
  fat2025: number;
  fat2026: number;
  price2025: number;
  price2026: number;
  qtyVar: number;
  fatVar: number;
  priceVar: number;
}

interface MonthlyRow {
  mesNum: number;
  mesLabel: string;
  mesFull: string;
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

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Custom bar label that shows the value rotated vertically inside the bar
const MatrizBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value || value === 0 || height < 20) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={10}
      fontWeight={600}
      transform={`rotate(-90, ${x + width / 2}, ${y + height / 2})`}
    >
      {typeof value === 'number' ? Math.round(value).toLocaleString("pt-BR") : value}
    </text>
  );
};

// Variation label on top of 2026 bar
const VariationLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === undefined || value === null || !isFinite(value) || value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 5}
      fill="var(--foreground)"
      textAnchor="middle"
      fontSize={9}
      fontWeight={600}
    >
      {value > 0 ? "+" : ""}{Math.round(value)}%
    </text>
  );
};

export default function HistoricoPorMatrizPage() {
  const [loading, setLoading] = useState(true);
  const fetchRequestIdRef = useRef(0);

  // Sidebar filters (persisted and synced)
  const [filterStartMonth, setFilterStartMonth] = useState<number>(1);
  const [filterEndMonth, setFilterEndMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterManager, setFilterManager] = usePersistedState<string[]>("db_filter_manager", []);
  const [filterFamilia, setFilterFamilia] = usePersistedState<string[]>("db_filter_familia", []);
  const [filterUf, setFilterUf] = usePersistedState<string[]>("db_filter_uf", []);
  const [filterChannel, setFilterChannel] = usePersistedState<string[]>("db_filter_channel", []);
  const [filterProduct, setFilterProduct] = usePersistedState<string[]>("db_filter_product", []);
  const [filterMatriz, setFilterMatriz] = usePersistedState<string[]>("db_filter_matriz", []);

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [], matrizes: []
  });

  // Data states
  const [mode, setMode] = useState<"top10" | "monthly">("top10");
  const [matrizData, setMatrizData] = useState<MatrizComparisonRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);

  // Is a specific matrix selected?
  const isMatrizSelected = filterMatriz.length > 0;

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

  // Fetch comparison data
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
      const res = await fetch(`/api/dashboard/history-matriz-comparison?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (requestId !== fetchRequestIdRef.current) return;
      if (json.success) {
        setMode(json.mode);
        if (json.mode === "top10") {
          setMatrizData(json.byMatriz || []);
          setMonthlyData([]);
        } else {
          setMonthlyData(json.byMonth || []);
          setMatrizData([]);
        }
      }
    } catch (e) {
      if (requestId === fetchRequestIdRef.current) {
        console.error("[Hist. por Matriz] Fetch error:", e);
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
    setFilterEndMonth(12);
  };

  const hasActiveFilters = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].some(f => f.length > 0) || filterStartMonth !== 1 || filterEndMonth !== 12;
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length + (filterStartMonth !== 1 || filterEndMonth !== 12 ? 1 : 0);

  const periodLabel = useMemo(() => {
    if (filterStartMonth === filterEndMonth) {
      return MONTHS[filterStartMonth - 1];
    }
    return `${MONTHS[filterStartMonth - 1].slice(0, 3)} a ${MONTHS[filterEndMonth - 1].slice(0, 3)}`;
  }, [filterStartMonth, filterEndMonth]);

  const hasData = useMemo(() => {
    if (mode === "top10") {
      return matrizData.some(m => m.qty2025 > 0 || m.qty2026 > 0 || m.fat2025 > 0 || m.fat2026 > 0);
    }
    return monthlyData.some(m => m.fat2025 > 0 || m.fat2026 > 0 || m.qty2025 > 0 || m.qty2026 > 0);
  }, [mode, matrizData, monthlyData]);

  // ──── TOP 10 CHART DATA ────
  const volumeChartData = useMemo(() => {
    return [...matrizData].sort((a, b) => (b.qty2025 + b.qty2026) - (a.qty2025 + a.qty2026));
  }, [matrizData]);

  const fatChartData = useMemo(() => {
    return [...matrizData].sort((a, b) => (b.fat2025 + b.fat2026) - (a.fat2025 + a.fat2026));
  }, [matrizData]);

  const priceChartData = useMemo(() => {
    return volumeChartData;
  }, [volumeChartData]);

  // ──── MONTHLY CHART DATA (with accumulated) ────
  const monthlyChartData = useMemo(() => {
    if (monthlyData.length === 0) return [];

    const sumFat2025 = monthlyData.reduce((sum, m) => sum + m.fat2025, 0);
    const sumFat2026 = monthlyData.reduce((sum, m) => sum + m.fat2026, 0);
    const sumQty2025 = monthlyData.reduce((sum, m) => sum + m.qty2025, 0);
    const sumQty2026 = monthlyData.reduce((sum, m) => sum + m.qty2026, 0);
    const price2025 = sumQty2025 > 0 ? sumFat2025 / sumQty2025 : 0;
    const price2026 = sumQty2026 > 0 ? sumFat2026 / sumQty2026 : 0;

    const months = monthlyData.map(m => ({
      ...m,
      qtyAccum2025: null as number | null,
      qtyAccum2026: null as number | null,
      fatAccum2025: null as number | null,
      fatAccum2026: null as number | null,
    }));

    const accum = {
      mesNum: 99,
      mesLabel: "Acum.",
      mesFull: "Acumulado do Período",
      fat2025: null as number | null,
      fat2026: null as number | null,
      qty2025: null as number | null,
      qty2026: null as number | null,
      price2025,
      price2026,
      fatVar: sumFat2025 > 0 ? ((sumFat2026 - sumFat2025) / sumFat2025) * 100 : 0,
      qtyVar: sumQty2025 > 0 ? ((sumQty2026 - sumQty2025) / sumQty2025) * 100 : 0,
      priceVar: price2025 > 0 ? ((price2026 - price2025) / price2025) * 100 : 0,
      qtyAccum2025: sumQty2025,
      qtyAccum2026: sumQty2026,
      fatAccum2025: sumFat2025,
      fatAccum2026: sumFat2026,
    };

    return [...months, accum];
  }, [monthlyData]);

  // Max values for reference lines (monthly mode)
  const monthlyMaxValues = useMemo(() => {
    let qty = 0, fat = 0, price = 0;
    for (const m of monthlyData) {
      qty = Math.max(qty, m.qty2025, m.qty2026);
      fat = Math.max(fat, m.fat2025, m.fat2026);
      price = Math.max(price, m.price2025, m.price2026);
    }
    return { qty, fat, price };
  }, [monthlyData]);

  const exportData = mode === "top10" ? matrizData : monthlyData;

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
            Hist. por Rede
          </h1>
          <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            {isMatrizSelected
              ? `Comparativo Mensal 2025 vs 2026 — ${filterMatriz.join(", ")}`
              : `Top 10 Redes — Acumulado ${periodLabel} (2025 vs 2026)`
            }
          </p>
        </div>

        <div className="cm-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportButton data={exportData} filename="Hist_Por_Rede_Export" />
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
            <select title="Mês Inicial" value={filterStartMonth} onChange={(e) => setFilterStartMonth(Number(e.target.value))} className="dash-filter-select">
              {MONTHS.map((m, i) => (<option key={i} value={i + 1}>{m.slice(0, 3)}</option>))}
            </select>
            <select title="Mês Final" value={filterEndMonth} onChange={(e) => setFilterEndMonth(Number(e.target.value))} className="dash-filter-select">
              {MONTHS.map((m, i) => (<option key={i} value={i + 1}>{m.slice(0, 3)}</option>))}
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
              {filterMatriz.length > 0 && <div>Rede: <strong style={{color:"var(--foreground)"}}>{filterMatriz.join(", ")}</strong></div>}
              {filterProduct.length > 0 && <div>SKU: <strong style={{color:"var(--foreground)"}}>{filterProduct.join(", ")}</strong></div>}
            </div>
          )}
        </aside>

        {/* MAIN DASHBOARD */}
        <main className="dash-content">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
            </div>
          ) : (!hasData) ? (
            <div style={{ padding: "20px 0" }}>
              <EmptyState 
                title="Sem histórico para o período" 
                message="Nenhuma venda registrada com os filtros selecionados para 2025 e 2026. Tente remover alguns filtros." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : mode === "top10" ? (
            /* ═══════════════════════════════════════════════
               MODE: TOP 10 MATRIZES — ACCUMULATED COMPARISON
               ═══════════════════════════════════════════════ */
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>

              {/* 1. VOLUME CHART */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 340 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  VOLUME ACUMULADO (UNIDADES) — TOP 10 REDES — {periodLabel.toUpperCase()} 2025 x 2026
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={volumeChartData} margin={{ top: 25, right: 10, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis 
                      dataKey="matriz" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end"
                      height={50}
                      tickFormatter={(val: string) => val.length > 15 ? val.substring(0, 13) + '…' : val}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatNumber(val, 0)} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [
                          formatNumber(Number(val), 0),
                          name === "qty2025" ? "2025" : "2026"
                        ]}
                        labelFormatter={(label) => String(label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    <Bar dataKey="qty2025" name="2025" fill="#64748b" radius={[4, 4, 0, 0]}>
                      <LabelList content={<MatrizBarLabel />} dataKey="qty2025" />
                    </Bar>
                    <Bar dataKey="qty2026" name="2026" fill="#0284c7" radius={[4, 4, 0, 0]}>
                      <LabelList content={<MatrizBarLabel />} dataKey="qty2026" />
                      <LabelList content={<VariationLabel />} dataKey="qtyVar" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 2. FATURAMENTO CHART */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 340 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  FATURAMENTO ACUMULADO (R$ 000) — TOP 10 REDES — {periodLabel.toUpperCase()} 2025 x 2026
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={fatChartData} margin={{ top: 25, right: 10, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis 
                      dataKey="matriz" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end"
                      height={50}
                      tickFormatter={(val: string) => val.length > 15 ? val.substring(0, 13) + '…' : val}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => Math.round(val / 1000).toLocaleString("pt-BR")} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [
                          formatCurrency(Number(val)),
                          name === "fat2025" ? "2025" : "2026"
                        ]}
                        labelFormatter={(label) => String(label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    <Bar dataKey="fat2025" name="2025" fill="#78350f" radius={[4, 4, 0, 0]}>
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
                    <Bar dataKey="fat2026" name="2026" fill="#d97706" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="fat2026"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""}
                      />
                      <LabelList content={<VariationLabel />} dataKey="fatVar" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 3. PREÇO MÉDIO CHART */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 340 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  PREÇO MÉDIO ACUMULADO (R$/UNIDADE) — TOP 10 REDES — {periodLabel.toUpperCase()} 2025 x 2026
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={priceChartData} margin={{ top: 25, right: 10, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis 
                      dataKey="matriz" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end"
                      height={50}
                      tickFormatter={(val: string) => val.length > 15 ? val.substring(0, 13) + '…' : val}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatCurrency(val)} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [
                          formatCurrency(Number(val)),
                          name === "price2025" ? "2025" : "2026"
                        ]}
                        labelFormatter={(label) => String(label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    <Bar dataKey="price2025" name="2025" fill="#3f6212" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="price2025"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}
                      />
                    </Bar>
                    <Bar dataKey="price2026" name="2026" fill="#65a30d" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="price2026"
                        position="center"
                        angle={-90}
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(val: any) => val > 0 ? Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}
                      />
                      <LabelList content={<VariationLabel />} dataKey="priceVar" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          ) : (
            /* ═══════════════════════════════════
               MODE: MONTHLY — SPECIFIC MATRIX
               ═══════════════════════════════════ */
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>

              {/* 1. VOLUME CHART (Monthly) */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  VOLUME MENSAL (UNIDADES) — 2025 x 2026
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={monthlyChartData} margin={{ top: 20, right: 15, left: 15, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis xAxisId="left" dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} />
                    <XAxis xAxisId="right" dataKey="mesLabel" hide={true} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatNumber(val, 0)} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatNumber(val, 0)} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [
                          formatNumber(Number(val), 0),
                          name === "qty2025" || name === "qtyAccum2025" ? "2025" : "2026"
                        ]}
                        labelFormatter={(label, payload) => String(payload?.[0]?.payload?.mesFull || label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    {monthlyMaxValues.qty > 0 && (
                      <ReferenceLine 
                        yAxisId="left"
                        y={monthlyMaxValues.qty} 
                        stroke="#ef4444" 
                        strokeDasharray="3 3" 
                        label={{ value: `Record: ${formatNumber(monthlyMaxValues.qty, 0)}`, position: 'top', fill: '#ef4444', fontSize: 9, fontWeight: 700 }} 
                      />
                    )}
                    <Bar xAxisId="left" yAxisId="left" dataKey="qty2025" name="2025" fill="#64748b" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="qty2025" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""} />
                    </Bar>
                    <Bar xAxisId="left" yAxisId="left" dataKey="qty2026" name="2026" fill="#0284c7" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="qty2026" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""} />
                      <LabelList dataKey="qtyVar" position="top" fill="var(--foreground)" fontSize={9} fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }} />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="qtyAccum2025" name="2025" fill="#64748b" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList dataKey="qtyAccum2025" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""} />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="qtyAccum2026" name="2026" fill="#0284c7" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList dataKey="qtyAccum2026" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val)).toLocaleString("pt-BR") : ""} />
                      <LabelList dataKey="qtyVar" position="top" fill="var(--foreground)" fontSize={9} fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 2. FATURAMENTO CHART (Monthly) */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  FATURAMENTO MENSAL (R$ 000) — 2025 x 2026
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={monthlyChartData} margin={{ top: 20, right: 15, left: 15, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis xAxisId="left" dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} />
                    <XAxis xAxisId="right" dataKey="mesLabel" hide={true} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => Math.round(val / 1000).toLocaleString("pt-BR")} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => Math.round(val / 1000).toLocaleString("pt-BR")} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [
                          formatCurrency(Number(val)),
                          name === "fat2025" || name === "fatAccum2025" ? "2025" : "2026"
                        ]}
                        labelFormatter={(label, payload) => String(payload?.[0]?.payload?.mesFull || label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    {monthlyMaxValues.fat > 0 && (
                      <ReferenceLine 
                        yAxisId="left"
                        y={monthlyMaxValues.fat} 
                        stroke="#ef4444" 
                        strokeDasharray="3 3" 
                        label={{ value: `Record: ${formatCurrency(monthlyMaxValues.fat)}`, position: 'top', fill: '#ef4444', fontSize: 9, fontWeight: 700 }} 
                      />
                    )}
                    <Bar xAxisId="left" yAxisId="left" dataKey="fat2025" name="2025" fill="#78350f" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="fat2025" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""} />
                    </Bar>
                    <Bar xAxisId="left" yAxisId="left" dataKey="fat2026" name="2026" fill="#d97706" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="fat2026" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""} />
                      <LabelList dataKey="fatVar" position="top" fill="var(--foreground)" fontSize={9} fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }} />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="fatAccum2025" name="2025" fill="#78350f" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList dataKey="fatAccum2025" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""} />
                    </Bar>
                    <Bar xAxisId="right" yAxisId="right" dataKey="fatAccum2026" name="2026" fill="#d97706" radius={[4, 4, 0, 0]} legendType="none">
                      <LabelList dataKey="fatAccum2026" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Math.round(Number(val) / 1000).toLocaleString("pt-BR") : ""} />
                      <LabelList dataKey="fatVar" position="top" fill="var(--foreground)" fontSize={9} fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 3. PREÇO MÉDIO CHART (Monthly) */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  PREÇO MÉDIO MENSAL (R$/UNIDADE) — 2025 x 2026
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={monthlyChartData} margin={{ top: 20, right: 15, left: 15, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatCurrency(val)} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => [formatCurrency(Number(val)), name === "price2025" ? "2025" : "2026"]}
                        labelFormatter={(label, payload) => String(payload?.[0]?.payload?.mesFull || label)}
                      />}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                    {monthlyMaxValues.price > 0 && (
                      <ReferenceLine 
                        y={monthlyMaxValues.price} 
                        stroke="#ef4444" 
                        strokeDasharray="3 3" 
                        label={{ value: `Record: ${formatCurrency(monthlyMaxValues.price, 2)}`, position: 'top', fill: '#ef4444', fontSize: 9, fontWeight: 700 }} 
                      />
                    )}
                    <Bar dataKey="price2025" name="2025" fill="#3f6212" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="price2025" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""} />
                    </Bar>
                    <Bar dataKey="price2026" name="2026" fill="#65a30d" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="price2026" position="center" angle={-90} fill="#fff" fontSize={10} fontWeight={600}
                        formatter={(val: any) => val > 0 ? Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""} />
                      <LabelList dataKey="priceVar" position="top" fill="var(--foreground)" fontSize={9} fontWeight={600}
                        formatter={(val: any) => {
                          if (val === 100 || val === 0 || val === undefined || val === null || !isFinite(val)) return "";
                          return `${val > 0 ? "+" : ""}${Math.round(val)}%`;
                        }} />
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
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Rede</Link>
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Rede</Link>
        <Link href="/historico-por-matriz" className="bottom-tab active"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Rede</Link>
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
