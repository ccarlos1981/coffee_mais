"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Filter, BarChart3, Upload, Home, DollarSign, History, Users, TrendingUp, Target, CalendarDays, Calendar } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { SearchableSelect } from "@/components/SearchableSelect";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2026, 2025, 2024, 2023];

interface DRERow {
  label: string;
  isBold?: boolean;
  isHighlight?: boolean;
  actual: number;
  forecast: number;
  prevMonth: number;
  prevYear: number;
}

interface DREUnitRow {
  label: string;
  isBold?: boolean;
  isPercent?: boolean;
  actual: number;
  forecast: number;
  prevMonth: number;
  prevYear: number;
}

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
}

export default function DREPage() {
  // Filters
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterManager, setFilterManager] = useState("Todos");
  const [filterFamilia, setFilterFamilia] = useState("Todos");
  const [filterUf, setFilterUf] = useState("Todos");
  const [filterChannel, setFilterChannel] = useState("Todos");
  const [filterProduct, setFilterProduct] = useState("Todos");

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [],
  });

  const [dreRows, setDreRows] = useState<DRERow[]>([]);
  const [unitRows, setUnitRows] = useState<DREUnitRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Buscar dados reais do DRE
  const fetchDREData = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        year: String(filterYear),
        month: String(filterMonth),
        manager: filterManager,
        familia: filterFamilia,
        uf: filterUf,
        channel: filterChannel,
        product: filterProduct,
      });
      const res = await fetch(`/api/dre?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDreRows(json.dreRows);
        setUnitRows(json.unitRows);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do DRE:", e);
    } finally {
      setIsLoading(false);
    }
  }, [filterYear, filterMonth, filterManager, filterFamilia, filterUf, filterChannel, filterProduct]);

  // Sync DRE single-value filters with multi-select filters in localStorage
  useEffect(() => {
    const syncFilters = () => {
      const savedManager = localStorage.getItem("db_filter_manager");
      if (savedManager) {
        const arr = JSON.parse(savedManager);
        setFilterManager(arr.length > 0 ? arr[0] : "Todos");
      }
      const savedFamilia = localStorage.getItem("db_filter_familia");
      if (savedFamilia) {
        const arr = JSON.parse(savedFamilia);
        setFilterFamilia(arr.length > 0 ? arr[0] : "Todos");
      }
      const savedUf = localStorage.getItem("db_filter_uf");
      if (savedUf) {
        const arr = JSON.parse(savedUf);
        setFilterUf(arr.length > 0 ? arr[0] : "Todos");
      }
      const savedChannel = localStorage.getItem("db_filter_channel");
      if (savedChannel) {
        const arr = JSON.parse(savedChannel);
        setFilterChannel(arr.length > 0 ? arr[0] : "Todos");
      }
      const savedProduct = localStorage.getItem("db_filter_product");
      if (savedProduct) {
        const arr = JSON.parse(savedProduct);
        setFilterProduct(arr.length > 0 ? arr[0] : "Todos");
      }
    };
    syncFilters();
    window.addEventListener("storage", syncFilters);
    return () => window.removeEventListener("storage", syncFilters);
  }, []);

  const changeManager = (val: string) => {
    setFilterManager(val);
    localStorage.setItem("db_filter_manager", JSON.stringify(val === "Todos" ? [] : [val]));
  };
  const changeFamilia = (val: string) => {
    setFilterFamilia(val);
    localStorage.setItem("db_filter_familia", JSON.stringify(val === "Todos" ? [] : [val]));
  };
  const changeUf = (val: string) => {
    setFilterUf(val);
    localStorage.setItem("db_filter_uf", JSON.stringify(val === "Todos" ? [] : [val]));
  };
  const changeChannel = (val: string) => {
    setFilterChannel(val);
    localStorage.setItem("db_filter_channel", JSON.stringify(val === "Todos" ? [] : [val]));
  };
  const changeProduct = (val: string) => {
    setFilterProduct(val);
    localStorage.setItem("db_filter_product", JSON.stringify(val === "Todos" ? [] : [val]));
  };

  // Fetch filters
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/filters?year=${filterYear}&month=${filterMonth}`);
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) { console.error(e); }
  }, [filterYear, filterMonth]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchFilters();
      fetchDREData();
    });
  }, [fetchFilters, fetchDREData]);

  const handleClearFilters = () => {
    setFilterManager("Todos");
    setFilterFamilia("Todos");
    setFilterUf("Todos");
    setFilterChannel("Todos");
    setFilterProduct("Todos");
    localStorage.setItem("db_filter_manager", JSON.stringify([]));
    localStorage.setItem("db_filter_familia", JSON.stringify([]));
    localStorage.setItem("db_filter_uf", JSON.stringify([]));
    localStorage.setItem("db_filter_channel", JSON.stringify([]));
    localStorage.setItem("db_filter_product", JSON.stringify([]));
  };

  const hasActiveFilters = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct].some(f => f !== "Todos");
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct].filter(f => f !== "Todos").length;

  /* ─── Helpers ─── */
  const fmtVal = (v: number) => {
    if (v === 0) return "0";
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return v < 0 ? `(${formatted})` : formatted;
  };

  const fmtUnit = (v: number) => {
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${formatted})` : formatted;
  };

  const fmtPct = (v: number) => {
    if (v === 0 || isNaN(v) || !isFinite(v)) return "0%";
    const formatted = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + "%";
    return v < 0 ? `-${formatted}` : `+${formatted}`;
  };

  const delta = (actual: number, ref: number) => actual - ref;
  const pctDelta = (actual: number, ref: number) => {
    if (ref === 0) return 0;
    return ((actual - ref) / Math.abs(ref)) * 100;
  };

  const deltaColor = (d: number) => {
    if (d > 0) return { bg: "rgba(34,139,34,0.15)", color: "#228b22" };
    if (d < 0) return { bg: "rgba(220,20,60,0.15)", color: "#dc143c" };
    return { bg: "transparent", color: "var(--foreground-muted)" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div className="cm-nav-links">
          <Link href="/" className="cm-nav-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 10, borderRight: "1px solid var(--border)", paddingRight: 15 }}>
            <Home style={{ width: 14, height: 14, color: "var(--accent-gold)" }} />
            <span>Menu</span>
          </Link>
          <Link href="/dre" className="cm-nav-link active">Consolidado</Link>
          <Link href="/dre/historico" className="cm-nav-link">Mês a Mês</Link>
          <Link href="/dre/consolidado" className="cm-nav-link">Gerentes</Link>
          <Link href="/dre/rede" className="cm-nav-link">Redes</Link>
          <Link href="/dre/historico/auditoria" className="cm-nav-link">Auditoria & Fechamento</Link>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      {/* BODY: SIDEBAR + MAIN */}
      <div className="dash-body">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Período</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            <select title="Mês" value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="dash-filter-select">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m.slice(0, 3)}</option>)}
            </select>
            <select title="Ano" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="dash-filter-select">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <p className="dash-sidebar-title">Gerente</p>
          <select value={filterManager} onChange={(e) => changeManager(e.target.value)} className="dash-filter-select">
            <option value="Todos">Todos</option>
            {filterOptions.managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <p className="dash-sidebar-title">Família</p>
          <select value={filterFamilia} onChange={(e) => changeFamilia(e.target.value)} className="dash-filter-select">
            <option value="Todos">Todos</option>
            {filterOptions.familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <p className="dash-sidebar-title">Região (UF)</p>
          <select value={filterUf} onChange={(e) => changeUf(e.target.value)} className="dash-filter-select">
            <option value="Todos">Todos</option>
            {filterOptions.ufs.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          <p className="dash-sidebar-title">Canal</p>
          <select value={filterChannel} onChange={(e) => changeChannel(e.target.value)} className="dash-filter-select">
            <option value="Todos">Todos</option>
            {filterOptions.channels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <p className="dash-sidebar-title">Linha SKU</p>
          <SearchableSelect
            value={filterProduct}
            onChange={changeProduct}
            options={filterOptions.products}
            className="dash-filter-select"
            placeholder="Todos"
          />

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="cm-btn-clear" style={{ marginTop: 12 }}>
              <Filter style={{ width: 11, height: 11 }} />
              Limpar Filtros ({activeFilterCount})
            </button>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main className="dash-content" style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Page Header */}
          <div style={{ display: "flex", justifyContent: "between", alignItems: "center", marginBottom: 15, width: "100%", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--foreground)", margin: 0, textTransform: "uppercase" }}>
                DRE — Demonstrativo de Resultados
              </h2>
              <p style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", margin: "2px 0 0 0" }}>
                {MONTHS[filterMonth - 1]} {filterYear} — <span style={{ opacity: 0.7 }}>*Valores em R$ mil</span>
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 20px" }}>
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Carregando dados do DRE...</span>
            </div>
          ) : (
            <>
              {/* ═══ DRE COMPARATIVO ═══ */}
              <div className="glass-card" style={{ overflow: "hidden", marginBottom: 10, padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 980 }}>
                    <colgroup>
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "7%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "7%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "7%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", textAlign: "left", padding: "4px 6px", fontSize: "0.68rem" }}>P&L</th>
                        <th colSpan={1} style={{ textAlign: "center", borderBottom: "2px solid var(--foreground-muted)", borderLeft: "2px solid var(--border)", padding: "4px 6px", fontSize: "0.68rem" }}>MÊS ATUAL</th>
                        <th colSpan={3} style={{ textAlign: "center", borderBottom: "2px solid var(--accent-gold)", borderLeft: "2px solid var(--border)", padding: "4px 4px", fontSize: "0.68rem" }}>FORECAST</th>
                        <th colSpan={3} style={{ textAlign: "center", borderBottom: "2px solid #6b8fad", borderLeft: "2px solid var(--border)", padding: "4px 4px", fontSize: "0.68rem" }}>MÊS ANT.</th>
                        <th colSpan={3} style={{ textAlign: "center", borderBottom: "2px solid #5a805a", borderLeft: "2px solid var(--border)", padding: "4px 4px", fontSize: "0.68rem" }}>ANO ANT.</th>
                      </tr>
                      <tr>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Atual</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Valor</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>%Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Valor</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>%Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Valor</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>%Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dreRows.map((row, ri) => {
                        const rowBg = row.isHighlight ? "rgba(128,128,128,0.1)" : "transparent";
                        const rowStyle: React.CSSProperties = {
                          fontWeight: row.isBold ? 700 : 400,
                          background: rowBg,
                          ...(row.isBold ? { borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" } : {}),
                        };

                        const dForecast = delta(row.actual, row.forecast);
                        const pdForecast = pctDelta(row.actual, row.forecast);
                        const dPrevMonth = delta(row.actual, row.prevMonth);
                        const pdPrevMonth = pctDelta(row.actual, row.prevMonth);
                        const dPrevYear = delta(row.actual, row.prevYear);
                        const pdPrevYear = pctDelta(row.actual, row.prevYear);

                        const colorForecast = deltaColor(dForecast);
                        const colorPrevMonth = deltaColor(dPrevMonth);
                        const colorPrevYear = deltaColor(dPrevYear);

                        return (
                          <tr key={ri} style={rowStyle}>
                            <td style={{ textAlign: "left", fontWeight: row.isBold ? 700 : 400, padding: "4px 6px", whiteSpace: "nowrap" }}>
                              {row.label}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", fontWeight: row.isBold ? 700 : 400 }}>
                              {fmtVal(row.actual)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", color: "var(--foreground-secondary)" }}>
                              {fmtVal(row.forecast)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorForecast.color, fontWeight: 600 }}>
                              {fmtVal(dForecast)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorForecast.color, background: colorForecast.bg, fontWeight: 700 }}>
                              {fmtPct(pdForecast)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", color: "var(--foreground-secondary)" }}>
                              {fmtVal(row.prevMonth)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevMonth.color, fontWeight: 600 }}>
                              {fmtVal(dPrevMonth)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevMonth.color, background: colorPrevMonth.bg, fontWeight: 700 }}>
                              {fmtPct(pdPrevMonth)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", color: "var(--foreground-secondary)" }}>
                              {fmtVal(row.prevYear)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevYear.color, fontWeight: 600 }}>
                              {fmtVal(dPrevYear)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevYear.color, background: colorPrevYear.bg, fontWeight: 700 }}>
                              {fmtPct(pdPrevYear)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Indicadores Unitários */}
              <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 980 }}>
                    <colgroup>
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "7%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "7%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "7%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-background/50 border-b border-border">
                        <th rowSpan={2} style={{ verticalAlign: "bottom", textAlign: "left", padding: "4px 6px", fontSize: "0.68rem" }}>Indicadores</th>
                        <th colSpan={1} style={{ textAlign: "center", borderLeft: "2px solid var(--border)", padding: "4px 6px", fontSize: "0.68rem" }}>MÊS ATUAL</th>
                        <th colSpan={3} style={{ textAlign: "center", borderLeft: "2px solid var(--border)", padding: "4px 4px", fontSize: "0.68rem" }}>FORECAST</th>
                        <th colSpan={3} style={{ textAlign: "center", borderLeft: "2px solid var(--border)", padding: "4px 4px", fontSize: "0.68rem" }}>MÊS ANT.</th>
                        <th colSpan={3} style={{ textAlign: "center", borderLeft: "2px solid var(--border)", padding: "4px 4px", fontSize: "0.68rem" }}>ANO ANT.</th>
                      </tr>
                      <tr>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Atual</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Valor</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>%Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Valor</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>%Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem", borderLeft: "2px solid var(--border)" }}>Valor</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "3px 6px", fontSize: "0.65rem" }}>%Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitRows.map((row, ri) => {
                        const rowStyle: React.CSSProperties = row.isBold
                          ? { fontWeight: 700, background: "rgba(128,128,128,0.1)", borderTop: "1px solid var(--border)" }
                          : {};

                        const dForecast = delta(row.actual, row.forecast);
                        const pdForecast = pctDelta(row.actual, row.forecast);
                        const dPrevMonth = delta(row.actual, row.prevMonth);
                        const pdPrevMonth = pctDelta(row.actual, row.prevMonth);
                        const dPrevYear = delta(row.actual, row.prevYear);
                        const pdPrevYear = pctDelta(row.actual, row.prevYear);

                        const colorForecast = deltaColor(dForecast);
                        const colorPrevMonth = deltaColor(dPrevMonth);
                        const colorPrevYear = deltaColor(dPrevYear);

                        const display = row.isPercent
                          ? (v: number) => (v === undefined || v === null || isNaN(v) ? "0.0%" : `${v.toFixed(1)}%`)
                          : (v: number) => (v === undefined || v === null || isNaN(v) ? "0,00" : fmtUnit(v));

                        const displayPctDelta = (v: number) => {
                          if (v === 0 || isNaN(v) || !isFinite(v)) return "0%";
                          const formatted = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " pp";
                          return v < 0 ? `-${formatted}` : `+${formatted}`;
                        };

                        return (
                          <tr key={ri} style={rowStyle}>
                            <td style={{ textAlign: "left", fontWeight: row.isBold ? 700 : 400, padding: "4px 6px", whiteSpace: "nowrap" }}>
                              {row.label}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", fontWeight: row.isBold ? 700 : 400 }}>
                              {display(row.actual)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", color: "var(--foreground-secondary)" }}>
                              {display(row.forecast)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorForecast.color, fontWeight: 600 }}>
                              {row.isPercent ? displayPctDelta(dForecast) : display(dForecast)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorForecast.color, background: colorForecast.bg, fontWeight: 700 }}>
                              {fmtPct(pdForecast)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", color: "var(--foreground-secondary)" }}>
                              {display(row.prevMonth)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevMonth.color, fontWeight: 600 }}>
                              {row.isPercent ? displayPctDelta(dPrevMonth) : display(dPrevMonth)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevMonth.color, background: colorPrevMonth.bg, fontWeight: 700 }}>
                              {fmtPct(pdPrevMonth)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", borderLeft: "2px solid var(--border)", color: "var(--foreground-secondary)" }}>
                              {display(row.prevYear)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevYear.color, fontWeight: 600 }}>
                              {row.isPercent ? displayPctDelta(dPrevYear) : display(dPrevYear)}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px 6px", color: colorPrevYear.color, background: colorPrevYear.bg, fontWeight: 700 }}>
                              {fmtPct(pdPrevYear)}
                            </td>
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
    </div>
  );
}
