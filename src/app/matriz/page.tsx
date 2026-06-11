"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Filter, BarChart3, Upload, Home, DollarSign,
  History, Users, Target, TrendingUp, CheckCircle2, Calendar
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";
import { Skeleton, SkeletonChart, SkeletonTable } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { GlassTooltip } from "@/components/GlassTooltip";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Treemap, PieChart, Pie, Cell, LabelList
} from 'recharts';

import { formatCurrency, formatNumber } from "@/lib/formatters";

// CORES E CONSTANTES
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const YEARS = [2026, 2025, 2024, 2023, 2022];

// Cores baseadas no PowerBI e tema Coffee++
const COLORS = [
  "#1f77b4", "#c8a96e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  "#7d6b45", "#5a805a", "#a0522d", "#6b8fad"
];

const TREEMAP_COLORS = [
  "#2196f3", "#3f51b5", "#f44336", "#673ab7", "#e91e63", 
  "#009688", "#4caf50", "#ff9800", "#795548", "#607d8b"
];

// O custom content do Treemap
interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  depth?: number;
  name?: string;
  pct?: number;
}

const CustomizedContent = (props: TreemapContentProps) => {
  const { depth = 0, x = 0, y = 0, width = 0, height = 0, index = 0, name, pct } = props;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? TREEMAP_COLORS[index % TREEMAP_COLORS.length] : 'rgba(255,255,255,0)',
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {width > 50 && height > 30 ? (
        <>
          <text x={x + 4} y={y + 14} fill="#fff" fontSize={10} fontWeight="bd" className="recharts-text">
            {name}
          </text>
          <text x={x + 4} y={y + 26} fill="#fff" fontSize={12} fontWeight="bold" className="recharts-text">
            {pct?.toFixed(1)}%
          </text>
        </>
      ) : null}
    </g>
  );
};


  interface FiltersData {
    managers: string[];
    familias: string[];
    ufs: string[];
    channels: string[];
    products: string[];
    matrizes: string[];
  }

export default function MatrizPage() {
  const [loading, setLoading] = useState(true);
  const [, setFiltersLoading] = useState(false);

  // Período default: 13 meses iterativos
  const now = new Date();
  const defaultEndYear = now.getFullYear();
  const defaultEndMonth = now.getMonth() + 1;
  const startD = new Date(defaultEndYear, defaultEndMonth - 1 - 12, 1);
  const defaultStartYear = startD.getFullYear();
  const defaultStartMonth = startD.getMonth() + 1;

  const [filterStartYear, setFilterStartYear] = useState(defaultStartYear);
  const [filterStartMonth, setFilterStartMonth] = useState(defaultStartMonth);
  const [filterEndYear, setFilterEndYear] = useState(defaultEndYear);
  const [filterEndMonth, setFilterEndMonth] = useState(defaultEndMonth);

  // Filtros Globais
  const [filterManager, setFilterManager] = useState<string[]>([]);
  const [filterFamilia, setFilterFamilia] = useState<string[]>([]);
  const [filterUf, setFilterUf] = useState<string[]>([]);
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]);
  const [filterMatriz, setFilterMatriz] = useState<string[]>([]);

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [], matrizes: []
  });

  // Dados da API agregados
  const [totals, setTotals] = useState({ fat: 0, qty: 0, maco: 0 });
  const [matrizData, setMatrizData] = useState<Record<string, unknown>[]>([]);
  const [managerData, setManagerData] = useState<Record<string, unknown>[]>([]);
  const [productData, setProductData] = useState<Record<string, unknown>[]>([]);
  const [familiaData, setFamiliaData] = useState<Record<string, unknown>[]>([]);
  const [historyData, setHistoryData] = useState<Record<string, unknown>[]>([]);

  // Paginação da tabela
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(matrizData.length / PAGE_SIZE);
  const paginatedData = matrizData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
      const res = await fetch(`/api/dashboard/matriz?${params}`);
      const json = await res.json();
      if (json.success) {
        setTotals(json.totals || { fat: 0, qty: 0, maco: 0 });
        setMatrizData(json.byMatriz || []);
        setCurrentPage(1);
        
        setManagerData(json.byManager?.map((m: Record<string, unknown>) => ({
            name: m.name,
            size: m.fat,
            pct: m.pct
        })) || []);
        
        setProductData(json.byProduct || []);
        setFamiliaData(json.byFamilia || []);
        setHistoryData(json.byMonth || []);
      }
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
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

  const hasActiveFilters =
    filterManager.length > 0 || filterFamilia.length > 0 ||
    filterUf.length > 0 || filterChannel.length > 0 || filterProduct.length > 0 || filterMatriz.length > 0;

  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz]
    .filter(f => f.length > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "70px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            MATRIZ
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            {MONTHS[filterStartMonth - 1]}/{filterStartYear} a {MONTHS[filterEndMonth - 1]}/{filterEndYear}
          </p>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
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
            <button onClick={handleClearFilters} className="cm-btn-clear" style={{ marginTop: 12 }}>
              <Filter style={{ width: 11, height: 11 }} /> Limpar Filtros ({activeFilterCount})
            </button>
          )}
        </aside>

        {/* MAIN */}
        <main className="cm-main" style={{ paddingTop: 4 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 14 }}>
                <SkeletonChart height={260} />
                <div className="glass-card flex items-center justify-center h-[260px]"><Skeleton className="w-full h-full rounded bg-[var(--border)]" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 14 }}>
                <SkeletonTable />
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <SkeletonChart height={250} />
                  <div style={{ display: "flex", gap: 14, height: 220 }}>
                     <div className="glass-card flex-1"><Skeleton className="w-full h-full rounded-full bg-[var(--border)] scale-75" /></div>
                     <div className="glass-card flex-1"><Skeleton className="w-full h-full rounded-full bg-[var(--border)] scale-75" /></div>
                  </div>
                </div>
              </div>
            </div>
          ) : matrizData.length === 0 ? (
            <div style={{ padding: "20px 0" }}>
              <EmptyState 
                title="Sua busca não encontrou resultados" 
                message="Não há dados de Matriz registrados com a combinação de filtros selecionada para este período." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Histórico Mensal */}
            <div className="glass-card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", height: 260, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)" }}>Evolução de Volumes</h3>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyData} margin={{ top: 10, right: 0, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="month" tickFormatter={(val) => {
                      const [_y, _m] = val.split("-"); 
                      return _m ? MONTHS[parseInt(_m)-1].slice(0,3) + '/' + _y.slice(2) : val;
                    }} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} interval={0} angle={-45} textAnchor="end" dy={5} />
                    <Tooltip 
                      content={<GlassTooltip
                        formatter={(value) => [formatNumber(Number(value), 0) + ' tons', 'Volume']}
                      />}
                      cursor={{ fill: 'var(--border)', opacity: 0.2 }}
                    />
                    <Bar dataKey="qty" fill="var(--accent-gold)" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList dataKey="qty" position="center" fill="#1f2937" fontSize={10} fontWeight="600" angle={-90} formatter={(val) => formatNumber(Number(val), 0)} />
                      {historyData.map((entry, index) => {
                        const entryMonth = parseInt((entry.month as string).substring(5, 7));
                        const isEndMonth = entryMonth === filterEndMonth;
                        return (
                          <Cell key={`cell-${index}`} fill={isEndMonth ? "#93c5fd" : "#e5e3c3"} />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Treemap de Gerentes */}
            <div className="glass-card" style={{ padding: 0, height: 260, overflow: 'hidden', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={managerData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={<CustomizedContent />}
                />
              </ResponsiveContainer>
            </div>
          </div>

          {/* LOWER SECTION */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 14 }}>
            {/* Table */}
            <div className="glass-card" style={{ padding: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground-secondary)" }}>Visão por Matriz</h3>
                <ExportButton data={matrizData} filename="Matriz_Export" />
              </div>
              <div style={{ overflowX: "auto", overflowY: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", width: "100%", tableLayout: "auto", whiteSpace: "nowrap" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--card-bg, #fff)", zIndex: 1, boxShadow: "0 1px 0 var(--border)" }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Matriz</th>
                      <th style={{ textAlign: "center", padding: "8px 6px", width: 40 }}>Rank</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 70 }}>Fat (R$)</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 80 }}>Tons (Real)</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 65 }}>R$/Kg</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 80 }}>MaCo (Real)</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 65 }}>MaCo/Kg</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 55, opacity: 0.5 }}>V. Futura</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 60, opacity: 0.5 }}>Devoluções</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", width: 45, opacity: 0.5 }}>Bonif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 16, textAlign: "center", color: "var(--foreground-muted)" }}>Nenhum dado encontrado</td></tr>
                    ) : (
                      paginatedData.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ textAlign: "left", padding: "6px 10px", fontWeight: 500 }}>
                            {row.matriz as string}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 6px" }}>{row.rank as number}</td>
                          <td style={{ textAlign: "right", padding: "6px 6px" }}>{formatNumber((row.fat as number)/1000, 1)}</td>
                          <td style={{ textAlign: "right", padding: "6px 6px" }}>{formatNumber(row.qty as number, 1)}</td>
                          <td style={{ textAlign: "right", padding: "6px 6px", color: "var(--foreground-secondary)" }}>{formatCurrency(row.rk_kg as number)}</td>
                          <td style={{ textAlign: "right", padding: "6px 6px" }}>{formatNumber((row.maco as number)/1000, 1)}</td>
                          <td style={{ textAlign: "right", padding: "6px 6px", color: "var(--foreground-secondary)" }}>{formatCurrency(row.maco_kg as number)}</td>
                          <td style={{ textAlign: "right", padding: "6px 6px", opacity: 0.5 }}>{row.v_futura as string}</td>
                          <td style={{ textAlign: "right", padding: "6px 6px", opacity: 0.5 }}>{row.devolucoes as number}%</td>
                          <td style={{ textAlign: "right", padding: "6px 6px", opacity: 0.5 }}>{row.bonif as number}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderTop: "1px solid var(--border)", fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                  <span>{matrizData.length} matrizes • Pág. {currentPage} de {totalPages}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: currentPage === 1 ? "transparent" : "var(--card-bg)", cursor: currentPage === 1 ? "default" : "pointer", opacity: currentPage === 1 ? 0.4 : 1, fontSize: "0.7rem" }}
                    >← Ant</button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: currentPage === totalPages ? "transparent" : "var(--card-bg)", cursor: currentPage === totalPages ? "default" : "pointer", opacity: currentPage === totalPages ? 0.4 : 1, fontSize: "0.7rem" }}
                    >Próx →</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Pane */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              {/* Product Horizontal Bar Chart */}
              <div className="glass-card" style={{ padding: "16px 12px", flex: 1, minHeight: 250 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: "12px", paddingLeft: "8px" }}>Ranking de Linhas (SKU)</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={productData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="product" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} width={140} tickFormatter={(val) => (val as string).length > 20 ? (val as string).substring(0,18)+'...' : (val as string)} />
                    <Tooltip content={<GlassTooltip formatter={(val) => [formatNumber(Number(val), 0) + ' tons', 'Volume']} />} cursor={{ fill: 'var(--border)', opacity: 0.1 }} />
                    <Bar dataKey="qty" fill="#3f51b5" barSize={16} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="qty" position="right" fill="var(--foreground-muted)" fontSize={9} formatter={(val) => formatNumber(Number(val), 0)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Donut and Pie Charts Container */}
              <div style={{ display: "flex", gap: 14, height: 220 }}>
                {/* Donut Chart (Família) */}
                <div className="glass-card" style={{ flex: 1, padding: "8px", position: "relative" }}>
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={familiaData}
                        innerRadius="40%"
                        outerRadius="65%"
                        paddingAngle={2}
                        dataKey="fat"
                        stroke="none"
                        label={({ name, percent, cx, cy, midAngle, outerRadius: oR }: any) => {
                          const RADIAN = Math.PI / 180;
                          const radius = oR + 14;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          const pctVal = (percent || 0) * 100;
                          if (pctVal < 2) return null;
                          const truncName = name && name.length > 10 ? name.substring(0, 8) + '...' : (name || '');
                          return (
                            <text x={x} y={y} fill="var(--foreground-muted)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={8}>
                              {truncName} {pctVal.toFixed(1)}%
                            </text>
                          );
                        }}
                        labelLine={{ stroke: 'var(--foreground-muted)', strokeWidth: 0.5 }}
                      >
                        {familiaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<GlassTooltip formatter={(v) => [formatCurrency(Number(v), 0), 'Faturamento']} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Pie Chart (Preço/MaCo) */}
                <div className="glass-card" style={{ flex: 1, padding: "8px", position: "relative" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const precoKg = totals.qty > 0 ? totals.fat / totals.qty : 0;
                          const macoKg = totals.qty > 0 ? totals.maco / totals.qty : 0;
                          const total = precoKg + macoKg;
                          return [
                            { name: "Preço/Kg", value: precoKg, pct: total > 0 ? (precoKg / total) * 100 : 0 },
                            { name: "MaCo Sim/Kg", value: macoKg, pct: total > 0 ? (macoKg / total) * 100 : 0 },
                          ];
                        })()}
                        outerRadius="65%"
                        dataKey="value"
                        stroke="none"
                        label={({ name, value, percent, cx, cy, midAngle, outerRadius: oR }: any) => {
                          const RADIAN = Math.PI / 180;
                          const radius = oR + 16;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          const pctVal = (percent || 0) * 100;
                          return (
                            <text x={x} y={y} fill="var(--foreground)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={9} fontWeight="600">
                              {name} {formatCurrency(value)} ({pctVal.toFixed(1)}%)
                            </text>
                          );
                        }}
                        labelLine={{ stroke: 'var(--foreground-muted)', strokeWidth: 0.5 }}
                      >
                        <Cell fill="#b71c1c" />
                        <Cell fill="#1b5e20" />
                      </Pie>
                      <Tooltip content={<GlassTooltip formatter={(v) => [formatCurrency(Number(v)), 'Valor']} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
          </>
          )}
        </main>
      </div>

       <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/matriz" className="bottom-tab active"><Users className="bottom-tab-icon" /> Matriz</Link>
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Matriz</Link>
        <Link href="/historico-por-matriz" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Matriz</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <Link href="/atendimento" className="bottom-tab"><Users className="bottom-tab-icon" /> Atendimento</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
