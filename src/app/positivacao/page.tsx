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
import { Skeleton, SkeletonGrid, SkeletonChart, SkeletonTable } from "@/components/Skeleton";
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

// Escala de cor para a batalha naval: verde degradê + vermelho/amarelo para piores
function getHeatColor(value: number, max: number): string {
  if (value === 0) return 'transparent';
  const intensity = Math.min(value / Math.max(max, 1), 1);
  const r = Math.round(220 - intensity * 180);
  const g = Math.round(245 - intensity * 80);
  const b = Math.round(220 - intensity * 180);
  return `rgb(${r}, ${g}, ${b})`;
}

// Retorna cor baseada na posição do valor na linha (pior=vermelho, 2o pior=amarelo, resto=verde)
function getRowHeatColor(value: number, max: number, worst: number, secondWorst: number): string {
  if (value === 0) return 'transparent';
  if (value === worst) return 'rgba(220, 38, 38, 0.32)';     // vermelho mais forte
  if (value === secondWorst) return 'rgba(234, 179, 8, 0.35)'; // amarelo mais forte
  return getHeatColor(value, max);
}

function getTextColor(value: number, _max: number): string {
  if (value === 0) return 'var(--foreground-muted)';
  return '#1f2937';
}

export default function PositivacaoPage() {
  const [loading, setLoading] = useState(true);
  const [, setFiltersLoading] = useState(false);

  // Período default: 13 meses, acabando no mês ANTERIOR ao atual
  const now = new Date();
  const endRef = new Date(now.getFullYear(), now.getMonth() - 1, 1); // mês anterior
  const defaultEndYear = endRef.getFullYear();
  const defaultEndMonth = endRef.getMonth() + 1;
  const startD = new Date(defaultEndYear, defaultEndMonth - 1 - 12, 1);
  const defaultStartYear = startD.getFullYear();
  const defaultStartMonth = startD.getMonth() + 1;

  const [filterStartYear, setFilterStartYear] = useState(defaultStartYear);
  const [filterStartMonth, setFilterStartMonth] = useState(defaultStartMonth);
  const [filterEndYear, setFilterEndYear] = useState(defaultEndYear);
  const [filterEndMonth, setFilterEndMonth] = useState(defaultEndMonth);

  const [filterManager, setFilterManager] = useState<string[]>([]);
  const [filterFamilia, setFilterFamilia] = useState<string[]>([]);
  const [filterUf, setFilterUf] = useState<string[]>([]);
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]);
  const [filterMatriz, setFilterMatriz] = useState<string[]>([]);

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [], matrizes: []
  });

  const [totals, setTotals] = useState({ clientes: 0, matrizes: 0, fat: 0, meses: 0 });
  interface MonthlyByManagerRow {
    manager: string;
    clientes: number;
    matrizes: number;
    monthly: Record<string, number>;
    fat: number;
  }

  interface BatalhaNavalRow {
    sku: string;
    totalQty: number;
    months: Record<string, number>;
  }

  const [byMonth, setByMonth] = useState<Record<string, unknown>[]>([]);
  const [byManager, setByManager] = useState<MonthlyByManagerRow[]>([]);
  const [batalhaNaval, setBatalhaNaval] = useState<BatalhaNavalRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);

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
      const res = await fetch(`/api/dashboard/positivacao?${params}`);
      const json = await res.json();
      if (json.success) {
        setTotals(json.totals || { clientes: 0, matrizes: 0, fat: 0, meses: 0 });
        setByMonth(json.byMonth || []);
        setByManager(json.byManager || []);
        setBatalhaNaval(json.batalhaNaval || []);
        setMonths(json.months || []);
      }
    } catch(e) { console.error(e); }
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

  const hasActiveFilters = filterManager.length > 0 || filterFamilia.length > 0 || filterUf.length > 0 || filterChannel.length > 0 || filterProduct.length > 0 || filterMatriz.length > 0;
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct, filterMatriz].filter(f => f.length > 0).length;

  // Max value for heatmap color scale
  const maxHeatValue = batalhaNaval.reduce((max, row) => {
    const rowMax = Math.max(...Object.values(row.months as Record<string, number>));
    return Math.max(max, rowMax);
  }, 0);

  // Meses ordenados (antigo → recente)
  const orderedMonths = months;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "70px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            POSITIVAÇÃO
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
               <SkeletonTable />
            </div>
          ) : byMonth.length === 0 ? (
            <div style={{ padding: "40px 0" }}>
              <EmptyState 
                title="Sem dados de positivação" 
                message="Nenhum cliente positivado com a combinação de filtros selecionada para este período." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <>
          {/* KPI CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Clientes Positivados</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-gold)" }}>{formatNumber(totals.clientes, 0)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Matrizes Positivadas</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#3f51b5" }}>{formatNumber(totals.matrizes, 0)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Faturamento Total</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#2e7d32" }}>{formatCurrency(totals.fat, 0)}</p>
            </div>
            <div className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Meses no Período</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--foreground)" }}>{totals.meses}</p>
            </div>
          </div>

          {/* CHART: Positivação por Mês */}
          <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 14, height: 240, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)", marginBottom: 10 }}>Positivação de Clientes por Mês</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} margin={{ top: 10, right: 0, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tickFormatter={(val) => {
                    const [_y, _m] = val.split("-");
                    return _m ? MONTHS[parseInt(_m)-1].slice(0,3) + '/' + _y.slice(2) : val;
                  }} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} interval={0} angle={-45} textAnchor="end" dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                  <Tooltip
                    content={<GlassTooltip
                      formatter={(value, name) => [formatNumber(Number(value), 0), name === 'clientes' ? 'Clientes' : String(name)]}
                    />}
                    cursor={{ fill: 'var(--border)', opacity: 0.2 }}
                  />
                  <Bar dataKey="clientes" fill="#3f51b5" radius={[4, 4, 0, 0]} barSize={28}>
                    <LabelList dataKey="clientes" position="top" fill="#1f2937" fontSize={10} fontWeight="600" />
                    {byMonth.map((entry, index) => {
                      const entryMonth = parseInt((entry.month as string).substring(5, 7));
                      const isEndMonth = entryMonth === filterEndMonth;
                      return <Cell key={`cell-${index}`} fill={isEndMonth ? "#93c5fd" : "#3f51b5"} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABELA POR GERENTE */}
          <div className="glass-card" style={{ padding: 0, marginBottom: 14, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground-secondary)" }}>Visão por Gerente</h3>
              <ExportButton data={byManager} filename="Positivacao_Gerentes" />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: "0.7rem", borderCollapse: "collapse", width: "100%", whiteSpace: "nowrap" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--card-bg, #fff)", zIndex: 1, boxShadow: "0 1px 0 var(--border)" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px" }}>Gerente</th>
                    <th style={{ textAlign: "center", padding: "8px 6px", width: 60 }}>Total</th>
                    <th style={{ textAlign: "center", padding: "8px 6px", width: 60 }}>Matrizes</th>
                    {byManager.length > 0 && Object.keys(byManager[0].monthly || {}).sort().map(m => {
                      const [_y, _mm] = m.split("-");
                      return (
                        <th key={m} style={{ textAlign: "center", padding: "8px 4px", width: 48, fontSize: "0.6rem", borderLeft: "1px dashed rgba(0,0,0,0.08)" }}>
                          {MONTHS[parseInt(_mm)-1].slice(0,3)}<br/><span style={{ fontWeight: 400, opacity: 0.6 }}>{_y.slice(2)}</span>
                        </th>
                      );
                    })}
                    <th style={{ textAlign: "right", padding: "8px 6px", width: 100 }}>Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {byManager.map((row, i) => {
                    const monthKeys = Object.keys(row.monthly || {}).sort();
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ textAlign: "left", padding: "6px 10px", fontWeight: 500 }}>{row.manager}</td>
                        <td style={{ textAlign: "center", padding: "6px 6px", fontWeight: 700, color: "#3f51b5" }}>{row.clientes}</td>
                        <td style={{ textAlign: "center", padding: "6px 6px" }}>{row.matrizes}</td>
                        {monthKeys.map(m => (
                          <td key={m} style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: (row.monthly[m] || 0) > 0 ? "#2e7d32" : "var(--foreground-muted)", borderLeft: "1px dashed rgba(0,0,0,0.08)" }}>
                            {row.monthly[m] || 0}
                          </td>
                        ))}
                        <td style={{ textAlign: "right", padding: "6px 6px" }}>{formatCurrency(row.fat, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* BATALHA NAVAL: SKU x MÊS */}
          <div className="glass-card" style={{ padding: 0, minWidth: 0 }}>
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)" }}>
                  Batalha Naval — SKU × Mês (Clientes Positivados)
                </h3>
                <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
                  Quanto mais verde, mais clientes compraram aquele SKU naquele mês
                </p>
              </div>
              <ExportButton data={batalhaNaval.map(b => ({ sku: b.sku, totalQty: b.totalQty, ...b.months }))} filename="Positivacao_BatalhaNaval" />
            </div>
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 500 }}>
              <table style={{ fontSize: "0.65rem", borderCollapse: "collapse", width: "100%", whiteSpace: "nowrap" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--card-bg, #fff)", zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px", position: "sticky", left: 0, background: "var(--card-bg, #fff)", zIndex: 2, minWidth: 160, borderRight: "2px solid var(--border)" }}>
                      SKU (Produto)
                    </th>
                    {orderedMonths.map(m => {
                      const [_y, _mm] = m.split("-");
                      return (
                        <th key={m} style={{ textAlign: "center", padding: "6px 4px", minWidth: 42, fontSize: "0.6rem", fontWeight: 600 }}>
                          {MONTHS[parseInt(_mm)-1].slice(0,3)}<br/><span style={{ fontWeight: 400, opacity: 0.6 }}>{_y.slice(2)}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {batalhaNaval.length === 0 ? (
                    <tr><td colSpan={months.length + 1} style={{ padding: 16, textAlign: "center", color: "var(--foreground-muted)" }}>Nenhum dado encontrado</td></tr>
                  ) : (
                    batalhaNaval.map((row, i) => {
                      // Calcula pior e segundo pior da linha (valores > 0)
                      const rowValues = orderedMonths.map(m => row.months[m] || 0).filter(v => v > 0).sort((a, b) => a - b);
                      const worst = rowValues.length > 0 ? rowValues[0] : 0;
                      const secondWorst = rowValues.length > 1 ? rowValues[1] : -1;

                      return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{
                          textAlign: "left", padding: "5px 10px", fontWeight: 500, fontSize: "0.63rem",
                          position: "sticky", left: 0, background: "var(--card-bg, #fff)", zIndex: 1,
                          borderRight: "2px solid var(--border)",
                          maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis"
                        }}>
                          {row.sku}
                        </td>
                        {orderedMonths.map(m => {
                          const val = row.months[m] || 0;
                          return (
                            <td key={m} style={{
                              textAlign: "center", padding: "4px 2px",
                              background: getRowHeatColor(val, maxHeatValue, worst, secondWorst),
                              color: getTextColor(val, maxHeatValue),
                              fontWeight: val > 0 ? 700 : 400,
                              fontSize: "0.65rem",
                              transition: "background 0.2s"
                            }}>
                              {val > 0 ? val : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );})
                  )}
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
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Matriz</Link>
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Matriz</Link>
        <Link href="/historico-por-matriz" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Hist. p/ Matriz</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab active"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
