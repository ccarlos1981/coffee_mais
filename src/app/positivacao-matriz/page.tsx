"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import { Filter, Home, DollarSign,
  Users, Target, Upload, CheckCircle2, TrendingUp, Calendar, BarChart3, Package } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { formatNumber } from "@/lib/formatters";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const YEARS = [2026, 2025, 2024, 2023, 2022];

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
  matrizes: string[];
}

// Escala de cor: verde degradê
function getHeatColor(value: number, max: number): string {
  if (value === 0) return 'transparent';
  const intensity = Math.min(value / Math.max(max, 1), 1);
  const r = Math.round(220 - intensity * 180);
  const g = Math.round(245 - intensity * 80);
  const b = Math.round(220 - intensity * 180);
  return `rgb(${r}, ${g}, ${b})`;
}

function getRowHeatColor(value: number, max: number, worst: number, secondWorst: number): string {
  if (value === 0) return 'transparent';
  if (value === worst) return 'rgba(220, 38, 38, 0.32)';
  if (value === secondWorst) return 'rgba(234, 179, 8, 0.35)';
  return getHeatColor(value, max);
}

export default function PositivacaoMatrizPage() {
  const [loading, setLoading] = useState(true);

  // Período default: 13 meses, acabando no mês anterior
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

  const [totals, setTotals] = useState({ matrizes: 0, clientes: 0, meses: 0 });
  const fetchRequestIdRef = useRef(0);

  interface HeatmapRow {
    name: string;
    months: Record<string, number>;
  }

  const [byMatriz, setByMatriz] = useState<HeatmapRow[]>([]);
  const [byCliente, setByCliente] = useState<HeatmapRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  // Paginação
  const [matrizPage, setMatrizPage] = useState(1);
  const [clientePage, setClientePage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchFilters = useCallback(async () => {
    const stD = new Date(filterStartYear, filterStartMonth - 1, 1);
    const startDateStr = stD.toISOString().split("T")[0];
    const enD = new Date(filterEndYear, filterEndMonth, 0);
    const endDateStr = enD.toISOString().split("T")[0];
    try {
      const res = await fetch(`/api/dashboard/filters?startDate=${startDateStr}&endDate=${endDateStr}`);
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) { console.error(e); }
  }, [filterStartYear, filterStartMonth, filterEndYear, filterEndMonth]);

  const fetchData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    const stD = new Date(filterStartYear, filterStartMonth - 1, 1);
    const startDate = stD.toISOString().split("T")[0];
    const enD = new Date(filterEndYear, filterEndMonth, 0);
    const endDate = enD.toISOString().split("T")[0];

    const params = new URLSearchParams({ startDate, endDate });
    if (filterManager.length > 0) params.set("manager", filterManager.join(","));
    if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));
    if (filterUf.length > 0) params.set("uf", filterUf.join(","));
    if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
    if (filterProduct.length > 0) params.set("product", filterProduct.join(","));
    if (filterMatriz.length > 0) params.set("matriz", filterMatriz.join(","));

    try {
      const res = await fetch(`/api/dashboard/positivacao-matriz?${params}`);
      const json = await res.json();
      if (requestId !== fetchRequestIdRef.current) return;
      if (json.success) {
        setTotals(json.totals || { matrizes: 0, clientes: 0, meses: 0 });
        setByMatriz(json.byMatriz || []);
        setByCliente(json.byCliente || []);
        setMonths(json.months || []);
        setMatrizPage(1);
        setClientePage(1);
      }
    } catch(e) {
      if (requestId === fetchRequestIdRef.current) {
        console.error(e);
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
    setFilterManager([]); setFilterFamilia([]); setFilterUf([]);
    setFilterChannel([]); setFilterProduct([]); setFilterMatriz([]);
  };

  const hasActiveFilters = filterManager.length > 0 || filterFamilia.length > 0 || filterUf.length > 0 || filterChannel.length > 0 || filterProduct.length > 0 || filterMatriz.length > 0;
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length;

  // Meses ordenados (antigo → recente)
  const orderedMonths = months;

  // Max values para heatmap
  const maxMatrizHeat = byMatriz.reduce((max, row) => {
    const vals = Object.values(row.months as Record<string, number>);
    return Math.max(max, ...vals);
  }, 0);
  const maxClienteHeat = byCliente.reduce((max, row) => {
    const vals = Object.values(row.months as Record<string, number>);
    return Math.max(max, ...vals);
  }, 0);

  // Paginação
  const matrizTotalPages = Math.ceil(byMatriz.length / ITEMS_PER_PAGE);
  const clienteTotalPages = Math.ceil(byCliente.length / ITEMS_PER_PAGE);
  const matrizPageData = byMatriz.slice((matrizPage - 1) * ITEMS_PER_PAGE, matrizPage * ITEMS_PER_PAGE);
  const clientePageData = byCliente.slice((clientePage - 1) * ITEMS_PER_PAGE, clientePage * ITEMS_PER_PAGE);

  // Componente de batalha naval reutilizável
  const renderBatalhaNaval = (
    title: string,
    subtitle: string,
    data: HeatmapRow[],
    maxHeat: number,
    page: number,
    totalPages: number,
    totalItems: number,
    onPrev: () => void,
    onNext: () => void
  ) => (
    <div className="glass-card" style={{ padding: 0, marginBottom: 14, minWidth: 0 }}>
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)" }}>{title}</h3>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.65rem" }}>
          <span style={{ color: "var(--foreground-muted)" }}>{totalItems} itens • Pág. {page} de {totalPages || 1}</span>
          <button onClick={onPrev} disabled={page <= 1} style={{ padding: "3px 8px", fontSize: "0.65rem", border: "1px solid var(--border)", borderRadius: 4, background: page <= 1 ? "var(--border)" : "var(--background)", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>← Ant</button>
          <button onClick={onNext} disabled={page >= totalPages} style={{ padding: "3px 8px", fontSize: "0.65rem", border: "1px solid var(--border)", borderRadius: 4, background: page >= totalPages ? "var(--border)" : "var(--background)", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>Próx →</button>
        </div>
      </div>
      <div style={{ overflowX: "auto", overflowY: "auto" }}>
        <table style={{ fontSize: "0.65rem", borderCollapse: "collapse", width: "100%", whiteSpace: "nowrap" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--card-bg, #fff)", zIndex: 1 }}>
            <tr>
              <th style={{ textAlign: "center", padding: "6px 4px", width: 36, fontSize: "0.6rem" }}>#</th>
              <th style={{ textAlign: "left", padding: "8px 10px", position: "sticky", left: 0, background: "var(--card-bg, #fff)", zIndex: 2, minWidth: 180, borderRight: "2px solid var(--border)" }}>
                {title.includes("Matriz") ? "Matriz" : "Cliente"}
              </th>
              {orderedMonths.map(m => {
                const [_y, _mm] = m.split("-");
                return (
                  <th key={m} style={{ textAlign: "center", padding: "6px 4px", minWidth: 42, fontSize: "0.6rem", fontWeight: 600, borderLeft: "1px dashed rgba(0,0,0,0.08)" }}>
                    {MONTHS[parseInt(_mm)-1].slice(0,3)}<br/><span style={{ fontWeight: 400, opacity: 0.6 }}>{_y.slice(2)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={orderedMonths.length + 2} style={{ padding: 16, textAlign: "center", color: "var(--foreground-muted)" }}>Nenhum dado encontrado</td></tr>
            ) : (
              data.map((row, i) => {
                const rowValues = orderedMonths.map(m => row.months[m] || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
                const worst = rowValues.length > 0 ? rowValues[0] : 0;
                const secondWorst = rowValues.length > 1 ? rowValues[1] : -1;
                const rank = (page - 1) * ITEMS_PER_PAGE + i + 1;

                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ textAlign: "center", padding: "5px 4px", fontSize: "0.6rem", color: "var(--foreground-muted)", fontWeight: 600 }}>{rank}</td>
                    <td style={{
                      textAlign: "left", padding: "5px 10px", fontWeight: 500, fontSize: "0.63rem",
                      position: "sticky", left: 0, background: "var(--card-bg, #fff)", zIndex: 1,
                      borderRight: "2px solid var(--border)",
                      maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis"
                    }}>
                      {row.name}
                    </td>
                    {orderedMonths.map(m => {
                      const val = row.months[m] || 0;
                      return (
                        <td key={m} style={{
                          textAlign: "center", padding: "4px 2px",
                          background: getRowHeatColor(val, maxHeat, worst, secondWorst),
                          color: val > 0 ? '#1f2937' : 'var(--foreground-muted)',
                          fontWeight: val > 0 ? 700 : 400,
                          fontSize: "0.65rem",
                          borderLeft: "1px dashed rgba(0,0,0,0.05)",
                          transition: "background 0.2s"
                        }}>
                          {val > 0 ? val : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "70px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            POSITIVAÇÃO POR MATRIZ
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            {MONTHS[filterStartMonth - 1]}/{filterStartYear} a {MONTHS[filterEndMonth - 1]}/{filterEndYear}
          </p>
        </div>
        <div className="cm-nav-right"><ThemeToggle /></div>
      </nav>

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

          <p className="dash-sidebar-title">Matriz</p>
          <MultiSelect value={filterMatriz} onChange={setFilterMatriz} options={filterOptions.matrizes} className="dash-filter-select" placeholder="Todas" />

          <p className="dash-sidebar-title">Linha SKU</p>
          <MultiSelect value={filterProduct} onChange={setFilterProduct} options={filterOptions.products} className="dash-filter-select" placeholder="Todos" />

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="cm-btn-clear" style={{ marginTop: 12 }}>
              <Filter style={{ width: 11, height: 11 }} /> Limpar Filtros ({activeFilterCount})
            </button>
          )}
        </aside>

        {/* MAIN */}
        <main className="cm-main" style={{ paddingTop: 4 }}>
          {loading && <div style={{ position: "absolute", right: 16, top: 8, width: 12, height: 12, border: "2px solid var(--accent-gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}

          {/* KPI CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Matrizes</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#3f51b5" }}>{formatNumber(totals.matrizes, 0)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Clientes</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatNumber(totals.clientes, 0)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Meses no Período</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--foreground)" }}>{totals.meses}</p>
            </div>
          </div>

          {/* BATALHA NAVAL POR MATRIZ */}
          {renderBatalhaNaval(
            "Positivação por Matriz",
            "Quantos SKUs distintos foram vendidos em cada matriz por mês",
            matrizPageData,
            maxMatrizHeat,
            matrizPage,
            matrizTotalPages,
            byMatriz.length,
            () => setMatrizPage(p => Math.max(1, p - 1)),
            () => setMatrizPage(p => Math.min(matrizTotalPages, p + 1))
          )}

          {/* BATALHA NAVAL POR CLIENTE */}
          {renderBatalhaNaval(
            "Positivação por Cliente",
            "Quantos SKUs distintos cada cliente comprou por mês",
            clientePageData,
            maxClienteHeat,
            clientePage,
            clienteTotalPages,
            byCliente.length,
            () => setClientePage(p => Math.max(1, p - 1)),
            () => setClientePage(p => Math.min(clienteTotalPages, p + 1))
          )}
        </main>
      </div>

      {/* BOTTOM TAB BAR */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Matriz</Link>
        <Link href="/historico-por-matriz" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Matriz</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/positivacao-matriz" className="bottom-tab active"><CheckCircle2 className="bottom-tab-icon" /> Pos.Matriz</Link>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
