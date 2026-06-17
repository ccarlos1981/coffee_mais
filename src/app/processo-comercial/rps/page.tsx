"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Receipt, 
  Save, 
  Calendar, 
  ChevronRight, 
  Loader2, 
  Building2, 
  Coffee, 
  TrendingUp, 
  CheckCircle2, 
  Home, 
  BarChart3, 
  History, 
  Package, 
  Upload, 
  Users, 
  DollarSign, 
  ChevronDown 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";

interface ClientRow {
  client: string;
  ano_a: number;
  mes_a: number;
  meta: number;
  projections: number[];
}

interface ManagerKPI {
  ano_a: number;
  mes_a: number;
  desafio: number;
  projections: number[];
}

interface ManagerRow {
  manager: string;
  kpis: {
    VOL: ManagerKPI;
    FAT: ManagerKPI;
    INVEST: ManagerKPI;
  };
  clients: ClientRow[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2024, 2025, 2026, 2027];

export default function RpsPage() {
  const router = useRouter();

  // Estados dos filtros
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);

  // Data de hoje no fuso horário do Brasil para desabilitar inputs fora de segundas-feiras
  const todayStr = useMemo(() => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const dVal = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${dVal}`;
  }, []);

  const isTodayMonday = useMemo(() => {
    const parts = todayStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.getDay() === 1; // 1 = Segunda-feira
    }
    return false;
  }, [todayStr]);

  // Estados de dados
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mondays, setMondays] = useState<string[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [businessDays, setBusinessDays] = useState<{ total_days: number; elapsed_days: number } | null>(null);

  // Estados de UI
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({});
  const [focusedInput, setFocusedInput] = useState<{ type: string; mIdx: number; cIdx?: number; kpi?: string; wIdx: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restrictedToManager, setRestrictedToManager] = useState<string | null>(null);

  // Mapeamento estético do nome dos gerentes
  const getManagerDisplayName = (name: string) => {
    if (name === "Julliano") return "Julliano (SPC)";
    if (name === "Leandro") return "Leandro (Sul)";
    if (name === "Luiz") return "Luiz (SU+CO+NE)";
    return name;
  };

  // Formata o rótulo das segundas-feiras (ex: '2026-06-01' -> '01/jun')
  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parts[2];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const allMonthsAbr = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return `${day}/${allMonthsAbr[monthIdx]}`;
  };

  // Percentual do mês transcorrido (dias úteis)
  const timeElapsedPct = useMemo(() => {
    if (!businessDays || !businessDays.total_days) return 0;
    return (businessDays.elapsed_days / businessDays.total_days) * 100;
  }, [businessDays]);

  // Carrega dias úteis do banco de dados
  const loadBusinessDays = useCallback(async (year: number, month: number) => {
    try {
      const { data, error } = await supabase
        .from("business_days")
        .select("total_days, elapsed_days")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      if (!error && data) {
        setBusinessDays(data);
      } else {
        setBusinessDays(null);
      }
    } catch (err) {
      console.error("Erro ao carregar dias úteis:", err);
    }
  }, []);

  // Carrega projeções e históricos via API
  const loadProjectionsData = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/processo-comercial/rps?year=${year}&month=${month}`);
      const json = await res.json();
      if (json.success) {
        setMondays(json.mondays || []);
        setManagers(json.managers || []);
        setRestrictedToManager(json.restrictedToManager || null);
      } else {
        throw new Error(json.error || "Erro desconhecido ao carregar dados.");
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sincronizar dados ao alterar período
  useEffect(() => {
    loadBusinessDays(filterYear, filterMonth);
    loadProjectionsData(filterYear, filterMonth);
  }, [filterYear, filterMonth, loadBusinessDays, loadProjectionsData]);

  // Handler para input de faturamento do cliente
  const handleClientProjChange = (mIdx: number, cIdx: number, wIdx: number, val: number) => {
    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const clients = [...mgr.clients];
      const client = { ...clients[cIdx] };
      const projections = [...client.projections];
      
      // Multiplica por 1000 porque o usuário digita em milhares, mas salvamos o valor absoluto
      projections[wIdx] = val * 1000;
      
      client.projections = projections;
      clients[cIdx] = client;
      mgr.clients = clients;

      // Recalcular o FAT consolidado do gerente para esta semana
      const kpis = { ...mgr.kpis };
      const fatKpi = { ...kpis.FAT };
      const fatProjections = [...fatKpi.projections];
      fatProjections[wIdx] = clients.reduce((acc, c) => acc + c.projections[wIdx], 0);
      fatKpi.projections = fatProjections;
      kpis.FAT = fatKpi;
      mgr.kpis = kpis;

      next[mIdx] = mgr;
      return next;
    });
  };

  // Handler para a meta faturamento do cliente
  const handleClientMetaChange = (mIdx: number, cIdx: number, val: number) => {
    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const clients = [...mgr.clients];
      const client = { ...clients[cIdx] };
      
      // Multiplica por 1000 pois a meta é digitada em milhares
      client.meta = val * 1000;
      
      clients[cIdx] = client;
      mgr.clients = clients;
      next[mIdx] = mgr;
      return next;
    });
  };

  // Handler para inputs de gerentes (VOL e INVEST)
  const handleManagerKpiChange = (mIdx: number, kpi: 'VOL' | 'INVEST', wIdx: number, val: number) => {
    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const kpis = { ...mgr.kpis };
      const kpiData = { ...kpis[kpi] };
      const projections = [...kpiData.projections];
      
      // Armazena raw value (VOL ou percentual de INVEST)
      projections[wIdx] = val;
      
      kpiData.projections = projections;
      kpis[kpi] = kpiData;
      mgr.kpis = kpis;
      next[mIdx] = mgr;
      return next;
    });
  };

  // Alternar visualização dos clientes
  const toggleManagerExpanded = (manager: string) => {
    setExpandedManagers(prev => ({ ...prev, [manager]: !prev[manager] }));
  };

  // Salvar projeções e metas no banco
  const handleSaveProjections = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payloadProjs: any[] = [];

      managers.forEach(mgr => {
        // 1. Projeções de volume (VOL) do gerente
        mgr.kpis.VOL.projections.forEach((val, idx) => {
          payloadProjs.push({
            manager: mgr.manager,
            client_matrix: '_TOTAL_',
            week_start_date: mondays[idx],
            kpi: 'VOL',
            projection_value: val
          });
        });

        // 2. Projeções de investimento (INVEST) do gerente
        mgr.kpis.INVEST.projections.forEach((val, idx) => {
          payloadProjs.push({
            manager: mgr.manager,
            client_matrix: '_TOTAL_',
            week_start_date: mondays[idx],
            kpi: 'INVEST',
            projection_value: val
          });
        });

        // 3. Projeções de faturamento (FAT) do gerente (consolidado salvo para histórico)
        mgr.kpis.FAT.projections.forEach((val, idx) => {
          payloadProjs.push({
            manager: mgr.manager,
            client_matrix: '_TOTAL_',
            week_start_date: mondays[idx],
            kpi: 'FAT',
            projection_value: val
          });
        });

        // 4. Metas e Projeções dos Clientes
        mgr.clients.forEach(cli => {
          // Meta do cliente
          payloadProjs.push({
            manager: mgr.manager,
            client_matrix: cli.client,
            week_start_date: mondays[0], // Meta referenciada na primeira segunda do mês
            kpi: 'META',
            projection_value: cli.meta
          });

          // Projeções semanais de faturamento
          cli.projections.forEach((val, idx) => {
            payloadProjs.push({
              manager: mgr.manager,
              client_matrix: cli.client,
              week_start_date: mondays[idx],
              kpi: 'FAT',
              projection_value: val
            });
          });
        });
      });

      const res = await fetch('/api/processo-comercial/rps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: filterYear,
          month: filterMonth,
          projections: payloadProjs
        })
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Projeções da RPS salvas com sucesso!");
        loadProjectionsData(filterYear, filterMonth);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(json.error || "Erro ao salvar.");
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar projeções: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // --- CÁLCULOS DOS TOTAIS CONSOLIDADOS DO TOTAL BRASIL ---
  const totalsRow = useMemo(() => {
    if (managers.length === 0) return null;

    const kpis = {
      VOL: { ano_a: 0, mes_a: 0, desafio: 0, projections: mondays.map(() => 0) },
      FAT: { ano_a: 0, mes_a: 0, desafio: 0, projections: mondays.map(() => 0) },
      INVEST: { ano_a: 0, mes_a: 0, desafio: 0, projections: mondays.map(() => 0) }
    };

    // Somar VOL e FAT
    managers.forEach(m => {
      kpis.VOL.ano_a += m.kpis.VOL.ano_a;
      kpis.VOL.mes_a += m.kpis.VOL.mes_a;
      kpis.VOL.desafio += m.kpis.VOL.desafio;
      mondays.forEach((_, idx) => {
        kpis.VOL.projections[idx] += m.kpis.VOL.projections[idx];
      });

      kpis.FAT.ano_a += m.kpis.FAT.ano_a;
      kpis.FAT.mes_a += m.kpis.FAT.mes_a;
      kpis.FAT.desafio += m.kpis.FAT.desafio;
      mondays.forEach((_, idx) => {
        kpis.FAT.projections[idx] += m.kpis.FAT.projections[idx];
      });
    });

    // Desafio de investimento consolidado padrão: 10%
    kpis.INVEST.desafio = 10.0;

    // Calcular Investimentos Ponderados: sum(fat * invest_pct) / sum(fat)
    // Para ANO A
    const totalInvestAnoA = managers.reduce((acc, m) => acc + (m.kpis.FAT.ano_a * (m.kpis.INVEST.ano_a / 100)), 0);
    kpis.INVEST.ano_a = kpis.FAT.ano_a > 0 ? (totalInvestAnoA / kpis.FAT.ano_a) * 100 : 10.0;

    // Para MÊS A
    const totalInvestMesA = managers.reduce((acc, m) => acc + (m.kpis.FAT.mes_a * (m.kpis.INVEST.mes_a / 100)), 0);
    kpis.INVEST.mes_a = kpis.FAT.mes_a > 0 ? (totalInvestMesA / kpis.FAT.mes_a) * 100 : 10.0;

    // Para cada semana de projeção
    mondays.forEach((m, idx) => {
      const isFuture = m > todayStr;
      if (isFuture) {
        kpis.INVEST.projections[idx] = 0;
        return;
      }
      const totalFatWeek = kpis.FAT.projections[idx];
      const totalInvestWeek = managers.reduce((acc, m) => acc + (m.kpis.FAT.projections[idx] * (m.kpis.INVEST.projections[idx] / 100)), 0);
      kpis.INVEST.projections[idx] = totalFatWeek > 0 ? (totalInvestWeek / totalFatWeek) * 100 : 10.0;
    });

    return {
      manager: "TOTAL BRASIL CRISTIANO",
      kpis
    };
  }, [managers, mondays]);

  // Helper para obter a última projeção disponível
  const getLatestProjection = (projections: number[]) => {
    // Retorna a projeção mais recente que seja diferente de zero, ou a última
    for (let i = projections.length - 1; i >= 0; i--) {
      if (projections[i] !== 0) return projections[i];
    }
    return projections[projections.length - 1] || 0;
  };

  // Helper de cálculo de porcentagem de atingimento (meta/desafio)
  const calcRatioPct = (current: number, target: number) => {
    if (target <= 0) return 0;
    return (current / target) * 100;
  };

  // Helper de cálculo de variação de crescimento (comparativos AA e MA dos clientes)
  const calcGrowthPct = (current: number, historical: number) => {
    if (historical <= 0) return 0;
    return ((current - historical) / historical) * 100;
  };

  // Estilo de cor para células de porcentagem baseadas nas premissas
  const getPctCellStyle = (kpi: string, pctVal: number, compareVal: number, isClient = false) => {
    if (compareVal <= 0) return { color: "var(--foreground-dim)" };

    if (kpi === "INVEST") {
      // Para investimento: menor ou igual a 100% (ou da referência) é melhor (verde)
      if (pctVal <= 100) {
        return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
      } else {
        return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
      }
    } else {
      // Para volume (VOL) e faturamento (FAT)
      // Se for meta/desafio, compara com a porcentagem de tempo decorrido (timeElapsedPct)
      if (isClient) {
        // Na tabela de clientes: %META é comparada com timeElapsedPct, %AA e %MA são crescimento (verde se >= 0%)
        if (kpi === "META") {
          if (pctVal >= timeElapsedPct) {
            return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
          } else {
            return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
          }
        } else {
          // %AA e %MA de clientes são crescimento
          if (pctVal >= 0) {
            return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
          } else {
            return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
          }
        }
      } else {
        // Na tabela de gerentes: % DESAFIO é comparada com timeElapsedPct
        if (kpi === "DESAFIO") {
          if (pctVal >= timeElapsedPct) {
            return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
          } else {
            return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
          }
        } else {
          // %AA e %MA de gerentes são proporções diretas (verde se >= 100%)
          if (pctVal >= 100) {
            return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
          } else {
            return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      
      {/* Barra de Navegação Superior */}
      <nav className="cm-topnav border-b border-border flex items-center justify-between px-6 h-14 bg-background-navbar sticky top-0 z-50">
        <div className="cm-nav-links flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-1.5 text-foreground-secondary hover:text-foreground transition-colors font-medium text-xs bg-background-elevated/40 border border-border px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <h1 className="text-sm md:text-base font-bold text-foreground tracking-wider uppercase flex items-center justify-center gap-2">
            <Receipt className="w-4 h-4 text-accent-gold" />
            RPS — Reunião de Planejamento Semanal
          </h1>
        </div>
        <div className="cm-nav-right flex items-center gap-4">
          <ThemeToggle />
        </div>
      </nav>

      {/* Corpo da Página: Sidebar + Conteúdo Principal */}
      <div className="dash-body flex-1">
        
        {/* SIDEBAR: Filtros e Controles */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Período</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="relative">
              <select 
                title="Mês" 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(Number(e.target.value))} 
                className="dash-filter-select"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m.slice(0, 3)}</option>)}
              </select>
            </div>
            <div className="relative">
              <select 
                title="Ano" 
                value={filterYear} 
                onChange={(e) => setFilterYear(Number(e.target.value))} 
                className="dash-filter-select"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {businessDays && (
            <div className="sidebar-info-box mb-4">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>Dias Úteis:</span> 
                <strong className="text-foreground">{businessDays.elapsed_days}/{businessDays.total_days}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>Restam:</span> 
                <strong className="text-accent-gold">{Math.max(0, businessDays.total_days - businessDays.elapsed_days)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>Tempo %:</span> 
                <strong className="text-foreground">{formatPercent(timeElapsedPct)}</strong>
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleSaveProjections}
              disabled={saving || loading || managers.length === 0 || !isTodayMonday}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#c8a96e] to-[#a0844f] hover:from-[#d6b97d] hover:to-[#b0935d] disabled:from-gray-700 disabled:to-gray-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Projeções
                </>
              )}
            </button>
            <p className="text-[10px] text-foreground-muted text-center mt-2 leading-tight">
              *As alterações salvam todas as projeções semanais e metas dos clientes exibidos na tela.
            </p>
          </div>
        </aside>

        {/* CONTEÚDO PRINCIPAL: Tabelas */}
        <main className="cm-main">
          
          {/* Mensagens de Feedback */}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold animate-fade-in">
              ✓ {success}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold animate-fade-in">
              ✗ {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-3">
              <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
              <p className="text-foreground-muted text-xs uppercase font-bold tracking-widest animate-pulse">
                Carregando Projeções da RPS...
              </p>
            </div>
          ) : managers.length === 0 ? (
            <div className="text-center py-20 bg-background-card border border-border rounded-xl">
              <Calendar className="w-10 h-10 text-foreground-muted mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">Sem dados disponíveis</h3>
              <p className="text-foreground-muted text-xs mt-1 max-w-sm mx-auto">
                Não há dados de faturamento ou metas cadastradas para o período de {MONTHS[filterMonth - 1]} de {filterYear}.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Tabela de Projeção Consolidada (Gerentes) */}
              <div className="glass-card">
                <div className="p-4 border-b border-border bg-table-header-bg flex justify-between items-center rounded-t-[6px]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-accent-gold">
                    Reunião de RPS com as áreas comerciais
                  </h2>
                  <span className="text-[10px] text-foreground-muted bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono">
                    *Valores Faturamento /1k
                  </span>
                </div>
                
                <div className="overflow-x-auto md:overflow-x-visible">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", textAlign: "left", width: 110 }}>REGIONAL</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 50 }}>KPI</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 75 }} className="col-divider">ANO A</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 75 }}>MÊS A</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 75 }} className="col-divider">DESAFIO</th>
                        <th colSpan={mondays.length} style={{ borderBottom: "2px solid var(--accent-gold)" }}>
                          PROJEÇÃO DE VENDAS PARA O MÊS DE {MONTHS[filterMonth - 1].toUpperCase()}
                        </th>
                        <th colSpan={3} className="col-divider" style={{ borderBottom: "2px solid var(--border-light)" }}>ANÁLISE</th>
                      </tr>
                      <tr>
                        {mondays.map((m, idx) => (
                          <th key={m} style={{ minWidth: 80 }} className={idx === 0 ? "col-divider" : ""}>
                            {formatDateLabel(m)}
                          </th>
                        ))}
                        <th className="col-divider" style={{ width: 70 }}>% DESAFIO</th>
                        <th style={{ width: 70 }}>%AA</th>
                        <th style={{ width: 70 }}>%MA</th>
                      </tr>
                    </thead>
                    
                    {/* Linhas para cada Gerente comercial */}
                    {managers.map((row, mIdx) => {
                        const isExpanded = !!expandedManagers[row.manager];
                        const latestVol = getLatestProjection(row.kpis.VOL.projections);
                        const latestFat = getLatestProjection(row.kpis.FAT.projections);
                        const latestInvest = getLatestProjection(row.kpis.INVEST.projections);

                        const pVolDesafio = calcRatioPct(latestVol, row.kpis.VOL.desafio);
                        const pVolAA = calcRatioPct(latestVol, row.kpis.VOL.ano_a);
                        const pVolMA = calcRatioPct(latestVol, row.kpis.VOL.mes_a);

                        const pFatDesafio = calcRatioPct(latestFat, row.kpis.FAT.desafio);
                        const pFatAA = calcRatioPct(latestFat, row.kpis.FAT.ano_a);
                        const pFatMA = calcRatioPct(latestFat, row.kpis.FAT.mes_a);

                        const pInvestDesafio = calcRatioPct(latestInvest, row.kpis.INVEST.desafio);
                        const pInvestAA = calcRatioPct(latestInvest, row.kpis.INVEST.ano_a);
                        const pInvestMA = calcRatioPct(latestInvest, row.kpis.INVEST.mes_a);

                        return (
                          <tbody key={row.manager}>
                            {/* Linha VOLUME */}
                            <tr>
                              <td rowSpan={3} onClick={() => toggleManagerExpanded(row.manager)} className="cursor-pointer font-bold select-none border-r border-border hover:bg-white/5 manager-border-bottom" style={{ whiteSpace: "normal" }}>
                                <div className="flex items-center gap-1">
                                  <ChevronRight className={`w-4 h-4 text-foreground-muted transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                  <div className="flex flex-col">
                                    <span style={{ fontSize: "0.8rem" }}>{getManagerDisplayName(row.manager)}</span>
                                    <span style={{ fontSize: "0.55rem", fontWeight: "normal" }} className="text-accent-gold underline">
                                      {isExpanded ? "Fechar Clientes" : "Abrir Clientes"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="font-semibold text-xs text-foreground-secondary">VOL</td>
                              <td className="col-divider text-right">{formatNumber(row.kpis.VOL.ano_a, 0)}</td>
                              <td className="text-right">{formatNumber(row.kpis.VOL.mes_a, 0)}</td>
                              <td className="col-divider text-right font-medium">{formatNumber(row.kpis.VOL.desafio, 0)}</td>
                              {mondays.map((m, wIdx) => {
                                const val = row.kpis.VOL.projections[wIdx];
                                const isFuture = m > todayStr;
                                return (
                                  <td key={m} className={wIdx === 0 ? "col-divider" : ""}>
                                    <input
                                      type="number"
                                      value={isFuture ? "" : (val === 0 ? "" : val.toString())}
                                      placeholder="0"
                                      disabled={m !== todayStr}
                                      onFocus={() => setFocusedInput({ type: "manager", mIdx, kpi: "VOL", wIdx })}
                                      onBlur={() => setFocusedInput(null)}
                                      onChange={(e) => {
                                        const num = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                        handleManagerKpiChange(mIdx, "VOL", wIdx, isNaN(num) ? 0 : num);
                                      }}
                                      className="w-full text-right bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:border-accent-gold focus:ring-1 focus:ring-accent-gold disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                );
                              })}
                              <td className="pct-cell col-divider" style={getPctCellStyle("DESAFIO", pVolDesafio, row.kpis.VOL.desafio)}>{row.kpis.VOL.desafio > 0 ? formatNumber(pVolDesafio, 0) + "%" : "-"}</td>
                              <td className="pct-cell" style={getPctCellStyle("AA", pVolAA, row.kpis.VOL.ano_a)}>{row.kpis.VOL.ano_a > 0 ? formatNumber(pVolAA, 0) + "%" : "-"}</td>
                              <td className="pct-cell" style={getPctCellStyle("MA", pVolMA, row.kpis.VOL.mes_a)}>{row.kpis.VOL.mes_a > 0 ? formatNumber(pVolMA, 0) + "%" : "-"}</td>
                            </tr>

                            {/* Linha FATURAMENTO */}
                            <tr>
                              <td className="font-semibold text-xs text-foreground-secondary">FAT</td>
                              <td className="col-divider text-right">{formatCurrency(row.kpis.FAT.ano_a / 1000, 0)}</td>
                              <td className="text-right">{formatCurrency(row.kpis.FAT.mes_a / 1000, 0)}</td>
                              <td className="col-divider text-right font-medium">{formatCurrency(row.kpis.FAT.desafio / 1000, 0)}</td>
                              {mondays.map((m, wIdx) => {
                                const val = row.kpis.FAT.projections[wIdx];
                                return (
                                  <td key={m} className={`text-right font-bold text-foreground bg-white/5 ${wIdx === 0 ? "col-divider" : ""}`}>
                                    {formatCurrency(val / 1000, 0)}
                                  </td>
                                );
                              })}
                              <td className="pct-cell col-divider" style={getPctCellStyle("DESAFIO", pFatDesafio, row.kpis.FAT.desafio)}>{row.kpis.FAT.desafio > 0 ? formatNumber(pFatDesafio, 0) + "%" : "-"}</td>
                              <td className="pct-cell" style={getPctCellStyle("AA", pFatAA, row.kpis.FAT.ano_a)}>{row.kpis.FAT.ano_a > 0 ? formatNumber(pFatAA, 0) + "%" : "-"}</td>
                              <td className="pct-cell" style={getPctCellStyle("MA", pFatMA, row.kpis.FAT.mes_a)}>{row.kpis.FAT.mes_a > 0 ? formatNumber(pFatMA, 0) + "%" : "-"}</td>
                            </tr>

                            {/* Linha INVESTIMENTO */}
                            <tr className="tr-manager-border-bottom">
                              <td className="font-semibold text-xs text-foreground-secondary">INVEST</td>
                              <td className="col-divider text-right text-blue-400 font-mono">{formatNumber(row.kpis.INVEST.ano_a, 1)}%</td>
                              <td className="text-right text-blue-400 font-mono">{formatNumber(row.kpis.INVEST.mes_a, 1)}%</td>
                              <td className="col-divider text-right text-blue-400 font-mono">{formatNumber(row.kpis.INVEST.desafio, 1)}%</td>
                              {mondays.map((m, wIdx) => {
                                const val = row.kpis.INVEST.projections[wIdx];
                                const isFuture = m > todayStr;
                                return (
                                  <td key={m} className={wIdx === 0 ? "col-divider" : ""}>
                                    <div className="flex items-center gap-1 justify-end">
                                      <input
                                        type="number"
                                        value={isFuture ? "" : (val === 0 ? "" : val.toString())}
                                        placeholder="0"
                                        disabled={m !== todayStr}
                                        onFocus={() => setFocusedInput({ type: "manager", mIdx, kpi: "INVEST", wIdx })}
                                        onBlur={() => setFocusedInput(null)}
                                        onChange={(e) => {
                                          const num = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                          handleManagerKpiChange(mIdx, "INVEST", wIdx, isNaN(num) ? 0 : num);
                                        }}
                                        className="w-12 text-right bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:border-accent-gold focus:ring-1 focus:ring-accent-gold disabled:opacity-40 disabled:cursor-not-allowed"
                                      />
                                      <span className="text-[10px] text-foreground-muted">%</span>
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="pct-cell col-divider" style={getPctCellStyle("INVEST", pInvestDesafio, row.kpis.INVEST.desafio)}>{row.kpis.INVEST.desafio > 0 ? formatNumber(pInvestDesafio, 0) + "%" : "-"}</td>
                              <td className="pct-cell" style={getPctCellStyle("INVEST", pInvestAA, row.kpis.INVEST.ano_a)}>{row.kpis.INVEST.ano_a > 0 ? formatNumber(pInvestAA, 0) + "%" : "-"}</td>
                              <td className="pct-cell" style={getPctCellStyle("INVEST", pInvestMA, row.kpis.INVEST.mes_a)}>{row.kpis.INVEST.mes_a > 0 ? formatNumber(pInvestMA, 0) + "%" : "-"}</td>
                            </tr>

                            {/* Clientes vinculados (se expandido) renderizados como linhas normais para alinhamento perfeito */}
                            {isExpanded && row.clients.map((cli, cIdx) => {
                              const latestCliFat = getLatestProjection(cli.projections);
                              const pCliMeta = calcRatioPct(latestCliFat, cli.meta);
                              const pCliAA = calcGrowthPct(latestCliFat, cli.ano_a);
                              const pCliMA = calcGrowthPct(latestCliFat, cli.mes_a);
                              const isLastClient = cIdx === row.clients.length - 1;

                              return (
                                <tr key={cli.client} className={`hover:bg-white/5 bg-background-elevated/5 text-[0.7rem] border-b border-border/40 ${isLastClient ? "tr-manager-border-bottom" : ""}`}>
                                  {/* CLIENTE */}
                                  <td className="pl-6 font-medium text-[0.72rem] text-foreground-secondary border-r border-border hover:text-foreground">
                                    <div className="flex items-center gap-1.5 pl-3">
                                      <Building2 className="w-3 h-3 text-accent-gold/75" />
                                      <span className="truncate max-w-[150px]" title={cli.client}>{cli.client}</span>
                                    </div>
                                  </td>
                                  
                                  {/* KPI */}
                                  <td className="text-[10px] uppercase text-foreground-muted font-bold text-center">Fat</td>
                                  
                                  {/* ANO A */}
                                  <td className="col-divider text-right text-foreground-dim">{formatCurrency(cli.ano_a / 1000, 0)}</td>
                                  
                                  {/* MÊS A */}
                                  <td className="text-right text-foreground-dim">{formatCurrency(cli.mes_a / 1000, 0)}</td>
                                  
                                  {/* META */}
                                  <td className="col-divider text-right">
                                    <input
                                      type="number"
                                      value={cli.meta === 0 ? "" : Math.round(cli.meta / 1000).toString()}
                                      placeholder="0"
                                      disabled={!isTodayMonday}
                                      onFocus={() => setFocusedInput({ type: "client", mIdx, cIdx, kpi: "META", wIdx: 0 })}
                                      onBlur={() => setFocusedInput(null)}
                                      onChange={(e) => {
                                        const num = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                        handleClientMetaChange(mIdx, cIdx, isNaN(num) ? 0 : num);
                                      }}
                                      className="w-full text-right bg-background border border-border/60 rounded px-1.5 py-0.5 text-xs text-foreground focus:border-accent-gold focus:ring-1 focus:ring-accent-gold disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                  
                                  {/* PROJEÇÕES SEMANAIS */}
                                  {mondays.map((m, wIdx) => {
                                    const val = cli.projections[wIdx];
                                    const isFuture = m > todayStr;
                                    return (
                                      <td key={m} className={wIdx === 0 ? "col-divider" : ""}>
                                        <input
                                          type="number"
                                          value={isFuture ? "" : (val === 0 ? "" : Math.round(val / 1000).toString())}
                                          placeholder="0"
                                          disabled={m !== todayStr}
                                          onFocus={() => setFocusedInput({ type: "client", mIdx, cIdx, kpi: "FAT", wIdx })}
                                          onBlur={() => setFocusedInput(null)}
                                          onChange={(e) => {
                                            const num = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                            handleClientProjChange(mIdx, cIdx, wIdx, isNaN(num) ? 0 : num);
                                          }}
                                          className="w-full text-right bg-background border border-border/60 rounded px-1.5 py-0.5 text-xs text-foreground focus:border-accent-gold focus:ring-1 focus:ring-accent-gold disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                      </td>
                                    );
                                  })}
                                  
                                  {/* ANÁLISES */}
                                  <td className="pct-cell col-divider" style={getPctCellStyle("META", pCliMeta, cli.meta, true)}>{cli.meta > 0 ? formatNumber(pCliMeta, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("AA", pCliAA, cli.ano_a, true)}>{cli.ano_a > 0 ? (pCliAA >= 0 ? "+" : "") + formatNumber(pCliAA, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("MA", pCliMA, cli.mes_a, true)}>{cli.mes_a > 0 ? (pCliMA >= 0 ? "+" : "") + formatNumber(pCliMA, 0) + "%" : "-"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        );
                      })}

                      {/* Linha consolidada TOTAL BRASIL */}
                      {totalsRow && !restrictedToManager && (
                        <tbody>
                          {/* Total Volume */}
                          <tr className="row-total">
                            <td rowSpan={3} style={{ verticalAlign: "middle", whiteSpace: "normal", lineHeight: "1.2" }}>
                              TOTAL BRASIL<br />
                              <span className="text-[10px] text-foreground-secondary font-semibold">CRISTIANO</span>
                            </td>
                            <td>VOL</td>
                            <td className="col-divider text-right">{formatNumber(totalsRow.kpis.VOL.ano_a, 0)}</td>
                            <td className="text-right">{formatNumber(totalsRow.kpis.VOL.mes_a, 0)}</td>
                            <td className="col-divider text-right">{formatNumber(totalsRow.kpis.VOL.desafio, 0)}</td>
                            {mondays.map((m, idx) => (
                              <td key={m} className={`text-right ${idx === 0 ? "col-divider" : ""}`}>
                                {formatNumber(totalsRow.kpis.VOL.projections[idx], 0)}
                              </td>
                            ))}
                            {(() => {
                              const latestVol = getLatestProjection(totalsRow.kpis.VOL.projections);
                              const pVolDesafio = calcRatioPct(latestVol, totalsRow.kpis.VOL.desafio);
                              const pVolAA = calcRatioPct(latestVol, totalsRow.kpis.VOL.ano_a);
                              const pVolMA = calcRatioPct(latestVol, totalsRow.kpis.VOL.mes_a);
                              return (
                                <>
                                  <td className="pct-cell col-divider" style={getPctCellStyle("DESAFIO", pVolDesafio, totalsRow.kpis.VOL.desafio)}>{totalsRow.kpis.VOL.desafio > 0 ? formatNumber(pVolDesafio, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("AA", pVolAA, totalsRow.kpis.VOL.ano_a)}>{totalsRow.kpis.VOL.ano_a > 0 ? formatNumber(pVolAA, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("MA", pVolMA, totalsRow.kpis.VOL.mes_a)}>{totalsRow.kpis.VOL.mes_a > 0 ? formatNumber(pVolMA, 0) + "%" : "-"}</td>
                                </>
                              );
                            })()}
                          </tr>

                          {/* Total Faturamento */}
                          <tr className="row-total">
                            <td>FAT</td>
                            <td className="col-divider text-right">{formatCurrency(totalsRow.kpis.FAT.ano_a / 1000, 0)}</td>
                            <td className="text-right">{formatCurrency(totalsRow.kpis.FAT.mes_a / 1000, 0)}</td>
                            <td className="col-divider text-right">{formatCurrency(totalsRow.kpis.FAT.desafio / 1000, 0)}</td>
                            {mondays.map((m, idx) => (
                              <td key={m} className={`text-right ${idx === 0 ? "col-divider" : ""}`}>
                                {formatCurrency(totalsRow.kpis.FAT.projections[idx] / 1000, 0)}
                              </td>
                            ))}
                            {(() => {
                              const latestFat = getLatestProjection(totalsRow.kpis.FAT.projections);
                              const pFatDesafio = calcRatioPct(latestFat, totalsRow.kpis.FAT.desafio);
                              const pFatAA = calcRatioPct(latestFat, totalsRow.kpis.FAT.ano_a);
                              const pFatMA = calcRatioPct(latestFat, totalsRow.kpis.FAT.mes_a);
                              return (
                                <>
                                  <td className="pct-cell col-divider" style={getPctCellStyle("DESAFIO", pFatDesafio, totalsRow.kpis.FAT.desafio)}>{totalsRow.kpis.FAT.desafio > 0 ? formatNumber(pFatDesafio, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("AA", pFatAA, totalsRow.kpis.FAT.ano_a)}>{totalsRow.kpis.FAT.ano_a > 0 ? formatNumber(pFatAA, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("MA", pFatMA, totalsRow.kpis.FAT.mes_a)}>{totalsRow.kpis.FAT.mes_a > 0 ? formatNumber(pFatMA, 0) + "%" : "-"}</td>
                                </>
                              );
                            })()}
                          </tr>

                          {/* Total Investimento */}
                          <tr className="row-total">
                            <td>INVEST</td>
                            <td className="col-divider text-right text-blue-400 font-mono">{formatNumber(totalsRow.kpis.INVEST.ano_a, 1)}%</td>
                            <td className="text-right text-blue-400 font-mono">{formatNumber(totalsRow.kpis.INVEST.mes_a, 1)}%</td>
                            <td className="col-divider text-right text-blue-400 font-mono">{formatNumber(totalsRow.kpis.INVEST.desafio, 1)}%</td>
                            {mondays.map((m, idx) => (
                              <td key={m} className={`text-right text-blue-400 font-mono ${idx === 0 ? "col-divider" : ""}`}>
                                {formatNumber(totalsRow.kpis.INVEST.projections[idx], 1)}%
                              </td>
                            ))}
                            {(() => {
                              const latestInvest = getLatestProjection(totalsRow.kpis.INVEST.projections);
                              const pInvestDesafio = calcRatioPct(latestInvest, totalsRow.kpis.INVEST.desafio);
                              const pInvestAA = calcRatioPct(latestInvest, totalsRow.kpis.INVEST.ano_a);
                              const pInvestMA = calcRatioPct(latestInvest, totalsRow.kpis.INVEST.mes_a);
                              return (
                                <>
                                  <td className="pct-cell col-divider" style={getPctCellStyle("INVEST", pInvestDesafio, totalsRow.kpis.INVEST.desafio)}>{totalsRow.kpis.INVEST.desafio > 0 ? formatNumber(pInvestDesafio, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("INVEST", pInvestAA, totalsRow.kpis.INVEST.ano_a)}>{totalsRow.kpis.INVEST.ano_a > 0 ? formatNumber(pInvestAA, 0) + "%" : "-"}</td>
                                  <td className="pct-cell" style={getPctCellStyle("INVEST", pInvestMA, totalsRow.kpis.INVEST.mes_a)}>{totalsRow.kpis.INVEST.mes_a > 0 ? formatNumber(pInvestMA, 0) + "%" : "-"}</td>
                                </>
                              );
                            })()}
                          </tr>
                        </tbody>
                      )}
                  </table>
                </div>
              </div>

              {/* Botão de salvar no final do grid */}
              <div className="flex justify-end p-4 bg-background-card border border-border rounded-xl shadow-sm">
                <button
                  disabled={saving || loading || managers.length === 0 || !isTodayMonday}
                  onClick={handleSaveProjections}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#c8a96e] to-[#a0844f] hover:from-[#d6b97d] hover:to-[#b0935d] disabled:from-gray-700 disabled:to-gray-700 text-white font-bold uppercase tracking-wider text-xs transition-all shadow-lg disabled:opacity-50 cursor-pointer"
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
        </main>
      </div>

      {/* Menu Inferior (Bottom Nav Bar) - Estilo Power BI */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/tributos" className="bottom-tab"><Receipt className="bottom-tab-icon" /> Tributos</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <Link href="/atendimento" className="bottom-tab"><Users className="bottom-tab-icon" /> Atendimento</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
      
    </div>
  );
}
