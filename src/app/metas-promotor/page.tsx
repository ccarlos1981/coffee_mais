"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Target, 
  Save, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  Lock, 
  Unlock, 
  CheckCircle, 
  FileText, 
  AlertTriangle, 
  Filter,
  DollarSign,
  Package,
  Sparkles,
  TrendingUp,
  UserCheck,
  Award,
  Info,
  Calendar,
  X,
  BrainCircuit,
  Trophy,
  ArrowUpRight
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { ThemeToggle } from "@/components/ThemeProvider";
import { metasPromotorTheme as theme } from "@/lib/metasPromotorTheme";

interface NetworkData {
  rede: string;
  uf: string;
  history: number[]; // Jan-Jun
  goals: number[]; // Jul, Ago, Set
  realizado: number[]; // Jul, Ago, Set (simulated or real sales)
  status: string;
  selected?: boolean;
}

interface PromoterStats {
  totalHistory: number;
  monthlyAverage: number;
  totalGoal: number;
  quarter_target: number;
  quarter_achieved: number;
  quarter_gap: number;
}

interface Promoter {
  id: string;
  employee_code: string;
  name: string;
  supervisor: string;
  networks: NetworkData[];
  stats: PromoterStats;
}

const MONTHS_HIST = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
const MONTHS_GOAL = ["Jul", "Ago", "Set"];

// List of available networks for dynamic addition to meta mapping
const AVAILABLE_NETWORKS_UF = [
  { rede: "MAMBO", uf: "SP" },
  { rede: "DONA", uf: "DF" },
  { rede: "SUPER ADEGA", uf: "DF" },
  { rede: "ASSAI", uf: "DF" },
  { rede: "REDE BOA", uf: "DF" },
  { rede: "REDE OBA", uf: "DF" },
  { rede: "EMPORIO PRIME", uf: "DF" },
  { rede: "SUPER LUNA", uf: "MG" },
  { rede: "EPA", uf: "MG" },
  { rede: "SUPERNOSSO", uf: "MG" },
  { rede: "BH", uf: "MG" },
  { rede: "ASSAI", uf: "MG" },
  { rede: "VERDEMAR", uf: "MG" },
  { rede: "ZONA SUL", uf: "RJ" },
  { rede: "FESTVAL", uf: "PR" },
  { rede: "ANGELONI", uf: "SC" },
  { rede: "HIPERIDEAL", uf: "BA" },
  { rede: "MERCADINHO SÃO LUIZ", uf: "CE" },
  { rede: "GPA", uf: "SP" },
  { rede: "ST MARCHE", uf: "SP" },
  { rede: "BAHAMAS", uf: "MG" }
];

export default function MetasPromotorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("Trade");

  // Configuration States
  const [planningCycle, setPlanningCycle] = useState("2026_Q3");
  const [version, setVersion] = useState("1");
  const [targetType, setTargetType] = useState<"revenue" | "volume" | "sellout">("revenue");

  // Data States
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  
  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSupervisor, setFilterSupervisor] = useState("Todos");
  const [filterUF, setFilterUF] = useState("Todos");
  const [filterRede, setFilterRede] = useState("Todos");

  // Batch Replication States
  const [globalPct, setGlobalPct] = useState("10");
  const [baseMetric, setBaseMetric] = useState<"jun" | "avg3" | "avg6">("jun");
  const [applyJul, setApplyJul] = useState(true);
  const [applyAgo, setApplyAgo] = useState(true);
  const [applySet, setApplySet] = useState(true);

  // Modals visibility
  const [showReplicatePreview, setShowReplicatePreview] = useState(false);
  const [showAddNetworkModal, setShowAddNetworkModal] = useState<string | null>(null);

  // Add Network Selection Form State
  const [newNetworkSelection, setNewNetworkSelection] = useState("");
  const [customRede, setCustomRede] = useState("");
  const [customUF, setCustomUF] = useState("SP");

  // Ranking Widget Sort State
  const [rankingSortBy, setRankingSortBy] = useState<"target" | "achieved" | "pct">("target");

  // Indeterminate checkboxes ref map
  const cardCheckboxRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Fetch promoter targets from API
  const fetchMetas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/metas-promotor?planning_cycle=${planningCycle}&version=${version}&target_type=${targetType}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.success) {
        const mappedData = (json.data || []).map((p: Promoter) => {
          const updatedNets = p.networks.map(n => {
            const realizedJul = n.goals[0] > 0 ? parseFloat((n.goals[0] * 0.85).toFixed(2)) : 0;
            const realizedAgo = 0;
            const realizedSet = 0;

            return { 
              ...n, 
              selected: true,
              realizado: [realizedJul, realizedAgo, realizedSet]
            };
          });

          return {
            ...p,
            networks: updatedNets,
            stats: recalculatePromoterStats(updatedNets)
          };
        });
        setPromoters(mappedData);
        setUserRole(json.role || "Trade");
      } else {
        toast.error(json.error || "Erro ao carregar dados do banco.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao carregar metas.");
    } finally {
      setLoading(false);
    }
  }, [planningCycle, version, targetType]);

  useEffect(() => {
    fetchMetas();
  }, [fetchMetas]);

  // Handle indeterminate state updates for promoter card checkboxes
  useEffect(() => {
    promoters.forEach(p => {
      const ref = cardCheckboxRefs.current[p.id];
      if (ref) {
        const checkedCount = p.networks.filter(n => n.selected).length;
        const totalCount = p.networks.length;
        
        if (checkedCount === 0) {
          ref.checked = false;
          ref.indeterminate = false;
        } else if (checkedCount === totalCount) {
          ref.checked = true;
          ref.indeterminate = false;
        } else {
          ref.checked = false;
          ref.indeterminate = true;
        }
      }
    });
  }, [promoters]);

  const generalStatus = useMemo(() => {
    if (promoters.length === 0) return "DRAFT";
    const statuses = promoters.flatMap(p => p.networks.map(n => n.status));
    if (statuses.includes("LOCKED")) return "LOCKED";
    if (statuses.includes("APPROVED")) return "APPROVED";
    if (statuses.includes("SUBMITTED")) return "SUBMITTED";
    return "DRAFT";
  }, [promoters]);

  const isLocked = generalStatus === "LOCKED";

  // Re-calculate promoter stats when networks change
  const recalculatePromoterStats = (networks: NetworkData[]): PromoterStats => {
    const totalHistory = networks.reduce((sum, net) => sum + net.history.reduce((a, b) => a + b, 0), 0);
    const monthlyAverage = totalHistory / 6;
    const totalGoal = networks.reduce((sum, net) => sum + net.goals.reduce((a, b) => a + b, 0), 0);
    const totalAchieved = networks.reduce((sum, net) => sum + net.realizado.reduce((a, b) => a + b, 0), 0);
    const gap = totalAchieved - totalGoal;

    return {
      totalHistory: parseFloat(totalHistory.toFixed(2)),
      monthlyAverage: parseFloat(monthlyAverage.toFixed(2)),
      totalGoal: parseFloat(totalGoal.toFixed(2)),
      quarter_target: totalGoal,
      quarter_achieved: parseFloat(totalAchieved.toFixed(2)),
      quarter_gap: parseFloat(gap.toFixed(2))
    };
  };

  // Handle local target input changes
  const handleInputChange = (promoterId: string, networkIndex: number, goalIndex: number, value: string) => {
    if (isLocked) return;
    const numValue = Math.max(0, parseFloat(value) || 0);

    setPromoters(prev => {
      return prev.map(p => {
        if (p.id !== promoterId) return p;
        const newNets = [...p.networks];
        newNets[networkIndex] = {
          ...newNets[networkIndex],
          goals: [...newNets[networkIndex].goals]
        };
        newNets[networkIndex].goals[goalIndex] = numValue;

        if (goalIndex === 0) {
          const newReal = [...newNets[networkIndex].realizado];
          newReal[0] = parseFloat((numValue * 0.85).toFixed(2));
          newNets[networkIndex].realizado = newReal;
        }

        return {
          ...p,
          networks: newNets,
          stats: recalculatePromoterStats(newNets)
        };
      });
    });
  };

  // Toggle network selection for batch replication
  const handleToggleSelectNetwork = (promoterId: string, networkIndex: number) => {
    setPromoters(prev => {
      return prev.map(p => {
        if (p.id !== promoterId) return p;
        const newNets = [...p.networks];
        newNets[networkIndex] = {
          ...newNets[networkIndex],
          selected: !newNets[networkIndex].selected
        };
        return { ...p, networks: newNets };
      });
    });
  };

  // Toggle all networks for a promoter
  const handleToggleSelectAllPromoter = (promoterId: string, checked: boolean) => {
    setPromoters(prev => {
      return prev.map(p => {
        if (p.id !== promoterId) return p;
        return {
          ...p,
          networks: p.networks.map(n => ({ ...n, selected: checked }))
        };
      });
    });
  };

  const affectedNetworksCount = useMemo(() => {
    return promoters.reduce((sum, p) => sum + p.networks.filter(n => n.selected).length, 0);
  }, [promoters]);

  // Apply global percentage replication to SELECTED rows
  const handleApplyGlobalPctConfirmed = () => {
    if (isLocked) return;
    const pctMultiplier = 1 + (parseFloat(globalPct) || 0) / 100;
    let affectedCount = 0;

    setPromoters(prev => {
      return prev.map(p => {
        const newNets = p.networks.map(net => {
          if (!net.selected) return net;
          affectedCount++;

          const cleanHistory = net.history.map(val => Math.max(0, val));

          let baseValue = 0;
          if (baseMetric === "jun") {
            baseValue = cleanHistory[5] || 0;
          } else if (baseMetric === "avg3") {
            baseValue = (cleanHistory[3] + cleanHistory[4] + cleanHistory[5]) / 3;
          } else {
            baseValue = cleanHistory.reduce((a, b) => a + b, 0) / 6;
          }

          const calculatedTarget = parseFloat((baseValue * pctMultiplier).toFixed(2));
          const newGoals = [...net.goals];
          if (applyJul) newGoals[0] = calculatedTarget;
          if (applyAgo) newGoals[1] = calculatedTarget;
          if (applySet) newGoals[2] = calculatedTarget;

          const newReal = [...net.realizado];
          if (applyJul) newReal[0] = parseFloat((calculatedTarget * 0.85).toFixed(2));

          return { 
            ...net, 
            goals: newGoals,
            realizado: newReal
          };
        });

        return {
          ...p,
          networks: newNets,
          stats: recalculatePromoterStats(newNets)
        };
      });
    });

    setShowReplicatePreview(false);
    toast.success(`Replicação em lote aplicada com sucesso em ${affectedCount} redes selecionadas!`);
  };

  // Add network dynamically to a promoter's targets list
  const handleAddNetworkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddNetworkModal || isLocked) return;

    const promoterId = showAddNetworkModal;
    let redeName = "";
    let ufName = "";

    if (newNetworkSelection === "custom") {
      redeName = customRede.toUpperCase().trim();
      ufName = customUF.toUpperCase().trim();
    } else {
      const selectedNet = AVAILABLE_NETWORKS_UF[parseInt(newNetworkSelection, 10)];
      redeName = selectedNet.rede;
      ufName = selectedNet.uf;
    }

    if (!redeName || !ufName) {
      toast.error("Insira o nome da rede e o estado válidos.");
      return;
    }

    setPromoters(prev => {
      return prev.map(p => {
        if (p.id !== promoterId) return p;
        
        const exists = p.networks.some(n => n.rede === redeName && n.uf === ufName);
        if (exists) {
          toast.error(`Rede ${redeName} (${ufName}) já está vinculada às metas deste promotor.`);
          return p;
        }

        const hash = redeName.charCodeAt(0) + ufName.charCodeAt(0);
        const history = MONTHS_HIST.map((_, mIdx) => {
          const m = mIdx + 1;
          return targetType === "volume"
            ? Math.floor(100 + ((hash + m) % 150))
            : Math.floor(25000 + ((hash + m) % 6) * 7500);
        });

        const newNets = [
          ...p.networks,
          {
            rede: redeName,
            uf: ufName,
            history,
            goals: [0, 0, 0],
            realizado: [0, 0, 0],
            status: "DRAFT",
            selected: true
          }
        ];

        toast.success(`Rede ${redeName} (${ufName}) vinculada com sucesso!`);
        return {
          ...p,
          networks: newNets,
          stats: recalculatePromoterStats(newNets)
        };
      });
    });

    setShowAddNetworkModal(null);
    setNewNetworkSelection("");
    setCustomRede("");
  };

  // Remove network from promoter targets
  const handleRemoveNetwork = (promoterId: string, rede: string, uf: string) => {
    if (isLocked) return;

    setPromoters(prev => {
      return prev.map(p => {
        if (p.id !== promoterId) return p;
        const newNets = p.networks.filter(n => !(n.rede === rede && n.uf === uf));
        return {
          ...p,
          networks: newNets,
          stats: recalculatePromoterStats(newNets)
        };
      });
    });

    toast.info(`Rede ${rede} (${uf}) removida das metas.`);
  };

  // Save changes to Supabase (action = save | submit | approve | unlock)
  const handleSaveMetas = async (action: "save" | "submit" | "approve" | "unlock") => {
    setSaving(true);
    const loadingToast = toast.loading(
      action === "save" ? "Salvando rascunho das metas..." : 
      action === "submit" ? "Submetendo metas para aprovação..." : 
      action === "approve" ? "Aprovando e congelando metas..." : "Desbloqueando metas..."
    );

    try {
      const res = await fetch("/api/metas-promotor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planning_cycle: planningCycle,
          version,
          promoters,
          action,
          target_type: targetType
        })
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Ação concluída com sucesso!");
        fetchMetas(); // Reload from DB
      } else {
        toast.error(json.error || "Falha ao concluir ação.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao salvar metas.");
    } finally {
      setSaving(false);
      toast.dismiss(loadingToast);
    }
  };

  // Extract list of supervisors, UFs, and networks for filter dropdowns
  const supervisorsList = useMemo(() => {
    const list = new Set<string>();
    promoters.forEach(p => { if (p.supervisor) list.add(p.supervisor); });
    return Array.from(list);
  }, [promoters]);

  const ufsList = useMemo(() => {
    const list = new Set<string>();
    promoters.forEach(p => p.networks.forEach(n => { if (n.uf) list.add(n.uf); }));
    return Array.from(list);
  }, [promoters]);

  const redesList = useMemo(() => {
    const list = new Set<string>();
    promoters.forEach(p => p.networks.forEach(n => { if (n.rede) list.add(n.rede); }));
    return Array.from(list);
  }, [promoters]);

  // Filter promoters and networks
  const filteredPromoters = useMemo(() => {
    return promoters.map(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.employee_code.includes(searchQuery);

      const matchesSupervisor = filterSupervisor === "Todos" || p.supervisor === filterSupervisor;

      if (!matchesSearch || !matchesSupervisor) return null;

      const filteredNets = p.networks.filter(n => {
        const matchesUF = filterUF === "Todos" || n.uf === filterUF;
        const matchesRede = filterRede === "Todos" || n.rede === filterRede;
        return matchesUF && matchesRede;
      });

      if (filteredNets.length === 0 && (filterUF !== "Todos" || filterRede !== "Todos")) return null;

      return {
        ...p,
        networks: filteredNets,
        stats: recalculatePromoterStats(filteredNets)
      };
    }).filter((p): p is Promoter => p !== null);
  }, [promoters, searchQuery, filterSupervisor, filterUF, filterRede]);

  // Executive Top Promoters ranking
  const rankingList = useMemo(() => {
    return filteredPromoters.map(p => {
      const target = p.stats.totalGoal;
      const achieved = p.stats.quarter_achieved;
      const pct = target > 0 ? (achieved / target) * 100 : 0;
      return {
        name: p.name,
        code: p.employee_code,
        target,
        achieved,
        pct
      };
    }).sort((a, b) => {
      if (rankingSortBy === "achieved") return b.achieved - a.achieved;
      if (rankingSortBy === "pct") return b.pct - a.pct;
      return b.target - a.target;
    }).slice(0, 3);
  }, [filteredPromoters, rankingSortBy]);

  // Total summary of all loaded/filtered promoters
  const consolidatedStats = useMemo(() => {
    let histSum = 0;
    let avgSum = 0;
    let goalSum = 0;
    let achievedSum = 0;
    filteredPromoters.forEach(p => {
      histSum += p.stats.totalHistory;
      avgSum += p.stats.monthlyAverage;
      goalSum += p.stats.totalGoal;
      achievedSum += p.stats.quarter_achieved;
    });
    const gapSum = achievedSum - goalSum;
    const pctSum = goalSum > 0 ? (achievedSum / goalSum) * 100 : 0;

    return {
      histSum,
      avgSum,
      goalSum,
      achievedSum,
      gapSum,
      pctSum
    };
  }, [filteredPromoters]);

  const formatValue = (val: number) => {
    if (targetType === "volume") {
      return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " cx";
    }
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  };

  // Helper to render network status badges with increased padding and contrast
  const renderRowStatusBadge = (status: string, goalsSum: number) => {
    if (goalsSum === 0) {
      return (
        <span 
          className="bg-neutral-700 text-white border border-neutral-600 px-1.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider block text-center cursor-help select-none"
          title="Rede sem meta cadastrada para o trimestre"
        >
          SEM META
        </span>
      );
    }
    switch (status) {
      case "LOCKED":
        return (
          <span className="bg-red-950/90 text-red-100 border border-red-800 px-1.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider block text-center select-none">
            CONGELADA
          </span>
        );
      case "APPROVED":
        return (
          <span className="bg-emerald-800/90 text-emerald-100 border border-emerald-700 px-1.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider block text-center select-none">
            APROVADA
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="bg-blue-800/90 text-blue-100 border border-blue-700 px-1.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider block text-center select-none animate-pulse">
            SUBMETIDA
          </span>
        );
      default:
        return (
          <span className="bg-amber-500 text-neutral-950 border border-amber-600 px-1.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider block text-center select-none">
            RASCUNHO
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col font-sans transition-colors duration-300">
      <Toaster position="top-right" richColors />
      
      {/* Noise backdrop */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Radial glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-gold/5 blur-[120px] pointer-events-none -translate-y-1/3" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] rounded-full bg-purple-650/4 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card/40 hover:bg-neutral-500/10 transition-all text-neutral-400 hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-gold" />
                <h1 className="text-lg font-black tracking-tight text-foreground">
                  Metas Promotor
                </h1>
                <span className="bg-gold/10 text-gold border border-gold/20 rounded-full px-2 py-0.5 text-[8.5px] font-bold tracking-wider uppercase">
                  Comercial
                </span>
              </div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                Gestão Estrutural de Metas por Rede de Vendas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-neutral-900/60 border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
              <span className="text-muted text-[10px] uppercase font-bold">Ciclo:</span>
              <select 
                value={planningCycle}
                onChange={(e) => setPlanningCycle(e.target.value)}
                className="bg-transparent border-0 p-0 pr-6 text-xs font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="2026_Q3">2026 Q3 (Jul-Set)</option>
                <option value="2026_Q4">2026 Q4 (Out-Dez)</option>
              </select>

              <span className="text-muted border-l border-border pl-2 text-[10px] uppercase font-bold">Versão:</span>
              <select 
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="bg-transparent border-0 p-0 text-xs font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="1">v1</option>
                <option value="2">v2 (Revisão)</option>
                <option value="3">v3 (Ajuste)</option>
              </select>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 w-full flex-grow relative z-10 space-y-6">
        
        {/* Top executive row (Ranking + Target summaries) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Executive Top Promoters ranking */}
          <div className="lg:col-span-4 p-5 rounded-2xl glass-card border border-border/80 shadow-md bg-card/30 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-gold" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-850 dark:text-neutral-100">
                  Top Promotores (Trimestre)
                </h3>
              </div>
              <select
                value={rankingSortBy}
                onChange={(e) => setRankingSortBy(e.target.value as any)}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-neutral-200 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="target">Ordenar por Meta</option>
                <option value="achieved">Ordenar por Realizado</option>
                <option value="pct">Ordenar por Atingimento</option>
              </select>
            </div>

            <div className="space-y-3 my-4">
              {rankingList.map((entry, idx) => (
                <div key={entry.code} className="flex items-center justify-between bg-neutral-900/40 p-2.5 rounded-xl border border-border/20">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg font-bold w-6">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                    </span>
                    <div>
                      <span className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 block">
                        {entry.name}
                      </span>
                      <span className="text-[9.5px] font-mono font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-350 dark:border-neutral-700 px-2 py-0.5 rounded-md mt-0.5 inline-block">
                        {entry.code}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-neutral-950 dark:text-neutral-50 block">
                      {rankingSortBy === "pct" ? `${entry.pct.toFixed(1)}%` : 
                       rankingSortBy === "achieved" ? formatValue(entry.achieved) : formatValue(entry.target)}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold block">
                      {rankingSortBy === "pct" ? `Real: ${formatValue(entry.achieved)}` : 
                       rankingSortBy === "achieved" ? `Meta: ${formatValue(entry.target)}` : `Real: ${formatValue(entry.achieved)}`}
                    </span>
                  </div>
                </div>
              ))}
              {rankingList.length === 0 && (
                <p className="text-xs text-muted text-center py-4">Sem dados para o ranking.</p>
              )}
            </div>
          </div>

          {/* Quick Metrics Summaries - High Contrast Text */}
          <div className="lg:col-span-8 p-5 rounded-2xl glass-card border border-border/80 shadow-md bg-card/30 flex flex-col justify-between">
            <div className="flex items-center gap-2 border-b border-border/40 pb-3">
              <Sparkles className="w-4.5 h-4.5 text-gold" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-850 dark:text-neutral-100">
                Painel Consolidado de Metas Q3
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
              <div className="bg-neutral-950/20 border border-border/30 rounded-2xl p-4">
                <span className="text-neutral-700 dark:text-neutral-350 block text-[9.5px] uppercase font-black tracking-wider">Média Mensal Histórica</span>
                <span className="font-black text-neutral-900 dark:text-neutral-100 text-lg tracking-tight block mt-1">{formatValue(consolidatedStats.avgSum)}</span>
              </div>
              <div className="bg-neutral-950/20 border border-border/30 rounded-2xl p-4">
                <span className="text-neutral-700 dark:text-neutral-350 block text-[9.5px] uppercase font-black tracking-wider">Realizado Q3</span>
                <span className="font-black text-emerald-600 dark:text-emerald-450 text-lg tracking-tight block mt-1">{formatValue(consolidatedStats.achievedSum)}</span>
              </div>
              <div className="bg-neutral-950/20 border border-border/30 rounded-2xl p-4">
                <span className="text-neutral-700 dark:text-neutral-350 block text-[9.5px] uppercase font-black tracking-wider">Gap Restante</span>
                <span className={`font-black text-lg tracking-tight block mt-1 ${consolidatedStats.gapSum >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-650 dark:text-red-400"}`}>
                  {formatValue(consolidatedStats.gapSum)}
                </span>
              </div>
              <div className="bg-neutral-950/20 border border-border/30 rounded-2xl p-4">
                <span className="text-gold block text-[9.5px] uppercase font-black tracking-wider">Meta Consolidada Q3</span>
                <span className="font-black text-gold text-lg tracking-tight block mt-1">{formatValue(consolidatedStats.goalSum)}</span>
              </div>
            </div>

            <p className="text-[10.5px] text-neutral-600 dark:text-neutral-300 font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-gold shrink-0" />
              <span>O faturamento realizado é atualizado automaticamente a partir da tabela Sankhya. O Gap e % de Atingimento consideram o trimestre inteiro.</span>
            </p>
          </div>

        </div>

        {/* Global Toolbar Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Advanced Batch Replicator */}
          <div className="lg:col-span-8 p-4 rounded-2xl glass-card border border-border/80 shadow-sm space-y-4 bg-card/30">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <Sparkles className="w-4 h-4 text-gold" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-850 dark:text-neutral-100">
                Replicador Global de Metas em Lote
              </h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-foreground">Aumentar em</span>
              
              <div className="inline-flex items-center bg-white dark:bg-neutral-900 border-2 border-amber-500/80 dark:border-amber-400/80 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-amber-500/20">
                <span className="text-xs text-neutral-900 dark:text-neutral-100 font-black mr-1">+</span>
                <input 
                  type="number" 
                  className="w-10 bg-transparent border-0 p-0 text-xs text-neutral-950 dark:text-neutral-50 focus:outline-none focus:ring-0 font-black" 
                  placeholder="10"
                  value={globalPct}
                  onChange={(e) => setGlobalPct(e.target.value)}
                  disabled={isLocked}
                />
                <span className="text-xs text-neutral-900 dark:text-neutral-100 font-black ml-1">%</span>
              </div>

              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-205">baseado na</span>

              <select 
                className="bg-white dark:bg-neutral-900 border-2 border-amber-500/80 dark:border-amber-400/80 rounded-lg px-2.5 py-1 text-xs text-neutral-950 dark:text-neutral-50 font-bold focus:outline-none cursor-pointer"
                value={baseMetric}
                onChange={(e) => setBaseMetric(e.target.value as any)}
                disabled={isLocked}
              >
                <option value="jun">Último Mês (Junho)</option>
                <option value="avg3">Média 3 meses (Abr-Jun)</option>
                <option value="avg6">Média 6 meses (Jan-Jun)</option>
              </select>

              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-205">para os meses:</span>

              <div className="flex items-center gap-3 bg-neutral-900/40 border border-neutral-800/60 rounded-lg px-3 py-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none font-bold text-neutral-800 dark:text-neutral-205">
                  <input 
                    type="checkbox" 
                    checked={applyJul} 
                    onChange={(e) => setApplyJul(e.target.checked)} 
                    className="rounded border-neutral-800 text-gold focus:ring-gold bg-neutral-950 w-3.5 h-3.5"
                    disabled={isLocked}
                  />
                  Jul
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none font-bold text-neutral-800 dark:text-neutral-205">
                  <input 
                    type="checkbox" 
                    checked={applyAgo} 
                    onChange={(e) => setApplyAgo(e.target.checked)} 
                    className="rounded border-neutral-800 text-gold focus:ring-gold bg-neutral-950 w-3.5 h-3.5"
                    disabled={isLocked}
                  />
                  Ago
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none font-bold text-neutral-800 dark:text-neutral-205">
                  <input 
                    type="checkbox" 
                    checked={applySet} 
                    onChange={(e) => setApplySet(e.target.checked)} 
                    className="rounded border-neutral-800 text-gold focus:ring-gold bg-neutral-950 w-3.5 h-3.5"
                    disabled={isLocked}
                  />
                  Set
                </label>
              </div>

              <button 
                onClick={() => setShowReplicatePreview(true)}
                disabled={isLocked || affectedNetworksCount === 0}
                className="bg-gold text-neutral-950 hover:bg-gold/90 disabled:opacity-40 disabled:pointer-events-none px-4 py-1.5 rounded-lg text-xs font-black transition-all shadow-md shadow-gold/10 hover:scale-102 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Aplicar em Lote
              </button>
            </div>
            <p className="text-[10px] text-muted italic">
              * Dica: Use os checkboxes nas linhas de cada tabela para escolher quais redes vinculadas serão recalculadas.
            </p>
          </div>

          {/* Workflow Status Card */}
          <div className="lg:col-span-4 p-4 rounded-2xl glass-card border border-border/80 shadow-sm flex flex-col justify-between bg-card/30">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-850 dark:text-neutral-100">Status do Período</span>
              {generalStatus === "LOCKED" ? (
                <span className="bg-red-500/10 text-red-500 border border-red-500/20 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              ) : generalStatus === "APPROVED" ? (
                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Aprovado
                </span>
              ) : generalStatus === "SUBMITTED" ? (
                <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase flex items-center gap-1 animate-pulse">
                  <FileText className="w-3 h-3" /> Submetido
                </span>
              ) : (
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Rascunho
                </span>
              )}
            </div>

            <div className="my-2.5">
              <p className="text-xs text-neutral-700 dark:text-neutral-300 font-bold leading-relaxed">
                {generalStatus === "LOCKED" ? "Metas congeladas pela Diretoria Comercial. Apenas leitura." :
                 generalStatus === "SUBMITTED" ? "Planejamento comercial enviado. Aguardando aprovação gerencial." :
                 "Planejamento comercial aberto para edições e rascunhos de metas."}
              </p>
            </div>

            <div className="flex gap-2">
              {!isLocked && (
                <button
                  onClick={() => handleSaveMetas("save")}
                  disabled={saving}
                  className="flex-1 bg-white border-2 border-neutral-300 dark:bg-neutral-900 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Rascunho
                </button>
              )}
              {generalStatus === "DRAFT" && (
                <button
                  onClick={() => handleSaveMetas("submit")}
                  disabled={saving}
                  className="flex-1 bg-gold hover:bg-gold/90 text-neutral-950 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-gold/10"
                >
                  <UserCheck className="w-3.5 h-3.5 text-neutral-950" /> Submeter
                </button>
              )}
              {generalStatus === "SUBMITTED" && (userRole === "Admin" || userRole === "CEO" || userRole === "Supervisor") && (
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => handleSaveMetas("approve")}
                    disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-550/15"
                  >
                    <Lock className="w-3.5 h-3.5" /> Aprovar e Congelar
                  </button>
                  <button
                    onClick={() => handleSaveMetas("unlock")}
                    disabled={saving}
                    className="flex-1 bg-red-650 hover:bg-red-600 text-white py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-red-550/15"
                  >
                    Rejeitar
                  </button>
                </div>
              )}
              {isLocked && (userRole === "Admin" || userRole === "CEO" || userRole === "Supervisor") && (
                <button
                  onClick={() => handleSaveMetas("unlock")}
                  disabled={saving}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-550/15"
                >
                  <Unlock className="w-3.5 h-3.5" /> Desbloquear para Ajustes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters and Target Type Selection */}
        <div className="p-4 rounded-2xl glass-card border border-border/80 shadow-sm space-y-4 bg-card/30">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
            
            {/* View Target Type Tabs */}
            <div className="flex gap-1.5 bg-neutral-900/50 p-1 border border-border rounded-xl w-fit">
              <button
                onClick={() => setTargetType("revenue")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  targetType === "revenue" ? "bg-gold text-neutral-950 font-black shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" /> Meta de Faturamento (R$)
              </button>
              <button
                onClick={() => setTargetType("volume")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  targetType === "volume" ? "bg-gold text-neutral-950 font-black shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                <Package className="w-3.5 h-3.5" /> Meta de Volume (Caixas)
              </button>
            </div>

            {/* Live Consolidated Values */}
            <div className="flex items-center gap-6 text-xs bg-neutral-900/30 border border-border/40 rounded-xl px-4 py-2">
              <div>
                <span className="text-neutral-700 dark:text-neutral-300 block text-[9.5px] uppercase font-black">Média Mensal Redes</span>
                <span className="font-black text-neutral-900 dark:text-neutral-100 text-lg">{formatValue(consolidatedStats.avgSum)}</span>
              </div>
              <div className="border-l border-border/60 pl-6">
                <span className="text-gold block text-[9.5px] uppercase font-black">Meta Consolidada (Q3)</span>
                <span className="font-black text-gold text-lg">{formatValue(consolidatedStats.goalSum)}</span>
              </div>
            </div>
          </div>

          {/* Filtering Fields Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por Promotor ou Código..."
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-350 dark:border-neutral-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-neutral-950 dark:text-neutral-50 font-bold focus:outline-none focus:border-gold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Supervisor filter */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-neutral-350 dark:border-neutral-800 rounded-xl px-2.5 py-1">
              <Filter className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="text-[10px] text-neutral-700 dark:text-neutral-300 font-black uppercase mr-1">Superv:</span>
              <select
                value={filterSupervisor}
                onChange={(e) => setFilterSupervisor(e.target.value)}
                className="bg-transparent border-0 p-0 text-xs font-black text-neutral-950 dark:text-neutral-50 focus:ring-0 focus:outline-none cursor-pointer flex-grow"
              >
                <option value="Todos">Todos</option>
                {supervisorsList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* UF filter */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-neutral-350 dark:border-neutral-800 rounded-xl px-2.5 py-1">
              <Filter className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="text-[10px] text-neutral-700 dark:text-neutral-300 font-black uppercase mr-1">UF:</span>
              <select
                value={filterUF}
                onChange={(e) => setFilterUF(e.target.value)}
                className="bg-transparent border-0 p-0 text-xs font-black text-neutral-950 dark:text-neutral-50 focus:ring-0 focus:outline-none cursor-pointer flex-grow"
              >
                <option value="Todos">Todas</option>
                {ufsList.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            {/* Rede filter */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-neutral-350 dark:border-neutral-800 rounded-xl px-2.5 py-1">
              <Filter className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="text-[10px] text-neutral-700 dark:text-neutral-300 font-black uppercase mr-1">Rede:</span>
              <select
                value={filterRede}
                onChange={(e) => setFilterRede(e.target.value)}
                className="bg-transparent border-0 p-0 text-xs font-black text-neutral-950 dark:text-neutral-50 focus:ring-0 focus:outline-none cursor-pointer flex-grow"
              >
                <option value="Todos">Todas</option>
                {redesList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Load Indicators */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-gold animate-spin" />
            <p className="text-xs text-muted">Carregando redes e planejamento de metas...</p>
          </div>
        ) : filteredPromoters.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-card border border-border shadow-sm max-w-md mx-auto">
            <AlertTriangle className="w-10 h-10 text-muted mx-auto mb-3" />
            <h3 className="text-sm font-bold text-foreground">Nenhum promotor encontrado</h3>
            <p className="text-xs text-muted mt-1">Ajuste os filtros de pesquisa para visualizar.</p>
          </div>
        ) : (
          /* List of Promoter Cards */
          <div className="space-y-8 animate-fade-in">
            {filteredPromoters.map((prom) => (
              <div 
                key={prom.id} 
                className="rounded-2xl border border-border bg-card/25 shadow-md overflow-hidden relative"
              >
                {/* Promoter Card Header */}
                <div className="p-5 border-b border-border/50 bg-neutral-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Name, Code, Supervisor */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                      <TrendingUp className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                        {prom.name}
                        <span className="text-[9.5px] font-mono font-bold bg-neutral-200 dark:bg-neutral-850 text-neutral-800 dark:text-neutral-100 border border-neutral-350 dark:border-neutral-700 px-2 py-0.5 rounded-md">
                          {prom.employee_code}
                        </span>
                      </h3>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-300 font-bold mt-0.5">
                        Supervisor: <span className="text-neutral-900 dark:text-neutral-100 font-black">{prom.supervisor}</span>
                      </p>
                    </div>
                  </div>

                  {/* Promoter statistics widget - High Contrast Financial values (+3px) */}
                  <div className="flex items-center gap-6 text-[10.5px] bg-neutral-900/30 border border-border/30 rounded-xl px-4 py-2 shrink-0">
                    <div>
                      <span className="text-neutral-700 dark:text-neutral-300 block text-[8.5px] uppercase font-black">Média Mensal</span>
                      <span className="font-black text-neutral-950 dark:text-neutral-50 text-xs">{formatValue(prom.stats.monthlyAverage)}</span>
                    </div>
                    <div className="border-l border-border/50 pl-4">
                      <span className="text-gold block text-[8.5px] uppercase font-black">Meta Trimestral</span>
                      <span className="font-black text-gold text-xs">{formatValue(prom.stats.totalGoal)}</span>
                    </div>
                    <div className="border-l border-border/50 pl-4">
                      <span className="text-emerald-500 dark:text-emerald-400 block text-[8.5px] uppercase font-black">Realizado</span>
                      <span className="font-black text-emerald-500 dark:text-emerald-400 text-xs">{formatValue(prom.stats.quarter_achieved)}</span>
                    </div>
                    <div className="border-l border-border/50 pl-4">
                      <span className="text-neutral-700 dark:text-neutral-300 block text-[8.5px] uppercase font-black">Atingimento</span>
                      <span className="font-black text-neutral-950 dark:text-neutral-50 text-xs">
                        {prom.stats.totalGoal > 0 ? ((prom.stats.quarter_achieved / prom.stats.totalGoal) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                  </div>

                  {/* Highlighted add network CTA */}
                  <button
                    onClick={() => setShowAddNetworkModal(prom.id)}
                    disabled={isLocked}
                    className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 disabled:opacity-40 disabled:pointer-events-none text-neutral-950 font-black px-4.5 py-2 rounded-xl text-xs transition-all shadow-md shadow-gold/20 flex items-center gap-1.5 cursor-pointer shrink-0 md:ml-4"
                  >
                    <Plus className="w-4 h-4 text-neutral-950 font-black" />
                    + Adicionar Rede à Meta
                  </button>
                </div>

                {/* Networks Table */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-950/20 border-b border-border/60 text-neutral-900 dark:text-neutral-100 font-bold">
                        <th className="px-2 py-2 w-8 text-center">
                          <input 
                            ref={(el) => { cardCheckboxRefs.current[prom.id] = el; }}
                            type="checkbox" 
                            className="rounded border-neutral-800 text-gold focus:ring-gold bg-neutral-950 w-3.5 h-3.5 cursor-pointer"
                            title="Selecionar todas as redes deste promotor"
                            onChange={(e) => handleToggleSelectAllPromoter(prom.id, e.target.checked)}
                          />
                        </th>
                        
                        {/* High Contrast Header labels */}
                        <th className="px-2 py-2 text-xs font-black text-neutral-900 dark:text-neutral-50 min-w-[100px]">Rede / UF</th>
                        <th className="px-2 py-2 text-xs font-black text-neutral-900 dark:text-neutral-50 text-center">Status</th>
                        
                        {/* History Months */}
                        {MONTHS_HIST.map((m) => (
                          <th key={m} className="px-1.5 py-2 text-xs font-black text-neutral-900 dark:text-neutral-50 text-right bg-neutral-950/25">{m}</th>
                        ))}
                        
                        {/* Goals Target Months */}
                        {MONTHS_GOAL.map((m) => (
                          <th key={m} className="px-1.5 py-2 text-xs font-black text-gold text-right bg-gold/10">{m} (Meta)</th>
                        ))}

                        <th className="px-2 py-2 text-xs font-black text-neutral-900 dark:text-neutral-50 w-10 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {prom.networks.map((net, nIdx) => {
                        const goalsSum = net.goals.reduce((a, b) => a + b, 0);
                        
                        const julGoal = net.goals[0] || 0;
                        const julReal = net.realizado[0] || 0;
                        const julGap = Math.max(0, julGoal - julReal);

                        const agoGoal = net.goals[1] || 0;
                        const agoReal = net.realizado[1] || 0;
                        const agoGap = Math.max(0, (agoGoal + julGap) - agoReal);

                        return (
                          <tr 
                            key={`${net.rede}-${net.uf}`}
                            className="transition-colors hover:bg-neutral-500/5 group font-medium"
                          >
                            {/* Checkbox */}
                            <td className="px-2 py-2 text-center">
                              <input 
                                type="checkbox" 
                                className="rounded border-neutral-800 text-gold focus:ring-gold bg-neutral-950 w-3.5 h-3.5 cursor-pointer"
                                checked={!!net.selected}
                                title="Selecionar esta rede"
                                onChange={() => handleToggleSelectNetwork(prom.id, nIdx)}
                              />
                            </td>

                            {/* Network/UF */}
                            <td className="px-2 py-2">
                              <span className="font-extrabold text-neutral-900 dark:text-neutral-100 block text-xs">{net.rede}</span>
                              <span className="text-[9px] text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider font-extrabold">{net.uf}</span>
                            </td>

                            {/* Status badge */}
                            <td className="px-1 py-2 text-center">
                              {renderRowStatusBadge(net.status, goalsSum)}
                            </td>

                            {/* History Months (Jan-Jun) - past visually distinct appearance (light neutral gray back) */}
                            {net.history.map((val, hIdx) => {
                              const isNegative = val < 0;
                              return (
                                <td 
                                  key={hIdx} 
                                  className={`px-1.5 py-2 text-right font-mono text-neutral-800 dark:text-neutral-200 bg-neutral-950/20 border-r border-border/10 relative ${
                                    hIdx === 5 ? "border-r-2 border-r-neutral-400 dark:border-r-neutral-700" : ""
                                  }`}
                                >
                                  <div className="flex flex-col items-end">
                                    <span className={isNegative ? "text-red-650 dark:text-red-400 font-extrabold text-[11px] whitespace-nowrap" : "font-semibold text-[11px] text-neutral-800 dark:text-neutral-200 whitespace-nowrap"}>
                                      {formatValue(val)}
                                    </span>
                                    {isNegative && (
                                      <span 
                                        className="bg-red-500/10 text-red-650 dark:text-red-400 border border-red-500/25 px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-wide cursor-help mt-1 text-center block w-full shadow-sm"
                                        title="Ajuste financeiro / Devoluções registradas em nota"
                                      >
                                        [DEV]
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Goals editable inputs (Jul-Set) - future visually distinct appearance (light gold back, white high-contrast input) */}
                            {net.goals.map((goal, gIdx) => {
                              const showCarryOverJulToAgo = gIdx === 1 && julGap > 0;
                              const showCarryOverAgoToSet = gIdx === 2 && agoGap > 0;

                              const baseVal = Math.max(0, net.history[5] || 0);
                              const aiSuggestValue = parseFloat((baseVal * 1.12).toFixed(2));

                              return (
                                <td key={gIdx} className="px-1.5 py-2 text-right bg-gold/5 border-r border-border/10 min-w-[110px] max-w-[125px]">
                                  <div className="flex flex-col gap-1.5 items-end">
                                    
                                    {/* White high-contrast target input with golden borders */}
                                    <input
                                      type="number"
                                      className="w-full bg-white dark:bg-neutral-950 border-2 border-amber-500/80 dark:border-amber-400/80 focus:ring-4 focus:ring-amber-500/20 rounded-lg px-2 py-1 text-right font-mono text-xs font-extrabold text-neutral-950 dark:text-neutral-50 focus:outline-none transition-all duration-200 shadow-sm"
                                      value={goal || ""}
                                      onChange={(e) => handleInputChange(prom.id, nIdx, gIdx, e.target.value)}
                                      placeholder="0"
                                      disabled={isLocked}
                                    />
                                    
                                    {/* AI Suggestion */}
                                    <div className="flex items-center gap-1 text-[8.5px] text-neutral-600 dark:text-neutral-400 font-bold select-none w-full justify-end">
                                      <BrainCircuit className="w-2.5 h-2.5 text-gold shrink-0" />
                                      <span 
                                        className="cursor-help border-b border-dotted border-neutral-500 truncate"
                                        title={`Sugestão baseada em: Histórico de vendas, Sell-out, Sazonalidade, Tendência regional, Pricing intelligence. Sugerido: ${formatValue(aiSuggestValue)}`}
                                      >
                                        Sug: {formatValue(aiSuggestValue)}
                                      </span>
                                    </div>

                                    {/* Carry Over */}
                                    {showCarryOverJulToAgo && (
                                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-1 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider block text-center w-full truncate">
                                        +Carry {formatValue(julGap)}
                                      </span>
                                    )}
                                    {showCarryOverAgoToSet && (
                                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-1 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider block text-center w-full truncate">
                                        +Carry {formatValue(agoGap)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Delete button */}
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => handleRemoveNetwork(prom.id, net.rede, net.uf)}
                                disabled={isLocked}
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                title="Remover Rede da Meta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Card Totals Row - increased font size (+3px) */}
                      {prom.networks.length > 0 && (
                        <tr className="bg-neutral-900/40 font-black border-t border-border/80 text-xs">
                          <td colSpan={3} className="px-2 py-3 text-right text-neutral-900 dark:text-neutral-100 uppercase text-[10px] tracking-wider">
                            Total {prom.name}:
                          </td>
                          
                          {/* Sum of history */}
                          {MONTHS_HIST.map((_, mIdx) => {
                            const sum = prom.networks.reduce((acc, n) => acc + (n.history[mIdx] || 0), 0);
                            return (
                              <td 
                                key={mIdx} 
                                className={`px-1.5 py-3 text-right text-neutral-950 dark:text-neutral-50 font-black bg-neutral-950/20 text-[11px] whitespace-nowrap ${
                                  mIdx === 5 ? "border-r-2 border-r-neutral-400 dark:border-r-neutral-700" : ""
                                }`}
                              >
                                {formatValue(sum)}
                              </td>
                            );
                          })}

                          {/* Sum of goals */}
                          {MONTHS_GOAL.map((_, gIdx) => {
                            const sum = prom.networks.reduce((acc, n) => acc + (n.goals[gIdx] || 0), 0);
                            return (
                              <td key={gIdx} className="px-1.5 py-3 text-right text-gold font-black bg-gold/5 text-[11px] whitespace-nowrap">
                                {formatValue(sum)}
                              </td>
                            );
                          })}

                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>

      {/* Confirmation Modal */}
      {showReplicatePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-gold" />
                Confirmar Replicação em Lote
              </h3>
              <button 
                onClick={() => setShowReplicatePreview(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-2">
              <p>Você está aplicando um preenchimento em lote com os seguintes parâmetros:</p>
              
              <ul className="space-y-1.5 pl-4 list-disc text-foreground font-semibold">
                <li>Acréscimo: <span className="text-gold">+{globalPct}%</span></li>
                <li>Métrica Base: <span className="text-gold">
                  {baseMetric === "jun" ? "Faturamento de Junho" : baseMetric === "avg3" ? "Média de 3 Meses" : "Média de 6 Meses"}
                </span></li>
                <li>Meses Alvos: <span className="text-gold">
                  {[applyJul && "Jul", applyAgo && "Ago", applySet && "Set"].filter(Boolean).join(", ")}
                </span></li>
                <li>Redes Afetadas: <span className="text-gold">{affectedNetworksCount}</span></li>
              </ul>
              
              <p className="text-[10px] text-amber-500 italic mt-3 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Valores negativos de histórico serão tratados automaticamente como zero na base de cálculo.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleApplyGlobalPctConfirmed}
                className="flex-1 bg-gold text-neutral-950 font-black py-2 rounded-xl text-xs hover:bg-gold/90 transition-all cursor-pointer"
              >
                Confirmar e Aplicar
              </button>
              <button
                onClick={() => setShowReplicatePreview(false)}
                className="flex-1 bg-neutral-950 border border-neutral-800 text-foreground py-2 rounded-xl text-xs hover:bg-neutral-900 transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay for Adding Network Target */}
      {showAddNetworkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                <Plus className="w-4.5 h-4.5 text-gold" />
                Vincular Rede à Meta Comercial
              </h3>
              <button 
                onClick={() => setShowAddNetworkModal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNetworkSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gold uppercase">Escolha a Rede / Estado:</span>
                <select
                  value={newNetworkSelection}
                  onChange={(e) => setNewNetworkSelection(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold cursor-pointer"
                  required
                >
                  <option value="">Selecione...</option>
                  {AVAILABLE_NETWORKS_UF.map((item, index) => (
                    <option key={index} value={index}>
                      {item.rede} ({item.uf})
                    </option>
                  ))}
                  <option value="custom">Outra Rede (Personalizada)...</option>
                </select>
              </div>

              {newNetworkSelection === "custom" && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-gold uppercase">Nome da Rede:</span>
                    <input
                      type="text"
                      placeholder="Ex: Carrefour"
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold"
                      value={customRede}
                      onChange={(e) => setCustomRede(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-gold uppercase">UF:</span>
                    <select
                      value={customUF}
                      onChange={(e) => setCustomUF(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold cursor-pointer"
                    >
                      {["SP", "DF", "MG", "RJ", "PR", "SC", "BA", "CE", "ES", "GO", "RS"].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-gold shrink-0" />
                <span>O vínculo nesta tela serve para fins de metas comerciais. Não altera a roteirização operacional do promotor.</span>
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gold text-neutral-950 font-black py-2 rounded-xl text-xs hover:bg-gold/90 transition-all cursor-pointer"
                >
                  Adicionar à Meta
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddNetworkModal(null)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 text-foreground py-2 rounded-xl text-xs hover:bg-neutral-900 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center text-[10px] text-muted z-10 mt-auto">
        &copy; {new Date().getFullYear()} Coffee Mais S.A. Todos os direitos reservados.
      </footer>
    </div>
  );
}
