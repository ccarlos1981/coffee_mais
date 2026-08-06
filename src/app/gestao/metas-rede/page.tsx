"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Zap,
  AlertTriangle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Building2,
  Clock
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
const YEARS_AVAILABLE = [2025, 2026, 2027];

type OperationalStatus = "EM_EDICAO" | "PENDENTE_APROVACAO" | "APROVADA" | "PUBLICADA";

const STATUS_LABELS: Record<OperationalStatus, { label: string; color: string; bg: string }> = {
  EM_EDICAO: { label: "Em Edição", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
  PENDENTE_APROVACAO: { label: "Pendente de Aprovação", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
  APROVADA: { label: "Aprovada", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" },
  PUBLICADA: { label: "Publicada", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)" },
};

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

interface RateioPreviewProposal {
  rede: string;
  codigo_matriz: string;
  currentVal: number;
  newVal: number;
  diff: number;
}

/* ─── Page Component ────────────────────────────────────────────────────────── */
export default function MetasRedePage() {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Agosto por padrão
  const [selectedYear, setSelectedYear] = useState<number>(2026); // 2026 por padrão
  const [managers, setManagers] = useState<ManagerBlock[]>([]);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [compactView, setCompactView] = useState<boolean>(false);

  // Editable meta values
  const [metaInputs, setMetaInputs] = useState<Record<string, number>>({});
  const [managerMetaTargets, setManagerMetaTargets] = useState<Record<string, number>>({});
  const [managerStatuses, setManagerStatuses] = useState<Record<string, OperationalStatus>>({});
  
  // Rateio Preview Modal state
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    manager: ManagerBlock | null;
    targetGoalR$: number;
    proposals: RateioPreviewProposal[];
    patchToApply: Record<string, number>;
  }>({
    open: false,
    manager: null,
    targetGoalR$: 0,
    proposals: [],
    patchToApply: {}
  });

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

  // Modal de Rateio Proporcional - Preparar Preview
  const handleOpenRateioPreview = (mgr: ManagerBlock, targetGoalR$: number) => {
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

    const proposals: RateioPreviewProposal[] = mgr.redes.map(r => {
      const key1 = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
      const currentVal = getMetaValue(r);
      const newVal = metaInputsPatch[key1] !== undefined ? metaInputsPatch[key1] : currentVal;
      return {
        rede: r.rede,
        codigo_matriz: r.codigo_matriz,
        currentVal,
        newVal,
        diff: newVal - currentVal
      };
    });

    setPreviewModal({
      open: true,
      manager: mgr,
      targetGoalR$,
      proposals,
      patchToApply: metaInputsPatch
    });
  };

  const handleConfirmRateioPreview = () => {
    if (!previewModal.manager) return;
    const mgrKey = previewModal.manager.manager_id || previewModal.manager.manager;
    setManagerMetaTargets(prev => ({ ...prev, [mgrKey]: previewModal.targetGoalR$ }));
    setMetaInputs(prev => ({ ...prev, ...previewModal.patchToApply }));
    setSaved(false);
    setPreviewModal(prev => ({ ...prev, open: false }));
  };

  const handleApplyQuickGrowthMultiplier = (mgr: ManagerBlock, multiplier: number) => {
    const targetGoal = Math.round(mgr.grandTotalMed3M * multiplier);
    handleOpenRateioPreview(mgr, targetGoal);
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
      const initialStatuses: Record<string, OperationalStatus> = {};

      const result: ManagerBlock[] = (managerBlocks || []).map((mb: any) => {
        const mgrKey = mb.manager_id || mb.manager;
        initialMgrTargets[mgrKey] = mb.grandTotalMeta || 0;
        initialStatuses[mgrKey] = "EM_EDICAO";

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
      setManagerStatuses(initialStatuses);
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

  // Resumo Executivo & Cards de Conciliação em Tempo Real
  const executiveCards = useMemo(() => {
    let totalMed3M = 0;
    let totalMetaInputted = 0;
    let totalConsolidatedGoal = 0;
    let totalRedesCount = 0;
    let totalRedesWithGoal = 0;

    managers.forEach((mgr) => {
      const mgrKey = mgr.manager_id || mgr.manager;
      const mgrGoalTarget = managerMetaTargets[mgrKey] || mgr.metaTotal || 0;
      totalConsolidatedGoal += mgrGoalTarget;
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

    const diffVal = totalConsolidatedGoal - totalMetaInputted;
    const diffPct = totalConsolidatedGoal > 0 ? (diffVal / totalConsolidatedGoal) * 100 : 0;
    const isConciliated = Math.abs(diffVal) < 0.01;
    const pctDistributed = totalConsolidatedGoal > 0 ? (totalMetaInputted / totalConsolidatedGoal) * 100 : 0;

    return {
      totalMed3M,
      totalMetaInputted,
      totalConsolidatedGoal,
      diffVal,
      diffPct,
      isConciliated,
      pctDistributed,
      totalRedesCount,
      totalRedesWithGoal,
      saldoRestante: Math.max(0, diffVal)
    };
  }, [managers, metaInputs, managerMetaTargets, getMetaValue]);

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
      {/* Navbar */}
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
            <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs font-bold">
              <button
                onClick={() => setCompactView(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  !compactView ? "bg-white text-neutral-900 shadow-sm font-black" : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Maximize2 className="w-3 h-3 text-blue-500" />
                <span>Completa (Anual)</span>
              </button>
              <button
                onClick={() => setCompactView(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  compactView ? "bg-white text-neutral-900 shadow-sm font-black" : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Minimize2 className="w-3 h-3 text-amber-500" />
                <span>Enxuta (3M)</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <Calendar className="w-3.5 h-3.5 text-neutral-500 ml-1.5" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-white border border-neutral-200 text-xs font-bold text-neutral-800 rounded-lg px-2 py-1 cursor-pointer"
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
                className="bg-white border border-neutral-200 text-xs font-bold text-neutral-800 rounded-lg px-2 py-1 cursor-pointer"
              >
                {YEARS_AVAILABLE.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                saved
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saved ? "Gravado na RPS!" : "Gravar Metas na RPS"}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
        {/* REFINAMENTO 1 & 3: CARD EXECUTIVO DE CONCILIAÇÃO & RESUMO SINTÉTICO */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Card 1: Conciliação em Tempo Real */}
          <div className={`p-4 rounded-xl border transition-all ${
            executiveCards.isConciliated 
              ? "bg-emerald-50/60 border-emerald-200" 
              : "bg-amber-50/60 border-amber-200"
          }`}>
            <div className="flex items-center justify-between text-xs font-bold text-neutral-500 mb-1">
              <span>Status de Conciliação</span>
              {executiveCards.isConciliated ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
            </div>
            <div className={`text-base font-black ${executiveCards.isConciliated ? "text-emerald-700" : "text-amber-800"}`}>
              {executiveCards.isConciliated ? "✓ Meta Conciliada" : `Desvio: ${formatCurrency(executiveCards.diffVal)}`}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              {executiveCards.isConciliated 
                ? "Meta Cia = Meta Redes (Paridade Zero)" 
                : `Diferença de ${executiveCards.diffPct.toFixed(1)}% a distribuir`}
            </div>
          </div>

          {/* Card 2: Meta Cia Consolidada */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
            <div className="text-xs font-bold text-neutral-500 mb-1">Meta Cia Consolidada</div>
            <div className="text-xl font-black text-neutral-900">
              {formatCurrency(executiveCards.totalConsolidatedGoal)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Meta total dos Gerentes</div>
          </div>

          {/* Card 3: Meta Distribuída */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
            <div className="text-xs font-bold text-neutral-500 mb-1">Meta Distribuída nas Redes</div>
            <div className="text-xl font-black text-blue-600">
              {formatCurrency(executiveCards.totalMetaInputted)}
            </div>
            <div className="text-[11px] text-blue-500 font-semibold mt-1">
              {executiveCards.pctDistributed.toFixed(1)}% do total
            </div>
          </div>

          {/* Card 4: Saldo Restante */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
            <div className="text-xs font-bold text-neutral-500 mb-1">Saldo Restante a Ratear</div>
            <div className="text-xl font-black text-amber-600">
              {formatCurrency(executiveCards.saldoRestante)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Valor pendente de rateio</div>
          </div>

          {/* Card 5: Cobertura de Redes */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
            <div className="text-xs font-bold text-neutral-500 mb-1">Redes com Meta</div>
            <div className="text-xl font-black text-purple-600">
              {executiveCards.totalRedesWithGoal} <span className="text-xs font-normal text-neutral-400">/ {executiveCards.totalRedesCount}</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {((executiveCards.totalRedesWithGoal / (executiveCards.totalRedesCount || 1)) * 100).toFixed(0)}% das redes preenchidas
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
          <div className="relative flex-1 w-full sm:w-auto max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por rede ou gerente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-bold text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              Expandir Todos
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              Recolher Todos
            </button>
          </div>
        </div>

        {/* Managers Table List */}
        {loading ? (
          <div className="bg-white p-12 rounded-xl border border-neutral-200 text-center text-neutral-500 text-sm">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Carregando estrutura comercial e histórico de faturamento...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-neutral-200 text-center text-neutral-500 text-sm">
            Nenhuma rede encontrada para os filtros aplicados.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((mgr) => {
              const mgrKey = mgr.manager_id || mgr.manager;
              const isExpanded = expandedManagers.has(mgr.manager);
              const mgrMetaTarget = managerMetaTargets[mgrKey] || mgr.metaTotal || 0;

              let sumInputted = 0;
              mgr.redes.forEach((r) => {
                sumInputted += getMetaValue(r);
              });

              const mgrDiff = mgrMetaTarget - sumInputted;
              const mgrConciliated = Math.abs(mgrDiff) < 0.01;
              const status = managerStatuses[mgrKey] || "EM_EDICAO";
              const statusInfo = STATUS_LABELS[status];

              return (
                <div key={mgr.manager} className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                  {/* Manager Header */}
                  <div
                    onClick={() => toggleManager(mgr.manager)}
                    className="p-4 bg-neutral-50/80 border-b border-neutral-200 flex items-center justify-between cursor-pointer hover:bg-neutral-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-neutral-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-neutral-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-neutral-900 text-base">{mgr.manager}</span>
                          {/* REFINAMENTO 2: STATUS OPERACIONAL DA META */}
                          <select
                            value={status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              setManagerStatuses(prev => ({ ...prev, [mgrKey]: e.target.value as OperationalStatus }));
                            }}
                            style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-current cursor-pointer focus:outline-none"
                          >
                            <option value="EM_EDICAO">Em Edição</option>
                            <option value="PENDENTE_APROVACAO">Pendente de Aprovação</option>
                            <option value="APROVADA">Aprovada</option>
                            <option value="PUBLICADA">Publicada</option>
                          </select>
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {mgr.redes.length} Redes Planejáveis \| Média 3M: {formatCurrency(mgr.grandTotalMed3M)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Conciliação do Gerente */}
                      <div className="text-right">
                        <div className="text-xs text-neutral-500">Distribuído / Meta Cia</div>
                        <div className="text-sm font-black flex items-center gap-1.5 justify-end">
                          <span className="text-blue-600">{formatCurrency(sumInputted)}</span>
                          <span className="text-neutral-400">/</span>
                          <span className="text-neutral-900">{formatCurrency(mgrMetaTarget)}</span>
                        </div>
                        <div className={`text-[11px] font-bold ${mgrConciliated ? "text-emerald-600" : "text-amber-600"}`}>
                          {mgrConciliated ? "✓ Conciliado" : `Diferença: ${formatCurrency(mgrDiff)}`}
                        </div>
                      </div>

                      {/* Botão Rateio Assistido com Modal de Preview */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRateioPreview(mgr, mgrMetaTarget > 0 ? mgrMetaTarget : Math.round(mgr.grandTotalMed3M * 1.1));
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Distribuir Proporcionalmente</span>
                      </button>
                    </div>
                  </div>

                  {/* Redes Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-neutral-100/50 border-b border-neutral-200 text-neutral-500 font-bold">
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3">Rede Planejável</th>
                            {tableDisplayedMonths.map((m) => (
                              <th key={m} className="p-3 text-right">
                                {m}
                              </th>
                            ))}
                            <th className="p-3 text-right bg-neutral-100/80">Média 3M</th>
                            <th className="p-3 text-right bg-amber-50/50 w-44 font-black text-neutral-900">
                              Meta R$ ({MONTH_NAMES_PT[selectedMonth - 1]})
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mgr.redes.map((r, rIdx) => {
                            const inputKey = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
                            const val = getMetaValue(r);

                            return (
                              <tr key={r.rede} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                                <td className="p-3 text-center text-neutral-400">{rIdx + 1}</td>
                                <td className="p-3 font-bold text-neutral-800">{r.rede}</td>
                                {tableDisplayedMonths.map((m) => (
                                  <td key={m} className="p-3 text-right font-mono text-neutral-600">
                                    {formatCurrency(r.months[m]?.fat || 0)}
                                  </td>
                                ))}
                                <td className="p-3 text-right font-mono font-bold bg-neutral-50 text-neutral-900">
                                  {formatCurrency(r.avg3M)}
                                </td>
                                <td className="p-3 text-right bg-amber-50/30">
                                  <ExecutiveMoneyInput
                                    value={val}
                                    onChangeValue={(newVal: number) =>
                                      setMetaValue(r.manager_id, r.codigo_matriz, r.rede, r.manager, newVal)
                                    }
                                  />
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
          </div>
        )}
      </main>

      {/* REFINAMENTO 4: MODAL DE PREVIEW DO RATEIO PROPORCIONAL */}
      {previewModal.open && previewModal.manager && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-neutral-900 text-base">
                  Preview do Rateio Proporcional — {previewModal.manager.manager}
                </h3>
              </div>
              <button
                onClick={() => setPreviewModal(prev => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50/50 border-b border-amber-100 text-xs text-amber-900 flex justify-between items-center">
              <span>Meta Cia a Distribuir: <strong>{formatCurrency(previewModal.targetGoalR$)}</strong></span>
              <span>Base: Rolling FAT 3M</span>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 font-bold">
                    <th className="p-2">Rede</th>
                    <th className="p-2 text-right">Valor Atual</th>
                    <th className="p-2 text-right">Novo Valor Proposto</th>
                    <th className="p-2 text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {previewModal.proposals.map((prop, idx) => (
                    <tr key={idx} className="border-b border-neutral-100">
                      <td className="p-2 font-bold text-neutral-800">{prop.rede}</td>
                      <td className="p-2 text-right font-mono text-neutral-500">{formatCurrency(prop.currentVal)}</td>
                      <td className="p-2 text-right font-mono font-bold text-blue-600">{formatCurrency(prop.newVal)}</td>
                      <td className={`p-2 text-right font-mono font-bold ${prop.diff >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {prop.diff >= 0 ? "+" : ""}{formatCurrency(prop.diff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-3">
              <button
                onClick={() => setPreviewModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRateioPreview}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Gravar Rateio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
