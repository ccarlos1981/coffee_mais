"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Target,
  ArrowLeft,
  Coffee,
  Save,
  Calendar,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import {
  getFullYearBusinessDays,
  calculateMonthBusinessDays,
  MonthBusinessDays,
} from "@/lib/utils/business-days-calculator";

interface BusinessDay {
  id: number;
  year: number;
  month: number;
  total_days: number;
  elapsed_days: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

import { OFFICIAL_COMMERCIAL_ROLES } from "@/lib/domain/commercial-structure";

const CHANNELS = [
  { id: "Toda Empresa", manager_id: "Toda Empresa", manager: "Toda Empresa", name: "Toda Empresa" },
  { id: "KA", manager_id: "KA", manager: "KA (Key Accounts)", name: "KA (Key Accounts)" },
  { id: "Distribuidor", manager_id: "1007", manager: "Distribuidor", name: "Distribuidor" },
  { id: "Inside Sales", manager_id: "1004", manager: "Inside Sales", name: "Inside Sales" },
  { id: "Ecommerce", manager_id: "1005", manager: "Ecommerce", name: "Ecommerce" },
  { id: "Marketplace", manager_id: "1006", manager: "Marketplace", name: "Marketplace" },
  { id: "Amazon 1P", manager_id: "1008", manager: "Amazon 1P", name: "Amazon 1P" },
  { id: "Private Label", manager_id: "1009", manager: "Private Label", name: "Private Label" },
];

export function cleanManagerName(name: string): string {
  if (!name) return "";
  return name.replace(/\s*\((KA|Dist|DIST|Key Accounts)\)/gi, "").trim();
}

const CLEAN_MANAGERS = [
  { id: "Total", manager_id: "Total", manager: "Todos os Gerentes", name: "Todos os Gerentes" },
  ...Array.from(new Set(OFFICIAL_COMMERCIAL_ROLES.map(r => r.managerName))).map(name => {
    const roleObj = OFFICIAL_COMMERCIAL_ROLES.find(r => r.managerName === name);
    return {
      id: roleObj?.managerId || name,
      manager_id: roleObj?.managerId || name,
      manager: name,
      name: name,
    };
  })
];

// IDs de gerentes com carteira de Distribuidor (SSOT: OFFICIAL_COMMERCIAL_ROLES role='DIST')
const DIST_MANAGER_IDS = new Set<string>(
  OFFICIAL_COMMERCIAL_ROLES.filter(r => r.role === 'DIST').map(r => r.managerId)
);

const YEARS = [2024, 2025, 2026, 2027];

type Tab = "metas" | "dias-uteis";

interface GridData {
  forecast: number[];
  forecast_qty: number[];
  desafio_fat: number[];
  desafio_qty: number[];
}

interface ActualSalesData {
  [year: number]: {
    fat: number[];
    qty: number[];
  };
}

export default function MetasPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("metas");
  const [businessDays, setBusinessDays] = useState<BusinessDay[]>([]);
  const [loadingBusinessDays, setLoadingBusinessDays] = useState(true);

  // Dropdown states
  const [selectedChannel, setSelectedChannel] = useState<string>("Toda Empresa");
  const [selectedManager, setSelectedManager] = useState<string>("Total");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Combo Gerente: quando Canal = Distribuidor, exibe apenas gerentes com carteira DIST
  const availableManagers = useMemo(() => {
    if (selectedChannel !== 'Distribuidor') return CLEAN_MANAGERS;
    return CLEAN_MANAGERS.filter(m => m.id === 'Total' || DIST_MANAGER_IDS.has(m.manager_id));
  }, [selectedChannel]);

  const [loadingTargets, setLoadingTargets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusedInput, setFocusedInput] = useState<{ field: string; monthIdx: number } | null>(null);

  // Grid state for inputs
  const [gridData, setGridData] = useState<GridData>({
    forecast: Array(12).fill(0),
    forecast_qty: Array(12).fill(0),
    desafio_fat: Array(12).fill(0),
    desafio_qty: Array(12).fill(0),
  });

  // Actual sales loaded from DB for prevYear and currYear
  const [actualSales, setActualSales] = useState<ActualSalesData>({
    [selectedYear - 1]: { fat: Array(12).fill(0), qty: Array(12).fill(0) },
    [selectedYear]: { fat: Array(12).fill(0), qty: Array(12).fill(0) },
  });

  const [rawDbTargets, setRawDbTargets] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const yearBusinessDays = useMemo(() => {
    return getFullYearBusinessDays(selectedYear);
  }, [selectedYear]);

  const prevYear = selectedYear - 1;
  const currYear = selectedYear;

  const loadBusinessDays = useCallback(async () => {
    setLoadingBusinessDays(true);
    const { data, error: err } = await supabase
      .from("business_days")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: true });

    if (!err && data) setBusinessDays(data);
    setLoadingBusinessDays(false);
  }, []);

  const loadActualSales = useCallback(async (channel: string, manager: string, year: number) => {
    try {
      const prevYr = year - 1;
      const currYr = year;

      // Map 'Private Label' to 'Marca Própria' for actual sales data query
      const dbChannel = channel === 'Private Label' ? 'Marca Própria' : channel;

      const chOpt = CHANNELS.find(c => c.id === channel);
      const isChannelWithoutManager = !['KA', 'Distribuidor', 'Toda Empresa'].includes(channel);
      const mgrOpt = isChannelWithoutManager
        ? chOpt
        : (channel !== 'Toda Empresa' ? CLEAN_MANAGERS.find((m: any) => m.id === manager) : chOpt);

      const pManagerId = mgrOpt?.manager_id || '';
      const pManagerName = mgrOpt?.manager || '';

      const { data, error: err } = await supabase.rpc('get_actual_sales_v2', {
        p_channel: dbChannel,
        p_manager_id: pManagerId,
        p_manager_name: pManagerName,
        p_years: [String(prevYr), String(currYr)]
      });

      if (err) throw err;

      const newActuals: ActualSalesData = {
        [prevYr]: { fat: Array(12).fill(0), qty: Array(12).fill(0) },
        [currYr]: { fat: Array(12).fill(0), qty: Array(12).fill(0) },
      };

      data?.forEach((row: any) => {
        const yr = Number(row.ano);
        const mIdx = Number(row.mes_num) - 1;
        if (mIdx >= 0 && mIdx < 12 && (yr === prevYr || yr === currYr)) {
          newActuals[yr].fat[mIdx] += Number(row.fat || 0);
          newActuals[yr].qty[mIdx] += Number(row.qty || 0);
        }
      });

      setActualSales(newActuals);
    } catch (err) {
      console.error("Erro ao carregar dados reais:", err);
    }
  }, []);

  const loadTargetsData = useCallback(async (channel: string, manager: string, year: number) => {
    try {
      setLoadingTargets(true);
      
      let query = supabase
        .from('targets')
        .select('*')
        .eq('year', year);

      if (channel !== 'Toda Empresa') {
        // Canais sem carteira gerencial: filtrar pelo manager_id do canal
        const isChannelWithoutManager = !['KA', 'Distribuidor', 'Toda Empresa'].includes(channel);
        if (isChannelWithoutManager) {
          const chDef = CHANNELS.find(c => c.id === channel);
          if (chDef) {
            query = query.eq('manager_id', chDef.manager_id);
          }
        } else if (manager === 'Total') {
          const ids = channel === 'Distribuidor'
            ? [...CLEAN_MANAGERS.map((m: any) => m.manager_id).filter((id: string) => id && id !== 'Total'), '1007']
            : CLEAN_MANAGERS.map((m: any) => m.manager_id).filter((id: string) => id && id !== 'Total');
          query = query.in('manager_id', ids);
        } else {
          const mgrOpt = CLEAN_MANAGERS.find((m: any) => m.id === manager);
          if (mgrOpt?.manager_id) {
            query = query.eq('manager_id', mgrOpt.manager_id);
          } else if (mgrOpt) {
            query = query.eq('manager', mgrOpt.manager);
          }
        }
      }

      const { data, error: err } = await query;

      if (err) throw err;

      console.log("selectedChannel:", channel);
      console.log("selectedManager:", manager);
      console.log("selectedYear:", year);
      console.log("targets retornados:", data);

      const newGrid = {
        forecast: Array(12).fill(0),
        forecast_qty: Array(12).fill(0),
        desafio_fat: Array(12).fill(0),
        desafio_qty: Array(12).fill(0),
      };

      // Filtrar linhas correspondentes ao canal selecionado (KA x Distribuidor x Outros)
      const allRows = data || [];
      const hasExplicitKaRows = allRows.some((r: any) => (r.manager || '').toLowerCase().includes('(ka)'));

      const filteredData = allRows.filter((row: any) => {
        const rName = (row.manager || '').toLowerCase();
        if (channel === 'Distribuidor') {
          return rName.includes('(dist)') || rName === 'distribuidor' || row.manager_id === '1007';
        } else if (channel === 'KA') {
          if (hasExplicitKaRows) {
            return rName.includes('(ka)');
          }
          return !rName.includes('(dist)') && rName !== 'distribuidor' && row.manager_id !== '1007';
        }
        return true;
      });

      filteredData.forEach((row: any) => {
        const mIdx = row.month - 1;
        if (mIdx >= 0 && mIdx < 12) {
          newGrid.forecast[mIdx] += Number(row.target_forecast || 0);
          newGrid.forecast_qty[mIdx] += Number(row.target_forecast_qty || 0);
          newGrid.desafio_fat[mIdx] += Number(row.target_revenue || 0);
          newGrid.desafio_qty[mIdx] += Number(row.target_tons || 0);
        }
      });

      setGridData(newGrid);
      setRawDbTargets(filteredData);
    } catch (err) {
      console.error("Erro ao carregar metas:", err);
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  useEffect(() => {
    loadBusinessDays();
  }, [loadBusinessDays]);

  useEffect(() => {
    const authExp = localStorage.getItem("ceo_auth_exp");
    if (authExp && parseInt(authExp) > Date.now()) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadActualSales(selectedChannel, selectedManager, selectedYear);
      loadTargetsData(selectedChannel, selectedManager, selectedYear);
    }
  }, [isAuthenticated, selectedChannel, selectedManager, selectedYear, loadActualSales, loadTargetsData]);


  const handleChannelChange = (val: string) => {
    setSelectedChannel(val);
    setSelectedManager("Total");
  };

  const handleManagerChange = (val: string) => {
    setSelectedManager(val);
  };

  const handleInputChange = (field: keyof GridData, monthIdx: number, value: number) => {
    setGridData(prev => {
      const nextArr = [...prev[field]];
      nextArr[monthIdx] = value;
      return { ...prev, [field]: nextArr };
    });
  };

  const handleSaveGrid = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Para canais sem carteira gerencial, usar CHANNELS para obter o manager_id correto
      const isChannelWithoutManager = !['KA', 'Distribuidor', 'Toda Empresa'].includes(selectedChannel);
      const chOpt = CHANNELS.find(c => c.id === selectedChannel);
      const mgrOpt = isChannelWithoutManager
        ? chOpt  // Inside Sales → { manager_id: "1004", manager: "Inside Sales", ... }
        : (selectedChannel !== 'Toda Empresa'
            ? CLEAN_MANAGERS.find((m: any) => m.id === selectedManager)
            : chOpt);

      if (!mgrOpt) {
        throw new Error("Opção de gerente inválida.");
      }

      if (selectedChannel === 'Toda Empresa') {
        throw new Error("Não é possível salvar metas na visão 'Toda Empresa'. Por favor, selecione um canal específico.");
      }

      if (selectedChannel === 'KA' && selectedManager === 'Total') {
        throw new Error("Não é possível salvar metas no 'Total' do canal KA. Por favor, selecione um gerente individual.");
      }

      if (selectedChannel === 'Distribuidor' && selectedManager === 'Total') {
        throw new Error("Não é possível salvar metas no 'Total' do canal Distribuidor. Por favor, selecione um gerente individual.");
      }

      // Definir nome do manager para segregação no banco
      // - KA e Distribuidor: sufixo por gerente selecionado
      // - Outros canais (Inside Sales, Ecommerce, etc.): usa o nome do canal como identificador
      let managerNameToSave = mgrOpt.manager;
      if (selectedChannel === "Distribuidor") {
        managerNameToSave = `${mgrOpt.manager} (Dist)`;
      } else if (selectedChannel === "KA") {
        managerNameToSave = `${mgrOpt.manager} (KA)`;
      } else if (!['KA', 'Distribuidor'].includes(selectedChannel)) {
        // Canais sem carteira gerencial: usa o nome do canal diretamente
        managerNameToSave = selectedChannel;
      }

      const rowsToUpsert = [];
      for (let m = 1; m <= 12; m++) {
        const mIdx = m - 1;
        
        rowsToUpsert.push({
          manager: managerNameToSave,
          manager_id: mgrOpt.manager_id,
          year: selectedYear,
          month: m,
          target_forecast: gridData.forecast[mIdx],
          target_forecast_qty: gridData.forecast_qty[mIdx],
          target_revenue: gridData.desafio_fat[mIdx],
          target_tons: gridData.desafio_qty[mIdx],
          updated_at: new Date().toISOString(),
        });
      }

      console.log("selectedChannel:", selectedChannel);
      console.log("selectedManager:", selectedManager);
      console.log("mgrOpt:", mgrOpt);
      console.log("managerNameToSave:", managerNameToSave);
      console.log("rowsToUpsert:", rowsToUpsert);

      const { error: upsertErr } = await supabase
        .from('targets')
        .upsert(rowsToUpsert, { onConflict: 'manager,year,month' });

      if (upsertErr) throw upsertErr;

      setSuccess("Metas salvas com sucesso!");
      loadTargetsData(selectedChannel, selectedManager, selectedYear);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar metas:", err);
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncYearBusinessDays = async (yearToSync: number) => {
    try {
      setSaving(true);
      setError(null);
      const fullYearData = getFullYearBusinessDays(yearToSync);
      const payload = fullYearData.map(m => ({
        year: m.year,
        month: m.month,
        total_days: m.total_days,
        elapsed_days: m.elapsed_days,
      }));

      const { error: upsertErr } = await supabase
        .from("business_days")
        .upsert(payload, { onConflict: "year,month" });

      if (upsertErr) throw upsertErr;

      setSuccess(`Calendário de ${yearToSync} sincronizado com sucesso!`);
      loadBusinessDays();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Erro ao sincronizar dias úteis:", err);
      setError(`Erro ao sincronizar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const sumArray = (arr: number[]) => arr.reduce((a, b) => a + (b || 0), 0);

  const calcPct = (num: number, den: number) => {
    if (!den || den === 0) return "-";
    return `${((num / den) * 100).toFixed(0)}%`;
  };

  const renderReadOnlyRow = (label: string, values: number[], isCurrency: boolean) => {
    const total = sumArray(values);
    return (
      <tr className="bg-muted/5 hover:bg-muted/10 transition-colors">
        <td className="py-3 px-4 font-semibold text-muted text-[10px] uppercase tracking-wider">{label}</td>
        {values.map((val, idx) => (
          <td key={idx} className="py-3 px-2 text-right text-muted font-medium text-xs border-l border-border/50">
            {isCurrency ? formatCurrency(val) : formatNumber(val, 0)}
          </td>
        ))}
        <td className="py-3 px-4 text-right font-bold text-muted text-xs border-l border-border/50">
          {isCurrency ? formatCurrency(total) : formatNumber(total, 0)}
        </td>
      </tr>
    );
  };

  const renderInputRow = (label: string, field: keyof GridData, isCurrency: boolean) => {
    const values = gridData[field];
    const total = sumArray(values);
    const isReadOnly = (selectedChannel === 'KA' && selectedManager === 'Total') || 
                       (selectedChannel === 'Distribuidor' && selectedManager === 'Total') || 
                       selectedChannel === 'Toda Empresa';

    return (
      <tr className="hover:bg-muted/5 transition-colors">
        <td className="py-3 px-4 font-semibold text-foreground text-[10px] uppercase tracking-wider">{label}</td>
        {values.map((val, idx) => {
          const isFocused = focusedInput?.field === field && focusedInput?.monthIdx === idx;
          const displayValue = isFocused
            ? (val === 0 ? "" : val.toString())
            : (val === 0 ? "0" : val.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));

          return (
            <td key={idx} className="py-2 px-2 text-right border-l border-border/50">
              <input
                type="text"
                value={displayValue}
                disabled={isReadOnly}
                onFocus={() => !isReadOnly && setFocusedInput({ field, monthIdx: idx })}
                onBlur={(e) => {
                  setFocusedInput(null);
                  const cleaned = e.target.value.replace(/\./g, "").replace(",", ".");
                  const num = cleaned === "" ? 0 : parseFloat(cleaned);
                  handleInputChange(field, idx, isNaN(num) ? 0 : num);
                }}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\./g, "").replace(",", ".");
                  const num = cleaned === "" ? 0 : parseFloat(cleaned);
                  handleInputChange(field, idx, isNaN(num) ? 0 : num);
                }}
                className={`w-full min-w-[100px] max-w-[125px] bg-background border border-border rounded-md px-2 py-1.5 text-right text-xs text-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all ${
                  isReadOnly ? "bg-muted/20 opacity-80 cursor-not-allowed font-medium text-muted" : ""
                }`}
                placeholder="0"
              />
            </td>
          );
        })}
        <td className="py-3 px-4 text-right font-bold text-foreground text-xs border-l border-border/50">
          {isCurrency ? formatCurrency(total) : formatNumber(total, 0)}
        </td>
      </tr>
    );
  };

  const renderPercentageRow = (label: string, numArr: number[], denArr: number[]) => {
    const numTotal = sumArray(numArr);
    const denTotal = sumArray(denArr);

    return (
      <tr className="text-dim hover:bg-muted/5 transition-colors">
        <td className="py-2.5 px-4 text-xs font-normal text-muted/70">{label}</td>
        {Array(12).fill(0).map((_, idx) => {
          const num = numArr[idx] || 0;
          const den = denArr[idx] || 0;
          return (
            <td key={idx} className="py-2.5 px-2 text-right text-xs font-bold text-muted/80 border-l border-border/50">
              {calcPct(num, den)}
            </td>
          );
        })}
        <td className="py-2.5 px-4 text-right text-xs font-bold text-foreground/80 border-l border-border/50">
          {calcPct(numTotal, denTotal)}
        </td>
      </tr>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="glass-card p-8 w-full max-w-sm text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-amber-500/5 z-0" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 mb-6 shadow-lg shadow-violet-500/30">
              <Target className="w-6 h-6 text-white" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-sm text-muted mb-6">Por favor, digite a senha para acessar a gestão de metas.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === "123456") {
                setIsAuthenticated(true);
                localStorage.setItem("ceo_auth_exp", (Date.now() + 2 * 60 * 60 * 1000).toString());
                setError(null);
              } else {
                setError("Senha incorreta");
              }
            }} className="w-full flex flex-col gap-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Senha"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-center tracking-widest text-foreground placeholder:tracking-normal placeholder:text-dim focus:outline-none focus:border-violet-500"
                autoFocus
              />
              
              {error && <p className="text-xs text-red-400 -mt-2">{error}</p>}
              
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-medium transition-all shadow-lg shadow-violet-500/20"
              >
                Acessar
              </button>
            </form>

            <Link href="/" className="mt-8 flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Menu Inicial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isReadOnlyMode = 
    selectedChannel === 'Toda Empresa' || 
    (selectedChannel === 'KA' && selectedManager === 'Total') || 
    (selectedChannel === 'Distribuidor' && selectedManager === 'Total');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Gestão de Metas
            </h1>
            <p className="text-xs text-muted">
              Planejamento e acompanhamento de metas horizontais
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-card rounded-xl p-1 w-fit border border-border/50">
          <button
            onClick={() => setActiveTab("metas")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "metas"
                ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Target className="w-4 h-4 inline-block mr-2" />
            Metas
          </button>
          <button
            onClick={() => setActiveTab("dias-uteis")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "dias-uteis"
                ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Calendar className="w-4 h-4 inline-block mr-2" />
            Dias Úteis
          </button>
        </div>

        {/* Feedback */}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm animate-fade-in">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
            ✗ {error}
          </div>
        )}

        {/* =================== METAS TAB =================== */}
        {activeTab === "metas" && (
          <div className="space-y-6">
            {/* Selectors Bar */}
            <div className="glass-card p-5 border border-border/50 rounded-2xl flex flex-wrap items-center gap-6">
              {/* Canal Dropdown */}
              <div className="flex flex-col">
                <span className="text-xs text-muted font-semibold mb-1.5">Canal</span>
                <div className="relative">
                  <select
                    value={selectedChannel}
                    onChange={(e) => handleChannelChange(e.target.value)}
                    className="appearance-none bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-foreground focus:outline-none focus:border-violet-500"
                  >
                    {CHANNELS.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Gerente Dropdown — apenas canais com carteira gerencial (KA e Distribuidor) */}
              {(selectedChannel === 'KA' || selectedChannel === 'Distribuidor') && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted font-semibold mb-1.5">Gerente</span>
                  <div className="relative">
                    <select
                      value={selectedManager}
                      onChange={(e) => handleManagerChange(e.target.value)}
                      className="appearance-none bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-foreground focus:outline-none focus:border-violet-500"
                    >
                      {availableManagers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-3.5 pointer-events-none" />
                  </div>
                </div>
              )}


              {/* Ano Dropdown */}
              <div className="flex flex-col">
                <span className="text-xs text-muted font-semibold mb-1.5">Ano das Metas</span>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="appearance-none bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-foreground focus:outline-none focus:border-violet-500"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Botão Salvar Superior */}
              <div className="flex flex-col justify-end self-end ml-auto">
                <button
                  disabled={saving || isReadOnlyMode}
                  onClick={handleSaveGrid}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:from-gray-700 disabled:to-gray-700 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-500/20 disabled:shadow-none disabled:opacity-50 h-[42px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Main Horizontal Grid Table */}
            {loadingTargets ? (
              <div className="glass-card flex flex-col items-center justify-center py-24 space-y-3">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                <p className="text-muted text-xs uppercase font-bold tracking-widest animate-pulse">Carregando Metas...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* BLOCO 1: FATURAMENTO */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-violet-400">
                      Faturamento (Valor Líquido R$)
                    </h3>
                  </div>
                  <div className="glass-card overflow-hidden border border-border/50 relative shadow-xl rounded-2xl flex flex-col">
                    <div className="overflow-x-auto relative z-10">
                      <table className="w-full text-left text-sm border-collapse min-w-[1250px]">
                        <thead>
                          <tr className="border-b border-border text-muted bg-muted/20 backdrop-blur-sm">
                            <th className="font-semibold py-3 px-4 w-60 uppercase text-[10px] tracking-wider text-muted">Mês / Indicador</th>
                            {MONTHS.map((m) => (
                              <th key={m} className="font-semibold py-3 px-2 text-right uppercase text-[10px] tracking-wider text-muted border-l border-border/50">{m.substring(0, 3)}</th>
                            ))}
                            <th className="font-semibold py-3 px-4 text-right uppercase text-[10px] tracking-wider text-muted border-l border-border/50">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {renderReadOnlyRow(`Real Faturamento ${prevYear}`, actualSales[prevYear]?.fat || Array(12).fill(0), true)}
                          {renderReadOnlyRow(`Real Faturamento ${currYear}`, actualSales[currYear]?.fat || Array(12).fill(0), true)}
                          {renderInputRow("Forecast Faturamento", "forecast", true)}
                          {renderInputRow("Desafio Faturamento", "desafio_fat", true)}

                          {/* Percentages separator row */}
                          <tr className="bg-muted/10 font-bold text-muted text-[10px] uppercase tracking-widest">
                            <td colSpan={14} className="py-2 px-4 border-t border-b border-border/50 text-muted/80">Porcentagens de Atingimento</td>
                          </tr>
                          {renderPercentageRow(`% Real Faturamento Vs Forecast (${currYear})`, actualSales[currYear]?.fat || Array(12).fill(0), gridData.forecast)}
                          {renderPercentageRow(`% Real Faturamento Vs Desafio (${currYear})`, actualSales[currYear]?.fat || Array(12).fill(0), gridData.desafio_fat)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* BLOCO 2: QUANTIDADE */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500">
                      Quantidade (Unidades / Volume)
                    </h3>
                  </div>
                  <div className="glass-card overflow-hidden border border-border/50 relative shadow-xl rounded-2xl flex flex-col">
                    <div className="overflow-x-auto relative z-10">
                      <table className="w-full text-left text-sm border-collapse min-w-[1250px]">
                        <thead>
                          <tr className="border-b border-border text-muted bg-muted/20 backdrop-blur-sm">
                            <th className="font-semibold py-3 px-4 w-60 uppercase text-[10px] tracking-wider text-muted">Mês / Indicador</th>
                            {MONTHS.map((m) => (
                              <th key={m} className="font-semibold py-3 px-2 text-right uppercase text-[10px] tracking-wider text-muted border-l border-border/50">{m.substring(0, 3)}</th>
                            ))}
                            <th className="font-semibold py-3 px-4 text-right uppercase text-[10px] tracking-wider text-muted border-l border-border/50">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {renderReadOnlyRow(`Real Quantidade ${prevYear}`, actualSales[prevYear]?.qty || Array(12).fill(0), false)}
                          {renderReadOnlyRow(`Real Quantidade ${currYear}`, actualSales[currYear]?.qty || Array(12).fill(0), false)}
                          {renderInputRow("Forecast Quantidade", "forecast_qty", false)}
                          {renderInputRow("Desafio Quantidade", "desafio_qty", false)}

                          {/* Percentages separator row */}
                          <tr className="bg-muted/10 font-bold text-muted text-[10px] uppercase tracking-widest">
                            <td colSpan={14} className="py-2 px-4 border-t border-b border-border/50 text-muted/80">Porcentagens de Atingimento</td>
                          </tr>
                          {renderPercentageRow(`% Real Quantidade Vs Forecast (${currYear})`, actualSales[currYear]?.qty || Array(12).fill(0), gridData.forecast_qty)}
                          {renderPercentageRow(`% Real Quantidade Vs Desafio (${currYear})`, actualSales[currYear]?.qty || Array(12).fill(0), gridData.desafio_qty)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Save button and actions */}
                <div className="flex justify-between items-center bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    {selectedChannel === 'Toda Empresa' ? (
                      <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                        Modo Leitura: Toda Empresa mostra a soma de todos os canais. Para editar, selecione o canal específico.
                      </span>
                    ) : selectedChannel === 'KA' && selectedManager === 'Total' ? (
                      <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                        Modo Leitura: O KA Total é a soma de todos os gerentes. Selecione um gerente (ex: Leandro) para editar.
                      </span>
                    ) : selectedChannel === 'Distribuidor' && selectedManager === 'Total' ? (
                      <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                        Modo Leitura: O Distribuidor Total é a soma de todos os gerentes. Selecione um gerente (ex: Luiz) para editar.
                      </span>
                    ) : (
                      <span className="text-xs text-muted font-medium">
                        Edite as metas acima e clique em salvar para registrar no sistema.
                      </span>
                    )}
                  </div>

                  <button
                    disabled={saving || isReadOnlyMode}
                    onClick={handleSaveGrid}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold transition-all shadow-lg shadow-violet-500/20 disabled:shadow-none disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================== DIAS ÚTEIS TAB =================== */}
        {activeTab === "dias-uteis" && (
          <div className="animate-fade-in space-y-6">
            {/* Header com Ações e Resumo Anual */}
            <div className="glass-card p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Calendário Oficial de Dias Úteis ({selectedYear})
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Cálculo automático de Segunda a Sexta-feira, excluindo feriados nacionais e móveis do Brasil.
                  </p>
                </div>
                <button
                  onClick={() => handleSyncYearBusinessDays(selectedYear)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-xs font-semibold hover:from-violet-400 hover:to-violet-500 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Sincronizar Calendário {selectedYear}
                </button>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Dias Úteis Totais ({selectedYear})</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {yearBusinessDays.reduce((acc, curr) => acc + curr.total_days, 0)} <span className="text-xs font-normal text-muted">dias</span>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Dias Transcorridos (Acumulado)</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {yearBusinessDays.reduce((acc, curr) => acc + curr.elapsed_days, 0)} <span className="text-xs font-normal text-emerald-500/80">dias</span>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Dias Restantes no Ano</p>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {yearBusinessDays.reduce((acc, curr) => acc + curr.remaining_days, 0)} <span className="text-xs font-normal text-blue-500/80">dias</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela dos 12 Meses */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Matriz Anual de Dias Úteis — {selectedYear}
                </h3>
                <span className="text-xs text-muted font-medium">12 Meses Calculados</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/15 text-xs text-muted">
                      <th className="py-3 px-4 font-semibold">Mês</th>
                      <th className="py-3 px-4 font-semibold text-right">Total Dias Úteis</th>
                      <th className="py-3 px-4 font-semibold text-right">Dias Transcorridos</th>
                      <th className="py-3 px-4 font-semibold text-right">Dias Restantes</th>
                      <th className="py-3 px-4 font-semibold text-center">Status Mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-sm">
                    {yearBusinessDays.map((m) => {
                      const curDate = new Date();
                      const curY = curDate.getFullYear();
                      const curM = curDate.getMonth() + 1;

                      let statusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted/20 text-muted">
                          Futuro
                        </span>
                      );
                      if (m.year < curY || (m.year === curY && m.month < curM)) {
                        statusBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Concluído
                          </span>
                        );
                      } else if (m.year === curY && m.month === curM) {
                        statusBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 animate-pulse">
                            Em Andamento
                          </span>
                        );
                      }

                      return (
                        <tr key={m.month} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-foreground">{m.monthName} ({String(m.month).padStart(2, '0')})</td>
                          <td className="py-3.5 px-4 text-right font-bold text-foreground">{m.total_days}</td>
                          <td className="py-3.5 px-4 text-right text-emerald-400 font-semibold">{m.elapsed_days}</td>
                          <td className="py-3.5 px-4 text-right text-blue-400 font-semibold">{m.remaining_days}</td>
                          <td className="py-3.5 px-4 text-center">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
