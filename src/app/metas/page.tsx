"use client";

import { useState, useEffect, useCallback } from "react";
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

const CHANNELS = [
  { id: "Toda Empresa", name: "Toda Empresa" },
  { id: "KA", name: "KA (Key Accounts)" },
  { id: "Inside Sales", name: "Inside Sales" },
  { id: "Ecommerce", name: "Ecommerce" },
  { id: "Marketplace", name: "Marketplace" }
];

const KA_MANAGERS = [
  { id: "Total", name: "KA Total (Somado)" },
  { id: "Leandro", name: "Leandro" },
  { id: "Luiz", name: "Luiz" },
  { id: "Julliano", name: "Julliano" }
];

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

  // Business days form
  const [bdYear, setBdYear] = useState(new Date().getFullYear());
  const [bdMonth, setBdMonth] = useState(new Date().getMonth() + 1);
  const [bdTotal, setBdTotal] = useState("");
  const [bdElapsed, setBdElapsed] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      const { data, error: err } = await supabase.rpc('get_actual_sales_v2', {
        p_channel: channel,
        p_manager: manager,
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

      if (channel === 'KA') {
        let managersToFetch: string[] = [];
        if (manager === 'Total') {
          managersToFetch = ['Leandro', 'Luiz', 'Julliano'];
        } else {
          managersToFetch = [manager];
        }
        query = query.in('manager', managersToFetch);
      } else if (channel !== 'Toda Empresa') {
        query = query.in('manager', [channel]);
      }

      const { data, error: err } = await query;

      if (err) throw err;

      const newGrid = {
        forecast: Array(12).fill(0),
        forecast_qty: Array(12).fill(0),
        desafio_fat: Array(12).fill(0),
        desafio_qty: Array(12).fill(0),
      };

      data?.forEach((row: any) => {
        const mIdx = row.month - 1;
        if (mIdx >= 0 && mIdx < 12) {
          newGrid.forecast[mIdx] += Number(row.target_forecast || 0);
          newGrid.forecast_qty[mIdx] += Number(row.target_forecast_qty || 0);
          newGrid.desafio_fat[mIdx] += Number(row.target_revenue || 0);
          newGrid.desafio_qty[mIdx] += Number(row.target_tons || 0);
        }
      });

      setGridData(newGrid);
      setRawDbTargets(data || []);
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

      const targetManager = selectedChannel === 'KA' ? selectedManager : selectedChannel;

      if (targetManager === 'Total') {
        throw new Error("Não é possível salvar metas para a soma total do KA. Por favor, edite cada gerente individualmente.");
      }

      const rowsToUpsert = [];
      for (let m = 1; m <= 12; m++) {
        const mIdx = m - 1;
        
        rowsToUpsert.push({
          manager: targetManager,
          year: selectedYear,
          month: m,
          target_forecast: gridData.forecast[mIdx],
          target_forecast_qty: gridData.forecast_qty[mIdx],
          target_revenue: gridData.desafio_fat[mIdx],
          target_tons: gridData.desafio_qty[mIdx],
          updated_at: new Date().toISOString(),
        });
      }

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

  const handleSaveBusinessDay = async () => {
    setError(null);
    const payload = {
      year: bdYear,
      month: bdMonth,
      total_days: bdTotal ? parseInt(bdTotal) : 0,
      elapsed_days: bdElapsed ? parseInt(bdElapsed) : 0,
    };

    const existing = businessDays.find(
      (bd) => bd.year === bdYear && bd.month === bdMonth
    );

    if (existing) {
      const { error: err } = await supabase
        .from("business_days")
        .update(payload)
        .eq("id", existing.id);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase
        .from("business_days")
        .insert(payload);
      if (err) { setError(err.message); return; }
    }

    setSuccess("Dias úteis salvos!");
    loadBusinessDays();
    setBdTotal("");
    setBdElapsed("");
    setTimeout(() => setSuccess(null), 3000);
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
    const isReadOnly = (selectedChannel === 'KA' && selectedManager === 'Total') || selectedChannel === 'Toda Empresa';

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

  const isReadOnlyMode = (selectedChannel === 'KA' && selectedManager === 'Total') || selectedChannel === 'Toda Empresa';

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

              {/* Gerente Dropdown (Conditional on KA) */}
              {selectedChannel === "KA" && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted font-semibold mb-1.5">Gerente</span>
                  <div className="relative">
                    <select
                      value={selectedManager}
                      onChange={(e) => setSelectedManager(e.target.value)}
                      className="appearance-none bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-foreground focus:outline-none focus:border-violet-500"
                    >
                      {KA_MANAGERS.map(m => (
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
          <div className="animate-fade-in">
            {loadingBusinessDays ? (
              <div className="glass-card flex flex-col items-center justify-center py-24 space-y-3">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                <p className="text-muted text-xs uppercase font-bold tracking-widest animate-pulse">Carregando Dias Úteis...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div className="glass-card p-6">
                  <h3 className="text-base font-semibold text-foreground mb-4">
                    Cadastrar / Editar Dias Úteis
                  </h3>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-muted mb-1">
                        Ano
                      </label>
                      <div className="relative">
                        <select
                          value={bdYear}
                          onChange={(e) => setBdYear(Number(e.target.value))}
                          className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500"
                        >
                          {YEARS.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">
                        Mês
                      </label>
                      <div className="relative">
                        <select
                          value={bdMonth}
                          onChange={(e) => setBdMonth(Number(e.target.value))}
                          className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500"
                        >
                          {MONTHS.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">
                        Total Dias Úteis
                      </label>
                      <input
                        type="number"
                        value={bdTotal}
                        onChange={(e) => setBdTotal(e.target.value)}
                        placeholder="Ex: 22"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-dim focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">
                        Dias Transcorridos
                      </label>
                      <input
                        type="number"
                        value={bdElapsed}
                        onChange={(e) => setBdElapsed(e.target.value)}
                        placeholder="Ex: 15"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-dim focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {bdTotal && bdElapsed && (
                    <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <p className="text-xs text-muted">Dias Faltantes</p>
                      <p className="text-lg font-bold text-violet-400">
                        {Math.max(0, parseInt(bdTotal || "0") - parseInt(bdElapsed || "0"))}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleSaveBusinessDay}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-500 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Salvar
                  </button>
                </div>

                {/* Table */}
                <div className="glass-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">
                      Dias Úteis Cadastrados
                    </h3>
                  </div>
                  {businessDays.length === 0 ? (
                    <div className="p-8 text-center text-muted text-sm">
                      Nenhum registro
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/15 text-xs text-muted">
                            <th className="py-2.5 px-4 font-semibold">Ano</th>
                            <th className="py-2.5 px-4 font-semibold">Mês</th>
                            <th className="py-2.5 px-4 font-semibold">Total</th>
                            <th className="py-2.5 px-4 font-semibold">Transcorridos</th>
                            <th className="py-2.5 px-4 font-semibold">Faltam</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 text-sm">
                          {businessDays.map((bd) => (
                            <tr
                              key={bd.id}
                              className="cursor-pointer hover:bg-muted/10 transition-colors"
                              onClick={() => {
                                setBdYear(bd.year);
                                setBdMonth(bd.month);
                                setBdTotal(bd.total_days.toString());
                                setBdElapsed(bd.elapsed_days.toString());
                              }}
                            >
                              <td className="py-3 px-4 text-muted">{bd.year}</td>
                              <td className="py-3 px-4 text-muted">{MONTHS[bd.month - 1]}</td>
                              <td className="py-3 px-4 font-medium text-foreground">
                                {bd.total_days}
                              </td>
                              <td className="py-3 px-4 text-foreground">{bd.elapsed_days}</td>
                              <td className="py-3 px-4 text-blue-500 font-medium">
                                {Math.max(0, bd.total_days - bd.elapsed_days)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
