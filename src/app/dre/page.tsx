"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Filter,
  BarChart3,
  Upload,
  Home,
  DollarSign,
  History,
  Users,
  TrendingUp,
  Target,
  CalendarDays,
  Calendar, Package, CheckCircle2, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { SearchableSelect } from "@/components/SearchableSelect";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const YEARS = [2026, 2025, 2024, 2023, 2022];

/* ═══════════════════════════════════════════
   MOCK DATA — será substituído por dados reais
   ═══════════════════════════════════════════ */

interface DRERow {
  label: string;
  actual: number;
  budget: number;
  prevMonth: number;
  prevYear: number;
  isBold?: boolean;
  isHighlight?: boolean;
  isSeparator?: boolean;
  indent?: boolean;
}

interface DREUnitRow {
  label: string;
  actual: number;
  budget: number;
  prevMonth: number;
  prevYear: number;
  isPercent?: boolean;
  isBold?: boolean;
}

// Estado do DRE carregado dinamicamente via API
interface DRERow {
  label: string;
  actual: number;
  budget: number;
  prevMonth: number;
  prevYear: number;
  isBold?: boolean;
  isHighlight?: boolean;
}

interface DREUnitRow {
  label: string;
  actual: number;
  budget: number;
  prevMonth: number;
  prevYear: number;
  isPercent?: boolean;
  isBold?: boolean;
}


/* ═══════════════════════════════════════════ */

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
  const [viewMode, setViewMode] = useState<"comparison" | "monthly">("comparison");
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
  const [monthlyRows, setMonthlyRows] = useState<any[]>([]);
  const [monthlyUnitRows, setMonthlyUnitRows] = useState<any[]>([]);
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
        setMonthlyRows(json.monthlyRows);
        setMonthlyUnitRows(json.monthlyUnitRows);
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

  // Fetch filters (same endpoint as Vendas)
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

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div className="cm-nav-links">
          <Link href="/vendas" className="cm-nav-link">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <BarChart3 style={{ width: 12, height: 12 }} /> Dashboard
            </span>
          </Link>
          <Link href="/investimento" className="cm-nav-link">Investimento</Link>
          <Link href="/dre/historico" className="cm-nav-link" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, color: "var(--accent)" }}>
            Histórico DRE
          </Link>
          <Link href="/atendimento" className="cm-nav-link">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Users style={{ width: 12, height: 12 }} /> Atendimento
            </span>
          </Link>
        </div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            DRE — Demonstrativo de Resultados
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            {MONTHS[filterMonth - 1]} {filterYear} — <span style={{ opacity: 0.7 }}>*Valores em R$ mil</span>
          </p>
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
            <button onClick={handleClearFilters} className="cm-btn-clear">
              <Filter style={{ width: 11, height: 11 }} />
              Limpar Filtros ({activeFilterCount})
            </button>
          )}

          {hasActiveFilters && (
            <div className="sidebar-info-box">
              {filterManager !== "Todos" && <div>Gerente: <strong style={{color:'var(--foreground)'}}>{filterManager}</strong></div>}
              {filterFamilia !== "Todos" && <div>Família: <strong style={{color:'var(--foreground)'}}>{filterFamilia}</strong></div>}
              {filterUf !== "Todos" && <div>UF: <strong style={{color:'var(--foreground)'}}>{filterUf}</strong></div>}
              {filterChannel !== "Todos" && <div>Canal: <strong style={{color:'var(--foreground)'}}>{filterChannel}</strong></div>}
              {filterProduct !== "Todos" && <div>SKU: <strong style={{color:'var(--foreground)'}}>{filterProduct}</strong></div>}
            </div>
          )}

          {/* Toggle Mês a Mês */}
          <button
            onClick={() => setViewMode(viewMode === "comparison" ? "monthly" : "comparison")}
            style={{
              width: "100%",
              padding: "8px 10px",
              marginTop: 12,
              borderRadius: 6,
              border: viewMode === "monthly" ? "1.5px solid var(--accent-gold)" : "1px solid var(--border)",
              background: viewMode === "monthly" ? "rgba(184,134,11,0.12)" : "var(--background-card, var(--background))",
              color: viewMode === "monthly" ? "var(--accent-gold)" : "var(--foreground-secondary)",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            <CalendarDays style={{ width: 13, height: 13 }} />
            {viewMode === "monthly" ? "Voltar Comparativo" : "Mês a Mês"}
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main className="dash-content" style={{ maxWidth: 1200, margin: "0 auto" }}>
          {isLoading ? (
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 20px" }}>
              <Loader2 className="animate-spin text-gold" style={{ width: 32, height: 32 }} />
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Carregando dados do DRE...</span>
            </div>
          ) : viewMode === "monthly" ? (
            /* ═══ VISÃO MÊS A MÊS ═══ */
            <>
            <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 900 }}>
                  <colgroup>
                    <col style={{ width: "15%" }} />
                    {MONTHS.map((_, i) => <col key={i} style={{ width: `${85/12}%` }} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "4px 6px", fontSize: "0.68rem" }}>P&L — {filterYear}</th>
                      {MONTHS.map((m, i) => (
                        <th key={i} style={{
                          textAlign: "center",
                          padding: "4px 5px",
                          fontSize: "0.65rem",
                          borderLeft: "1px solid var(--border)",
                          background: i === filterMonth - 1 ? "rgba(184,134,11,0.12)" : "transparent",
                          color: i === filterMonth - 1 ? "var(--accent-gold)" : undefined,
                          fontWeight: i === filterMonth - 1 ? 700 : undefined,
                        }}>
                          {m.slice(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((row, ri) => {
                      const rowBg = row.isHighlight ? "rgba(128,128,128,0.1)" : "transparent";
                      const rowStyle: React.CSSProperties = {
                        fontWeight: row.isBold ? 700 : 400,
                        background: rowBg,
                        ...(row.isBold ? { borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" } : {}),
                      };
                      return (
                        <tr key={ri} style={rowStyle}>
                          <td style={{ textAlign: "left", fontWeight: row.isBold ? 700 : 400, padding: "3px 6px", whiteSpace: "nowrap" }}>
                            {row.label}
                          </td>
                          {(row.months || []).map((val: number, mi: number) => (
                            <td key={mi} style={{
                              textAlign: "center",
                              padding: "3px 5px",
                              borderLeft: "1px solid var(--border)",
                              fontWeight: row.isBold ? 700 : 400,
                              background: mi === filterMonth - 1 ? "rgba(184,134,11,0.06)" : undefined,
                              color: val < 0 ? "#dc143c" : undefined,
                            }}>
                              {fmtVal(val)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Indicadores Unitários — Mensal */}
            <div className="glass-card" style={{ overflow: "hidden", padding: 0, marginTop: 10 }}>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 900 }}>
                  <colgroup>
                    <col style={{ width: "15%" }} />
                    {MONTHS.map((_, i) => <col key={i} style={{ width: `${85/12}%` }} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "4px 6px", fontSize: "0.68rem" }}>Indicadores — {filterYear}</th>
                      {MONTHS.map((m, i) => (
                        <th key={i} style={{
                          textAlign: "center",
                          padding: "4px 5px",
                          fontSize: "0.65rem",
                          borderLeft: "1px solid var(--border)",
                          background: i === filterMonth - 1 ? "rgba(184,134,11,0.12)" : "transparent",
                          color: i === filterMonth - 1 ? "var(--accent-gold)" : undefined,
                          fontWeight: i === filterMonth - 1 ? 700 : undefined,
                        }}>
                          {m.slice(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyUnitRows.map((row, ri) => {
                      const rowStyle: React.CSSProperties = row.isBold
                        ? { fontWeight: 700, background: "rgba(128,128,128,0.1)", borderTop: "1px solid var(--border)" }
                        : {};
                      const display = row.isPercent
                        ? (v: number) => `${v.toFixed(1)}%`
                        : (v: number) => v.toFixed(2).replace(".", ",");
                      return (
                        <tr key={ri} style={rowStyle}>
                          <td style={{ textAlign: "left", fontWeight: row.isBold ? 700 : 400, padding: "3px 6px", whiteSpace: "nowrap" }}>
                            {row.label}
                          </td>
                          {(row.months || []).map((val: number, mi: number) => (
                            <td key={mi} style={{
                              textAlign: "center",
                              padding: "3px 5px",
                              borderLeft: "1px solid var(--border)",
                              fontWeight: row.isBold ? 700 : 400,
                              background: mi === filterMonth - 1 ? "rgba(184,134,11,0.06)" : undefined,
                              color: val < 0 ? "#dc143c" : undefined,
                            }}>
                              {display(val)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          ) : (
            <>
              {/* ═══ DRE COMPARATIVO ═══ */}
              <div className="glass-card" style={{ overflow: "hidden", marginBottom: 10, padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
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
                      {(dreRows || []).map((row, i) => {
                        const dBud = delta(row.actual, row.budget);
                        const pBud = pctDelta(row.actual, row.budget);
                        const dMonth = delta(row.actual, row.prevMonth);
                        const pMonth = pctDelta(row.actual, row.prevMonth);
                        const dYear = delta(row.actual, row.prevYear);
                        const pYear = pctDelta(row.actual, row.prevYear);
                        const rowBg = row.isHighlight ? "rgba(128,128,128,0.1)" : "transparent";
                        const rowStyle: React.CSSProperties = {
                          fontWeight: row.isBold ? 700 : 400,
                          background: rowBg,
                          ...(row.isBold ? { borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" } : {}),
                        };
                        const bL = "2px solid var(--border)";
                        return (
                          <tr key={i} style={rowStyle}>
                            <td style={{ textAlign: "left", fontWeight: row.isBold ? 700 : 400, padding: "3px 6px", whiteSpace: "nowrap" }}>{row.label}</td>
                            <td style={{ textAlign: "center", fontWeight: row.isBold ? 700 : 500, padding: "3px 6px", borderLeft: bL }}>{fmtVal(row.actual)}</td>
                            <td style={{ textAlign: "center", color: "var(--foreground-secondary)", padding: "3px 6px", borderLeft: bL }}>{fmtVal(row.budget)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(dBud).bg, color: deltaColor(dBud).color, fontWeight: 600, padding: "3px 6px" }}>{fmtVal(dBud)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(pBud).bg, color: deltaColor(pBud).color, fontWeight: 600, padding: "3px 6px" }}>{fmtPct(pBud)}</td>
                            <td style={{ textAlign: "center", color: "var(--foreground-secondary)", padding: "3px 6px", borderLeft: bL }}>{fmtVal(row.prevMonth)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(dMonth).bg, color: deltaColor(dMonth).color, fontWeight: 600, padding: "3px 6px" }}>{fmtVal(dMonth)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(pMonth).bg, color: deltaColor(pMonth).color, fontWeight: 600, padding: "3px 6px" }}>{fmtPct(pMonth)}</td>
                            <td style={{ textAlign: "center", color: "var(--foreground-secondary)", padding: "3px 6px", borderLeft: bL }}>{fmtVal(row.prevYear)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(dYear).bg, color: deltaColor(dYear).color, fontWeight: 600, padding: "3px 6px" }}>{fmtVal(dYear)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(pYear).bg, color: deltaColor(pYear).color, fontWeight: 600, padding: "3px 6px" }}>{fmtPct(pYear)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ═══ INDICADORES UNITÁRIOS ═══ */}
              <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
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
                        <th style={{ textAlign: "left", padding: "4px 6px", fontSize: "0.68rem" }}>Indicadores</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem", borderLeft: "2px solid var(--border)" }}>Atual</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem", borderLeft: "2px solid var(--border)" }}>Forecast</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem" }}>%Δ</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem", borderLeft: "2px solid var(--border)" }}>Mês Ant.</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem" }}>%Δ</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem", borderLeft: "2px solid var(--border)" }}>Ano Ant.</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem" }}>Δ</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "0.68rem" }}>%Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(unitRows || []).map((row, i) => {
                        const dBud = delta(row.actual, row.budget);
                        const pBud = pctDelta(row.actual, row.budget);
                        const dMonth = delta(row.actual, row.prevMonth);
                        const pMonth = pctDelta(row.actual, row.prevMonth);
                        const dYear = delta(row.actual, row.prevYear);
                        const pYear = pctDelta(row.actual, row.prevYear);
                        const display = row.isPercent
                          ? (v: number) => `${v.toFixed(1)}%`
                          : (v: number) => fmtUnit(v);
                        const rowStyle: React.CSSProperties = row.isBold
                          ? { fontWeight: 700, background: "rgba(128,128,128,0.1)", borderTop: "1px solid var(--border)" }
                          : {};
                        const bL = "2px solid var(--border)";
                        return (
                          <tr key={i} style={rowStyle}>
                            <td style={{ textAlign: "left", fontWeight: row.isBold ? 700 : 400, padding: "3px 6px", whiteSpace: "nowrap" }}>{row.label}</td>
                            <td style={{ textAlign: "center", fontWeight: row.isBold ? 700 : 500, padding: "3px 6px", borderLeft: bL }}>{display(row.actual)}</td>
                            <td style={{ textAlign: "center", color: "var(--foreground-secondary)", padding: "3px 6px", borderLeft: bL }}>{display(row.budget)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(dBud).bg, color: deltaColor(dBud).color, fontWeight: 600, padding: "3px 6px" }}>{display(dBud)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(pBud).bg, color: deltaColor(pBud).color, fontWeight: 600, padding: "3px 6px" }}>{fmtPct(pBud)}</td>
                            <td style={{ textAlign: "center", color: "var(--foreground-secondary)", padding: "3px 6px", borderLeft: bL }}>{display(row.prevMonth)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(dMonth).bg, color: deltaColor(dMonth).color, fontWeight: 600, padding: "3px 6px" }}>{display(dMonth)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(pMonth).bg, color: deltaColor(pMonth).color, fontWeight: 600, padding: "3px 6px" }}>{fmtPct(pMonth)}</td>
                            <td style={{ textAlign: "center", color: "var(--foreground-secondary)", padding: "3px 6px", borderLeft: bL }}>{display(row.prevYear)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(dYear).bg, color: deltaColor(dYear).color, fontWeight: 600, padding: "3px 6px" }}>{display(dYear)}</td>
                            <td style={{ textAlign: "center", background: deltaColor(pYear).bg, color: deltaColor(pYear).color, fontWeight: 600, padding: "3px 6px" }}>{fmtPct(pYear)}</td>
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

      {/* BOTTOM TAB BAR */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Rede</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <Link href="/atendimento" className="bottom-tab"><Users className="bottom-tab-icon" /> Atendimento</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
