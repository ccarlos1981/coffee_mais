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
  ChevronDown,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  AlertTriangle,
  FileText
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { ExecutiveIntelligenceEngine } from "@/lib/governance/rps/executiveIntelligenceEngine";
import { generateExecutivePdf } from "@/lib/reports/rpsExecutivePdf";

interface ClientRow {
  client: string;
  ano_a: number;
  mes_a: number;
  media_trimestre?: number;
  meta: number;
  real: number;
  prev_month_projection?: number;
  projections: number[];
  display_order?: number;
}

interface ManagerKPI {
  ano_a: number;
  mes_a: number;
  media_trimestre?: number;
  desafio: number;
  real: number;
  prev_month_projection?: number;
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

// Helper para obter as segundas-feiras de um mês (formato YYYY-MM-DD)
function getMondaysOfMonth(year: number, month: number): string[] {
  const mondays: string[] = [];
  const date = new Date(Date.UTC(year, month - 1, 1));
  
  // Encontra a primeira segunda-feira
  while (date.getUTCDay() !== 1) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  
  // Coleta todas as segundas-feiras do mês
  while (date.getUTCMonth() === month - 1) {
    mondays.push(date.toISOString().split('T')[0]);
    date.setUTCDate(date.getUTCDate() + 7);
  }
  
  return mondays;
}

export default function RpsPage() {
  const router = useRouter();

  // Estados dos filtros
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);

  // Informações oficiais do servidor (Server Time)
  const [serverTimeInfo, setServerTimeInfo] = useState<{
    todayStr: string;
    hour: number;
    isTodayMonday: boolean;
    isCutoffReached: boolean;
    canManagerEdit: boolean;
  } | null>(null);

  // Data de hoje no fuso horário do Brasil (obtida do Server Time)
  const todayStr = useMemo(() => {
    if (serverTimeInfo?.todayStr) return serverTimeInfo.todayStr;
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
  }, [serverTimeInfo]);

  const isTodayMonday = useMemo(() => {
    if (serverTimeInfo) return serverTimeInfo.isTodayMonday;
    const parts = todayStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.getDay() === 1; // 1 = Segunda-feira
    }
    return false;
  }, [serverTimeInfo, todayStr]);

  // Permissão temporal de edição para Gerentes: Segunda-feira até as 15:00 (Server Time)
  const canManagerEdit = useMemo(() => {
    if (serverTimeInfo) return serverTimeInfo.canManagerEdit;
    return isTodayMonday;
  }, [serverTimeInfo, isTodayMonday]);

  // Obtém a última segunda-feira do mês anterior ao mês atual de hoje
  const lastMondayOfPrevMonth = useMemo(() => {
    const parts = todayStr.split('-');
    if (parts.length === 3) {
      const curYear = Number(parts[0]);
      const curMonth = Number(parts[1]);
      
      const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
      const prevYear = curMonth === 1 ? curYear - 1 : curYear;
      
      const prevMondays = getMondaysOfMonth(prevYear, prevMonth);
      return prevMondays.length > 0 ? prevMondays[prevMondays.length - 1] : "";
    }
    return "";
  }, [todayStr]);

  // Estados de dados
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mondays, setMondays] = useState<string[]>([]);

  // Identifica se a segunda-feira selecionada corresponde à semana corrente
  const isCurrentWeek = useCallback((weekMondayStr: string, idx: number) => {
    if (weekMondayStr === todayStr) return true;
    const nextMonday = mondays[idx + 1];
    if (nextMonday) {
      return todayStr >= weekMondayStr && todayStr < nextMonday;
    } else {
      const parts = weekMondayStr.split('-');
      if (parts.length === 3) {
        const mDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const endDate = new Date(mDate);
        endDate.setDate(mDate.getDate() + 7);
        const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        return todayStr >= weekMondayStr && todayStr < endStr;
      }
      return false;
    }
  }, [todayStr, mondays]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [allAvailableRedes, setAllAvailableRedes] = useState<Array<{ client: string; manager?: string; codigo_matriz?: string; uf?: string }>>([]);
  const [removedNetworks, setRemovedNetworks] = useState<Record<string, string[]>>({});
  const [businessDays, setBusinessDays] = useState<{ total_days: number; elapsed_days: number } | null>(null);

  // Estados de UI
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({});
  const [focusedInput, setFocusedInput] = useState<{ type: string; mIdx: number; cIdx?: number; kpi?: string; wIdx: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restrictedToManager, setRestrictedToManager] = useState<string | null>(null);
  const [isGerenteNacionalAdmin, setIsGerenteNacionalAdmin] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [canViewTotalBrasil, setCanViewTotalBrasil] = useState<boolean>(false);

  // Estados de Modais de Gestão Dinâmica da Carteira (Admin Only)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalManager, setAddModalManager] = useState<string>("");
  const [searchRedeTerm, setSearchRedeTerm] = useState<string>("");
  const [selectedRedeToAdd, setSelectedRedeToAdd] = useState<string>("");
  
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState<boolean>(false);
  const [removeModalTarget, setRemoveModalTarget] = useState<{ mIdx: number; cIdx: number; clientName: string; managerName: string } | null>(null);

  // Mapeamento estético do nome dos gerentes
  const getManagerDisplayName = (name: string) => {
    if (name === "Julliano") return "Julliano (SPC)";
    if (name === "Leandro") return "Leandro (Sul)";
    if (name === "Luiz") return "Luiz (Nordeste/Sudeste)";
    if (name === "John Guedes") return "John Guedes (CO+NO)";
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

  // Carrega projeções e históricos via API (Single Source of Truth para dados e permissões)
  const loadProjectionsData = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/processo-comercial/rps?year=${year}&month=${month}`);
      const json = await res.json();
      if (json.success) {
        setMondays(json.mondays || []);
        setManagers(json.managers || []);
        setAllAvailableRedes(json.allAvailableRedes || []);
        setRemovedNetworks({});
        setRestrictedToManager(json.restrictedToManager || null);
        setIsGerenteNacionalAdmin(Boolean(json.isGerenteNacionalAdmin));
        setIsAdmin(Boolean(json.isAdmin));
        setCanViewTotalBrasil(Boolean(json.canViewTotalBrasil));
        if (json.serverTime) setServerTimeInfo(json.serverTime);
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

  // Handler para inputs de gerentes (VOL, FAT e INVEST)
  const handleManagerKpiChange = (mIdx: number, kpi: 'VOL' | 'FAT' | 'INVEST', wIdx: number, val: number) => {
    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const kpis = { ...mgr.kpis };
      const kpiData = { ...kpis[kpi] };
      const projections = [...kpiData.projections];
      
      // Armazena raw value (VOL, FAT absoluto ou percentual de INVEST)
      projections[wIdx] = val;
      
      kpiData.projections = projections;
      kpis[kpi] = kpiData;
      mgr.kpis = kpis;
      next[mIdx] = mgr;
      return next;
    });
  };

  // Handler para alteração do Desafio do Gerente (Modo Administrativo)
  const handleManagerDesafioChange = (mIdx: number, kpi: 'VOL' | 'FAT' | 'INVEST', val: number) => {
    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const kpis = { ...mgr.kpis };
      const kpiData = { ...kpis[kpi] };
      
      // FAT desafio é digitado em milhares (x1000)
      kpiData.desafio = kpi === 'FAT' ? val * 1000 : val;
      
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

  // --- REORDENAÇÃO E REMOÇÃO DINÂMICA DE REDES (ADMIN ONLY) ---
  const handleMoveNetworkUp = (mIdx: number, cIdx: number) => {
    if (cIdx <= 0) return;
    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const clients = [...mgr.clients];
      
      const temp = clients[cIdx];
      clients[cIdx] = clients[cIdx - 1];
      clients[cIdx - 1] = temp;

      mgr.clients = clients;
      next[mIdx] = mgr;
      return next;
    });
  };

  const handleMoveNetworkDown = (mIdx: number, cIdx: number) => {
    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const clients = [...mgr.clients];
      
      if (cIdx >= clients.length - 2) return next; // preserva OUTROS na última posição
      
      const temp = clients[cIdx];
      clients[cIdx] = clients[cIdx + 1];
      clients[cIdx + 1] = temp;

      mgr.clients = clients;
      next[mIdx] = mgr;
      return next;
    });
  };

  const openRemoveModal = (mIdx: number, cIdx: number, clientName: string, managerName: string) => {
    setRemoveModalTarget({ mIdx, cIdx, clientName, managerName });
    setIsRemoveModalOpen(true);
  };

  const confirmRemoveNetwork = () => {
    if (!removeModalTarget) return;
    const { mIdx, cIdx, clientName, managerName } = removeModalTarget;

    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const clients = [...mgr.clients];
      clients.splice(cIdx, 1);
      mgr.clients = clients;
      next[mIdx] = mgr;
      return next;
    });

    setRemovedNetworks(prev => {
      const current = prev[managerName] || [];
      if (!current.includes(clientName)) {
        return { ...prev, [managerName]: [...current, clientName] };
      }
      return prev;
    });

    setIsRemoveModalOpen(false);
    setRemoveModalTarget(null);
  };

  const confirmAddNetwork = () => {
    if (!selectedRedeToAdd || !addModalManager) return;

    const mIdx = managers.findIndex(m => m.manager === addModalManager);
    if (mIdx === -1) return;

    const existingIndex = managers[mIdx].clients.findIndex(
      c => c.client.trim().toUpperCase() === selectedRedeToAdd.trim().toUpperCase()
    );
    if (existingIndex !== -1) {
      setError(`A rede "${selectedRedeToAdd}" já faz parte do planejamento deste gerente.`);
      setIsAddModalOpen(false);
      return;
    }

    setRemovedNetworks(prev => {
      const current = prev[addModalManager] || [];
      return { 
        ...prev, 
        [addModalManager]: current.filter(r => r.trim().toUpperCase() !== selectedRedeToAdd.trim().toUpperCase()) 
      };
    });

    const newClientRow: ClientRow = {
      client: selectedRedeToAdd,
      ano_a: 0,
      mes_a: 0,
      meta: 0,
      real: 0,
      prev_month_projection: 0,
      projections: mondays.map(() => 0)
    };

    setManagers(prev => {
      const next = [...prev];
      const mgr = { ...next[mIdx] };
      const clients = [...mgr.clients];
      
      const outrosIdx = clients.findIndex(c => c.client === "OUTROS");
      if (outrosIdx !== -1) {
        clients.splice(outrosIdx, 0, newClientRow);
      } else {
        clients.push(newClientRow);
      }

      mgr.clients = clients;
      next[mIdx] = mgr;
      return next;
    });

    setIsAddModalOpen(false);
    setSelectedRedeToAdd("");
    setSearchRedeTerm("");
  };

  const filteredAvailableRedes = useMemo(() => {
    if (!searchRedeTerm) return allAvailableRedes.slice(0, 30);
    const term = searchRedeTerm.toLowerCase().trim();
    return allAvailableRedes.filter(r => 
      (r.client && r.client.toLowerCase().includes(term)) ||
      (r.codigo_matriz && r.codigo_matriz.toLowerCase().includes(term)) ||
      (r.manager && r.manager.toLowerCase().includes(term)) ||
      (r.uf && r.uf.toLowerCase().includes(term))
    ).slice(0, 50);
  }, [allAvailableRedes, searchRedeTerm]);

  // Salvar projeções, metas e carteira dinâmica no banco
  const handleSaveProjections = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payloadProjs: any[] = [];

      managers.forEach(mgr => {
        // 0. Metas (Desafios) do gerente
        payloadProjs.push({
          manager: mgr.manager,
          client_matrix: '_TOTAL_',
          week_start_date: mondays[0],
          kpi: 'DESAFIO_VOL',
          projection_value: mgr.kpis.VOL.desafio
        });

        payloadProjs.push({
          manager: mgr.manager,
          client_matrix: '_TOTAL_',
          week_start_date: mondays[0],
          kpi: 'DESAFIO_FAT',
          projection_value: mgr.kpis.FAT.desafio
        });

        payloadProjs.push({
          manager: mgr.manager,
          client_matrix: '_TOTAL_',
          week_start_date: mondays[0],
          kpi: 'DESAFIO_INVEST',
          projection_value: mgr.kpis.INVEST.desafio
        });

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
          // Meta do cliente (incluída no payload apenas se o usuário for Admin / Admin Master)
          if (isAdmin) {
            payloadProjs.push({
              manager: mgr.manager,
              client_matrix: cli.client,
              week_start_date: mondays[0],
              kpi: 'META',
              projection_value: cli.meta
            });
          }

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

      // Garantia defensiva: se o usuário não for Admin ou Admin Master, expurgar qualquer item META antes do envio
      const finalProjections = isAdmin
        ? payloadProjs
        : payloadProjs.filter((p: any) => p.kpi !== 'META');

      // Montar payload da Carteira Dinâmica de Planejamento (Exclusivo Admin)
      const customCarteiraPayload: any[] = [];
      if (isAdmin) {
        managers.forEach(mgr => {
          mgr.clients.forEach((cli, idx) => {
            if (cli.client !== 'OUTROS') {
              customCarteiraPayload.push({
                manager: mgr.manager,
                client_matrix: cli.client,
                display_order: idx,
                is_excluded: false
              });
            }
          });

          // Incluir redes excluídas pelo admin nesta sprint
          const removed = removedNetworks[mgr.manager] || [];
          removed.forEach(rName => {
            if (rName !== 'OUTROS') {
              customCarteiraPayload.push({
                manager: mgr.manager,
                client_matrix: rName,
                display_order: 999999,
                is_excluded: true
              });
            }
          });
        });
      }

      const res = await fetch('/api/processo-comercial/rps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: filterYear,
          month: filterMonth,
          projections: finalProjections,
          customCarteira: isAdmin ? customCarteiraPayload : undefined
        })
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Projeções e Carteira de Planejamento salvas com sucesso!");
        loadProjectionsData(filterYear, filterMonth);
        setTimeout(() => setSuccess(null), 3500);
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

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleGenerateExecutiveReport = () => {
    try {
      setGeneratingPdf(true);
      setError(null);
      
      const reportData = ExecutiveIntelligenceEngine.generateReport(
        managers,
        totalsRow,
        mondays,
        filterMonth,
        filterYear,
        null
      );
      
      generateExecutivePdf(reportData);
      setSuccess("Relatório Executivo Inteligente (Visão CEO) gerado com sucesso!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("Erro ao gerar PDF Executivo:", err);
      setError(err?.message || "Falha ao gerar o Relatório Executivo.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // --- CÁLCULOS DOS TOTAIS CONSOLIDADOS DO TOTAL BRASIL ---
  const totalsRow = useMemo(() => {
    if (managers.length === 0) return null;

    const kpis: any = {
      VOL: { ano_a: 0, mes_a: 0, media_trimestre: 0, desafio: 0, real: 0, prev_month_projection: 0, projections: mondays.map(() => 0) },
      FAT: { ano_a: 0, mes_a: 0, media_trimestre: 0, desafio: 0, real: 0, prev_month_projection: 0, projections: mondays.map(() => 0) },
      INVEST: { ano_a: 0, mes_a: 0, media_trimestre: 0, desafio: 0, real: 0, prev_month_projection: 0, projections: mondays.map(() => 0) }
    };

    // Somar VOL e FAT
    managers.forEach(m => {
      kpis.VOL.ano_a += m.kpis.VOL.ano_a;
      kpis.VOL.mes_a += m.kpis.VOL.mes_a;
      kpis.VOL.media_trimestre += m.kpis.VOL.media_trimestre || 0;
      kpis.VOL.desafio += m.kpis.VOL.desafio;
      kpis.VOL.real += m.kpis.VOL.real;
      kpis.VOL.prev_month_projection += m.kpis.VOL.prev_month_projection || 0;
      mondays.forEach((_, idx) => {
        kpis.VOL.projections[idx] += m.kpis.VOL.projections[idx];
      });

      kpis.FAT.ano_a += m.kpis.FAT.ano_a;
      kpis.FAT.mes_a += m.kpis.FAT.mes_a;
      kpis.FAT.media_trimestre += m.kpis.FAT.media_trimestre || 0;
      kpis.FAT.desafio += m.kpis.FAT.desafio;
      kpis.FAT.real += m.kpis.FAT.real;
      kpis.FAT.prev_month_projection += m.kpis.FAT.prev_month_projection || 0;
      mondays.forEach((_, idx) => {
        kpis.FAT.projections[idx] += m.kpis.FAT.projections[idx];
      });
    });

    // Desafio de investimento consolidado padrão: 10%
    kpis.INVEST.desafio = 10.0;

    // Calcular Investimentos Ponderados: sum(fat * invest_pct) / sum(fat)
    const totalInvestAnoA = managers.reduce((acc, m) => acc + (m.kpis.FAT.ano_a * (m.kpis.INVEST.ano_a / 100)), 0);
    kpis.INVEST.ano_a = kpis.FAT.ano_a > 0 ? (totalInvestAnoA / kpis.FAT.ano_a) * 100 : 10.0;

    const totalInvestMesA = managers.reduce((acc, m) => acc + (m.kpis.FAT.mes_a * (m.kpis.INVEST.mes_a / 100)), 0);
    kpis.INVEST.mes_a = kpis.FAT.mes_a > 0 ? (totalInvestMesA / kpis.FAT.mes_a) * 100 : 10.0;

    const totalInvestMediaTrimestre = managers.reduce((acc, m) => acc + ((m.kpis.FAT.media_trimestre || 0) * ((m.kpis.INVEST.media_trimestre || 0) / 100)), 0);
    kpis.INVEST.media_trimestre = kpis.FAT.media_trimestre > 0 ? (totalInvestMediaTrimestre / kpis.FAT.media_trimestre) * 100 : 10.0;

    const totalInvestReal = managers.reduce((acc, m) => acc + (m.kpis.FAT.real * (m.kpis.INVEST.real / 100)), 0);
    kpis.INVEST.real = kpis.FAT.real > 0 ? (totalInvestReal / kpis.FAT.real) * 100 : 10.0;

    const totalInvestPrevMonth = managers.reduce((acc, m) => acc + (m.kpis.FAT.mes_a * ((m.kpis.INVEST.prev_month_projection || 0) / 100)), 0);
    kpis.INVEST.prev_month_projection = kpis.FAT.mes_a > 0 ? (totalInvestPrevMonth / kpis.FAT.mes_a) * 100 : 10.0;

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
  }, [managers, mondays, todayStr]);

  // Helper para obter a última projeção disponível
  const getLatestProjection = (projections: number[]) => {
    for (let i = projections.length - 1; i >= 0; i--) {
      if (projections[i] !== 0) return projections[i];
    }
    return projections[projections.length - 1] || 0;
  };

  // Helper oficial de cálculo de variação analítica da RPS: (Valor Comparado / Valor Base - 1) * 100
  const calcGrowthPct = (compared: number, base: number) => {
    if (!base || base <= 0) return 0;
    return ((compared / base) - 1) * 100;
  };

  const calcRatioPct = calcGrowthPct;
  const calcDispersionPct = calcGrowthPct;

  // Estilo de cor para células de porcentagem
  const getPctCellStyle = (kpi: string, pctVal: number, compareVal: number, isClient = false) => {
    if (!compareVal || compareVal <= 0) return { color: "var(--foreground-dim)" };

    if (kpi === "DISPERSAO") {
      // Faixa verde oficial de acurácia de dispersão: -3.0% a +5.0%
      if (pctVal >= -3 && pctVal <= 5) {
        return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
      } else {
        return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
      }
    }

    if (kpi === "INVEST") {
      if (pctVal <= 0) {
        return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
      } else {
        return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
      }
    } else {
      if (pctVal >= 0) {
        return { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "var(--success)", fontWeight: 700 };
      } else {
        return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 700 };
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      
      {/* Barra de Navegação Superior (Estática) */}
      <nav className="cm-topnav border-b border-border flex items-center justify-between px-6 h-12 bg-background-navbar">
        <div className="cm-nav-links flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-1.5 text-foreground-secondary hover:text-foreground transition-colors font-medium text-xs bg-background-elevated/40 border border-border px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
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
              disabled={saving || loading || managers.length === 0 || (!isGerenteNacionalAdmin && !canManagerEdit)}
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
            {(isAdmin || isGerenteNacionalAdmin) && (
              <button
                onClick={handleGenerateExecutiveReport}
                disabled={generatingPdf || loading || managers.length === 0}
                className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                title="Gerar Relatório Executivo Inteligente (PDF Visão CEO)"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-amber-300" />
                    📊 Visão CEO (PDF Executivo)
                  </>
                )}
              </button>
            )}
            <p className="text-[10px] text-foreground-muted text-center mt-2 leading-tight">
              *As alterações salvam todas as projeções semanais, metas e carteira de planejamento exibidas na tela.
            </p>
          </div>
        </aside>

        {/* CONTEÚDO PRINCIPAL: Tabelas */}
        <main className="cm-main">
          
          {/* Cabeçalho da Página */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg md:text-xl font-bold text-foreground tracking-wide flex items-center gap-2">
                <Receipt className="w-5 h-5 text-accent-gold" />
                RPS — Reunião de Planejamento Semanal
              </h1>
              <p className="text-xs text-foreground-muted">
                Reunião de RPS com as áreas comerciais & Gestão Dinâmica da Carteira
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {(isAdmin || isGerenteNacionalAdmin) && (
                <button
                  onClick={handleGenerateExecutiveReport}
                  disabled={generatingPdf || loading || managers.length === 0}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
                  title="Gerar Relatório Executivo Inteligente (PDF Visão CEO)"
                >
                  {generatingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-amber-200" />
                      📊 Visão CEO (PDF Executivo)
                    </>
                  )}
                </button>
              )}
              {isAdmin && (
                <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-lg text-emerald-400 text-xs font-bold tracking-wider uppercase shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  Gestão Dinâmica de Carteira Ativa (Admin)
                </div>
              )}
              {isGerenteNacionalAdmin && !isAdmin && (
                <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-lg text-amber-400 text-xs font-bold tracking-wider uppercase shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  Modo Administrativo (Gerente Nacional)
                </div>
              )}
              <span className="text-[11px] text-foreground-muted bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 font-mono">
                *Valores (VOL e FAT) /1k
              </span>
            </div>
          </div>

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
              <div className="glass-card rps-card">
                <div className="overflow-x-auto md:overflow-x-visible">
                  <table className="data-table rps-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", textAlign: "left", width: 110 }}>REGIONAL</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 50 }}>KPI</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 75 }} className="col-divider border-r-0">ANO A</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 75 }} className="border-r-0">MÊS A</th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 85 }} className="bg-amber-500/15 text-amber-300 font-extrabold border-l-2 border-r-2 border-amber-500/80 shadow-xs py-1">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span>DESAFIO</span>
                            <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 rounded-full font-black tracking-tighter uppercase shadow-xs">
                              Meta
                            </span>
                          </div>
                        </th>
                        <th rowSpan={2} style={{ verticalAlign: "bottom", width: 75 }} className="border-l-0">REAL</th>
                        <th colSpan={mondays.length} style={{ borderBottom: "2px solid var(--accent-gold)" }}>
                          PROJEÇÃO DE VENDAS PARA O MÊS DE {MONTHS[filterMonth - 1].toUpperCase()}
                        </th>
                        <th colSpan={4} className="border-l-0" style={{ borderBottom: "2px solid var(--border-light)" }}>ANÁLISE</th>
                      </tr>
                      <tr>
                        {mondays.map((m, idx) => {
                          const isCurrent = isCurrentWeek(m, idx);
                          return (
                            <th
                              key={m}
                              style={{ minWidth: 85 }}
                              className={`transition-colors ${isCurrent ? "bg-amber-500/15 text-amber-300 font-black border-l-2 border-r-2 border-amber-500/80 shadow-sm" : (idx === 0 ? "col-divider" : "")}`}
                            >
                              <div className="flex flex-col items-center justify-center gap-0.5 py-0.5">
                                <span>{formatDateLabel(m)}</span>
                                {isCurrent && (
                                  <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 rounded-full font-black tracking-tighter uppercase shadow-xs">
                                    Atual
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="border-l-0" style={{ width: 70 }}>% Disp</th>
                        <th style={{ width: 70 }}>% DESAFIO</th>
                        <th style={{ width: 70 }}>%AA</th>
                        <th style={{ width: 70 }}>%M. Trim</th>
                      </tr>
                    </thead>
                    
                    {/* Linhas para cada Gerente comercial */}
                    {managers.map((row, mIdx) => {
                      const isExpanded = !!expandedManagers[row.manager];
                      const totalRowsCount = 3 + (isExpanded ? row.clients.length : 0);

                      // KPIs Padrão (Fórmulas Oficiais da Análise)
                      const volDisp = calcDispersionPct(row.kpis.VOL.mes_a, row.kpis.VOL.prev_month_projection || 0);
                      const volDesafio = calcRatioPct(getLatestProjection(row.kpis.VOL.projections), row.kpis.VOL.desafio);
                      const volAA = calcRatioPct(getLatestProjection(row.kpis.VOL.projections), row.kpis.VOL.ano_a);
                      const volMT = calcRatioPct(getLatestProjection(row.kpis.VOL.projections), row.kpis.VOL.media_trimestre || 0);

                      const fatDisp = calcDispersionPct(row.kpis.FAT.mes_a, row.kpis.FAT.prev_month_projection || 0);
                      const fatDesafio = calcRatioPct(getLatestProjection(row.kpis.FAT.projections), row.kpis.FAT.desafio);
                      const fatAA = calcRatioPct(getLatestProjection(row.kpis.FAT.projections), row.kpis.FAT.ano_a);
                      const fatMT = calcRatioPct(getLatestProjection(row.kpis.FAT.projections), row.kpis.FAT.media_trimestre || 0);

                      const investDisp = calcDispersionPct(row.kpis.INVEST.mes_a, row.kpis.INVEST.prev_month_projection || 0);
                      const investDesafio = calcRatioPct(getLatestProjection(row.kpis.INVEST.projections), row.kpis.INVEST.desafio);

                      return (
                        <tbody key={row.manager} className="group/manager">
                          
                          {/* LINHA 1: VOL (Topo do Bloco do Gerente com Moldura Dourada) */}
                          <tr className="bg-background-card/70 hover:bg-background-card transition-colors border-t-2 border-accent-gold/70">
                            <td rowSpan={3} className="font-bold text-foreground align-middle text-left pl-4 pr-3 py-3.5 bg-background-elevated/70 border-l-2 border-t-2 border-b-2 border-accent-gold/70 shadow-sm">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-sm font-extrabold text-foreground">{getManagerDisplayName(row.manager)}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleManagerExpanded(row.manager)}
                                    className="text-[11px] text-accent-gold hover:underline font-semibold cursor-pointer text-left"
                                  >
                                    {isExpanded ? "Fechar Clientes" : "Abrir Clientes"}
                                  </button>

                                  {/* Botão "+" Admin Only para Gestão Dinâmica de Carteira */}
                                  {isAdmin && isExpanded && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddModalManager(row.manager);
                                        setSearchRedeTerm("");
                                        setSelectedRedeToAdd("");
                                        setIsAddModalOpen(true);
                                      }}
                                      className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold transition-all border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                                      title="Adicionar Rede no Planejamento"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span className="text-[10px]">Adicionar</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="font-bold text-foreground py-2.5">VOL</td>
                            <td className="col-divider text-foreground-muted font-mono py-2.5">{formatNumber(row.kpis.VOL.ano_a / 1000, 1)}</td>
                            <td className="text-foreground-muted font-mono py-2.5 border-r-0">{formatNumber(row.kpis.VOL.mes_a / 1000, 1)}</td>

                            {/* Célula DESAFIO VOL (Moldura Simétrica 2px) */}
                            <td className="font-mono font-bold bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 text-amber-300 py-2.5">
                              {isAdmin ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={row.kpis.VOL.desafio ? (row.kpis.VOL.desafio / 1000).toFixed(1) : ""}
                                  onChange={(e) => handleManagerDesafioChange(mIdx, 'VOL', parseFloat(e.target.value) || 0)}
                                  className="w-16 px-1.5 py-0.5 text-center bg-amber-500/20 border border-amber-500/50 rounded text-amber-300 font-extrabold text-xs shadow-inner"
                                />
                              ) : (
                                formatNumber(row.kpis.VOL.desafio / 1000, 1)
                              )}
                            </td>

                            <td className="font-mono font-bold text-foreground py-2.5 border-l-0">{formatNumber(row.kpis.VOL.real / 1000, 1)}</td>

                            {/* Projeções Semanais VOL (Com destaque da Semana Corrente Simétrico) */}
                            {mondays.map((m, wIdx) => {
                              const isEditable = isGerenteNacionalAdmin || (canManagerEdit && m === todayStr);
                              const isCurrent = isCurrentWeek(m, wIdx);
                              const rawVal = row.kpis.VOL.projections[wIdx] ? (row.kpis.VOL.projections[wIdx] / 1000).toFixed(1) : "";
                              return (
                                <td key={m} className={`p-1 py-2.5 ${wIdx === 0 ? "col-divider" : ""} ${isCurrent ? "bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80" : ""}`}>
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!isEditable}
                                    value={rawVal}
                                    placeholder="0,0"
                                    onChange={(e) => handleManagerKpiChange(mIdx, 'VOL', wIdx, (parseFloat(e.target.value) || 0) * 1000)}
                                    className={`w-full text-center py-1 px-1 rounded text-xs font-mono font-bold transition-all ${
                                      isCurrent
                                        ? "border-2 border-amber-500/60 bg-amber-500/20 text-amber-200 font-black shadow-sm focus:border-amber-400 focus:outline-none disabled:opacity-60"
                                        : "border border-border/40 bg-background-elevated text-foreground focus:border-accent-gold focus:outline-none disabled:opacity-60"
                                    }`}
                                  />
                                </td>
                              );
                            })}

                            <td className="font-mono py-2.5 border-l-0" style={getPctCellStyle("DISPERSAO", volDisp, row.kpis.VOL.prev_month_projection || 0)}>{formatPercent(volDisp)}</td>
                            <td className="font-mono py-2.5" style={getPctCellStyle("DESAFIO", volDesafio, row.kpis.VOL.desafio)}>{formatPercent(volDesafio)}</td>
                            <td className="font-mono py-2.5" style={getPctCellStyle("AA", volAA, row.kpis.VOL.ano_a)}>{formatPercent(volAA)}</td>
                            <td className="font-mono py-2.5 border-r-2 border-accent-gold/70" style={getPctCellStyle("MT", volMT, row.kpis.VOL.media_trimestre || 0)}>{formatPercent(volMT)}</td>
                          </tr>

                          {/* LINHA 2: FAT (Meio do Bloco do Gerente) */}
                          <tr className="bg-background-card/50 hover:bg-background-card transition-colors">
                            <td className="font-bold text-foreground py-2.5">FAT</td>
                            <td className="col-divider text-foreground-muted font-mono">{formatCurrency(row.kpis.FAT.ano_a / 1000, 0)}</td>
                            <td className="text-foreground-muted font-mono border-r-0">{formatCurrency(row.kpis.FAT.mes_a / 1000, 0)}</td>

                            {/* Célula DESAFIO FAT (Moldura Simétrica 2px) */}
                            <td className="font-mono font-bold bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 text-amber-300 py-2.5">
                              {isAdmin ? (
                                <input
                                  type="number"
                                  step="1"
                                  value={row.kpis.FAT.desafio ? Math.round(row.kpis.FAT.desafio / 1000) : ""}
                                  onChange={(e) => handleManagerDesafioChange(mIdx, 'FAT', parseFloat(e.target.value) || 0)}
                                  className="w-16 px-1.5 py-0.5 text-center bg-amber-500/20 border border-amber-500/50 rounded text-amber-300 font-extrabold text-xs shadow-inner"
                                />
                              ) : (
                                formatCurrency(row.kpis.FAT.desafio / 1000, 0)
                              )}
                            </td>

                            <td className="font-mono font-bold text-foreground py-2.5 border-l-0">{formatCurrency(row.kpis.FAT.real / 1000, 0)}</td>

                            {/* Projeções Semanais FAT */}
                            {mondays.map((m, wIdx) => {
                              const isEditable = isGerenteNacionalAdmin || (canManagerEdit && m === todayStr);
                              const isCurrent = isCurrentWeek(m, wIdx);
                              const rawVal = row.kpis.FAT.projections[wIdx] ? Math.round(row.kpis.FAT.projections[wIdx] / 1000) : "";
                              return (
                                <td key={m} className={`p-1 ${wIdx === 0 ? "col-divider" : ""} ${isCurrent ? "bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80" : ""}`}>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={!isEditable}
                                    value={rawVal}
                                    placeholder="0"
                                    onChange={(e) => handleManagerKpiChange(mIdx, 'FAT', wIdx, (parseFloat(e.target.value) || 0) * 1000)}
                                    className={`w-full text-center py-1 px-1 rounded text-xs font-mono font-bold transition-all ${
                                      isCurrent
                                        ? "border-2 border-amber-500/60 bg-amber-500/20 text-amber-200 font-black shadow-sm focus:border-amber-400 focus:outline-none disabled:opacity-60"
                                        : "border border-border/40 bg-background-elevated text-foreground focus:border-accent-gold focus:outline-none disabled:opacity-60"
                                    }`}
                                  />
                                </td>
                              );
                            })}

                            <td className="font-mono py-2.5 border-l-0" style={getPctCellStyle("DISPERSAO", fatDisp, row.kpis.FAT.prev_month_projection || 0)}>{formatPercent(fatDisp)}</td>
                            <td className="font-mono py-2.5" style={getPctCellStyle("DESAFIO", fatDesafio, row.kpis.FAT.desafio)}>{formatPercent(fatDesafio)}</td>
                            <td className="font-mono py-2.5" style={getPctCellStyle("AA", fatAA, row.kpis.FAT.ano_a)}>{formatPercent(fatAA)}</td>
                            <td className="font-mono py-2.5 border-r-2 border-accent-gold/70" style={getPctCellStyle("MT", fatMT, row.kpis.FAT.media_trimestre || 0)}>{formatPercent(fatMT)}</td>
                          </tr>

                          {/* LINHA 3: INVEST (Fim do Bloco Resumo do Gerente) */}
                          <tr className="bg-background-card/50 hover:bg-background-card transition-colors border-b-2 border-accent-gold/80">
                            <td className="font-bold text-foreground py-2.5">INVEST</td>
                            <td className="col-divider text-foreground-muted font-mono">{formatPercent(row.kpis.INVEST.ano_a)}</td>
                            <td className="text-foreground-muted font-mono border-r-0">{formatPercent(row.kpis.INVEST.mes_a)}</td>

                            {/* Célula DESAFIO INVEST (Moldura Simétrica 2px) */}
                            <td className="font-mono font-bold bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 text-amber-300 py-2.5">
                              {isAdmin ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={row.kpis.INVEST.desafio ? Number(row.kpis.INVEST.desafio).toFixed(1) : ""}
                                  onChange={(e) => handleManagerDesafioChange(mIdx, 'INVEST', parseFloat(e.target.value) || 0)}
                                  className="w-14 px-1 py-0.5 text-center bg-amber-500/20 border border-amber-500/50 rounded text-amber-300 font-extrabold text-xs shadow-inner"
                                />
                              ) : (
                                formatPercent(row.kpis.INVEST.desafio)
                              )}
                            </td>

                            <td className="font-mono font-bold text-foreground py-2.5 border-l-0">{formatPercent(row.kpis.INVEST.real)}</td>

                            {/* Projeções Semanais INVEST */}
                            {mondays.map((m, wIdx) => {
                              const isEditable = isGerenteNacionalAdmin || (canManagerEdit && m === todayStr);
                              const isCurrent = isCurrentWeek(m, wIdx);
                              const rawVal = row.kpis.INVEST.projections[wIdx] != null && row.kpis.INVEST.projections[wIdx] !== 0 ? Number(row.kpis.INVEST.projections[wIdx]).toFixed(1) : "";
                              return (
                                <td key={m} className={`p-1 ${wIdx === 0 ? "col-divider" : ""} ${isCurrent ? "bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80" : ""}`}>
                                  <div className="flex items-center justify-center gap-0.5">
                                    <input
                                      type="number"
                                      step="0.1"
                                      disabled={!isEditable}
                                      value={rawVal}
                                      placeholder="0.0"
                                      onChange={(e) => handleManagerKpiChange(mIdx, 'INVEST', wIdx, parseFloat(e.target.value) || 0)}
                                      className={`w-full text-center py-1 px-1 rounded text-xs font-mono font-bold transition-all ${
                                        isCurrent
                                          ? "border-2 border-amber-500/60 bg-amber-500/20 text-amber-200 font-black shadow-sm focus:border-amber-400 focus:outline-none"
                                          : "border border-border/40 bg-background-elevated text-foreground focus:border-accent-gold focus:outline-none disabled:opacity-60"
                                      }`}
                                    />
                                    <span className="text-[10px] text-foreground-muted">%</span>
                                  </div>
                                </td>
                              );
                            })}

                            <td className="font-mono py-2.5 border-l-0" style={getPctCellStyle("DISPERSAO", investDisp, row.kpis.INVEST.prev_month_projection || 0)}>{formatPercent(investDisp)}</td>
                            <td className="font-mono py-2.5" style={getPctCellStyle("INVEST", getLatestProjection(row.kpis.INVEST.projections), row.kpis.INVEST.desafio)}>{formatPercent(investDesafio)}</td>
                            <td className="font-mono py-2.5 text-foreground-muted">-</td>
                            <td className="font-mono py-2.5 text-foreground-muted border-r-2 border-accent-gold/70">-</td>
                          </tr>

                          {/* SPACER VERTICAL ENTRE RESUMO DO GERENTE E CLIENTES */}
                          {isExpanded && row.clients.length > 0 && (
                            <tr className="h-3 bg-transparent border-0 select-none pointer-events-none">
                              <td colSpan={10 + mondays.length} className="p-0 border-0 bg-transparent h-3"></td>
                            </tr>
                          )}

                          {/* LINHAS DOS CLIENTES SE EXPANDIDO */}
                          {isExpanded && row.clients.map((cli, cIdx) => {
                            const cliProj = getLatestProjection(cli.projections) || cli.real;
                            const cliAA = calcGrowthPct(cliProj, cli.ano_a);
                            const cliMT = calcGrowthPct(cliProj, cli.media_trimestre || 0);
                            const cliMetaPct = calcGrowthPct(cliProj, cli.meta);
                            const cliDisp = calcGrowthPct(cli.mes_a, cli.prev_month_projection || 0);
                            const isLastClientRow = cIdx === row.clients.length - 1;

                            return (
                              <tr key={`${row.manager}_${cli.client}_${cIdx}`} className={`bg-background-subtle/30 hover:bg-background-subtle transition-colors ${isLastClientRow ? "border-b-2 border-accent-gold/70" : ""}`}>
                                {/* Nome da Rede/Cliente ocupando colSpan={2} (REGIONAL + KPI) sem a coluna KPI repetitiva */}
                                <td colSpan={2} className="text-left pl-6 pr-3 py-1.5 text-xs font-bold text-amber-200/90">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/70 shrink-0"></span>
                                      <span className="truncate font-semibold text-foreground-secondary hover:text-amber-300 transition-colors" title={cli.client}>
                                        {cli.client}
                                      </span>
                                    </div>

                                    {/* Controles da Gestão Dinâmica da Carteira (Admin / Admin Master) */}
                                    {isAdmin && (
                                      <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity shrink-0">
                                        {cli.client !== "OUTROS" && (
                                          <>
                                            <button
                                              type="button"
                                              disabled={cIdx === 0}
                                              onClick={() => handleMoveNetworkUp(mIdx, cIdx)}
                                              className="p-0.5 rounded hover:bg-amber-500/20 text-amber-400 disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
                                              title="Mover para cima (▲)"
                                            >
                                              <ArrowUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={cIdx >= row.clients.length - 2}
                                              onClick={() => handleMoveNetworkDown(mIdx, cIdx)}
                                              className="p-0.5 rounded hover:bg-amber-500/20 text-amber-400 disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
                                              title="Mover para baixo (▼)"
                                            >
                                              <ArrowDown className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openRemoveModal(mIdx, cIdx, cli.client, row.manager)}
                                              className="p-0.5 rounded hover:bg-red-500/20 text-red-400 transition-all cursor-pointer"
                                              title="Remover Rede (-)"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="col-divider text-foreground-muted font-mono text-xs py-1.5">{formatCurrency(cli.ano_a / 1000, 0)}</td>
                                <td className="text-foreground-muted font-mono text-xs py-1.5 border-r-0">{formatCurrency(cli.mes_a / 1000, 0)}</td>

                                {/* Meta do cliente (Moldura Simétrica DESAFIO 2px) */}
                                <td className="font-mono text-xs font-bold border-l-2 border-r-2 border-amber-500/80 text-amber-300 py-1.5">
                                  {isAdmin ? (
                                    <input
                                      type="number"
                                      step="1"
                                      value={cli.meta ? Math.round(cli.meta / 1000) : ""}
                                      onChange={(e) => handleClientMetaChange(mIdx, cIdx, parseFloat(e.target.value) || 0)}
                                      className="w-16 px-1.5 py-0.5 text-center bg-amber-500/20 border border-amber-500/50 rounded text-amber-300 font-bold text-xs"
                                    />
                                  ) : (
                                    cli.meta > 0 ? formatCurrency(cli.meta / 1000, 0) : "—"
                                  )}
                                </td>

                                <td className="font-mono text-xs font-bold text-foreground py-1.5 border-l-0">{formatCurrency(cli.real / 1000, 0)}</td>

                                {/* Projeções semanais do cliente */}
                                {mondays.map((m, wIdx) => {
                                  const isEditable = isGerenteNacionalAdmin || (canManagerEdit && m === todayStr);
                                  const isCurrent = isCurrentWeek(m, wIdx);
                                  const rawVal = cli.projections[wIdx] ? Math.round(cli.projections[wIdx] / 1000) : "";
                                  return (
                                    <td key={m} className={`p-1 ${wIdx === 0 ? "col-divider" : ""} ${isCurrent ? "border-l-2 border-r-2 border-amber-500/80" : ""}`}>
                                      <input
                                        type="number"
                                        step="1"
                                        disabled={!isEditable}
                                        value={rawVal}
                                        placeholder="0"
                                        onChange={(e) => handleClientProjChange(mIdx, cIdx, wIdx, parseFloat(e.target.value) || 0)}
                                        className={`w-full text-center py-1 px-1 rounded text-xs font-mono font-medium transition-all ${
                                          isCurrent
                                            ? "border-2 border-amber-500/50 bg-background/50 text-amber-200 font-bold"
                                            : "border border-border/30 bg-background/50 text-foreground focus:border-accent-gold focus:outline-none disabled:opacity-60"
                                        }`}
                                      />
                                    </td>
                                  );
                                })}

                                <td className="font-mono text-xs border-l-0 py-1.5" style={getPctCellStyle("DISPERSAO", cliDisp, cli.prev_month_projection || 0)}>{formatPercent(cliDisp)}</td>
                                <td className="font-mono text-xs py-1.5" style={getPctCellStyle("META", cliMetaPct, cli.meta, true)}>{cli.meta > 0 ? formatPercent(cliMetaPct) : "—"}</td>
                                <td className="font-mono text-xs py-1.5" style={getPctCellStyle("AA", cliAA, cli.ano_a, true)}>{cli.ano_a > 0 ? formatPercent(cliAA) : "—"}</td>
                                <td className="font-mono text-xs py-1.5 border-r-2 border-accent-gold/70" style={getPctCellStyle("MT", cliMT, cli.media_trimestre || 0, true)}>{(cli.media_trimestre || 0) > 0 ? formatPercent(cliMT) : "—"}</td>
                              </tr>
                            );
                          })}

                          {/* SPACER VERTICAL ENTRE GERENTES (CRIA O BLOCO INDEPENDENTE) */}
                          <tr className="h-3 bg-transparent border-0 select-none pointer-events-none">
                            <td colSpan={10 + mondays.length} className="p-0 border-0 bg-transparent h-3"></td>
                          </tr>

                        </tbody>
                      );
                    })}

                    {/* TOTAL CONSOLIDADO BRASIL (RESTRITO A ADMIN / ADMIN MASTER) */}
                    {canViewTotalBrasil && totalsRow && (
                      <tfoot className="border-t-4 border-accent-gold font-bold bg-background-elevated shadow-md">
                        {/* TOTAL VOL */}
                        <tr>
                          <td rowSpan={3} className="text-left pl-3 text-accent-gold text-sm align-middle font-black border-l-2 border-t-2 border-b-2 border-accent-gold/70">
                            TOTAL BRASIL
                          </td>
                          <td className="text-accent-gold py-2.5">VOL</td>
                          <td className="col-divider font-mono py-2.5">{formatNumber(totalsRow.kpis.VOL.ano_a / 1000, 1)}</td>
                          <td className="font-mono py-2.5 border-r-0">{formatNumber(totalsRow.kpis.VOL.mes_a / 1000, 1)}</td>
                          <td className="font-mono bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 text-amber-300 font-black py-2.5">{formatNumber(totalsRow.kpis.VOL.desafio / 1000, 1)}</td>
                          <td className="font-mono text-accent-gold py-2.5 border-l-0">{formatNumber(totalsRow.kpis.VOL.real / 1000, 1)}</td>
                          {mondays.map((m, idx) => {
                            const isCurrent = isCurrentWeek(m, idx);
                            return (
                              <td key={m} className={`font-mono text-accent-gold ${idx === 0 ? "col-divider" : ""} ${isCurrent ? "bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 font-black py-2.5" : ""}`}>
                                {formatNumber(totalsRow.kpis.VOL.projections[idx] / 1000, 1)}
                              </td>
                            );
                          })}
                          <td className="font-mono border-l-0 py-2.5" style={getPctCellStyle("DISPERSAO", calcDispersionPct(totalsRow.kpis.VOL.mes_a, totalsRow.kpis.VOL.prev_month_projection), totalsRow.kpis.VOL.prev_month_projection)}>
                            {formatPercent(calcDispersionPct(totalsRow.kpis.VOL.mes_a, totalsRow.kpis.VOL.prev_month_projection))}
                          </td>
                          <td className="font-mono py-2.5" style={getPctCellStyle("DESAFIO", calcRatioPct(getLatestProjection(totalsRow.kpis.VOL.projections), totalsRow.kpis.VOL.desafio), totalsRow.kpis.VOL.desafio)}>
                            {formatPercent(calcRatioPct(getLatestProjection(totalsRow.kpis.VOL.projections), totalsRow.kpis.VOL.desafio))}
                          </td>
                          <td className="font-mono py-2.5" style={getPctCellStyle("AA", calcRatioPct(getLatestProjection(totalsRow.kpis.VOL.projections), totalsRow.kpis.VOL.ano_a), totalsRow.kpis.VOL.ano_a)}>
                            {formatPercent(calcRatioPct(getLatestProjection(totalsRow.kpis.VOL.projections), totalsRow.kpis.VOL.ano_a))}
                          </td>
                          <td className="font-mono py-2.5 border-r-2 border-accent-gold/70" style={getPctCellStyle("MT", calcRatioPct(getLatestProjection(totalsRow.kpis.VOL.projections), totalsRow.kpis.VOL.media_trimestre), totalsRow.kpis.VOL.media_trimestre)}>
                            {formatPercent(calcRatioPct(getLatestProjection(totalsRow.kpis.VOL.projections), totalsRow.kpis.VOL.media_trimestre))}
                          </td>
                        </tr>

                        {/* TOTAL FAT (Sempre sem casas decimais) */}
                        <tr>
                          <td className="text-accent-gold py-2.5">FAT</td>
                          <td className="col-divider font-mono py-2.5">{formatCurrency(totalsRow.kpis.FAT.ano_a / 1000, 0)}</td>
                          <td className="font-mono py-2.5 border-r-0">{formatCurrency(totalsRow.kpis.FAT.mes_a / 1000, 0)}</td>
                          <td className="font-mono bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 text-amber-300 font-black py-2.5">{formatCurrency(totalsRow.kpis.FAT.desafio / 1000, 0)}</td>
                          <td className="font-mono text-accent-gold py-2.5 border-l-0">{formatCurrency(totalsRow.kpis.FAT.real / 1000, 0)}</td>
                          {mondays.map((m, idx) => {
                            const isCurrent = isCurrentWeek(m, idx);
                            return (
                              <td key={m} className={`font-mono text-accent-gold ${idx === 0 ? "col-divider" : ""} ${isCurrent ? "bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 font-black py-2.5" : ""}`}>
                                {formatCurrency(totalsRow.kpis.FAT.projections[idx] / 1000, 0)}
                              </td>
                            );
                          })}
                          <td className="font-mono border-l-0 py-2.5" style={getPctCellStyle("DISPERSAO", calcDispersionPct(totalsRow.kpis.FAT.mes_a, totalsRow.kpis.FAT.prev_month_projection), totalsRow.kpis.FAT.prev_month_projection)}>
                            {formatPercent(calcDispersionPct(totalsRow.kpis.FAT.mes_a, totalsRow.kpis.FAT.prev_month_projection))}
                          </td>
                          <td className="font-mono py-2.5" style={getPctCellStyle("DESAFIO", calcRatioPct(getLatestProjection(totalsRow.kpis.FAT.projections), totalsRow.kpis.FAT.desafio), totalsRow.kpis.FAT.desafio)}>
                            {formatPercent(calcRatioPct(getLatestProjection(totalsRow.kpis.FAT.projections), totalsRow.kpis.FAT.desafio))}
                          </td>
                          <td className="font-mono py-2.5" style={getPctCellStyle("AA", calcRatioPct(getLatestProjection(totalsRow.kpis.FAT.projections), totalsRow.kpis.FAT.ano_a), totalsRow.kpis.FAT.ano_a)}>
                            {formatPercent(calcRatioPct(getLatestProjection(totalsRow.kpis.FAT.projections), totalsRow.kpis.FAT.ano_a))}
                          </td>
                          <td className="font-mono py-2.5 border-r-2 border-accent-gold/70" style={getPctCellStyle("MT", calcRatioPct(getLatestProjection(totalsRow.kpis.FAT.projections), totalsRow.kpis.FAT.media_trimestre), totalsRow.kpis.FAT.media_trimestre)}>
                            {formatPercent(calcRatioPct(getLatestProjection(totalsRow.kpis.FAT.projections), totalsRow.kpis.FAT.media_trimestre))}
                          </td>
                        </tr>

                        {/* TOTAL INVEST */}
                        <tr className="border-b-2 border-accent-gold/70">
                          <td className="text-accent-gold py-2.5">INVEST</td>
                          <td className="col-divider font-mono py-2.5">{formatPercent(totalsRow.kpis.INVEST.ano_a)}</td>
                          <td className="font-mono py-2.5 border-r-0">{formatPercent(totalsRow.kpis.INVEST.mes_a)}</td>
                          <td className="font-mono bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 text-amber-300 font-black py-2.5">{formatPercent(totalsRow.kpis.INVEST.desafio)}</td>
                          <td className="font-mono text-accent-gold py-2.5 border-l-0">{formatPercent(totalsRow.kpis.INVEST.real)}</td>
                          {mondays.map((m, idx) => {
                            const isCurrent = isCurrentWeek(m, idx);
                            return (
                              <td key={m} className={`font-mono text-accent-gold ${idx === 0 ? "col-divider" : ""} ${isCurrent ? "bg-amber-500/15 border-l-2 border-r-2 border-amber-500/80 font-black py-2.5" : ""}`}>
                                {formatPercent(totalsRow.kpis.INVEST.projections[idx])}
                              </td>
                            );
                          })}
                          <td className="font-mono border-l-0 py-2.5" style={getPctCellStyle("DISPERSAO", calcDispersionPct(totalsRow.kpis.INVEST.mes_a, totalsRow.kpis.INVEST.prev_month_projection), totalsRow.kpis.INVEST.prev_month_projection)}>
                            {formatPercent(calcDispersionPct(totalsRow.kpis.INVEST.mes_a, totalsRow.kpis.INVEST.prev_month_projection))}
                          </td>
                          <td className="font-mono py-2.5" style={getPctCellStyle("INVEST", getLatestProjection(totalsRow.kpis.INVEST.projections), totalsRow.kpis.INVEST.desafio)}>
                            {formatPercent(calcRatioPct(getLatestProjection(totalsRow.kpis.INVEST.projections), totalsRow.kpis.INVEST.desafio))}
                          </td>
                          <td className="font-mono py-2.5 text-foreground-muted">-</td>
                          <td className="font-mono py-2.5 text-foreground-muted border-r-2 border-accent-gold/70">-</td>
                        </tr>
                      </tfoot>
                    )}

                  </table>
                </div>
              </div>

              {/* RODAPÉ RESTAURADO: LEGENDA DOS INDICADORES E BOTÃO SALVAR PROJEÇÕES */}
              <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-border/60 rounded-xl bg-background-card/80 backdrop-blur-md shadow-lg">
                {/* Legenda Explicativa dos Indicadores */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-foreground-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400">% DISP:</span>
                    <span>Dispersão (Faixa Verde: -3% a +5%)</span>
                  </div>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400">% DESAFIO:</span>
                    <span>Atingimento (% Proj / Meta)</span>
                  </div>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400">%AA:</span>
                    <span>Crescimento Ano Ant. (Ano A)</span>
                  </div>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400">%M. Trim:</span>
                    <span>Crescimento vs Média do Trimestre (Abr, Mai, Jun)</span>
                  </div>
                </div>

                {/* Botão Primário Fixado no Rodapé */}
                <button
                  type="button"
                  onClick={handleSaveProjections}
                  disabled={saving}
                  className="btn-primary shrink-0 px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-accent-gold/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>SALVAR PROJEÇÕES</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* --- MODAL 1: ADICIONAR REDE NA CARTEIRA DE PLANEJAMENTO (ADMIN ONLY) --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden font-sans space-y-4 p-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Adicionar Rede no Planejamento
                  </h3>
                  <p className="text-xs text-foreground-muted">
                    Gerente: <span className="font-bold text-accent-gold">{getManagerDisplayName(addModalManager)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-foreground-muted hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Input de Pesquisa Dinâmica */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-foreground-muted" />
              <input
                type="text"
                autoFocus
                placeholder="Pesquisar por nome, código de matriz, gerente ou UF..."
                value={searchRedeTerm}
                onChange={(e) => setSearchRedeTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-background-elevated border border-border rounded-xl text-xs text-foreground focus:border-accent-gold focus:outline-none font-sans"
              />
            </div>

            {/* Lista de Resultados de Pesquisa */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              {filteredAvailableRedes.length === 0 ? (
                <div className="p-4 text-center text-xs text-foreground-muted">
                  Nenhuma rede encontrada para a busca "{searchRedeTerm}".
                </div>
              ) : (
                filteredAvailableRedes.map((item, itemIdx) => {
                  const isSelected = selectedRedeToAdd === item.client;
                  return (
                    <div
                      key={`${item.client}_${item.codigo_matriz || ''}_${itemIdx}`}
                      onClick={() => setSelectedRedeToAdd(item.client)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between font-sans ${
                        isSelected 
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold" 
                          : "bg-background-elevated/40 border-border/50 text-foreground hover:bg-background-elevated"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs block font-bold">{item.client}</span>
                        <span className="text-[11px] text-foreground-muted block font-mono">
                          UF: {item.uf || "BR"} {item.codigo_matriz ? `| Matriz: ${item.codigo_matriz}` : ""}
                        </span>
                      </div>
                      <input
                        type="radio"
                        name="selectedRede"
                        checked={isSelected}
                        onChange={() => setSelectedRedeToAdd(item.client)}
                        className="accent-emerald-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Botões de Ação do Modal */}
            <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedRedeToAdd}
                onClick={confirmAddNetwork}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Adicionar no Planejamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CONFIRMAÇÃO DE REMOÇÃO DE REDE DA CARTEIRA (ADMIN ONLY) --- */}
      {isRemoveModalOpen && removeModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans space-y-4 p-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Remover Rede do Planejamento?
                </h3>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Esta ação afeta apenas a visualização de planejamento (RPS) deste mês.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-background-elevated border border-border text-center space-y-1">
              <span className="text-xs text-foreground-muted uppercase font-bold tracking-wider block">Rede Selecionada</span>
              <span className="text-sm font-black text-rose-400 block">{removeModalTarget.clientName}</span>
              <span className="text-[11px] text-foreground-muted block font-mono">Gerente: {getManagerDisplayName(removeModalTarget.managerName)}</span>
            </div>

            <p className="text-[11px] text-foreground-muted text-center leading-relaxed">
              Vendas históricas, cadastro comercial e faturamento de outros módulos permanecerão 100% preservados.
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsRemoveModalOpen(false);
                  setRemoveModalTarget(null);
                }}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRemoveNetwork}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Remover do Planejamento
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
