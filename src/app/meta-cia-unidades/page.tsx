"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ArrowLeft,
  Coffee,
  CalendarDays,
  Target,
  BarChart,
  LayoutGrid,
  ChevronDown,
  Building,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatNumber } from "@/lib/formatters";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEAR = new Date().getFullYear();

// Data Models
interface CeoTarget {
  id?: number;
  year: number;
  month: number;
  channel: string;
  target_forecast_qty?: number;
  target_internal_qty?: number;
}

interface MonthlyReal {
  month: number;
  channel: string;
  amount: number;
}

type JoinedData = {
  month: number;
  monthName: string;
  real: number;
  forecast: number;
  internal: number;
  dbId?: number;
};

// Colors for UI accents
const PROGRESS_FORECAST_COLOR = "bg-blue-500 shadow-blue-500/50";
const PROGRESS_INTERNAL_COLOR = "bg-violet-500 shadow-violet-500/50";

export default function AcompAnualPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Raw data from DB and API
  const [dbTargets, setDbTargets] = useState<CeoTarget[]>([]);
  const [realSales, setRealSales] = useState<MonthlyReal[]>([]);
  const [uniqueChannels, setUniqueChannels] = useState<string[]>([]);
  
  // UI State
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [showChannels, setShowChannels] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // 1. Load Real Sales from API
    try {
      const res = await fetch(`/api/dashboard/meta-cia?year=${YEAR}&type=qty`);
      const json = await res.json();
      if (json.success && json.data) {
        setRealSales(json.data);
        const channels = Array.from(new Set((json.data as MonthlyReal[]).map(d => d.channel)));
        setUniqueChannels(channels.filter(c => c !== "Todos").sort());
      }
    } catch (err) {
      console.error("API falhou", err);
    }

    // 2. Load CeoTargets from Supabase
    const { data: targets, error } = await supabase
      .from("ceo_targets")
      .select("*")
      .eq("year", YEAR);
      
    if (!error && targets) {
      setDbTargets(targets);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    const authExp = localStorage.getItem("ceo_auth_exp");
    if (authExp && parseInt(authExp) > Date.now()) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleUpdateMeta = async (month: number, channel: string, field: "target_forecast_qty" | "target_internal_qty", valueStr: string) => {
    const value = parseFloat(valueStr || "0");
    const existing = dbTargets.find(t => t.month === month && t.channel === channel);

    const saveKey = `${channel}-${month}`;
    setSavingId(saveKey);

    try {
      if (existing && existing.id) {
        const payload = { ...existing, [field]: value };
        // Update local speculatively
        setDbTargets(prev => prev.map(t => t.id === existing.id ? payload : t));
        
        await supabase
          .from("ceo_targets")
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        const payload: CeoTarget = {
          year: YEAR,
          month,
          channel,
          target_forecast_qty: field === "target_forecast_qty" ? value : 0,
          target_internal_qty: field === "target_internal_qty" ? value : 0,
        };
        
        const { data, error } = await supabase
          .from("ceo_targets")
          .insert(payload)
          .select()
          .single();
          
        if (data && !error) {
          setDbTargets(prev => [...prev, data]);
        }
      }
    } catch (err) {
      console.error("Erro ao salvar meta", err);
    } finally {
      setTimeout(() => setSavingId(null), 500);
    }
  };

  const buildJoinedData = (channelFilter: string): JoinedData[] => {
    return MONTHS.map((mName, idx) => {
      const m = idx + 1;
      const r = realSales.find(s => s.month === m && s.channel === channelFilter)?.amount || 0;
      const t = dbTargets.find(t => t.month === m && t.channel === channelFilter);
      return {
        month: m,
        monthName: mName,
        real: r,
        forecast: t?.target_forecast_qty || 0,
        internal: t?.target_internal_qty || 0,
        dbId: t?.id,
      };
    });
  };

  // Auth gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="glass-card p-10 w-full max-w-md text-center shadow-2xl relative overflow-hidden">
          {/* Subtle gradient orb behind */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 mx-auto mb-6 shadow-lg shadow-blue-900/30">
              <Building className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Painel do CEO</h2>
            <p className="text-muted text-sm mb-8">Acompanhamento estratégico anual. Digite a credencial executiva.</p>
            
              <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === "123456") {
                setIsAuthenticated(true);
                localStorage.setItem("ceo_auth_exp", (Date.now() + 2 * 60 * 60 * 1000).toString());
              }
            }}>
              <input
                type="password"
                autoFocus
                placeholder="••••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-4 text-center text-lg tracking-[0.5em] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all mb-4"
              />
              <button type="submit" className="w-full py-4 rounded-xl bg-foreground text-background font-bold hover:bg-muted transition-colors">
                Entrar
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const globalData = buildJoinedData("Todos");
  
  const renderTable = (dataLines: JoinedData[], type: "forecast" | "internal", channel: string) => {
    const isForecast = type === "forecast";
    const title = isForecast ? `Meta Forecast ${YEAR}` : `Desafio ${YEAR}`;
    const desc = isForecast ? "Acompanhamento orçamentário mensal" : "Acompanhamento da meta corporativa estipulada";
    const bgGradient = isForecast ? "from-blue-600/10 to-indigo-600/5" : "from-violet-600/10 to-fuchsia-600/5";
    const iconColor = isForecast ? "text-blue-500" : "text-violet-500";
    const progColor = isForecast ? PROGRESS_FORECAST_COLOR : PROGRESS_INTERNAL_COLOR;
    const saveField = isForecast ? "target_forecast_qty" : "target_internal_qty";

    // YTD Totals (Up to current month or max month with real data)
    const maxRealMonth = Math.max(...dataLines.filter(row => row.real > 0).map(row => row.month), 0);
    const accumulationMonth = maxRealMonth > 0 ? maxRealMonth : (new Date().getMonth() + 1);
    
    const ytdLines = dataLines.filter(row => row.month <= accumulationMonth);
    const totalMetaYTD = ytdLines.reduce((acc, curr) => acc + (isForecast ? curr.forecast : curr.internal), 0);
    const totalRealYTD = ytdLines.reduce((acc, curr) => acc + curr.real, 0);
    const totalPctYTD = totalMetaYTD > 0 ? (totalRealYTD / totalMetaYTD) * 100 : 0;

    // Year Totals (For the header)
    const totalMetaAno = totalMetaYTD;
    const totalRealAno = totalRealYTD;
    const totalPctAno = totalPctYTD;

    return (
      <div className={`glass-card overflow-hidden border border-border/50 relative shadow-xl rounded-2xl h-full flex flex-col`}>
        <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b ${bgGradient} opacity-50 pointer-events-none`} />
        
        <div className="px-6 py-5 border-b border-border/50 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-4 items-center">
            <div className="p-3 bg-background border border-border rounded-xl shadow-inner">
              {isForecast ? <Target className={`w-6 h-6 ${iconColor}`} /> : <BarChart className={`w-6 h-6 ${iconColor}`} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                {title} 
                {channel !== "Todos" && <span className="text-xs bg-muted px-2 py-1 rounded-md ml-2 font-medium">{channel}</span>}
              </h3>
              <p className="text-xs text-muted mt-0.5">{desc}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[0.65rem] uppercase tracking-widest text-muted font-bold mb-1">Acumulado até {MONTHS[accumulationMonth - 1]}</p>
            <div className="flex items-end justify-end gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-foreground">{formatNumber(totalRealAno)}</span>
                <span className="text-xs text-muted">/ {formatNumber(totalMetaAno)}</span>
              </div>
              <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted">
                {totalPctAno.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto relative z-10 flex-1">
          <table className="w-full text-left text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border text-muted bg-muted/20 backdrop-blur-sm">
                <th className="font-semibold py-3 px-6 w-32 uppercase text-xs tracking-wider">Mês</th>
                <th className="font-semibold py-3 px-6 text-right w-48 uppercase text-xs tracking-wider">Meta (UN)</th>
                <th className="font-semibold py-3 px-6 text-right w-48 uppercase text-xs tracking-wider">Real (UN)</th>
                <th className="font-semibold py-3 px-6 uppercase text-xs tracking-wider">Progresso (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {/* Row Consolidado YTD */}
              <tr className="bg-muted/10 border-b-2 border-border/60">
                <td className="py-4 px-6 font-bold text-foreground text-[0.8rem] flex flex-col">
                  Acumulado YTD
                  <span className="text-[0.6rem] text-dim font-medium uppercase tracking-widest mt-0.5">Até {MONTHS[accumulationMonth - 1]}</span>
                </td>
                <td className="py-4 px-6 text-right font-bold text-foreground">
                  {formatNumber(totalMetaYTD)}
                </td>
                <td className="py-4 px-6 text-right font-bold text-foreground tracking-tight">
                  {totalRealYTD > 0 ? formatNumber(totalRealYTD) : <span className="text-dim">-</span>}
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-full bg-background border border-border h-2.5 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${progColor}`}
                        style={{ width: `${Math.min(totalPctYTD, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-12 text-right ${totalPctYTD >= 100 ? 'text-green-500 drop-shadow-[0_0_2px_rgba(34,197,94,0.4)]' : 'text-foreground'}`}>
                      {totalPctYTD > 0 ? `${totalPctYTD.toFixed(0)}%` : '-'}
                    </span>
                  </div>
                </td>
              </tr>
              {dataLines.map((row) => {
                const metaVal = isForecast ? row.forecast : row.internal;
                const pct = metaVal > 0 ? (row.real / metaVal) * 100 : 0;
                const isSaving = savingId === `${channel}-${row.month}`;

                return (
                  <tr key={row.month} className="group hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 px-6 font-medium text-foreground text-[0.8rem] flex flex-col">
                      {row.monthName}
                      <span className="text-[0.6rem] text-dim">{YEAR}</span>
                    </td>
                    <td className="py-2.5 px-6 text-right">
                      <div className="relative inline-block w-full max-w-[140px]">
                        <input
                          type="number"
                          defaultValue={metaVal || ""}
                          placeholder="0.00"
                          onBlur={(e) => handleUpdateMeta(row.month, channel, saveField, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className={`w-full bg-background border border-border rounded-md px-3 py-1.5 text-right text-sm text-foreground focus:border-${isForecast?'blue':'violet'}-500 focus:ring-1 focus:ring-${isForecast?'blue':'violet'}-500 transition-all ${isSaving ? 'opacity-50' : ''}`}
                        />
                        {isSaving && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-6 text-right font-medium text-foreground tracking-tight">
                      {row.real > 0 ? formatNumber(row.real) : <span className="text-dim">-</span>}
                    </td>
                    <td className="py-2.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-background border border-border h-2 rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${progColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-12 text-right ${pct >= 100 ? 'text-green-500 drop-shadow-[0_0_2px_rgba(34,197,94,0.4)]' : 'text-muted'}`}>
                          {pct > 0 ? `${pct.toFixed(0)}%` : '-'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background relative selection:bg-blue-500/30">
      {/* Decorative gradient blur */}
      <div className="fixed top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-900/5 via-violet-900/5 to-transparent pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 border border-border rounded-xl hover:bg-muted transition-colors text-muted hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/20">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Meta Cia (Unidades)</h1>
              <p className="text-xs font-medium text-muted uppercase tracking-widest mt-0.5">Visão Executiva</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/meta-cia" className="text-sm font-bold text-foreground bg-green-500/10 hover:bg-green-500/20 px-4 py-2 rounded-full border border-green-500/20 transition-all flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              Visão R$ (Faturamento)
            </Link>
            <div className="flex items-center gap-2 text-sm text-dim bg-muted/30 px-4 py-2 rounded-full border border-border/50 hidden md:flex">
              <CalendarDays className="w-4 h-4" />
              Exercício {YEAR}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-b-2 border-blue-500 border-l-2 border-l-transparent animate-spin" />
            <p className="text-muted tracking-widest uppercase text-xs font-bold animate-pulse">Sincronizando Metas...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Global Section */}
            <div className="flex items-center gap-3 mb-2">
              <LayoutGrid className="w-5 h-5 text-muted" />
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted tracking-tight">Visão Consolidada</h2>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {renderTable(globalData, "forecast", "Todos")}
              {renderTable(globalData, "internal", "Todos")}
            </div>

            <div className="w-full h-px border-b border-dashed border-border/60 my-10 relative flex justify-center items-center">
                <button
                  onClick={() => setShowChannels(true)}
                  className="absolute px-6 py-2.5 bg-background shadow-lg shadow-blue-500/5 border border-border/80 rounded-full text-sm font-bold text-foreground hover:bg-muted/30 transition-all flex items-center gap-2 hover:scale-105"
                >
                  <Building className="w-4 h-4 text-blue-500" />
                  Detalhar Canais
                </button>
            </div>

            {showChannels && (
              <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md overflow-y-auto w-full h-full animate-in fade-in zoom-in-95 duration-300">
                <div className="max-w-[1400px] mx-auto px-6 py-12">
                  <div className="flex items-center gap-6 mb-10 pb-6 border-b border-border/50">
                    <button 
                      onClick={() => setShowChannels(false)} 
                      className="p-3 bg-background border border-border rounded-xl hover:bg-muted text-muted hover:text-foreground transition-all shadow-sm"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted tracking-tight">Quebra por Canais</h2>
                      <p className="text-muted text-sm mt-1">Detalhamento individual de Metas e Forecast por canal de venda da rede.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {uniqueChannels.map(channel => {
                      const isExpanded = expandedChannel === channel;
                      const lines = buildJoinedData(channel);
                      const totalMForecast = lines.reduce((a,c) => a + c.forecast, 0);
                      const totalMInternal = lines.reduce((a,c) => a + c.internal, 0);
                      const totalReal = lines.reduce((a,c) => a + c.real, 0);
                      const pctF = totalMForecast > 0 ? (totalReal / totalMForecast)*100 : 0;
                      
                      return (
                        <div key={channel} className="glass-card flex flex-col overflow-hidden border border-border/50 rounded-2xl transition-all duration-300 bg-background/50">
                          <button 
                            onClick={() => setExpandedChannel(isExpanded ? null : channel)}
                            className="px-6 py-5 flex items-center justify-between hover:bg-muted/10 transition-colors"
                          >
                            <div>
                              <h3 className="font-bold text-foreground text-left text-lg leading-tight mb-1">{channel}</h3>
                              <p className="text-xs text-muted text-left font-medium">{formatNumber(totalReal)} un geradas</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-sm font-bold px-3 py-1.5 rounded-md bg-background border border-border shadow-sm ${pctF >= 100 ? 'text-green-500' : 'text-blue-500'}`}>
                                {pctF.toFixed(0)}% <span className="text-[0.60rem] text-muted font-normal uppercase">FCST</span>
                              </span>
                              <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-5 border-t border-border/50 bg-background/80 grid gap-5 grid-cols-1">
                              <div className="text-xs text-muted text-center uppercase tracking-widest font-bold">Gerir Metas da Categoria</div>
                              
                              <div className="h-[400px] overflow-y-auto pr-3 custom-scrollbar space-y-6">
                                  {/* Forecast Table Small */}
                                  <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-sm">
                                    <div className="bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-500 border-b border-border/50 flex items-center gap-2">
                                      <Target className="w-3.5 h-3.5" /> Meta Forecast
                                    </div>
                                    <table className="w-full text-left text-sm">
                                      <tbody>
                                        {lines.map((l) => (
                                          <tr key={l.month} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-2.5 text-muted font-medium text-xs">{l.monthName.substring(0,3)}</td>
                                            <td className="px-2 py-2.5">
                                              <input
                                                type="number"
                                                defaultValue={l.forecast || ""}
                                                placeholder="0"
                                                onBlur={(e) => handleUpdateMeta(l.month, channel, "target_forecast_qty", e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                                className="w-full bg-transparent border-b border-border border-dashed text-right focus:outline-none focus:border-blue-500 focus:text-blue-500 transition-colors py-0.5"
                                              />
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-xs">
                                              {l.real > 0 && l.forecast > 0 ? `${((l.real/l.forecast)*100).toFixed(0)}%` : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Internal Table Small */}
                                  <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-sm">
                                    <div className="bg-violet-500/10 px-4 py-2.5 text-xs font-bold text-violet-500 border-b border-border/50 flex items-center gap-2">
                                      <BarChart className="w-3.5 h-3.5" /> Meta Interna
                                    </div>
                                    <table className="w-full text-left text-sm">
                                      <tbody>
                                        {lines.map((l) => (
                                          <tr key={l.month} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-2.5 text-muted font-medium text-xs">{l.monthName.substring(0,3)}</td>
                                            <td className="px-2 py-2.5">
                                              <input
                                                type="number"
                                                defaultValue={l.internal || ""}
                                                placeholder="0"
                                                onBlur={(e) => handleUpdateMeta(l.month, channel, "target_internal_qty", e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                                className="w-full bg-transparent border-b border-border border-dashed text-right focus:outline-none focus:border-violet-500 focus:text-violet-500 transition-colors py-0.5"
                                              />
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-xs">
                                              {l.real > 0 && l.internal > 0 ? `${((l.real/l.internal)*100).toFixed(0)}%` : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

    </div>
  );
}
