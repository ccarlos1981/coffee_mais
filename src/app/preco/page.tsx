"use client";

import { useState, useEffect, useCallback, useMemo, Fragment, useRef } from "react";
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
  Calendar,
  ChevronRight, Package } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";
import { SkeletonTable } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
  matrizes: string[];
}

interface PrecoChannelRow {
  channel: string;
  totalQty: number;
  totalFat: number;
  avgPrice: number;
  monthPrices: Record<number, number>;
}

interface PrecoFamilyRow {
  channel: string;
  family: string;
  totalQty: number;
  totalFat: number;
  avgPrice: number;
  monthPrices: Record<number, number>;
}

interface PrecoMatrizFamilyRow {
  matriz: string;
  family: string;
  totalQty: number;
  totalFat: number;
  avgPrice: number;
  monthPrices: Record<number, number>;
}

interface PrecoRow {
  matriz: string;
  totalQty: number;
  totalFat: number;
  avgPrice: number;
  monthPrices: Record<number, number>;
}

const MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2026, 2025, 2024, 2023];

export default function PrecoDashboardPage() {
  const [loading, setLoading] = useState(true);
  const fetchRequestIdRef = useRef(0);

  // Filter States (persisted and synced)
  const [filterYear, setFilterYear] = useState<number>(2026);
  const [filterManager, setFilterManager] = usePersistedState<string[]>("db_filter_manager", []);
  const [filterFamilia, setFilterFamilia] = usePersistedState<string[]>("db_filter_familia", []);
  const [filterUf, setFilterUf] = usePersistedState<string[]>("db_filter_uf", []);
  const [filterChannel, setFilterChannel] = usePersistedState<string[]>("db_filter_channel", []);
  const [filterProduct, setFilterProduct] = usePersistedState<string[]>("db_filter_product", []);
  const [filterMatriz, setFilterMatriz] = usePersistedState<string[]>("db_filter_matriz", []);

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [], matrizes: []
  });

  const [channelsData, setChannelsData] = useState<PrecoChannelRow[]>([]);
  const [matrizesData, setMatrizesData] = useState<PrecoRow[]>([]);
  const [familiesData, setFamiliesData] = useState<PrecoFamilyRow[]>([]);
  const [matrizFamiliesData, setMatrizFamiliesData] = useState<PrecoMatrizFamilyRow[]>([]);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [expandedMatriz, setExpandedMatriz] = useState<string | null>(null);

  // Fetch filter options
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/filters`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) {
      console.error("[Preço] Error fetching filter options:", e);
    }
  }, []);

  // Fetch price matrix data
  const fetchData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    params.set("year", String(filterYear));
    if (filterManager.length > 0) params.set("manager", filterManager.join(","));
    if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));
    if (filterUf.length > 0) params.set("uf", filterUf.join(","));
    if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
    if (filterProduct.length > 0) params.set("product", filterProduct.join(","));
    if (filterMatriz.length > 0) params.set("matriz", filterMatriz.join(","));

    try {
      const res = await fetch(`/api/dashboard/preco-matriz?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (requestId !== fetchRequestIdRef.current) return;
      if (json.success) {
        setChannelsData(json.channels || []);
        setMatrizesData(json.matrizes || []);
        setFamiliesData(json.families || []);
        setMatrizFamiliesData(json.matrizFamilies || []);
        setExpandedChannel(null);
        setExpandedMatriz(null);
      }
    } catch (e) {
      if (requestId === fetchRequestIdRef.current) {
        console.error("[Preço] Error fetching matrix data:", e);
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filterYear, filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz]);

  useEffect(() => { Promise.resolve().then(() => fetchFilters()); }, [fetchFilters]);
  useEffect(() => { Promise.resolve().then(() => fetchData()); }, [fetchData]);

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
    setFilterMatriz([]);
    setFilterYear(2026);
  };

  const hasActiveFilters = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].some(f => f.length > 0) || filterYear !== 2026;
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length + (filterYear !== 2026 ? 1 : 0);

  // Column headers logic
  const channelHeaders = useMemo(() => {
    return ["Canal", "Fat. Acumulado", ...MONTHS_SHORT, "Média"];
  }, []);

  const matrizHeaders = useMemo(() => {
    return ["Matriz", "Fat. Acumulado", ...MONTHS_SHORT, "Média"];
  }, []);

  // Compute column averages for channels
  const channelAverages = useMemo(() => {
    const monthAverages: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      const validPrices = channelsData
        .map(row => row.monthPrices[m])
        .filter((p): p is number => p !== undefined && p !== null && p > 0);

      monthAverages[m] = validPrices.length > 0
        ? validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length
        : 0;
    }

    const validAvgPrices = channelsData
      .map(row => row.avgPrice)
      .filter((p): p is number => p !== undefined && p !== null && p > 0);

    const totalAvg = validAvgPrices.length > 0
      ? validAvgPrices.reduce((sum, p) => sum + p, 0) / validAvgPrices.length
      : 0;

    const totalFatSum = channelsData.reduce((sum, row) => sum + (row.totalFat || 0), 0);

    return {
      monthAverages,
      totalAvg,
      totalFatSum
    };
  }, [channelsData]);

  // Compute column averages for matrizes
  const matrizAverages = useMemo(() => {
    const monthAverages: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      const validPrices = matrizesData
        .map(row => row.monthPrices[m])
        .filter((p): p is number => p !== undefined && p !== null && p > 0);

      monthAverages[m] = validPrices.length > 0
        ? validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length
        : 0;
    }

    const validAvgPrices = matrizesData
      .map(row => row.avgPrice)
      .filter((p): p is number => p !== undefined && p !== null && p > 0);

    const totalAvg = validAvgPrices.length > 0
      ? validAvgPrices.reduce((sum, p) => sum + p, 0) / validAvgPrices.length
      : 0;

    const totalFatSum = matrizesData.reduce((sum, row) => sum + (row.totalFat || 0), 0);

    return {
      monthAverages,
      totalAvg,
      totalFatSum
    };
  }, [matrizesData]);

  // Regra de cores por linha
  const getCellHighlight = useCallback((val: number | null | undefined, rowPrices: number[]) => {
    if (val === null || val === undefined || val <= 0) return {};

    const uniquePrices = Array.from(new Set(rowPrices)).sort((a, b) => a - b);
    if (uniquePrices.length === 0) return {};

    if (uniquePrices.length === 1) {
      if (val === uniquePrices[0]) {
        // Apenas 1 valor: considera verde (maior)
        return {
          style: { backgroundColor: "#16a34a", color: "#ffffff", fontWeight: "600" }
        };
      }
      return {};
    }

    const min = uniquePrices[0];
    const secondMin = uniquePrices[1];
    const max = uniquePrices[uniquePrices.length - 1];

    if (val === min) {
      return {
        style: { backgroundColor: "#dc2626", color: "#ffffff", fontWeight: "600" }
      };
    }
    if (val === secondMin && uniquePrices.length >= 3) {
      return {
        style: { backgroundColor: "#f87171", color: "#ffffff", fontWeight: "600" }
      };
    }
    if (val === max) {
      return {
        style: { backgroundColor: "#16a34a", color: "#ffffff", fontWeight: "600" }
      };
    }

    return {};
  }, []);

  // Format data for the ExportButton
  const exportData = useMemo(() => {
    const rows: Record<string, any>[] = [];

    // 1. Consolidado por Canal
    rows.push({ "Matriz": "CONSOLIDADO POR CANAL" });
    channelsData.forEach(row => {
      const exportRow: Record<string, any> = {
        "Matriz": row.channel,
        "Faturamento Acumulado": row.totalFat || 0,
      };
      for (let m = 1; m <= 12; m++) {
        const val = row.monthPrices[m];
        exportRow[MONTHS_FULL[m - 1]] = val !== undefined && val !== null && val > 0 ? val : "";
      }
      exportRow["Média Anual"] = row.avgPrice !== undefined && row.avgPrice !== null && row.avgPrice > 0 ? row.avgPrice : "";
      rows.push(exportRow);

      // Add families for this channel
      const channelFamilies = familiesData
        .filter(f => f.channel === row.channel)
        .sort((a, b) => b.totalQty - a.totalQty);

      channelFamilies.forEach(fam => {
        const exportFamRow: Record<string, any> = {
          "Matriz": `  — ${fam.family}`,
          "Faturamento Acumulado": fam.totalFat || 0,
        };
        for (let m = 1; m <= 12; m++) {
          const val = fam.monthPrices[m];
          exportFamRow[MONTHS_FULL[m - 1]] = val !== undefined && val !== null && val > 0 ? val : "";
        }
        exportFamRow["Média Anual"] = fam.avgPrice !== undefined && fam.avgPrice !== null && fam.avgPrice > 0 ? fam.avgPrice : "";
        rows.push(exportFamRow);
      });
    });

    // Separator
    rows.push({});

    // 2. Preço por Matriz
    rows.push({ "Matriz": "PREÇO POR MATRIZ" });
    matrizesData.forEach(row => {
      const exportRow: Record<string, any> = {
        "Matriz": row.matriz,
        "Faturamento Acumulado": row.totalFat || 0,
      };
      for (let m = 1; m <= 12; m++) {
        const val = row.monthPrices[m];
        exportRow[MONTHS_FULL[m - 1]] = val !== undefined && val !== null && val > 0 ? val : "";
      }
      exportRow["Média Anual"] = row.avgPrice !== undefined && row.avgPrice !== null && row.avgPrice > 0 ? row.avgPrice : "";
      rows.push(exportRow);

      // Add families for this matriz
      const matrizFamilies = matrizFamiliesData
        .filter(f => f.matriz === row.matriz)
        .sort((a, b) => b.totalQty - a.totalQty);

      matrizFamilies.forEach(fam => {
        const exportFamRow: Record<string, any> = {
          "Matriz": `  — ${fam.family}`,
          "Faturamento Acumulado": fam.totalFat || 0,
        };
        for (let m = 1; m <= 12; m++) {
          const val = fam.monthPrices[m];
          exportFamRow[MONTHS_FULL[m - 1]] = val !== undefined && val !== null && val > 0 ? val : "";
        }
        exportFamRow["Média Anual"] = fam.avgPrice !== undefined && fam.avgPrice !== null && fam.avgPrice > 0 ? fam.avgPrice : "";
        rows.push(exportFamRow);
      });
    });

    return rows;
  }, [channelsData, matrizesData, familiesData, matrizFamiliesData]);

  const hasData = channelsData.length > 0 || matrizesData.length > 0;

  const getColStyle = (name: string) => {
    if (name === "Matriz" || name === "Canal") {
      return { minWidth: "200px" };
    }
    if (name === "Fat. Acumulado") {
      return { width: "120px", minWidth: "120px", maxWidth: "120px" };
    }
    if (name === "Média") {
      return { width: "80px", minWidth: "80px", maxWidth: "80px" };
    }
    return { width: "65px", minWidth: "65px", maxWidth: "65px" };
  };

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
            Histórico de Preço
          </h1>
          <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            Análise R$/Unidade por Matriz — Ano Selecionado: {filterYear}
          </p>
        </div>

        <div className="cm-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportButton data={exportData} filename={`Historico_Preco_Matriz_${filterYear}`} />
          <ThemeToggle />
        </div>
      </nav>

      {/* BODY */}
      <div className="dash-body">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0, marginBottom: 4 }}>Ano</p>
          <select 
            title="Ano" 
            value={filterYear} 
            onChange={(e) => setFilterYear(Number(e.target.value))} 
            className="dash-filter-select"
            style={{ marginBottom: 12 }}
          >
            {YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>

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
              {filterYear !== 2026 && <div>Ano: <strong style={{color:"var(--foreground)"}}>{filterYear}</strong></div>}
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
              <SkeletonTable />
            </div>
          ) : !hasData ? (
            <div style={{ padding: "20px 0" }}>
              <EmptyState 
                title="Sem histórico para o período" 
                message="Nenhum preço ou venda registrada com os filtros selecionados para este ano. Tente remover alguns filtros." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
              
              {/* 1. CONSOLIDADO POR CANAL */}
              <div className="glass-card animate-fade-in" style={{ padding: "16px 20px", overflow: "hidden" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-gold)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Consolidado por Canal
                </h3>
                <div style={{ overflowX: "auto", position: "relative" }}>
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "separate", width: "100%", minWidth: "1180px", tableLayout: "fixed" }}>
                    <thead>
                      <tr>
                        {channelHeaders.map((h, i) => {
                          const isChannel = h === "Canal";
                          return (
                            <th 
                              key={i} 
                              style={{ 
                                ...getColStyle(h),
                                position: "sticky", 
                                top: 0, 
                                zIndex: isChannel ? 3 : 2, 
                                textAlign: isChannel ? "left" : "center",
                                background: "var(--table-header-bg)",
                                borderBottom: "1px solid var(--border-light)",
                                padding: "8px 10px",
                                left: isChannel ? 0 : undefined,
                                boxShadow: isChannel ? "2px 0 0 rgba(0,0,0,0.1)" : undefined
                              }}
                            >
                              {h}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {channelsData.map((row, idx) => {
                        const rowPrices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                          .map(m => row.monthPrices[m])
                          .filter((p): p is number => p !== undefined && p !== null && p > 0);

                        const isExpanded = expandedChannel === row.channel;
                        const channelFamilies = familiesData
                          .filter(f => f.channel === row.channel)
                          .sort((a, b) => b.totalQty - a.totalQty);

                        return (
                          <Fragment key={row.channel}>
                            <tr className="hover:bg-foreground/5 transition-colors">
                              {/* Sticky first column */}
                              <td 
                                onClick={() => setExpandedChannel(isExpanded ? null : row.channel)}
                                style={{ 
                                  ...getColStyle("Canal"),
                                  position: "sticky", 
                                  left: 0, 
                                  zIndex: 1, 
                                  textAlign: "left", 
                                  fontWeight: 600,
                                  background: "var(--table-row-odd)",
                                  borderRight: "1px solid var(--border)",
                                  boxShadow: "2px 0 0 rgba(0,0,0,0.05)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  cursor: "pointer"
                                }}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <ChevronRight style={{
                                    width: 12,
                                    height: 12,
                                    color: "var(--foreground-muted)",
                                    transition: "transform 0.2s",
                                    transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                                    flexShrink: 0
                                  }} />
                                  {row.channel}
                                </span>
                              </td>
                              {/* Faturamento Acumulado */}
                              <td 
                                style={{ 
                                  ...getColStyle("Fat. Acumulado"),
                                  textAlign: "right", 
                                  borderRight: "1px solid var(--border-light)",
                                  padding: "6px 8px",
                                  fontWeight: 500,
                                  color: "var(--foreground)"
                                }}
                              >
                                {formatCurrency(row.totalFat, 0)}
                              </td>
                              {/* Monthly price cells */}
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                                const val = row.monthPrices[m];
                                const displayVal = val !== undefined && val !== null && val > 0 
                                  ? formatCurrency(val, 2) 
                                  : "-";
                                const highlight = getCellHighlight(val, rowPrices);

                                return (
                                  <td 
                                    key={m} 
                                    style={{ 
                                      ...getColStyle("Month"),
                                      textAlign: "center", 
                                      borderRight: "1px solid var(--border-light)",
                                      padding: "6px 8px",
                                      ...highlight.style 
                                    }}
                                  >
                                    {displayVal}
                                  </td>
                                );
                              })}
                              {/* Average Price column */}
                              <td 
                                style={{ 
                                  ...getColStyle("Média"),
                                  textAlign: "center", 
                                  fontWeight: 700, 
                                  color: "var(--foreground)",
                                  background: "rgba(200, 169, 110, 0.05)",
                                  padding: "6px 8px"
                                }}
                              >
                                {row.avgPrice !== undefined && row.avgPrice !== null && row.avgPrice > 0 
                                  ? formatCurrency(row.avgPrice, 2) 
                                  : "-"}
                              </td>
                            </tr>

                            {/* Expanded family rows */}
                            {isExpanded && channelFamilies.map((fam) => {
                              const famRowPrices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                                .map(m => fam.monthPrices[m])
                                .filter((p): p is number => p !== undefined && p !== null && p > 0);

                              return (
                                <tr key={`${row.channel}-${fam.family}`} className="hover:bg-foreground/5 transition-colors" style={{ background: "rgba(200, 169, 110, 0.015)" }}>
                                  {/* Sticky family first column */}
                                  <td 
                                    style={{ 
                                      ...getColStyle("Canal"),
                                      position: "sticky", 
                                      left: 0, 
                                      zIndex: 1, 
                                      textAlign: "left", 
                                      background: "var(--table-row-odd)",
                                      borderRight: "1px solid var(--border)",
                                      boxShadow: "2px 0 0 rgba(0,0,0,0.05)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      paddingLeft: "24px",
                                      color: "var(--foreground-muted)",
                                      fontSize: "0.65rem"
                                    }}
                                  >
                                    — {fam.family}
                                  </td>
                                  {/* Faturamento Acumulado */}
                                  <td 
                                    style={{ 
                                      ...getColStyle("Fat. Acumulado"),
                                      textAlign: "right", 
                                      borderRight: "1px solid var(--border-light)",
                                      padding: "6px 8px",
                                      fontWeight: 400,
                                      color: "var(--foreground-muted)",
                                      fontSize: "0.65rem"
                                    }}
                                  >
                                    {formatCurrency(fam.totalFat, 0)}
                                  </td>
                                  {/* Monthly prices */}
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                                    const val = fam.monthPrices[m];
                                    const displayVal = val !== undefined && val !== null && val > 0 
                                      ? formatCurrency(val, 2) 
                                      : "-";
                                    const highlight = getCellHighlight(val, famRowPrices);

                                    return (
                                      <td 
                                        key={m} 
                                        style={{ 
                                          ...getColStyle("Month"),
                                          textAlign: "center", 
                                          borderRight: "1px solid var(--border-light)",
                                          padding: "6px 8px",
                                          fontSize: "0.65rem",
                                          ...highlight.style 
                                        }}
                                      >
                                        {displayVal}
                                      </td>
                                    );
                                  })}
                                  {/* Average Price */}
                                  <td 
                                    style={{ 
                                      ...getColStyle("Média"),
                                      textAlign: "center", 
                                      fontWeight: 600, 
                                      color: "var(--foreground-muted)",
                                      background: "rgba(200, 169, 110, 0.02)",
                                      padding: "6px 8px",
                                      fontSize: "0.65rem"
                                    }}
                                  >
                                    {fam.avgPrice !== undefined && fam.avgPrice !== null && fam.avgPrice > 0 
                                      ? formatCurrency(fam.avgPrice, 2) 
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}

                      {/* Média Geral Row */}
                      <tr className="row-total" style={{ borderTop: "2px solid var(--accent-gold)" }}>
                        <td 
                          style={{ 
                            ...getColStyle("Canal"),
                            position: "sticky", 
                            left: 0, 
                            zIndex: 1, 
                            textAlign: "left", 
                            fontWeight: 700, 
                            background: "var(--table-total-bg)" 
                          }}
                        >
                          Média Geral
                        </td>
                        {/* Total Faturamento Sum */}
                        <td style={{ ...getColStyle("Fat. Acumulado"), textAlign: "right", fontWeight: 700, borderRight: "1px solid var(--border-light)", padding: "6px 8px" }}>
                          {formatCurrency(channelAverages.totalFatSum, 0)}
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                          const val = channelAverages.monthAverages[m];
                          return (
                            <td key={m} style={{ ...getColStyle("Month"), textAlign: "center", fontWeight: 700 }}>
                              {val !== undefined && val !== null && val > 0 ? formatCurrency(val, 2) : "-"}
                            </td>
                          );
                        })}
                        <td style={{ ...getColStyle("Média"), textAlign: "center", fontWeight: 700, background: "rgba(200, 169, 110, 0.1)" }}>
                          {channelAverages.totalAvg > 0 ? formatCurrency(channelAverages.totalAvg, 2) : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. PREÇO POR MATRIZ */}
              <div className="glass-card animate-fade-in" style={{ padding: "16px 20px", overflow: "hidden" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-gold)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Preço por Matriz
                </h3>
                <div style={{ overflowX: "auto", position: "relative" }}>
                  <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "separate", width: "100%", minWidth: "1180px", tableLayout: "fixed" }}>
                    <thead>
                      <tr>
                        {matrizHeaders.map((h, i) => {
                          const isMatriz = h === "Matriz";
                          return (
                            <th 
                              key={i} 
                              style={{ 
                                ...getColStyle(h),
                                position: "sticky", 
                                top: 0, 
                                zIndex: isMatriz ? 3 : 2, 
                                textAlign: isMatriz ? "left" : "center",
                                background: "var(--table-header-bg)",
                                borderBottom: "1px solid var(--border-light)",
                                padding: "8px 10px",
                                left: isMatriz ? 0 : undefined,
                                boxShadow: isMatriz ? "2px 0 0 rgba(0,0,0,0.1)" : undefined
                              }}
                            >
                              {h}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {matrizesData.map((row, idx) => {
                        const rowPrices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                          .map(m => row.monthPrices[m])
                          .filter((p): p is number => p !== undefined && p !== null && p > 0);

                        const isExpanded = expandedMatriz === row.matriz;
                        const matrizFamilies = matrizFamiliesData
                          .filter(f => f.matriz === row.matriz)
                          .sort((a, b) => b.totalQty - a.totalQty);

                        return (
                          <Fragment key={row.matriz}>
                            <tr className="hover:bg-foreground/5 transition-colors">
                              {/* Sticky first column */}
                              <td 
                                onClick={() => setExpandedMatriz(isExpanded ? null : row.matriz)}
                                style={{ 
                                  ...getColStyle("Matriz"),
                                  position: "sticky", 
                                  left: 0, 
                                  zIndex: 1, 
                                  textAlign: "left", 
                                  fontWeight: 600,
                                  background: "var(--table-row-odd)",
                                  borderRight: "1px solid var(--border)",
                                  boxShadow: "2px 0 0 rgba(0,0,0,0.05)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  cursor: "pointer"
                                }}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <ChevronRight style={{
                                    width: 12,
                                    height: 12,
                                    color: "var(--foreground-muted)",
                                    transition: "transform 0.2s",
                                    transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                                    flexShrink: 0
                                  }} />
                                  {row.matriz}
                                </span>
                              </td>
                              {/* Faturamento Acumulado */}
                              <td 
                                style={{ 
                                  ...getColStyle("Fat. Acumulado"),
                                  textAlign: "right", 
                                  borderRight: "1px solid var(--border-light)",
                                  padding: "6px 8px",
                                  fontWeight: 500,
                                  color: "var(--foreground)"
                                }}
                              >
                                {formatCurrency(row.totalFat, 0)}
                              </td>
                              {/* Monthly price cells */}
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                                const val = row.monthPrices[m];
                                const displayVal = val !== undefined && val !== null && val > 0 
                                  ? formatCurrency(val, 2) 
                                  : "-";
                                const highlight = getCellHighlight(val, rowPrices);

                                return (
                                  <td 
                                    key={m} 
                                    style={{ 
                                      ...getColStyle("Month"),
                                      textAlign: "center", 
                                      borderRight: "1px solid var(--border-light)",
                                      padding: "6px 8px",
                                      ...highlight.style 
                                    }}
                                  >
                                    {displayVal}
                                  </td>
                                );
                              })}
                              {/* Average Price column */}
                              <td 
                                style={{ 
                                  ...getColStyle("Média"),
                                  textAlign: "center", 
                                  fontWeight: 700, 
                                  color: "var(--foreground)",
                                  background: "rgba(200, 169, 110, 0.05)",
                                  padding: "6px 8px"
                                }}
                              >
                                {row.avgPrice !== undefined && row.avgPrice !== null && row.avgPrice > 0 
                                  ? formatCurrency(row.avgPrice, 2) 
                                  : "-"}
                              </td>
                            </tr>

                            {/* Expanded family rows */}
                            {isExpanded && matrizFamilies.map((fam) => {
                              const famRowPrices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                                .map(m => fam.monthPrices[m])
                                .filter((p): p is number => p !== undefined && p !== null && p > 0);

                              return (
                                <tr key={`${row.matriz}-${fam.family}`} className="hover:bg-foreground/5 transition-colors" style={{ background: "rgba(200, 169, 110, 0.015)" }}>
                                  {/* Sticky family first column */}
                                  <td 
                                    style={{ 
                                      ...getColStyle("Matriz"),
                                      position: "sticky", 
                                      left: 0, 
                                      zIndex: 1, 
                                      textAlign: "left", 
                                      background: "var(--table-row-odd)",
                                      borderRight: "1px solid var(--border)",
                                      boxShadow: "2px 0 0 rgba(0,0,0,0.05)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      paddingLeft: "24px",
                                      color: "var(--foreground-muted)",
                                      fontSize: "0.65rem"
                                    }}
                                  >
                                    — {fam.family}
                                  </td>
                                  {/* Faturamento Acumulado */}
                                  <td 
                                    style={{ 
                                      ...getColStyle("Fat. Acumulado"),
                                      textAlign: "right", 
                                      borderRight: "1px solid var(--border-light)",
                                      padding: "6px 8px",
                                      fontWeight: 400,
                                      color: "var(--foreground-muted)",
                                      fontSize: "0.65rem"
                                    }}
                                  >
                                    {formatCurrency(fam.totalFat, 0)}
                                  </td>
                                  {/* Monthly prices */}
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                                    const val = fam.monthPrices[m];
                                    const displayVal = val !== undefined && val !== null && val > 0 
                                      ? formatCurrency(val, 2) 
                                      : "-";
                                    const highlight = getCellHighlight(val, famRowPrices);

                                    return (
                                      <td 
                                        key={m} 
                                        style={{ 
                                          ...getColStyle("Month"),
                                          textAlign: "center", 
                                          borderRight: "1px solid var(--border-light)",
                                          padding: "6px 8px",
                                          fontSize: "0.65rem",
                                          ...highlight.style 
                                        }}
                                      >
                                        {displayVal}
                                      </td>
                                    );
                                  })}
                                  {/* Average Price */}
                                  <td 
                                    style={{ 
                                      ...getColStyle("Média"),
                                      textAlign: "center", 
                                      fontWeight: 600, 
                                      color: "var(--foreground-muted)",
                                      background: "rgba(200, 169, 110, 0.02)",
                                      padding: "6px 8px",
                                      fontSize: "0.65rem"
                                    }}
                                  >
                                    {fam.avgPrice !== undefined && fam.avgPrice !== null && fam.avgPrice > 0 
                                      ? formatCurrency(fam.avgPrice, 2) 
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}

                      {/* Média Geral Row */}
                      <tr className="row-total" style={{ borderTop: "2px solid var(--accent-gold)" }}>
                        <td 
                          style={{ 
                            ...getColStyle("Matriz"),
                            position: "sticky", 
                            left: 0, 
                            zIndex: 1, 
                            textAlign: "left", 
                            fontWeight: 700, 
                            background: "var(--table-total-bg)" 
                          }}
                        >
                          Média Geral
                        </td>
                        {/* Total Faturamento Sum */}
                        <td style={{ ...getColStyle("Fat. Acumulado"), textAlign: "right", fontWeight: 700, borderRight: "1px solid var(--border-light)", padding: "6px 8px" }}>
                          {formatCurrency(matrizAverages.totalFatSum, 0)}
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                          const val = matrizAverages.monthAverages[m];
                          return (
                            <td key={m} style={{ ...getColStyle("Month"), textAlign: "center", fontWeight: 700 }}>
                              {val !== undefined && val !== null && val > 0 ? formatCurrency(val, 2) : "-"}
                            </td>
                          );
                        })}
                        <td style={{ ...getColStyle("Média"), textAlign: "center", fontWeight: 700, background: "rgba(200, 169, 110, 0.1)" }}>
                          {matrizAverages.totalAvg > 0 ? formatCurrency(matrizAverages.totalAvg, 2) : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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
        <Link href="/preco" className="bottom-tab active"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><Users className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
