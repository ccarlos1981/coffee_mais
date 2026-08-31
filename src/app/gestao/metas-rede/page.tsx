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
  Clock,
  Lock,
  Edit3,
  Briefcase,
  Truck,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import { ExecutiveMoneyInput } from "@/components/ui/executive-money-input";
import { supabase } from "@/lib/supabase";
import { resolveCanonicalManager } from "@/lib/domain/canonical";
import { PlanningGoalAllocator } from "@/lib/planning/planning-goal-allocator";
import { DISTRIBUTORS_REGISTRY } from "@/lib/domain/commercial-structure";

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const YEARS_AVAILABLE = [2025, 2026, 2027];

type WorkflowStatus = "DRAFT" | "REVIEW" | "APPROVED" | "FROZEN";

const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; bg: string; description: string }> = {
  DRAFT: { label: "Em Edição", color: "#d97706", bg: "rgba(245, 158, 11, 0.12)", description: "Planejamento aberto para edição" },
  REVIEW: { label: "Pendente de Aprovação", color: "#2563eb", bg: "rgba(59, 130, 246, 0.12)", description: "Submetido para avaliação da diretoria" },
  APPROVED: { label: "Aprovada", color: "#059669", bg: "rgba(16, 185, 129, 0.12)", description: "Validada pela diretoria comercial" },
  FROZEN: { label: "Publicada (Congelada)", color: "#7c3aed", bg: "rgba(139, 92, 246, 0.12)", description: "Metas congeladas e oficiais para o exercício" },
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
export function cleanManagerName(name: string): string {
  if (!name) return "";
  return name.replace(/\s*\((KA|Dist|DIST|Key Accounts)\)/gi, "").trim();
}

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

export function formatMilReais(val: number): string {
  if (!val || isNaN(val) || val === 0) return "R$ 0";
  const inThousands = val / 1000;
  return `R$ ${inThousands.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
}

export function formatValorMilharSimples(val: number): string {
  if (!val || isNaN(val) || val === 0) return "0,0";
  const inThousands = val / 1000;
  return inThousands.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface RedeRow {
  rede: string;
  manager: string;
  manager_id: string;
  codigo_matriz: string;
  canal?: string;
  display_order?: number;
  months: Record<string, { fat: number; qty: number }>;
  avgPriceQ2: number;
  precoMedio3M: number;
  metaFat: number;
  metaVol: number;
  volMetaKg: number;
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

  // Profile Security State (ITEM 1)
  const [userRole, setUserRole] = useState<string>("Admin");
  const [isGerenteOnly, setIsGerenteOnly] = useState<boolean>(false);
  const [userManagerName, setUserManagerName] = useState<string>("");

  // Editable meta values state & baseline reference
  const [metaInputs, setMetaInputs] = useState<Record<string, number>>({});
  const savedStateRef = useRef<Record<string, number>>({});

  const [managerMetaTargets, setManagerMetaTargets] = useState<Record<string, number>>({});
  const [channelMetaTargets, setChannelMetaTargets] = useState<Record<string, { ka: number; dist: number }>>({});
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>("DRAFT");
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [isWorkflowTransitioning, setIsWorkflowTransitioning] = useState<boolean>(false);
  
  // Rateio Preview Modal state
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    manager: ManagerBlock | null;
    targetGoalR$: number;
    channelLabel?: string;
    proposals: RateioPreviewProposal[];
    patchToApply: Record<string, number>;
  }>({
    open: false,
    manager: null,
    targetGoalR$: 0,
    channelLabel: "Carteira",
    proposals: [],
    patchToApply: {}
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Network Management States (Wave Evolução Funcional)
  const [allAvailableNetworks, setAllAvailableNetworks] = useState<Array<{
    rede: string;
    manager: string;
    manager_id: string;
    codigo_matriz: string;
    canal: string;
    is_rede_planejavel: boolean;
    search_terms?: string;
  }>>([]);

  const [addRedeModal, setAddRedeModal] = useState<{
    open: boolean;
    manager: ManagerBlock | null;
    channel?: "KA" | "Dist";
  }>({
    open: false,
    manager: null,
    channel: "KA"
  });

  const [searchRedeTerm, setSearchRedeTerm] = useState("");
  const [selectedRedeToAdd, setSelectedRedeToAdd] = useState<string | null>(null);

  const [removeRedeModal, setRemoveRedeModal] = useState<{
    open: boolean;
    manager: ManagerBlock | null;
    rede: RedeRow | null;
  }>({
    open: false,
    manager: null,
    rede: null
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Check top-down authorization
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

  // Lock de edição quando status for Aprovada ou Publicada para usuários comuns
  const isEditingLocked = useMemo(() => {
    if (workflowStatus === "APPROVED" || workflowStatus === "FROZEN") {
      return !isTopDownAuthorized;
    }
    return false;
  }, [workflowStatus, isTopDownAuthorized]);

  // Contagem de Alterações Pendentes (ITEM 2)
  const dirtyKeysCount = useMemo(() => {
    let count = 0;
    Object.keys(metaInputs).forEach((k) => {
      const currentVal = metaInputs[k] || 0;
      const initialVal = savedStateRef.current[k] || 0;
      if (Math.abs(currentVal - initialVal) > 0.001) {
        count++;
      }
    });
    return count;
  }, [metaInputs]);

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

  // Input Setter with immediate live update trigger
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

  // Helper para resgatar o valor da meta em memória (ITEM 6)
  const getMetaValue = useCallback(
    (r: RedeRow): number => {
      const key1 = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
      if (metaInputs[key1] !== undefined) return metaInputs[key1];
      const key2 = `${r.manager}|${r.rede}`;
      if (metaInputs[key2] !== undefined) return metaInputs[key2];
      return r.metaFat || 0;
    },
    [metaInputs]
  );

  // Modal de Rateio Proporcional - Preparar Preview
  const handleOpenRateioPreview = (mgr: ManagerBlock, targetGoalR$: number, subsetRedes?: RedeRow[], channelLabel?: string) => {
    const redesToDistribute = subsetRedes || mgr.redes;

    const mgrBlockViewModel = {
      manager: mgr.manager,
      manager_id: mgr.manager_id,
      totalRedes: redesToDistribute.length,
      grandTotalFat: mgr.grandTotalFat,
      grandTotalMed3M: redesToDistribute.reduce((sum, r) => sum + (r.avg3M || 0), 0),
      grandTotalMed3MKg: 0,
      grandTotalMeta: targetGoalR$,
      mgrPace: 100,
      mgrPreenchidas: redesToDistribute.length,
      mgrVolPrevKg: 0,
      redes: redesToDistribute.map(r => ({
        rede: r.rede,
        manager: r.manager,
        manager_id: r.manager_id,
        codigo_matriz: r.codigo_matriz,
        canal: r.canal,
        fatQ2: r.totalFat,
        qtyQ2: r.totalQty,
        avgPriceQ2: r.avgPriceQ2,
        precoMedio3M: r.precoMedio3M,
        avg3M: r.avg3M,
        avg3MKg: 0,
        metaVal: getMetaValue(r),
        metaKg: 0,
        volMetaKg: r.volMetaKg,
        pctVsAvg3M: 0,
        monthlyHistory: r.months
      }))
    };

    const { metaInputsPatch } = PlanningGoalAllocator.distributeManagerGoal(mgrBlockViewModel, targetGoalR$);

    const proposals: RateioPreviewProposal[] = redesToDistribute.map(r => {
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
      channelLabel: channelLabel || "Carteira",
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

  const loadData = useCallback(async (targetMonth: number, targetYear: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gestao/metas-rede?year=${targetYear}&month=${targetMonth}&_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        }
      });
      const json = await res.json();

      if (json.error) {
        console.error("API error:", json.error);
        return;
      }

      // Receber metadados de perfil da API (ITEM 1)
      if (json.userProfile) {
        if (json.userProfile.role) setUserRole(json.userProfile.role);
        if (json.userProfile.isGerenteOnly !== undefined) setIsGerenteOnly(json.userProfile.isGerenteOnly);
        if (json.userProfile.userManagerName) setUserManagerName(json.userProfile.userManagerName);
      }

      // Receber status de governança do workflow
      if (json.workflow) {
        setWorkflowStatus(json.workflow.status || "DRAFT");
        setWorkflowData(json.workflow);
      }

      // Receber cadastro mestre de redes disponíveis
      if (json.availableNetworks) {
        setAllAvailableNetworks(json.availableNetworks);
      }

      const { managerBlocks, managerMetas, months: apiMonths } = json;
      const monthKeys = apiMonths || Array.from({ length: targetMonth - 1 }, (_, i) => `${targetYear}-${String(i + 1).padStart(2, "0")}`);
      const initialInputs: Record<string, number> = {};
      const initialMgrTargets: Record<string, number> = {};
      const initialChannelTargets: Record<string, { ka: number; dist: number }> = {};

      const result: ManagerBlock[] = (managerBlocks || []).map((mb: any) => {
        const mgrKey = mb.manager_id || mb.manager;
        initialMgrTargets[mgrKey] = mb.grandTotalMeta || 0;

        const kaObj = (managerMetas || []).find((mm: any) => mm.manager_id === mb.manager_id && mm.manager.includes("(KA)"));
        const distObj = (managerMetas || []).find((mm: any) => mm.manager_id === mb.manager_id && mm.manager.includes("(Dist)"));

        initialChannelTargets[mb.manager_id] = {
          ka: kaObj ? Number(kaObj.value) || 0 : mb.grandTotalMeta || 0,
          dist: distObj ? Number(distObj.value) || 0 : 0
        };

        const redeList: RedeRow[] = (mb.redes || []).map((r: any) => {
          let totalFat = 0;
          let totalQty = 0;
          Object.values(r.monthlyHistory || {}).forEach((val: any) => {
            totalFat += Number(val.fat) || 0;
            totalQty += Number(val.qty) || 0;
          });

          const metaFat = Number(r.metaVal) || 0;
          const precoMedio3M = Number(r.precoMedio3M) || (totalQty > 0 ? totalFat / totalQty : (r.avgPriceQ2 || 0));
          const volMetaKg = precoMedio3M > 0 ? metaFat / precoMedio3M : (r.avgPriceQ2 > 0 ? metaFat / r.avgPriceQ2 : 0);
          const metaVol = volMetaKg;

          const k1 = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
          const k2 = `${r.manager}|${r.rede}`;
          initialInputs[k1] = metaFat;
          initialInputs[k2] = metaFat;

          return {
            rede: r.rede,
            manager: r.manager,
            manager_id: r.manager_id,
            codigo_matriz: r.codigo_matriz,
            canal: r.canal,
            months: r.monthlyHistory || {},
            avgPriceQ2: r.avgPriceQ2 || 0,
            precoMedio3M,
            metaFat,
            metaVol,
            volMetaKg,
            totalFat,
            totalQty,
            avg3M: r.avg3M || 0,
            display_order: r.display_order,
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
      savedStateRef.current = { ...initialInputs };
      setManagerMetaTargets(initialMgrTargets);
      setChannelMetaTargets(initialChannelTargets);
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

  // Transição Oficial de Workflow
  const handleWorkflowTransition = async (targetStatus: WorkflowStatus, comments?: string) => {
    setIsWorkflowTransitioning(true);
    try {
      const res = await fetch("/api/gestao/metas-rede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "WORKFLOW_TRANSITION",
          year: selectedYear,
          month: selectedMonth,
          targetStatus,
          comments
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao atualizar status do workflow.");
      }
      setWorkflowStatus(targetStatus);
      if (data.workflow) setWorkflowData(data.workflow);
      await loadData(selectedMonth, selectedYear);
    } catch (err: any) {
      console.error("Erro na transição de workflow:", err);
      alert(`Erro no workflow: ${err.message}`);
    } finally {
      setIsWorkflowTransitioning(false);
    }
  };

  // Save handler (Upsert into cm_weekly_projections para Sincronização Bidirecional - ITEM 3)
  const handleSave = async () => {
    if (isEditingLocked) {
      alert("As metas desta competência estão aprovadas/congeladas. Apenas administradores podem realizar alterações.");
      return;
    }
    setSaving(true);
    try {
      const recordsToUpsert: any[] = [];
      const canonDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;

      managers.forEach((mgr) => {
        mgr.redes.forEach((r) => {
          const val = getMetaValue(r);
          if (val >= 0) {
            recordsToUpsert.push({
              manager: mgr.manager,
              manager_id: r.manager_id || mgr.manager_id,
              client_matrix: r.rede,
              codigo_matriz: r.codigo_matriz,
              kpi: "META",
              week_start_date: canonDate,
              year: selectedYear,
              month: selectedMonth,
              projection_value: val,
              updated_at: new Date().toISOString(),
            });
          }
        });
      });

      if (recordsToUpsert.length > 0) {
        const { error } = await supabase
          .from("cm_weekly_projections")
          .upsert(recordsToUpsert, { onConflict: "manager,client_matrix,kpi,month,year,week_start_date" });

        if (error) throw error;
      }

      savedStateRef.current = { ...metaInputs };
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
      await loadData(selectedMonth, selectedYear);
    } catch (err: any) {
      console.error("Erro ao salvar metas na RPS:", err);
      alert(`Erro ao salvar metas: ${err?.message || "Verifique o console."}`);
    } finally {
      setSaving(false);
    }
  };

  // Mapeamento de Ownership Ativo entre todas as redes
  const assignedRedesMap = useMemo(() => {
    const map = new Map<string, string>(); // redeUpper -> managerName
    managers.forEach((mgr) => {
      mgr.redes.forEach((r) => {
        map.set(r.rede.toUpperCase(), mgr.manager);
      });
    });
    return map;
  }, [managers]);

  // Lista Filtrada de Redes Elegíveis para Adição
  const filteredAvailableRedes = useMemo(() => {
    if (!addRedeModal.open || !addRedeModal.manager) return [];
    const term = searchRedeTerm.trim().toLowerCase();
    const isDistFilter = addRedeModal.channel === "Dist";

    return allAvailableNetworks.filter((item) => {
      const name = item.rede.toLowerCase();
      const cod = (item.codigo_matriz || "").toLowerCase();
      const canal = (item.canal || "").toLowerCase();
      const searchTerms = (item.search_terms || `${name} ${cod} ${canal}`).toLowerCase();

      // Compatibilidade de canal
      const isDistNet = canal.includes("dist") || (DISTRIBUTORS_REGISTRY[item.manager_id]?.redes || []).some((d) => item.rede.toUpperCase().includes(d.toUpperCase()));
      if (isDistFilter && !isDistNet) return false;
      if (!isDistFilter && isDistNet) return false;

      // Filtro de busca textual enriquecido (suporta busca por matriz, nome parceiro, razão social, código)
      if (term && !searchTerms.includes(term) && !name.includes(term) && !cod.includes(term) && !canal.includes(term)) {
        return false;
      }

      return true;
    });
  }, [allAvailableNetworks, addRedeModal, searchRedeTerm]);

  const handleAddRede = async () => {
    if (!addRedeModal.manager || !selectedRedeToAdd) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/gestao/metas-rede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_REDE",
          year: selectedYear,
          month: selectedMonth,
          manager: addRedeModal.manager.manager,
          manager_id: addRedeModal.manager.manager_id,
          rede: selectedRedeToAdd
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Erro ao adicionar rede.");
        return;
      }
      setAddRedeModal({ open: false, manager: null });
      setSelectedRedeToAdd(null);
      setSearchRedeTerm("");
      await loadData(selectedMonth, selectedYear);
    } catch (err: any) {
      setActionError(err.message || "Erro de conexão ao adicionar rede.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRede = async () => {
    if (!removeRedeModal.manager || !removeRedeModal.rede) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/gestao/metas-rede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REMOVE_REDE",
          year: selectedYear,
          month: selectedMonth,
          manager: removeRedeModal.manager.manager,
          rede: removeRedeModal.rede.rede
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Erro ao excluir rede.");
        return;
      }
      setRemoveRedeModal({ open: false, manager: null, rede: null });
      await loadData(selectedMonth, selectedYear);
    } catch (err: any) {
      setActionError(err.message || "Erro de conexão ao excluir rede.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reordenação Manual de Redes (Reutilizando semântica da RPS — display_order em cm_rps_custom_carteira)
  const handleMoveNetworkUp = async (mgr: ManagerBlock, channel: "KA" | "Dist", cIdx: number) => {
    if (cIdx <= 0 || isEditingLocked || saving) return;

    const isDistFilter = channel === "Dist";
    const kaRedes = mgr.redes.filter((r) => {
      const isDist = (r.canal || "").toLowerCase().includes("dist") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some((d) => r.rede.toUpperCase().includes(d.toUpperCase()));
      return !isDist;
    });
    const distRedes = mgr.redes.filter((r) => {
      const isDist = (r.canal || "").toLowerCase().includes("dist") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some((d) => r.rede.toUpperCase().includes(d.toUpperCase()));
      return isDist;
    });

    const targetList = isDistFilter ? [...distRedes] : [...kaRedes];
    if (cIdx <= 0 || cIdx >= targetList.length) return;

    // Swap
    const temp = targetList[cIdx];
    targetList[cIdx] = targetList[cIdx - 1];
    targetList[cIdx - 1] = temp;

    // Combine back
    const newRedes = isDistFilter ? [...kaRedes, ...targetList] : [...targetList, ...distRedes];

    // Optimistic UI update
    setManagers((prev) =>
      prev.map((m) => {
        if (m.manager === mgr.manager) {
          return { ...m, redes: newRedes };
        }
        return m;
      })
    );

    // Build ordered list for persistence
    const orderedPayload = newRedes.map((r, idx) => ({
      rede: r.rede,
      display_order: idx
    }));

    try {
      const res = await fetch("/api/gestao/metas-rede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REORDER_NETWORKS",
          year: selectedYear,
          month: selectedMonth,
          manager: mgr.manager,
          orderedRedes: orderedPayload
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error("Erro ao persistir reordenação de redes:", data?.error);
        alert(`Erro ao salvar ordem das redes: ${data?.error || "Falha na comunicação."}`);
        await loadData(selectedMonth, selectedYear);
      }
    } catch (err: any) {
      console.error("Erro ao persistir reordenação de redes:", err);
      alert(`Erro de conexão ao salvar ordem: ${err.message}`);
      await loadData(selectedMonth, selectedYear);
    }
  };

  const handleMoveNetworkDown = async (mgr: ManagerBlock, channel: "KA" | "Dist", cIdx: number) => {
    if (isEditingLocked || saving) return;

    const isDistFilter = channel === "Dist";
    const kaRedes = mgr.redes.filter((r) => {
      const isDist = (r.canal || "").toLowerCase().includes("dist") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some((d) => r.rede.toUpperCase().includes(d.toUpperCase()));
      return !isDist;
    });
    const distRedes = mgr.redes.filter((r) => {
      const isDist = (r.canal || "").toLowerCase().includes("dist") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some((d) => r.rede.toUpperCase().includes(d.toUpperCase()));
      return isDist;
    });

    const targetList = isDistFilter ? [...distRedes] : [...kaRedes];
    if (cIdx < 0 || cIdx >= targetList.length - 1) return;

    // Swap
    const temp = targetList[cIdx];
    targetList[cIdx] = targetList[cIdx + 1];
    targetList[cIdx + 1] = temp;

    // Combine back
    const newRedes = isDistFilter ? [...kaRedes, ...targetList] : [...targetList, ...distRedes];

    // Optimistic UI update
    setManagers((prev) =>
      prev.map((m) => {
        if (m.manager === mgr.manager) {
          return { ...m, redes: newRedes };
        }
        return m;
      })
    );

    // Build ordered list for persistence
    const orderedPayload = newRedes.map((r, idx) => ({
      rede: r.rede,
      display_order: idx
    }));

    try {
      const res = await fetch("/api/gestao/metas-rede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REORDER_NETWORKS",
          year: selectedYear,
          month: selectedMonth,
          manager: mgr.manager,
          orderedRedes: orderedPayload
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error("Erro ao persistir reordenação de redes:", data?.error);
        alert(`Erro ao salvar ordem das redes: ${data?.error || "Falha na comunicação."}`);
        await loadData(selectedMonth, selectedYear);
      }
    } catch (err: any) {
      console.error("Erro ao persistir reordenação de redes:", err);
      alert(`Erro de conexão ao salvar ordem: ${err.message}`);
      await loadData(selectedMonth, selectedYear);
    }
  };

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return managers;
    const q = searchTerm.toLowerCase();
    return managers
      .map((m) => ({ ...m, redes: m.redes.filter((r) => r.rede.toLowerCase().includes(q)) }))
      .filter((m) => m.redes.length > 0 || m.manager.toLowerCase().includes(q));
  }, [managers, searchTerm]);

  // Consolidado Nacional — Visão Executiva Direta por Canal (KA × Distribuidor)
  const nationalConsolidated = useMemo(() => {
    let kaDistribuida = 0;
    let kaOficial = 0;
    let distDistribuida = 0;
    let distOficial = 0;
    let totalRedesKA = 0;
    let totalRedesDist = 0;

    managers.forEach((mgr) => {
      const kaRedes = mgr.redes.filter((r) => {
        const isDist = (r.canal || "").toLowerCase().includes("dist") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some((d) => r.rede.toUpperCase().includes(d.toUpperCase()));
        return !isDist;
      });
      const distRedes = mgr.redes.filter((r) => {
        const isDist = (r.canal || "").toLowerCase().includes("dist") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some((d) => r.rede.toUpperCase().includes(d.toUpperCase()));
        return isDist;
      });

      totalRedesKA += kaRedes.length;
      totalRedesDist += distRedes.length;

      kaRedes.forEach((r) => {
        kaDistribuida += getMetaValue(r);
      });
      distRedes.forEach((r) => {
        distDistribuida += getMetaValue(r);
      });

      const chTargets = channelMetaTargets[mgr.manager_id] || { ka: mgr.metaTotal || 0, dist: 0 };
      kaOficial += chTargets.ka || 0;
      distOficial += chTargets.dist || 0;
    });

    const kaDiff = kaOficial - kaDistribuida;
    const kaConciliated = Math.abs(kaDiff) < 0.01;

    const distDiff = distOficial - distDistribuida;
    const distConciliated = Math.abs(distDiff) < 0.01;

    return {
      ka: {
        distribuida: kaDistribuida,
        oficial: kaOficial,
        diff: kaDiff,
        conciliated: kaConciliated,
        totalRedes: totalRedesKA
      },
      dist: {
        distribuida: distDistribuida,
        oficial: distOficial,
        diff: distDiff,
        conciliated: distConciliated,
        totalRedes: totalRedesDist
      }
    };
  }, [managers, channelMetaTargets, getMetaValue]);

  // Resumo Executivo & Cards de Conciliação em Tempo Real (ITEM 6 — SINCRONIZAÇÃO REATIVA)
  const executiveCards = useMemo(() => {
    let totalMed3M = 0;
    let totalMetaInputted = 0;
    let totalConsolidatedGoal = 0;
    let totalRedesCount = 0;
    let totalRedesWithGoal = 0;
    let totalVolMetaKg = 0;

    managers.forEach((mgr) => {
      const mgrKey = mgr.manager_id || mgr.manager;
      const mgrGoalTarget = managerMetaTargets[mgrKey] || mgr.metaTotal || 0;
      totalConsolidatedGoal += mgrGoalTarget;
      totalMed3M += mgr.grandTotalMed3M;
      totalRedesCount += mgr.redes.length;

      mgr.redes.forEach((r) => {
        const val = getMetaValue(r);
        const pm3M = r.precoMedio3M > 0 ? r.precoMedio3M : (r.avgPriceQ2 > 0 ? r.avgPriceQ2 : 0);
        const volKg = pm3M > 0 ? val / pm3M : 0;
        
        if (val > 0) {
          totalMetaInputted += val;
          totalRedesWithGoal++;
          totalVolMetaKg += volKg;
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
      totalVolMetaKg,
      saldoRestante: Math.max(0, diffVal)
    };
  }, [managers, managerMetaTargets, getMetaValue]);

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
      {/* Navbar Superior */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
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
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 font-bold">
                <Target className="w-4 h-4" />
              </div>
              <span className="font-black text-neutral-900 text-sm tracking-tight">Metas por Rede</span>
              {isGerenteOnly && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 ml-2">
                  <Lock className="w-3 h-3 text-blue-500" />
                  Minha Carteira ({cleanManagerName(userManagerName || "Gerente")})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ITEM 2: Indicador de Alterações Pendentes na Topbar */}
            {dirtyKeysCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold animate-pulse">
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>{dirtyKeysCount} {dirtyKeysCount === 1 ? "alteração pendente" : "alterações pendentes"}</span>
              </div>
            )}

            {/* Status Simples da Competência & Lock Executivo */}
            <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs font-bold">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border ${
                  workflowStatus === "FROZEN"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {workflowStatus === "FROZEN" ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Competência Congelada</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Competência Aberta</span>
                  </>
                )}
              </div>

              {isTopDownAuthorized && (
                <button
                  type="button"
                  onClick={() => handleWorkflowTransition(workflowStatus === "FROZEN" ? "DRAFT" : "FROZEN")}
                  disabled={isWorkflowTransitioning || loading}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer ${
                    workflowStatus === "FROZEN"
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-neutral-800 hover:bg-neutral-900 text-white"
                  }`}
                  title={workflowStatus === "FROZEN" ? "Descongelar esta competência para permitir edições" : "Congelar esta competência contra novas edições"}
                >
                  {workflowStatus === "FROZEN" ? (
                    <>
                      <Lock className="w-3 h-3 text-amber-200" />
                      <span>Descongelar</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-neutral-300" />
                      <span>Congelar</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Alternar Visualização */}
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

            {/* Seletores de Período */}
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

            {/* Botão de Persistência Sincronizada (ITEM 3) */}
            <button
              onClick={handleSave}
              disabled={saving || isEditingLocked}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                isEditingLocked
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed border border-neutral-300"
                  : saved
                  ? "bg-emerald-600 text-white"
                  : dirtyKeysCount > 0
                  ? "bg-amber-500 text-white hover:bg-amber-600 shadow-md ring-2 ring-amber-300"
                  : "bg-neutral-800 text-white hover:bg-neutral-900"
              }`}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isEditingLocked ? (
                <Lock className="w-4 h-4 text-neutral-500" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isEditingLocked ? "Metas Congeladas" : saved ? "Gravado na RPS!" : "Salvar Metas na RPS"}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
        {/* 🏛️ CONSOLIDADO NACIONAL NO TOPO DA TELA (KA × DISTRIBUIDOR) */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5 mb-3.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900">
                Consolidado Nacional — {MONTH_NAMES_PT[selectedMonth - 1]}/{selectedYear}
              </span>
            </div>
            <div className="text-[11px] font-bold text-neutral-500">
              Total Brasil: {nationalConsolidated.ka.totalRedes + nationalConsolidated.dist.totalRedes} Redes Planejáveis ({nationalConsolidated.ka.totalRedes} KA / {nationalConsolidated.dist.totalRedes} Dist)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco Nacional: CANAL KA */}
            <div className="bg-gradient-to-br from-indigo-50/50 via-white to-white rounded-xl border border-indigo-100 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-indigo-50 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-950">Canal KA</span>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {nationalConsolidated.ka.totalRedes} Redes
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-white rounded-lg p-2.5 border border-indigo-100/60 shadow-2xs">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">Meta Distribuída</div>
                  <div className="text-xs sm:text-sm font-black text-indigo-700 mt-1 font-mono">{formatCurrency(nationalConsolidated.ka.distribuida)}</div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-indigo-100/60 shadow-2xs">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">Meta Oficial</div>
                  <div className="text-xs sm:text-sm font-black text-neutral-900 mt-1 font-mono">{formatCurrency(nationalConsolidated.ka.oficial)}</div>
                </div>
                <div className={`rounded-lg p-2.5 border shadow-2xs ${
                  nationalConsolidated.ka.conciliated 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}>
                  <div className="text-[10px] font-bold uppercase tracking-tight">Saldo</div>
                  <div className="text-xs sm:text-sm font-black mt-1 font-mono">
                    {nationalConsolidated.ka.conciliated ? "✓ Conciliado" : formatCurrency(nationalConsolidated.ka.diff)}
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco Nacional: CANAL DISTRIBUIDOR */}
            <div className="bg-gradient-to-br from-amber-50/50 via-white to-white rounded-xl border border-amber-100 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-amber-50 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-950">Distribuidor</span>
                </div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                  {nationalConsolidated.dist.totalRedes} Redes
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-white rounded-lg p-2.5 border border-amber-100/60 shadow-2xs">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">Meta Distribuída</div>
                  <div className="text-xs sm:text-sm font-black text-amber-700 mt-1 font-mono">{formatCurrency(nationalConsolidated.dist.distribuida)}</div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-amber-100/60 shadow-2xs">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">Meta Oficial</div>
                  <div className="text-xs sm:text-sm font-black text-neutral-900 mt-1 font-mono">{formatCurrency(nationalConsolidated.dist.oficial)}</div>
                </div>
                <div className={`rounded-lg p-2.5 border shadow-2xs ${
                  nationalConsolidated.dist.conciliated 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}>
                  <div className="text-[10px] font-bold uppercase tracking-tight">Saldo</div>
                  <div className="text-xs sm:text-sm font-black mt-1 font-mono">
                    {nationalConsolidated.dist.conciliated ? "✓ Conciliado" : formatCurrency(nationalConsolidated.dist.diff)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar de Busca e Ações */}
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
            Carregando estrutura comercial e metas por rede...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-neutral-200 text-center text-neutral-500 text-sm">
            Nenhuma rede ou gerente encontrado para a consulta.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((mgr) => {
              const mgrKey = mgr.manager_id || mgr.manager;
              const isExpanded = expandedManagers.has(mgr.manager);

              const kaRedes = mgr.redes.filter((r) => {
                const canalUpper = String(r.canal || "").toUpperCase();
                const isDist = canalUpper.includes("DIST") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some(d => r.rede.toUpperCase().includes(d.toUpperCase()));
                return !isDist;
              });

              const distRedes = mgr.redes.filter((r) => {
                const canalUpper = String(r.canal || "").toUpperCase();
                const isDist = canalUpper.includes("DIST") || (DISTRIBUTORS_REGISTRY[r.manager_id]?.redes || []).some(d => r.rede.toUpperCase().includes(d.toUpperCase()));
                return isDist;
              });

              // Obter Metas Oficiais por Canal da tabela targets (via channelMetaTargets)
              const chTargetObj = channelMetaTargets[mgr.manager_id] || { ka: 0, dist: 0 };
              const kaOfficialMeta = chTargetObj.ka > 0 ? chTargetObj.ka : (managerMetaTargets[mgrKey] || mgr.metaTotal || 0);
              const distOfficialMeta = chTargetObj.dist;

              // Total Consolidado do Gerente
              const mgrConsolidatedTarget = kaOfficialMeta + distOfficialMeta;

              // Cálculos KA em tempo real
              let kaSumInputted = 0;
              let kaVolSum = 0;
              kaRedes.forEach((r) => {
                const val = getMetaValue(r);
                const pm3M = r.precoMedio3M > 0 ? r.precoMedio3M : (r.avgPriceQ2 > 0 ? r.avgPriceQ2 : 0);
                kaSumInputted += val;
                kaVolSum += pm3M > 0 ? val / pm3M : 0;
              });
              const kaDiff = kaOfficialMeta - kaSumInputted;
              const kaConciliated = Math.abs(kaDiff) < 0.01;

              // Cálculos Distribuidor em tempo real
              let distSumInputted = 0;
              let distVolSum = 0;
              distRedes.forEach((r) => {
                const val = getMetaValue(r);
                const pm3M = r.precoMedio3M > 0 ? r.precoMedio3M : (r.avgPriceQ2 > 0 ? r.avgPriceQ2 : 0);
                distSumInputted += val;
                distVolSum += pm3M > 0 ? val / pm3M : 0;
              });
              const distDiff = distOfficialMeta - distSumInputted;
              const distConciliated = Math.abs(distDiff) < 0.01;

              const totalSumInputted = kaSumInputted + distSumInputted;
              const totalVolSum = kaVolSum + distVolSum;
              const totalDiff = mgrConsolidatedTarget - totalSumInputted;
              const totalConciliated = Math.abs(totalDiff) < 0.01;

              const mgrClean = cleanManagerName(mgr.manager);

              let hasMgrDirtyCell = false;
              mgr.redes.forEach((r) => {
                const inputKey = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
                const val = getMetaValue(r);
                if (savedStateRef.current[inputKey] !== undefined && Math.abs(val - (savedStateRef.current[inputKey] || 0)) > 0.001) {
                  hasMgrDirtyCell = true;
                }
              });

              const renderRedesTable = (redesList: RedeRow[], channel: "KA" | "Dist") => (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100/60 border-b border-neutral-200 text-neutral-500 font-bold">
                        <th className="p-3 w-8 text-center">#</th>
                        <th className="p-3 w-14 text-center">Ordem</th>
                        <th className="p-3">Rede Planejável</th>
                        {tableDisplayedMonths.map((m) => (
                          <th key={m} className="p-3 text-right font-medium">
                            <div>{m}</div>
                            <div className="text-[9px] font-normal text-neutral-400">R$ mil</div>
                          </th>
                        ))}
                        <th className="p-3 text-right bg-neutral-100/80 font-black text-neutral-900">
                          <div className="leading-tight">
                            <div>MÉDIA 3M</div>
                            <div className="text-[9px] font-bold text-neutral-500">R$ mil</div>
                          </div>
                        </th>
                        <th className="p-3 text-right bg-blue-50/60 text-blue-900 font-bold border-l border-r border-blue-100">PREÇO MÉDIO 3M</th>
                        <th className="p-3 text-center bg-neutral-50/80 font-black text-neutral-900 w-28">
                          <div className="leading-tight text-center">
                            <div>Meta R$</div>
                            <div className="text-[9px] font-bold text-neutral-500">R$ mil</div>
                          </div>
                        </th>
                        <th className="p-3 text-right bg-emerald-50/60 text-emerald-900 font-bold border-l border-r border-emerald-100">VOL META (Kg)</th>
                        <th className="p-3 text-right">% vs Média 3M</th>
                        <th className="p-3 w-10 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redesList.map((r, rIdx) => {
                        const val = getMetaValue(r);
                        const pm3M = r.precoMedio3M > 0 ? r.precoMedio3M : (r.avgPriceQ2 > 0 ? r.avgPriceQ2 : 0);
                        const volMetaKg = pm3M > 0 ? val / pm3M : 0;
                        const pctVsAvg3M = r.avg3M > 0 && val > 0 ? ((val - r.avg3M) / r.avg3M) * 100 : 0;

                        const inputKey = `${r.manager_id}|${r.codigo_matriz}|${r.rede}`;
                        const isCellDirty = savedStateRef.current[inputKey] !== undefined && Math.abs(val - (savedStateRef.current[inputKey] || 0)) > 0.001;

                        // Cálculo de Maior e Menor Faturamento Positivo para Destaque
                        const positiveFats = tableDisplayedMonths.map(mon => r.months[mon]?.fat || 0).filter(f => f > 0);
                        const maxFat = positiveFats.length > 1 ? Math.max(...positiveFats) : -1;
                        const minFat = positiveFats.length > 1 ? Math.min(...positiveFats) : -1;

                        return (
                          <tr key={`${r.manager_id}-${r.codigo_matriz}-${r.rede}`} className={`border-b border-neutral-100 transition-colors ${
                            isCellDirty ? "bg-amber-50/30" : "hover:bg-neutral-50/50"
                          }`}>
                            <td className="p-3 text-center text-neutral-400 font-mono text-[11px]">{rIdx + 1}</td>
                            <td className="p-2 text-center w-14">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={rIdx === 0 || isEditingLocked || saving}
                                  onClick={() => handleMoveNetworkUp(mgr, channel, rIdx)}
                                  className="p-1 rounded hover:bg-neutral-200/60 text-neutral-500 hover:text-neutral-900 disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
                                  title="Mover para cima (▲)"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={rIdx === redesList.length - 1 || isEditingLocked || saving}
                                  onClick={() => handleMoveNetworkDown(mgr, channel, rIdx)}
                                  className="p-1 rounded hover:bg-neutral-200/60 text-neutral-500 hover:text-neutral-900 disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
                                  title="Mover para baixo (▼)"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 font-bold text-neutral-800 flex items-center gap-2">
                              <span>{r.rede}</span>
                              {isCellDirty && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Alteração pendente" />
                              )}
                            </td>

                            {tableDisplayedMonths.map((m) => {
                              const fatVal = r.months[m]?.fat || 0;
                              const isMax = positiveFats.length > 1 && fatVal === maxFat && maxFat > 0;
                              const isMin = positiveFats.length > 1 && fatVal === minFat && minFat > 0 && minFat !== maxFat;

                              return (
                                <td key={m} className="p-3 text-right font-mono text-xs">
                                  <span className={`inline-block px-1.5 py-0.5 rounded transition-all ${
                                    fatVal === 0
                                      ? "text-neutral-400"
                                      : isMax
                                      ? "text-emerald-700 font-bold bg-emerald-50 border border-emerald-200"
                                      : isMin
                                      ? "text-rose-700 font-bold bg-rose-50 border border-rose-200"
                                      : "text-neutral-700 font-medium"
                                  }`}>
                                    {formatValorMilharSimples(fatVal)}
                                  </span>
                                </td>
                              );
                            })}

                            <td className="p-3 text-right font-mono font-bold bg-neutral-50 text-neutral-900">
                              {formatValorMilharSimples(r.avg3M)}
                            </td>

                            <td className="p-3 text-right font-mono font-semibold bg-blue-50/20 text-blue-900 border-l border-r border-blue-100">
                              {pm3M > 0 ? `${formatCurrency(pm3M)} /Kg` : "—"}
                            </td>

                            <td className="p-2 text-center w-28">
                              <div className="flex justify-center">
                                <ExecutiveMoneyInput
                                  value={val}
                                  inThousands={true}
                                  disabled={isEditingLocked || saving}
                                  onChangeValue={(newVal: number) =>
                                    setMetaValue(r.manager_id, r.codigo_matriz, r.rede, r.manager, newVal)
                                  }
                                  className={`w-24 text-center font-mono font-bold bg-white text-neutral-900 border rounded-md px-2 py-1.5 text-xs shadow-xs focus:outline-none focus:ring-2 transition-all ${
                                    isCellDirty
                                      ? "border-amber-500 ring-1 ring-amber-400 focus:ring-amber-500 focus:border-amber-500"
                                      : "border-neutral-300 hover:border-neutral-400 focus:ring-neutral-900 focus:border-neutral-900"
                                  } disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200`}
                                />
                              </div>
                            </td>

                            <td className="p-3 text-right font-mono font-bold bg-emerald-50/30 text-emerald-800 border-l border-r border-emerald-100">
                              {volMetaKg > 0 ? `${Math.round(volMetaKg).toLocaleString("pt-BR")} Kg` : "—"}
                            </td>

                            <td className={`p-3 text-right font-mono font-semibold ${
                              pctVsAvg3M > 0 ? "text-emerald-600" : pctVsAvg3M < 0 ? "text-rose-600" : "text-neutral-400"
                            }`}>
                              {pctVsAvg3M !== 0 ? `${pctVsAvg3M > 0 ? "+" : ""}${pctVsAvg3M.toFixed(1)}%` : "—"}
                            </td>

                            <td className="p-3 text-center">
                              <button
                                type="button"
                                disabled={isEditingLocked || saving}
                                onClick={() => setRemoveRedeModal({ open: true, manager: mgr, rede: r })}
                                title={`Excluir ${r.rede} do planejamento`}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );

              return (
                <div key={mgr.manager} className={`bg-white rounded-xl border transition-all shadow-sm overflow-hidden ${
                  hasMgrDirtyCell ? "border-amber-300 ring-1 ring-amber-200" : "border-neutral-200"
                }`}>
                  {/* Header Consolidado do Gerente */}
                  <div
                    onClick={() => toggleManager(mgr.manager)}
                    className="p-4 bg-neutral-50/80 border-b border-neutral-200 flex items-center justify-between cursor-pointer hover:bg-neutral-100/80 transition-colors flex-wrap gap-4"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-neutral-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-neutral-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-neutral-900 text-base">{cleanManagerName(mgr.manager)}</span>
                          
                          {hasMgrDirtyCell && (
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              <Edit3 className="w-3 h-3 text-amber-600" />
                              Em Edição
                            </span>
                          )}

                          {workflowStatus === "FROZEN" && (
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              <Lock className="w-3 h-3" />
                              Congelada
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-3">
                          <span>{mgr.redes.length} Redes Planejáveis ({kaRedes.length} KA / {distRedes.length} Dist)</span>
                          <span>•</span>
                          <span>Média 3M Total: {formatCurrency(mgr.grandTotalMed3M)}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-700">Vol Meta Total: {Math.round(totalVolSum).toLocaleString("pt-BR")} Kg</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap justify-end">
                      {/* Botão Salvar Metas do Gerente */}
                      <button
                        type="button"
                        disabled={isEditingLocked || saving}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSave();
                        }}
                        className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                          isEditingLocked
                            ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                            : saved
                            ? "bg-emerald-600 text-white border border-emerald-700 shadow-emerald-200"
                            : hasMgrDirtyCell
                            ? "bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 ring-2 ring-amber-300 animate-pulse shadow-amber-200"
                            : "bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-900"
                        }`}
                        title="Salvar todas as metas editadas na tela"
                      >
                        {saving ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : saved ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{saved ? "Gravado na RPS!" : "💾 Salvar Metas"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-cards de Canais Segregados (KA x Distribuidor) */}
                  {isExpanded && (
                    <div className="p-4 bg-neutral-50/40 space-y-5 border-t border-neutral-100">
                      {/* 💼 CANAL 1: KA (Key Account) */}
                      <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-blue-50/50 to-white border-b border-indigo-100 flex flex-col gap-2.5">
                          {/* Linha 1: Título do canal e KPIs */}
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-600 text-white flex items-center gap-1.5 shadow-sm">
                                <Briefcase className="w-3.5 h-3.5" />
                                CANAL KA (Key Accounts)
                              </span>
                              <span className="text-xs text-neutral-500 font-semibold">{kaRedes.length} Redes</span>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Vol: {Math.round(kaVolSum).toLocaleString("pt-BR")} Kg
                              </span>
                            </div>
                          </div>

                          {/* Linha 2: Botões de Ação do Canal */}
                          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-indigo-100/60">
                            <button
                              type="button"
                              disabled={isEditingLocked || saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddRedeModal({ open: true, manager: mgr, channel: "KA" });
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer ${
                                isEditingLocked
                                  ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                                  : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>+ Adicionar Rede</span>
                            </button>

                            <button
                              type="button"
                              disabled={isEditingLocked || saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRateioPreview(
                                  mgr,
                                  kaOfficialMeta > 0 ? kaOfficialMeta : Math.round(kaRedes.reduce((s, r) => s + (r.avg3M || 0), 0) * 1.1),
                                  kaRedes,
                                  "KA (Key Account)"
                                );
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer ${
                                isEditingLocked
                                  ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                                  : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                              }`}
                            >
                              <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>Distribuir Proporcionalmente (KA)</span>
                            </button>
                          </div>
                        </div>

                        {kaRedes.length > 0 ? (
                          renderRedesTable(kaRedes, "KA")
                        ) : (
                          <div className="p-6 text-center text-xs text-neutral-400 italic">
                            Nenhuma rede KA vinculada a esta carteira.
                          </div>
                        )}
                      </div>

                      {/* 🚚 CANAL 2: DISTRIBUIDOR */}
                      <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-white border-b border-amber-100 flex flex-col gap-2.5">
                          {/* Linha 1: Título do canal e KPIs */}
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-600 text-white flex items-center gap-1.5 shadow-sm">
                                <Truck className="w-3.5 h-3.5" />
                                CANAL DISTRIBUIDOR
                              </span>
                              <span className="text-xs text-neutral-500 font-semibold">{distRedes.length} Clientes / Distribuidores</span>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Vol: {Math.round(distVolSum).toLocaleString("pt-BR")} Kg
                              </span>
                            </div>
                          </div>

                          {/* Linha 2: Botões de Ação do Canal */}
                          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-amber-100/60">
                            <button
                              type="button"
                              disabled={isEditingLocked || saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddRedeModal({ open: true, manager: mgr, channel: "Dist" });
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer ${
                                isEditingLocked
                                  ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                                  : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>+ Adicionar Rede</span>
                            </button>

                            <button
                              type="button"
                              disabled={isEditingLocked || saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRateioPreview(
                                  mgr,
                                  distOfficialMeta > 0 ? distOfficialMeta : Math.round(distRedes.reduce((s, r) => s + (r.avg3M || 0), 0) * 1.1),
                                  distRedes,
                                  "Distribuidor"
                                );
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer ${
                                isEditingLocked
                                  ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                                  : "text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                              }`}
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Distribuir Proporcionalmente (Dist)</span>
                            </button>
                          </div>
                        </div>

                        {distRedes.length > 0 ? (
                          renderRedesTable(distRedes, "Dist")
                        ) : (
                          <div className="p-6 text-center text-xs text-neutral-400 italic">
                            Nenhum cliente ou distribuidor atacado vinculado a esta carteira.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL DE PREVIEW DO RATEIO PROPORCIONAL */}
      {previewModal.open && previewModal.manager && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-neutral-900 text-base">
                  Preview do Rateio Proporcional — {cleanManagerName(previewModal.manager.manager)} ({previewModal.channelLabel || "Carteira"})
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
                <span>Confirmar Rateio</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 1: ADICIONAR REDE NA CARTEIRA DE PLANEJAMENTO */}
      {addRedeModal.open && addRedeModal.manager && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden font-sans space-y-4 p-6 animate-fade-in flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Adicionar Rede no Planejamento
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Gerente: <span className="font-bold text-neutral-800">{cleanManagerName(addRedeModal.manager.manager)}</span> ({addRedeModal.channel === "Dist" ? "Canal Distribuidor" : "Canal KA"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddRedeModal({ open: false, manager: null });
                  setSelectedRedeToAdd(null);
                  setActionError(null);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Input de Pesquisa Dinâmica */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                autoFocus
                placeholder="Pesquisar por nome da rede, código de matriz ou canal..."
                value={searchRedeTerm}
                onChange={(e) => setSearchRedeTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Lista de Resultados de Pesquisa */}
            <div className="overflow-y-auto space-y-2 pr-1 text-xs flex-1 max-h-72">
              {filteredAvailableRedes.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400 italic">
                  Nenhuma rede encontrada para a busca "{searchRedeTerm}".
                </div>
              ) : (
                filteredAvailableRedes.map((item, itemIdx) => {
                  const currentOwner = assignedRedesMap.get(item.rede.toUpperCase());
                  const isOwnedByCurrent = currentOwner && cleanManagerName(currentOwner).toLowerCase() === cleanManagerName(addRedeModal.manager?.manager || "").toLowerCase();
                  const isOwnedByOther = currentOwner && !isOwnedByCurrent;
                  const isSelected = selectedRedeToAdd === item.rede;

                  return (
                    <div
                      key={`${item.rede}_${item.codigo_matriz || ''}_${itemIdx}`}
                      onClick={() => {
                        if (!isOwnedByCurrent && !isOwnedByOther) {
                          setSelectedRedeToAdd(item.rede);
                          setActionError(null);
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isOwnedByOther
                          ? "bg-neutral-50 border-neutral-200 opacity-60 cursor-not-allowed"
                          : isOwnedByCurrent
                          ? "bg-neutral-50 border-neutral-200 opacity-60 cursor-not-allowed"
                          : isSelected 
                          ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-400 cursor-pointer" 
                          : "bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300 cursor-pointer"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-900">{item.rede}</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                            {item.canal || "KA"}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-2">
                          {item.codigo_matriz && <span>Matriz: {item.codigo_matriz}</span>}
                          {isOwnedByOther && (
                            <span className="font-sans font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              🔒 Pertence a: {currentOwner}
                            </span>
                          )}
                          {isOwnedByCurrent && (
                            <span className="font-sans font-semibold text-neutral-500">
                              ✓ Já nesta carteira
                            </span>
                          )}
                        </div>
                      </div>

                      {!isOwnedByCurrent && !isOwnedByOther && (
                        <input
                          type="radio"
                          name="selectedRedeToAdd"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedRedeToAdd(item.rede);
                            setActionError(null);
                          }}
                          className="accent-emerald-600 w-4 h-4 cursor-pointer"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Botões de Ação do Modal */}
            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  setAddRedeModal({ open: false, manager: null });
                  setSelectedRedeToAdd(null);
                  setActionError(null);
                }}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedRedeToAdd || actionLoading}
                onClick={handleAddRede}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading ? "Adicionando..." : "+ Confirmar Inclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAÇÃO DE EXCLUSÃO DE REDE */}
      {removeRedeModal.open && removeRedeModal.manager && removeRedeModal.rede && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Excluir Rede do Planejamento
                </h3>
                <p className="text-xs text-neutral-500">
                  Gerente: {cleanManagerName(removeRedeModal.manager.manager)}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-700 leading-relaxed">
              Deseja remover a rede <strong className="text-neutral-900">{removeRedeModal.rede.rede}</strong> da carteira de planejamento de <strong>{cleanManagerName(removeRedeModal.manager.manager)}</strong> para <strong>{MONTH_NAMES_PT[selectedMonth - 1]}/{selectedYear}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
              <strong>Nota de Governança:</strong> Esta ação remove a rede da carteira ativa do gerente nesta competência. O histórico de faturamento real e o cadastro mestre permanecem 100% preservados.
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRemoveRedeModal({ open: false, manager: null, rede: null });
                  setActionError(null);
                }}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRemoveRede}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                {actionLoading ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
