"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import { supabase } from "@/lib/supabase";
import { resolveCanonicalManager } from "@/lib/domain/canonical";

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
/**
 * Retorna dinamicamente os 3 últimos meses fechados imediatamente anteriores ao mês/ano da meta.
 * Ex: metaMonth = 8, year = 2026 -> ["2026-05", "2026-06", "2026-07"]
 */
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

/**
 * Retorna a classe de estilização condicional da coluna % vs Méd 3M
 */
function getPct3MStyle(pct: number) {
  if (pct <= 0) return "text-neutral-300 bg-neutral-50/30";
  if (pct < 80) return "text-red-700 bg-red-50/60 font-bold";
  if (pct <= 100) return "text-amber-700 bg-amber-50/60 font-bold";
  if (pct <= 120) return "text-emerald-700 bg-emerald-50/60 font-bold";
  return "text-emerald-900 bg-emerald-100/80 font-black";
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

  // Editable meta values: key = "manager_id|codigo_matriz|rede" -> value in R$
  const [metaInputs, setMetaInputs] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const loadData = useCallback(async (targetMonth: number, targetYear: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gestao/metas-rede?year=${targetYear}&month=${targetMonth}`);
      const json = await res.json();

      if (json.error) {
        console.error("API error:", json.error);
        return;
      }

      const { planRedes, billing, metas, managerMetas, months: apiMonths } = json;
      const monthKeys = apiMonths || Array.from({ length: targetMonth - 1 }, (_, i) => `${targetYear}-${String(i + 1).padStart(2, "0")}`);
      const last3ClosedMonths = getPreceding3ClosedMonths(targetMonth, targetYear);

      // Build map from PLANEJAVEIS (official redes per manager)
      const map: Record<string, { manager_id: string; redes: Record<string, { codigo_matriz: string; months: Record<string, { fat: number; qty: number }> }> }> = {};
      const added = new Set<string>();

      (planRedes || []).forEach((r: any) => {
        const mgrName = (r.manager || "SEM RESPONSÁVEL").trim();
        const mgrId = String(r.manager_id || "").trim();
        const codMatriz = String(r.codigo_matriz || "").trim();
        const rede = (r.rede || "").trim();
        if (!rede) return;
        const key = `${mgrId}|${codMatriz}|${rede}`;
        if (added.has(key)) return;
        added.add(key);

        if (!map[mgrName]) map[mgrName] = { manager_id: mgrId, redes: {} };
        
        // Match billing by rede name (uppercase) or managerKey
        const redeBilling = billing[rede.toUpperCase()] || billing[`${mgrId}|${rede.toUpperCase()}`] || {};
        const months: Record<string, { fat: number; qty: number }> = {};
        Object.entries(redeBilling).forEach(([mes, vals]: [string, any]) => {
          months[mes] = { fat: Number(vals.fat) || 0, qty: Number(vals.qty) || 0 };
        });
        map[mgrName].redes[rede] = { codigo_matriz: codMatriz, months };
      });

      // META map
      const metaMap: Record<string, number> = {};
      const initialInputs: Record<string, number> = {};
      (metas || []).forEach((m: any) => {
        const mgrName = (m.manager || "").trim();
        const mgrId = String(m.manager_id || "").trim();
        const codMatriz = String(m.codigo_matriz || "").trim();
        const rede = (m.client_matrix || "").trim();
        if (!rede) return;
        const val = Number(m.value) || 0;

        if (mgrId && codMatriz) {
          const k1 = `${mgrId}|${codMatriz}|${rede}`;
          metaMap[k1] = (metaMap[k1] || 0) + val;
          initialInputs[k1] = (initialInputs[k1] || 0) + val;
        }
        const k2 = `${mgrName}|${rede}`;
        metaMap[k2] = (metaMap[k2] || 0) + val;
        initialInputs[k2] = (initialInputs[k2] || 0) + val;
      });

      const mgrMetaMap: Record<string, number> = {};
      (managerMetas || []).forEach((m: any) => {
        const mgr = (m.manager || "").trim();
        mgrMetaMap[mgr] = (mgrMetaMap[mgr] || 0) + (Number(m.value) || 0);
      });

      const result: ManagerBlock[] = Object.entries(map)
        .map(([mgrName, mgrObj]) => {
          const redeList: RedeRow[] = Object.entries(mgrObj.redes)
            .map(([rede, data]) => {
              let totalFat = 0;
              let totalQty = 0;
              monthKeys.forEach((m: string) => {
                totalFat += data.months[m]?.fat || 0;
                totalQty += data.months[m]?.qty || 0;
              });

              let qFat = 0;
              let qQty = 0;
              let sumLast3M = 0;

              last3ClosedMonths.forEach((m: string) => {
                const fatM = data.months[m]?.fat || 0;
                qFat += fatM;
                qQty += data.months[m]?.qty || 0;
                sumLast3M += fatM;
              });
              const avgPriceQ2 = qQty > 0 ? qFat / qQty : 0;
              const avg3M = sumLast3M / 3;

              const metaFatKey = `${mgrObj.manager_id}|${data.codigo_matriz}|${rede}`;
              const metaFat = metaMap[metaFatKey] || metaMap[`${mgrName}|${rede}`] || 0;
              const metaVol = avgPriceQ2 > 0 ? metaFat / avgPriceQ2 : 0;

              return {
                rede,
                manager: mgrName,
                manager_id: mgrObj.manager_id,
                codigo_matriz: data.codigo_matriz,
                months: data.months,
                avgPriceQ2,
                metaFat,
                metaVol,
                totalFat,
                totalQty,
                avg3M,
              };
            })
            // FASE 3.6: Ordenar Redes por Média 3M decrescente (Desempate: alfabética)
            .sort((a, b) => (b.avg3M !== a.avg3M ? b.avg3M - a.avg3M : a.rede.localeCompare(b.rede, "pt-BR")));

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

          const grandTotalMed3M = redeList.reduce((s, r) => s + r.avg3M, 0);

          return {
            manager: mgrName,
            manager_id: mgrObj.manager_id,
            metaTotal: mgrMetaMap[mgrName] || 0,
            redes: redeList,
            totalFat: totalFatByMonth,
            totalQty: totalQtyByMonth,
            grandTotalFat: redeList.reduce((s, r) => s + r.totalFat, 0),
            grandTotalMed3M,
          };
        })
        // FASE 3.6: Ordenar Gerentes pela soma da Média 3M decrescente
        .sort((a, b) => b.grandTotalMed3M - a.grandTotalMed3M);

      setManagers(result);
      setMetaInputs(initialInputs);
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

  // Summary KPIs
  const totalFat = managers.reduce((s, m) => s + m.grandTotalFat, 0);
  const totalMed3M = managers.reduce((s, m) => s + m.grandTotalMed3M, 0);
  const totalMetaInputted = Object.values(metaInputs).reduce((s, v) => s + v, 0) / 2; // Divided by 2 due to duplicate keys (mgrId and mgrName)
  const totalRedes = managers.reduce((s, m) => s + m.redes.length, 0);
  const redesComMeta = managers.reduce(
    (acc, m) => acc + m.redes.filter((r) => getMetaValue(r) > 0).length,
    0
  );

  // Save handler (FASE 3.3 - Single Source of Truth Upsert)
  const handleSave = async () => {
    setSaving(true);
    try {
      // Collect unique network row inputs using soberan keys
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
            {/* FASE 3.2 - Seletor Dinâmico de Mês e Ano */}
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
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Expandir Tudo
            </button>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Recolher Tudo
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
            3 meses fechados: {dynamicPrecedingMonths.join(", ")} · Origem Soberana da RPS (`cm_weekly_projections`)
          </p>
        </div>

        {/* Executive Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Média 3M Total</span>
            </div>
            <p className="text-lg font-black text-blue-700">{formatCurrency(totalMed3M)}</p>
            <p className="text-[10px] text-neutral-400">{dynamicPrecedingMonths.join(", ")}</p>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                Meta {MONTH_SHORT_PT[selectedMonth - 1]} Digitada
              </span>
            </div>
            <p className="text-lg font-black text-amber-600">{formatCurrency(totalMetaInputted)}</p>
            <p className="text-[10px] text-neutral-400">{redesComMeta} redes preenchidas</p>
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
            <p className="text-lg font-black text-neutral-900">{totalRedes}</p>
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
            const mgrMetaSum = mgr.redes.reduce((s, r) => s + getMetaValue(r), 0);
            const mgrPreenchidas = mgr.redes.filter((r) => getMetaValue(r) > 0).length;
            const mgrTotalRedes = mgr.redes.length;
            const mgrVolPrevKg = mgr.redes.reduce((s, r) => {
              const inputVal = getMetaValue(r);
              return s + (r.avgPriceQ2 > 0 && inputVal > 0 ? inputVal / r.avgPriceQ2 : 0);
            }, 0);
            const mgrPace = mgrMetaSum > 0 && mgr.grandTotalMed3M > 0 ? (mgrMetaSum / mgr.grandTotalMed3M) * 100 : 0;

            return (
              <div key={mgr.manager} className="mb-3 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                {/* FASE 3.1 - Manager Header Resumo Executivo em Linha Única Horizontal */}
                <button
                  onClick={() => toggleManager(mgr.manager)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isOpen ? "bg-amber-100 text-amber-600" : "bg-neutral-100 text-neutral-400"
                      } transition-colors`}
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-bold text-neutral-900 truncate">{mgr.manager}</span>
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      {mgr.redes.length} Redes
                    </span>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5 shrink-0 text-xs">
                    <div className="text-right">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase block">Fat</span>
                      <span className="font-bold text-neutral-800">{formatCompact(mgr.grandTotalFat)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-blue-500 font-bold uppercase block">Méd 3M</span>
                      <span className="font-bold text-blue-700">{formatCompact(mgr.grandTotalMed3M)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-amber-500 font-bold uppercase block">
                        Meta {MONTH_SHORT_PT[selectedMonth - 1]}
                      </span>
                      <span className={`font-black ${mgrMetaSum > 0 ? "text-amber-600" : "text-neutral-300"}`}>
                        {mgrMetaSum > 0 ? formatCompact(mgrMetaSum) : "—"}
                      </span>
                    </div>
                    {mgrPace > 0 && (
                      <div className="text-right hidden sm:block">
                        <span className="text-[9px] text-violet-500 font-bold uppercase block">Pace</span>
                        <span className="font-bold text-violet-700">{mgrPace.toFixed(0)}%</span>
                      </div>
                    )}
                    <div className="text-right hidden md:block">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase block">Preenchidas</span>
                      <span className="font-bold text-emerald-600">
                        {mgrPreenchidas}/{mgrTotalRedes}
                      </span>
                    </div>
                    <div className="text-right hidden lg:block">
                      <span className="text-[9px] text-emerald-500 font-bold uppercase block">Vol Prev</span>
                      <span className="font-bold text-emerald-700">
                        {mgrVolPrevKg > 0 ? `${formatCompact(mgrVolPrevKg)} Kg` : "—"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Table */}
                {isOpen && (
                  <div className="overflow-x-auto border-t border-neutral-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-neutral-50">
                          <th className="text-left px-4 py-2.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider sticky left-0 bg-neutral-50 z-10 min-w-[180px]">
                            Rede
                          </th>
                          {dynamicPrecedingMonths.map((mKey) => {
                            const monthIndex = parseInt(mKey.split("-")[1], 10) - 1;
                            return (
                              <th key={mKey} className="text-right px-3 py-2.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider min-w-[72px]">
                                {MONTH_SHORT_PT[monthIndex]}
                              </th>
                            );
                          })}
                          <th className="text-right px-3 py-2.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider min-w-[80px] bg-blue-50">
                            Méd 3M
                          </th>
                          <th className="text-right px-3 py-2.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider min-w-[68px]">
                            R$/Kg
                          </th>
                          <th className="text-center px-2 py-2.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider min-w-[95px] bg-amber-50">
                            Meta {MONTH_SHORT_PT[selectedMonth - 1]} R$
                          </th>
                          <th className="text-right px-3 py-2.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider min-w-[70px] bg-emerald-50">
                            Vol. Kg
                          </th>
                          {/* FASE 3.5 - Nova Coluna % vs Méd 3M */}
                          <th className="text-center px-2 py-2.5 text-[10px] font-bold text-violet-600 uppercase tracking-wider min-w-[75px] bg-violet-50">
                            % vs Méd 3M
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {mgr.redes.map((r, idx) => {
                          const inputVal = getMetaValue(r);
                          const volKg = r.avgPriceQ2 > 0 && inputVal > 0 ? inputVal / r.avgPriceQ2 : 0;
                          
                          // FASE 3.5: Média 3M Kg & Percentual % vs Méd 3M
                          const med3MKg = r.avgPriceQ2 > 0 && r.avg3M > 0 ? r.avg3M / r.avgPriceQ2 : 0;
                          let pct3M = 0;
                          if (med3MKg > 0 && volKg > 0) {
                            pct3M = (volKg / med3MKg) * 100;
                          } else if (r.avg3M > 0 && inputVal > 0) {
                            pct3M = (inputVal / r.avg3M) * 100;
                          }

                          return (
                            <tr
                              key={`${r.manager_id}|${r.codigo_matriz}|${r.rede}`}
                              className={`border-t border-neutral-100 hover:bg-amber-50/30 transition-colors ${
                                idx % 2 === 0 ? "bg-white" : "bg-neutral-50/50"
                              }`}
                            >
                              <td className="px-4 py-2 font-semibold text-neutral-700 sticky left-0 bg-white z-10">
                                <span className="truncate block max-w-[170px]">{r.rede}</span>
                              </td>
                              {dynamicPrecedingMonths.map((mKey) => {
                                const fat = r.months[mKey]?.fat || 0;
                                return (
                                  <td key={mKey} className="text-right px-3 py-2 tabular-nums text-neutral-500 font-medium">
                                    {fat > 0 ? formatCompact(fat) : <span className="text-neutral-300">—</span>}
                                  </td>
                                );
                              })}
                              <td className="text-right px-3 py-2 tabular-nums font-bold text-blue-700 bg-blue-50/50">
                                {r.avg3M > 0 ? formatCompact(r.avg3M) : "—"}
                              </td>
                              <td className="text-right px-3 py-2 tabular-nums text-neutral-500 font-medium">
                                {r.avgPriceQ2 > 0 ? `${r.avgPriceQ2.toFixed(2).replace(".", ",")}` : <span className="text-neutral-300">—</span>}
                              </td>

                              {/* FASE 3.4 - Meta Input com largura reduzida (~25%) */}
                              <td className="px-2 py-1.5 bg-amber-50/50 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  step={100}
                                  value={inputVal || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setMetaValue(
                                      r.manager_id,
                                      r.codigo_matriz,
                                      r.rede,
                                      r.manager,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  className="w-20 min-w-[75px] text-right text-xs font-bold text-amber-700 bg-white border border-amber-200 rounded-md px-2 py-1 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:text-neutral-300 tabular-nums"
                                />
                              </td>

                              {/* Volume */}
                              <td className="text-right px-3 py-2 tabular-nums font-bold bg-emerald-50/50">
                                {volKg > 0 ? (
                                  <span className="text-emerald-700">{formatCompact(volKg)}</span>
                                ) : (
                                  <span className="text-neutral-300">—</span>
                                )}
                              </td>

                              {/* FASE 3.5 - Nova Coluna % vs Méd 3M com Tooltip */}
                              <td
                                className={`text-center px-2 py-2 tabular-nums text-xs font-bold ${getPct3MStyle(pct3M)}`}
                                title={`Meta ${MONTH_SHORT_PT[selectedMonth - 1]}: ${
                                  volKg > 0 ? formatCompact(volKg) : 0
                                } Kg\nMédia 3M: ${med3MKg > 0 ? formatCompact(med3MKg) : 0} Kg\nResultado: ${
                                  pct3M > 0 ? pct3M.toFixed(1) + "%" : "—"
                                }`}
                              >
                                {pct3M > 0 ? `${pct3M.toFixed(0)}%` : "—"}
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
