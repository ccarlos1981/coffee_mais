"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Target,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Users,
  BarChart3,
  Sparkles,
  Search,
  Save,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/lib/supabase";

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
const YEAR = 2026;
const MONTHS_KEYS = Array.from({ length: 7 }, (_, i) => `${YEAR}-${String(i + 1).padStart(2, "0")}`);
const META_MONTH = 8; // Agosto

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface RedeRow {
  rede: string;
  months: Record<string, { fat: number; qty: number }>;
  avgPriceQ2: number;
  metaFat: number;
  metaVol: number;
  totalFat: number;
  totalQty: number;
}

interface ManagerBlock {
  manager: string;
  metaTotal: number;
  redes: RedeRow[];
  totalFat: Record<string, number>;
  totalQty: Record<string, number>;
  grandTotalFat: number;
}

/* ─── Page Component ────────────────────────────────────────────────────────── */
export default function MetasRedePage() {
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<ManagerBlock[]>([]);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  // Editable meta values: key = "manager|rede" -> value in R$
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

  const setMetaValue = (manager: string, rede: string, value: number) => {
    const key = `${manager}|${rede}`;
    setMetaInputs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const getMetaValue = (manager: string, rede: string): number => {
    const key = `${manager}|${rede}`;
    return metaInputs[key] ?? 0;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gestao/metas-rede?year=2026");
      const json = await res.json();

      if (json.error) {
        console.error("API error:", json.error);
        return;
      }

      const { planRedes, billing, metas, managerMetas, months: apiMonths } = json;
      // billing = Record<REDE_UPPER, Record<mes, {fat, qty}>>
      // planRedes = [{rede, manager}]

      const monthKeys = apiMonths || MONTHS_KEYS;
      const lastQ = monthKeys.slice(-3);

      // Build map from PLANEJAVEIS (official redes per manager)
      const map: Record<string, Record<string, { months: Record<string, { fat: number; qty: number }> }>> = {};
      const added = new Set<string>();

      (planRedes || []).forEach((r: any) => {
        const mgr = (r.manager || "SEM RESPONSÁVEL").trim();
        const rede = (r.rede || "").trim();
        if (!rede) return;
        const key = `${mgr}|${rede}`;
        if (added.has(key)) return;
        added.add(key);

        if (!map[mgr]) map[mgr] = {};
        // Match billing by rede name (uppercase)
        const redeBilling = billing[rede.toUpperCase()] || {};
        const months: Record<string, { fat: number; qty: number }> = {};
        Object.entries(redeBilling).forEach(([mes, vals]: [string, any]) => {
          months[mes] = { fat: Number(vals.fat) || 0, qty: Number(vals.qty) || 0 };
        });
        map[mgr][rede] = { months };
      });

      // META map
      const metaMap: Record<string, Record<string, number>> = {};
      const initialInputs: Record<string, number> = {};
      (metas || []).forEach((m: any) => {
        const mgr = (m.manager || "").trim();
        const rede = (m.client_matrix || "").trim();
        if (!mgr || !rede) return;
        if (!metaMap[mgr]) metaMap[mgr] = {};
        const val = Number(m.value) || 0;
        metaMap[mgr][rede] = (metaMap[mgr][rede] || 0) + val;
        initialInputs[`${mgr}|${rede}`] = (initialInputs[`${mgr}|${rede}`] || 0) + val;
      });

      const mgrMetaMap: Record<string, number> = {};
      (managerMetas || []).forEach((m: any) => {
        const mgr = (m.manager || "").trim();
        mgrMetaMap[mgr] = (mgrMetaMap[mgr] || 0) + (Number(m.value) || 0);
      });

      const result: ManagerBlock[] = Object.entries(map)
        .map(([mgr, redes]) => {
          const redeList: RedeRow[] = Object.entries(redes)
            .map(([rede, data]) => {
              let totalFat = 0;
              let totalQty = 0;
              monthKeys.forEach((m: string) => {
                totalFat += data.months[m]?.fat || 0;
                totalQty += data.months[m]?.qty || 0;
              });

              let qFat = 0;
              let qQty = 0;
              lastQ.forEach((m: string) => {
                qFat += data.months[m]?.fat || 0;
                qQty += data.months[m]?.qty || 0;
              });
              const avgPriceQ2 = qQty > 0 ? qFat / qQty : 0;

              const metaFat = metaMap[mgr]?.[rede] || 0;
              const metaVol = avgPriceQ2 > 0 ? metaFat / avgPriceQ2 : 0;

              return { rede, months: data.months, avgPriceQ2, metaFat, metaVol, totalFat, totalQty };
            })
            .sort((a, b) => b.totalFat - a.totalFat);

          const totalFatByMonth: Record<string, number> = {};
          const totalQtyByMonth: Record<string, number> = {};
          monthKeys.forEach((m: string) => { totalFatByMonth[m] = 0; totalQtyByMonth[m] = 0; });
          redeList.forEach((r) => {
            monthKeys.forEach((m: string) => {
              totalFatByMonth[m] += r.months[m]?.fat || 0;
              totalQtyByMonth[m] += r.months[m]?.qty || 0;
            });
          });

          return {
            manager: mgr,
            metaTotal: mgrMetaMap[mgr] || 0,
            redes: redeList,
            totalFat: totalFatByMonth,
            totalQty: totalQtyByMonth,
            grandTotalFat: redeList.reduce((s, r) => s + r.totalFat, 0),
          };
        })
        .sort((a, b) => b.grandTotalFat - a.grandTotalFat);

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

  useEffect(() => { loadData(); }, [loadData]);

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
  const totalMetaInputted = Object.values(metaInputs).reduce((s, v) => s + v, 0);
  const totalRedes = managers.reduce((s, m) => s + m.redes.length, 0);
  const redesComMeta = Object.values(metaInputs).filter((v) => v > 0).length;

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    try {
      // Build rows to upsert
      const rows = Object.entries(metaInputs)
        .filter(([, val]) => val > 0)
        .map(([key, val]) => {
          const [manager, rede] = key.split("|");
          return {
            manager,
            client_matrix: rede,
            kpi: "META",
            value: val,
            month: META_MONTH,
            year: YEAR,
            week_start_date: `${YEAR}-${String(META_MONTH).padStart(2, "0")}-01`,
          };
        });

      if (rows.length > 0) {
        const { error } = await supabase
          .from("cm_weekly_projections")
          .upsert(rows, { onConflict: "manager,client_matrix,kpi,month,year,week_start_date" });

        if (error) throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar metas:", err);
      alert("Erro ao salvar. Verifique o console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#1e293b]">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-neutral-400 hover:text-neutral-800 transition-colors text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Início
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-xs font-bold text-neutral-800 tracking-wide flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-500" />
              Abertura de Meta por Rede
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-all">
              Expandir Tudo
            </button>
            <button onClick={collapseAll} className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-all">
              Recolher Tudo
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                saved
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 shadow-sm"
              }`}
            >
              {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Metas"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="max-w-[1440px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 mb-1">
            Abertura de Meta por Rede
          </h1>
          <p className="text-neutral-400 text-xs">
            Histórico Jan–Jul 2026 · Preço médio último trimestre · Meta Agosto 2026
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Fat. Acumulado</span>
            </div>
            <p className="text-lg font-black text-neutral-900">{formatCurrency(totalFat)}</p>
            <p className="text-[10px] text-neutral-400">Jan–Jul 2026</p>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Meta Ago Digitada</span>
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
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Redes</span>
            </div>
            <p className="text-lg font-black text-neutral-900">{totalRedes}</p>
            <p className="text-[10px] text-neutral-400">Redes com faturamento</p>
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
        {!loading && filtered.map((mgr) => {
          const isOpen = expandedManagers.has(mgr.manager);
          const mgrMetaSum = mgr.redes.reduce((s, r) => s + getMetaValue(mgr.manager, r.rede), 0);

          return (
            <div key={mgr.manager} className="mb-3 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
              {/* Manager Header */}
              <button
                onClick={() => toggleManager(mgr.manager)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOpen ? "bg-amber-100 text-amber-600" : "bg-neutral-100 text-neutral-400"} transition-colors`}>
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-neutral-900">{mgr.manager}</p>
                    <p className="text-[10px] text-neutral-400">
                      {mgr.redes.length} redes · Fat. acum. {formatCurrency(mgr.grandTotalFat)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase">Meta Ago</p>
                    <p className={`text-sm font-black ${mgrMetaSum > 0 ? "text-amber-600" : "text-neutral-300"}`}>
                      {mgrMetaSum > 0 ? formatCurrency(mgrMetaSum) : "—"}
                    </p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase">Preenchidas</p>
                    <p className="text-sm font-black text-emerald-600">
                      {mgr.redes.filter((r) => getMetaValue(mgr.manager, r.rede) > 0).length}/{mgr.redes.length}
                    </p>
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
                        {MONTHS_KEYS.map((m, i) => (
                          <th key={m} className="text-right px-3 py-2.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider min-w-[72px]">
                            {MONTH_LABELS[i]}
                          </th>
                        ))}
                        <th className="text-right px-3 py-2.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider min-w-[80px] bg-blue-50">
                          Acumul.
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider min-w-[68px]">
                          R$/Kg
                        </th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider min-w-[110px] bg-amber-50">
                          Meta Ago R$
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider min-w-[70px] bg-emerald-50">
                          Vol. Kg
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mgr.redes.map((r, idx) => {
                        const inputVal = getMetaValue(mgr.manager, r.rede);
                        const volKg = r.avgPriceQ2 > 0 && inputVal > 0 ? inputVal / r.avgPriceQ2 : 0;

                        return (
                          <tr
                            key={r.rede}
                            className={`border-t border-neutral-100 hover:bg-amber-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-neutral-50/50"}`}
                          >
                            <td className="px-4 py-2 font-semibold text-neutral-700 sticky left-0 bg-white z-10">
                              <span className="truncate block max-w-[170px]">{r.rede}</span>
                            </td>
                            {MONTHS_KEYS.map((m) => {
                              const fat = r.months[m]?.fat || 0;
                              return (
                                <td key={m} className="text-right px-3 py-2 tabular-nums text-neutral-500 font-medium">
                                  {fat > 0 ? formatCompact(fat) : <span className="text-neutral-300">—</span>}
                                </td>
                              );
                            })}
                            <td className="text-right px-3 py-2 tabular-nums font-bold text-blue-700 bg-blue-50/50">
                              {r.totalFat > 0 ? formatCompact(r.totalFat) : "—"}
                            </td>
                            <td className="text-right px-3 py-2 tabular-nums text-neutral-500 font-medium">
                              {r.avgPriceQ2 > 0 ? `${r.avgPriceQ2.toFixed(2).replace(".", ",")}` : <span className="text-neutral-300">—</span>}
                            </td>
                            {/* Meta Input */}
                            <td className="px-2 py-1.5 bg-amber-50/50">
                              <input
                                type="number"
                                min={0}
                                step={100}
                                value={inputVal || ""}
                                placeholder="0"
                                onChange={(e) => setMetaValue(mgr.manager, r.rede, Number(e.target.value) || 0)}
                                className="w-full text-right text-xs font-bold text-amber-700 bg-white border border-amber-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:text-neutral-300 tabular-nums"
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
                          </tr>
                        );
                      })}

                      {/* Totals */}
                      <tr className="border-t-2 border-neutral-200 bg-neutral-50 font-bold">
                        <td className="px-4 py-2.5 text-[10px] font-black text-neutral-600 uppercase tracking-wider sticky left-0 bg-neutral-50 z-10">
                          Total {mgr.manager}
                        </td>
                        {MONTHS_KEYS.map((m) => (
                          <td key={m} className="text-right px-3 py-2.5 tabular-nums text-neutral-800 text-[11px]">
                            {mgr.totalFat[m] > 0 ? formatCompact(mgr.totalFat[m]) : "—"}
                          </td>
                        ))}
                        <td className="text-right px-3 py-2.5 tabular-nums text-blue-700 text-[11px] bg-blue-50">
                          {formatCompact(mgr.grandTotalFat)}
                        </td>
                        <td className="text-right px-3 py-2.5 text-neutral-400">—</td>
                        <td className="text-center px-3 py-2.5 tabular-nums text-amber-700 text-[11px] bg-amber-50 font-black">
                          {mgrMetaSum > 0 ? formatCompact(mgrMetaSum) : "0"}
                        </td>
                        <td className="text-right px-3 py-2.5 tabular-nums text-emerald-700 text-[11px] bg-emerald-50">
                          {(() => {
                            const totalVol = mgr.redes.reduce((s, r) => {
                              const mv = getMetaValue(mgr.manager, r.rede);
                              return s + (r.avgPriceQ2 > 0 && mv > 0 ? mv / r.avgPriceQ2 : 0);
                            }, 0);
                            return totalVol > 0 ? formatCompact(totalVol) : "0";
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-neutral-400 text-sm">Nenhum resultado encontrado</p>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("pt-BR")}k`;
  return value.toFixed(0);
}
