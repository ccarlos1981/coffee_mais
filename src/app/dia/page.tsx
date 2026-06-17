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
} from "recharts";

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
  matrizes: string[];
}

interface DailyRow {
  day: number;
  label: string;
  fat: number;
  qty: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2026, 2025, 2024, 2023];

export default function DailyDashboardPage() {
  const [loading, setLoading] = useState(true);
  const fetchRequestIdRef = useRef(0);

  // Filter States
  const [filterYear, setFilterYear] = useState<number | undefined>(undefined);
  const [filterMonth, setFilterMonth] = useState<number | undefined>(undefined);
  const [latestPeriod, setLatestPeriod] = useState<{ year: number; month: number } | null>(null);
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

  const [chartData, setChartData] = useState<DailyRow[]>([]);
  const [prevChartData, setPrevChartData] = useState<DailyRow[]>([]);
  const [prevMonthName, setPrevMonthName] = useState<string>("");
  const [prevYearNum, setPrevYearNum] = useState<number>(2026);

  // Fetch filter options
  const fetchFilters = useCallback(async () => {
    try {
      // Prioritize using actual values if available
      const now = new Date();
      const currentYear = filterYear || now.getFullYear();
      const currentMonth = filterMonth || (now.getMonth() + 1);

      const res = await fetch(`/api/dashboard/filters?year=${currentYear}&month=${currentMonth}`);
      const json = await res.json();
      if (json.success) {
        setFilterOptions(json.filters);
        if (json.latestPeriod) {
          setLatestPeriod(json.latestPeriod);
          setFilterYear(json.latestPeriod.year);
          setFilterMonth(json.latestPeriod.month);
        } else {
          const defaultYr = 2026;
          const defaultMn = 5;
          setLatestPeriod({ year: defaultYr, month: defaultMn });
          setFilterYear(defaultYr);
          setFilterMonth(defaultMn);
        }
      }
    } catch (e) {
      console.error("[Dia] Error fetching filter options:", e);
    }
  }, []);

  // Fetch daily sales data
  const fetchData = useCallback(async () => {
    if (filterYear === undefined || filterMonth === undefined) return;
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    params.set("year", String(filterYear));
    params.set("month", String(filterMonth));
    if (filterManager.length > 0) params.set("manager", filterManager.join(","));
    if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));
    if (filterUf.length > 0) params.set("uf", filterUf.join(","));
    if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
    if (filterProduct.length > 0) params.set("product", filterProduct.join(","));
    if (filterMatriz.length > 0) params.set("matriz", filterMatriz.join(","));

    let prevMonth = filterMonth - 1;
    let prevYear = filterYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = filterYear - 1;
    }

    const prevParams = new URLSearchParams(params);
    prevParams.set("year", String(prevYear));
    prevParams.set("month", String(prevMonth));

    try {
      const [res, prevRes] = await Promise.all([
        fetch(`/api/dashboard/daily?${params}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }),
        fetch(`/api/dashboard/daily?${prevParams}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
      ]);
      const [json, prevJson] = await Promise.all([
        res.json(),
        prevRes.json()
      ]);

      if (requestId !== fetchRequestIdRef.current) return;
      if (json.success) {
        setChartData(json.data || []);
      }
      if (prevJson.success) {
        setPrevChartData(prevJson.data || []);
        setPrevMonthName(MONTHS[prevMonth - 1]);
        setPrevYearNum(prevYear);
      }
    } catch (e) {
      if (requestId === fetchRequestIdRef.current) {
        console.error("[Dia] Error fetching daily sales data:", e);
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filterYear, filterMonth, filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz]);

  useEffect(() => { Promise.resolve().then(() => fetchFilters()); }, [fetchFilters]);

  useEffect(() => {
    if (filterYear !== undefined && filterMonth !== undefined) {
      Promise.resolve().then(() => fetchData());
    }
  }, [fetchData, filterYear, filterMonth]);

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
    setFilterMatriz([]);
    if (latestPeriod) {
      setFilterYear(latestPeriod.year);
      setFilterMonth(latestPeriod.month);
    } else {
      setFilterYear(2026);
      setFilterMonth(5);
    }
  };

  const defaultYear = latestPeriod?.year ?? 2026;
  const defaultMonth = latestPeriod?.month ?? 5;

  const hasActiveFilters = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].some(f => f.length > 0) || (filterYear !== undefined && filterYear !== defaultYear) || (filterMonth !== undefined && filterMonth !== defaultMonth);
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length + (filterYear !== defaultYear ? 1 : 0) + (filterMonth !== defaultMonth ? 1 : 0);

  // Format data for ExportButton
  const exportData = useMemo(() => {
    return chartData.map(row => ({
      "Dia": row.label,
      "Faturamento (R$)": row.fat,
      "Volume (Unidades)": row.qty,
    }));
  }, [chartData]);

  const hasData = chartData.some(d => d.fat > 0 || d.qty > 0);

  // Sums for KPI cards
  const summary = useMemo(() => {
    const totalFat = chartData.reduce((acc, d) => acc + d.fat, 0);
    const totalQty = chartData.reduce((acc, d) => acc + d.qty, 0);
    return { totalFat, totalQty };
  }, [chartData]);

  // Sums for day ranges: P1 (1-10), P2 (11-20), P3 (21-31) comparing current and previous months
  const periodData = useMemo(() => {
    const calcPeriod = (data: DailyRow[]) => {
      const totalFat = data.reduce((acc, d) => acc + d.fat, 0);
      const totalQty = data.reduce((acc, d) => acc + d.qty, 0);

      const p1 = data.filter(d => d.day >= 1 && d.day <= 10);
      const p2 = data.filter(d => d.day >= 11 && d.day <= 20);
      const p3 = data.filter(d => d.day >= 21 && d.day <= 31);

      const fat1 = p1.reduce((acc, d) => acc + d.fat, 0);
      const qty1 = p1.reduce((acc, d) => acc + d.qty, 0);

      const fat2 = p2.reduce((acc, d) => acc + d.fat, 0);
      const qty2 = p2.reduce((acc, d) => acc + d.qty, 0);

      const fat3 = p3.reduce((acc, d) => acc + d.fat, 0);
      const qty3 = p3.reduce((acc, d) => acc + d.qty, 0);

      return {
        totalFat,
        totalQty,
        p1: { fat: fat1, qty: qty1, fatPct: totalFat > 0 ? (fat1 / totalFat) * 100 : 0, qtyPct: totalQty > 0 ? (qty1 / totalQty) * 100 : 0 },
        p2: { fat: fat2, qty: qty2, fatPct: totalFat > 0 ? (fat2 / totalFat) * 100 : 0, qtyPct: totalQty > 0 ? (qty2 / totalQty) * 100 : 0 },
        p3: { fat: fat3, qty: qty3, fatPct: totalFat > 0 ? (fat3 / totalFat) * 100 : 0, qtyPct: totalQty > 0 ? (qty3 / totalQty) * 100 : 0 },
      };
    };

    return {
      current: calcPeriod(chartData),
      prev: calcPeriod(prevChartData)
    };
  }, [chartData, prevChartData]);

  // Combined chart data for side-by-side bars
  // bar1 = previous month (left), bar2 = current month (right)
  const combinedChartData = useMemo(() => {
    const maxDays = Math.max(
      chartData.length,
      prevChartData.length,
      31
    );
    const result = [];
    for (let i = 0; i < maxDays; i++) {
      const cur = chartData[i];
      const prev = prevChartData[i];
      if (!cur && !prev) continue;
      result.push({
        day: cur?.day ?? prev?.day ?? (i + 1),
        bar1Fat: prev?.fat ?? 0,
        bar2Fat: cur?.fat ?? 0,
        bar1Qty: prev?.qty ?? 0,
        bar2Qty: cur?.qty ?? 0,
      });
    }
    return result;
  }, [chartData, prevChartData]);

  const currentMonthLabel = filterMonth !== undefined ? MONTHS[filterMonth - 1] : "";

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
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifySelf: "center", height: "100%", justifyContent: "center" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            Análise Diária
          </h1>
          <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            Faturamento e Volume Diário — Período: {filterMonth !== undefined ? MONTHS[filterMonth - 1] : ""} / {filterYear || ""}
          </p>
        </div>

        <div className="cm-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportButton data={exportData} filename={`Analise_Diaria_${filterMonth !== undefined ? MONTHS[filterMonth-1] : ""}_${filterYear || ""}`} />
          <ThemeToggle />
        </div>
      </nav>

      {/* BODY */}
      <div className="dash-body">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0, marginBottom: 4 }}>Período</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 12 }}>
            <select title="Mês" value={filterMonth || ""} onChange={(e) => setFilterMonth(Number(e.target.value))} className="dash-filter-select">
              {MONTHS.map((m, i) => (<option key={i} value={i + 1}>{m.slice(0, 3)}</option>))}
            </select>
            <select title="Ano" value={filterYear || ""} onChange={(e) => setFilterYear(Number(e.target.value))} className="dash-filter-select">
              {YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
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
          <MultiSelect value={filterMatriz} onChange={setFilterMatriz} options={filterOptions.matrizes} className="dash-filter-select" placeholder="Todas" />

          <p className="dash-sidebar-title">Linha SKU</p>
          <MultiSelect value={filterProduct} onChange={setFilterProduct} options={filterOptions.products} className="dash-filter-select" placeholder="Todos" />

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="cm-btn-clear" style={{ marginTop: 12 }}>
              <Filter style={{ width: 11, height: 11 }} />
              Limpar Filtros ({activeFilterCount})
            </button>
          )}

          {hasActiveFilters && (
            <div className="sidebar-info-box">
              {filterYear !== defaultYear && <div>Ano: <strong style={{color:"var(--foreground)"}}>{filterYear}</strong></div>}
              {filterManager.length > 0 && <div>Gerente: <strong style={{color:"var(--foreground)"}}>{filterManager.join(", ")}</strong></div>}
              {filterFamilia.length > 0 && <div>Família: <strong style={{color:"var(--foreground)"}}>{filterFamilia.join(", ")}</strong></div>}
              {filterUf.length > 0 && <div>UF: <strong style={{color:"var(--foreground)"}}>{filterUf.join(", ")}</strong></div>}
              {filterChannel.length > 0 && <div>Canal: <strong style={{color:"var(--foreground)"}}>{filterChannel.join(", ")}</strong></div>}
              {filterMatriz.length > 0 && <div>Matriz: <strong style={{color:"var(--foreground)"}}>{filterMatriz.join(", ")}</strong></div>}
              {filterProduct.length > 0 && <div>SKU: <strong style={{color:"var(--foreground)"}}>{filterProduct.join(", ")}</strong></div>}
            </div>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main className="dash-content">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
            </div>
          ) : !hasData ? (
            <div style={{ padding: "20px 0" }}>
              <EmptyState 
                title="Sem histórico para o período" 
                message="Nenhuma venda registrada com os filtros selecionados para este mês. Tente mudar o período ou remover filtros." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
              
              {/* Daily KPI Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Faturamento Acumulado no Mês</p>
                  <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatCurrency(summary.totalFat, 0)}</p>
                </div>
                <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Volume Acumulado no Mês</p>
                  <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--foreground)" }}>{formatNumber(summary.totalQty, 0)} unidades</p>
                </div>
              </div>

              {/* Comparativo de Vendas por Períodos (Dezenas) */}
              <div className="glass-card animate-fade-in" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground)", marginBottom: 2 }}>
                    Comparativo de Vendas por Períodos (Dezena)
                  </h3>
                  <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>
                    Divisão das vendas acumuladas de faturamento e volume em períodos de 10 dias
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Bloco Mês Atual */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Mês Atual ({filterMonth !== undefined ? MONTHS[filterMonth - 1] : ""} / {filterYear})
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                      {/* P1 */}
                      <div className="glass-card" style={{ padding: "12px", border: "1px solid rgba(217, 119, 6, 0.15)", background: "rgba(217, 119, 6, 0.02)" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)" }}>Dia 01 ao 10</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatCurrency(periodData.current.p1.fat, 0)}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--accent-gold)", opacity: 0.85 }}>{periodData.current.p1.fatPct.toFixed(1)}% fat</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)" }}>{formatNumber(periodData.current.p1.qty, 0)} un</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{periodData.current.p1.qtyPct.toFixed(1)}% vol</span>
                        </div>
                      </div>
                      {/* P2 */}
                      <div className="glass-card" style={{ padding: "12px", border: "1px solid rgba(217, 119, 6, 0.15)", background: "rgba(217, 119, 6, 0.02)" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)" }}>Dia 11 ao 20</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatCurrency(periodData.current.p2.fat, 0)}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--accent-gold)", opacity: 0.85 }}>{periodData.current.p2.fatPct.toFixed(1)}% fat</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)" }}>{formatNumber(periodData.current.p2.qty, 0)} un</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{periodData.current.p2.qtyPct.toFixed(1)}% vol</span>
                        </div>
                      </div>
                      {/* P3 */}
                      <div className="glass-card" style={{ padding: "12px", border: "1px solid rgba(217, 119, 6, 0.15)", background: "rgba(217, 119, 6, 0.02)" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)" }}>Dia 21 ao 31</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatCurrency(periodData.current.p3.fat, 0)}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--accent-gold)", opacity: 0.85 }}>{periodData.current.p3.fatPct.toFixed(1)}% fat</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)" }}>{formatNumber(periodData.current.p3.qty, 0)} un</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{periodData.current.p3.qtyPct.toFixed(1)}% vol</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco Mês Passado */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Mês Passado ({prevMonthName} / {prevYearNum})
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                      {/* P1 */}
                      <div className="glass-card" style={{ padding: "12px", border: "1px solid var(--border)", background: "rgba(255, 255, 255, 0.01)" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)" }}>Dia 01 ao 10</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--foreground)" }}>{formatCurrency(periodData.prev.p1.fat, 0)}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)" }}>{periodData.prev.p1.fatPct.toFixed(1)}% fat</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-secondary)" }}>{formatNumber(periodData.prev.p1.qty, 0)} un</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{periodData.prev.p1.qtyPct.toFixed(1)}% vol</span>
                        </div>
                      </div>
                      {/* P2 */}
                      <div className="glass-card" style={{ padding: "12px", border: "1px solid var(--border)", background: "rgba(255, 255, 255, 0.01)" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)" }}>Dia 11 ao 20</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--foreground)" }}>{formatCurrency(periodData.prev.p2.fat, 0)}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)" }}>{periodData.prev.p2.fatPct.toFixed(1)}% fat</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-secondary)" }}>{formatNumber(periodData.prev.p2.qty, 0)} un</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{periodData.prev.p2.qtyPct.toFixed(1)}% vol</span>
                        </div>
                      </div>
                      {/* P3 */}
                      <div className="glass-card" style={{ padding: "12px", border: "1px solid var(--border)", background: "rgba(255, 255, 255, 0.01)" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)" }}>Dia 21 ao 31</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--foreground)" }}>{formatCurrency(periodData.prev.p3.fat, 0)}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)" }}>{periodData.prev.p3.fatPct.toFixed(1)}% fat</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-secondary)" }}>{formatNumber(periodData.prev.p3.qty, 0)} un</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{periodData.prev.p3.qtyPct.toFixed(1)}% vol</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. DAILY FATURAMENTO CHART */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 360 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  FATURAMENTO DIÁRIO (R$) — {prevMonthName.toUpperCase()} {prevYearNum} vs {currentMonthLabel.toUpperCase()} {filterYear || ""}
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={combinedChartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="4 4" horizontal={false} vertical={true} stroke="var(--foreground-muted)" opacity={0.35} />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} 
                      tickFormatter={(val) => Math.round(val / 1000) + 'k'} 
                    />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => {
                          const label = name === 'bar1Fat' ? prevMonthName : currentMonthLabel;
                          return [formatCurrency(Number(val)), label];
                        }}
                        labelFormatter={(label) => `Dia ${label}`}
                      />}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={24}
                      content={() => (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.65rem', fontWeight: 600, paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 10, height: 10, backgroundColor: '#b0bec5', borderRadius: 2 }} />
                            <span style={{ color: 'var(--foreground-muted)' }}>{prevMonthName}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 10, height: 10, backgroundColor: '#d97706', borderRadius: 2 }} />
                            <span style={{ color: 'var(--foreground-muted)' }}>{currentMonthLabel}</span>
                          </div>
                        </div>
                      )}
                    />
                    <Bar dataKey="bar1Fat" name={prevMonthName} fill="#b0bec5" radius={[3, 3, 0, 0]} minPointSize={3} />
                    <Bar dataKey="bar2Fat" name={currentMonthLabel} fill="#d97706" radius={[3, 3, 0, 0]} minPointSize={3}>
                      <LabelList 
                        dataKey="bar2Fat" 
                        position="top" 
                        fill="var(--foreground)" 
                        fontSize={8} 
                        fontWeight={600} 
                        formatter={(val: any) => {
                          const num = Number(val);
                          if (isNaN(num) || num <= 0) return "";
                          return num > 20000 ? Math.round(num / 1000) + 'k' : "";
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 2. DAILY VOLUME CHART */}
              <div className="glass-card animate-fade-in" style={{ padding: 16, height: 360 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>
                  VOLUME DIÁRIO (UNIDADES) — {prevMonthName.toUpperCase()} {prevYearNum} vs {currentMonthLabel.toUpperCase()} {filterYear || ""}
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={combinedChartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="4 4" horizontal={false} vertical={true} stroke="var(--foreground-muted)" opacity={0.35} />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} 
                      tickFormatter={(val) => formatNumber(val, 0)} 
                    />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val, name) => {
                          const label = name === 'bar1Qty' ? prevMonthName : currentMonthLabel;
                          return [formatNumber(Number(val), 0), label];
                        }}
                        labelFormatter={(label) => `Dia ${label}`}
                      />}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={24}
                      content={() => (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.65rem', fontWeight: 600, paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 10, height: 10, backgroundColor: '#b0bec5', borderRadius: 2 }} />
                            <span style={{ color: 'var(--foreground-muted)' }}>{prevMonthName}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 10, height: 10, backgroundColor: '#0284c7', borderRadius: 2 }} />
                            <span style={{ color: 'var(--foreground-muted)' }}>{currentMonthLabel}</span>
                          </div>
                        </div>
                      )}
                    />
                    <Bar dataKey="bar1Qty" name={prevMonthName} fill="#b0bec5" radius={[3, 3, 0, 0]} minPointSize={3} />
                    <Bar dataKey="bar2Qty" name={currentMonthLabel} fill="#0284c7" radius={[3, 3, 0, 0]} minPointSize={3}>
                      <LabelList 
                        dataKey="bar2Qty" 
                        position="top" 
                        fill="var(--foreground)" 
                        fontSize={8} 
                        fontWeight={600} 
                        formatter={(val: any) => {
                          const num = Number(val);
                          if (isNaN(num) || num <= 0) return "";
                          return num > 100 ? formatNumber(num, 0) : "";
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
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Matriz</Link>
        <Link href="/historico-por-matriz" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Matriz</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab active"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><Users className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
