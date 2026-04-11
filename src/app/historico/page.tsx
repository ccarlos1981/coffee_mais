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
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
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
  const [filtersLoading, setFiltersLoading] = useState(true);

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

  // Fetch filters matching the identical logic of Vendas
  const fetchFilters = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const res = await fetch(`/api/dashboard/filters?year=${filterEndYear}&month=${filterEndMonth}`);
      const json = await res.json();
      if (json.success) setFilterOptions(json.filters);
    } catch (e) { console.error(e); }
    setFiltersLoading(false);
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
      const res = await fetch(`/api/dashboard/history?${params}`);
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

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchData(); }, [fetchData]);

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

        <div className="cm-nav-right">
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
          <div style={{ position: "relative", marginBottom: 12, height: 14 }}>
            {loading && <div style={{ position: "absolute", right: 0, top: 0, width: 12, height: 12, border: "2px solid var(--accent-gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Faturamento Histórico (Bar Chart) */}
            <div className="glass-card" style={{ padding: 16, height: 320 }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>Faturamento Histórico (R$ 000)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={40} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => (val / 1000).toFixed(0)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--background-card)", borderColor: "var(--border)", borderRadius: 6, fontSize: "0.75rem" }}
                    labelStyle={{ color: "var(--foreground-secondary)", fontWeight: 600, marginBottom: 4 }}
                    formatter={(value) => [formatCurrency(Number(value)), "Fat."]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
                  />
                  <Bar dataKey="fat" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="fat" position="center" angle={-90} fill="#fff" fontSize={9} formatter={(val) => (Number(val) / 1000).toFixed(0)} />
                    {monthlyHistory.map((entry, index) => {
                      const isChosenMonth = (entry.monthKey as string).endsWith(`-${String(filterEndMonth).padStart(2, "0")}`);
                      return (
                        <Cell key={`cell-${index}`} fill={isChosenMonth ? "#2b81d6" : "var(--accent-light)"} />
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
                      style={{ fontSize: "0.6rem" }}
                    >
                      {byFamilia.map((e, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--background-card)", borderColor: "var(--border)", borderRadius: 6, fontSize: "0.75rem" }}
                      formatter={(val) => formatCurrency(Number(val))}
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
                      style={{ fontSize: "0.55rem" }}
                    >
                      {byClient.map((e, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 4) % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--background-card)", borderColor: "var(--border)", borderRadius: 6, fontSize: "0.75rem" }}
                      formatter={(val) => formatCurrency(Number(val))}
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
                <ComposedChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={40} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatNumber(val, 0)} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatCurrency(val)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--background-card)", borderColor: "var(--border)", borderRadius: 6, fontSize: "0.75rem" }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
                  />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.65rem" }} />
                  <Bar yAxisId="left" dataKey="qty" name="Volume (Unid)" fill="#6b8fad" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="qty" position="center" angle={-90} fill="#fff" fontSize={9} formatter={(val) => formatNumber(Number(val), 0)} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="precoUnid" name="Preço/Unid" stroke="var(--danger)" strokeWidth={2} dot={{ r: 3 }}>
                    <LabelList dataKey="precoUnid" position="top" fill="var(--danger)" fontSize={9} formatter={(val) => Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* MaCo e MaCo/Unid */}
            <div className="glass-card" style={{ padding: 16, height: 320 }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 12, textAlign: "center" }}>MaCo (R$ 000) e MaCo Médio (R$/Unid)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <ComposedChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={40} tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => (val / 1000).toFixed(0)} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--foreground-muted)" }} tickFormatter={(val) => formatCurrency(val)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--background-card)", borderColor: "var(--border)", borderRadius: 6, fontSize: "0.75rem" }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
                  />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.65rem" }} />
                  <Bar yAxisId="left" dataKey="maco" name="MaCo" fill="#5a805a" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="maco" position="center" angle={-90} fill="#fff" fontSize={9} formatter={(val) => (Number(val) / 1000).toFixed(0)} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="macoUnid" name="MaCo/Unid" stroke="var(--accent-gold)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </main>
      </div>

      {/* ═══ BOTTOM TAB BAR ═══ */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab active"><History className="bottom-tab-icon" /> Hist.</Link>
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
