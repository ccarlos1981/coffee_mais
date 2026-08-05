"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Target,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Users,
  Sparkles,
  Search,
  Save,
  Check,
  Calendar,
  Filter,
  Sliders,
  TrendingUp,
  TrendingDown,
  Minus,
  LayoutList,
  Maximize2,
  Minimize2,
  Zap
} from "lucide-react";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import { ExecutiveMoneyInput } from "@/components/ui/executive-money-input";
import { supabase } from "@/lib/supabase";
import { resolveCanonicalManager } from "@/lib/domain/canonical";
import { PlanningGoalAllocator } from "@/lib/planning/planning-goal-allocator";

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MONTH_SHORT_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];
const YEARS_AVAILABLE = [2025, 2026, 2027];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
export function getPreceding3ClosedMonths(metaMonth: number, year: number): string[] {
  const result: string[] = [];
  for (let i = 3; i >= 1; i--) {
    let targetM = metaMonth - i;
    let targetY = year;
    while (targetM <= 0) {
      targetM += 12;
      targetY -= 1;
    }
    result.push(`${targetY}-${String(targetM).padStart(2, "0")}`);
  }
  return result;
}

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface RedeRow {
  rede: string;
  manager: string;
  manager_id: string;
  codigo_matriz: string;
  months: Record<string, { fat: number; qty: number }>;
  avgPriceQ2: number;
  metaFat: number;
  metaVol: number;
  totalFat: number;
  totalQty: number;
  avg3M: number;
}

interface ManagerBlock {
  manager: string;
  manager_id: string;
  metaTotal: number;
  redes: RedeRow[];
  totalFat: Record<string, number>;
  totalQty: Record<string, number>;
  grandTotalFat: number;
  grandTotalMed3M: number;
}

/* ─── Page Component ────────────────────────────────────────────────────────── */
export default function MetasRedePage() {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Agosto por padrão
  const [selectedYear, setSelectedYear] = useState<number>(2026); // 2026 por padrão
  const [managers, setManagers] = useState<ManagerBlock[]>([]);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [compactView, setCompactView] = useState<boolean>(false); // Visão Completa (Anual) por padrão

  // Editable meta values: key = "manager_id|codigo_matriz|rede" -> value in R$
  const [metaInputs, setMetaInputs] = useState<Record<string, number>>({});
  // Top-down manager target inputs
  const [managerMetaTargets, setManagerMetaTargets] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userRole, setUserRole] = useState<string>("Gerente");

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    async function checkRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("cm_user_profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (prof?.role) setUserRole(prof.role);
        }
      } catch (err) {
        console.error("Erro ao carregar role do usuário:", err);
      }
    }
    checkRole();
  }, []);

  const isTopDownAuthorized = useMemo(() => {
    if (!userRole) return false;
    const r = userRole.toLowerCase().trim();
    const allowed = [
      "admin",
      "admin master",
      "ceo",
      "presidência",
      "presidencia",
      "presidente",
      "diretoria",
      "diretor",
      "diretor comercial"
    ];
    return allowed.includes(r);
  }, [userRole]);

  const toggleManager = (mgr: string) => {
    setExpandedManagers((prev) => {
      const next = new Set(prev);
      if (next.has(mgr)) next.delete(mgr);
      else next.add(mgr);
      return next;
    });
  };

  const expandAll = () => setExpandedManagers(new Set(managers.map((m) => m.manager)));
  const collapseAll = () => setExpandedManagers(new Set());

  const setMetaValue = (managerId: string, codigoMatriz: string, redeName: string, managerName: string, value: number) => {
    const key1 = `${managerId}|${codigoMatriz}|${redeName}`;
    const key2 = `${managerName}|${redeName}`;
    setMetaInputs((prev) => ({
      ...prev,
      [key1]: value,
      [key2]: value,
    }));
    setSaved(false);
  };

  const getMetaValue = useCallback(
    (r: RedeRow): number => {
      const key1 = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
      if (metaInputs[key1] !== undefined) return metaInputs[key1];
      const key2 = `${r.manager}|${r.rede}`;
      if (metaInputs[key2] !== undefined) return metaInputs[key2];
      return 0;
    },
    [metaInputs]
  );

  // Top-down Goal Allocator (Backend Logic in Service/Helper)
  const handleTopDownManagerDistribution = (mgr: ManagerBlock, targetGoalR$: number) => {
    const mgrBlockViewModel = {
      manager: mgr.manager,
      manager_id: mgr.manager_id,
      totalRedes: mgr.redes.length,
      grandTotalFat: mgr.grandTotalFat,
      grandTotalMed3M: mgr.grandTotalMed3M,
      grandTotalMed3MKg: 0,
      grandTotalMeta: targetGoalR$,
      mgrPace: 100,
      mgrPreenchidas: mgr.redes.length,
      mgrVolPrevKg: 0,
      redes: mgr.redes.map(r => ({
        rede: r.rede,
        manager: r.manager,
        manager_id: r.manager_id,
        codigo_matriz: r.codigo_matriz,
        fatQ2: r.totalFat,
        qtyQ2: r.totalQty,
        avgPriceQ2: r.avgPriceQ2,
        avg3M: r.avg3M,
        avg3MKg: 0,
        metaVal: getMetaValue(r),
        metaKg: 0,
        pctVsAvg3M: 0,
        monthlyHistory: r.months
      }))
    };

    const { metaInputsPatch } = PlanningGoalAllocator.distributeManagerGoal(mgrBlockViewModel, targetGoalR$);

    setManagerMetaTargets(prev => ({ ...prev, [mgr.manager_id || mgr.manager]: targetGoalR$ }));
    setMetaInputs(prev => ({ ...prev, ...metaInputsPatch }));
    setSaved(false);
  };

  // Quick fill multiplier (+0%, +5%, +10%)
  const handleApplyQuickGrowthMultiplier = (mgr: ManagerBlock, multiplier: number) => {
    const targetGoal = Math.round(mgr.grandTotalMed3M * multiplier);
    handleTopDownManagerDistribution(mgr, targetGoal);
  };

  // Keyboard navigation inside table (Enter / ArrowDown / ArrowUp)
  const handleKeyDownNavigation = (e: React.KeyboardEvent<HTMLInputElement>, currentKey: string, mgr: ManagerBlock, redeIdx: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextRede = mgr.redes[redeIdx + 1];
      if (nextRede) {
        const nextKey = `${nextRede.manager_id}|${nextRede.codigo_matriz}|${nextRede.rede}`;
        inputRefs.current[nextKey]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevRede = mgr.redes[redeIdx - 1];
      if (prevRede) {
        const prevKey = `${prevRede.manager_id}|${prevRede.codigo_matriz}|${prevRede.rede}`;
        inputRefs.current[prevKey]?.focus();
      }
    }
  };

  const loadData = useCallback(async (targetMonth: number, targetYear: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gestao/metas-rede?year=${targetYear}&month=${targetMonth}`);
      const json = await res.json();

      if (json.error) {
        console.error("API error:", json.error);
        return;
      }

      const { managerBlocks, months: apiMonths } = json;
      const monthKeys = apiMonths || Array.from({ length: targetMonth - 1 }, (_, i) => `${targetYear}-${String(i + 1).padStart(2, "0")}`);
      const initialInputs: Record<string, number> = {};
      const initialMgrTargets: Record<string, number> = {};

      const result: ManagerBlock[] = (managerBlocks || []).map((mb: any) => {
        const mgrKey = mb.manager_id || mb.manager;
        initialMgrTargets[mgrKey] = mb.grandTotalMeta || 0;

        const redeList: RedeRow[] = (mb.redes || []).map((r: any) => {
          let totalFat = 0;
          let totalQty = 0;
          Object.values(r.monthlyHistory || {}).forEach((val: any) => {
            totalFat += Number(val.fat) || 0;
            totalQty += Number(val.qty) || 0;
          });

          const metaFat = Number(r.metaVal) || 0;
          const metaVol = Number(r.metaKg) || 0;

          if (metaFat > 0) {
            const k1 = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
            const k2 = `${r.manager}|${r.rede}`;
            initialInputs[k1] = metaFat;
            initialInputs[k2] = metaFat;
          }

          return {
            rede: r.rede,
            manager: r.manager,
            manager_id: r.manager_id,
            codigo_matriz: r.codigo_matriz,
            months: r.monthlyHistory || {},
            avgPriceQ2: r.avgPriceQ2 || 0,
            metaFat,
            metaVol,
            totalFat,
            totalQty,
            avg3M: r.avg3M || 0,
          };
        });

        const totalFatByMonth: Record<string, number> = {};
        const totalQtyByMonth: Record<string, number> = {};
        monthKeys.forEach((m: string) => {
          totalFatByMonth[m] = 0;
          totalQtyByMonth[m] = 0;
        });
        redeList.forEach((r) => {
          monthKeys.forEach((m: string) => {
            totalFatByMonth[m] += r.months[m]?.fat || 0;
            totalQtyByMonth[m] += r.months[m]?.qty || 0;
          });
        });

        return {
          manager: mb.manager,
          manager_id: mb.manager_id,
          metaTotal: mb.grandTotalMeta || 0,
          redes: redeList,
          totalFat: totalFatByMonth,
          totalQty: totalQtyByMonth,
          grandTotalFat: mb.grandTotalFat || 0,
          grandTotalMed3M: mb.grandTotalMed3M || 0,
        };
      });

      setManagers(result);
      setMetaInputs(initialInputs);
      setManagerMetaTargets(initialMgrTargets);
      if (result.length > 0) {
        setExpandedManagers(new Set([result[0].manager]));
      }
    } catch (err) {
      console.error("Erro ao carregar metas-rede:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedMonth, selectedYear);
  }, [loadData, selectedMonth, selectedYear]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return managers;
    const q = searchTerm.toLowerCase();
    return managers
      .map((m) => ({ ...m, redes: m.redes.filter((r) => r.rede.toLowerCase().includes(q)) }))
      .filter((m) => m.redes.length > 0 || m.manager.toLowerCase().includes(q));
  }, [managers, searchTerm]);

  // Executive Cards derived directly from metaInputs (Single Source of Truth)
  const executiveCards = useMemo(() => {
    let totalMed3M = 0;
    let totalMetaInputted = 0;
    let totalRedesCount = 0;
    let totalRedesWithGoal = 0;

    managers.forEach((mgr) => {
      totalMed3M += mgr.grandTotalMed3M;
      totalRedesCount += mgr.redes.length;

      mgr.redes.forEach((r) => {
        const val = getMetaValue(r);
        if (val > 0) {
          totalMetaInputted += val;
          totalRedesWithGoal++;
        }
      });
    });

    return {
      totalMed3M,
      totalMetaInputted,
      totalRedesCount,
      totalRedesWithGoal,
    };
  }, [managers, metaInputs, getMetaValue]);

  // Save handler (Upsert into cm_weekly_projections)
  const handleSave = async () => {
    setSaving(true);
    try {
      const rowsMap = new Map<string, any>();

      managers.forEach((mgr) => {
        mgr.redes.forEach((r) => {
          const val = getMetaValue(r);
          if (val > 0) {
            const canonicalMgr = resolveCanonicalManager(r.manager).managerName;
            const weekStartDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
            const key = `${canonicalMgr}|${r.rede}|${selectedYear}|${selectedMonth}|${weekStartDate}`;

            rowsMap.set(key, {
              manager: canonicalMgr,
              manager_id: r.manager_id || null,
              codigo_matriz: r.codigo_matriz || null,
              client_matrix: r.rede,
              kpi: "META",
              projection_value: val,
              month: selectedMonth,
              year: selectedYear,
              week_start_date: weekStartDate,
              updated_at: new Date().toISOString(),
            });
          }
        });
      });

      const rowsToUpsert = Array.from(rowsMap.values());

      if (rowsToUpsert.length > 0) {
        const { error } = await supabase
          .from("cm_weekly_projections")
          .upsert(rowsToUpsert, { onConflict: "manager,client_matrix,kpi,month,year,week_start_date" });

        if (error) throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadData(selectedMonth, selectedYear);
    } catch (err: any) {
      console.error("Erro ao salvar metas na RPS:", err);
      alert(`Erro ao salvar metas: ${err?.message || "Verifique o console."}`);
    } finally {
      setSaving(false);
    }
  };

  const dynamicPrecedingMonths = useMemo(() => {
    return getPreceding3ClosedMonths(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const yearClosedMonths = useMemo(() => {
    return Array.from({ length: selectedMonth - 1 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, "0")}`);
  }, [selectedMonth, selectedYear]);

  const tableDisplayedMonths = useMemo(() => {
    return compactView ? dynamicPrecedingMonths : yearClosedMonths;
  }, [compactView, dynamicPrecedingMonths, yearClosedMonths]);

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#1e293b]">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="h-4 w-px bg-neutral-200" />
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-neutral-800">Abertura de Meta por Rede</span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Origem Oficial RPS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle (Visão Completa vs Visão Enxuta) */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs font-bold">
              <button
                onClick={() => setCompactView(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  !compactView ? "bg-white text-neutral-900 shadow-sm font-black" : "text-neutral-500 hover:text-neutral-800"
                }`}
                title="Visão Histórica Anual Completa (Jan-Jul)"
              >
                <Maximize2 className="w-3 h-3 text-blue-500" />
                <span>Completa (Anual)</span>
              </button>
              <button
                onClick={() => setCompactView(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  compactView ? "bg-white text-neutral-900 shadow-sm font-black" : "text-neutral-500 hover:text-neutral-800"
                }`}
                title="Visão Enxuta Reunião Executiva (3M)"
              >
                <Minimize2 className="w-3 h-3 text-amber-500" />
                <span>Enxuta (Reunião 3M)</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <Calendar className="w-3.5 h-3.5 text-neutral-500 ml-1.5" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-white border border-neutral-200 text-xs font-bold text-neutral-800 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-200 cursor-pointer"
              >
                {MONTH_NAMES_PT.map((mName, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-white border border-neutral-200 text-xs font-bold text-neutral-800 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-200 cursor-pointer"
              >
                {YEARS_AVAILABLE.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={expandAll}
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 px-2 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Expandir
            </button>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 px-2 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Recolher
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                saved
                  ? "bg-emerald-500 text-white"
                  : saving
                  ? "bg-amber-400 text-amber-900 opacity-70"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Salvo na RPS!
                </>
              ) : saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar Metas
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <main className="max-w-[1440px] mx-auto px-6 py-6">
        {/* Title & Description */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-neutral-900 tracking-tight">
            Abertura de Meta por Rede — {MONTH_NAMES_PT[selectedMonth - 1]} / {selectedYear}
          </h1>
          <p className="text-neutral-500 text-xs mt-1">
            Modo: <span className="font-bold text-neutral-800">{compactView ? "Visão Enxuta Reunião (3M)" : `Histórico Anual Completo (${yearClosedMonths.length} meses)`}</span> · Média 3M Ref: {dynamicPrecedingMonths.join(", ")} · Single Source of Truth RPS
          </p>
        </div>

        {/* Executive Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Média 3M Total</span>
            </div>
            <p className="text-lg font-black text-blue-700">{formatCurrency(executiveCards.totalMed3M)}</p>
            <p className="text-[10px] text-neutral-400">{dynamicPrecedingMonths.join(", ")}</p>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                Meta {MONTH_SHORT_PT[selectedMonth - 1]} Digitada
              </span>
            </div>
            <p className="text-lg font-black text-amber-600">{formatCurrency(executiveCards.totalMetaInputted)}</p>
            <p className="text-[10px] text-neutral-400">{executiveCards.totalRedesWithGoal} redes preenchidas</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Users className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Gerentes</span>
            </div>
            <p className="text-lg font-black text-neutral-900">{managers.length}</p>
            <p className="text-[10px] text-neutral-400">Com carteira ativa</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Redes Planejáveis</span>
            </div>
            <p className="text-lg font-black text-neutral-900">{executiveCards.totalRedesCount}</p>
            <p className="text-[10px] text-neutral-400">Ordenadas por Média 3M</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Pesquisar rede ou gerente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all shadow-sm"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-xs text-neutral-400">Carregando dados...</span>
            </div>
          </div>
        )}

        {/* Manager Blocks */}
        {!loading &&
          filtered.map((mgr) => {
            const isOpen = expandedManagers.has(mgr.manager);
            const mgrKey = mgr.manager_id || mgr.manager;
            const targetMgrMetaInput = managerMetaTargets[mgrKey] || mgr.metaTotal || 0;

            const mgrBlockViewModel = {
              manager: mgr.manager,
              manager_id: mgr.manager_id,
              totalRedes: mgr.redes.length,
              grandTotalFat: mgr.grandTotalFat,
              grandTotalMed3M: mgr.grandTotalMed3M,
              grandTotalMed3MKg: 0,
              grandTotalMeta: mgr.metaTotal,
              mgrPace: 100,
              mgrPreenchidas: mgr.redes.length,
              mgrVolPrevKg: 0,
              redes: mgr.redes.map(r => ({
                rede: r.rede,
                manager: r.manager,
                manager_id: r.manager_id,
                codigo_matriz: r.codigo_matriz,
                fatQ2: r.totalFat,
                qtyQ2: r.totalQty,
                avgPriceQ2: r.avgPriceQ2,
                avg3M: r.avg3M,
                avg3MKg: 0,
                metaVal: getMetaValue(r),
                metaKg: 0,
                pctVsAvg3M: 0,
                monthlyHistory: r.months
              }))
            };

            // Business Rules Execution in Helper (PlanningGoalAllocator)
            const summary = PlanningGoalAllocator.calculateManagerSummary(mgrBlockViewModel, metaInputs, targetMgrMetaInput);
            const isGoalAboveAvg = summary.growthStatus === 'ABOVE';

            return (
              <div
                key={mgr.manager}
                className={`mb-4 bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${
                  isGoalAboveAvg ? "border-emerald-300 border-l-4 border-l-emerald-500" : "border-neutral-200"
                }`}
              >
                {/* Manager Header Horizontal Executive Accordion Bar */}
                <div className="w-full flex flex-col md:flex-row md:items-center justify-between px-5 py-3.5 bg-neutral-50/70 border-b border-neutral-200/60 gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <button
                      onClick={() => toggleManager(mgr.manager)}
                      className="p-1 rounded-lg bg-white border border-neutral-200 text-neutral-600 hover:text-amber-600 hover:border-amber-300 transition-colors cursor-pointer"
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <span className="text-sm font-black text-neutral-900 truncate">{mgr.manager}</span>
                    <span className="text-[10px] font-bold text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded-full shrink-0">
                      {mgr.redes.length} Redes
                    </span>

                    {/* Top-down Distribution Controls & 1-Click Quick Growth Multipliers */}
                    {isTopDownAuthorized && (
                      <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-200/80 px-2 py-1 rounded-lg">
                        <Sliders className="w-3 h-3 text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-700 uppercase hidden lg:inline">Meta Direção:</span>
                        <ExecutiveMoneyInput
                          value={managerMetaTargets[mgrKey] || 0}
                          onChangeValue={(val) => {
                            handleTopDownManagerDistribution(mgr, val);
                          }}
                          placeholder="Meta R$"
                          className="w-24 text-right text-xs font-bold text-amber-800 bg-white border border-amber-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
                        />

                        {/* Quick 1-Click Fill Buttons */}
                        <div className="flex items-center gap-1 ml-1 border-l border-amber-200 pl-1.5">
                          <button
                            onClick={() => handleApplyQuickGrowthMultiplier(mgr, 1.0)}
                            className="px-1.5 py-0.5 text-[9px] font-bold bg-white text-neutral-700 border border-neutral-200 rounded hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                            title="Preencher Meta com 100% da Média 3M"
                          >
                            100% 3M
                          </button>
                          <button
                            onClick={() => handleApplyQuickGrowthMultiplier(mgr, 1.05)}
                            className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors flex items-center gap-0.5 cursor-pointer"
                            title="Preencher Meta com Média 3M + 5% de Crescimento"
                          >
                            <Zap className="w-2.5 h-2.5 text-emerald-600" />
                            +5%
                          </button>
                          <button
                            onClick={() => handleApplyQuickGrowthMultiplier(mgr, 1.10)}
                            className="px-1.5 py-0.5 text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded hover:bg-violet-100 transition-colors flex items-center gap-0.5 cursor-pointer"
                            title="Preencher Meta com Média 3M + 10% de Crescimento"
                          >
                            <Zap className="w-2.5 h-2.5 text-violet-600" />
                            +10%
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Executive Summary Metrics in Collapsed Row */}
                  <div className="flex items-center gap-3 sm:gap-5 shrink-0 text-xs justify-between md:justify-end flex-wrap">
                    <div className="text-right">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase block">Fat YTD ({yearClosedMonths.length}m)</span>
                      <span className="font-bold text-neutral-800">{formatCompact(summary.totalFatYTD)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-blue-500 font-bold uppercase block">Méd 3M</span>
                      <span className="font-bold text-blue-700">{formatCompact(summary.totalMed3M)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-amber-600 font-bold uppercase block">Meta {MONTH_SHORT_PT[selectedMonth - 1]}</span>
                      <span className="font-black text-amber-700">{formatCompact(summary.currentMetaInputsSum)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-violet-500 font-bold uppercase block">% vs 3M</span>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        summary.growthStatus === 'ABOVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        summary.growthStatus === 'BELOW' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {summary.growthStatus === 'ABOVE' && <TrendingUp className="w-3 h-3 text-emerald-600" />}
                        {summary.growthStatus === 'BELOW' && <TrendingDown className="w-3 h-3 text-red-600" />}
                        {summary.growthStatus === 'EQUAL' && <Minus className="w-3 h-3 text-neutral-400" />}
                        {summary.growthPct > 0
                          ? `+${summary.growthPct.toFixed(2).replace(".", ",")}%`
                          : summary.growthPct < 0
                          ? `${summary.growthPct.toFixed(2).replace(".", ",")}%`
                          : "0,0%"}
                      </span>
                    </div>

                    {/* Remaining Balance Indicator Badge */}
                    <div className="text-right">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase block">Status Saldo</span>
                      {summary.remainingBalance === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Distribuído
                        </span>
                      ) : summary.remainingBalance > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" title={`Faltam R$ ${summary.remainingBalance.toLocaleString('pt-BR')} para distribuir`}>
                          Faltam +{formatCompact(summary.remainingBalance)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full" title={`Meta ultrapassada em R$ ${Math.abs(summary.remainingBalance).toLocaleString('pt-BR')}`}>
                          Excesso {formatCompact(summary.remainingBalance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Table Component */}
                {isOpen && (
                  <div className="overflow-x-auto border-t border-neutral-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-neutral-50/80 border-b border-neutral-200/60">
                          <th className="text-left px-4 py-2.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider sticky left-0 bg-neutral-50 z-10 min-w-[180px]">
                            Rede
                          </th>
                          {tableDisplayedMonths.map((mKey) => {
                            const monthIndex = parseInt(mKey.split("-")[1], 10) - 1;
                            return (
                              <th key={mKey} className="text-right px-3 py-2.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider min-w-[65px]">
                                {MONTH_SHORT_PT[monthIndex]}
                              </th>
                            );
                          })}
                          <th className="text-right px-3 py-2.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider min-w-[80px] bg-blue-50/80">
                            Méd 3M
                          </th>
                          <th className="text-right px-3 py-2.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider min-w-[68px]">
                            R$/Kg
                          </th>
                          <th className="text-center px-2 py-2.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider min-w-[110px] bg-amber-50/80">
                            Meta {MONTH_SHORT_PT[selectedMonth - 1]} R$
                          </th>
                          <th className="text-center px-2 py-2.5 text-[10px] font-bold text-violet-700 uppercase tracking-wider min-w-[85px] bg-violet-50/80">
                            % vs 3M
                          </th>
                          <th className="text-right px-3 py-2.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider min-w-[70px] bg-emerald-50/80">
                            Vol. Kg
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {mgr.redes.map((r, idx) => {
                          const inputVal = getMetaValue(r);
                          const volKg = r.avgPriceQ2 > 0 && inputVal > 0 ? inputVal / r.avgPriceQ2 : 0;
                          
                          // Growth KPIs via Helper Logic (PlanningGoalAllocator)
                          const growthKPI = PlanningGoalAllocator.calculateNetworkGrowth(inputVal, r.avg3M);
                          const inputKey = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;

                          return (
                            <tr
                              key={inputKey}
                              className={`border-t border-neutral-100 hover:bg-amber-50/30 transition-colors ${
                                idx % 2 === 0 ? "bg-white" : "bg-neutral-50/40"
                              }`}
                            >
                              <td className="px-4 py-2 font-semibold text-neutral-800 sticky left-0 bg-white z-10">
                                <span className="truncate block max-w-[170px]">{r.rede}</span>
                              </td>
                              {tableDisplayedMonths.map((mKey) => {
                                const fat = r.months[mKey]?.fat || 0;
                                return (
                                  <td key={mKey} className="text-right px-3 py-2 tabular-nums text-neutral-500 font-medium">
                                    {fat > 0 ? formatCompact(fat) : <span className="text-neutral-300">—</span>}
                                  </td>
                                );
                              })}
                              <td className="text-right px-3 py-2 tabular-nums font-bold text-blue-700 bg-blue-50/30">
                                {r.avg3M > 0 ? formatCompact(r.avg3M) : "—"}
                              </td>
                              <td className="text-right px-3 py-2 tabular-nums text-neutral-500 font-medium">
                                {r.avgPriceQ2 > 0 ? `${r.avgPriceQ2.toFixed(2).replace(".", ",")}` : <span className="text-neutral-300">—</span>}
                              </td>

                              {/* Editable Input Meta R$ with Keyboard Navigation (Enter / ArrowDown / ArrowUp) */}
                              <td className="px-2 py-1.5 bg-amber-50/30 text-center">
                                <ExecutiveMoneyInput
                                  inputRef={(el) => { inputRefs.current[inputKey] = el; }}
                                  value={inputVal || 0}
                                  onChangeValue={(rawReais) =>
                                    setMetaValue(
                                      r.manager_id,
                                      r.codigo_matriz,
                                      r.rede,
                                      r.manager,
                                      rawReais
                                    )
                                  }
                                  placeholder="0"
                                  onKeyDown={(e) => handleKeyDownNavigation(e, inputKey, mgr, idx)}
                                  className="w-24 min-w-[85px] text-right text-xs font-bold text-amber-800 bg-white border border-amber-200 rounded-md px-2 py-1 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:text-neutral-300 tabular-nums"
                                />
                              </td>

                              {/* Network Growth Indicator % vs 3M Badge */}
                              <td className="text-center px-2 py-1.5 bg-violet-50/30">
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  growthKPI.growthStatus === 'ABOVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  growthKPI.growthStatus === 'BELOW' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-neutral-100 text-neutral-500'
                                }`}>
                                  {growthKPI.growthPct > 0
                                    ? `+${growthKPI.growthPct.toFixed(2).replace(".", ",")}%`
                                    : growthKPI.growthPct < 0
                                    ? `${growthKPI.growthPct.toFixed(2).replace(".", ",")}%`
                                    : "0,0%"}
                                </span>
                              </td>

                              {/* Volume Kg */}
                              <td className="text-right px-3 py-2 tabular-nums font-bold bg-emerald-50/30">
                                {volKg > 0 ? (
                                  <span className="text-emerald-700">{formatCompact(volKg)}</span>
                                ) : (
                                  <span className="text-neutral-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </main>
    </div>
  );
}
