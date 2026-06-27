"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import {
  Filter, BarChart3, Upload, Home, DollarSign,
  History, Users, Target, TrendingUp, CheckCircle2, Calendar,
  ChevronRight, ChevronDown, ChevronLeft, Package
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";
import { Skeleton, SkeletonChart, SkeletonTable } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { GlassTooltip } from "@/components/GlassTooltip";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList
} from 'recharts';

import { formatCurrency, formatNumber } from "@/lib/formatters";

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

export default function SkuPdvPage() {
  const [loading, setLoading] = useState(true);
  const [, setFiltersLoading] = useState(false);

  // Default period: 13 months, ending in the month prior to current date
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

  const [totals, setTotals] = useState({ clientes: 0, matrizes: 0, fat: 0, total_portfolio: 0, avg_skus_per_pdv: 0 });
  const fetchRequestIdRef = useRef(0);

  interface MonthlyEvolutionRow {
    month: string;
    clientes: number;
    fat: number;
    avg_skus_per_pdv: number;
    company_skus: number;
  }

  interface ManagerRow {
    manager: string;
    clientes: number;
    matrizes: number;
    fat: number;
    avg_skus_per_pdv: number;
    monthly: Record<string, number>;
  }

  const [byMonth, setByMonth] = useState<MonthlyEvolutionRow[]>([]);
  const [byManager, setByManager] = useState<ManagerRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  interface ClientDetailRow {
    name: string;
    matriz?: string | null;
    uf?: string | null;
    total_fat: number;
    skus_sold: number;
    total_portfolio: number;
    pct: number;
  }

  interface ManagerDetailState {
    type: 'client' | 'matriz';
    page: number;
    loading: boolean;
    total: number;
    data: ClientDetailRow[];
  }

  const [expandedManagers, setExpandedManagers] = useState<string[]>([]);
  const [managerDetails, setManagerDetails] = useState<Record<string, ManagerDetailState>>({});

  const fetchManagerDetail = useCallback(async (manager: string, type: 'client' | 'matriz', page: number) => {
    setManagerDetails(prev => ({
      ...prev,
      [manager]: {
        ...(prev[manager] || { total: 0, data: [] }),
        type,
        page,
        loading: true
      }
    }));

    const stD = new Date(filterStartYear, filterStartMonth - 1, 1);
    const startDate = stD.toISOString().split("T")[0];
    const enD = new Date(filterEndYear, filterEndMonth, 0);
    const endDate = enD.toISOString().split("T")[0];

    const params = new URLSearchParams({
      startDate,
      endDate,
      manager,
      type,
      page: String(page),
      limit: "10",
      t: String(Date.now())
    });

    if (filterManager.length > 0) params.set("filterManager", filterManager.join(","));
    if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));
    if (filterUf.length > 0) params.set("uf", filterUf.join(","));
    if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
    if (filterProduct.length > 0) params.set("product", filterProduct.join(","));
    if (filterMatriz.length > 0) params.set("matriz", filterMatriz.join(","));

    try {
      const res = await fetch(`/api/dashboard/sku-pdv/detail?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (json.success) {
        setManagerDetails(prev => ({
          ...prev,
          [manager]: {
            type,
            page,
            loading: false,
            total: json.total,
            data: json.data || []
          }
        }));
      } else {
        setManagerDetails(prev => ({
          ...prev,
          [manager]: {
            ...(prev[manager] || { total: 0, data: [] }),
            type,
            page,
            loading: false
          }
        }));
      }
    } catch (e) {
      console.error(e);
      setManagerDetails(prev => ({
        ...prev,
        [manager]: {
          ...(prev[manager] || { total: 0, data: [] }),
          type,
          page,
          loading: false
        }
      }));
    }
  }, [filterStartYear, filterStartMonth, filterEndYear, filterEndMonth, filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz]);

  const handleToggleManager = (manager: string) => {
    if (expandedManagers.includes(manager)) {
      setExpandedManagers(prev => prev.filter(m => m !== manager));
    } else {
      setExpandedManagers(prev => [...prev, manager]);
      const current = managerDetails[manager];
      if (!current) {
        fetchManagerDetail(manager, 'client', 1);
      }
    }
  };

  const fetchFilters = useCallback(async () => {
    setFiltersLoading(true);
    const stD = new Date(filterStartYear, filterStartMonth - 1, 1);
    const startDateStr = stD.toISOString().split("T")[0];
    const enD = new Date(filterEndYear, filterEndMonth, 0);
    const endDateStr = enD.toISOString().split("T")[0];
    try {
      const res = await fetch(`/api/dashboard/filters?startDate=${startDateStr}&endDate=${endDateStr}`);
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) { console.error(e); }
    setFiltersLoading(false);
  }, [filterStartYear, filterStartMonth, filterEndYear, filterEndMonth]);

  const fetchData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    setExpandedManagers([]);
    setManagerDetails({});
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
      const res = await fetch(`/api/dashboard/sku-pdv?${params}`);
      const json = await res.json();
      if (requestId !== fetchRequestIdRef.current) return;
      if (json.success) {
        setTotals(json.totals || { clientes: 0, matrizes: 0, fat: 0, total_portfolio: 0, avg_skus_per_pdv: 0 });
        setByMonth(json.byMonth || []);
        setByManager(json.byManager || []);
        setMonths(json.months || []);
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
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
    setFilterMatriz([]);
  };

  const hasActiveFilters = filterManager.length > 0 || filterFamilia.length > 0 || filterUf.length > 0 || filterChannel.length > 0 || filterProduct.length > 0 || filterMatriz.length > 0;
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length;

  const getActiveFiltersString = () => {
    const parts = [];
    if (filterManager.length > 0) parts.push(`Gerente: ${filterManager.join(", ")}`);
    if (filterFamilia.length > 0) parts.push(`Família: ${filterFamilia.join(", ")}`);
    if (filterUf.length > 0) parts.push(`UF: ${filterUf.join(", ")}`);
    if (filterChannel.length > 0) parts.push(`Canal: ${filterChannel.join(", ")}`);
    if (filterMatriz.length > 0) parts.push(`Matriz: ${filterMatriz.join(", ")}`);
    if (filterProduct.length > 0) parts.push(`SKU: ${filterProduct.join(", ")}`);
    return parts.length > 0 ? parts.join(" | ") : "Todos os filtros consolidados";
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "70px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            SKU por PDV
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

        {/* MAIN */}
        <main className="cm-main" style={{ paddingTop: 4 }}>
          {hasActiveFilters && (
            <div style={{
              background: "var(--background-card)",
              border: "1px dashed var(--border)",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 14,
              fontSize: "0.65rem",
              color: "var(--foreground-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              <Filter style={{ width: 12, height: 12, color: "var(--accent-gold)", flexShrink: 0 }} />
              <span><strong>Filtros Ativos:</strong> {getActiveFiltersString()}</span>
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
               <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[90px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[90px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[90px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
                  <div className="glass-card flex items-center justify-center p-4 min-h-[90px]"><Skeleton className="w-[80%] h-6 rounded" /></div>
               </div>
               <SkeletonChart height={240} />
               <SkeletonTable />
            </div>
          ) : byMonth.length === 0 ? (
            <div style={{ padding: "40px 0" }}>
              <EmptyState 
                title="Sem dados de SKUs" 
                message="Nenhuma venda de café registrada com a combinação de filtros selecionada para este período." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <>
          {/* KPI CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>SKU por PDV</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatNumber(totals.avg_skus_per_pdv, 1)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Portfólio de SKUs</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#3f51b5" }}>{formatNumber(totals.total_portfolio, 0)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Faturamento no Período</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#2e7d32" }}>{formatCurrency(totals.fat, 0)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Clientes Positivados</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--foreground)" }}>{formatNumber(totals.clientes, 0)}</p>
            </div>
          </div>

          {/* CHARTS GRID */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
            {/* CHART 1: Evolução de SKUs por PDV por Mês */}
            <div className="glass-card" style={{ padding: "12px 16px", height: 220, display: "flex", flexDirection: "column", minWidth: 0, flex: "1.6 1 450px" }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: 6 }}>Evolução de SKUs por PDV por Mês</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMonth} margin={{ top: 15, right: 5, left: -20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis 
                      dataKey="month" 
                      tickFormatter={(val) => {
                        const [y, m] = val.split("-");
                        return m ? MONTHS[parseInt(m)-1].slice(0,3) + '/' + y.slice(2) : val;
                      }} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} 
                      interval={0} 
                      angle={-45} 
                      textAnchor="end" 
                      dy={5} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} width={30} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(value, name) => [`${formatNumber(Number(value), 1)}`, name === 'avg_skus_per_pdv' ? 'Média SKU por PDV' : String(name)]}
                      />}
                      cursor={{ fill: 'var(--border)', opacity: 0.2 }}
                    />
                    <Bar dataKey="avg_skus_per_pdv" fill="#3f51b5" radius={[4, 4, 0, 0]} barSize={22}>
                      <LabelList dataKey="avg_skus_per_pdv" position="top" formatter={(v: any) => formatNumber(Number(v || 0), 1)} fill="var(--foreground)" fontSize={9} fontWeight="600" />
                      {byMonth.map((entry, index) => {
                        const isBoundary = index === 0 || index === byMonth.length - 1;
                        return <Cell key={`cell-${index}`} fill={isBoundary ? "#93c5fd" : "#3f51b5"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 2: Média de SKUs por PDV por Gerente */}
            <div className="glass-card" style={{ padding: "12px 16px", height: 220, display: "flex", flexDirection: "column", minWidth: 0, flex: "1 1 300px" }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: 6 }}>Média de SKUs por PDV por Gerente</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byManager} layout="vertical" margin={{ top: 5, right: 25, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis type="number" domain={[0, 'auto']} tickFormatter={(val) => String(val)} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                    <YAxis dataKey="manager" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground)" }} width={80} />
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(value, name) => [`${formatNumber(Number(value), 1)}`, name === 'avg_skus_per_pdv' ? 'Média SKU por PDV' : String(name)]}
                      />}
                      cursor={{ fill: 'var(--border)', opacity: 0.2 }}
                    />
                    <Bar dataKey="avg_skus_per_pdv" fill="#3f51b5" radius={[0, 4, 4, 0]} barSize={14}>
                      <LabelList dataKey="avg_skus_per_pdv" position="right" formatter={(v: any) => formatNumber(Number(v || 0), 1)} fill="var(--foreground)" fontSize={9} fontWeight="600" />
                      {byManager.map((entry, index) => {
                        return <Cell key={`cell-${index}`} fill={index === 0 ? "var(--accent-gold)" : "#3f51b5"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* MAIN TABLE */}
          <div className="glass-card" style={{ padding: 0, marginBottom: 14, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground-secondary)" }}>Visão por Gerente (SKU por PDV)</h3>
              <ExportButton data={byManager.map(b => ({ Gerente: b.manager, Clientes: b.clientes, Matrizes: b.matrizes, Faturamento: b.fat, SKU_por_PDV: b.avg_skus_per_pdv }))} filename="SKU_PDV_Gerentes" />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", width: "100%", whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ boxShadow: "0 1px 0 var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px" }}>Gerente</th>
                    <th style={{ textAlign: "center", padding: "8px 6px", width: 80 }}>Clientes</th>
                    <th style={{ textAlign: "center", padding: "8px 6px", width: 80 }}>Matrizes</th>
                    <th style={{ textAlign: "right", padding: "8px 6px", width: 120 }}>Faturamento</th>
                    <th style={{ textAlign: "center", padding: "8px 6px", width: 150 }}>SKU por PDV</th>
                  </tr>
                </thead>
                <tbody>
                  {byManager.map((row, i) => {
                    const isExpanded = expandedManagers.includes(row.manager);
                    const detail = managerDetails[row.manager];
                    
                    return (
                      <Fragment key={row.manager}>
                        <tr style={{ borderBottom: "1px solid var(--border)", background: isExpanded ? "rgba(0,0,0,0.01)" : "transparent" }}>
                          <td 
                            onClick={() => handleToggleManager(row.manager)} 
                            style={{ textAlign: "left", padding: "8px 10px", fontWeight: 500, cursor: "pointer" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <ChevronRight 
                                style={{ 
                                  width: 12, 
                                  height: 12, 
                                  color: "var(--foreground-muted)",
                                  transition: "transform 0.2s", 
                                  transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                                  flexShrink: 0
                                }} 
                                />
                              {row.manager}
                            </div>
                          </td>
                          <td style={{ textAlign: "center", padding: "8px 6px", fontWeight: 600 }}>{row.clientes}</td>
                          <td style={{ textAlign: "center", padding: "8px 6px" }}>{row.matrizes}</td>
                          <td style={{ textAlign: "right", padding: "8px 6px" }}>{formatCurrency(row.fat, 0)}</td>
                          <td style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700, color: "var(--accent-gold)" }}>
                            {formatNumber(row.avg_skus_per_pdv, 2)}
                          </td>
                        </tr>
                        
                        {isExpanded && detail && (
                          <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: "1px solid var(--border)" }}>
                            <td colSpan={5} style={{ padding: "10px 16px 14px 28px" }}>
                              <div className="glass-card" style={{ padding: "12px", border: "1px solid var(--border)", background: "var(--background-card)" }}>
                                {/* Header of Detail */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                  <h4 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--foreground-secondary)", margin: 0 }}>
                                    Penetração de SKUs — {row.manager}
                                  </h4>
                                  
                                  {/* Toggle Switch */}
                                  <div style={{ display: "flex", background: "var(--border)", padding: 2, borderRadius: 6, gap: 2 }}>
                                    <button 
                                      onClick={() => fetchManagerDetail(row.manager, 'client', 1)}
                                      style={{
                                        border: "none",
                                        padding: "3px 8px",
                                        fontSize: "0.6rem",
                                        fontWeight: 600,
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        background: detail.type === 'client' ? "var(--card-bg, #fff)" : "transparent",
                                        color: detail.type === 'client' ? "var(--foreground)" : "var(--foreground-muted)",
                                        transition: "all 0.2s"
                                      }}
                                    >
                                      Clientes (CNPJ)
                                    </button>
                                    <button 
                                      onClick={() => fetchManagerDetail(row.manager, 'matriz', 1)}
                                      style={{
                                        border: "none",
                                        padding: "3px 8px",
                                        fontSize: "0.6rem",
                                        fontWeight: 600,
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        background: detail.type === 'matriz' ? "var(--card-bg, #fff)" : "transparent",
                                        color: detail.type === 'matriz' ? "var(--foreground)" : "var(--foreground-muted)",
                                        transition: "all 0.2s"
                                      }}
                                    >
                                      Matrizes (Rede)
                                    </button>
                                  </div>
                                </div>

                                {/* Table inside detail */}
                                <div style={{ overflowX: "auto" }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.65rem" }}>
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                        <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--foreground-muted)" }}>
                                          {detail.type === 'matriz' ? 'Matriz' : 'Cliente / CNPJ'}
                                        </th>
                                        {detail.type === 'client' && (
                                          <>
                                            <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--foreground-muted)", width: 120 }}>
                                              Matriz (Rede)
                                            </th>
                                            <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--foreground-muted)", width: 50 }}>
                                              UF
                                            </th>
                                          </>
                                        )}
                                        <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--foreground-muted)", width: 100 }}>
                                          Faturamento
                                        </th>
                                        <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--foreground-muted)", width: 120 }}>
                                          SKUs Vendidos
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.loading ? (
                                        <tr>
                                          <td colSpan={detail.type === 'client' ? 5 : 3} style={{ textAlign: "center", padding: "20px 0", color: "var(--foreground-muted)" }}>
                                            Carregando listagem detalhada...
                                          </td>
                                        </tr>
                                      ) : detail.data.length === 0 ? (
                                        <tr>
                                          <td colSpan={detail.type === 'client' ? 5 : 3} style={{ textAlign: "center", padding: "14px 0", color: "var(--foreground-muted)" }}>
                                            Nenhum registro encontrado.
                                          </td>
                                        </tr>
                                      ) : (
                                        detail.data.map((detRow, detIdx) => {
                                          const isZero = detRow.skus_sold === 0;
                                          return (
                                            <tr key={detIdx} style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                                              <td style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={detRow.name}>
                                                {detRow.name}
                                              </td>
                                              {detail.type === 'client' && (
                                                <>
                                                  <td style={{ textAlign: "left", padding: "6px 8px", color: "var(--foreground-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={detRow.matriz || '-'}>
                                                    {detRow.matriz || '-'}
                                                  </td>
                                                  <td style={{ textAlign: "center", padding: "6px 8px", color: "var(--foreground-muted)", fontWeight: 600 }}>
                                                    {detRow.uf || '-'}
                                                  </td>
                                                </>
                                              )}
                                              <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 600, color: "#2e7d32" }}>
                                                {formatCurrency(detRow.total_fat, 0)}
                                              </td>
                                              <td style={{ textAlign: "center", padding: "6px 8px" }}>
                                                {isZero ? (
                                                  <span style={{ 
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: "36px",
                                                    height: "18px",
                                                    borderRadius: "4px",
                                                    backgroundColor: "#fca5a5", // vermelho claro
                                                    color: "#ffffff",           // letra na cor branca
                                                    fontWeight: 700, 
                                                    fontSize: "0.65rem"
                                                  }}>
                                                    0
                                                  </span>
                                                ) : (
                                                  <span style={{ fontWeight: 600 }}>{detRow.skus_sold}</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Pagination inside detail */}
                                {!detail.loading && detail.total > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                                    <span style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>
                                      Mostrando {((detail.page - 1) * 10) + 1} a {Math.min(detail.page * 10, detail.total)} de {detail.total} {detail.type === 'matriz' ? 'matrizes' : 'clientes'}
                                    </span>
                                    
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      <button 
                                        disabled={detail.page <= 1}
                                        onClick={() => fetchManagerDetail(row.manager, detail.type, detail.page - 1)}
                                        style={{
                                          padding: "3px 8px",
                                          borderRadius: 4,
                                          border: "1px solid var(--border)",
                                          background: detail.page <= 1 ? "var(--border)" : "var(--card-bg, #fff)",
                                          color: detail.page <= 1 ? "var(--foreground-muted)" : "var(--foreground)",
                                          fontSize: "0.6rem",
                                          cursor: detail.page <= 1 ? "not-allowed" : "pointer",
                                          opacity: detail.page <= 1 ? 0.5 : 1,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 2
                                        }}
                                      >
                                        <ChevronLeft style={{ width: 10, height: 10 }} /> Anterior
                                      </button>
                                      
                                      <span style={{ fontSize: "0.6rem", fontWeight: 600 }}>
                                        {detail.page} / {Math.ceil(detail.total / 10)}
                                      </span>

                                      <button 
                                        disabled={detail.page >= Math.ceil(detail.total / 10)}
                                        onClick={() => fetchManagerDetail(row.manager, detail.type, detail.page + 1)}
                                        style={{
                                          padding: "3px 8px",
                                          borderRadius: 4,
                                          border: "1px solid var(--border)",
                                          background: detail.page >= Math.ceil(detail.total / 10) ? "var(--border)" : "var(--card-bg, #fff)",
                                          color: detail.page >= Math.ceil(detail.total / 10) ? "var(--foreground-muted)" : "var(--foreground)",
                                          fontSize: "0.6rem",
                                          cursor: detail.page >= Math.ceil(detail.total / 10) ? "not-allowed" : "pointer",
                                          opacity: detail.page >= Math.ceil(detail.total / 10) ? 0.5 : 1,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 2
                                        }}
                                      >
                                        Próximo <ChevronRight style={{ width: 10, height: 10 }} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Rede</Link>
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Rede</Link>
        <Link href="/historico-por-matriz" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Rede</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab active"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
