"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Filter, BarChart3, Upload, Home, DollarSign, History, Users, TrendingUp, Target, CalendarDays, Calendar, Package, CheckCircle2, Loader2, Lock, ShieldAlert } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { SearchableSelect } from "@/components/SearchableSelect";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2026, 2025, 2024, 2023];

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
}

export default function DREHistoricoAnualPage() {
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

  const [monthlyRows, setMonthlyRows] = useState<any[]>([]);
  const [monthlyUnitRows, setMonthlyUnitRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync DRE filters with localStorage
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

  // Buscar opções de filtro do dashboard
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/filters?year=${filterYear}&month=${filterMonth}`);
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) { console.error(e); }
  }, [filterYear, filterMonth]);

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
        setMonthlyRows(json.monthlyRows);
        setMonthlyUnitRows(json.monthlyUnitRows);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do DRE:", e);
    } finally {
      setIsLoading(false);
    }
  }, [filterYear, filterMonth, filterManager, filterFamilia, filterUf, filterChannel, filterProduct]);

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
    if (v === 0 || isNaN(v) || !isFinite(v)) return "0";
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return v < 0 ? `(${formatted})` : formatted;
  };

  const fmtUnit = (v: number) => {
    if (v === 0 || isNaN(v) || !isFinite(v)) return "0,00";
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${formatted})` : formatted;
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
          <Link href="/dre" className="cm-nav-link">Consolidado</Link>
          <Link href="/dre/historico" className="cm-nav-link active">Mês a Mês</Link>
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
          <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Exercício</p>
          <select title="Ano" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="dash-filter-select">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

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
                DRE — Mês a Mês ({filterYear})
              </h2>
              <p style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", margin: "2px 0 0 0" }}>
                *Valores absolutos em R$ Mil / Volume em Toneladas
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 20px" }}>
              <Loader2 className="animate-spin text-gold" style={{ width: 32, height: 32 }} />
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Carregando histórico do DRE...</span>
            </div>
          ) : (
            <>
              {/* Tabela P&L Mês a Mês */}
              <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 980 }}>
                    <colgroup>
                      <col style={{ width: "15%" }} />
                      {MONTHS.map((_, i) => <col key={i} style={{ width: `${77/12}%` }} />)}
                      <col style={{ width: "8%" }} />
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
                        <th style={{
                          textAlign: "center",
                          padding: "4px 5px",
                          fontSize: "0.65rem",
                          borderLeft: "2px solid var(--border)",
                          background: "rgba(128,128,128,0.12)",
                          color: "var(--accent-gold)",
                          fontWeight: 700,
                        }}>
                          ACUM
                        </th>
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
                            <td style={{
                              textAlign: "center",
                              padding: "3px 5px",
                              borderLeft: "2px solid var(--border)",
                              fontWeight: 700,
                              background: "rgba(128,128,128,0.06)",
                              color: row.acum < 0 ? "#dc143c" : undefined,
                            }}>
                              {fmtVal(row.acum || 0)}
                            </td>
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
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 980 }}>
                    <colgroup>
                      <col style={{ width: "15%" }} />
                      {MONTHS.map((_, i) => <col key={i} style={{ width: `${77/12}%` }} />)}
                      <col style={{ width: "8%" }} />
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
                        <th style={{
                          textAlign: "center",
                          padding: "4px 5px",
                          fontSize: "0.65rem",
                          borderLeft: "2px solid var(--border)",
                          background: "rgba(128,128,128,0.12)",
                          color: "var(--accent-gold)",
                          fontWeight: 700,
                        }}>
                          ACUM
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyUnitRows.map((row, ri) => {
                        const rowStyle: React.CSSProperties = row.isBold
                          ? { fontWeight: 700, background: "rgba(128,128,128,0.1)", borderTop: "1px solid var(--border)" }
                          : {};
                        const display = row.isPercent
                          ? (v: number) => (v === undefined || v === null || isNaN(v) ? "0.0%" : `${v.toFixed(1)}%`)
                          : (v: number) => (v === undefined || v === null || isNaN(v) ? "0,00" : fmtUnit(v));
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
                            <td style={{
                              textAlign: "center",
                              padding: "3px 5px",
                              borderLeft: "2px solid var(--border)",
                              fontWeight: 700,
                              background: "rgba(128,128,128,0.06)",
                              color: row.acum < 0 ? "#dc143c" : undefined,
                            }}>
                              {display(row.acum || 0)}
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
