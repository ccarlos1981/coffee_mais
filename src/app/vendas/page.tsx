"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import { Filter,
  Bell,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Upload,
  Home,
  DollarSign,
  History,
  Calendar,
  Users,
  Briefcase,
  PieChart,
  Target,
  Package,
  Layers, CheckCircle2, X, Menu } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";
import { normalizeAnalyticsPayload } from "@/lib/governance/analytics";
import {
  CommercialRole,
  isDistributorClient,
  getDrilldownLabel,
  DISTRIBUTORS_REGISTRY,
  OFFICIAL_COMMERCIAL_ROLES,
} from "@/lib/domain/commercial-structure";

/* ───────────────── constants ───────────────── */
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

/* ── Quick Filter Presets ── */
const QUICK_FILTERS: { label: string; type: "manager" | "channel" | "familia"; value: string; color: string }[] = [
  { label: "Leandro (KA)", type: "manager", value: "1001-KA", color: "#6366f1" },
  { label: "Leandro (Dist)", type: "manager", value: "1001-DIST", color: "#4f46e5" },
  { label: "Luiz (KA)", type: "manager", value: "1002-KA", color: "#8b5cf6" },
  { label: "Luiz (Dist)", type: "manager", value: "1002-DIST", color: "#7c3aed" },
  { label: "John (KA)", type: "manager", value: "1003-KA", color: "#10b981" },
  { label: "John (Dist)", type: "manager", value: "1003-DIST", color: "#059669" },
  { label: "Julliano (KA)", type: "manager", value: "1000-KA", color: "#a855f7" },
  { label: "Inside", type: "manager", value: "1004", color: "#ec4899" },
  { label: "KA", type: "channel", value: "KA", color: "#f59e0b" },
  { label: "Distrib.", type: "channel", value: "Distribuidor", color: "#10b981" },
  { label: "Inside S.", type: "channel", value: "Inside Sales", color: "#06b6d4" },
  { label: "Amazon 1P", type: "channel", value: "Amazon 1P", color: "#f97316" },
  { label: "Priv. Label", type: "channel", value: "Private Label", color: "#14b8a6" },
  { label: "1 KG", type: "familia", value: "1 KG", color: "#c8a96e" },
  { label: "5 KG", type: "familia", value: "5 KG", color: "#7d6b45" },
  { label: "Cápsula", type: "familia", value: "Cápsula", color: "#5a805a" },
  { label: "Drip", type: "familia", value: "Drip", color: "#6b8fad" },
];

const MANAGER_NAME_TO_ID: Record<string, string> = {
  "Leandro": "1001",
  "Leandro (KA)": "1001-KA",
  "Leandro (Dist)": "1001-DIST",
  "Leandro Saffi": "1001",
  "Luiz": "1002",
  "Luiz (KA)": "1002-KA",
  "Luiz (Dist)": "1002-DIST",
  "John Guedes": "1003",
  "John Guedes (KA)": "1003-KA",
  "John Guedes (Dist)": "1003-DIST",
  "John": "1003",
  "Julliano": "1000",
  "Julliano (KA)": "1000-KA",
  "Inside Sales": "1004",
  "Ecommerce": "1005",
  "Marketplace": "1006",
  "Distribuidor": "1007",
  "Amazon 1P": "1008",
  "Private Label": "1009",
};

// Canais que mapeiam diretamente para um manager de mesmo nome
const STANDALONE_CHANNEL_MANAGERS = new Set(['Ecommerce', 'Marketplace', 'Inside Sales', 'Amazon 1P', 'Private Label', 'Distribuidor']);

/* ───────────────── types ───────────────── */
interface FiltersData {
  managers: string[];
  familias: string[];
  ufs: string[];
  channels: string[];
  products: string[];
}

interface ClientRow {
  client: string;
  fat: number;
  qty: number;
  maco: number;
}

interface ManagerData {
  manager: string;
  manager_id?: string;
  role?: CommercialRole;
  fat: number;
  qty: number;
  maco: number;
  vendaFutura?: number;
  paceFat?: number;
  paceQty?: number;
  paceMaco?: number;
  topClients: TopClientRow[];
}

interface TopClientRow extends ClientRow {
  prevMonthFat: number;
  prevYearFat: number;
}

interface FamiliaData {
  familia: string;
  fat: number;
  qty: number;
  pct: number;
}

interface TargetRecord {
  manager: string;
  manager_id?: string;
  target_revenue: number | null;
  target_tons: number | null;
  target_maco: number | null;
}

interface ManagerRow extends ManagerData {
  metaFat: number;
  metaUnd: number;
  metaMaco: number;
}

/* ───────────────── COMPONENT ───────────────── */
export default function VendasDashboard() {
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Período
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);

  // Sidebar filters (persisted and synced)
  const [filterManager, setFilterManager] = usePersistedState<string[]>("db_filter_manager", []);
  const [filterFamilia, setFilterFamilia] = usePersistedState<string[]>("db_filter_familia", []);
  const [filterUf, setFilterUf] = usePersistedState<string[]>("db_filter_uf", []);
  const [filterChannel, setFilterChannel] = usePersistedState<string[]>("db_filter_channel", []);
  const [filterProduct, setFilterProduct] = usePersistedState<string[]>("db_filter_product", []);

  // Dynamic filter options
  const [filterOptions, setFilterOptions] = useState<FiltersData>({
    managers: [], familias: [], ufs: [], channels: [], products: [],
  });

  // Data
  const [managerRows, setManagerRows] = useState<ManagerRow[]>([]);
  const [familiaData, setFamiliaData] = useState<FamiliaData[]>([]);
  const [businessDays, setBusinessDays] = useState<{ total_days: number; elapsed_days: number } | null>(null);
  const [previousMonth, setPreviousMonth] = useState({ fat: 0, qty: 0, maco: 0 });
  const [previousYear, setPreviousYear] = useState({ fat: 0, qty: 0, maco: 0 });

  // Drill-down state
  const [expandedManager, setExpandedManager] = useState<string | null>(null);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

  // Mobile Drawers
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  /* ─── Fetch filters ─── */
  useEffect(() => {
    let active = true;
    async function loadFilters() {
      setFiltersLoading(true);
      try {
        const res = await fetch(`/api/dashboard/filters?year=${filterYear}&month=${filterMonth}`);
        const json = await res.json();
        if (active && json.success) {
          setFilterOptions(json.filters);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setFiltersLoading(false);
      }
    }
    loadFilters();
    return () => {
      active = false;
    };
  }, [filterYear, filterMonth]);

  /* ─── Fetch data ─── */
  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      const startDate = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(filterYear, filterMonth, 0).getDate();
      const endDate = `${filterYear}-${String(filterMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      try {
        const params: Record<string, string> = {
          startDate,
          endDate,
          investment: "0",
        };
        if (filterManager.length > 0) {
          const mappedIds = filterManager.map(m => MANAGER_NAME_TO_ID[m] || m);
          params.manager_id = mappedIds.join(',');
        }
        if (filterFamilia.length > 0) params.familia = filterFamilia.join(',');
        if (filterUf.length > 0) params.uf = filterUf.join(',');
        if (filterChannel.length > 0) params.channel = filterChannel.join(',');
        if (filterProduct.length > 0) params.product = filterProduct.join(',');

        const [bdRes, targetRes, apiRes] = await Promise.all([
          supabase
            .from("business_days")
            .select("*")
            .eq("year", filterYear)
            .eq("month", filterMonth)
            .single(),
          supabase
            .from("targets")
            .select("*")
            .eq("year", filterYear)
            .eq("month", filterMonth),
          fetch(`/api/dashboard?${new URLSearchParams(params)}`, { cache: "no-store" })
        ]);

        if (!active) return;

        setBusinessDays(bdRes.data || null);
        const allTargets: TargetRecord[] = targetRes.data || [];

        const rawJson = await apiRes.json();
        if (!active) return;

        const payload = normalizeAnalyticsPayload<ManagerData, FamiliaData>(rawJson);

        if (payload.success) {
          const byManager: ManagerData[] = payload.byManager;
          setFamiliaData(payload.byFamilia);
          
          const pm = payload.previousMonth;
          setPreviousMonth({ fat: Number(pm.fat || 0), qty: Number(pm.qty || 0), maco: 0 });
          
          const py = payload.previousYear;
          setPreviousYear({ fat: Number(py.fat || 0), qty: Number(py.qty || 0), maco: 0 });

          const getManagerId = (t: { manager: string; manager_id?: string | null }) => {
            if (t.manager_id) return t.manager_id;
            return MANAGER_NAME_TO_ID[t.manager] || '9999';
          };

          const allManagerIds = new Set<string>();
          allTargets.forEach(t => {
            allManagerIds.add(getManagerId(t));
          });
          byManager.forEach(m => {
            allManagerIds.add(getManagerId(m));
          });

          const rows: ManagerRow[] = [];
          allManagerIds.forEach(mId => {
            const sales = byManager.find(s => getManagerId(s) === mId);
            const target = allTargets.find(t => getManagerId(t) === mId);
            const mName = sales?.manager || target?.manager || 'Outros';

            const distDef = DISTRIBUTORS_REGISTRY[mId];
            if (distDef) {
              // Gerente possui cadastro no domínio de Commercial Roles (Luiz, John Guedes, Leandro, Julliano)
              const allClients = (sales?.topClients || []).map(c => ({ ...c, maco: 0 }));
              const distClients = allClients.filter(c => isDistributorClient(c, mId));
              const kaClients = allClients.filter(c => !isDistributorClient(c, mId));

              // Linha KA
              const kaLabel = `${mName} (KA)`;
              const kaKey = `${mId}-KA`;
              if (filterManager.length === 0 || filterManager.includes(kaKey) || filterManager.includes(kaLabel) || filterManager.includes(mId) || filterManager.includes(mName)) {
                if (filterChannel.length === 0 || filterChannel.includes("KA")) {
                  const kaFat = kaClients.reduce((acc, c) => acc + (c.fat || 0), 0);
                  const kaQty = kaClients.reduce((acc, c) => acc + (c.qty || 0), 0);
                  rows.push({
                    manager: kaLabel,
                    manager_id: kaKey,
                    role: "KA",
                    fat: kaClients.length > 0 ? kaFat : (distClients.length === 0 ? (sales?.fat || 0) : 0),
                    qty: kaClients.length > 0 ? kaQty : (distClients.length === 0 ? (sales?.qty || 0) : 0),
                    maco: 0,
                    vendaFutura: sales?.vendaFutura || 0,
                    paceFat: sales?.paceFat || 0,
                    paceQty: sales?.paceQty || 0,
                    paceMaco: 0,
                    topClients: kaClients,
                    metaFat: target?.target_revenue || 0,
                    metaUnd: target?.target_tons || 0,
                    metaMaco: 0,
                  });
                }
              }

              // Linha DIST (apenas se possuir distribuidores cadastrados no domínio)
              if (distDef.redes.length > 0 || distDef.partnerCodes.length > 0) {
                const distLabel = `${mName} (Dist)`;
                const distKey = `${mId}-DIST`;
                if (filterManager.length === 0 || filterManager.includes(distKey) || filterManager.includes(distLabel)) {
                  if (filterChannel.length === 0 || filterChannel.includes("Distribuidor")) {
                    const distFat = distClients.reduce((acc, c) => acc + (c.fat || 0), 0);
                    const distQty = distClients.reduce((acc, c) => acc + (c.qty || 0), 0);
                    rows.push({
                      manager: distLabel,
                      manager_id: distKey,
                      role: "DIST",
                      fat: distFat,
                      qty: distQty,
                      maco: 0,
                      vendaFutura: 0,
                      paceFat: 0,
                      paceQty: 0,
                      paceMaco: 0,
                      topClients: distClients,
                      metaFat: 0,
                      metaUnd: 0,
                      metaMaco: 0,
                    });
                  }
                }
              }
            } else {
              // Gerente sem segregação comercial de roles (ex: Inside Sales, Ecommerce, Marketplace, etc.)
              if (filterManager.length > 0 && !filterManager.includes(mId) && !filterManager.includes(mName)) return;

              if (filterChannel.length > 0) {
                if (STANDALONE_CHANNEL_MANAGERS.has(mName) && !filterChannel.includes(mName)) return;
              }

              rows.push({
                manager: mName,
                manager_id: mId,
                role: "KA",
                fat: sales?.fat || 0,
                qty: sales?.qty || 0,
                maco: 0,
                vendaFutura: sales?.vendaFutura || 0,
                paceFat: sales?.paceFat || 0,
                paceQty: sales?.paceQty || 0,
                paceMaco: 0,
                topClients: (sales?.topClients || []).map(c => ({ ...c, maco: 0 })),
                metaFat: target?.target_revenue || 0,
                metaUnd: target?.target_tons || 0,
                metaMaco: 0,
              });
            }
          });

          rows.sort((a, b) => {
            const pA = a.metaFat > 0 ? (a.fat / a.metaFat) * 100 : -1;
            const pB = b.metaFat > 0 ? (b.fat / b.metaFat) * 100 : -1;
            
            if (pA === pB) return b.fat - a.fat;
            return pB - pA;
          });
          setManagerRows(rows);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [filterYear, filterMonth, filterManager, filterFamilia, filterUf, filterChannel, filterProduct]);

  useEffect(() => {
    async function initDefaultPeriod() {
      try {
        const res = await fetch("/api/dashboard/filters");
        const json = await res.json();
        if (json.success && json.latestPeriod) {
          setFilterYear(json.latestPeriod.year);
          setFilterMonth(json.latestPeriod.month);
        }
      } catch (err) {
        console.error("Error adjusting default period:", err);
      }
    }
    initDefaultPeriod();
  }, []);

  const renderSidebarContent = () => {
    return (
      <>
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
        <MultiSelect value={filterManager} onChange={setFilterManager} options={filterOptions.managers} className="dash-filter-select" placeholder="Todos" />

        <p className="dash-sidebar-title">Família</p>
        <MultiSelect value={filterFamilia} onChange={setFilterFamilia} options={filterOptions.familias} className="dash-filter-select" placeholder="Todas" />

        <p className="dash-sidebar-title">Região (UF)</p>
        <MultiSelect value={filterUf} onChange={setFilterUf} options={filterOptions.ufs} className="dash-filter-select" placeholder="Todos" />

        <p className="dash-sidebar-title">Canal</p>
        <MultiSelect value={filterChannel} onChange={setFilterChannel} options={filterOptions.channels} className="dash-filter-select" placeholder="Todos" />

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

        <ExportButton 
          data={managerRows.flatMap(m => m.topClients.map(c => ({
            Gerente: m.manager,
            Cliente: c.client,
            Faturamento_R$: Number(c.fat.toFixed(2)),
            Volume_un: c.qty,
            Margem_Maco_R$: Number((c.maco || 0).toFixed(2)),
            Mes_Anterior_R$: Number((c.prevMonthFat || 0).toFixed(2)),
            Ano_Anterior_R$: Number((c.prevYearFat || 0).toFixed(2))
          })))}
          filename={`Painel_Vendas_${MONTHS[filterMonth - 1]}`}
          className="w-full mt-4 justify-center"
          variant="outline"
        />

        {hasActiveFilters && (
          <div className="sidebar-info-box">
            {filterManager.length > 0 && <div>Gerente: <strong style={{color:"var(--foreground)"}}>{filterManager.join(", ")}</strong></div>}
            {filterFamilia.length > 0 && <div>Família: <strong style={{color:"var(--foreground)"}}>{filterFamilia.join(", ")}</strong></div>}
            {filterUf.length > 0 && <div>UF: <strong style={{color:"var(--foreground)"}}>{filterUf.join(", ")}</strong></div>}
            {filterChannel.length > 0 && <div>Canal: <strong style={{color:"var(--foreground)"}}>{filterChannel.join(", ")}</strong></div>}
            {filterProduct.length > 0 && <div>SKU: <strong style={{color:"var(--foreground)"}}>{filterProduct.join(", ")}</strong></div>}
          </div>
        )}


      </>
    );
  };

  /* ─── Totals ─── */
  const totals = useMemo(() => {
    return managerRows.reduce(
      (acc, r) => ({
        metaFat: acc.metaFat + r.metaFat,
        fat: acc.fat + r.fat,
        vendaFutura: acc.vendaFutura + (r.vendaFutura || 0),
        metaUnd: acc.metaUnd + r.metaUnd,
        qty: acc.qty + r.qty,
        metaMaco: acc.metaMaco + r.metaMaco,
        maco: acc.maco + r.maco,
        paceFat: acc.paceFat + (r.paceFat || 0),
        paceQty: acc.paceQty + (r.paceQty || 0),
        paceMaco: acc.paceMaco + (r.paceMaco || 0),
      }),
      { metaFat: 0, fat: 0, vendaFutura: 0, metaUnd: 0, qty: 0, metaMaco: 0, maco: 0, paceFat: 0, paceQty: 0, paceMaco: 0 }
    );
  }, [managerRows]);

  const pct = (real: number, meta: number) => (meta > 0 ? (real / meta) * 100 : 0);
  const pctColor = (val: number) => (val >= 100 ? "var(--success)" : val >= 80 ? "var(--warning)" : "var(--danger)");

  const timeElapsedPct = useMemo(() => {
    if (!businessDays || !businessDays.total_days) return 0;
    return (businessDays.elapsed_days / businessDays.total_days) * 100;
  }, [businessDays]);

  const getPctStyle = (valPct: number, metaVal: number) => {
    if (metaVal <= 0) return { color: "var(--foreground-dim)" };
    if (valPct >= 100) {
      return { backgroundColor: "rgba(34, 197, 94, 0.9)", color: "#000", fontWeight: 700 };
    } else if (valPct >= 80) {
      return { backgroundColor: "rgba(234, 179, 8, 0.9)", color: "#000", fontWeight: 700 };
    } else {
      return { backgroundColor: "rgba(239, 68, 68, 0.9)", color: "#fff", fontWeight: 700 };
    }
  };

  const faturamentoPct = pct(totals.fat, totals.metaFat);

  const compareVariation = (current: number, previous: number) => {
    if (previous === 0) return { pct: 0, direction: "neutral" as const };
    const variation = ((current - previous) / previous) * 100;
    return {
      pct: Math.abs(variation),
      direction: variation > 0 ? "up" as const : variation < 0 ? "down" as const : "neutral" as const,
    };
  };

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
    setActiveQuickFilter(null);
  };

  const handleQuickFilter = (qf: typeof QUICK_FILTERS[number]) => {
    const key = `${qf.type}:${qf.value}`;
    if (activeQuickFilter === key) {
      // Toggle off
      handleClearFilters();
      return;
    }
    // Reset all, then apply
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterProduct([]);
    if (qf.type === "manager") setFilterManager([qf.value]);
    else if (qf.type === "channel") setFilterChannel([qf.value]);
    else if (qf.type === "familia") setFilterFamilia([qf.value]);
    setActiveQuickFilter(key);
  };

  const hasActiveFilters =
    filterManager.length > 0 || filterFamilia.length > 0 ||
    filterUf.length > 0 || filterChannel.length > 0 || filterProduct.length > 0;

  const toggleDrillDown = (manager: string) => {
    setExpandedManager(expandedManager === manager ? null : manager);
  };

  const activeFilterCount = [filterManager, filterFamilia, filterUf, filterChannel, filterProduct]
    .filter(f => f.length > 0).length;

  /* ═════════════════ RENDER ═════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* ═══ NAVBAR — Coffee++ style ═══ */}
      <nav className="cm-navbar">
        {/* Row 1: Logo + Links (Desktop) / Logo + Toggle (Mobile) */}
        <div className="cm-navbar-top-row">
          <Link href="/" className="cm-logo">
            Coffee<span>++</span>
          </Link>

          <div className="cm-nav-links">
            <Link href="/vendas" className="cm-nav-link active">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <BarChart3 style={{ width: 12, height: 12 }} /> Dashboard
              </span>
            </Link>
            <Link href="/metas" className="cm-nav-link">Metas</Link>
            <Link href="/upload" className="cm-nav-link">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Upload style={{ width: 12, height: 12 }} /> Upload
              </span>
            </Link>
            <Link href="/atendimento" className="cm-nav-link">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Users style={{ width: 12, height: 12 }} /> Atendimento
              </span>
            </Link>
          </div>

          {/* Centered Title — Desktop Only */}
          <div className="desktop-only cm-navbar-center-title">
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
              Resumo do Mês
            </h1>
            <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
              {MONTHS[filterMonth - 1]} {filterYear} — <span style={{ opacity: 0.7 }}>*Valores /1k</span>
            </p>
          </div>

          <div className="cm-nav-right">
            {businessDays && (
              <div className="desktop-only" style={{ fontSize: "0.62rem", color: "var(--foreground-muted)", textAlign: "right" }}>
                <span style={{ color: "var(--foreground-secondary)" }}>
                  {businessDays.elapsed_days}/{businessDays.total_days}
                </span>
                {" "}dias úteis
              </div>
            )}
            <div className="desktop-only" style={{
              fontSize: "0.58rem", color: "var(--foreground-dim)", textAlign: "right", lineHeight: 1.4,
            }}>
              <div style={{ color: "var(--foreground-muted)" }}>
                {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </div>
            </div>

            {/* Theme Toggle is always on the top row */}
            <ThemeToggle />
          </div>
        </div>

        {/* Row 2: Mobile only, containing filters sandwich on left, Resumo do mês in center, summary trigger on right */}
        <div className="cm-navbar-mobile-row">
          <button 
            onClick={() => setIsFiltersOpen(true)} 
            className="mobile-sandwich-btn"
            title="Filtros"
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>

          <div className="cm-navbar-mobile-title">
            <h1>Resumo do Mês</h1>
            <p>
              {MONTHS[filterMonth - 1]} {filterYear} — <span>*Valores /1k</span>
            </p>
          </div>

          <button 
            onClick={() => setIsSummaryOpen(true)} 
            className="mobile-summary-trigger-btn"
            title="Resumo do Mês"
          >
            <BarChart3 style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </nav>

      {/* ═══ BODY: SIDEBAR + MAIN ═══ */}
      <div className="dash-body">
        {/* ═══ SIDEBAR — Filtros Verticais ═══ */}
        <aside className="dash-sidebar desktop-only">
          {renderSidebarContent()}
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="cm-main" style={{ paddingTop: 4 }}>
          {loading && <div style={{ position: "absolute", right: 16, top: 8, width: 12, height: 12, border: "2px solid var(--accent-gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}

        {/* ═══ QUICK FILTER BUTTONS ═══ */}
        <div className="quick-filter-bar">
          <button
            className={`qf-btn qf-btn-clear ${!activeQuickFilter ? 'active' : ''}`}
            onClick={handleClearFilters}
          >
            TODOS
          </button>
          {QUICK_FILTERS.map((qf) => {
            const key = `${qf.type}:${qf.value}`;
            const isActive = activeQuickFilter === key;
            return (
              <button
                key={key}
                className={`qf-btn ${isActive ? 'active' : ''}`}
                style={{
                  '--qf-color': qf.color,
                  '--qf-bg': isActive ? qf.color : 'transparent',
                } as React.CSSProperties}
                onClick={() => handleQuickFilter(qf)}
              >
                {qf.label}
              </button>
            );
          })}
        </div>

        {/* ═══ TOP SECTION: KPIs + Gauge + Pie ═══ */}
        <div className="desktop-only">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 240px", gap: 14, marginBottom: 16 }}>
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              {/* FATURAMENTO */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <KPICard label="Meta Fat." value={formatCurrency(totals.metaFat / 1000, 0)} variant="meta" />
                <KPICard
                  label="Real Fat."
                  value={formatCurrency(totals.fat / 1000, 0)}
                  variant="real"
                  pctVal={pct(totals.fat, totals.metaFat)}
                  compare={compareVariation(totals.fat, previousMonth.fat)}
                  compareLabel="mês ant."
                />
              </div>
              
              {/* UNIDADES */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <KPICard label="Meta Unid." value={formatNumber(totals.metaUnd, 0)} variant="meta" />
                <KPICard
                  label="Real Unid."
                  value={formatNumber(totals.qty, 0)}
                  variant="real"
                  pctVal={pct(totals.qty, totals.metaUnd)}
                  compare={compareVariation(totals.qty, previousMonth.qty)}
                  compareLabel="mês ant."
                />
              </div>

              {/* MACO */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <KPICard label="Meta MaCo" value={formatCurrency(totals.metaMaco / 1000, 0)} variant="meta" />
                <KPICard
                  label="Real MaCo"
                  value={formatCurrency(totals.maco / 1000, 0)}
                  variant="real"
                  pctVal={pct(totals.maco, totals.metaMaco)}
                  compare={compareVariation(totals.maco, previousYear.maco)}
                  compareLabel="ano ant."
                />
              </div>
            </div>

            {/* Gauge */}
            <div className="glass-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
              <GaugeChart value={faturamentoPct} label="Atingimento" />
            </div>

            {/* Pie */}
            <div className="glass-card" style={{ padding: 14 }}>
              <DonutChart data={familiaData} />
            </div>
          </div>
        </div>

        {/* ═══ Pace Row ═══ */}
        <div className="desktop-only">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
            <MiniStat label="Pace Fat." value={formatCurrency(totals.paceFat / 1000)} color="var(--foreground)" />
            <MiniStat label="Pace Unid." value={formatNumber(totals.paceQty, 0)} color="var(--foreground)" />
            <MiniStat label="Pace MaCo" value={formatCurrency(totals.paceMaco / 1000)} color="var(--foreground)" />
            <MiniStat
              label={`vs ${MONTHS[((filterMonth - 2) + 12) % 12].slice(0,3)}`}
              value={`${compareVariation(totals.fat, previousMonth.fat).direction === "up" ? "+" : "-"}${compareVariation(totals.fat, previousMonth.fat).pct.toFixed(1)}%`}
              color={compareVariation(totals.fat, previousMonth.fat).direction === "up" ? "var(--success)" : "var(--danger)"}
            />
            <MiniStat
              label={`vs ${MONTHS[filterMonth - 1].slice(0,3)} ${filterYear - 1}`}
              value={`${compareVariation(totals.fat, previousYear.fat).direction === "up" ? "+" : "-"}${compareVariation(totals.fat, previousYear.fat).pct.toFixed(1)}%`}
              color={compareVariation(totals.fat, previousYear.fat).direction === "up" ? "var(--success)" : "var(--danger)"}
            />
          </div>
        </div>

        {/* ═══ MAIN TABLE (DESKTOP) ═══ */}
        <div className="desktop-only">
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Gerente</th>
                    <th colSpan={7} className="col-group-fat col-divider" style={{ textAlign: "center", borderBottom: "2px solid var(--accent-gold)" }}>Faturamento (R$)</th>
                    <th colSpan={3} className="col-group-und col-divider" style={{ textAlign: "center", borderBottom: "2px solid var(--border-light)" }}>Unidades</th>
                    <th colSpan={4} className="col-group-maco col-divider" style={{ textAlign: "center", borderBottom: "2px solid #5a805a" }}>MaCo (R$)</th>
                  </tr>
                  <tr>
                    <th className="col-group-fat col-divider">Meta</th>
                    <th className="col-group-fat">Real</th>
                    <th className="col-group-fat">%</th>
                    <th className="col-group-fat">Pace</th>
                    <th className="col-group-fat">Venda Fut.</th>
                    <th className="col-group-fat">Fat + Venda Fut.</th>
                    <th className="col-group-fat">%Ating.</th>
                    <th className="col-group-und col-divider">Meta</th>
                    <th className="col-group-und">Real</th>
                    <th className="col-group-und">%</th>
                    <th className="col-group-maco col-divider">Meta</th>
                    <th className="col-group-maco">Real</th>
                    <th className="col-group-maco">%</th>
                    <th className="col-group-maco">Pace</th>
                  </tr>
                </thead>
                <tbody>
                  {managerRows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={15} style={{ textAlign: "center", padding: 40, color: "var(--foreground-dim)" }}>
                        Sem dados para o período selecionado
                      </td>
                    </tr>
                  ) : (
                    <>
                      {managerRows.map((row) => {
                        const pFat = pct(row.fat, row.metaFat);
                        const pUnd = pct(row.qty, row.metaUnd);
                        const pMaco = pct(row.maco, row.metaMaco);
                        const isExpanded = expandedManager === row.manager;

                        return [
                          <tr key={row.manager}>
                            <td onClick={() => toggleDrillDown(row.manager)} style={{ cursor: "pointer" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <ChevronRight style={{
                                  width: 12, height: 12, color: "var(--foreground-muted)",
                                  transition: "transform 0.2s",
                                  transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                                }} />
                                {row.manager}
                              </span>
                            </td>
                            <td className="col-divider">{formatCurrency(row.metaFat / 1000)}</td>
                            <td>{formatCurrency(row.fat / 1000)}</td>
                            <td className="pct-cell" style={getPctStyle(pFat, row.metaFat)}>
                              {row.metaFat > 0 ? formatPercent(pFat) : "-"}
                            </td>
                            <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                              {row.paceFat && row.paceFat > 0 ? formatCurrency(row.paceFat / 1000) : "-"}
                            </td>
                            <td>{formatCurrency((row.vendaFutura || 0) / 1000)}</td>
                            <td>{formatCurrency(((row.paceFat || 0) + (row.vendaFutura || 0)) / 1000)}</td>
                            <td className="pct-cell" style={getPctStyle(pct((row.paceFat || 0) + (row.vendaFutura || 0), row.metaFat), row.metaFat)}>
                              {row.metaFat > 0 ? formatPercent(pct((row.paceFat || 0) + (row.vendaFutura || 0), row.metaFat)) : "-"}
                            </td>
                            <td className="col-divider">{formatNumber(row.metaUnd, 0)}</td>
                            <td>{formatNumber(row.qty, 0)}</td>
                            <td className="pct-cell" style={getPctStyle(pUnd, row.metaUnd)}>
                              {row.metaUnd > 0 ? formatPercent(pUnd) : "-"}
                            </td>
                            <td className="col-divider">{formatCurrency(row.metaMaco / 1000)}</td>
                            <td>{formatCurrency(row.maco / 1000)}</td>
                            <td className="pct-cell" style={getPctStyle(pMaco, row.metaMaco)}>
                              {row.metaMaco > 0 ? formatPercent(pMaco) : "-"}
                            </td>
                            <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                              {row.paceMaco && row.paceMaco > 0 ? formatCurrency(row.paceMaco / 1000) : "-"}
                            </td>
                          </tr>,
                          isExpanded && (
                            <tr key={`${row.manager}-drill`} className="drill-down-row">
                              <td colSpan={15}>
                                <div className="drill-down-container">
                                  <p style={{
                                    fontSize: "0.65rem", fontWeight: 600, color: "var(--foreground-secondary)",
                                    textTransform: "uppercase", letterSpacing: "0.1em",
                                    marginBottom: 8,
                                  }}>
                                    {getDrilldownLabel(row.role, row.manager)}
                                  </p>
                                  {row.topClients.length === 0 ? (
                                    <p style={{ fontSize: "0.7rem", color: "var(--foreground-dim)" }}>{row.role === 'DIST' ? 'Sem distribuidores no período.' : 'Sem matrizes no período.'}</p>
                                  ) : (
                                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                                      <table className="drill-table">
                                        <thead>
                                          <tr>
                                            <th style={{ width: 30 }}>#</th>
                                            <th>{row.role === 'DIST' ? 'Distribuidor' : 'Matriz'}</th>
                                            <th>Faturamento</th>
                                            <th>vs Mês Ant.</th>
                                            <th>vs Ano Ant.</th>
                                            <th>Unidades</th>
                                            <th>MaCo</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {row.topClients.map((c: TopClientRow, i: number) => {
                                            const vsPM = c.prevMonthFat > 0 ? ((c.fat - c.prevMonthFat) / c.prevMonthFat) * 100 : null;
                                            const vsPY = c.prevYearFat > 0 ? ((c.fat - c.prevYearFat) / c.prevYearFat) * 100 : null;
                                            return (
                                              <tr key={i}>
                                                <td style={{ textAlign: "center", color: "var(--foreground-dim)", fontWeight: 600 }}>{i + 1}</td>
                                                <td>{c.client}</td>
                                                <td>{formatCurrency(c.fat / 1000)}</td>
                                                <td style={{ color: vsPM === null ? "var(--foreground-dim)" : vsPM >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600, fontSize: "0.65rem" }}>
                                                  {vsPM === null ? "—" : `${vsPM >= 0 ? "+" : ""}${vsPM.toFixed(1)}%`}
                                                </td>
                                                <td style={{ color: vsPY === null ? "var(--foreground-dim)" : vsPY >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600, fontSize: "0.65rem" }}>
                                                  {vsPY === null ? "—" : `${vsPY >= 0 ? "+" : ""}${vsPY.toFixed(1)}%`}
                                                </td>
                                                <td>{formatNumber(c.qty, 0)}</td>
                                                <td>{formatCurrency(c.maco / 1000)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ),
                        ];
                      })}

                      {managerRows.length > 0 && (
                        <tr className="row-total">
                          <td>TOTAL</td>
                          <td className="col-divider">{formatCurrency(totals.metaFat / 1000)}</td>
                          <td>{formatCurrency(totals.fat / 1000)}</td>
                          <td className="pct-cell" style={getPctStyle(pct(totals.fat, totals.metaFat), totals.metaFat)}>
                            {totals.metaFat > 0 ? formatPercent(pct(totals.fat, totals.metaFat)) : "-"}
                          </td>
                          <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                            {totals.paceFat > 0 ? formatCurrency(totals.paceFat / 1000) : "-"}
                          </td>
                          <td>{formatCurrency((totals.vendaFutura || 0) / 1000)}</td>
                          <td>{formatCurrency(((totals.paceFat || 0) + (totals.vendaFutura || 0)) / 1000)}</td>
                          <td className="pct-cell" style={getPctStyle(pct((totals.paceFat || 0) + (totals.vendaFutura || 0), totals.metaFat), totals.metaFat)}>
                            {totals.metaFat > 0 ? formatPercent(pct((totals.paceFat || 0) + (totals.vendaFutura || 0), totals.metaFat)) : "-"}
                          </td>
                          <td className="col-divider">{formatNumber(totals.metaUnd, 0)}</td>
                          <td>{formatNumber(totals.qty, 0)}</td>
                          <td className="pct-cell" style={getPctStyle(pct(totals.qty, totals.metaUnd), totals.metaUnd)}>
                            {totals.metaUnd > 0 ? formatPercent(pct(totals.qty, totals.metaUnd)) : "-"}
                          </td>
                          <td className="col-divider">{formatCurrency(totals.metaMaco / 1000)}</td>
                          <td>{formatCurrency(totals.maco / 1000)}</td>
                          <td className="pct-cell" style={getPctStyle(pct(totals.maco, totals.metaMaco), totals.metaMaco)}>
                            {totals.metaMaco > 0 ? formatPercent(pct(totals.maco, totals.metaMaco)) : "-"}
                          </td>
                          <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                            {totals.paceMaco > 0 ? formatCurrency(totals.paceMaco / 1000) : "-"}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═══ MAIN TABLES (MOBILE STACKED) ═══ */}
        <div className="mobile-only" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* Table 1: Faturamento (R$) */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 4, height: 16, backgroundColor: "var(--accent-gold)", borderRadius: 2 }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-gold)" }}>
                  Faturamento (R$)
                </span>
              </div>
              <div className="glass-card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Gerente</th>
                      <th>Meta</th>
                      <th>Real</th>
                      <th>%</th>
                      <th>Pace</th>
                      <th>Venda Fut.</th>
                      <th>Fat + Vd Fut</th>
                      <th>%Ating.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerRows.length === 0 && !loading ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--foreground-dim)", fontSize: "0.75rem" }}>
                          Sem dados para o período selecionado
                        </td>
                      </tr>
                    ) : (
                      <>
                        {managerRows.map((row) => {
                          const pFat = pct(row.fat, row.metaFat);
                          const isExpanded = expandedManager === row.manager;
                          return [
                            <tr key={row.manager}>
                              <td onClick={() => toggleDrillDown(row.manager)} style={{ cursor: "pointer" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <ChevronRight style={{
                                    width: 12, height: 12, color: "var(--foreground-muted)",
                                    transition: "transform 0.2s",
                                    transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                                  }} />
                                  {row.manager}
                                </span>
                              </td>
                              <td>{formatCurrency(row.metaFat / 1000)}</td>
                              <td>{formatCurrency(row.fat / 1000)}</td>
                              <td className="pct-cell" style={getPctStyle(pFat, row.metaFat)}>
                                {row.metaFat > 0 ? formatPercent(pFat) : "-"}
                              </td>
                              <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                                {row.paceFat && row.paceFat > 0 ? formatCurrency(row.paceFat / 1000) : "-"}
                              </td>
                              <td>{formatCurrency((row.vendaFutura || 0) / 1000)}</td>
                              <td>{formatCurrency(((row.paceFat || 0) + (row.vendaFutura || 0)) / 1000)}</td>
                              <td className="pct-cell" style={getPctStyle(pct((row.paceFat || 0) + (row.vendaFutura || 0), row.metaFat), row.metaFat)}>
                                {row.metaFat > 0 ? formatPercent(pct((row.paceFat || 0) + (row.vendaFutura || 0), row.metaFat)) : "-"}
                              </td>
                            </tr>,
                            isExpanded && (
                              <tr key={`${row.manager}-drill`} className="drill-down-row">
                                <td colSpan={8}>
                                  <div className="drill-down-container" style={{ padding: 8 }}>
                                    <p style={{
                                      fontSize: "0.65rem", fontWeight: 600, color: "var(--foreground-secondary)",
                                      textTransform: "uppercase", letterSpacing: "0.1em",
                                      marginBottom: 8,
                                    }}>
                                      {getDrilldownLabel(row.role, row.manager)}
                                    </p>
                                    {row.topClients.length === 0 ? (
                                      <p style={{ fontSize: "0.7rem", color: "var(--foreground-dim)" }}>{row.role === 'DIST' ? 'Sem distribuidores no período.' : 'Sem matrizes no período.'}</p>
                                    ) : (
                                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                        <table className="drill-table">
                                          <thead>
                                            <tr>
                                              <th style={{ width: 20 }}>#</th>
                                              <th>{row.role === 'DIST' ? 'Distribuidor' : 'Matriz'}</th>
                                              <th>Faturamento</th>
                                              <th>vs Mês A.</th>
                                              <th>vs Ano A.</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {row.topClients.map((c, i) => {
                                              const vsPM = c.prevMonthFat > 0 ? ((c.fat - c.prevMonthFat) / c.prevMonthFat) * 100 : null;
                                              const vsPY = c.prevYearFat > 0 ? ((c.fat - c.prevYearFat) / c.prevYearFat) * 100 : null;
                                              return (
                                                <tr key={i}>
                                                  <td style={{ textAlign: "center", color: "var(--foreground-dim)", fontWeight: 600 }}>{i + 1}</td>
                                                  <td>{c.client}</td>
                                                  <td>{formatCurrency(c.fat / 1000)}</td>
                                                  <td style={{ color: vsPM === null ? "var(--foreground-dim)" : vsPM >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600, fontSize: "0.62rem" }}>
                                                    {vsPM === null ? "—" : `${vsPM >= 0 ? "+" : ""}${vsPM.toFixed(1)}%`}
                                                  </td>
                                                  <td style={{ color: vsPY === null ? "var(--foreground-dim)" : vsPY >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600, fontSize: "0.62rem" }}>
                                                    {vsPY === null ? "—" : `${vsPY >= 0 ? "+" : ""}${vsPY.toFixed(1)}%`}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          ];
                        })}
                        {managerRows.length > 0 && (
                          <tr className="row-total">
                            <td>TOTAL</td>
                            <td>{formatCurrency(totals.metaFat / 1000)}</td>
                            <td>{formatCurrency(totals.fat / 1000)}</td>
                            <td className="pct-cell" style={getPctStyle(pct(totals.fat, totals.metaFat), totals.metaFat)}>
                              {totals.metaFat > 0 ? formatPercent(pct(totals.fat, totals.metaFat)) : "-"}
                            </td>
                            <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                              {totals.paceFat > 0 ? formatCurrency(totals.paceFat / 1000) : "-"}
                            </td>
                            <td>{formatCurrency((totals.vendaFutura || 0) / 1000)}</td>
                            <td>{formatCurrency(((totals.paceFat || 0) + (totals.vendaFutura || 0)) / 1000)}</td>
                            <td className="pct-cell" style={getPctStyle(pct((totals.paceFat || 0) + (totals.vendaFutura || 0), totals.metaFat), totals.metaFat)}>
                              {totals.metaFat > 0 ? formatPercent(pct((totals.paceFat || 0) + (totals.vendaFutura || 0), totals.metaFat)) : "-"}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Unidades */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 4, height: 16, backgroundColor: "var(--foreground-secondary)", borderRadius: 2 }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--foreground-secondary)" }}>
                  Unidades
                </span>
              </div>
              <div className="glass-card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Gerente</th>
                      <th>Meta</th>
                      <th>Real</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerRows.length === 0 && !loading ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: 30, color: "var(--foreground-dim)", fontSize: "0.75rem" }}>
                          Sem dados para o período selecionado
                        </td>
                      </tr>
                    ) : (
                      <>
                        {managerRows.map((row) => {
                          const pUnd = pct(row.qty, row.metaUnd);
                          const isExpanded = expandedManager === row.manager;
                          return [
                            <tr key={row.manager}>
                              <td onClick={() => toggleDrillDown(row.manager)} style={{ cursor: "pointer" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <ChevronRight style={{
                                    width: 12, height: 12, color: "var(--foreground-muted)",
                                    transition: "transform 0.2s",
                                    transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                                  }} />
                                  {row.manager}
                                </span>
                              </td>
                              <td>{formatNumber(row.metaUnd, 0)}</td>
                              <td>{formatNumber(row.qty, 0)}</td>
                              <td className="pct-cell" style={getPctStyle(pUnd, row.metaUnd)}>
                                {row.metaUnd > 0 ? formatPercent(pUnd) : "-"}
                              </td>
                            </tr>,
                            isExpanded && (
                              <tr key={`${row.manager}-drill`} className="drill-down-row">
                                <td colSpan={4}>
                                  <div className="drill-down-container" style={{ padding: 8 }}>
                                    <p style={{
                                      fontSize: "0.65rem", fontWeight: 600, color: "var(--foreground-secondary)",
                                      textTransform: "uppercase", letterSpacing: "0.1em",
                                      marginBottom: 8,
                                    }}>
                                      {getDrilldownLabel(row.role, row.manager)}
                                    </p>
                                    {row.topClients.length === 0 ? (
                                      <p style={{ fontSize: "0.7rem", color: "var(--foreground-dim)" }}>{row.role === 'DIST' ? 'Sem distribuidores no período.' : 'Sem matrizes no período.'}</p>
                                    ) : (
                                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                        <table className="drill-table">
                                          <thead>
                                            <tr>
                                              <th style={{ width: 20 }}>#</th>
                                              <th>{row.role === 'DIST' ? 'Distribuidor' : 'Matriz'}</th>
                                              <th>Unidades</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {row.topClients.map((c, i) => (
                                              <tr key={i}>
                                                <td style={{ textAlign: "center", color: "var(--foreground-dim)", fontWeight: 600 }}>{i + 1}</td>
                                                <td>{c.client}</td>
                                                <td>{formatNumber(c.qty, 0)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          ];
                        })}
                        {managerRows.length > 0 && (
                          <tr className="row-total">
                            <td>TOTAL</td>
                            <td>{formatNumber(totals.metaUnd, 0)}</td>
                            <td>{formatNumber(totals.qty, 0)}</td>
                            <td className="pct-cell" style={getPctStyle(pct(totals.qty, totals.metaUnd), totals.metaUnd)}>
                              {totals.metaUnd > 0 ? formatPercent(pct(totals.qty, totals.metaUnd)) : "-"}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: MaCo (R$) */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 4, height: 16, backgroundColor: "#5a805a", borderRadius: 2 }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7dba7d" }}>
                  MaCo (R$)
                </span>
              </div>
              <div className="glass-card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Gerente</th>
                      <th>Meta</th>
                      <th>Real</th>
                      <th>%</th>
                      <th>Pace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerRows.length === 0 && !loading ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--foreground-dim)", fontSize: "0.75rem" }}>
                          Sem dados para o período selecionado
                        </td>
                      </tr>
                    ) : (
                      <>
                        {managerRows.map((row) => {
                          const pMaco = pct(row.maco, row.metaMaco);
                          const isExpanded = expandedManager === row.manager;
                          return [
                            <tr key={row.manager}>
                              <td onClick={() => toggleDrillDown(row.manager)} style={{ cursor: "pointer" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <ChevronRight style={{
                                    width: 12, height: 12, color: "var(--foreground-muted)",
                                    transition: "transform 0.2s",
                                    transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                                  }} />
                                  {row.manager}
                                </span>
                              </td>
                              <td>{formatCurrency(row.metaMaco / 1000)}</td>
                              <td>{formatCurrency(row.maco / 1000)}</td>
                              <td className="pct-cell" style={getPctStyle(pMaco, row.metaMaco)}>
                                {row.metaMaco > 0 ? formatPercent(pMaco) : "-"}
                              </td>
                              <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                                {row.paceMaco && row.paceMaco > 0 ? formatCurrency(row.paceMaco / 1000) : "-"}
                              </td>
                            </tr>,
                            isExpanded && (
                              <tr key={`${row.manager}-drill`} className="drill-down-row">
                                <td colSpan={5}>
                                  <div className="drill-down-container" style={{ padding: 8 }}>
                                    <p style={{
                                      fontSize: "0.65rem", fontWeight: 600, color: "var(--foreground-secondary)",
                                      textTransform: "uppercase", letterSpacing: "0.1em",
                                      marginBottom: 8,
                                    }}>
                                      {getDrilldownLabel(row.role, row.manager)}
                                    </p>
                                    {row.topClients.length === 0 ? (
                                      <p style={{ fontSize: "0.7rem", color: "var(--foreground-dim)" }}>{row.role === 'DIST' ? 'Sem distribuidores no período.' : 'Sem matrizes no período.'}</p>
                                    ) : (
                                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                        <table className="drill-table">
                                          <thead>
                                            <tr>
                                              <th style={{ width: 20 }}>#</th>
                                              <th>{row.role === 'DIST' ? 'Distribuidor' : 'Matriz'}</th>
                                              <th>MaCo</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {row.topClients.map((c, i) => (
                                              <tr key={i}>
                                                <td style={{ textAlign: "center", color: "var(--foreground-dim)", fontWeight: 600 }}>{i + 1}</td>
                                                <td>{c.client}</td>
                                                <td>{formatCurrency(c.maco / 1000)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          ];
                        })}
                        {managerRows.length > 0 && (
                          <tr className="row-total">
                            <td>TOTAL</td>
                            <td>{formatCurrency(totals.metaMaco / 1000)}</td>
                            <td>{formatCurrency(totals.maco / 1000)}</td>
                            <td className="pct-cell" style={getPctStyle(pct(totals.maco, totals.metaMaco), totals.metaMaco)}>
                              {totals.metaMaco > 0 ? formatPercent(pct(totals.maco, totals.metaMaco)) : "-"}
                            </td>
                            <td className="pct-cell" style={{ color: "var(--foreground)" }}>
                              {totals.paceMaco > 0 ? formatCurrency(totals.paceMaco / 1000) : "-"}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
        </main>
      </div>{/* dash-body */}

      {/* ═══ BOTTOM TAB BAR — Power BI style ═══ */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab">
          <Home className="bottom-tab-icon" /> Menu
        </Link>
        <Link href="/vendas" className="bottom-tab active">
          <BarChart3 className="bottom-tab-icon" /> Vendas
        </Link>
        <Link href="/historico" className="bottom-tab">
          <History className="bottom-tab-icon" /> Hist.
        </Link>
        <Link href="/matriz" className="bottom-tab">
          <Users className="bottom-tab-icon" /> Rede
        </Link>
        <Link href="/historico-matriz" className="bottom-tab">
          <History className="bottom-tab-icon" /> Hist. Rede
        </Link>
        <Link href="/alertas" className="bottom-tab">
          <Bell className="bottom-tab-icon" /> Alertas
        </Link>
        <Link href="/preco" className="bottom-tab">
          <TrendingUp className="bottom-tab-icon" /> Preço
        </Link>
        <Link href="/dia" className="bottom-tab">
          <Calendar className="bottom-tab-icon" /> Dia
        </Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/historico-familia" className="bottom-tab"><Layers className="bottom-tab-icon" /> Hist. Família</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab">
          <TrendingUp className="bottom-tab-icon" /> Inv.
        </Link>
        <span className="bottom-tab disabled">
          <Briefcase className="bottom-tab-icon" /> Carteira
        </span>
        <span className="bottom-tab disabled">
          <Package className="bottom-tab-icon" /> Bonif.
        </span>
        <span className="bottom-tab disabled">
          <Layers className="bottom-tab-icon" /> Devol.
        </span>
        <Link href="/metas" className="bottom-tab">
          <Target className="bottom-tab-icon" /> Metas
        </Link>
        <Link href="/upload" className="bottom-tab">
          <Upload className="bottom-tab-icon" /> Upload
        </Link>
        <Link href="/atendimento" className="bottom-tab">
          <Users className="bottom-tab-icon" /> Atendimento
        </Link>
        <span className="bottom-tab disabled">
          <DollarSign className="bottom-tab-icon" /> DRE
        </span>
      </nav>

      {/* ═══ MOBILE DRAWER - FILTERS ═══ */}
      {isFiltersOpen && (
        <div 
          className="mobile-drawer-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFiltersOpen(false);
          }}
        >
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3>Filtros</h3>
              <button className="mobile-drawer-close" onClick={() => setIsFiltersOpen(false)}>&times;</button>
            </div>
            <div className="mobile-drawer-body">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOBILE DRAWER - SUMMARY ═══ */}
      {isSummaryOpen && (
        <div 
          className="mobile-drawer-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSummaryOpen(false);
          }}
        >
          <div className="mobile-drawer-content summary-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3>Resumo do Mês</h3>
              <button className="mobile-drawer-close" onClick={() => setIsSummaryOpen(false)}>&times;</button>
            </div>
            <div className="mobile-drawer-body">
              <div className="mobile-summary-kpis">
                <KPICard label="Meta Fat." value={formatCurrency(totals.metaFat / 1000, 0)} variant="meta" />
                <KPICard
                  label="Real Fat."
                  value={formatCurrency(totals.fat / 1000, 0)}
                  variant="real"
                  pctVal={pct(totals.fat, totals.metaFat)}
                  compare={compareVariation(totals.fat, previousMonth.fat)}
                  compareLabel="mês ant."
                />
                <KPICard label="Meta Unid." value={formatNumber(totals.metaUnd, 0)} variant="meta" />
                <KPICard
                  label="Real Unid."
                  value={formatNumber(totals.qty, 0)}
                  variant="real"
                  pctVal={pct(totals.qty, totals.metaUnd)}
                  compare={compareVariation(totals.qty, previousMonth.qty)}
                  compareLabel="mês ant."
                />
                <KPICard label="Meta MaCo" value={formatCurrency(totals.metaMaco / 1000, 0)} variant="meta" />
                <KPICard
                  label="Real MaCo"
                  value={formatCurrency(totals.maco / 1000, 0)}
                  variant="real"
                  pctVal={pct(totals.maco, totals.metaMaco)}
                  compare={compareVariation(totals.maco, previousYear.maco)}
                  compareLabel="ano ant."
                />
              </div>

              <div className="mobile-summary-charts">
                <div className="glass-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
                  <GaugeChart value={faturamentoPct} label="Atingimento" />
                </div>
                <div className="glass-card" style={{ padding: 14 }}>
                  <DonutChart data={familiaData} />
                </div>
              </div>

              <div className="mobile-summary-pace">
                <MiniStat label="Pace Fat." value={formatCurrency(totals.paceFat / 1000)} color="var(--foreground)" />
                <MiniStat label="Pace Unid." value={formatNumber(totals.paceQty, 0)} color="var(--foreground)" />
                <MiniStat label="Pace MaCo" value={formatCurrency(totals.paceMaco / 1000)} color="var(--foreground)" />
                <MiniStat
                  label={`vs ${MONTHS[((filterMonth - 2) + 12) % 12].slice(0,3)}`}
                  value={`${compareVariation(totals.fat, previousMonth.fat).direction === "up" ? "+" : "-"}${compareVariation(totals.fat, previousMonth.fat).pct.toFixed(1)}%`}
                  color={compareVariation(totals.fat, previousMonth.fat).direction === "up" ? "var(--success)" : "var(--danger)"}
                />
                <MiniStat
                  label={`vs ${MONTHS[filterMonth - 1].slice(0,3)} ${filterYear - 1}`}
                  value={`${compareVariation(totals.fat, previousYear.fat).direction === "up" ? "+" : "-"}${compareVariation(totals.fat, previousYear.fat).pct.toFixed(1)}%`}
                  color={compareVariation(totals.fat, previousYear.fat).direction === "up" ? "var(--success)" : "var(--danger)"}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

function KPICard({ label, value, variant, pctVal, compare, compareLabel }: {
  label: string;
  value: string;
  variant: "meta" | "real";
  pctVal?: number;
  compare?: { pct: number; direction: "up" | "down" | "neutral" };
  compareLabel?: string;
}) {
  const cls = (v: number) => (v >= 100 ? "positive" : v >= 80 ? "warning" : "danger");

  return (
    <div className={`kpi-card ${variant === "meta" ? "kpi-meta" : "kpi-real"}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {pctVal !== undefined && pctVal > 0 && (
          <span className={`kpi-pct ${cls(pctVal)}`}>{pctVal.toFixed(1)}%</span>
        )}
        {compare && compare.pct > 0 && compareLabel && (
          <span className={`kpi-compare ${compare.direction}`}>
            {compare.direction === "up" ? <TrendingUp style={{ width: 10, height: 10 }} /> :
             compare.direction === "down" ? <TrendingDown style={{ width: 10, height: 10 }} /> :
             <Minus style={{ width: 10, height: 10 }} />}
            {compare.pct.toFixed(1)}% {compareLabel}
          </span>
        )}
      </div>
      {pctVal !== undefined && pctVal > 0 && (
        <div className="perf-bar-track">
          <div className="perf-bar-fill" style={{
            width: `${Math.min(100, pctVal)}%`,
            background: pctVal >= 100 ? "var(--success)" : pctVal >= 80 ? "var(--warning)" : "var(--danger)",
          }} />
        </div>
      )}
    </div>
  );
}

/* ─── GAUGE ─── */
function GaugeChart({ value, label }: { value: number; label: string }) {
  const clampedValue = Math.min(150, Math.max(0, value));
  const radius = 60;
  const cx = 80;
  const cy = 72;

  const getArcColor = (pct: number) => {
    if (pct >= 100) return "var(--success)";
    if (pct >= 80) return "var(--warning)";
    return "var(--danger)";
  };

  const createArc = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const valueAngle = -180 + (clampedValue / 150) * 180;
  const needleRad = (valueAngle * Math.PI) / 180;
  const needleX = cx + (radius - 12) * Math.cos(needleRad);
  const needleY = cy + (radius - 12) * Math.sin(needleRad);

  return (
    <div className="gauge-container">
      <p className="gauge-label">{label}</p>
      <svg width="160" height="95" viewBox="0 0 160 95">
        <path d={createArc(-180, 0)} fill="none" stroke="#2a2a2a" strokeWidth="10" strokeLinecap="round" />
        <path d={createArc(-180, -180 + (80/150)*180)} fill="none" stroke="var(--danger)" strokeWidth="10" strokeLinecap="round" opacity="0.25" />
        <path d={createArc(-180 + (80/150)*180, -180 + (100/150)*180)} fill="none" stroke="var(--warning)" strokeWidth="10" strokeLinecap="round" opacity="0.25" />
        <path d={createArc(-180 + (100/150)*180, 0)} fill="none" stroke="var(--success)" strokeWidth="10" strokeLinecap="round" opacity="0.25" />
        {clampedValue > 0 && (
          <path d={createArc(-180, valueAngle)} fill="none" stroke={getArcColor(value)} strokeWidth="10" strokeLinecap="round" />
        )}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3" fill="var(--foreground)" />
        <text x="15" y="90" fill="var(--foreground-muted)" fontSize="8" fontWeight="600">0%</text>
        <text x="130" y="90" fill="var(--foreground-muted)" fontSize="8" fontWeight="600">150%</text>
      </svg>
      <p className="gauge-value" style={{ color: getArcColor(value) }}>
        {value.toFixed(1)}%
      </p>
    </div>
  );
}

/* ─── DONUT CHART ─── */
function DonutChart({ data }: { data: FamiliaData[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--foreground-dim)", fontSize: "0.7rem" }}>
        Sem dados de família
      </div>
    );
  }

  const top = data.slice(0, 6);
  const othersSum = data.slice(6).reduce((sum, d) => sum + d.fat, 0);
  const othersPct = data.slice(6).reduce((sum, d) => sum + d.pct, 0);
  const chartData = othersSum > 0
    ? [...top, { familia: "Outros", fat: othersSum, qty: 0, pct: othersPct }]
    : top;

  const totalFat = chartData.reduce((s, d) => s + d.fat, 0);
  const cx = 50, cy = 50, radius = 40, innerRadius = 24;

  let cumulativeAngle = 0;
  const segments = chartData.map((d, i) => {
    let sliceAngle = totalFat > 0 ? (d.fat / totalFat) * 360 : 0;
    if (sliceAngle === 360) sliceAngle = 359.99;
    const startAngle = cumulativeAngle;
    // eslint-disable-next-line react-hooks/immutability
    cumulativeAngle += sliceAngle;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = (((startAngle + sliceAngle) - 90) * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const ix1 = cx + innerRadius * Math.cos(startRad);
    const iy1 = cy + innerRadius * Math.sin(startRad);
    const ix2 = cx + innerRadius * Math.cos(endRad);
    const iy2 = cy + innerRadius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;

    return { path, color: PIE_COLORS[i % PIE_COLORS.length], familia: d.familia, pct: d.pct };
  });


  return (
    <div>
      <p style={{
        fontSize: "0.6rem", fontWeight: 600, color: "var(--foreground-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>
        Composição por Família
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill={seg.color} opacity="0.9">
              <title>{seg.familia}: {seg.pct.toFixed(1)}%</title>
            </path>
          ))}
        </svg>
        <ul className="pie-legend" style={{ flex: 1 }}>
          {chartData.map((d, i) => (
            <li key={i}>
              <span className="pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.familia}
              </span>
              <span className="pie-legend-value">{d.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── MINI STAT ─── */
function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-card" style={{ padding: "8px 12px", textAlign: "center" }}>
      <p style={{ fontSize: "0.55rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
        {label}
      </p>
      <p style={{ fontSize: "1rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}
