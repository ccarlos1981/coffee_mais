"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Filter,
  BarChart3,
  Upload,
  Home,
  DollarSign,
  History,
  Calendar,
  Users,
  TrendingUp,
  PieChart,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";
import { Skeleton, SkeletonChart } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { GlassTooltip } from "@/components/GlassTooltip";
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
  ReferenceLine,
} from "recharts";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const YEARS = [2026, 2025, 2024, 2023, 2022];

const PIE_COLORS = [
  "#c8a96e", "#7d6b45", "#5a805a", "#a0522d",
  "#6b8fad", "#b8860b", "#708090", "#cd853f",
  "#deb887", "#556b2f",
];

interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
}

export default function HistoricoDashboard() {
  const [loading, setLoading] = useState(true);

  // Períodos (Padrão 14 meses)
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const [filterEndYear, setFilterEndYear] = useState(curYear);
  const [filterEndMonth, setFilterEndMonth] = useState(curMonth);
  const startM = curMonth === 1 ? 2 : curMonth - 1;
  const startY = curMonth === 1 ? curYear - 2 : curYear - 1;
  const [filterStartYear, setFilterStartYear] = useState(startY);
  const [filterStartMonth, setFilterStartMonth] = useState(startM);

  // Sidebar filters
  const [filterManager, setFilterManager] = useState<string[]>([]);
  const [filterFamilia, setFilterFamilia] = useState<string[]>([]);
  const [filterUf, setFilterUf] = useState<string[]>([]);
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]);

  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [],
  });

  const [monthlyHistory, setMonthlyHistory] = useState<Record<string, unknown>[]>([]);
  const [byFamilia, setByFamilia] = useState<Record<string, unknown>[]>([]);
  const [byClient, setByClient] = useState<Record<string, unknown>[]>([]);

  // Find the record faturamento value
  const maxFat = monthlyHistory.reduce((max, h) => {
    const val = Number(h.fat || 0);
    return val > max ? val : max;
  }, 0);


  // Fetch filters matching the identical logic of Vendas
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/filters?year=${filterEndYear}&month=${filterEndMonth}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) { console.error(e); }
  }, [filterEndYear, filterEndMonth]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const startDate = `${filterStartYear}-${String(filterStartMonth).padStart(2, "0")}`;
    const endDate = `${filterEndYear}-${String(filterEndMonth).padStart(2, "0")}`;

    const params = new URLSearchParams({ 
      startDate, 
      endDate, 
      investment: "0" 
    });
    if (filterManager.length > 0) params.set("manager", filterManager.join(","));
    if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));
    if (filterUf.length > 0) params.set("uf", filterUf.join(","));
    if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));
    if (filterProduct.length > 0) params.set("product", filterProduct.join(","));

    try {
      const res = await fetch(`/api/dashboard/history?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (json.success) {
        // Prepare monthly mapping for beautiful axis labels
        const mappedHistory = (json.monthlyHistory || []).map((h: Record<string, unknown>) => {
          const monthNum = parseInt((h.monthKey as string).split("-")[1]);
          const monthLabel = MONTHS[monthNum - 1].slice(0, 3);
          const precoUnid = (h.qty as number) > 0 ? (h.fat as number) / (h.qty as number) : 0;
          const macoUnid = (h.qty as number) > 0 ? (h.maco as number) / (h.qty as number) : 0;
          return {
            ...h,
            label: `${monthLabel}/${(h.year as string).slice(2)}`,       // 'Mar/26'
            fullLabel: `${MONTHS[monthNum - 1]} ${h.year}`, // 'Março 2026'
            precoUnid,
            macoUnid
          };
        });
        setMonthlyHistory(mappedHistory);
        setByFamilia(json.byFamilia || []);
        setByClient(json.byClient || []);
      }
    } catch (e) { console.error(e); }
    
    setLoading(false);
  }, [filterStartYear, filterStartMonth, filterEndYear, filterEndMonth, filterManager, filterFamilia, filterUf, filterChannel, filterProduct]);

  useEffect(() => { Promise.resolve().then(() => fetchFilters()); }, [fetchFilters]);
  useEffect(() => { Promise.resolve().then(() => fetchData()); }, [fetchData]);

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
  };

  const hasActiveFilters = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct].some(f => f.length > 0);
  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct].filter(f => f.length > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div className="cm-nav-links">
          <Link href="/vendas" className="cm-nav-link"><BarChart3 style={{ width: 12, height: 12 }} /> Dashboard</Link>
          <Link href="/metas" className="cm-nav-link">Metas</Link>
          <Link href="/upload" className="cm-nav-link"><Upload style={{ width: 12, height: 12 }} /> Upload</Link>
        </div>

        {/* Cnetered Title exactly like Forno */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            Histórico de Vendas
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            ({MONTHS[filterStartMonth-1].slice(0,3)} {filterStartYear} — {MONTHS[filterEndMonth-1].slice(0,3)} {filterEndYear}) — <span style={{ opacity: 0.7 }}>*Valores /1k p/ Fat. e MaCo</span>
          </p>
        </div>

        <div className="cm-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportButton data={monthlyHistory} filename="Historico_Export" />
          <div style={{ fontSize: "0.58rem", color: "var(--foreground-dim)", textAlign: "right", lineHeight: 1.4 }}>
            <div style={{ color: "var(--foreground-muted)" }}>{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* BODY */}
      <div className="dash-body">
        {/* SIDEBAR */}
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0, marginBottom: 4 }}>Período Inicial</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 12 }}>
            <select title="Mês Inicial" value={filterStartMonth} onChange={(e) => setFilterStartMonth(Number(e.target.value))} className="dash-filter-select">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m.slice(0, 3)}</option>)}
            </select>
            <select title="Ano Inicial" value={filterStartYear} onChange={(e) => setFilterStartYear(Number(e.target.value))} className="dash-filter-select">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <p className="dash-sidebar-title" style={{ marginTop: 0, marginBottom: 4 }}>Período Final</p>
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
              {filterManager.length > 0 && <div>Gerente: <strong style={{color:"var(--foreground)"}}>{filterManager.join(", ")}</strong></div>}
              {filterFamilia.length > 0 && <div>Família: <strong style={{color:"var(--foreground)"}}>{filterFamilia.join(", ")}</strong></div>}
              {filterUf.length > 0 && <div>UF: <strong style={{color:"var(--foreground)"}}>{filterUf.join(", ")}</strong></div>}
              {filterChannel.length > 0 && <div>Canal: <strong style={{color:"var(--foreground)"}}>{filterChannel.join(", ")}</strong></div>}
              {filterProduct.length > 0 && <div>SKU: <strong style={{color:"var(--foreground)"}}>{filterProduct.join(", ")}</strong></div>}
            </div>
          )}
        </aside>

        {/* MAIN DASHBOARD */}
        <main className="dash-content">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <SkeletonChart height={320} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                   <div className="glass-card flex items-center justify-center h-[320px]"><Skeleton className="w-[80%] aspect-square rounded-full bg-[var(--border)]" /></div>
                   <div className="glass-card flex items-center justify-center h-[320px]"><Skeleton className="w-[80%] aspect-square rounded-full bg-[var(--border)]" /></div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <SkeletonChart height={320} />
                <SkeletonChart height={320} />
              </div>
            </div>
          ) : monthlyHistory.length === 0 ? (
            <div style={{ padding: "20px 0" }}>
              <EmptyState 
                title="Sem histórico para o período" 
                message="Nenhuma venda registrada com os filtros selecionados. Tente expandir o período ou remover filtros." 
                minHeight={500} 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }} className="animate-stagger">
            {/* Faturamento Histórico (Bar Chart) */}
            <div className="glass-card" style={{ padding: 16, height: 320 }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>Faturamento Histórico (R$ 000)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 15 }}>
                  <defs>
                    <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#b45309" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradFatHighlight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} tick={{ fontSize: 13, fill: "var(--foreground-muted)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "var(--foreground-muted)" }} tickFormatter={(val) => Math.round(val / 1000).toLocaleString("pt-BR")} />
                  <Tooltip
                    content={<GlassTooltip
                      formatter={(value) => [formatCurrency(Number(value)), "Fat."]}
                      labelFormatter={(label, payload) => String(payload?.[0]?.payload?.fullLabel || label)}
                    />}
                    cursor={{ fill: 'var(--border)', opacity: 0.15 }}
                  />
                  {maxFat > 0 && (
                    <ReferenceLine
                      y={maxFat}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={{
                        value: `Record: R$ ${Math.round(maxFat / 1000).toLocaleString("pt-BR")}k`,
                        position: "top",
                        fill: "#ef4444",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                  )}
                  <Bar dataKey="fat" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="fat" position="center" angle={-90} fill="#fff" fontSize={13} fontWeight={600} formatter={(val: unknown) => Math.round(Number(val) / 1000).toLocaleString("pt-BR")} />
                    {monthlyHistory.map((entry, index) => {
                      const isChosenMonth = (entry.monthKey as string).endsWith(`-${String(filterEndMonth).padStart(2, "0")}`);
                      return (
                        <Cell key={`cell-${index}`} fill={isChosenMonth ? "url(#gradFatHighlight)" : "url(#gradFat)"} />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Mix de Produtos e Clientes (Donut) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="glass-card" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: -10, textAlign: "center", position: "relative", zIndex: 1 }}>Mix por Família (Fat.)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie 
                      data={byFamilia} 
                      dataKey="fat" 
                      nameKey="familia" 
                      innerRadius="40%" 
                      outerRadius="65%" 
                      paddingAngle={2}
                      label={({ name = '', percent = 0 }) => `${name.length > 12 ? name.substring(0, 11) + '.' : name} ${(percent * 100).toFixed(1)}%`}
                      labelLine={{ stroke: 'var(--foreground-muted)' }}
                      style={{ fontSize: "0.80rem", fontWeight: 500 }}
                    >
                      {byFamilia.map((e, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val) => [formatCurrency(Number(val)), "Fat."]}
                      />}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card" style={{ padding: 16, height: 320 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: -10, textAlign: "center", position: "relative", zIndex: 1 }}>Top 10 Clientes (Fat.)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie 
                      data={byClient} 
                      dataKey="fat" 
                      nameKey="client" 
                      innerRadius="40%" 
                      outerRadius="65%" 
                      paddingAngle={2}
                      label={({ name = '', percent = 0 }) => `${name.length > 15 ? name.substring(0, 14) + '.' : name} ${(percent * 100).toFixed(1)}%`}
                      labelLine={{ stroke: 'var(--foreground-muted)' }}
                      style={{ fontSize: "0.75rem", fontWeight: 500 }}
                    >
                      {byClient.map((e, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 4) % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      content={<GlassTooltip
                        formatter={(val) => [formatCurrency(Number(val)), "Fat."]}
                      />}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* LOWER CHARTS: Volume/Price & MaCo/Unid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Volume e Preço Medio */}
            <div className="glass-card" style={{ padding: 16, height: 320 }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>Volume (Unid) e Preço Médio (R$/Unid)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <ComposedChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 15 }}>
                  <defs>
                    <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12, fill: "var(--foreground-muted)" }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatNumber(val, 0)} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatCurrency(val)} />
                  <Tooltip
                    content={<GlassTooltip
                      formatter={(val, name) => {
                        if (name === "Preço/Unid") return [Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, style: "currency", currency: "BRL" }), name];
                        if (name === "Volume (Unid)") return [formatNumber(Number(val), 0), name];
                        return [String(val), name];
                      }}
                      labelFormatter={(label, payload) => String(payload?.[0]?.payload?.fullLabel || label)}
                    />}
                    cursor={{ fill: 'var(--border)', opacity: 0.15 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.85rem" }} />
                  <Bar yAxisId="left" dataKey="qty" name="Volume (Unid)" fill="url(#gradVol)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="qty" position="center" angle={-90} fill="#fff" fontSize={11} fontWeight={600} formatter={(val: unknown) => Math.round(Number(val)).toLocaleString("pt-BR")} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="precoUnid" name="Preço/Unid" stroke="#f87171" strokeWidth={2.5} dot={{ r: 3, fill: "#f87171", stroke: "#fff", strokeWidth: 1 }}>
                    <LabelList dataKey="precoUnid" position="top" fill="#f87171" fontSize={11} fontWeight={600} formatter={(val: unknown) => Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* MaCo e MaCo/Unid */}
            <div className="glass-card" style={{ padding: 16, height: 320 }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>MaCo (R$ 000) e MaCo Médio (R$/Unid)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <ComposedChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 15 }}>
                  <defs>
                    <linearGradient id="gradMaco" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12, fill: "var(--foreground-muted)" }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--foreground-muted)" }} tickFormatter={(val) => Math.round(val / 1000).toLocaleString("pt-BR")} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatCurrency(val)} />
                  <Tooltip
                    content={<GlassTooltip
                      formatter={(val, name) => {
                        if (name === "MaCo/Unid") return [Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, style: "currency", currency: "BRL" }), name];
                        if (name === "MaCo") return [formatCurrency(Number(val)), name];
                        return [String(val), name];
                      }}
                      labelFormatter={(label, payload) => String(payload?.[0]?.payload?.fullLabel || label)}
                    />}
                    cursor={{ fill: 'var(--border)', opacity: 0.15 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.85rem" }} />
                  <Bar yAxisId="left" dataKey="maco" name="MaCo" fill="url(#gradMaco)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="maco" position="center" angle={-90} fill="#fff" fontSize={11} fontWeight={600} formatter={(val: unknown) => Math.round(Number(val) / 1000).toLocaleString("pt-BR")} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="macoUnid" name="MaCo/Unid" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: "#fbbf24", stroke: "#fff", strokeWidth: 1 }} />
                </ComposedChart>
              </ResponsiveContainer>
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
        <Link href="/historico" className="bottom-tab active"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/historico-matriz" className="bottom-tab"><History className="bottom-tab-icon" /> Hist. Matriz</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> MaCo</span>
        <Link href="/matriz" className="bottom-tab">
          <Users className="bottom-tab-icon" /> Matriz
        </Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <span className="bottom-tab disabled"><Calendar className="bottom-tab-icon" /> Dia</span>
        <span className="bottom-tab disabled"><PieChart className="bottom-tab-icon" /> Preço</span>
      </nav>
    </div>
  );
}
