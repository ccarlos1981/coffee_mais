"use client";

import { OFFICIAL_ANALYTICS_SOURCES, resolveSupabaseTableName } from "@/lib/governance/analytics";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition, Fragment } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Home,
  BarChart3,
  History,
  Target,
  Upload,
  Users,
  ChevronLeft,
  ChevronRight,
  Trash2,
  TrendingUp,
  Calendar as CalendarIcon,
  Briefcase,
  FileText,
  FileUp,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  AlertCircle,
  AlertTriangle,
  List,
  X,
  Lock,
  Unlock,
  Pencil,
  CheckCircle,
  Clock,
  Shield,
  Banknote,
  Eye,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Layers,
  Paperclip,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { enviarParaTrade, validarTrade, conferirTrade, atualizarChecklistTrade, confirmarPagamento, importarInvestimentosEmLote, simularImportacaoInvestimentos, marcarAcaoNaoAconteceu, reabrirAcaoInvestimento, fecharAcaoInvestimento, obterPlanilhaModelo, reprovarAcaoTrade } from "./lancar/actions";
import { MotivoDivergencia, MOTIVOS_DIVERGENCIA } from "./divergencia-constants";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, addMonths, subMonths, addWeeks, subWeeks, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ThemeToggle } from "@/components/ThemeProvider";
import { getValorTotal } from "@/lib/investimento/getValorTotal";


const formatCompactCurrency = (value: number) => {
  if (value === 0) return "-";
  if (value >= 1_000_000) {
    return "R$ " + (value / 1_000_000).toFixed(1).replace(".", ",") + "M";
  }
  if (value >= 1_000) {
    return "R$ " + (value / 1_000).toFixed(0) + "k";
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
};

const MATRIX_MONTHS = [
  { value: "2026-06", label: "Jun/26" },
  { value: "2026-07", label: "Jul/26" },
  { value: "2026-08", label: "Ago/26" },
  { value: "2026-09", label: "Set/26" },
  { value: "2026-10", label: "Out/26" },
  { value: "2026-11", label: "Nov/26" },
  { value: "2026-12", label: "Dez/26" }
];

interface AcaoInvestimento {
  id: string;
  created_at: string;
  rede: string;
  data_inicio: string;
  data_fim: string;
  tipo_acao: string;
  mes_referencia?: string | null;
  codigo_matriz?: string | null;
  familia_produto?: string | null;
  preco_flat?: number | null;
  preco_acao?: number | null;
  valor_investimento?: number | null;
  expectativa_volume?: number | null;
  documento_url?: string | null;
  codigo?: number;
  abrangencia?: string;
  tipo_pagamento?: string;
  skus_detalhes?: any[];
  familias_detalhes?: Array<{
    familia_id: string;
    familia_nome: string;
    preco_flat?: number | null;
    preco_acao?: number | null;
    investimento?: number | null;
    expectativa_volume?: number | null;
  }> | null;
  // Phase fields
  checklist_comunicacao?: boolean;
  checklist_logistica?: boolean;
  checklist_auditoria?: boolean;
  checklist_garantia?: boolean;
  checklist_conferencia?: boolean;
  checklist_sem_auditoria?: boolean;
  verba_aprovada?: boolean;
  contrato_assinado?: boolean;
  percentual_comunicacao?: number;
  percentual_logistica?: number;
  percentual_auditoria?: number;
  percentual_conferencia?: number;
  fase_atual?: number;
  
  // Apuração (Fase 3) fields
  apuracao_numero_acordo?: string | null;
  apuracao_qtd_vendida?: number | null;
  apuracao_valor_realizado?: number | null;
  apuracao_evidencias_url?: string | null;
  apuracao_boleto_id?: string | null;
  condicao_pagamento?: string | null;
  sem_boleto?: boolean | null;
  
  trade_validado_em?: string | null;
  trade_validado_por?: string | null;
  numero_acordo?: string | null;
  evidencias_urls?: string[];
  volume_vendido_sellout?: number | null;
  vencimento?: string | null;
  dados_quitacao?: string | null;
  apuracao_preenchida_em?: string | null;
  trade_conferido_em?: string | null;
  trade_conferido_por?: string | null;
  trade_conferencia_aprovado?: boolean | null;
  trade_conferencia_observacao?: string | null;
  financeiro_pago_em?: string | null;
  financeiro_pago_por?: string | null;
  financeiro_comprovante_url?: string | null;
  financeiro_boleto_url?: string | null;
  financeiro_observacoes?: string | null;
  gerente_responsavel?: string | null;
  approved_snapshot?: any;
  approved_by?: string | null;
  approved_at?: string | null;
  real_volume?: number | null;
  real_faturamento?: number | null;
  real_margem?: number | null;
  roi?: number | null;
  alertas_preventivos?: any;
  is_reopened?: boolean | null;
  reopened_by?: string | null;
  reopened_at?: string | null;
  reopened_reason?: string | null;
  approval_comment?: string | null;
  rejection_reason?: string | null;
  cancel_reason?: string | null;
  roi_mode?: string | null;
  approved_alerts_snapshot?: any;
  action_result?: string | null;
  post_action_notes?: string | null;
  execution_score?: number | null;
  date_mode?: "single" | "multiple" | null;
  campanha_id?: string | null;
  status_financeiro_acao?: string | null;
  codigo_campanha?: string | null;
  nome_campanha?: string | null;
  status_operacional_campanha?: string | null;
  status_financeiro_campanha?: string | null;
  // Divergência Operacional de Calendário (Trade Fase 2)
  possui_divergencia_calendario?: boolean | null;
  data_inicio_real?: string | null;
  data_fim_real?: string | null;
  motivo_divergencia_calendario?: string | null;
  observacao_divergencia?: string | null;
  devolvido_por?: 'TRADE' | 'FINANCEIRO' | null;
  devolvido_em?: string | null;
}

interface InvestmentPeriod {
  start_date: string;
  end_date: string;
}

export function calcularStatusItemInvestimento(
  item: any,
  fase_atual: number,
  apuracao_preenchida_em?: string | null
): "AGENDADA" | "EM_ANDAMENTO" | "ENCERRADA" | "ATRASADA" {
  if ((fase_atual || 1) >= 4 || !!apuracao_preenchida_em) {
    return "ENCERRADA";
  }

  let periods: InvestmentPeriod[] = [];
  if (item.periods && Array.isArray(item.periods)) {
    periods = item.periods;
  } else if (item.start_date && item.end_date) {
    periods = [{ start_date: item.start_date, end_date: item.end_date }];
  }

  if (periods.length === 0) {
    return "AGENDADA";
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  let isAtrasada = false;
  let isEmAndamento = false;

  for (const p of periods) {
    if (!p.start_date || !p.end_date) continue;
    if (todayStr > p.end_date) {
      isAtrasada = true;
    } else if (todayStr >= p.start_date && todayStr <= p.end_date) {
      isEmAndamento = true;
    }
  }

  if (isAtrasada) return "ATRASADA";
  if (isEmAndamento) return "EM_ANDAMENTO";
  return "AGENDADA";
}

function getConsolidatedStatusText(fams: any[]): string {
  if (!fams || fams.length === 0) return 'APROVADO';
  const statuses = fams.map(f => (f.status || f.status_trade || 'PENDENTE').toUpperCase());
  const hasPending = statuses.some(s => s === 'PENDENTE' || s === 'PENDING' || s === 'AGUARDANDO VALIDAÇÃO');
  const allApproved = statuses.every(s => s === 'APROVADA' || s === 'APROVADO');
  const allReproved = statuses.every(s => s === 'REPROVADA' || s === 'REPROVADO');
  if (allApproved) return 'APROVADO';
  if (allReproved) return 'REPROVADO';
  if (hasPending) return 'EM VALIDAÇÃO';
  return 'PARCIALMENTE APROVADO';
}

const FASE_CONFIG: Record<number, { label: string; sublabel: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  1: { label: "Planej. GRV", sublabel: "fase 1", color: "text-amber-400", bgColor: "bg-amber-400/10", borderColor: "border-amber-400/30", icon: "📋" },
  2: { label: "Trade", sublabel: "fase 2", color: "text-blue-400", bgColor: "bg-blue-400/10", borderColor: "border-blue-400/30", icon: "🔍" },
  3: { label: "Apur. GRV", sublabel: "fase 3", color: "text-purple-400", bgColor: "bg-purple-400/10", borderColor: "border-purple-400/30", icon: "📝" },
  4: { label: "Confer. Financ.", sublabel: "fase 4", color: "text-indigo-400", bgColor: "bg-indigo-400/10", borderColor: "border-indigo-400/30", icon: "📊" },
  5: { label: "Pgto Financ.", sublabel: "fase 5", color: "text-emerald-400", bgColor: "bg-emerald-400/10", borderColor: "border-emerald-400/30", icon: "💰" },
  6: { label: "Concluído", sublabel: "fase 6", color: "text-green-400", bgColor: "bg-green-400/10", borderColor: "border-green-400/30", icon: "✅" },
};

const getTradeProgress = (row: AcaoInvestimento) => {
  let checked = 0;
  if (row.checklist_comunicacao) checked++;
  if (row.checklist_logistica) checked++;
  if (row.checklist_auditoria) checked++;
  if (row.checklist_garantia) checked++;
  return Math.round((checked / 4) * 100);
};

const getTradeBadgeClasses = (percent: number) => {
  if (percent < 75) {
    return { bg: "bg-red-500", text: "text-white", border: "border-red-600" };
  } else if (percent === 75) {
    return { bg: "bg-amber-500", text: "text-white", border: "border-amber-600" };
  } else {
    return { bg: "bg-green-500", text: "text-white", border: "border-green-600" };
  }
};

export default function InvestimentoPage() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [data, setData] = useState<AcaoInvestimento[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Faturamento e status por Matriz
  const [faturamentoMap, setFaturamentoMap] = useState<Record<string, Record<string, number>>>({});
  const [faturamentoTotalMap, setFaturamentoTotalMap] = useState<Record<string, number>>({});
  const [matrizSearch, setMatrizSearch] = useState("");

  const [matrizes, setMatrizes] = useState<any[]>([]);

  // Filters & Pagination
  const [filterRede, setFilterRede] = useState("");
  const [filterFamilia, setFilterFamilia] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterGerente, setFilterGerente] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Audit Network Modal States
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditNetworkLoading, setAuditNetworkLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isAuditFaturamentoExpanded, setIsAuditFaturamentoExpanded] = useState(false);
  const [auditFaturamentoLoading, setAuditFaturamentoLoading] = useState(false);
  const [page, setPage] = useState(0);
  const itemsPerPage = 50;
  const [showFilters, setShowFilters] = useState(false);
  const [filterFase, setFilterFase] = useState<number | null>(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tradeChecklist, setTradeChecklist] = useState({ comunicacao: false, logistica: false, auditoria: false, garantia: false, conferencia: false, sem_auditoria: false });
  const [tradeDivergencia, setTradeDivergencia] = useState<{
    possui: boolean;
    motivo: MotivoDivergencia | '';
    observacao: string;
  }>({ possui: false, motivo: '', observacao: '' });
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const [globalSearch, setGlobalSearch] = useState("");
  const [filterMes, setFilterMes] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedAcoes, setParsedAcoes] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const motivoRef = useRef<HTMLSelectElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [fileHash, setFileHash] = useState("");
  const [rawExcelRows, setRawExcelRows] = useState<any[][]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isImportPending, startImportTransition] = useTransition();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [apuracaoForm, setApuracaoForm] = useState({ numero_acordo: "", qtd_vendida: "", valor_realizado: "", evidencias_url: "", boleto_id: "", condicao_pagamento: "" });
  const [boletosAbertos, setBoletosAbertos] = useState<any[]>([]);
  const [boletoSearchTerm, setBoletoSearchTerm] = useState("");
  const [boletoSearchResults, setBoletoSearchResults] = useState<any[]>([]);
  const [boletoSearchLoading, setBoletoSearchLoading] = useState(false);
  const [showBoletoDropdown, setShowBoletoDropdown] = useState(false);
  const [selectedBoletoLabel, setSelectedBoletoLabel] = useState("");
  const [vinculosBoletos, setVinculosBoletos] = useState<any[]>([]);
  const [semBoleto, setSemBoleto] = useState(false);
  const [clientHasBoletoCondition, setClientHasBoletoCondition] = useState(false);
  const [modalPrazo, setModalPrazo] = useState<string | null>(null);
  const boletoDropdownRef = useRef<HTMLDivElement>(null);
  const [uploadingBoletoFinanceiro, setUploadingBoletoFinanceiro] = useState(false);
  const [showOnlyWithoutActions, setShowOnlyWithoutActions] = useState(false);

  // Calendar State
  const [viewMode, setViewMode] = useState<"table" | "calendar" | "matrix">("table");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // AI Insight Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const view = searchParams.get("view");
      if (view === "calendar") {
        setViewMode("calendar");
        setFilterFase(null);
      } else {
        const faseParam = searchParams.get("fase");
        if (faseParam) {
          const parsed = parseInt(faseParam, 10);
          if (!isNaN(parsed)) {
            setFilterFase(parsed);
          }
        }
      }
    }
  }, []);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAction, setSelectedAction] = useState<AcaoInvestimento | null>(null);
  const [realVolume, setRealVolume] = useState("");
  const [realFaturamento, setRealFaturamento] = useState("");
  const [realMargem, setRealMargem] = useState("");
  const [actionResult, setActionResult] = useState("SUCESSO");
  const [postActionNotes, setPostActionNotes] = useState("");
  const [executionScore, setExecutionScore] = useState("");
  const [showConsolidadoGerentes, setShowConsolidadoGerentes] = useState(false);



  useEffect(() => {
    if (selectedAction) {
      setRealVolume(selectedAction.real_volume?.toString() || "");
      setRealFaturamento(selectedAction.real_faturamento?.toString() || "");
      setRealMargem(selectedAction.real_margem?.toString() || "");
      setActionResult(selectedAction.action_result || "SUCESSO");
      setPostActionNotes(selectedAction.post_action_notes || "");
      setExecutionScore(selectedAction.execution_score?.toString() || "");
    } else {
      setRealVolume("");
      setRealFaturamento("");
      setRealMargem("");
      setActionResult("SUCESSO");
      setPostActionNotes("");
      setExecutionScore("");
    }
  }, [selectedAction?.id]);

  const handleAuditSearch = async (targetQuery: string) => {
    if (!targetQuery.trim()) return;
    setAuditNetworkLoading(true);
    setAuditError(null);
    setAuditResult(null);
    setIsAuditFaturamentoExpanded(false);
    try {
      const res = await fetch(`/api/audit-network?query=${encodeURIComponent(targetQuery)}`);
      const json = await res.json();
      if (json.success) {
        setAuditResult(json.data);
      } else {
        setAuditError(json.error || 'Erro ao carregar auditoria.');
      }
    } catch (err: any) {
      console.error(err);
      setAuditError(err.message || 'Erro de rede ao buscar auditoria.');
    } finally {
      setAuditNetworkLoading(false);
    }
  };

  const handleExpandAuditFaturamento = async () => {
    if (isAuditFaturamentoExpanded || !auditResult?.rede) return;
    setIsAuditFaturamentoExpanded(true);
    setAuditFaturamentoLoading(true);
    try {
      const res = await fetch(`/api/audit-network?query=${encodeURIComponent(auditResult.rede)}&include_faturamento=true`);
      const json = await res.json();
      if (json.success && json.data?.faturamento) {
        setAuditResult((prev: any) => ({
          ...prev,
          faturamento: json.data.faturamento
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar faturamento da auditoria:', err);
    } finally {
      setAuditFaturamentoLoading(false);
    }
  };

  useEffect(() => {
    if (isAuditModalOpen) {
      if (filterRede) {
        setAuditQuery(filterRede);
        handleAuditSearch(filterRede);
      } else {
        setAuditQuery("");
        setAuditResult(null);
        setAuditError(null);
        setIsAuditFaturamentoExpanded(false);
      }
    }
  }, [isAuditModalOpen]);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);

  // Fetch audit logs when action selected
  useEffect(() => {
    if (!selectedAction?.id) {
      setAuditLogs([]);
      setAuditExpanded(false);
      return;
    }
    const fetchAuditLogs = async () => {
      setAuditLoading(true);
      try {
        const { data: logs } = await supabase
          .from('cm_audit_logs')
          .select('*')
          .eq('table_name', 'cm_acoes_investimento')
          .or(`new_data->>id.eq.${selectedAction.id},old_data->>id.eq.${selectedAction.id}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (logs && logs.length > 0) {
          // Resolve user names
          const userIds = [...new Set(logs.map((l: any) => l.user_id).filter(Boolean))];
          let userMap: Record<string, string> = {};
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('cm_user_profiles')
              .select('id, nome')
              .in('id', userIds);
            if (profiles) {
              profiles.forEach((p: any) => { userMap[p.id] = p.nome; });
            }
          }
          setAuditLogs(logs.map((l: any) => ({ ...l, user_name: userMap[l.user_id] || 'Sistema' })));
        } else {
          setAuditLogs([]);
        }
      } catch (err) {
        console.error('Erro ao buscar auditoria:', err);
      }
      setAuditLoading(false);
    };
    fetchAuditLogs();
  }, [selectedAction?.id]);
  const fetchBoletosDaRede = async (rede: string) => {
    const redeUpper = rede.toUpperCase().trim();
    const { data } = await supabase
      .from('cm_boletos')
      .select('*')
      .or(`rede.eq.${redeUpper},rede.ilike.%${redeUpper}%`)
      .eq('status', 'Aberto')
      .order('vencimento', { ascending: true });
    if (data) setBoletosAbertos(data);
    setBoletoSearchTerm("");
    setBoletoSearchResults([]);
    setSelectedBoletoLabel("");
  };

  const searchBoletosGlobal = useCallback(async (term: string) => {
    if (term.length < 1) {
      setBoletoSearchResults([]);
      return;
    }
    setBoletoSearchLoading(true);
    const { data } = await supabase
      .from('cm_boletos')
      .select('*')
      .ilike('rede', `%${term.toUpperCase()}%`)
      .eq('status', 'Aberto')
      .order('vencimento', { ascending: true })
      .limit(30);
    setBoletoSearchResults(data || []);
    setBoletoSearchLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (boletoSearchTerm.length >= 1) {
        searchBoletosGlobal(boletoSearchTerm);
      } else {
        setBoletoSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [boletoSearchTerm, searchBoletosGlobal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boletoDropdownRef.current && !boletoDropdownRef.current.contains(e.target as Node)) {
        setShowBoletoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedAction) {
      setTradeChecklist({ 
        comunicacao: selectedAction.checklist_comunicacao || false, 
        logistica: selectedAction.checklist_logistica || false, 
        auditoria: selectedAction.checklist_auditoria || false, 
        garantia: selectedAction.checklist_garantia || false,
        conferencia: selectedAction.checklist_conferencia || false,
        sem_auditoria: selectedAction.checklist_sem_auditoria || false
      });
      // Sincronizar divergência de calendário
      setTradeDivergencia({
        possui: selectedAction.possui_divergencia_calendario || false,
        motivo: (selectedAction.motivo_divergencia_calendario as MotivoDivergencia) || '',
        observacao: selectedAction.observacao_divergencia || '',
      });
      setApuracaoForm({
        numero_acordo: selectedAction.apuracao_numero_acordo || "",
        qtd_vendida: selectedAction.apuracao_qtd_vendida?.toString() || "",
        valor_realizado: selectedAction.apuracao_valor_realizado?.toString() || "",
        evidencias_url: selectedAction.apuracao_evidencias_url || "",
        boleto_id: selectedAction.apuracao_boleto_id || "",
        condicao_pagamento: selectedAction.condicao_pagamento || ""
      });
      setSemBoleto(selectedAction.sem_boleto || false);

      const checkBoletoCondition = async () => {
        const actionIsBoleto = selectedAction.tipo_pagamento?.toLowerCase().includes('boleto') || 
                              selectedAction.tipo_pagamento?.toLowerCase().includes('abatimento') ||
                              selectedAction.condicao_pagamento?.toLowerCase().includes('boleto');
                              
        if (actionIsBoleto) {
          setClientHasBoletoCondition(true);
          return;
        }

        try {
          const { data: clients } = await supabase
            .from("cm_clientes")
            .select("condicao_pagamento")
            .or(`codigo_matriz.eq.${selectedAction.codigo_matriz},codigo.eq.${parseInt(selectedAction.codigo_matriz || '', 10) || 0}`)
            .not("condicao_pagamento", "is", null)
            .limit(1);

          if (clients && clients.length > 0 && clients[0].condicao_pagamento) {
            const cond = clients[0].condicao_pagamento.trim().toLowerCase();
            if (cond.includes("boleto")) {
              setClientHasBoletoCondition(true);
              return;
            }
          }
        } catch (err) {
          console.error("Erro ao verificar condição de pagamento:", err);
        }
        
        setClientHasBoletoCondition(false);
      };

      // Buscar prazo do cliente via cm_boletos e salvar na ação
      const fetchModalPrazo = async () => {
        let foundPrazo: string | null = selectedAction.condicao_pagamento || null;
        try {
          // 1. Tenta via boleto da rede (mais preciso)
          const { data: boletos } = await supabase
            .from("cm_boletos")
            .select("prazo")
            .ilike("rede", `%${selectedAction.rede}%`)
            .not("prazo", "is", null)
            .limit(1);
          if (boletos && boletos.length > 0 && boletos[0].prazo) {
            foundPrazo = boletos[0].prazo;
          } else {
            // 2. Fallback: condicao_pagamento do cm_clientes
            const { data: clients } = await supabase
              .from("cm_clientes")
              .select("condicao_pagamento")
              .or(`codigo_matriz.eq.${selectedAction.codigo_matriz},codigo.eq.${parseInt(selectedAction.codigo_matriz || '', 10) || 0}`)
              .not("condicao_pagamento", "is", null)
              .limit(1);
            if (clients && clients.length > 0 && clients[0].condicao_pagamento) {
              foundPrazo = clients[0].condicao_pagamento;
            }
          }
        } catch { /* mantém o valor anterior */ }

        setModalPrazo(foundPrazo);

        // Persistir prazo na ação se encontrou e o campo estava vazio
        if (foundPrazo && !selectedAction.condicao_pagamento && selectedAction.id) {
          await supabase
            .from("cm_acoes_investimento")
            .update({ condicao_pagamento: foundPrazo })
            .eq("id", selectedAction.id);
        }
      };


      checkBoletoCondition();
      fetchModalPrazo();
      
      if ((selectedAction.fase_atual || 1) >= 3) {
        fetchBoletosDaRede(selectedAction.rede);
        
        // Buscar boletos vinculados na tabela de relações
        supabase
          .from('cm_acoes_boletos_vinculo')
          .select('valor_associado, cm_boletos:boleto_id(id, numero_boleto, rede, valor_total, vencimento, status, tipo_titulo, prazo)')
          .eq('acao_id', selectedAction.id)
          .then(({ data: vinculosData, error }: any) => {
            if (!error && vinculosData && vinculosData.length > 0) {
              const parsed = vinculosData.map((v: any) => {
                const b = v.cm_boletos;
                return {
                  boleto_id: b.id,
                  valor_associado: v.valor_associado.toString(),
                  label: `${b.rede} — Nº ${b.numero_boleto} [${b.tipo_titulo || 'BOLETO'}] — Total: ${formatCurrency(b.valor_total)} — Venc: ${new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`,
                  numero_boleto: b.numero_boleto,
                  valor_total: b.valor_total,
                  tipo_titulo: b.tipo_titulo,
                  vencimento: b.vencimento,
                  rede: b.rede,
                  prazo: b.prazo
                };
              });
              setVinculosBoletos(parsed);
            } else {
              // Fallback para boletos legados (vinculo individual na coluna apuracao_boleto_id)
              if (selectedAction.apuracao_boleto_id) {
                supabase
                  .from('cm_boletos')
                  .select('*')
                  .eq('id', selectedAction.apuracao_boleto_id)
                  .single()
                  .then(({ data: b }: { data: any }) => {
                    if (b) {
                      setVinculosBoletos([{
                        boleto_id: b.id,
                        valor_associado: (selectedAction.apuracao_valor_realizado || getValorTotal(selectedAction)).toString(),
                        label: `${b.rede} — Nº ${b.numero_boleto} [${b.tipo_titulo || 'BOLETO'}] — Total: ${formatCurrency(b.valor_total)} — Venc: ${new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`,
                        numero_boleto: b.numero_boleto,
                        valor_total: b.valor_total,
                        tipo_titulo: b.tipo_titulo,
                        vencimento: b.vencimento,
                        rede: b.rede,
                        prazo: b.prazo
                      }]);
                    } else {
                      setVinculosBoletos([]);
                    }
                  });
              } else {
                setVinculosBoletos([]);
              }
            }
          });
      } else {
        setVinculosBoletos([]);
      }
      setDetailsExpanded(false);
    }
  }, [selectedAction]);

  const allTradeChecked = Object.values(tradeChecklist).every(Boolean);

  const handleParentChecklistChange = async (fieldName: 'checklist_garantia' | 'verba_aprovada' | 'contrato_assinado', checked: boolean) => {
    if (!selectedAction) return;
    try {
      const { error } = await supabase
        .from("cm_acoes_investimento")
        .update({ [fieldName]: checked })
        .eq("id", selectedAction.id);
      
      if (error) throw error;
      
      setData(prev => prev.map(item => item.id === selectedAction.id ? { ...item, [fieldName]: checked } : item));
      setSelectedAction(prev => prev && prev.id === selectedAction.id ? { ...prev, [fieldName]: checked } : prev);
      
      if (fieldName === 'checklist_garantia') {
        setTradeChecklist(prev => ({ ...prev, garantia: checked }));
      }
    } catch (err: any) {
      console.error("Falha ao salvar checklist comercial:", err);
      alert("Erro ao salvar checklist: " + err.message);
    }
  };

  const managerFilteredAcoes = useMemo(() => {
    if (userRole !== "Gerente Regional" || !userEmail) {
      return data;
    }
    const emailPrefix = userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    return data.filter(r => {
      if (!r.gerente_responsavel) return false;
      const cleanGerente = r.gerente_responsavel.toLowerCase().replace(/[^a-z0-9]/g, "");
      return emailPrefix.startsWith(cleanGerente) || cleanGerente.startsWith(emailPrefix);
    });
  }, [data, userRole, userEmail]);

  const redesDisponiveis = useMemo(() => Array.from(new Set(managerFilteredAcoes.map(d => d.rede))).sort(), [managerFilteredAcoes]);
  const familiasDisponiveis = useMemo(() => {
    const fams = new Set<string>();
    managerFilteredAcoes.forEach(d => {
      if (d.familias_detalhes && d.familias_detalhes.length > 0) {
        d.familias_detalhes.forEach(f => fams.add(f.familia_nome));
      } else if (d.familia_produto) {
        fams.add(d.familia_produto);
      }
    });
    return Array.from(fams).sort();
  }, [managerFilteredAcoes]);

  const isRegionalManager = userRole && userRole !== 'Admin' && userRole !== 'Financeiro' && userRole !== 'CEO' && userRole !== 'Trade';

  const myMatrizes = useMemo(() => {
    if (isRegionalManager && userEmail) {
      const emailPrefix = userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      return matrizes.filter(m => {
        if (!m.gerente) return false;
        const cleanGerente = m.gerente.toLowerCase().replace(/[^a-z0-9]/g, "");
        return emailPrefix.startsWith(cleanGerente) || cleanGerente.startsWith(emailPrefix);
      });
    }
    return matrizes;
  }, [matrizes, isRegionalManager, userEmail]);



  // Auxiliares de parsing de data
  const parseDateString = (dateStr: any): string | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) {
      const y = dateStr.getFullYear();
      const m = String(dateStr.getMonth() + 1).padStart(2, '0');
      const d = String(dateStr.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(dateStr).trim();
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      if (year.length === 4 && !isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
        return `${year}-${month}-${day}`;
      }
    }
    const yyyyMmDd = str.split("-");
    if (yyyyMmDd.length === 3 && yyyyMmDd[0].length === 4) {
      return str;
    }
    return null;
  };

  const excelSerialToDate = (serial: number): string | null => {
    try {
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      const y = date_info.getUTCFullYear();
      const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date_info.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch (e) {
      return null;
    }
  };

  // Download do modelo Excel inteligente de investimentos
  const downloadModelExcel = async () => {
    try {
      setFeedback({ type: "success", msg: "Gerando planilha inteligente..." });
      const result = await obterPlanilhaModelo(false, filterRede);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Erro desconhecido na geração");
      }

      // Converte o base64 de volta para blob
      const blob = new Blob(
        [Uint8Array.from(atob(result.data), c => c.charCodeAt(0))],
        { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", result.fileName || "modelo_lancamento_investimentos.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedback({ type: "success", msg: "Modelo inteligente baixado com sucesso!" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", msg: `Erro ao baixar modelo: ${error.message}` });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Gerar e baixar planilha contendo apenas linhas que falharam nas validações
  const downloadErrorsExcel = (originalRows: any[][], errorsList: any[]) => {
    try {
      const newHeaders = [...originalRows[0], "Erro(s) Encontrado(s)"];
      const rows = [newHeaders];

      originalRows.slice(1).forEach((row, index) => {
        const lineNum = index + 2;
        const rowErrors = errorsList.filter(e => e.line === lineNum);
        if (rowErrors.length > 0) {
          const errorMsg = rowErrors.map(e => `[${e.column}]: ${e.message}`).join("; ");
          rows.push([...row, errorMsg]);
        }
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Erros de Importação");
      XLSX.writeFile(workbook, "planilha_corrigir_erros.xlsx");
      setFeedback({ type: "success", msg: "Planilha de erros gerada para download!" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Erro ao gerar planilha de erros:", err);
      setFeedback({ type: "error", msg: "Erro ao exportar planilha de erros." });
    }
  };

  // Importação em lote integrada à Server Action de Simulação
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportErrors([]);
    setImportSummary(null);
    setParsedAcoes([]);
    setIsSimulating(true);
    setFeedback(null);

    try {
      // 1. Calcular o SHA-256 do arquivo (client-side) para prevenir uploads duplicados
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setFileHash(hashHex);

      // 2. Ler as linhas cruas da planilha
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          
          // Busca robusta pela aba correta:
          // 1. Procurar uma aba cujo nome contenha "Modelo" (case-insensitive)
          // 2. Procurar uma aba contendo "Investimento" (case-insensitive)
          // 3. Procurar uma aba contendo "Planejamento" (case-insensitive)
          let wsname = "";
          const modelSheet = wb.SheetNames.find(name => name.toLowerCase().includes("modelo"));
          const investSheet = wb.SheetNames.find(name => name.toLowerCase().includes("investimento"));
          const planSheet = wb.SheetNames.find(name => name.toLowerCase().includes("planejamento"));

          if (modelSheet) {
            wsname = modelSheet;
          } else if (investSheet) {
            wsname = investSheet;
          } else if (planSheet) {
            wsname = planSheet;
          }

          if (!wsname) {
            throw new Error("Não foi encontrada uma aba de importação válida. Utilize a planilha modelo gerada pelo sistema.");
          }

          const ws = wb.Sheets[wsname];
          const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
          
          if (rawRows.length <= 1) {
            setFeedback({ type: "error", msg: "A planilha está vazia ou a aba de dados não foi encontrada." });
            setIsSimulating(false);
            return;
          }

          setRawExcelRows(rawRows);

          // 3. Chamar a Server Action de Simulação (All-or-Nothing validation)
          const res = await simularImportacaoInvestimentos(rawRows);
          
          if (!res.success) {
            setFeedback({ type: "error", msg: res.message || "Erro ao processar a planilha." });
            setIsSimulating(false);
            return;
          }

          const { errors, summary, parsedLines } = res.data || {};

          if (errors && errors.length > 0) {
            setImportErrors(errors);
            setImportSummary(summary);
            setIsSimulating(false);
            return;
          }

          // 4. Executar agrupamento dos registros válidos
          const groupedAcoes: any[] = [];
          const skuGroups: Record<string, any[]> = {};
          const familiaGroups: Record<string, any[]> = {};

          (parsedLines || []).forEach(line => {
            if (line.data.abrangencia === "Família") {
              const key = `${line.data.codigo_matriz}|${line.data.tipo_acao}|${line.data.tipo_pagamento}|${line.data.mes_referencia}|${line.data.data_inicio}|${line.data.data_fim}`;
              if (!familiaGroups[key]) familiaGroups[key] = [];
              familiaGroups[key].push(line);
            } else {
              const key = `${line.data.codigo_matriz}|${line.data.tipo_acao}|${line.data.tipo_pagamento}|${line.data.mes_referencia}|${line.data.data_inicio}|${line.data.data_fim}`;
              if (!skuGroups[key]) skuGroups[key] = [];
              skuGroups[key].push(line);
            }
          });

          const localErrors: any[] = [];

          // Agrupar Famílias
          Object.entries(familiaGroups).forEach(([key, lines]) => {
            const first = lines[0].data;
            const famDetails = lines.map(line => {
              const famNome = line.data.familia_produto || "";
              const famId = famNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
              return {
                familia_id: famId,
                familia_nome: famNome,
                preco_flat: line.data.preco_flat,
                preco_acao: line.data.preco_acao,
                investimento: line.data.valor_investimento,
                expectativa_volume: line.data.expectativa_volume,
                _lineIndex: line.lineIndex
              };
            });

            const famNames = famDetails.map(f => f.familia_nome);
            const duplicateFams = famNames.filter((item, index) => famNames.indexOf(item) !== index);
            const groupErrors: string[] = [];
            
            if (duplicateFams.length > 0) {
              const dupLines = duplicateFams.map(dup => {
                const lineNums = famDetails.filter(f => f.familia_nome === dup).map(f => f._lineIndex);
                localErrors.push({
                  line: lineNums[0],
                  column: "Família de Produto",
                  value: dup,
                  message: `Família duplicada no mesmo grupo (linhas ${lineNums.join(", ")})`
                });
                return `${dup} (linhas ${lineNums.join(", ")})`;
              });
              groupErrors.push(`Famílias duplicadas: ${Array.from(new Set(dupLines)).join("; ")}`);
            }

            const cleanFamDetails = famDetails.map(({ _lineIndex, ...rest }) => rest);
            groupedAcoes.push({
              originalRow: lines[0].originalRow,
              data: {
                rede: first.rede,
                codigo_matriz: first.codigo_matriz,
                uf: first.uf,
                gerente: first.gerente,
                canal: first.canal,
                tipo_acao: first.tipo_acao,
                tipo_pagamento: first.tipo_pagamento,
                mes_referencia: first.mes_referencia,
                data_inicio: first.data_inicio,
                data_fim: first.data_fim,
                abrangencia: "Família",
                familia_produto: famNames.join(", "),
                familias_detalhes: cleanFamDetails,
                preco_flat: null,
                preco_acao: null,
                valor_investimento: null,
                expectativa_volume: null,
                skus_detalhes: [],
                fase_atual: 1
              },
              valid: groupErrors.length === 0,
              errors: groupErrors
            });
          });

          // Agrupar SKUs
          Object.entries(skuGroups).forEach(([key, lines]) => {
            const first = lines[0].data;
            const skusDetails = lines.map(line => ({
              sku: line.data.sku,
              preco_flat: line.data.preco_flat,
              preco_acao: line.data.preco_acao,
              investimento: line.data.valor_investimento,
              expectativa_volume: line.data.expectativa_volume,
              _lineIndex: line.lineIndex
            }));

            const skusList = skusDetails.map(s => s.sku);
            const duplicateSkus = skusList.filter((item, index) => skusList.indexOf(item) !== index);
            const groupErrors: string[] = [];

            if (duplicateSkus.length > 0) {
              const dupLines = duplicateSkus.map(dup => {
                const lineNums = skusDetails.filter(s => s.sku === dup).map(s => s._lineIndex);
                localErrors.push({
                  line: lineNums[0],
                  column: "SKU",
                  value: dup,
                  message: `SKU duplicado no mesmo grupo (linhas ${lineNums.join(", ")})`
                });
                return `${dup} (linhas ${lineNums.join(", ")})`;
              });
              groupErrors.push(`SKUs duplicados: ${Array.from(new Set(dupLines)).join(", ")}`);
            }

            const cleanSkusDetails = skusDetails.map(({ _lineIndex, ...rest }) => rest);
            groupedAcoes.push({
              originalRow: lines[0].originalRow,
              data: {
                rede: first.rede,
                codigo_matriz: first.codigo_matriz,
                uf: first.uf,
                gerente: first.gerente,
                canal: first.canal,
                tipo_acao: first.tipo_acao,
                tipo_pagamento: first.tipo_pagamento,
                mes_referencia: first.mes_referencia,
                data_inicio: first.data_inicio,
                data_fim: first.data_fim,
                abrangencia: "SKU",
                familia_produto: null,
                preco_flat: null,
                preco_acao: null,
                valor_investimento: null,
                expectativa_volume: null,
                skus_detalhes: cleanSkusDetails,
                fase_atual: 1
              },
              valid: groupErrors.length === 0,
              errors: groupErrors
            });
          });

          if (localErrors.length > 0) {
            setImportErrors(localErrors);
          } else {
            setParsedAcoes(groupedAcoes);
            setImportSummary(summary);
          }
          setIsSimulating(false);
        } catch (err: any) {
          console.error(err);
          setFeedback({ type: "error", msg: err.message || "Erro ao processar o arquivo Excel." });
          setIsSimulating(false);
        }
      };

      reader.readAsBinaryString(file);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", msg: err.message || "Erro ao ler arquivo." });
      setIsSimulating(false);
    }
  };

  // Efetiva a gravação definitiva de todas as ações validadas
  const handleConfirmImport = () => {
    if (importErrors.length > 0) {
      setFeedback({ type: "error", msg: "Corrija todos os erros da planilha antes de salvar." });
      return;
    }

    const validAcoes = parsedAcoes
      .filter(item => item.valid)
      .map(item => {
        const { uf, gerente, canal, ...dbFields } = item.data;
        return { ...dbFields, is_planejamento: false };
      });

    if (validAcoes.length === 0) {
      setFeedback({ type: "error", msg: "Nenhum investimento válido encontrado." });
      return;
    }

    startImportTransition(async () => {
      try {
        const res = await importarInvestimentosEmLote(
          validAcoes,
          importFileName,
          fileHash,
          importSummary?.totalInvestment || 0
        );
        if (res.success) {
          const count = res.data?.count || 0;
          setFeedback({ type: "success", msg: `${count} investimentos importados com sucesso!` });
          setIsImportModalOpen(false);
          setParsedAcoes([]);
          setImportFileName("");
          setImportErrors([]);
          setImportSummary(null);
          setFileHash("");
          loadData();
        } else {
          setFeedback({ type: "error", msg: res.message || "Erro ao salvar importação." });
        }
      } catch (err: any) {
        setFeedback({ type: "error", msg: err.message || "Erro ao salvar importação." });
      }
    });
  };

  const handleFileUpload = async (id: string, file: File | null) => {
    if (!file) return;
    
    setUploadingId(id);
    setFeedback(null);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("comprovantes_investimento")
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { error: dbError } = await supabase
        .from("cm_acoes_investimento")
        .update({ documento_url: filePath })
        .eq("id", id);
        
      if (dbError) throw dbError;
      
      setData(prev => prev.map(item => item.id === id ? { ...item, documento_url: filePath } : item));
      // Atualiza também o selectedAction para refletir o documento_url sem perder o form
      setSelectedAction(prev => prev && prev.id === id ? { ...prev, documento_url: filePath } : prev);
      setFeedback({ type: "success", msg: "Comprovante anexado com sucesso!" });
      setTimeout(() => setFeedback(null), 3000);
      
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", msg: "Erro ao anexar comprovante: " + err.message });
    } finally {
      setUploadingId(null);
    }
  };

  const handleBoletoFinanceiroUpload = async (id: string, file: File | null) => {
    if (!file) return;
    setUploadingBoletoFinanceiro(true);
    setFeedback(null);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `boleto_financeiro_${id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('comprovantes_investimento')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase
        .from('cm_acoes_investimento')
        .update({ financeiro_boleto_url: fileName })
        .eq('id', id);
      if (dbError) throw dbError;
      setData(prev => prev.map(item => item.id === id ? { ...item, financeiro_boleto_url: fileName } : item));
      setSelectedAction(prev => prev && prev.id === id ? { ...prev, financeiro_boleto_url: fileName } : prev);
      setFeedback({ type: 'success', msg: 'Boleto do cliente anexado com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: 'Erro ao anexar boleto: ' + err.message });
    } finally {
      setUploadingBoletoFinanceiro(false);
    }
  };

  const handleViewDocument = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("comprovantes_investimento")
        .createSignedUrl(filePath, 60 * 5); // 5 minutes
        
      if (error) throw error;
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", msg: "Erro ao abrir o comprovante: " + err.message });
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: rows, error } = await supabase
        .from("v_acoes_investimento_com_gerente")
        .select("*")
        .eq("is_planejamento", false)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setData(rows || []);

      const { data: mRows, error: mError } = await supabase
        .from("v_redes_matrizes_detalhes")
        .select("*")
        .order("nome", { ascending: true });
        
      if (mError) throw mError;
      setMatrizes(mRows || []);

      // Fetch faturamento for June 2026 onwards
      const { data: salesRows } = await supabase
        .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL))
        .select("rede, mes, fat")
        .gte("mes", "2026-06");

      const fatMap: Record<string, Record<string, number>> = {};
      const totalFatMap: Record<string, number> = {};
      if (salesRows) {
        salesRows.forEach((row: any) => {
          const redeKey = row.rede ? row.rede.toUpperCase().trim() : "";
          const mesKey = row.mes || "";
          if (redeKey) {
            if (!fatMap[redeKey]) fatMap[redeKey] = {};
            const fatVal = Number(row.fat) || 0;
            fatMap[redeKey][mesKey] = (fatMap[redeKey][mesKey] || 0) + fatVal;
            totalFatMap[redeKey] = (totalFatMap[redeKey] || 0) + fatVal;
          }
        });
      }
      setFaturamentoMap(fatMap);
      setFaturamentoTotalMap(totalFatMap);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      setFeedback({ type: "error", msg: "Erro ao carregar dados: " + errMsg });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchUserPreferencesAndRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        const { data } = await supabase.from('cm_user_profiles').select('role').eq('id', user.id).single();
        if (data) setUserRole(data.role);

        // Fetch sort preferences
        try {
          const { data: prefData } = await supabase
            .from('cm_user_preferences')
            .select('investimento_sort_column, investimento_sort_direction')
            .eq('user_id', user.id)
            .maybeSingle();

          if (prefData) {
            if (prefData.investimento_sort_column) {
              setSortField(prefData.investimento_sort_column);
            }
            if (prefData.investimento_sort_direction) {
              setSortDirection(prefData.investimento_sort_direction as "asc" | "desc");
            }
          }
        } catch (prefErr) {
          console.error("Erro ao carregar preferências de ordenação:", prefErr);
        }
      }
    };
    fetchUserPreferencesAndRole();
    loadData();
  }, [loadData]);

  const formatMesReferencia = (mesStr: string | null | undefined) => {
    if (!mesStr) return "-";
    const parts = mesStr.split("-");
    if (parts.length !== 2) return mesStr;
    const [year, month] = parts;
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const idx = parseInt(month, 10) - 1;
    if (idx >= 0 && idx < 12) {
      return `${meses[idx]}/${year}`;
    }
    return mesStr;
  };



  const getGerenteAndUF = (row: any) => {
    let uf = "UF N/D";
    let manager = "SEM GERENTE";
    
    if (row.gerente_responsavel) {
      manager = row.gerente_responsavel;
    }
    
    // Look up UF in matrizes
    if (row.codigo_matriz && row.rede) {
      const cleanRede = row.rede.toUpperCase().trim();
      const match = matrizes.find((m: any) => m.codigo === row.codigo_matriz && m.nome?.toUpperCase().trim() === cleanRede);
      if (match) {
        if (match.uf) uf = match.uf;
        if (!row.gerente_responsavel && match.gerente) manager = match.gerente;
      } else {
        const fallbackMatch = matrizes.find((m: any) => m.codigo === row.codigo_matriz);
        if (fallbackMatch) {
          if (fallbackMatch.uf) uf = fallbackMatch.uf;
          if (!row.gerente_responsavel && fallbackMatch.gerente) manager = fallbackMatch.gerente;
        }
      }
    } else if (row.rede) {
      const cleanRede = row.rede.toUpperCase().trim();
      const match = matrizes.find((m: any) => m.nome?.toUpperCase().trim() === cleanRede);
      if (match) {
        if (match.uf) uf = match.uf;
        if (!row.gerente_responsavel && match.gerente) manager = match.gerente;
      }
    }
    
    return { uf, manager };
  };

  const mesesDisponiveis = useMemo(() => {
    const meses = managerFilteredAcoes.map(d => d.mes_referencia).filter(Boolean) as string[];
    return Array.from(new Set(meses)).sort((a, b) => b.localeCompare(a));
  }, [managerFilteredAcoes]);

  const filteredData = useMemo(() => {
    return managerFilteredAcoes.filter(r => {
      if (viewMode !== 'matrix' && viewMode !== 'calendar' && filterFase !== null && (r.fase_atual || 1) !== filterFase) return false;
      if (filterRede && r.rede !== filterRede) return false;
      if (filterFamilia) {
        const hasFamilia = r.familias_detalhes && r.familias_detalhes.length > 0
          ? r.familias_detalhes.some(f => f.familia_nome === filterFamilia)
          : r.familia_produto === filterFamilia;
        if (!hasFamilia) return false;
      }
      if (filterDataInicio && r.data_inicio < filterDataInicio) return false;
      if (filterDataFim && r.data_inicio > filterDataFim) return false;
      if (filterMes && r.mes_referencia !== filterMes) return false;
      
      // Filtros adicionados para a Auditoria e UX
      if (filterGerente && r.gerente_responsavel !== filterGerente) return false;
      if (filterStatus) {
        const status = calcularStatusItemInvestimento(r, r.fase_atual || 1, r.apuracao_preenchida_em);
        if (status !== filterStatus) return false;
      }

      // Busca global
      if (globalSearch) {
        const searchLower = globalSearch.toLowerCase();
        const matchSearch =
          (r.rede && r.rede.toLowerCase().includes(searchLower)) ||
          (r.gerente_responsavel && r.gerente_responsavel.toLowerCase().includes(searchLower)) ||
          (r.codigo_campanha && r.codigo_campanha.toLowerCase().includes(searchLower)) ||
          (r.nome_campanha && r.nome_campanha.toLowerCase().includes(searchLower)) ||
          (r.numero_acordo && r.numero_acordo.toLowerCase().includes(searchLower)) ||
          (r.codigo && r.codigo.toString().includes(searchLower)) ||
          (r.familia_produto && r.familia_produto.toLowerCase().includes(searchLower)) ||
          (r.familias_detalhes && r.familias_detalhes.some((f: any) => f.familia_nome && f.familia_nome.toLowerCase().includes(searchLower)));
        if (!matchSearch) return false;
      }
      
      return true;
    });
  }, [managerFilteredAcoes, filterRede, filterFamilia, filterDataInicio, filterDataFim, filterFase, filterMes, viewMode, filterGerente, filterStatus, globalSearch]);

  const handleSort = async (field: string) => {
    let newDirection: "asc" | "desc" = "asc";
    let newField = field;
    if (sortField === field) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      newField = field;
      newDirection = "asc";
    }

    setSortField(newField);
    setSortDirection(newDirection);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("cm_user_preferences")
          .upsert({
            user_id: user.id,
            investimento_sort_column: newField,
            investimento_sort_direction: newDirection,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }
    } catch (err) {
      console.error("Erro ao salvar preferência de ordenação:", err);
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-gold" />;
    }
    return <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-gold" />;
  };

  const groupedRenderableData = useMemo(() => {
    const items: Array<{
      type: "campaign";
      id: string;
      codigo_campanha: string;
      nome_campanha: string;
      rede: string;
      codigo_matriz?: string | null;
      mes_referencia?: string | null;
      status_operacional_campanha: string;
      status_financeiro_campanha: string;
      valor_previsto: number;
      valor_homologado: number;
      valor_pago: number;
      saldo: number;
      acoes: any[];
    } | {
      type: "legacy";
      id: string;
      action: any;
    }> = [];

    const campaignGroupsMap: Record<string, any> = {};

    filteredData.forEach((action) => {
      if (!action.campanha_id) {
        items.push({
          type: "legacy",
          id: action.id,
          action
        });
      } else {
        let group = campaignGroupsMap[action.campanha_id];
        if (!group) {
          group = {
            type: "campaign",
            id: action.campanha_id,
            codigo_campanha: action.codigo_campanha || "Campanha",
            nome_campanha: action.nome_campanha || `Campanha ${action.rede}`,
            rede: action.rede,
            codigo_matriz: action.codigo_matriz,
            mes_referencia: action.mes_referencia,
            status_operacional_campanha: action.status_operacional_campanha || "PLANEJAMENTO",
            status_financeiro_campanha: action.status_financeiro_campanha || "ABERTA",
            valor_previsto: 0,
            valor_homologado: 0,
            valor_pago: 0,
            saldo: 0,
            acoes: []
          };
          campaignGroupsMap[action.campanha_id] = group;
          items.push(group);
        }
        
        group.acoes.push(action);
        
        // Calcular valores consolidados
        const val = getValorTotal(action);
        group.valor_previsto += val;
        if ((action.fase_atual || 1) >= 3) {
          group.valor_homologado += val;
        }
        if ((action.fase_atual || 1) === 6 || action.status_financeiro_acao === 'QUITADA') {
          group.valor_pago += (action.apuracao_valor_realizado || val);
        }
      }
    });

    // Calcular saldos consolidados
    items.forEach((item) => {
      if (item.type === "campaign") {
        item.saldo = Math.max(0, item.valor_homologado - item.valor_pago);
      }
    });

    // Ordenar itens se sortField estiver definido
    if (sortField) {
      items.sort((a, b) => {
        let valA: any = "";
        let valB: any = "";

        if (sortField === "codigo") {
          valA = a.type === "campaign" ? a.codigo_campanha : a.action.codigo || "";
          valB = b.type === "campaign" ? b.codigo_campanha : b.action.codigo || "";
        } else if (sortField === "data_registro") {
          valA = a.type === "campaign" ? "" : (a.action.data_registro || "");
          valB = b.type === "campaign" ? "" : (b.action.data_registro || "");
        } else if (sortField === "rede") {
          valA = a.type === "campaign" ? a.rede : (a.action.rede || "");
          valB = b.type === "campaign" ? b.rede : (b.action.rede || "");
        } else if (sortField === "mes") {
          valA = a.type === "campaign" ? (a.mes_referencia || "") : (a.action.mes_referencia || "");
          valB = b.type === "campaign" ? (b.mes_referencia || "") : (b.action.mes_referencia || "");
        } else if (sortField === "periodo") {
          if (a.type === "campaign") {
            const dates = a.acoes.map((ac: any) => ac.data_inicio).filter(Boolean);
            valA = dates.length > 0 ? [...dates].sort()[0] : "";
          } else {
            valA = a.action.data_inicio || "";
          }
          if (b.type === "campaign") {
            const dates = b.acoes.map((ac: any) => ac.data_inicio).filter(Boolean);
            valB = dates.length > 0 ? [...dates].sort()[0] : "";
          } else {
            valB = b.action.data_inicio || "";
          }
        } else if (sortField === "tipo") {
          valA = a.type === "campaign" ? "Campanha" : (a.action.tipo_acao || "");
          valB = b.type === "campaign" ? "Campanha" : (b.action.tipo_acao || "");
        } else if (sortField === "fase") {
          valA = a.type === "campaign" ? 0 : (a.action.fase_atual || 1);
          valB = b.type === "campaign" ? 0 : (b.action.fase_atual || 1);
        } else if (sortField === "valor") {
          valA = a.type === "campaign" ? a.valor_previsto : getValorTotal(a.action);
          valB = b.type === "campaign" ? b.valor_previsto : getValorTotal(b.action);
        } else if (sortField === "exp_vol") {
          valA = a.type === "campaign" ? a.acoes.reduce((sum, ac) => sum + (ac.expectativa_volume || 0), 0) : (a.action.expectativa_volume || 0);
          valB = b.type === "campaign" ? b.acoes.reduce((sum, ac) => sum + (ac.expectativa_volume || 0), 0) : (b.action.expectativa_volume || 0);
        }

        if (typeof valA === "number" && typeof valB === "number") {
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortDirection === "asc" ? -1 : 1;
        if (strA > strB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [filteredData, sortField, sortDirection]);

  // Efeito de auto-expansão ao buscar/filtrar
  useEffect(() => {
    if (globalSearch || filterFamilia) {
      const expanded: Record<string, boolean> = {};
      filteredData.forEach(action => {
        if (action.campanha_id) {
          expanded[action.campanha_id] = true;
        }
      });
      setExpandedCampaigns(expanded);
    }
  }, [filteredData, globalSearch, filterFamilia]);

  const gerentesDisponiveis = useMemo(() => {
    const fromMatrizes = matrizes.map(m => m.gerente).filter(Boolean);
    const fromActions = data.map(r => r.gerente_responsavel).filter(Boolean);
    return Array.from(new Set([...fromMatrizes, ...fromActions])).sort();
  }, [matrizes, data]);

  const coverageMetrics = useMemo(() => {
    const baseActions = managerFilteredAcoes;
    const actionsForMetrics = baseActions.filter(r => {
      if (filterGerente && r.gerente_responsavel !== filterGerente) return false;
      if (filterMes && r.mes_referencia !== filterMes) return false;
      if (filterStatus) {
        const status = calcularStatusItemInvestimento(r, r.fase_atual || 1, r.apuracao_preenchida_em);
        if (status !== filterStatus) return false;
      }
      return true;
    });

    let baseMatrizes = myMatrizes;
    if (filterGerente) {
      const cleanFilterG = filterGerente.toLowerCase().replace(/[^a-z0-9]/g, "");
      baseMatrizes = matrizes.filter(m => {
        if (!m.gerente) return false;
        const cleanGerente = m.gerente.toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanFilterG === cleanGerente;
      });
    }

    // Filtrar apenas clientes com compra (faturamento > 0)
    baseMatrizes = baseMatrizes.filter(m => {
      const redeKey = m.nome ? m.nome.toUpperCase().trim() : "";
      return (faturamentoTotalMap[redeKey] || 0) > 0;
    });

    const totalRedesCadastradas = baseMatrizes.length;

    const activeNetworkNames = new Set(actionsForMetrics.map(r => r.rede.toUpperCase().trim()));
    const redesComInvestimento = baseMatrizes.filter(m => {
      const nameKey = m.nome ? m.nome.toUpperCase().trim() : "";
      return activeNetworkNames.has(nameKey);
    }).length;

    const cobertura = totalRedesCadastradas > 0 ? Math.round((redesComInvestimento / totalRedesCadastradas) * 100) : 0;

    let valorPlanejado = 0;
    let valorAprovado = 0;
    let valorRealizado = 0;

    actionsForMetrics.forEach(action => {
      const val = getValorTotal(action);
      if ((action.fase_atual || 1) === 1) {
        valorPlanejado += val;
      }
      if ((action.fase_atual || 1) >= 3) {
        valorAprovado += val;
      }
      if ((action.fase_atual || 1) >= 4 || !!action.apuracao_preenchida_em) {
        valorRealizado += (action.apuracao_valor_realizado || val);
      }
    });

    return {
      totalRedesCadastradas,
      redesComInvestimento,
      cobertura,
      valorPlanejado,
      valorAprovado,
      valorRealizado
    };
  }, [managerFilteredAcoes, myMatrizes, matrizes, filterGerente, filterMes, filterStatus, faturamentoTotalMap]);

  const autoFilterAlert = useMemo(() => {
    if (!filterRede) return null;
    
    const currentCount = filteredData.length;
    if (currentCount > 0) return null;

    const otherActions = managerFilteredAcoes.filter(r => r.rede === filterRede);
    if (otherActions.length === 0) return null;

    const uniqueMonths = Array.from(new Set(otherActions.map(r => r.mes_referencia).filter(Boolean))) as string[];
    const uniqueFases = Array.from(new Set(otherActions.map(r => r.fase_atual || 1))) as number[];
    const uniqueGerentes = Array.from(new Set(otherActions.map(r => r.gerente_responsavel).filter(Boolean))) as string[];
    const uniqueStatuses = Array.from(new Set(otherActions.map(r => calcularStatusItemInvestimento(r, r.fase_atual || 1, r.apuracao_preenchida_em)))) as string[];

    const targetMonth = uniqueMonths[0] || "";
    const targetFase = uniqueFases[0] || null;
    const targetGerente = uniqueGerentes[0] || "";
    const targetStatus = uniqueStatuses[0] || "";

    return {
      months: uniqueMonths,
      fases: uniqueFases,
      gerentes: uniqueGerentes,
      statuses: uniqueStatuses,
      totalCount: otherActions.length,
      targetMonth,
      targetFase,
      targetGerente,
      targetStatus
    };
  }, [filterRede, filteredData.length, managerFilteredAcoes]);

  const getAuditConclusiveDiagnosis = (auditData: any) => {
    if (!auditData) return null;
    if (auditData.notFound) {
      return {
        severity: '🔴 Crítico',
        diagnosis: 'A rede não foi encontrada no cadastro mestre.',
        recommendations: 'A rede procurada não possui registros em nenhuma das tabelas mestre (cm_clientes, base_atendimento, cm_redes_matrizes ou network_matrix). Crie o cadastro mestre na página de Configuração Financeira.'
      };
    }

    const hasIncomplete = auditData.cadastro?.fase === 'comercial' && !auditData.cadastro?.cnpj;
    if (hasIncomplete) {
      return {
        severity: '🟠 Alerta',
        diagnosis: 'A rede possui inconsistências cadastrais.',
        recommendations: 'O cadastro mestre na tabela cm_clientes está travado na fase Comercial e sem CNPJ. Insira um CNPJ válido e conclua a fase comercial para que o fluxo avance para Finanças/Trade.'
      };
    }

    const totalAcoes = auditData.investimentos?.totalAcoes || 0;
    if (totalAcoes === 0) {
      return {
        severity: '🟠 Alerta',
        diagnosis: 'A rede existe, porém ainda não possui investimentos cadastrados.',
        recommendations: 'Nenhuma ação de investimento foi criada para esta rede no banco de dados. Utilize o formulário Lançar Investimento para criar ações.'
      };
    }

    const actionsList = auditData.investimentos?.acoesList || [];
    const visibleActions = actionsList.filter((r: any) => {
      if (viewMode !== 'matrix' && viewMode !== 'calendar' && filterFase !== null && (r.fase_atual || 1) !== filterFase) return false;
      if (filterMes && r.mes_referencia !== filterMes) return false;
      if (filterGerente && r.gerente_responsavel !== filterGerente) return false;
      if (filterStatus) {
        const status = calcularStatusItemInvestimento(r, r.fase_atual || 1, r.apuracao_preenchida_em);
        if (status !== filterStatus) return false;
      }
      return true;
    });

    if (visibleActions.length > 0) {
      return {
        severity: '🟢 Informativo',
        diagnosis: 'A rede está visível e operacional.',
        recommendations: 'A rede está ativa e visível no painel principal sob os filtros atuais.'
      };
    } else {
      const firstAction = actionsList[0];
      const matchMonth = firstAction.mes_referencia || '-';
      const matchFase = FASE_CONFIG[firstAction.fase_atual || 1]?.label || `Fase ${firstAction.fase_atual || 1}`;
      const matchGerente = firstAction.gerente_responsavel || 'Sem gerente';
      const matchStatus = calcularStatusItemInvestimento(firstAction, firstAction.fase_atual || 1, firstAction.apuracao_preenchida_em);
      return {
        severity: '🟡 Atenção',
        diagnosis: 'A rede existe, porém está sendo ocultada pelos filtros atuais.',
        recommendations: `As ações cadastradas para esta rede não correspondem aos filtros de Mês/Fase/Gerente/Status selecionados no painel. Localização correta de um registro: Mês: ${formatMesReferencia(matchMonth)} | Fase: ${matchFase} | Status: ${matchStatus.toLowerCase()} | Gerente: ${matchGerente}.`
      };
    }
  };

  const acoesPorGerente = useMemo(() => {
    const counts: Record<string, number> = {};
    const mainManagers = ["Leandro", "Julliano", "Luiz"];
    mainManagers.forEach(mgr => {
      counts[mgr] = 0;
    });

    filteredData.forEach(action => {
      const rawG = action.gerente_responsavel;
      if (rawG) {
        const matched = mainManagers.find(m => m.toLowerCase() === rawG.toLowerCase());
        if (matched) {
          counts[matched]++;
        } else {
          counts[rawG] = (counts[rawG] || 0) + 1;
        }
      } else {
        counts["Sem Gerente"] = (counts["Sem Gerente"] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([manager, count]) => ({ manager, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const consolidadoGerenteMes = useMemo(() => {
    const mainManagers = ["Leandro", "Julliano", "Luiz"];
    const counts: Record<string, Record<string, { networks: Set<string>; actionsCount: number }>> = {};

    // Initialize counts for main managers
    mainManagers.forEach(mgr => {
      counts[mgr] = {};
      MATRIX_MONTHS.forEach(m => {
        counts[mgr][m.value] = { networks: new Set<string>(), actionsCount: 0 };
      });
    });

    filteredData.forEach(action => {
      let mgr = "Sem Gerente";
      const rawG = action.gerente_responsavel;
      if (rawG) {
        const matched = mainManagers.find(m => m.toLowerCase() === rawG.toLowerCase());
        mgr = matched || rawG;
      }

      if (!counts[mgr]) {
        counts[mgr] = {};
        MATRIX_MONTHS.forEach(m => {
          counts[mgr][m.value] = { networks: new Set<string>(), actionsCount: 0 };
        });
      }

      const mes = action.mes_referencia;
      if (mes && counts[mgr][mes]) {
        counts[mgr][mes].actionsCount++;
        const netId = action.codigo_matriz || action.rede?.toUpperCase().trim() || "N/I";
        counts[mgr][mes].networks.add(netId);
      }
    });

    return Object.entries(counts).map(([manager, monthsData]) => {
      const formattedMonths: Record<string, { networksCount: number; actionsCount: number }> = {};
      Object.entries(monthsData).forEach(([month, val]) => {
        formattedMonths[month] = {
          networksCount: val.networks.size,
          actionsCount: val.actionsCount
        };
      });
      return {
        manager,
        months: formattedMonths,
        totalActions: Object.values(formattedMonths).reduce((acc, curr) => acc + curr.actionsCount, 0)
      };
    }).sort((a, b) => b.totalActions - a.totalActions);
  }, [filteredData]);

  const acoesNoMesCount = useCallback((m: any, mes: string) => {
    return managerFilteredAcoes.filter(action => {
      const matchesNetwork = action.codigo_matriz === m.codigo || 
        (action.rede && action.rede.toUpperCase().trim() === m.nome.toUpperCase().trim());
      if (!matchesNetwork) return false;
      if (action.mes_referencia !== mes) return false;

      if (filterGerente) {
        const cleanFilterG = filterGerente.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!action.gerente_responsavel) return false;
        const cleanGerente = action.gerente_responsavel.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanFilterG !== cleanGerente) return false;
      }

      if (filterStatus) {
        const status = calcularStatusItemInvestimento(action, action.fase_atual || 1, action.apuracao_preenchida_em);
        if (status !== filterStatus) return false;
      }

      if (filterFamilia) {
        const hasFamilia = action.familias_detalhes && action.familias_detalhes.length > 0
          ? action.familias_detalhes.some(f => f.familia_nome === filterFamilia)
          : action.familia_produto === filterFamilia;
        if (!hasFamilia) return false;
      }

      return true;
    }).length;
  }, [managerFilteredAcoes, filterGerente, filterStatus, filterFamilia]);

  const sortedMatrizesWithInvestimento = useMemo(() => {
    return myMatrizes.map(m => {
      const acoesCount = managerFilteredAcoes.filter(action => {
        const matchesNetwork = action.codigo_matriz === m.codigo || 
          (action.rede && action.rede.toUpperCase().trim() === m.nome.toUpperCase().trim());
        if (!matchesNetwork) return false;

        if (filterGerente) {
          const cleanFilterG = filterGerente.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!action.gerente_responsavel) return false;
          const cleanGerente = action.gerente_responsavel.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cleanFilterG !== cleanGerente) return false;
        }

        if (filterStatus) {
          const status = calcularStatusItemInvestimento(action, action.fase_atual || 1, action.apuracao_preenchida_em);
          if (status !== filterStatus) return false;
        }

        if (filterFamilia) {
          const hasFamilia = action.familias_detalhes && action.familias_detalhes.length > 0
            ? action.familias_detalhes.some(f => f.familia_nome === filterFamilia)
            : action.familia_produto === filterFamilia;
          if (!hasFamilia) return false;
        }

        return true;
      }).length;
      const redeKey = m.nome ? m.nome.toUpperCase().trim() : "";
      const faturamentoTotal = faturamentoTotalMap[redeKey] || 0;
      return {
        ...m,
        acoesCount,
        faturamentoTotal
      };
    }).sort((a, b) => {
      if (b.acoesCount !== a.acoesCount) {
        return b.acoesCount - a.acoesCount;
      }
      return b.faturamentoTotal - a.faturamentoTotal;
    });
  }, [myMatrizes, managerFilteredAcoes, faturamentoTotalMap, filterGerente, filterStatus, filterFamilia]);

  const filteredMatrizesInView = useMemo(() => {
    let result = sortedMatrizesWithInvestimento;
    
    if (filterGerente) {
      const cleanFilterG = filterGerente.toLowerCase().replace(/[^a-z0-9]/g, "");
      result = result.filter(m => {
        if (!m.gerente) return false;
        const cleanGerente = m.gerente.toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanFilterG === cleanGerente;
      });
    }

    if (showOnlyWithoutActions && filterMes) {
      result = result.filter(m => acoesNoMesCount(m, filterMes) === 0);
    }
    
    if (!matrizSearch) return result;
    const searchLower = matrizSearch.toLowerCase();
    return result.filter(m => 
      (m.nome && m.nome.toLowerCase().includes(searchLower)) ||
      (m.codigo && m.codigo.toLowerCase().includes(searchLower)) ||
      (m.gerente && m.gerente.toLowerCase().includes(searchLower))
    );
  }, [sortedMatrizesWithInvestimento, filterGerente, matrizSearch, showOnlyWithoutActions, filterMes, acoesNoMesCount]);

  const faseCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    managerFilteredAcoes.forEach(r => {
      // Aplica os filtros de tela exceto o de fase
      if (filterRede && r.rede !== filterRede) return;
      if (filterFamilia) {
        const matchFam = r.abrangencia === 'Família'
          ? r.familias_detalhes?.some((f: any) => f.familia_nome === filterFamilia)
          : r.familia_produto === filterFamilia;
        if (!matchFam) return;
      }
      if (filterDataInicio && r.data_inicio < filterDataInicio) return;
      if (filterDataFim && r.data_inicio > filterDataFim) return;
      if (filterMes && r.mes_referencia !== filterMes) return;

      const f = r.fase_atual || 1;
      if (counts[f] !== undefined) counts[f]++;
    });
    return counts;
  }, [managerFilteredAcoes, filterRede, filterFamilia, filterDataInicio, filterDataFim, filterMes]);

  const totalFilteredCount = useMemo(() => {
    let total = 0;
    managerFilteredAcoes.forEach(r => {
      if (filterRede && r.rede !== filterRede) return;
      if (filterFamilia) {
        const matchFam = r.abrangencia === 'Família'
          ? r.familias_detalhes?.some((f: any) => f.familia_nome === filterFamilia)
          : r.familia_produto === filterFamilia;
        if (!matchFam) return;
      }
      if (filterDataInicio && r.data_inicio < filterDataInicio) return;
      if (filterDataFim && r.data_inicio > filterDataFim) return;
      if (filterMes && r.mes_referencia !== filterMes) return;
      total++;
    });
    return total;
  }, [managerFilteredAcoes, filterRede, filterFamilia, filterDataInicio, filterDataFim, filterMes]);

  const handlePhaseAction = async (id: string, action: () => Promise<any>) => {
    setActionLoading(id);
    try {
      await action();
      await loadData();
      setFeedback({ type: "success", msg: "Ação atualizada com sucesso!" });
      setTimeout(() => setFeedback(null), 3000);
      setSelectedAction(null);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", msg: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleActionChecklistChange = async (fieldName: 'checklist_comunicacao' | 'checklist_logistica' | 'checklist_auditoria' | 'checklist_conferencia' | 'checklist_sem_auditoria', checked: boolean) => {
    if (!selectedAction) return;

    // Preserva a posição atual do scroll no container do modal
    const currentScrollTop = modalScrollRef.current?.scrollTop;

    // Atualização otimista imediata da interface visual
    setTradeChecklist(prev => ({ ...prev, [fieldName.replace('checklist_', '')]: checked }));
    setSelectedAction(prev => prev && prev.id === selectedAction.id ? { ...prev, [fieldName]: checked } : prev);
    setData(prev => prev.map(item => item.id === selectedAction.id ? { ...item, [fieldName]: checked } : item));

    try {
      const updatedChecklist = {
        comunicacao: fieldName === 'checklist_comunicacao' ? checked : (selectedAction.checklist_comunicacao || false),
        logistica: fieldName === 'checklist_logistica' ? checked : (selectedAction.checklist_logistica || false),
        auditoria: fieldName === 'checklist_auditoria' ? checked : (selectedAction.checklist_auditoria || false),
        garantia: selectedAction.checklist_garantia || false,
        conferencia: fieldName === 'checklist_conferencia' ? checked : (selectedAction.checklist_conferencia || false),
        sem_auditoria: fieldName === 'checklist_sem_auditoria' ? checked : (selectedAction.checklist_sem_auditoria || false),
        divergencia: {
          possui: tradeDivergencia.possui,
          motivo: (tradeDivergencia.motivo as MotivoDivergencia) || null,
          observacao: tradeDivergencia.observacao || null,
        }
      };

      await atualizarChecklistTrade(selectedAction.id, updatedChecklist);
    } catch (err: any) {
      console.error(err);
      // Reverte o estado visual em caso de falha na gravação
      setTradeChecklist(prev => ({ ...prev, [fieldName.replace('checklist_', '')]: !checked }));
      setSelectedAction(prev => prev && prev.id === selectedAction.id ? { ...prev, [fieldName]: !checked } : prev);
      setData(prev => prev.map(item => item.id === selectedAction.id ? { ...item, [fieldName]: !checked } : item));
      alert("Erro ao salvar checklist: " + err.message);
    } finally {
      // Garante a manutenção perfeita da posição do scroll
      if (modalScrollRef.current && currentScrollTop !== undefined) {
        modalScrollRef.current.scrollTop = currentScrollTop;
      }
    }
  };

  const handleActionEvidenceUpload = async (file: File | null) => {
    if (!file || !selectedAction) return;
    setActionLoading(selectedAction.id);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `evidence_${selectedAction.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("comprovantes_investimento")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const currentEvidencias = Array.isArray(selectedAction.evidencias_urls) ? selectedAction.evidencias_urls : [];
      const updatedEvidencias = [...currentEvidencias, fileName];

      const { error: dbError } = await supabase
        .from("cm_acoes_investimento")
        .update({ evidencias_urls: updatedEvidencias })
        .eq("id", selectedAction.id);

      if (dbError) throw dbError;

      setData(prev => prev.map(item => item.id === selectedAction.id ? { ...item, evidencias_urls: updatedEvidencias } : item));
      setSelectedAction(prev => prev && prev.id === selectedAction.id ? { ...prev, evidencias_urls: updatedEvidencias } : prev);
      
      setFeedback({ type: "success", msg: "Evidência anexada com sucesso!" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao enviar evidência: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };


  const handleApuracaoSubmit = async () => {
    if (!selectedAction) return;
    try {
      if (clientHasBoletoCondition && vinculosBoletos.length === 0 && !semBoleto) {
        throw new Error("Por favor, vincule pelo menos um boleto ou sinalize que o cliente não possui boletos em aberto.");
      }

      setActionLoading(selectedAction.id);
      const fd = new FormData();
      fd.append('apuracao_numero_acordo', apuracaoForm.numero_acordo);
      fd.append('apuracao_qtd_vendida', apuracaoForm.qtd_vendida);
      fd.append('apuracao_valor_realizado', apuracaoForm.valor_realizado);
      
      // Enviar a lista completa de boletos vinculados e seus valores associados
      fd.append('vinculos_boletos', JSON.stringify(vinculosBoletos.map(v => ({
        boleto_id: v.boleto_id,
        valor_associado: parseFloat(v.valor_associado.replace(',', '.')) || 0
      }))));
      
      // Enviar o primeiro ID de boleto para compatibilidade com a coluna legada
      fd.append('apuracao_boleto_id', vinculosBoletos[0]?.boleto_id || "");
      
      // se tivesse arquivo no form, seria adicionado aqui. Como o usuário pede apenas evidência como URL,
      // usaremos string se tiver, mas para arquivos teríamos que usar supabase storage.
      // Vou focar apenas nos campos do form e no upload separado, ou usar um text input por agora.
      fd.append('apuracao_evidencias_url', apuracaoForm.evidencias_url);
      fd.append('condicao_pagamento', apuracaoForm.condicao_pagamento);
      fd.append('sem_boleto', semBoleto ? 'true' : 'false');
      
      const { preencherApuracao } = await import('./lancar/actions');
      await preencherApuracao(selectedAction.id, fd);
      
      setFeedback({ type: "success", msg: "Apuração salva com sucesso!" });
      loadData();
      setSelectedAction(null);
    } catch (error: any) {
      setFeedback({ type: "error", msg: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const subtotal = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + getValorTotal(curr), 0);
  }, [filteredData]);

  const paginatedData = useMemo(() => {
    const start = page * itemsPerPage;
    return groupedRenderableData.slice(start, start + itemsPerPage);
  }, [groupedRenderableData, page]);

  const totalPages = Math.ceil(groupedRenderableData.length / itemsPerPage);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    
    try {
      const { error } = await supabase.from("cm_acoes_investimento").delete().eq("id", id);
      if (error) throw error;
      
      setData(prev => prev.filter(item => item.id !== id));
      setFeedback({ type: "success", msg: "Lançamento excluído com sucesso." });
      
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: "error", msg: "Erro ao excluir: " + err.message });
    }
  };

  const formatCurrency = (value: number, showCents = true) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(value);
  };

  const getPrecoAcaoStr = (action: AcaoInvestimento) => {
    if (action.abrangencia === "SKU") {
      if (action.skus_detalhes && action.skus_detalhes.length > 0) {
        if (action.skus_detalhes.length === 1) {
          return action.skus_detalhes[0].preco_acao ? formatCurrency(action.skus_detalhes[0].preco_acao) : '-';
        }
        return 'Múltiplos';
      }
      return '-';
    } else if (action.familias_detalhes && action.familias_detalhes.length > 0) {
      if (action.familias_detalhes.length === 1) {
        return action.familias_detalhes[0].preco_acao ? formatCurrency(action.familias_detalhes[0].preco_acao) : '-';
      }
      return 'Múltiplos';
    } else {
      return action.preco_acao ? formatCurrency(action.preco_acao) : '-';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const exportToCSV = () => {
    if (filteredData.length === 0) {
      setFeedback({ type: "error", msg: "Não há dados para exportar." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const headers = [
      "Código",
      "Data Registro",
      "Código Campanha",
      "Nome Campanha",
      "Valor Consolidado Campanha (Apenas Ref. - NÃO Somar em Pivôs)",
      "Gerente Responsável",
      "Rede",
      "Código Matriz",
      "Mês Referência",
      "Abrangência",
      "Tipo Ação",
      "Fase Atual",
      "Modo de Datas",
      "Data Início",
      "Data Fim",
      "Família Produto",
      "Preço Flat (Un/Média)",
      "Preço Ação (Un/Média)",
      "Valor Investimento",
      "Expectativa Volume",
      "Condição Pagamento",
      "Número Acordo",
      "Checklist Comunicação",
      "Checklist Logística",
      "Checklist Auditoria",
      "Checklist Garantia",
      "Checklist Conferência",
      "Apuração Preenchida Em",
      "Apuração Qtd Vendida",
      "Apuração Valor Realizado",
      "Apuração Número Acordo",
      "Sem Boleto?",
      "Boleto ID",
      "Financeiro Pago Em",
      "Financeiro Pago Por",
      "Financeiro Observações",
      "ROI",
      "Volume Real",
      "Faturamento Real",
      "Margem Real",
      "Aprovado Por",
      "Aprovado Em",
      "Motivo Reabertura",
      "Comentário Aprovação",
      "Motivo Rejeição",
      "Motivo Cancelamento",
      "Score de Execução",
      "Família Detalhes",
      "SKU Detalhes",
      "Documento URL",
      "Evidências URLs",
      "Comprovante Pagamento URL",
      "Boleto URL",
      "Possui Divergência Operacional",
      "Motivo Divergência",
      "Observação Divergência"
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };
    
    // Pré-calcular previsto consolidado por campanha para referenciar nas linhas filhas
    const campaignValPrevMap: Record<string, number> = {};
    filteredData.forEach(r => {
      if (r.campanha_id) {
        const val = getValorTotal(r);
        campaignValPrevMap[r.campanha_id] = (campaignValPrevMap[r.campanha_id] || 0) + val;
      }
    });

    const csvRows: string[] = [];

    filteredData.forEach(row => {
      if (row.abrangencia !== "SKU" && row.familias_detalhes && row.familias_detalhes.length > 0) {
        row.familias_detalhes.forEach(f => {
          const flatVal = f.preco_flat != null ? f.preco_flat : row.preco_flat;
          const acaoVal = f.preco_acao != null ? f.preco_acao : row.preco_acao;
          const invVal = f.investimento != null ? f.investimento : row.valor_investimento;
          const volVal = f.expectativa_volume != null ? f.expectativa_volume : row.expectativa_volume;
          const startDate = (f as any).start_date || row.data_inicio;
          const endDate = (f as any).end_date || row.data_fim;

          csvRows.push([
            escapeCSV(row.codigo),
            escapeCSV(row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.codigo_campanha || ""),
            escapeCSV(row.nome_campanha || ""),
            escapeCSV(row.campanha_id && campaignValPrevMap[row.campanha_id] != null ? campaignValPrevMap[row.campanha_id].toString().replace('.', ',') : ""),
            escapeCSV(row.gerente_responsavel),
            escapeCSV(row.rede),
            escapeCSV(row.codigo_matriz),
            escapeCSV(row.mes_referencia),
            escapeCSV(row.abrangencia),
            escapeCSV(row.tipo_acao),
            escapeCSV(FASE_CONFIG[row.fase_atual || 1]?.label || "Planej. GRV"),
            escapeCSV(row.date_mode || "single"),
            escapeCSV(formatDate(startDate)),
            escapeCSV(formatDate(endDate)),
            escapeCSV(f.familia_nome),
            escapeCSV(flatVal != null ? flatVal.toString().replace('.', ',') : ""),
            escapeCSV(acaoVal != null ? acaoVal.toString().replace('.', ',') : ""),
            escapeCSV(invVal != null ? invVal.toString().replace('.', ',') : ""),
            escapeCSV(volVal != null ? volVal.toString() : ""),
            escapeCSV(row.condicao_pagamento),
            escapeCSV(row.numero_acordo),
            escapeCSV(row.checklist_comunicacao ? "Sim" : "Não"),
            escapeCSV(row.checklist_logistica ? "Sim" : "Não"),
            escapeCSV(row.checklist_auditoria ? "Sim" : "Não"),
            escapeCSV(row.checklist_garantia ? "Sim" : "Não"),
            escapeCSV(row.checklist_conferencia ? "Sim" : "Não"),
            escapeCSV(row.apuracao_preenchida_em ? new Date(row.apuracao_preenchida_em).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.apuracao_qtd_vendida != null ? row.apuracao_qtd_vendida.toString() : ""),
            escapeCSV(row.apuracao_valor_realizado != null ? row.apuracao_valor_realizado.toString().replace('.', ',') : ""),
            escapeCSV(row.apuracao_numero_acordo),
            escapeCSV(row.sem_boleto ? "Sim" : "Não"),
            escapeCSV(row.apuracao_boleto_id),
            escapeCSV(row.financeiro_pago_em ? new Date(row.financeiro_pago_em).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.financeiro_pago_por),
            escapeCSV(row.financeiro_observacoes),
            escapeCSV(row.roi != null ? row.roi.toString().replace('.', ',') : ""),
            escapeCSV(row.real_volume != null ? row.real_volume.toString() : ""),
            escapeCSV(row.real_faturamento != null ? row.real_faturamento.toString().replace('.', ',') : ""),
            escapeCSV(row.real_margem != null ? row.real_margem.toString().replace('.', ',') : ""),
            escapeCSV(row.approved_by),
            escapeCSV(row.approved_at ? new Date(row.approved_at).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.reopened_reason),
            escapeCSV(row.approval_comment),
            escapeCSV(row.rejection_reason),
            escapeCSV(row.cancel_reason),
            escapeCSV(row.execution_score != null ? row.execution_score.toString() : ""),
            escapeCSV(row.familias_detalhes ? JSON.stringify(row.familias_detalhes) : ""),
            escapeCSV(row.skus_detalhes ? JSON.stringify(row.skus_detalhes) : ""),
            escapeCSV(row.documento_url),
            escapeCSV(row.evidencias_urls ? row.evidencias_urls.join(", ") : ""),
            escapeCSV(row.financeiro_comprovante_url),
            escapeCSV(row.financeiro_boleto_url),
             escapeCSV(row.possui_divergencia_calendario ? "Sim" : "Não"),
             escapeCSV(row.motivo_divergencia_calendario ? (MOTIVOS_DIVERGENCIA[row.motivo_divergencia_calendario as MotivoDivergencia] || row.motivo_divergencia_calendario) : ""),
             escapeCSV(row.observacao_divergencia || "")
          ].join(";"));
        });
      } else if (row.abrangencia === "SKU" && row.skus_detalhes && row.skus_detalhes.length > 0) {
        row.skus_detalhes.forEach(s => {
          const flatVal = s.preco_flat != null ? s.preco_flat : row.preco_flat;
          const acaoVal = s.preco_acao != null ? s.preco_acao : row.preco_acao;
          const invVal = s.investimento != null ? s.investimento : row.valor_investimento;
          const volVal = s.expectativa_volume != null ? s.expectativa_volume : row.expectativa_volume;
          const startDate = s.start_date || row.data_inicio;
          const endDate = s.end_date || row.data_fim;

          csvRows.push([
            escapeCSV(row.codigo),
            escapeCSV(row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.codigo_campanha || ""),
            escapeCSV(row.nome_campanha || ""),
            escapeCSV(row.campanha_id && campaignValPrevMap[row.campanha_id] != null ? campaignValPrevMap[row.campanha_id].toString().replace('.', ',') : ""),
            escapeCSV(row.gerente_responsavel),
            escapeCSV(row.rede),
            escapeCSV(row.codigo_matriz),
            escapeCSV(row.mes_referencia),
            escapeCSV(row.abrangencia),
            escapeCSV(row.tipo_acao),
            escapeCSV(FASE_CONFIG[row.fase_atual || 1]?.label || "Planej. GRV"),
            escapeCSV(row.date_mode || "single"),
            escapeCSV(formatDate(startDate)),
            escapeCSV(formatDate(endDate)),
            escapeCSV(s.sku),
            escapeCSV(flatVal != null ? flatVal.toString().replace('.', ',') : ""),
            escapeCSV(acaoVal != null ? acaoVal.toString().replace('.', ',') : ""),
            escapeCSV(invVal != null ? invVal.toString().replace('.', ',') : ""),
            escapeCSV(volVal != null ? volVal.toString() : ""),
            escapeCSV(row.condicao_pagamento),
            escapeCSV(row.numero_acordo),
            escapeCSV(row.checklist_comunicacao ? "Sim" : "Não"),
            escapeCSV(row.checklist_logistica ? "Sim" : "Não"),
            escapeCSV(row.checklist_auditoria ? "Sim" : "Não"),
            escapeCSV(row.checklist_garantia ? "Sim" : "Não"),
            escapeCSV(row.checklist_conferencia ? "Sim" : "Não"),
            escapeCSV(row.apuracao_preenchida_em ? new Date(row.apuracao_preenchida_em).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.apuracao_qtd_vendida != null ? row.apuracao_qtd_vendida.toString() : ""),
            escapeCSV(row.apuracao_valor_realizado != null ? row.apuracao_valor_realizado.toString().replace('.', ',') : ""),
            escapeCSV(row.apuracao_numero_acordo),
            escapeCSV(row.sem_boleto ? "Sim" : "Não"),
            escapeCSV(row.apuracao_boleto_id),
            escapeCSV(row.financeiro_pago_em ? new Date(row.financeiro_pago_em).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.financeiro_pago_por),
            escapeCSV(row.financeiro_observacoes),
            escapeCSV(row.roi != null ? row.roi.toString().replace('.', ',') : ""),
            escapeCSV(row.real_volume != null ? row.real_volume.toString() : ""),
            escapeCSV(row.real_faturamento != null ? row.real_faturamento.toString().replace('.', ',') : ""),
            escapeCSV(row.real_margem != null ? row.real_margem.toString().replace('.', ',') : ""),
            escapeCSV(row.approved_by),
            escapeCSV(row.approved_at ? new Date(row.approved_at).toLocaleDateString("pt-BR") : ""),
            escapeCSV(row.reopened_reason),
            escapeCSV(row.approval_comment),
            escapeCSV(row.rejection_reason),
            escapeCSV(row.cancel_reason),
            escapeCSV(row.execution_score != null ? row.execution_score.toString() : ""),
            escapeCSV(row.familias_detalhes ? JSON.stringify(row.familias_detalhes) : ""),
            escapeCSV(row.skus_detalhes ? JSON.stringify(row.skus_detalhes) : ""),
            escapeCSV(row.documento_url),
            escapeCSV(row.evidencias_urls ? row.evidencias_urls.join(", ") : ""),
            escapeCSV(row.financeiro_comprovante_url),
            escapeCSV(row.financeiro_boleto_url),
             escapeCSV(row.possui_divergencia_calendario ? "Sim" : "Não"),
             escapeCSV(row.motivo_divergencia_calendario ? (MOTIVOS_DIVERGENCIA[row.motivo_divergencia_calendario as MotivoDivergencia] || row.motivo_divergencia_calendario) : ""),
             escapeCSV(row.observacao_divergencia || "")
          ].join(";"));
        });
      } else {
        const fam = row.abrangencia === "SKU" 
          ? "Múltiplos SKUs" 
          : (row.familias_detalhes && row.familias_detalhes.length > 0 
            ? row.familias_detalhes.map((f: any) => f.familia_nome).join(", ") 
            : (row.familia_produto || ""));

        csvRows.push([
          escapeCSV(row.codigo),
          escapeCSV(row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : ""),
          escapeCSV(row.codigo_campanha || ""),
          escapeCSV(row.nome_campanha || ""),
          escapeCSV(row.campanha_id && campaignValPrevMap[row.campanha_id] != null ? campaignValPrevMap[row.campanha_id].toString().replace('.', ',') : ""),
          escapeCSV(row.gerente_responsavel),
          escapeCSV(row.rede),
          escapeCSV(row.codigo_matriz),
          escapeCSV(row.mes_referencia),
          escapeCSV(row.abrangencia),
          escapeCSV(row.tipo_acao),
          escapeCSV(FASE_CONFIG[row.fase_atual || 1]?.label || "Planej. GRV"),
          escapeCSV(row.date_mode || "single"),
          escapeCSV(formatDate(row.data_inicio)),
          escapeCSV(formatDate(row.data_fim)),
          escapeCSV(fam),
          escapeCSV(row.preco_flat != null ? row.preco_flat.toString().replace('.', ',') : ""),
          escapeCSV(row.preco_acao != null ? row.preco_acao.toString().replace('.', ',') : ""),
          escapeCSV(row.valor_investimento != null ? row.valor_investimento.toString().replace('.', ',') : ""),
          escapeCSV(row.expectativa_volume != null ? row.expectativa_volume.toString() : ""),
          escapeCSV(row.condicao_pagamento),
          escapeCSV(row.numero_acordo),
          escapeCSV(row.checklist_comunicacao ? "Sim" : "Não"),
          escapeCSV(row.checklist_logistica ? "Sim" : "Não"),
          escapeCSV(row.checklist_auditoria ? "Sim" : "Não"),
          escapeCSV(row.checklist_garantia ? "Sim" : "Não"),
          escapeCSV(row.checklist_conferencia ? "Sim" : "Não"),
          escapeCSV(row.apuracao_preenchida_em ? new Date(row.apuracao_preenchida_em).toLocaleDateString("pt-BR") : ""),
          escapeCSV(row.apuracao_qtd_vendida != null ? row.apuracao_qtd_vendida.toString() : ""),
          escapeCSV(row.apuracao_valor_realizado != null ? row.apuracao_valor_realizado.toString().replace('.', ',') : ""),
          escapeCSV(row.apuracao_numero_acordo),
          escapeCSV(row.sem_boleto ? "Sim" : "Não"),
          escapeCSV(row.apuracao_boleto_id),
          escapeCSV(row.financeiro_pago_em ? new Date(row.financeiro_pago_em).toLocaleDateString("pt-BR") : ""),
          escapeCSV(row.financeiro_pago_por),
          escapeCSV(row.financeiro_observacoes),
          escapeCSV(row.roi != null ? row.roi.toString().replace('.', ',') : ""),
          escapeCSV(row.real_volume != null ? row.real_volume.toString() : ""),
          escapeCSV(row.real_faturamento != null ? row.real_faturamento.toString().replace('.', ',') : ""),
          escapeCSV(row.real_margem != null ? row.real_margem.toString().replace('.', ',') : ""),
          escapeCSV(row.approved_by),
          escapeCSV(row.approved_at ? new Date(row.approved_at).toLocaleDateString("pt-BR") : ""),
          escapeCSV(row.reopened_reason),
          escapeCSV(row.approval_comment),
          escapeCSV(row.rejection_reason),
          escapeCSV(row.cancel_reason),
          escapeCSV(row.execution_score != null ? row.execution_score.toString() : ""),
          escapeCSV(row.familias_detalhes ? JSON.stringify(row.familias_detalhes) : ""),
          escapeCSV(row.skus_detalhes ? JSON.stringify(row.skus_detalhes) : ""),
          escapeCSV(row.documento_url),
          escapeCSV(row.evidencias_urls ? row.evidencias_urls.join(", ") : ""),
          escapeCSV(row.financeiro_comprovante_url),
          escapeCSV(row.financeiro_boleto_url),
             escapeCSV(row.possui_divergencia_calendario ? "Sim" : "Não"),
             escapeCSV(row.motivo_divergencia_calendario ? (MOTIVOS_DIVERGENCIA[row.motivo_divergencia_calendario as MotivoDivergencia] || row.motivo_divergencia_calendario) : ""),
             escapeCSV(row.observacao_divergencia || "")
        ].join(";"));
      }
    });

    const csvContent = [
      headers.join(";"),
      ...csvRows
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // \uFEFF BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `investimentos_completo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateInvestimentoInsight = async () => {
    setAiLoading(true);
    setAiInsight(null);
    setShowAiModal(true);
    try {
      const res = await fetch('/api/coffee-ia/investimento-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investimentos: managerFilteredAcoes,
          dataAtual: new Date().toISOString().split('T')[0],
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setAiInsight(result.insight);
    } catch (err: any) {
      setAiInsight(`❌ Erro ao gerar análise: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-gold/20 selection:text-gold [color-scheme:dark]">


      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Header & Action Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20 gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 bg-elevated border border-border rounded-lg hover:bg-border transition-colors group" title="Voltar ao Menu Principal">
                <ChevronLeft className="w-5 h-5 text-muted group-hover:text-foreground transition-colors" />
                <span className="hidden sm:block text-sm font-medium text-muted group-hover:text-foreground transition-colors pr-1">Voltar</span>
              </Link>
              <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
              <div className="p-2 bg-gold/10 rounded-lg hidden sm:block">
                <TrendingUp className="w-5 h-5 text-gold" />
              </div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">Investimentos</h1>
            </div>
            <div className="sm:hidden">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {(userRole === 'Admin' || userRole === 'Financeiro' || userRole === 'Trade' || userRole === 'CEO') && (
              <Link 
                href="/financeiro/boletos"
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 bg-elevated hover:bg-border text-foreground border border-border px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
                title="Visualizar Boletos do Financeiro"
              >
                <FileText className="w-3.5 h-3.5 text-muted" />
                Financeiro
              </Link>
            )}
            <Link 
              href="/investimento/carta-anuencia"
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 bg-elevated hover:bg-border text-foreground border border-border px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Gestão de Cartas de Anuência e Quitação"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              Carta de Anuência
            </Link>
            <Link 
              href="/investimento/ajuda"
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 bg-elevated hover:bg-border text-foreground border border-border px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Guia Passo a Passo"
            >
              <HelpCircle className="w-3.5 h-3.5 text-gold" />
              Guia
            </Link>
            <Link 
              href="/investimento/lancar"
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              LANÇAR
            </Link>

            {/* AI Button - Only visible to Admin */}
            {userRole === 'Admin' && (
              <button
                onClick={generateInvestimentoInsight}
                disabled={loading || managerFilteredAcoes.length === 0}
                className="group relative flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md shadow-purple-500/10 border border-purple-400/50 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-50 overflow-hidden"
                title="Análise IA dos Investimentos"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Sparkles className="w-3.5 h-3.5 text-purple-200 relative z-10" />
                <span className="relative z-10">IA</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <div className="flex items-center gap-1 p-0.5 bg-elevated border border-border rounded-lg">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${viewMode === 'table' ? 'bg-gold text-black shadow-sm font-bold' : 'text-muted hover:text-foreground'}`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
                
                <button
                  onClick={() => {
                    setViewMode('calendar');
                    setFilterFase(null);
                  }}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${viewMode === 'calendar' ? 'bg-gold text-black shadow-sm font-bold' : 'text-muted hover:text-foreground'}`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>Calendário</span>
                </button>

                <button
                  onClick={() => setViewMode('matrix')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${viewMode === 'matrix' ? 'bg-gold text-black shadow-sm font-bold' : 'text-muted hover:text-foreground'}`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Redes</span>
                </button>
              </div>

              <button
                onClick={exportToCSV}
                disabled={loading || filteredData.length === 0}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all disabled:opacity-50"
                title="Exportar dados filtrados"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Exportar</span>
              </button>

              <button
                onClick={downloadModelExcel}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all"
                title="Planilha Modelo para Lote"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden xl:inline">Modelo</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all"
                title="Importar planilha em lote"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-500" />
                <span className="hidden xl:inline">Importar</span>
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center justify-center p-2 text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all disabled:opacity-50"
                title="Atualizar dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              
              <div className="flex items-center ml-1 pl-2 border-l border-border h-7">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Feedback messages */}
        {feedback && (
          <div className={`mx-4 sm:mx-6 mt-4 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
            feedback.type === "success" ? "bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981]" : "bg-danger/10 border border-danger/20 text-danger"
          }`}>
            {feedback.type === "error" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm">{feedback.msg}</span>
          </div>
        )}

        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col bg-background min-h-0">
          <div className="flex flex-col gap-4 mb-4">
            {/* Painel de Cobertura e KPIs do Gerente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-elevated/40 border border-border/60 rounded-2xl mb-1 backdrop-blur-sm">
              <div className="flex flex-col justify-between p-4 bg-card border border-border/40 rounded-xl shadow-sm">
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider">Cobertura Comercial</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gold">{coverageMetrics.cobertura}%</span>
                  <span className="text-muted text-xs font-semibold">
                    ({coverageMetrics.redesComInvestimento}/{coverageMetrics.totalRedesCadastradas} redes com faturamento)
                  </span>
                </div>
                <div className="w-full bg-border/40 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-gold h-full rounded-full transition-all duration-500" 
                    style={{ width: `${coverageMetrics.cobertura}%` }}
                  />
                </div>
                <span className="text-muted text-[9px] mt-2 block">
                  Gerente: <span className="text-foreground font-bold">{filterGerente || "Todos"}</span>
                </span>
              </div>

              <div className="flex flex-col justify-between p-4 bg-card border border-border/40 rounded-xl shadow-sm">
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider">Valor Planejado (Fase 1)</span>
                <span className="mt-2 text-xl font-bold text-amber-400">
                  {formatCurrency(coverageMetrics.valorPlanejado, false)}
                </span>
                <span className="text-muted text-[9px] mt-2 block">Total alocado em rascunhos</span>
              </div>

              <div className="flex flex-col justify-between p-4 bg-card border border-border/40 rounded-xl shadow-sm">
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider">Valor Aprovado (Fase 3+)</span>
                <span className="mt-2 text-xl font-bold text-blue-400">
                  {formatCurrency(coverageMetrics.valorAprovado, false)}
                </span>
                <span className="text-muted text-[9px] mt-2 block">Investimentos validados pelo Trade</span>
              </div>

              <div className="flex flex-col justify-between p-4 bg-card border border-border/40 rounded-xl shadow-sm">
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider">Valor Realizado (Apuração)</span>
                <span className="mt-2 text-xl font-bold text-emerald-400">
                  {formatCurrency(coverageMetrics.valorRealizado, false)}
                </span>
                <span className="text-muted text-[9px] mt-2 block">Faturamento físico real</span>
              </div>
            </div>

            {/* Phase Tabs - only in table mode */}
            {viewMode === 'table' && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
                <button
                  onClick={() => setFilterFase(null)}
                  className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                    filterFase === null ? 'bg-gold/15 text-gold border-gold/30 shadow-sm' : 'bg-elevated text-muted border-border hover:bg-border hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    Todas <span className="text-xs opacity-70 font-normal">({totalFilteredCount})</span>
                  </div>
                  <span className="text-[10px] opacity-60 font-normal mt-0.5">geral</span>
                </button>
                {Object.entries(FASE_CONFIG).map(([key, cfg]) => {
                  const faseNum = Number(key);
                  const count = faseCounts[faseNum] || 0;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilterFase(faseNum)}
                      className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                        filterFase === faseNum ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor} shadow-sm` : 'bg-elevated text-muted border-border hover:bg-border hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>{cfg.icon}</span> {cfg.label} <span className="text-xs opacity-70 font-normal">({count})</span>
                      </div>
                      <span className="text-[10px] opacity-60 font-normal mt-0.5">{cfg.sublabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Botão de Exibir/Ocultar Filtro ao lado das Fases */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border self-start md:self-auto ${
                  showFilters ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-elevated text-muted border-border hover:bg-border hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>{showFilters ? 'Ocultar Filtro' : 'Exibir Filtro'}</span>
                </div>
                <span className="text-[9px] opacity-60 font-normal mt-0.5">filtros de busca</span>
              </button>
            </div>
            )}

            {/* Botão de Filtro para outros Modos de Visualização (Calendário, Redes) */}
            {viewMode !== 'table' && (
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-between w-full p-3 bg-elevated border border-border rounded-xl text-sm font-semibold text-foreground"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gold" />
                  <span>{showFilters ? 'Ocultar Filtro' : 'Exibir Filtro'}</span>
                </div>
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 ${showFilters ? 'grid' : 'hidden'}`}>
              {/* Busca Global */}
              <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Pesquisa</span>
                <div className="flex items-center bg-elevated border border-border rounded-xl px-3 focus-within:ring-2 focus-within:ring-gold/50 transition-all h-[38px]">
                  <Search className="w-4 h-4 text-muted mr-2" />
                  <input
                    type="text"
                    placeholder="Código, rede, gerente, campanha, família..."
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="w-full bg-transparent py-2 text-sm text-foreground focus:outline-none placeholder:text-muted"
                  />
                  {globalSearch && (
                    <button onClick={() => setGlobalSearch("")} className="text-muted hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Mês Referência */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Mês Ref.</span>
                <select
                  value={filterMes}
                  onChange={(e) => setFilterMes(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none h-[38px]"
                >
                  <option value="">Todos os Meses</option>
                  {mesesDisponiveis.map(m => (
                    <option key={m} value={m}>{formatMesReferencia(m)}</option>
                  ))}
                </select>
              </div>

              {/* Rede */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Rede</span>
                <select
                  value={filterRede}
                  onChange={(e) => setFilterRede(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none h-[38px]"
                >
                  <option value="">Todas as Redes</option>
                  {redesDisponiveis.map((r, idx) => <option key={`${r}-${idx}`} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Família */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Família</span>
                <select
                  value={filterFamilia}
                  onChange={(e) => setFilterFamilia(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none h-[38px]"
                >
                  <option value="">Todas as Famílias</option>
                  {familiasDisponiveis.map((f, idx) => <option key={`${f}-${idx}`} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Gerente */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Gerente</span>
                <select
                  value={filterGerente}
                  onChange={(e) => setFilterGerente(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none h-[38px]"
                >
                  <option value="">Todos os Gerentes</option>
                  {gerentesDisponiveis.map((g, idx) => <option key={`${g}-${idx}`} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Status</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none h-[38px]"
                >
                  <option value="">Todos os Status</option>
                  <option value="AGENDADA">Agendada</option>
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="ENCERRADA">Encerrada</option>
                  <option value="ATRASADA">Atrasada</option>
                </select>
              </div>

              {/* Data Início */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">De</span>
                <input
                  type="date"
                  value={filterDataInicio}
                  onChange={(e) => setFilterDataInicio(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all h-[38px] [color-scheme:dark]"
                />
              </div>

              {/* Data Fim */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Até</span>
                <input
                  type="date"
                  value={filterDataFim}
                  onChange={(e) => setFilterDataFim(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all h-[38px] [color-scheme:dark]"
                />
              </div>

              {/* Botões */}
              <div className="flex flex-col gap-1.5 justify-end col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2 xl:col-span-1">
                <span className="hidden sm:inline text-[10px] font-bold text-transparent select-none uppercase tracking-wider pl-1">&nbsp;</span>
                <div className="flex gap-2 h-[38px]">
                  <button
                    onClick={() => {
                      setFilterRede("");
                      setFilterFamilia("");
                      setFilterDataInicio("");
                      setFilterDataFim("");
                      setFilterFase(null);
                      setFilterMes("");
                      setFilterGerente("");
                      setFilterStatus("");
                      setGlobalSearch("");
                      setExpandedCampaigns({});
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-xl transition-all whitespace-nowrap cursor-pointer"
                  >
                    Limpar
                  </button>

                  <button
                    onClick={() => setIsAuditModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gold bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-xl transition-all whitespace-nowrap cursor-pointer"
                  >
                    🔍 Auditar
                  </button>
                </div>
              </div>
            </div>

            {/* Alerta Inteligente de Filtros */}
            {autoFilterAlert && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in fade-in duration-200">
                <div>
                  <div className="font-semibold text-sm">Encontramos registros desta rede em outros filtros.</div>
                  <div className="text-xs opacity-90 mt-1">
                    Rede <span className="font-bold">{filterRede}</span> possui ações em:
                    <ul className="list-disc pl-4 mt-1">
                      {autoFilterAlert.months.length > 0 && (
                        <li>Mês: <span className="font-semibold">{autoFilterAlert.months.map(formatMesReferencia).join(', ')}</span></li>
                      )}
                      {autoFilterAlert.fases.length > 0 && (
                        <li>Fase: <span className="font-semibold">{autoFilterAlert.fases.map(f => FASE_CONFIG[f]?.label || `Fase ${f}`).join(', ')}</span></li>
                      )}
                      {autoFilterAlert.gerentes.length > 0 && (
                        <li>Gerente: <span className="font-semibold">{autoFilterAlert.gerentes.join(', ')}</span></li>
                      )}
                      {autoFilterAlert.statuses.length > 0 && (
                        <li>Status: <span className="font-semibold">{autoFilterAlert.statuses.map(s => s.toLowerCase()).join(', ')}</span></li>
                      )}
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (autoFilterAlert.targetMonth) setFilterMes(autoFilterAlert.targetMonth);
                    if (autoFilterAlert.targetFase !== null) setFilterFase(autoFilterAlert.targetFase);
                    if (autoFilterAlert.targetGerente) setFilterGerente(autoFilterAlert.targetGerente);
                    if (autoFilterAlert.targetStatus) setFilterStatus(autoFilterAlert.targetStatus);
                  }}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-all shadow-sm whitespace-nowrap self-stretch sm:self-auto flex items-center justify-center"
                >
                  Visualizar registros encontrados
                </button>
              </div>
            )}
            {viewMode === "table" && (
              <div className="flex items-center justify-between text-sm text-muted px-1">
                <span>{filteredData.length} lançamento{filteredData.length !== 1 ? 's' : ''} encontrado{filteredData.length !== 1 ? 's' : ''}</span>
                {filteredData.length > 0 && <span className="font-medium text-gold lg:hidden">Total: {formatCurrency(subtotal, false)}</span>}
              </div>
            )}
          </div>

          <div className="w-full bg-card md:border md:border-border md:rounded-2xl flex flex-col shadow-sm relative">
            
            {viewMode === "table" ? (
              <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-elevated sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th onClick={() => handleSort("codigo")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border cursor-pointer hover:text-gold transition-colors select-none group">
                      Cód. {renderSortIcon("codigo")}
                    </th>
                    <th onClick={() => handleSort("data_registro")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border cursor-pointer hover:text-gold transition-colors select-none group">
                      Data Registro {renderSortIcon("data_registro")}
                    </th>
                    <th onClick={() => handleSort("rede")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border cursor-pointer hover:text-gold transition-colors select-none group">
                      Rede {renderSortIcon("rede")}
                    </th>
                    <th onClick={() => handleSort("mes")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border cursor-pointer hover:text-gold transition-colors select-none group">
                      Mês {renderSortIcon("mes")}
                    </th>
                    <th onClick={() => handleSort("periodo")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border cursor-pointer hover:text-gold transition-colors select-none group">
                      Período Ação {renderSortIcon("periodo")}
                    </th>
                    <th onClick={() => handleSort("tipo")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border cursor-pointer hover:text-gold transition-colors select-none group">
                      Tipo {renderSortIcon("tipo")}
                    </th>
                    <th onClick={() => handleSort("fase")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border cursor-pointer hover:text-gold transition-colors select-none group">
                      Fase {renderSortIcon("fase")}
                    </th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border select-none">
                      Família
                    </th>
                    <th onClick={() => handleSort("valor")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right cursor-pointer hover:text-gold transition-colors select-none group">
                      Vlr invest. {renderSortIcon("valor")}
                    </th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right select-none">
                      PPC
                    </th>
                    <th onClick={() => handleSort("exp_vol")} className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right cursor-pointer hover:text-gold transition-colors select-none group">
                      Exp. Vol. {renderSortIcon("exp_vol")}
                    </th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-center select-none">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-muted">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <RefreshCw className="w-6 h-6 animate-spin text-gold" />
                          <p>Carregando lançamentos...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-muted">
                        Nenhum lançamento encontrado. Clique em &quot;Lançar Investimento&quot; para começar.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item) => {
                      if (item.type === "campaign") {
                        const isExpanded = expandedCampaigns[item.id] || false;
                        let minDate = "";
                        let maxDate = "";
                        item.acoes.forEach(a => {
                          if (a.data_inicio && (!minDate || a.data_inicio < minDate)) minDate = a.data_inicio;
                          if (a.data_fim && (!maxDate || a.data_fim > maxDate)) maxDate = a.data_fim;
                        });

                        return (
                          <Fragment key={item.id}>
                            <tr 
                              onClick={() => setExpandedCampaigns(prev => ({ ...prev, [item.id]: !prev[item.id] }))} 
                              className="bg-elevated/70 font-bold border-l-4 border-l-gold hover:bg-elevated/90 transition-all cursor-pointer select-none"
                            >
                              <td className="px-3 xl:px-4 py-3 text-gold font-mono text-xs font-bold">
                                <div className="flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>{item.codigo_campanha}</span>
                                </div>
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-foreground/80 font-normal">
                                -
                              </td>
                              <td className="px-3 xl:px-4 py-3 font-medium text-foreground">
                                <div>
                                  <span>{item.rede}</span>
                                  {item.codigo_matriz && (
                                    <span className="text-[10px] text-muted block font-mono mt-0.5">{item.codigo_matriz}</span>
                                  )}
                                  {(() => {
                                    const fakeRow = {
                                      rede: item.rede,
                                      codigo_matriz: item.codigo_matriz,
                                      gerente_responsavel: item.acoes?.[0]?.gerente_responsavel
                                    };
                                    const { uf, manager } = getGerenteAndUF(fakeRow);
                                    const hasData = uf !== "UF N/D" || manager !== "SEM GERENTE";
                                    return (
                                      <div className="mt-1">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${hasData ? 'bg-gold/10 text-gold border-gold/20' : 'bg-muted/10 text-muted/60 border-muted/20'}`}>
                                          {uf} | {manager}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-foreground/80">
                                {formatMesReferencia(item.mes_referencia)}
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-foreground/80">
                                <div className="flex flex-col gap-0.5 text-xs font-medium">
                                  <span>{formatDate(minDate)}</span>
                                  <span className="text-muted">{formatDate(maxDate)}</span>
                                </div>
                              </td>
                              <td className="px-3 xl:px-4 py-3">
                                <span className="px-2 py-1 rounded-md text-xs font-medium border bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20">
                                  Campanha
                                </span>
                              </td>
                              <td className="px-3 xl:px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20 text-center uppercase">
                                    Op: {item.status_operacional_campanha}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-center uppercase">
                                    Fin: {item.status_financeiro_campanha}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-foreground/80 font-normal text-xs whitespace-normal max-w-[200px]">
                                {item.acoes.length} {item.acoes.length === 1 ? 'Ação' : 'Ações'}: {item.acoes.map(a => a.familia_produto).join(", ")}
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-right font-bold text-foreground">
                                {formatCurrency(item.valor_previsto, false)}
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-right font-bold text-blue-500">
                                {formatCurrency(item.valor_homologado, false)}
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-right font-bold text-emerald-500">
                                {formatCurrency(item.valor_pago, false)}
                              </td>
                              <td className="px-3 xl:px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-xs text-muted">Saldo: <span className="font-bold text-foreground">{formatCurrency(item.saldo, false)}</span></span>
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gold" /> : <ChevronDown className="w-4 h-4 text-gold" />}
                                </div>
                              </td>
                            </tr>
                            
                            {isExpanded && item.acoes.map((row: any) => (
                              <tr key={row.id} onClick={() => setSelectedAction(row)} className="hover:bg-elevated/30 bg-background/25 border-l-4 border-l-gold/20 transition-colors group cursor-pointer text-xs">
                                <td className="px-3 xl:px-4 py-2 pl-6 text-muted font-mono text-[11px]">
                                  {row.codigo ? `#${row.codigo}` : '-'}
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-muted">
                                  {new Date(row.created_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="px-3 xl:px-4 py-2 font-medium text-muted pl-6">
                                  <div>
                                    <span>↳ {row.familia_produto}</span>
                                    {(() => {
                                      const { uf, manager } = getGerenteAndUF(row);
                                      const hasData = uf !== "UF N/D" || manager !== "SEM GERENTE";
                                      return (
                                        <div className="mt-0.5">
                                          <span className={`inline-flex items-center px-1 py-0.2 rounded-[3px] text-[8px] font-bold border ${hasData ? 'bg-gold/10 text-gold border-gold/20' : 'bg-muted/10 text-muted border-muted/20'}`}>
                                            {uf} | {manager}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-muted">
                                  -
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-muted">
                                  <div className="flex flex-col gap-0.5 text-[10px]">
                                    <span>{formatDate(row.data_inicio)}</span>
                                    <span>{formatDate(row.data_fim)}</span>
                                  </div>
                                </td>
                                <td className="px-3 xl:px-4 py-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] border bg-blue-500/5 text-blue-400 border-blue-500/10">
                                    {row.tipo_acao}
                                  </span>
                                </td>
                                <td className="px-3 xl:px-4 py-2">
                                  {(() => {
                                    const fase = row.fase_atual || 1;
                                    const cfg = FASE_CONFIG[fase] || FASE_CONFIG[1];
                                    const tradePercent = fase === 2 ? getTradeProgress(row) : null;
                                    const tradeClasses = tradePercent !== null ? getTradeBadgeClasses(tradePercent) : null;
                                    
                                    const bgColor = tradeClasses ? tradeClasses.bg : cfg.bgColor;
                                    const color = tradeClasses ? tradeClasses.text : cfg.color;
                                    const borderColor = tradeClasses ? tradeClasses.border : cfg.borderColor;

                                    return (
                                      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${bgColor} ${borderColor} ${color}`}>
                                        {cfg.icon}
                                        <span>{cfg.label}{tradePercent !== null ? ` ${tradePercent}%` : ''}</span>
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-muted">
                                  {row.abrangencia}
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-right font-medium text-muted">
                                  {formatCurrency(getValorTotal(row), false)}
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-right font-medium text-muted">
                                  {row.preco_acao ? formatCurrency(row.preco_acao) : '-'}
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-right font-medium text-muted">
                                  {row.expectativa_volume ? row.expectativa_volume.toLocaleString('pt-BR') : '-'}
                                </td>
                                <td className="px-3 xl:px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-2">
                                    {row.documento_url ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleViewDocument(row.documento_url!); }}
                                        className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded transition-colors"
                                        title="Visualizar Documento"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <label onClick={(e) => e.stopPropagation()} className="p-1 text-[#10b981] hover:text-[#059669] hover:bg-[#10b981]/10 rounded transition-colors cursor-pointer" title="Anexar Documento / Acordo">
                                        {uploadingId === row.id ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <FileUp className="w-3.5 h-3.5" />
                                        )}
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          accept=".pdf,image/*"
                                          onChange={(e) => handleFileUpload(row.id, e.target.files?.[0] || null)}
                                          disabled={uploadingId === row.id}
                                        />
                                      </label>
                                    )}

                                    <Link
                                      href={`/investimento/${row.id}/editar`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1 text-muted hover:text-gold hover:bg-gold/10 rounded transition-colors"
                                      title="Editar"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Link>

                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                                      className="p-1 text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      } else {
                        const row = item.action;
                        return (
                          <tr key={row.id} onClick={() => setSelectedAction(row)} className="hover:bg-elevated/50 transition-colors group cursor-pointer">
                            <td className="px-3 xl:px-4 py-3 text-foreground/80 font-mono text-xs">
                              {row.codigo ? `#${row.codigo}` : '-'}
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-foreground/80">
                              {new Date(row.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-3 xl:px-4 py-3 font-medium text-foreground">
                              <div>
                                <span>{row.rede}</span>
                                {row.codigo_matriz && (
                                  <span className="text-[10px] text-muted block font-mono mt-0.5">{row.codigo_matriz}</span>
                                )}
                                {(() => {
                                  const { uf, manager } = getGerenteAndUF(row);
                                  const hasData = uf !== "UF N/D" || manager !== "SEM GERENTE";
                                  return (
                                    <div className="mt-1">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${hasData ? 'bg-gold/10 text-gold border-gold/20' : 'bg-muted/10 text-muted/60 border-muted/20'}`}>
                                        {uf} | {manager}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-foreground/80">
                              {(() => {
                                const formatted = formatMesReferencia(row.mes_referencia);
                                if (formatted === "-") return "-";
                                const parts = formatted.split("/");
                                if (parts.length === 2) {
                                  return (
                                    <div className="flex flex-col gap-0.5 text-xs font-semibold">
                                      <span className="text-foreground">{parts[0]}</span>
                                      <span className="text-muted text-[10px] font-normal">{parts[1]}</span>
                                    </div>
                                  );
                                }
                                return <span className="font-semibold">{formatted}</span>;
                              })()}
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-foreground/80">
                              <div className="flex flex-col gap-0.5 text-xs font-medium">
                                <span className="flex items-center gap-1">
                                  {formatDate(row.data_inicio)}
                                  {row.date_mode === 'multiple' && (
                                    <span className="text-[9px] bg-gold/10 text-gold px-1 rounded font-bold border border-gold/20" title="Múltiplas datas por item">Múlt.</span>
                                  )}
                                </span>
                                <span className="text-muted">{formatDate(row.data_fim)}</span>
                              </div>
                            </td>
                            <td className="px-3 xl:px-4 py-3">
                              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${row.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                {row.tipo_acao}
                              </span>
                            </td>
                            <td className="px-3 xl:px-4 py-3">
                              {(() => {
                                const fase = row.fase_atual || 1;
                                const cfg = FASE_CONFIG[fase] || FASE_CONFIG[1];
                                const tradePercent = fase === 2 ? getTradeProgress(row) : null;
                                const tradeClasses = tradePercent !== null ? getTradeBadgeClasses(tradePercent) : null;
                                
                                const bgColor = tradeClasses ? tradeClasses.bg : cfg.bgColor;
                                const color = tradeClasses ? tradeClasses.text : cfg.color;
                                const borderColor = tradeClasses ? tradeClasses.border : cfg.borderColor;

                                return (
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${bgColor} ${borderColor} ${color}`}>
                                    {cfg.icon}
                                    <span>{cfg.label}{tradePercent !== null ? ` ${tradePercent}%` : ''}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-foreground/80">
                              {row.abrangencia === "SKU" 
                                ? "Múltiplos SKUs" 
                                : (row.familias_detalhes && row.familias_detalhes.length > 0 
                                  ? row.familias_detalhes.map((f: any) => f.familia_nome).join(", ") 
                                  : row.familia_produto)}
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-right font-medium text-foreground">
                              {formatCurrency(getValorTotal(row), false)}
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-right font-medium text-foreground">
                              {row.abrangencia === "SKU" 
                                ? "-" 
                                : (row.familias_detalhes && row.familias_detalhes.length > 0
                                  ? (row.familias_detalhes.length === 1 ? (row.familias_detalhes[0].preco_acao ? formatCurrency(row.familias_detalhes[0].preco_acao) : '-') : 'Múltiplos')
                                  : (row.preco_acao ? formatCurrency(row.preco_acao) : '-'))}
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-right font-medium text-foreground">
                              {row.abrangencia === "SKU" 
                                ? "-" 
                                : (row.familias_detalhes && row.familias_detalhes.length > 0
                                  ? (row.familias_detalhes.length === 1 ? (row.familias_detalhes[0].expectativa_volume ? row.familias_detalhes[0].expectativa_volume.toLocaleString('pt-BR') : '-') : 'Múltiplos')
                                  : (row.expectativa_volume ? row.expectativa_volume.toLocaleString('pt-BR') : '-'))}
                            </td>
                            <td className="px-3 xl:px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {row.documento_url ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleViewDocument(row.documento_url!); }}
                                    className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors"
                                    title="Visualizar Documento"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <label onClick={(e) => e.stopPropagation()} className="p-2 text-[#10b981] hover:text-[#059669] hover:bg-[#10b981]/10 rounded-lg transition-colors cursor-pointer" title="Anexar Documento / Acordo">
                                    {uploadingId === row.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <FileUp className="w-4 h-4" />
                                    )}
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      accept=".pdf,image/*"
                                      onChange={(e) => handleFileUpload(row.id, e.target.files?.[0] || null)}
                                      disabled={uploadingId === row.id}
                                    />
                                  </label>
                                )}

                                <Link
                                  href={`/investimento/${row.id}/editar`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 text-muted hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Link>

                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                                  className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    })
                  )}
                </tbody>
                {filteredData.length > 0 && (
                  <tfoot className="bg-elevated sticky bottom-0 z-10 shadow-[0_-1px_2px_rgba(0,0,0,0.05)] border-t border-border font-medium">
                    <tr>
                      <td colSpan={8} className="px-3 xl:px-4 py-3 text-right text-foreground uppercase tracking-wider text-xs">
                        Subtotal (Itens filtrados)
                      </td>
                      <td className="px-3 xl:px-4 py-3 text-right text-gold font-bold">
                        {formatCurrency(subtotal, false)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Mobile Vertical List */}
            <div className="block md:hidden flex-1 overflow-y-auto space-y-4 pb-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted">
                  <RefreshCw className="w-6 h-6 animate-spin text-gold" />
                  <p>Carregando lançamentos...</p>
                </div>
              ) : paginatedData.length === 0 ? (
                <div className="py-12 text-center text-muted border border-border rounded-xl bg-elevated">
                  Nenhum lançamento encontrado.
                </div>
              ) : (
                    paginatedData.map((item) => {
                      if (item.type === "campaign") {
                        const isExpanded = expandedCampaigns[item.id] || false;
                        let minDate = "";
                        let maxDate = "";
                        item.acoes.forEach(a => {
                          if (a.data_inicio && (!minDate || a.data_inicio < minDate)) minDate = a.data_inicio;
                          if (a.data_fim && (!maxDate || a.data_fim > maxDate)) maxDate = a.data_fim;
                        });

                        return (
                          <div key={item.id} className="bg-elevated border-l-4 border-l-gold border-y border-r border-border p-4 rounded-2xl flex flex-col gap-3 relative shadow-sm hover:border-gold transition-colors">
                            <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpandedCampaigns(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-[10px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Layers className="w-3 h-3" />
                                    {item.codigo_campanha}
                                  </span>
                                  <span className="text-[11px] text-muted font-medium">{formatMesReferencia(item.mes_referencia)}</span>
                                </div>
                                <h3 className="font-bold text-foreground text-base leading-tight">
                                  {item.rede}
                                </h3>
                                {(() => {
                                  const fakeRow = {
                                    rede: item.rede,
                                    codigo_matriz: item.codigo_matriz,
                                    gerente_responsavel: item.acoes?.[0]?.gerente_responsavel
                                  };
                                  const { uf, manager } = getGerenteAndUF(fakeRow);
                                  const hasData = uf !== "UF N/D" || manager !== "SEM GERENTE";
                                  return (
                                    <div className="mt-1">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${hasData ? 'bg-gold/10 text-gold border-gold/20' : 'bg-muted/10 text-muted/60 border-muted/20'}`}>
                                        {uf} | {manager}
                                      </span>
                                    </div>
                                  );
                                })()}
                                <p className="text-[11px] text-muted mt-1">
                                  Período: {formatDate(minDate)} - {formatDate(maxDate)}
                                </p>
                                <p className="text-xs text-foreground/80 mt-1 font-semibold">
                                  {item.acoes.length} {item.acoes.length === 1 ? 'Ação' : 'Ações'}: {item.acoes.map(a => a.familia_produto).join(", ")}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20 uppercase text-center min-w-[70px]">
                                  {item.status_operacional_campanha}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase text-center min-w-[70px]">
                                  {item.status_financeiro_campanha}
                                </span>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-gold mt-1" /> : <ChevronDown className="w-4 h-4 text-gold mt-1" />}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 bg-background/30 p-2.5 rounded-xl border border-border/40 text-xs">
                              <div>
                                <span className="text-muted block text-[10px] uppercase font-semibold">Previsto</span>
                                <span className="font-bold text-foreground">{formatCurrency(item.valor_previsto, false)}</span>
                              </div>
                              <div>
                                <span className="text-muted block text-[10px] uppercase font-semibold">Homologado</span>
                                <span className="font-bold text-blue-500">{formatCurrency(item.valor_homologado, false)}</span>
                              </div>
                              <div>
                                <span className="text-muted block text-[10px] uppercase font-semibold">Pago</span>
                                <span className="font-bold text-emerald-500">{formatCurrency(item.valor_pago, false)}</span>
                              </div>
                              <div>
                                <span className="text-muted block text-[10px] uppercase font-semibold">Saldo</span>
                                <span className="font-bold text-foreground">{formatCurrency(item.saldo, false)}</span>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-2 space-y-3 pt-3 border-t border-border/40">
                                {item.acoes.map((row: any) => (
                                  <div key={row.id} onClick={() => setSelectedAction(row)} className="bg-background/40 border border-border/30 p-3 rounded-xl flex flex-col gap-2 relative shadow-sm cursor-pointer hover:border-gold transition-colors">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4 className="font-bold text-foreground text-sm">↳ {row.familia_produto}</h4>
                                        {(() => {
                                          const { uf, manager } = getGerenteAndUF(row);
                                          const hasData = uf !== "UF N/D" || manager !== "SEM GERENTE";
                                          return (
                                            <div className="mt-0.5">
                                              <span className={`inline-flex items-center px-1 py-0.2 rounded-[3px] text-[8px] font-bold border ${hasData ? 'bg-gold/10 text-gold border-gold/20' : 'bg-muted/10 text-muted border-muted/20'}`}>
                                                {uf} | {manager}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                        <p className="text-[10px] text-muted mt-0.5">{formatDate(row.data_inicio)} até {formatDate(row.data_fim)}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {(() => {
                                          const fase = row.fase_atual || 1;
                                          const cfg = FASE_CONFIG[fase] || FASE_CONFIG[1];
                                          const tradePercent = fase === 2 ? getTradeProgress(row) : null;
                                          const tradeClasses = tradePercent !== null ? getTradeBadgeClasses(tradePercent) : null;
                                          
                                          const bgColor = tradeClasses ? tradeClasses.bg : cfg.bgColor;
                                          const color = tradeClasses ? tradeClasses.text : cfg.color;
                                          const borderColor = tradeClasses ? tradeClasses.border : cfg.borderColor;

                                          return (
                                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${bgColor} ${borderColor} ${color}`}>
                                              <span>{cfg.label}{tradePercent !== null ? ` ${tradePercent}%` : ''}</span>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="font-medium text-foreground">{formatCurrency(getValorTotal(row), false)}</span>
                                      <span className="text-muted text-[10px]">{row.tipo_acao}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        const row = item.action;
                        return (
                          <div key={row.id} onClick={() => setSelectedAction(row)} className="bg-elevated border border-border p-4 rounded-2xl flex flex-col gap-3 relative shadow-sm cursor-pointer hover:border-gold transition-colors group">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {row.codigo && <span className="font-mono text-xs font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded">#{row.codigo}</span>}
                                  <span className="text-xs text-muted font-medium">{new Date(row.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <h3 className="font-bold text-foreground text-lg leading-tight flex items-baseline gap-2">
                                  {row.rede}
                                  {row.codigo_matriz && <span className="font-mono text-xs font-normal text-muted">({row.codigo_matriz})</span>}
                                </h3>
                                {(() => {
                                  const { uf, manager } = getGerenteAndUF(row);
                                  const hasData = uf !== "UF N/D" || manager !== "SEM GERENTE";
                                  return (
                                    <div className="mt-1">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${hasData ? 'bg-gold/10 text-gold border-gold/20' : 'bg-muted/10 text-muted/60 border-muted/20'}`}>
                                        {uf} | {manager}
                                      </span>
                                    </div>
                                  );
                                })()}
                                <p className="text-sm text-foreground/80 mt-0.5">{row.abrangencia === "SKU" ? "Múltiplos SKUs" : (row.familias_detalhes && row.familias_detalhes.length > 0 ? row.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : row.familia_produto)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-md text-xs font-bold border ${row.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                  {row.tipo_acao}
                                </span>
                                {(() => {
                                  const fase = row.fase_atual || 1;
                                  const cfg = FASE_CONFIG[fase] || FASE_CONFIG[1];
                                  const tradePercent = fase === 2 ? getTradeProgress(row) : null;
                                  const tradeClasses = tradePercent !== null ? getTradeBadgeClasses(tradePercent) : null;
                                  
                                  const bgColor = tradeClasses ? tradeClasses.bg : cfg.bgColor;
                                  const color = tradeClasses ? tradeClasses.text : cfg.color;
                                  const borderColor = tradeClasses ? tradeClasses.border : cfg.borderColor;

                                  return (
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${bgColor} ${color} ${borderColor}`}>
                                      {cfg.icon} {cfg.label}{tradePercent !== null ? ` ${tradePercent}%` : ''}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted bg-background p-2 rounded-lg border border-border/50">
                              <CalendarIcon className="w-4 h-4 text-gold flex-shrink-0" />
                              <span className="font-medium">
                                {formatDate(row.data_inicio)} até {formatDate(row.data_fim)}
                                {row.date_mode === 'multiple' && (
                                  <span className="ml-1.5 text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-bold border border-gold/20">Múltiplas</span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between mt-1 pt-3 border-t border-border">
                              <div className="flex flex-col">
                                <div className="font-black text-gold text-xl tracking-tight leading-none mb-1">
                                  {formatCurrency(getValorTotal(row), false)}
                                </div>
                                <div className="flex items-center gap-3">
                                  {row.abrangencia !== "SKU" && row.preco_acao && (
                                    <div className="text-xs text-muted">
                                      PPC: <span className="font-medium text-foreground">{formatCurrency(row.preco_acao)}</span>
                                    </div>
                                  )}
                                  {row.abrangencia !== "SKU" && row.expectativa_volume && (
                                    <div className="text-xs text-muted">
                                      Exp. Vol.: <span className="font-medium text-foreground">{row.expectativa_volume}</span>
                                    </div>
                                  )}
                                  {row.abrangencia === "SKU" && (
                                    <div className="text-xs text-muted">
                                      SKUs: <span className="font-medium text-foreground">{row.skus_detalhes?.length || 0}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {row.documento_url ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleViewDocument(row.documento_url!); }}
                                    className="p-2.5 text-blue-500 bg-blue-500/10 rounded-xl hover:bg-blue-500/20 transition-colors"
                                  >
                                    <FileText className="w-5 h-5" />
                                  </button>
                                ) : (
                                  <label onClick={(e) => e.stopPropagation()} className="p-2.5 text-[#10b981] bg-[#10b981]/10 rounded-xl hover:bg-[#10b981]/20 transition-colors cursor-pointer">
                                    {uploadingId === row.id ? (
                                      <RefreshCw className="w-5 h-5 animate-spin" />
                                    ) : (
                                      <FileUp className="w-5 h-5" />
                                    )}
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      accept=".pdf,image/*"
                                      onChange={(e) => handleFileUpload(row.id, e.target.files?.[0] || null)}
                                      disabled={uploadingId === row.id}
                                    />
                                  </label>
                                )}
                                <Link
                                  href={`/investimento/${row.id}/editar`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2.5 text-gold bg-gold/10 rounded-xl hover:bg-gold/20 transition-colors"
                                >
                                  <Pencil className="w-5 h-5" />
                                </Link>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                                  className="p-2.5 text-danger bg-danger/10 rounded-xl hover:bg-danger/20 transition-colors"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-elevated">
                <span className="text-sm text-muted">
                  Página {page + 1} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg bg-card border border-border text-foreground hover:bg-elevated disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-lg bg-card border border-border text-foreground hover:bg-elevated disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
              </>
            ) : viewMode === "calendar" ? (
              <div className="flex-1 flex flex-col p-4 bg-background/50 overflow-y-auto">
                {/* Calendar Header with View Toggle */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 bg-elevated p-3 rounded-2xl border border-border">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        setCurrentMonth(calendarView === "month" ? subMonths(currentMonth, 1) : subWeeks(currentMonth, 1))
                      }} 
                      className="p-2 hover:bg-border rounded-xl transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <h2 className="text-base sm:text-lg font-bold capitalize text-foreground min-w-[220px] text-center">
                      {calendarView === "month" ? (
                        format(currentMonth, "MMMM yyyy", { locale: ptBR })
                      ) : (
                        (() => {
                          const start = startOfWeek(currentMonth, { weekStartsOn: 0 });
                          const end = endOfWeek(currentMonth, { weekStartsOn: 0 });
                          const startFmt = format(start, "dd 'de' MMMM", { locale: ptBR });
                          const endFmt = format(end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                          return `${startFmt} - ${endFmt}`;
                        })()
                      )}
                    </h2>
                    <button 
                      onClick={() => {
                        setCurrentMonth(calendarView === "month" ? addMonths(currentMonth, 1) : addWeeks(currentMonth, 1))
                      }} 
                      className="p-2 hover:bg-border rounded-xl transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>
                  </div>
                  
                  {/* View Toggles (Mensal / Semanal) */}
                  <div className="flex items-center bg-background border border-border p-1 rounded-xl gap-1 w-full sm:w-auto justify-center">
                    <button
                      onClick={() => setCalendarView("month")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        calendarView === "month"
                          ? "bg-gold text-black font-bold shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Mês
                    </button>
                    <button
                      onClick={() => setCalendarView("week")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        calendarView === "week"
                          ? "bg-gold text-black font-bold shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Semana
                    </button>
                  </div>
                </div>

                {calendarView === "month" ? (
                  /* Monthly View */
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-xs font-bold text-muted py-2">{day}</div>
                    ))}
                    {eachDayOfInterval({ 
                      start: startOfWeek(startOfMonth(currentMonth)), 
                      end: endOfWeek(endOfMonth(currentMonth)) 
                    }).map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isToday = isSameDay(day, new Date());
                      
                      const dayActions = filteredData.filter(action => {
                        if (!action.data_inicio || !action.data_fim) return false;
                        const start = startOfDay(parseISO(action.data_inicio));
                        const end = startOfDay(parseISO(action.data_fim));
                        return isWithinInterval(day, { start, end });
                      });

                      const hasActions = dayActions.length > 0;

                      return (
                        <div 
                          key={idx}
                          onClick={() => { if (hasActions) setSelectedDate(day) }}
                          className={`min-h-[48px] sm:min-h-[64px] p-1 sm:p-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                            isCurrentMonth ? 'bg-elevated border border-border' : 'bg-transparent border border-transparent opacity-40'
                          } ${isToday ? 'ring-2 ring-gold ring-offset-2 ring-offset-background' : ''} ${
                            hasActions ? 'cursor-pointer hover:border-red-500 hover:shadow-md' : ''
                          }`}
                        >
                          <div className={`text-sm sm:text-base font-bold ${
                            hasActions ? 'text-red-500' : isToday ? 'text-gold' : 'text-muted'
                          }`}>
                            {format(day, 'd')}
                          </div>
                          {hasActions && (
                            <div className="flex items-center gap-0.5 mt-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span className="text-[10px] font-bold text-red-500">{dayActions.length}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Weekly View (Google Agenda style) */
                  <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 flex-1 min-h-[480px]">
                    {eachDayOfInterval({
                      start: startOfWeek(currentMonth, { weekStartsOn: 0 }),
                      end: endOfWeek(currentMonth, { weekStartsOn: 0 })
                    }).map((day, idx) => {
                      const isToday = isSameDay(day, new Date());
                      const dayActions = filteredData.filter(action => {
                        if (!action.data_inicio || !action.data_fim) return false;
                        const start = startOfDay(parseISO(action.data_inicio));
                        const end = startOfDay(parseISO(action.data_fim));
                        return isWithinInterval(day, { start, end });
                      });

                      return (
                        <div 
                          key={idx}
                          className={`bg-elevated border border-border rounded-2xl p-3 flex flex-col min-h-[250px] lg:min-h-[400px] transition-all ${
                            isToday ? 'ring-2 ring-gold ring-offset-2 ring-offset-background' : ''
                          }`}
                        >
                          {/* Column Day Header */}
                          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                            <span className="text-xs font-black uppercase text-muted tracking-widest">
                              {format(day, 'eee', { locale: ptBR })}
                            </span>
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${
                              isToday ? 'bg-gold text-black shadow-md' : 'text-foreground bg-background/40'
                            }`}>
                              {format(day, 'd')}
                            </span>
                          </div>

                          {/* Column Actions List */}
                          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[350px] pr-0.5 scrollbar-thin">
                            {dayActions.length > 0 ? (
                              dayActions.map(action => {
                                const valor = getValorTotal(action);
                                return (
                                  <div
                                    key={action.id}
                                    onClick={() => setSelectedAction(action)}
                                    className="bg-card border border-border hover:border-gold hover:shadow-md hover:scale-[1.02] p-2.5 rounded-xl cursor-pointer transition-all duration-200 group relative overflow-hidden text-left"
                                  >
                                    {/* Visual Left tag bar */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                      action.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]' : 'bg-blue-500'
                                    }`} />

                                    <div className="pl-1.5 space-y-1">
                                      <span className="block font-black text-xs text-foreground group-hover:text-gold transition-colors line-clamp-2 leading-tight">
                                        {action.rede}
                                      </span>

                                      <div className="flex items-center justify-between text-[10px] text-muted gap-1">
                                        <span className="truncate max-w-[65%]">
                                          {action.abrangencia === "SKU" ? "SKUs" : (action.familias_detalhes && action.familias_detalhes.length > 0 ? action.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : action.familia_produto)}
                                        </span>
                                        <span className="font-extrabold text-foreground flex-shrink-0">
                                          {formatCurrency(valor)}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between pt-0.5">
                                        <span className={`px-1 rounded text-[8px] font-bold border ${
                                          action.tipo_acao === 'Sell Out'
                                            ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20'
                                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                        }`}>
                                          {action.tipo_acao}
                                        </span>
                                        <span className="text-[9px] font-medium text-foreground">
                                          P.Ação: {getPrecoAcaoStr(action)}
                                        </span>
                                        {action.possui_divergencia_calendario && (
                                          <div className="relative group inline-flex mt-0.5">
                                            <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-md text-[9px] font-bold px-1 py-0.5 cursor-help">⚠ Diverg.</span>
                                            <div className="invisible group-hover:visible absolute bottom-full left-0 mb-1 w-52 bg-popover border border-border rounded-xl p-2 text-xs shadow-xl z-50 space-y-1">
                                              <p className="font-semibold text-amber-400 mb-1">Divergência de Calendário</p>
                                              <p><span className="text-muted">📅 Planej.:</span> {formatDate(action.data_inicio)} → {formatDate(action.data_fim)}</p>
                                              <p><span className="text-muted">❓ Motivo:</span> {action.motivo_divergencia_calendario ? MOTIVOS_DIVERGENCIA[action.motivo_divergencia_calendario as MotivoDivergencia] : '-'}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="flex flex-col items-center justify-center h-24 border border-dashed border-border/40 rounded-xl p-3 text-center">
                                <span className="text-[10px] text-muted italic font-medium">Sem ações</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col bg-card">
                {/* Matrix view header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-border bg-elevated/30 gap-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Histórico de Investimentos por Rede</h3>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {filterMes && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={showOnlyWithoutActions}
                          onChange={(e) => setShowOnlyWithoutActions(e.target.checked)}
                          className="rounded border-border text-gold focus:ring-gold bg-elevated w-3.5 h-3.5"
                        />
                        <span>Sem ação em {formatMesReferencia(filterMes)}</span>
                      </label>
                    )}
                    <input
                      type="text"
                      placeholder="Buscar rede, código ou gerente..."
                      value={matrizSearch}
                      onChange={(e) => setMatrizSearch(e.target.value)}
                      className="w-full md:w-64 bg-elevated border border-border rounded-xl px-3.5 py-1.5 text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
                    />
                  </div>
                </div>

                {/* Consolidado por Gerente */}
                <div className="bg-elevated/10 px-4 py-3 border-b border-border flex flex-col gap-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <span className="font-bold text-muted uppercase tracking-wider text-[10px]">
                          {filterMes ? `Ações por Gerente em ${formatMesReferencia(filterMes)}:` : "Ações do ano por gerente:"}
                        </span>
                        <div className="flex flex-wrap gap-2.5">
                          {acoesPorGerente.slice(0, 3).map((item) => (
                            <div key={item.manager} className="flex items-center gap-2 bg-elevated/40 border border-border/60 px-3 py-1 rounded-lg shadow-sm">
                              <span className="font-semibold text-foreground">{item.manager}:</span>
                              <span className="font-bold text-gold text-sm">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted/60 font-medium">
                        * N.º de clientes com ações (N.º de ações)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConsolidadoGerentes(!showConsolidadoGerentes)}
                      className="px-3 py-1.5 bg-elevated border border-border text-foreground font-semibold rounded-lg hover:bg-border transition-all flex items-center gap-1.5 self-end sm:self-auto shadow-sm cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-gold" />
                      {showConsolidadoGerentes ? "Ocultar Consolidação Mensal" : "Exibir Consolidação Mensal"}
                    </button>
                  </div>

                  {showConsolidadoGerentes && (
                    <div className="overflow-x-auto border border-border/60 rounded-xl bg-card shadow-sm mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                        <thead>
                          <tr className="bg-elevated/30 border-b border-border">
                            <th className="p-3 font-bold text-muted w-48 sticky left-0 bg-elevated/30 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Gerente</th>
                            {MATRIX_MONTHS.map(m => (
                              <th key={m.value} className="p-3 font-bold text-muted text-center w-28">{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {consolidadoGerenteMes.map(item => (
                            <tr key={item.manager} className="hover:bg-elevated/10 transition-colors">
                              <td className="p-3 font-semibold text-foreground sticky left-0 bg-card z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{item.manager}</td>
                              {MATRIX_MONTHS.map((month, idx) => {
                                const mData = item.months[month.value] || { networksCount: 0, actionsCount: 0 };
                                const hasData = mData.networksCount > 0 || mData.actionsCount > 0;
                                
                                const prevMonthVal = idx > 0 ? MATRIX_MONTHS[idx - 1].value : null;
                                const prevMData = prevMonthVal ? (item.months[prevMonthVal] || { networksCount: 0, actionsCount: 0 }) : { networksCount: 0, actionsCount: 0 };
                                const isGreater = mData.actionsCount > prevMData.actionsCount;

                                return (
                                  <td key={month.value} className="p-3 text-center">
                                    {hasData ? (
                                      isGreater ? (
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[#10b981] text-white font-bold text-xs shadow-sm">
                                          {mData.networksCount}
                                          <span className="text-[10px] text-emerald-100 ml-1 font-semibold">({mData.actionsCount})</span>
                                        </span>
                                      ) : (
                                        <span className="font-semibold text-foreground text-sm">
                                          {mData.networksCount}{' '}
                                          <span className="text-xs text-muted">({mData.actionsCount})</span>
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-muted/20 font-bold text-xs">0</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Matrix view body */}
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead className="sticky top-0 bg-elevated border-b border-border z-10 shadow-sm">
                      <tr>
                        <th className="p-3 font-semibold text-muted w-64 min-w-[240px]">Rede</th>
                        {MATRIX_MONTHS.map(m => (
                          <th key={m.value} className="p-3 font-semibold text-muted text-center w-28 min-w-[100px]">{m.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredMatrizesInView.length > 0 ? (
                        filteredMatrizesInView.map((m, idx) => (
                          <tr key={`${m.codigo}-${m.nome}-${idx}`} className="hover:bg-elevated/20 transition-colors">
                            <td className="p-3 min-w-[240px]">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-gold bg-gold/10 px-1 py-0.5 rounded font-bold">{m.codigo}</span>
                                  <span className="font-bold text-foreground text-sm">{m.nome}</span>
                                </div>
                                <span className="text-[10px] text-muted mt-1">
                                  Gerente: <span className="text-foreground/80 font-medium">{m.gerente || 'Não definido'}</span>
                                  {" • "}
                                  Ações: <span className="text-gold font-bold">{m.acoesCount}</span>
                                  {m.faturamentoTotal > 0 && (
                                    <>
                                      {" • "}
                                      Fat: <span className="text-emerald-500 font-semibold">{formatCompactCurrency(m.faturamentoTotal)}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </td>
                            {MATRIX_MONTHS.map(month => {
                              const count = acoesNoMesCount(m, month.value);
                              return (
                                <td key={month.value} className="p-2 text-center">
                                  <div className="flex items-center justify-center">
                                    {count > 0 ? (
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#10b981]/15 text-[#10b981] font-bold text-sm">
                                        {count}
                                      </span>
                                    ) : (
                                      <span className="text-muted/30 font-bold text-sm">
                                        0
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={1 + MATRIX_MONTHS.length} className="text-center py-8 text-muted text-sm">
                            Nenhuma matriz encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Ações do Dia */}
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-border">
              <div className="p-4 sm:p-6 border-b border-border flex justify-between items-center bg-elevated">
                <h3 className="text-xl font-bold text-foreground">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
                <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-border rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
              <div className="p-3 sm:p-4 overflow-y-auto space-y-2">
                {filteredData.filter(action => {
                  if (!action.data_inicio || !action.data_fim) return false;
                  return isWithinInterval(selectedDate, { 
                    start: startOfDay(parseISO(action.data_inicio)), 
                    end: startOfDay(parseISO(action.data_fim)) 
                  });
                }).map(row => (
                  <div 
                    key={row.id} 
                    onClick={() => {
                      setSelectedAction(row);
                    }}
                    className="bg-elevated border border-border px-3 py-2 rounded-xl cursor-pointer hover:border-gold hover:shadow-md transition-all group flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {row.codigo && <span className="font-mono text-[9px] font-bold text-gold bg-gold/10 px-1 py-0.5 rounded">#{row.codigo}</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex-shrink-0 ${row.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                        {row.tipo_acao}
                      </span>
                      <span className="font-bold text-sm text-foreground group-hover:text-gold transition-colors truncate">{row.rede}</span>
                      <span className="text-xs text-muted truncate hidden sm:inline">{row.abrangencia === "SKU" ? "SKUs" : (row.familias_detalhes && row.familias_detalhes.length > 0 ? row.familias_detalhes.map(f => f.familia_nome).join(", ") : row.familia_produto)}</span>
                    </div>
                    <span className="font-black text-sm text-foreground flex-shrink-0">
                      {formatCurrency(getValorTotal(row))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Importação de Investimentos em Lote */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-5xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-border">
              {/* Header */}
              <div className="p-4 border-b border-border flex justify-between items-center bg-elevated">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Importar Investimentos em Lote</h3>
                    <p className="text-xs text-muted">Importe múltiplas ações por planilha Excel</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setParsedAcoes([]);
                    setImportFileName("");
                    setImportErrors([]);
                    setImportSummary(null);
                    setFileHash("");
                    setRawExcelRows([]);
                  }} 
                  className="p-2 hover:bg-border rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {/* Dropzone */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-gold/30 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-background/30 hover:bg-foreground/[0.02] flex flex-col items-center justify-center gap-2"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImportFileChange}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-muted" />
                  <div>
                    <p className="font-semibold text-xs text-foreground">
                      {importFileName ? importFileName : "Clique para selecionar ou arraste sua planilha aqui"}
                    </p>
                    <p className="text-[10px] text-muted mt-1">
                      Suporta arquivos Excel (.xlsx, .xls) baseados no modelo.
                    </p>
                  </div>
                </div>

                {feedback && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 transition-all duration-300 ${
                    feedback.type === "success" ? "bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981]" : "bg-danger/10 border border-danger/20 text-danger"
                  }`}>
                    {feedback.type === "error" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                    <span className="text-xs font-semibold">{feedback.msg}</span>
                  </div>
                )}

                {isSimulating && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center bg-background/20 rounded-2xl border border-border/50 animate-pulse">
                    <div className="w-10 h-10 rounded-full border-4 border-gold/20 border-t-gold animate-spin" />
                    <div>
                      <p className="font-semibold text-xs text-foreground">Analisando planilha...</p>
                      <p className="text-[10px] text-muted mt-1">Aguarde enquanto executamos as pré-validações no servidor.</p>
                    </div>
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-red-400">Erros de Validação Encontrados</h4>
                        <p className="text-xs text-muted mt-1">
                          Identificamos {importErrors.length} erro(s) na planilha. Corrija as inconsistências e envie novamente.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-elevated/40 p-3 rounded-xl border border-border">
                      <span className="text-[11px] text-muted">A gravação de lotes está bloqueada até que todos os erros sejam corrigidos.</span>
                      <button
                        type="button"
                        onClick={() => downloadErrorsExcel(rawExcelRows, importErrors)}
                        className="px-3.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-red-500/20"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Baixar Planilha de Erros
                      </button>
                    </div>

                    {/* Tabela de Logs de Erro */}
                    <div className="border border-border rounded-xl overflow-hidden bg-background/50 text-xs">
                      <div className="max-h-[30vh] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-elevated border-b border-border sticky top-0">
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Linha</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Coluna</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Valor Lido</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Motivo do Erro</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {importErrors.map((err, index) => (
                              <tr key={index} className="hover:bg-red-500/[0.01]">
                                <td className="p-2.5 text-red-400 font-bold"># {err.line}</td>
                                <td className="p-2.5 font-semibold text-foreground">{err.column}</td>
                                <td className="p-2.5 text-muted break-all font-mono text-[10px]">{err.value !== undefined && err.value !== null ? String(err.value) : "—"}</td>
                                <td className="p-2.5 text-red-400 font-medium">{err.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {importSummary && importErrors.length === 0 && parsedAcoes.length > 0 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Resumo Consolidado (Simulado) */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-2.5 bg-foreground/5 border border-border rounded-xl text-center shadow-sm">
                        <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Ações Mapeadas</p>
                        <p className="text-lg font-black text-foreground mt-0.5">{importSummary.totalRows}</p>
                      </div>
                      <div className="p-2.5 bg-gold/10 border border-gold/20 rounded-xl text-center shadow-sm">
                        <p className="text-[9px] font-bold text-gold uppercase tracking-wider">Investimento Total</p>
                        <p className="text-lg font-black text-gold mt-0.5">{formatCurrency(importSummary.totalInvestment, false)}</p>
                      </div>
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center shadow-sm">
                        <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Volume Planejado</p>
                        <p className="text-lg font-black text-emerald-400 mt-0.5">{importSummary.totalVolume?.toLocaleString('pt-BR') || '0'} Unid.</p>
                      </div>
                    </div>

                    {/* Tabela de Pré-visualização das Ações Agrupadas */}
                    <div className="border border-border rounded-xl overflow-hidden bg-background/50 text-xs">
                      <div className="max-h-[30vh] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-elevated border-b border-border sticky top-0">
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Status</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Rede</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">UF</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Gerente</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Canal</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Mês</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Abrangência</th>
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Detalhes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {parsedAcoes.map((item, index) => (
                              <tr key={index} className="hover:bg-foreground/[0.01]">
                                <td className="p-2.5 whitespace-nowrap">
                                  {item.valid ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                      ✓ Válida
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-full">
                                      ✗ Erro
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 font-semibold text-foreground">{item.data.rede || <span className="text-red-400 italic">Vazia</span>}</td>
                                <td className="p-2.5 text-muted">{item.data.uf || "—"}</td>
                                <td className="p-2.5 text-muted">{item.data.gerente || "—"}</td>
                                <td className="p-2.5 text-muted">{item.data.canal || "—"}</td>
                                <td className="p-2.5 text-muted">{formatMesReferencia(item.data.mes_referencia) || <span className="text-red-400 italic">Vazio</span>}</td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${item.data.abrangencia === 'Família' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>
                                    {item.data.abrangencia}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  {item.data.abrangencia === "Família" ? (
                                    <span className="text-foreground-secondary">
                                      {item.data.familias_detalhes && item.data.familias_detalhes.length > 0 
                                        ? item.data.familias_detalhes.map((f: any) => f.familia_nome).join(", ") 
                                        : item.data.familia_produto}
                                    </span>
                                  ) : (
                                    <span className="text-foreground-secondary">{item.data.skus_detalhes?.length || 0} SKU(s) detalhado(s)</span>
                                  )}
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

              {/* Footer */}
              <div className="p-4 border-t border-border flex justify-end gap-3 bg-elevated">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setParsedAcoes([]);
                    setImportFileName("");
                    setImportErrors([]);
                    setImportSummary(null);
                    setFileHash("");
                    setRawExcelRows([]);
                  }}
                  disabled={isImportPending}
                  className="px-4 py-2 text-sm font-semibold text-muted hover:bg-border rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImportPending || isSimulating || parsedAcoes.length === 0 || importErrors.length > 0}
                  className="px-4 py-2 text-sm font-bold bg-gold text-black rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImportPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Confirmar Importação ({parsedAcoes.filter(e => e.valid).length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Auditoria de Rede */}
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-border">
              {/* Header */}
              <div className="p-4 border-b border-border flex justify-between items-center bg-elevated">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                    <Search className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">🔍 Rastreabilidade e Auditoria de Redes</h3>
                    <p className="text-xs text-muted">Audite qualquer rede no ecossistema Coffee++ sob demanda</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAuditModalOpen(false)} 
                  className="p-2 hover:bg-border rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-4 bg-elevated border-b border-border flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={auditQuery}
                    onChange={(e) => setAuditQuery(e.target.value)}
                    placeholder="Pesquisar por network_id, matriz_id, cod_parceiro, CNPJ ou Nome da rede..."
                    className="w-full bg-background border border-border rounded-xl pl-4 pr-10 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAuditSearch(auditQuery);
                    }}
                  />
                  {auditQuery && (
                    <button 
                      onClick={() => setAuditQuery("")} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-border rounded-full"
                    >
                      <X className="w-3.5 h-3.5 text-muted" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleAuditSearch(auditQuery)}
                  disabled={auditNetworkLoading || !auditQuery.trim()}
                  className="px-6 py-2.5 bg-gold text-black rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {auditNetworkLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Pesquisar
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-background/50">
                {auditNetworkLoading && !auditResult && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-center animate-pulse">
                    <div className="w-10 h-10 rounded-full border-4 border-gold/20 border-t-gold animate-spin" />
                    <div>
                      <p className="font-semibold text-xs text-foreground">Executando varredura e rastreabilidade...</p>
                      <p className="text-[10px] text-muted mt-1">Isso consulta Cadastro Mestre, Investimentos e Promotores no banco.</p>
                    </div>
                  </div>
                )}

                {auditError && (
                  <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl flex items-start gap-3 text-danger">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Erro ao Executar Auditoria</h4>
                      <p className="text-xs opacity-90 mt-1">{auditError}</p>
                    </div>
                  </div>
                )}

                {!auditNetworkLoading && !auditResult && !auditError && (
                  <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/85 rounded-2xl p-6 bg-card/25">
                    <Search className="w-10 h-10 text-muted/60 mb-3" />
                    <p className="font-semibold text-sm text-foreground">Nenhuma consulta ativa</p>
                    <p className="text-xs text-muted max-w-sm mt-1">
                      Digite o nome, ID ou código de integração de uma rede acima para iniciar a varredura ponta a ponta.
                    </p>
                  </div>
                )}

                {auditResult && (
                  <div className="space-y-6">
                    {/* Diagnóstico Conclusivo */}
                    {(() => {
                      const diag = auditResult.restricted
                        ? { severity: auditResult.severity, diagnosis: auditResult.diagnosis, recommendations: auditResult.recommendations }
                        : getAuditConclusiveDiagnosis(auditResult);
                      if (!diag) return null;
                      
                      const bannerColors: Record<string, string> = {
                        '🟢 Informativo': 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]',
                        '🟡 Atenção': 'bg-amber-500/10 border-amber-500/20 text-amber-500',
                        '🟠 Alerta': 'bg-orange-500/10 border-orange-500/20 text-orange-500',
                        '🔴 Crítico': 'bg-red-500/10 border-red-500/20 text-red-500'
                      };

                      return (
                        <div className={`p-4 border rounded-2xl flex items-start gap-3 shadow-sm ${bannerColors[diag.severity] || ''}`}>
                          <div className="text-xl mt-0.5">
                            {diag.severity.includes('Crítico') && '🔴'}
                            {diag.severity.includes('Alerta') && '🟠'}
                            {diag.severity.includes('Atenção') && '🟡'}
                            {diag.severity.includes('Informativo') && '🟢'}
                          </div>
                          <div>
                            <h4 className="font-black text-sm uppercase tracking-wider">{diag.diagnosis}</h4>
                            <p className="text-xs opacity-90 mt-1">{diag.recommendations}</p>
                            <div className="text-[10px] opacity-75 mt-2 font-semibold">
                              Severidade: <span className="font-bold">{diag.severity}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {!auditResult.restricted && (
                      <>
                        {/* Widgets de Scores Circulares */}
                        {auditResult.scores && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                        {/* Circular widget: Health Score */}
                        <div className="flex items-center gap-4 border-r border-border/60 pr-4">
                          <div className="relative w-20 h-20 shrink-0">
                            <svg className="w-full h-full -rotate-90">
                              <circle cx="40" cy="40" r="34" className="stroke-border/40 fill-none" strokeWidth="6" />
                              <circle 
                                cx="40" cy="40" r="34" 
                                className="stroke-gold fill-none transition-all duration-700" 
                                strokeWidth="6"
                                strokeDasharray={2 * Math.PI * 34}
                                strokeDashoffset={2 * Math.PI * 34 * (1 - auditResult.scores.healthScore / 100)}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center font-black text-sm text-foreground">
                              {auditResult.scores.healthScore}%
                            </span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground">Health Score (Saúde de Dados)</h4>
                            <p className="text-[11px] text-muted mt-0.5">Mapeia a consistência do cadastro e relacionamento da rede nas tabelas do ecossistema.</p>
                          </div>
                        </div>

                        {/* Circular widget: Score Operacional */}
                        <div className="flex items-center gap-4">
                          <div className="relative w-20 h-20 shrink-0">
                            <svg className="w-full h-full -rotate-90">
                              <circle cx="40" cy="40" r="34" className="stroke-border/40 fill-none" strokeWidth="6" />
                              <circle 
                                cx="40" cy="40" r="34" 
                                className="stroke-emerald-400 fill-none transition-all duration-700" 
                                strokeWidth="6"
                                strokeDasharray={2 * Math.PI * 34}
                                strokeDashoffset={2 * Math.PI * 34 * (1 - auditResult.scores.scoreOperacional / 100)}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center font-black text-sm text-foreground">
                              {auditResult.scores.scoreOperacional}%
                            </span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground">Score Operacional (Execução)</h4>
                            <p className="text-[11px] text-muted mt-0.5">Avalia o andamento e conclusão física das ações, metas, visitas e faturamentos reais.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Abas e Listagem Detalhada */}
                    <div className="space-y-4">
                      {/* Section 1: Cadastro Mestre */}
                      <div className="bg-card border border-border/80 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-xs text-foreground uppercase border-b border-border pb-2 flex justify-between">
                          <span>📋 Cadastro Mestre e Relacionamentos</span>
                          <span className={`text-[10px] font-black ${auditResult.cadastro?.status === 'Ativo' ? 'text-green-400' : 'text-red-400'}`}>
                            {auditResult.cadastro?.status}
                          </span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-muted block">Nome Matriz (cm_clientes):</span>
                            <span className="font-semibold text-foreground">{auditResult.rede}</span>
                          </div>
                          <div>
                            <span className="text-muted block">Código Matriz (cm_clientes):</span>
                            <span className="font-semibold font-mono text-foreground">{auditResult.codigo || '—'}</span>
                          </div>
                          <div>
                            <span className="text-muted block">CNPJ Cadastrado:</span>
                            <span className="font-semibold text-foreground">{auditResult.cadastro?.cnpj || <span className="text-red-400 font-bold italic">Nulo</span>}</span>
                          </div>
                          <div>
                            <span className="text-muted block">Fase do Cadastro Mestre:</span>
                            <span className="font-semibold text-foreground capitalize">{auditResult.cadastro?.fase}</span>
                          </div>
                          <div>
                            <span className="text-muted block">Gerente Responsável:</span>
                            <span className="font-semibold text-foreground">{auditResult.cadastro?.cm_clientes?.[0]?.responsavel || 'Sem Gerente'}</span>
                          </div>
                          <div>
                            <span className="text-muted block">UF Faturamento:</span>
                            <span className="font-semibold text-foreground">{auditResult.cadastro?.cm_clientes?.[0]?.uf || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Investimentos */}
                      <div className="bg-card border border-border/80 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-xs text-foreground uppercase border-b border-border pb-2">
                          📈 Investimentos Cadastrados
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs border-b border-border/40 pb-3">
                          <div>
                            <span className="text-muted block">Total de Ações Registradas:</span>
                            <span className="font-bold text-foreground text-sm">{auditResult.investimentos?.totalAcoes} ações</span>
                          </div>
                          <div>
                            <span className="text-muted block">Último Usuário que Alterou:</span>
                            <span className="font-semibold text-foreground">{auditResult.investimentos?.lastChange?.user || '—'}</span>
                          </div>
                          <div>
                            <span className="text-muted block">Data da Última Alteração:</span>
                            <span className="font-semibold text-foreground">
                              {auditResult.investimentos?.lastChange?.date ? new Date(auditResult.investimentos.lastChange.date).toLocaleString('pt-BR') : '—'}
                            </span>
                          </div>
                        </div>
                        {auditResult.investimentos?.acoesList?.length > 0 && (
                          <div className="overflow-x-auto text-[11px]">
                            <table className="w-full text-left whitespace-nowrap">
                              <thead>
                                <tr className="text-muted border-b border-border/60">
                                  <th className="py-1">Código</th>
                                  <th className="py-1">Família/Produto</th>
                                  <th className="py-1">Mês Ref.</th>
                                  <th className="py-1">Fase Atual</th>
                                  <th className="py-1">Tipo Pgto</th>
                                  <th className="py-1">Expectativa Vol.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40">
                                {auditResult.investimentos.acoesList.slice(0, 10).map((a: any) => (
                                  <tr key={a.id} className="hover:bg-foreground/[0.01]">
                                    <td className="py-1.5 font-semibold text-foreground">#{a.codigo}</td>
                                    <td className="py-1.5 text-foreground">{a.familia_produto}</td>
                                    <td className="py-1.5 text-muted">{formatMesReferencia(a.mes_referencia)}</td>
                                    <td className="py-1.5">
                                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${FASE_CONFIG[a.fase_atual || 1]?.bgColor} ${FASE_CONFIG[a.fase_atual || 1]?.color} ${FASE_CONFIG[a.fase_atual || 1]?.borderColor}`}>
                                        {FASE_CONFIG[a.fase_atual || 1]?.label}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-muted">{a.tipo_pagamento || '—'}</td>
                                    <td className="py-1.5 text-muted">{a.expectativa_volume || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Section 3: Promotores & Visitas */}
                      <div className="bg-card border border-border/80 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-xs text-foreground uppercase border-b border-border pb-2">
                          👥 Disponibilização para Promotores
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div className="p-3 bg-elevated/40 border border-border/40 rounded-xl">
                            <span className="text-muted block text-[10px]">Pontos de Venda (PDVs)</span>
                            <span className="font-black text-lg text-foreground block mt-1">{auditResult.promotores?.totalPdvs}</span>
                          </div>
                          <div className="p-3 bg-elevated/40 border border-border/40 rounded-xl">
                            <span className="text-muted block text-[10px]">Metas Cadastradas</span>
                            <span className="font-black text-lg text-foreground block mt-1">{auditResult.promotores?.totalMetas}</span>
                          </div>
                          <div className="p-3 bg-elevated/40 border border-border/40 rounded-xl">
                            <span className="text-muted block text-[10px]">Visitas Totais</span>
                            <span className="font-black text-lg text-foreground block mt-1">{auditResult.promotores?.totalVisitas}</span>
                          </div>
                          <div className="p-3 bg-elevated/40 border border-border/40 rounded-xl">
                            <span className="text-muted block text-[10px]">Check-ins Realizados</span>
                            <span className="font-black text-lg text-emerald-400 block mt-1">{auditResult.promotores?.totalCheckins}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Faturamento (EXPANSÃO SOB DEMANDA - Apenas para Trade/Diretoria/Admin) */}
                      {!auditResult.isManagerOrComercial && (
                        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                          <button
                            onClick={handleExpandAuditFaturamento}
                            className="w-full flex items-center justify-between p-4 bg-elevated border-b border-border text-left font-bold text-xs text-foreground uppercase hover:bg-border transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <span>📊 Histórico de Faturamento e Vendas (Sankhya)</span>
                              {!isAuditFaturamentoExpanded && <span className="px-2 py-0.5 rounded bg-gold/10 text-gold text-[9px] font-normal lowercase tracking-normal">clique para consultar no banco</span>}
                            </div>
                            <span>{isAuditFaturamentoExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                          </button>
                          {isAuditFaturamentoExpanded && (
                            <div className="p-4 space-y-3 bg-card animate-in fade-in duration-200">
                              {auditFaturamentoLoading ? (
                                <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted">
                                  <RefreshCw className="w-4 h-4 animate-spin text-gold" />
                                  Carregando faturamento oficial...
                                </div>
                              ) : auditResult.faturamento?.vendas?.length > 0 ? (
                                <div className="overflow-x-auto text-[11px]">
                                  <table className="w-full text-left whitespace-nowrap">
                                    <thead>
                                      <tr className="text-muted border-b border-border/60">
                                        <th className="py-1">Mês</th>
                                        <th className="py-1">Faturamento Líquido</th>
                                        <th className="py-1">Quantidade (UN)</th>
                                        <th className="py-1">UF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                      {auditResult.faturamento.vendas.map((s: any, idx: number) => (
                                        <tr key={idx}>
                                          <td className="py-1.5 text-foreground font-semibold">{formatMesReferencia(s.mes)}</td>
                                          <td className="py-1.5 text-foreground font-bold">{formatCurrency(s.fat || 0, false)}</td>
                                          <td className="py-1.5 text-muted">{s.qty?.toLocaleString('pt-BR') || 0}</td>
                                          <td className="py-1.5 text-muted">{s.uf || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-4 text-center text-xs text-muted">
                                  Nenhum faturamento físico de Sankhya registrado para esta rede no banco de dados.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section 5: Timeline Cronológica */}
                      <div className="bg-card border border-border/80 rounded-2xl p-4 space-y-4">
                        <h4 className="font-bold text-xs text-foreground uppercase border-b border-border pb-2">
                          ⏳ Timeline Cronológica da Rede
                        </h4>
                        {auditResult.timeline?.length > 0 ? (
                          <div className="relative border-l border-border/80 pl-4 ml-2 space-y-4 text-xs py-2">
                            {auditResult.timeline.map((item: any, idx: number) => (
                              <div key={idx} className="relative">
                                {/* Bullet indicator */}
                               <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-gold border border-background shadow" />
                                <div className="text-muted text-[10px] font-mono">
                                  {new Date(item.date).toLocaleDateString('pt-BR')} {new Date(item.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="font-bold text-foreground mt-0.5">{item.title}</div>
                                <div className="text-muted text-[11px] mt-0.5">{item.desc}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-4 text-center text-xs text-muted">
                            Nenhum registro cronológico de alteração ou evento foi compilado para esta rede.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border flex justify-end bg-elevated">
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-6 py-2 bg-border text-foreground hover:bg-border/80 rounded-xl text-sm font-semibold transition-all"
                >
                  Fechar Auditoria
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Detalhes da Ação */}
        {selectedAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-border">
              <div className="p-3 sm:p-4 border-b border-border flex justify-between items-center bg-elevated">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Detalhes da Ação</h3>
                    {selectedAction.codigo && <span className="text-xs font-mono text-muted">Cód. #{selectedAction.codigo}</span>}
                    {selectedAction.possui_divergencia_calendario && (
                      <div className="relative group inline-flex mt-0.5">
                        <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-md text-[10px] font-bold px-1.5 py-0.5 cursor-help">⚠ Divergência de Calendário</span>
                        <div className="invisible group-hover:visible absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-xl p-3 text-xs shadow-xl z-50 space-y-1.5">
                          <p><span className="text-muted">📅 Planejado:</span> {formatDate(selectedAction.data_inicio)} → {formatDate(selectedAction.data_fim)}</p>
                          <p><span className="text-muted">❓ Motivo:</span> {selectedAction.motivo_divergencia_calendario ? MOTIVOS_DIVERGENCIA[selectedAction.motivo_divergencia_calendario as MotivoDivergencia] : '-'}</p>
                          <p><span className="text-muted">📝 Obs:</span> {selectedAction.observacao_divergencia}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedAction(null)} className="p-2 hover:bg-border rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
              
              <div ref={modalScrollRef} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                <button 
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  className="w-full text-left bg-background border border-border p-3 rounded-2xl flex flex-col gap-1 relative shadow-sm cursor-pointer hover:border-gold transition-colors group focus:outline-none"
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        {selectedAction.codigo && <span className="font-mono text-xs font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded">#{selectedAction.codigo}</span>}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${selectedAction.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                          {selectedAction.tipo_acao}
                        </span>
                        {(() => {
                          const cfg = FASE_CONFIG[selectedAction.fase_atual || 1] || FASE_CONFIG[1];
                          return (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                              {cfg.label}
                            </span>
                          );
                        })()}
                        {selectedAction.tipo_pagamento && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-blue-500/10 text-blue-400 border-blue-500/20 uppercase tracking-wide">
                            {selectedAction.tipo_pagamento.toLowerCase().includes('abatimento') || selectedAction.tipo_pagamento.toLowerCase().includes('boleto') ? 'BOLETO' : 'TRANSFERÊNCIA'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-foreground text-lg leading-tight uppercase tracking-wide">{selectedAction.rede}</h3>
                      <p className="text-sm text-foreground/80 mt-0.5">
                        {selectedAction.abrangencia === "SKU" 
                          ? "Múltiplos SKUs" 
                          : (selectedAction.familias_detalhes && selectedAction.familias_detalhes.length > 0 
                            ? selectedAction.familias_detalhes.map((f: any) => f.familia_nome).join(", ") 
                            : selectedAction.familia_produto)}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-black text-foreground text-lg tracking-tight">{formatCurrency(getValorTotal(selectedAction), false)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-full mt-1 pt-1 border-t border-border/50 text-muted group-hover:text-gold transition-colors">
                    {detailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {selectedAction.cancel_reason && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs space-y-1">
                    <span className="font-bold block">❌ Ação Cancelada / Não Aconteceu:</span>
                    <p className="italic">&quot;{selectedAction.cancel_reason}&quot;</p>
                  </div>
                )}
                 {selectedAction.rejection_reason && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs space-y-1">
                    <span className="font-bold block">
                      {selectedAction.devolvido_por === 'FINANCEIRO'
                        ? "⚠️ Devolvida pelo Financeiro:"
                        : selectedAction.devolvido_por === 'TRADE'
                          ? "⚠️ Devolvida pelo Trade:"
                          : selectedAction.trade_conferencia_aprovado === false
                            ? "⚠️ Devolvida pelo Financeiro:"
                            : "⚠️ Devolvida pelo Trade:"}
                    </span>
                    <p className="italic">&quot;{selectedAction.rejection_reason}&quot;</p>
                  </div>
                )}
                {selectedAction.is_reopened && selectedAction.reopened_reason && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl text-xs space-y-1">
                    <span className="font-bold block">🔓 Ação Reaberta:</span>
                    <p className="italic">&quot;{selectedAction.reopened_reason}&quot;</p>
                  </div>
                )}
                {selectedAction.alertas_preventivos && Array.isArray(selectedAction.alertas_preventivos) && selectedAction.alertas_preventivos.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl text-xs space-y-1">
                    <span className="font-bold block flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Alertas Preventivos Detectados:</span>
                    <ul className="list-disc pl-4 space-y-0.5 mt-1">
                      {selectedAction.alertas_preventivos.map((al: any, idx: number) => (
                        <li key={idx}>{al.mensagem}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {detailsExpanded && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Rede</span>
                      <span className="font-bold text-foreground block truncate" title={selectedAction.rede}>
                        {selectedAction.rede}
                      </span>
                      {selectedAction.codigo_matriz && (
                        <span className="text-[11px] text-muted font-mono block mt-0.5">
                          ({selectedAction.codigo_matriz})
                        </span>
                      )}
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Mês de Referência</span>
                      <span className="font-bold text-foreground">{formatMesReferencia(selectedAction.mes_referencia)}</span>
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Forma de Pagamento</span>
                      <span className="font-bold text-foreground">
                        {selectedAction.tipo_pagamento ? (selectedAction.tipo_pagamento.toLowerCase().includes('abatimento') || selectedAction.tipo_pagamento.toLowerCase().includes('boleto') ? 'Boleto' : 'Transferência') : "—"}
                      </span>
                    </div>

                    <div className={`p-3 rounded-xl border ${(() => {
                      const dias = modalPrazo ? parseInt(modalPrazo) : null;
                      return (dias !== null && !isNaN(dias) && dias > 35)
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-elevated border-border';
                    })()}`}>
                      <span className="text-xs text-muted block mb-1">Prazo de Pagamento</span>
                      {(() => {
                        const dias = modalPrazo ? parseInt(modalPrazo) : null;
                        if (!modalPrazo || dias === null || isNaN(dias)) {
                          return <span className="font-bold text-foreground">—</span>;
                        }
                        const foraDopadrao = dias > 35;
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`font-black text-base ${foraDopadrao ? 'text-red-500' : 'text-foreground'}`}>
                              {dias} dias
                            </span>
                            {foraDopadrao && (
                              <span className="bg-red-500/20 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                                ⚠ Fora do Padrão
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Família</span>
                      <span className="font-bold text-foreground">
                        {selectedAction.abrangencia === "SKU" 
                          ? "Múltiplos SKUs" 
                          : (selectedAction.familias_detalhes && selectedAction.familias_detalhes.length > 0 
                            ? selectedAction.familias_detalhes.map((f: any) => f.familia_nome).join(", ") 
                            : selectedAction.familia_produto)}
                      </span>
                    </div>

                    <div className="bg-elevated p-3 rounded-xl border border-border col-span-2">
                      <span className="text-xs text-muted block mb-1">Período</span>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gold" />
                        <span className="font-medium text-foreground">{formatDate(selectedAction.data_inicio)} até {formatDate(selectedAction.data_fim)}</span>
                      </div>
                    </div>

                    {/* Renderização incondicional de valores unitários da ação */}
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Preço Flat</span>
                      <span className="font-bold text-foreground">{selectedAction.preco_flat ? formatCurrency(selectedAction.preco_flat) : '-'}</span>
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Preço da Ação</span>
                      <span className="font-bold text-foreground">{selectedAction.preco_acao ? formatCurrency(selectedAction.preco_acao) : '-'}</span>
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Expectativa de Volume</span>
                      <span className="font-bold text-foreground">{selectedAction.expectativa_volume || '-'}</span>
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Investimento Unitário</span>
                      <span className="font-bold text-foreground">{selectedAction.valor_investimento ? formatCurrency(selectedAction.valor_investimento) : '-'}</span>
                    </div>

                    {/* Checklist Operacional & Evidências do Trade (Fase 2) */}
                    {(selectedAction.fase_atual || 1) === 2 && (
                      <div className="col-span-2 space-y-4 border-t border-border/50 pt-4 mt-2">
                        <span className="text-xs text-muted block font-bold">Checklist Operacional & Evidências (Trade)</span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Checkboxes Operacionais */}
                          <div className="space-y-3 bg-elevated/40 p-4 rounded-xl border border-border/40">
                            <span className="text-[10px] uppercase font-bold text-muted block tracking-wider mb-2">Checklist de Execução</span>
                            <div className="space-y-2.5">
                              <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-border text-gold focus:ring-gold/50 cursor-pointer" 
                                  checked={tradeChecklist.comunicacao} 
                                  onChange={(e) => handleActionChecklistChange('checklist_comunicacao', e.target.checked)} 
                                  disabled={!['admin', 'trade', 'ceo', 'diretor', 'financeiro'].includes(userRole?.toLowerCase() || '')}
                                />
                                <span className="text-xs font-semibold text-foreground group-hover:text-gold transition-colors">📢 1) Comunicação Concluída</span>
                              </label>
                              <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-border text-gold focus:ring-gold/50 cursor-pointer" 
                                  checked={tradeChecklist.logistica} 
                                  onChange={(e) => handleActionChecklistChange('checklist_logistica', e.target.checked)} 
                                  disabled={!['admin', 'trade', 'ceo', 'diretor', 'financeiro'].includes(userRole?.toLowerCase() || '')}
                                />
                                <span className="text-xs font-semibold text-foreground group-hover:text-gold transition-colors">🚚 2) Logística/Estoque Alinhado</span>
                              </label>
                              <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-border text-gold focus:ring-gold/50 cursor-pointer" 
                                  checked={tradeChecklist.auditoria} 
                                  onChange={(e) => handleActionChecklistChange('checklist_auditoria', e.target.checked)} 
                                  disabled={!['admin', 'trade', 'ceo', 'diretor', 'financeiro'].includes(userRole?.toLowerCase() || '')}
                                />
                                <span className="text-xs font-semibold text-foreground group-hover:text-gold transition-colors">🔍 3) Auditoria de Preço Agendada</span>
                              </label>
                              <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-border text-gold focus:ring-gold/50 cursor-pointer" 
                                  checked={tradeChecklist.conferencia} 
                                  onChange={(e) => handleActionChecklistChange('checklist_conferencia', e.target.checked)} 
                                  disabled={!['admin', 'trade', 'ceo', 'diretor', 'financeiro'].includes(userRole?.toLowerCase() || '')}
                                />
                                <span className="text-xs font-semibold text-foreground group-hover:text-gold transition-colors">⚖️ 4) Conferência Fís./Vídeo Alinhada</span>
                              </label>
                              <label className="flex items-start gap-2.5 cursor-pointer group pt-1.5 border-t border-border/30">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 mt-0.5 rounded border-border text-gold focus:ring-gold/50 cursor-pointer" 
                                  checked={tradeChecklist.sem_auditoria || false} 
                                  onChange={(e) => handleActionChecklistChange('checklist_sem_auditoria', e.target.checked)} 
                                  disabled={!['admin', 'trade', 'ceo', 'diretor', 'financeiro'].includes(userRole?.toLowerCase() || '')}
                                />
                                <span className="text-xs font-semibold text-foreground group-hover:text-gold transition-colors">⚠️ 5) Ação impossibilitada de auditoria pelo Trade. GRV autorizou dar sequência.</span>
                              </label>


                            </div>
                          </div>

                          {/* Evidências e Documentos */}
                          <div className="space-y-3 bg-elevated/40 p-4 rounded-xl border border-border/40">
                            <span className="text-[10px] uppercase font-bold text-muted block tracking-wider mb-2">Upload de Evidências</span>
                            
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-elevated hover:bg-border/40 border border-border rounded-xl cursor-pointer transition-all text-xs font-bold text-foreground">
                                <FileUp className="w-4 h-4 text-gold" />
                                <span>Anexar Nova Evidência</span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,image/*"
                                  onChange={(e) => handleActionEvidenceUpload(e.target.files?.[0] || null)}
                                  disabled={actionLoading === selectedAction.id}
                                />
                              </label>
                              
                              {selectedAction.evidencias_urls && selectedAction.evidencias_urls.length > 0 ? (
                                <div className="space-y-1.5 max-h-32 overflow-y-auto mt-2">
                                  <span className="text-[10px] text-muted block font-semibold">Arquivos Anexados:</span>
                                  {selectedAction.evidencias_urls.map((url: string, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleViewDocument(url)}
                                      className="text-xs text-gold hover:underline block truncate text-left max-w-full"
                                    >
                                      📄 Evidência #{idx + 1} ({url.split('_').pop()})
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted italic block mt-2">Nenhuma evidência anexada pelo Trade.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botões de Decisão */}
                        {['admin', 'trade', 'ceo', 'diretor', 'financeiro'].includes(userRole?.toLowerCase() || '') && (
                          <div className="flex gap-3 mt-3">
                            <button
                              onClick={() => {
                                if (confirm(`Aprovar esta ação de investimento do gerente?`)) {
                                  handlePhaseAction(selectedAction.id, () => validarTrade(selectedAction.id, {
                                    comunicacao: tradeChecklist.comunicacao,
                                    logistica: tradeChecklist.logistica,
                                    auditoria: tradeChecklist.auditoria,
                                    garantia: selectedAction.checklist_garantia || false,
                                    conferencia: tradeChecklist.conferencia,
                                    sem_auditoria: tradeChecklist.sem_auditoria
                                  }));
                                }
                              }}
                              disabled={actionLoading === selectedAction.id || !(tradeChecklist.comunicacao && tradeChecklist.logistica && (tradeChecklist.auditoria || tradeChecklist.sem_auditoria) && tradeChecklist.conferencia) || (tradeDivergencia.possui && (!tradeDivergencia.motivo || !tradeDivergencia.observacao))}
                              title={!(tradeChecklist.comunicacao && tradeChecklist.logistica && (tradeChecklist.auditoria || tradeChecklist.sem_auditoria) && tradeChecklist.conferencia) ? "Conclua todos os checklists operacionais antes de aprovar a ação." : (tradeDivergencia.possui && (!tradeDivergencia.motivo || !tradeDivergencia.observacao) ? "Preencha o motivo e observação de divergência de calendário antes de aprovar." : "")}
                              className="flex-1 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Aprovar Lançamento
                            </button>
                            <button
                              onClick={async () => {
                                const reason = prompt("Motivo da reprovação / reabertura da ação:");
                                if (reason && reason.trim()) {
                                  handlePhaseAction(selectedAction.id, () => reprovarAcaoTrade(selectedAction.id, reason));
                                } else if (reason !== null) {
                                  alert("O motivo é obrigatório para reprovar.");
                                }
                              }}
                              disabled={actionLoading === selectedAction.id}
                              className="flex-1 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              Reprovar e Reabrir
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Exibição consolidada/leitura de checklists para fases diferentes da Fase 2 */}
                    {(selectedAction.fase_atual || 1) !== 2 && (
                      <div className="col-span-2 space-y-3 border-t border-border/50 pt-4 mt-2">
                        <span className="text-xs text-muted block font-bold">Checklist Operacional & Evidências (Trade)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="bg-elevated/30 p-3 rounded-xl border border-border/40 space-y-1.5">
                            <span className="text-[10px] text-muted uppercase font-bold block mb-1">Status do Checklist</span>
                            <div className="flex items-center gap-2">
                              <span>{selectedAction.checklist_comunicacao ? "✅" : "❌"}</span>
                              <span>Comunicação</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{selectedAction.checklist_logistica ? "✅" : "❌"}</span>
                              <span>Logística/Estoque</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{selectedAction.checklist_auditoria ? "✅" : "❌"}</span>
                              <span>Auditoria de Preço</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{selectedAction.checklist_conferencia ? "✅" : "❌"}</span>
                              <span>Conferência Trade</span>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                              <span>{selectedAction.checklist_sem_auditoria ? "⚠️" : "❌"}</span>
                              <span className={selectedAction.checklist_sem_auditoria ? "font-bold text-amber-400" : ""}>
                                {selectedAction.checklist_sem_auditoria ? "Exceção GRV: Auditoria não realizada (Autorizado por GRV)" : "Sem Exceção de Auditoria"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="bg-elevated/30 p-3 rounded-xl border border-border/40 space-y-1.5">
                            <span className="text-[10px] text-muted uppercase font-bold block mb-1">Evidências Anexadas</span>
                            {selectedAction.evidencias_urls && selectedAction.evidencias_urls.length > 0 ? (
                              <div className="space-y-1 max-h-24 overflow-y-auto">
                                {selectedAction.evidencias_urls.map((url: string, idx: number) => (
                                  <button
                                    key={idx}
                                    onClick={() => handleViewDocument(url)}
                                    className="text-xs text-gold hover:underline block truncate text-left max-w-full"
                                  >
                                    📄 Evidência #{idx + 1}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted italic block">Nenhuma evidência anexada.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedAction.skus_detalhes && selectedAction.skus_detalhes.length > 0 && (
                      <div className="col-span-2 space-y-3 mt-2">
                        <span className="text-xs text-muted block font-bold">Detalhes dos SKUs</span>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedAction.skus_detalhes.map((s, idx) => (
                            <div key={idx} className="bg-background border border-border p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <span className="font-bold text-foreground text-sm flex-1">{s.sku}</span>
                              <div className="flex flex-wrap gap-4 text-xs">
                                <div className="flex flex-col">
                                  <span className="text-muted">Flat</span>
                                  <span className="font-medium text-foreground">{s.preco_flat ? formatCurrency(s.preco_flat) : '-'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted">Ação</span>
                                  <span className="font-medium text-foreground">{s.preco_acao ? formatCurrency(s.preco_acao) : '-'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted">Inv.</span>
                                  <span className="font-medium text-gold">{s.investimento ? formatCurrency(s.investimento, false) : '-'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted">Vol.</span>
                                  <span className="font-medium text-foreground">{s.expectativa_volume ? s.expectativa_volume : '-'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedAction.date_mode === "multiple" && (
                      <div className="col-span-2 space-y-3 mt-3 border-t border-border/50 pt-3">
                        <span className="text-xs text-muted block font-bold">Cronograma da Ação</span>
                        <div className="space-y-2">

                          {selectedAction.skus_detalhes && selectedAction.skus_detalhes.map((s: any, idx: number) => {
                            const status = calcularStatusItemInvestimento(s, selectedAction.fase_atual || 1, selectedAction.apuracao_preenchida_em);
                            const badgeColors = {
                              AGENDADA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                              EM_ANDAMENTO: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                              ENCERRADA: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                              ATRASADA: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                            };
                            return (
                              <div key={`cron-sku-${idx}`} className="flex items-center justify-between bg-elevated border border-border p-2.5 rounded-lg text-xs">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground">{s.sku} (SKU)</span>
                                  <span className="text-[10px] text-muted">{formatDate(s.start_date)} até {formatDate(s.end_date)}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeColors[status]}`}>
                                  {status.replace("_", " ")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {/* Histórico de Alterações */}
                <div className="pt-3 border-t border-border">
                  <button
                    onClick={() => setAuditExpanded(!auditExpanded)}
                    className="w-full flex items-center justify-between text-xs text-muted font-bold hover:text-foreground transition-colors"
                  >
                    <span>Histórico de Alterações ({auditLogs.length})</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${auditExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {auditExpanded && (
                    <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                      {auditLoading ? (
                        <p className="text-xs text-muted text-center py-4">Carregando...</p>
                      ) : auditLogs.length === 0 ? (
                        <p className="text-xs text-muted text-center py-4">Nenhum registro de auditoria</p>
                      ) : (
                        auditLogs.map((log, idx) => {
                          const oldFam = log.old_data?.familias_detalhes || [];
                          const newFam = log.new_data?.familias_detalhes || [];
                          const oldSkus = log.old_data?.skus_detalhes || [];
                          const newSkus = log.new_data?.skus_detalhes || [];
                          
                          // Build granular diff
                          const diffs: string[] = [];
                          if (log.action === 'EXCECAO_AUDITORIA_TRADE') {
                            diffs.push(`⚠️ Exceção de Auditoria autorizada pelo GRV: Não → Sim`);
                          } else {
                            const fields = ['fase_atual', 'rede', 'tipo_acao', 'tipo_pagamento', 'abrangencia', 'data_inicio', 'data_fim', 'checklist_sem_auditoria'];
                            fields.forEach(f => {
                              if (log.old_data && log.new_data && String(log.old_data[f] ?? '') !== String(log.new_data[f] ?? '')) {
                                const labels: Record<string, string> = { fase_atual: 'Fase', rede: 'Rede', tipo_acao: 'Tipo', tipo_pagamento: 'Pagamento', abrangencia: 'Abrangência', data_inicio: 'Início', data_fim: 'Fim', checklist_sem_auditoria: 'Exceção Auditoria Trade (GRV)' };
                                const valStr = (v: any) => typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : (v ?? '–');
                                diffs.push(`${labels[f] || f}: ${valStr(log.old_data[f])} → ${valStr(log.new_data[f])}`);
                              }
                            });
                          }
                          
                          // Diff familias_detalhes granularly
                          if (JSON.stringify(oldFam) !== JSON.stringify(newFam)) {
                            const oldMap = new Map(oldFam.map((f: any) => [f.familia_nome || f.familia_id, f]));
                            newFam.forEach((nf: any) => {
                              const of_: any = oldMap.get(nf.familia_nome || nf.familia_id);
                              if (!of_) {
                                diffs.push(`+ ${nf.familia_nome} adicionada`);
                              } else {
                                ['preco_flat', 'preco_acao', 'investimento', 'expectativa_volume'].forEach(k => {
                                  if (String(of_[k] ?? '') !== String(nf[k] ?? '')) {
                                    const label = k === 'preco_flat' ? 'Flat' : k === 'preco_acao' ? 'Ação' : k === 'investimento' ? 'Inv.' : 'Vol.';
                                    diffs.push(`${nf.familia_nome} ${label}: ${of_[k] ?? '–'} → ${nf[k] ?? '–'}`);
                                  }
                                });
                              }
                            });
                            oldFam.forEach((of_: any) => {
                              if (!newFam.find((nf: any) => (nf.familia_nome || nf.familia_id) === (of_.familia_nome || of_.familia_id))) {
                                diffs.push(`− ${of_.familia_nome} removida`);
                              }
                            });
                          }
                          
                          // Diff skus_detalhes granularly
                          if (JSON.stringify(oldSkus) !== JSON.stringify(newSkus)) {
                            const oldSkuMap = new Map(oldSkus.map((s: any) => [s.sku, s]));
                            newSkus.forEach((ns: any) => {
                              const os: any = oldSkuMap.get(ns.sku);
                              if (!os) {
                                diffs.push(`+ SKU ${ns.sku} adicionado`);
                              } else {
                                ['preco_flat', 'preco_acao', 'investimento', 'expectativa_volume'].forEach(k => {
                                  if (String(os[k] ?? '') !== String(ns[k] ?? '')) {
                                    const label = k === 'preco_flat' ? 'Flat' : k === 'preco_acao' ? 'Ação' : k === 'investimento' ? 'Inv.' : 'Vol.';
                                    diffs.push(`SKU ${ns.sku} ${label}: ${os[k] ?? '–'} → ${ns[k] ?? '–'}`);
                                  }
                                });
                              }
                            });
                            oldSkus.forEach((os: any) => {
                              if (!newSkus.find((ns: any) => ns.sku === os.sku)) {
                                diffs.push(`− SKU ${os.sku} removido`);
                              }
                            });
                          }
                          
                          return (
                            <div key={log.id || idx} className="bg-background border border-border rounded-xl p-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    log.action === 'INSERT' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                    log.action === 'DELETE' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                    log.action === 'EXCECAO_AUDITORIA_TRADE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  }`}>{log.action === 'INSERT' ? 'Criação' : log.action === 'DELETE' ? 'Exclusão' : log.action === 'EXCECAO_AUDITORIA_TRADE' ? 'Exceção GRV' : 'Alteração'}</span>
                                  <span className="text-[10px] text-muted">{log.user_name}</span>
                                </div>
                                <span className="text-[10px] text-muted">
                                  {new Date(log.created_at).toLocaleDateString('pt-BR')} {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {diffs.length > 0 && (
                                <div className="space-y-0.5">
                                  {diffs.slice(0, 8).map((d, i) => (
                                    <p key={i} className={`text-[10px] font-medium ${d.startsWith('+') ? 'text-green-400' : d.startsWith('−') ? 'text-red-400' : 'text-foreground/70'}`}>{d}</p>
                                  ))}
                                  {diffs.length > 8 && <p className="text-[10px] text-muted">... +{diffs.length - 8} alterações</p>}
                                </div>
                              )}
                              {diffs.length === 0 && log.action !== 'INSERT' && (
                                <p className="text-[10px] text-muted italic">Sem alterações detectáveis nos campos monitorados</p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Phase Timeline */}
                <div className="pt-3 border-t border-border">
                  <span className="text-xs text-muted block mb-2 font-bold">Progresso da Ação</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map((step) => {
                      const cfg = FASE_CONFIG[step];
                      const currentFase = selectedAction.fase_atual || 1;
                      const isActive = step === currentFase;
                      const isDone = step < currentFase;
                      return (
                        <div key={step} className="flex items-center flex-1">
                          <div className={`flex flex-col items-center flex-1 ${isActive ? 'scale-105' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                              isDone ? 'bg-green-500/20 border-green-500 text-green-400' :
                              isActive ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}` :
                              'bg-elevated border-border text-muted'
                            }`}>
                              {isDone ? '✓' : step}
                            </div>
                            <span className={`text-[9px] mt-1 font-medium text-center leading-tight ${isActive ? cfg.color : isDone ? 'text-green-400' : 'text-muted/50'}`}>
                              {cfg.label}
                              {step === 4 && <span className="block text-[7px] opacity-70 mt-0.5">(Financeiro)</span>}
                            </span>
                          </div>
                          {step < 6 && <div className={`w-full h-0.5 -mt-3 ${isDone ? 'bg-green-500/40' : 'bg-border'}`} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons - hidden in calendar (read-only) mode */}
                {viewMode !== 'calendar' && (
                <div className="pt-3 border-t border-border flex flex-col gap-2">
                  {(selectedAction.fase_atual || 1) === 1 && (
                    <button
                      onClick={() => handlePhaseAction(selectedAction.id, () => enviarParaTrade(selectedAction.id))}
                      disabled={actionLoading === selectedAction.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                      {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                      Passar para o Trade
                    </button>
                  )}



                  {(selectedAction.fase_atual || 1) === 2 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const reason = prompt("Motivo obrigatório pelo qual a ação não aconteceu / cancelada:");
                          if (reason && reason.trim()) {
                            handlePhaseAction(selectedAction.id, () => marcarAcaoNaoAconteceu(selectedAction.id, reason));
                          } else if (reason !== null) {
                            alert("O motivo do cancelamento é obrigatório.");
                          }
                        }}
                        disabled={actionLoading === selectedAction.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                        Ação Não Aconteceu
                      </button>
                    </div>
                  )}

                  {(selectedAction.fase_atual || 1) === 3 && (
                    <div className="bg-elevated p-3 rounded-xl border border-border flex flex-col gap-3 mb-1">
                      <span className="text-sm font-bold text-foreground">Preencher Apuração</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Número do Acordo</label>
                          <input type="text" value={apuracaoForm.numero_acordo} onChange={e => setApuracaoForm({...apuracaoForm, numero_acordo: e.target.value})} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Ex: AC-2026-001" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Condição de Pagamento</label>
                          <input type="text" value={apuracaoForm.condicao_pagamento} onChange={e => setApuracaoForm({...apuracaoForm, condicao_pagamento: e.target.value})} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Ex: 30 dias, Crédito em Nota, etc." />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Qtd. Vendida (Sell-out)</label>
                          <input type="number" value={apuracaoForm.qtd_vendida} onChange={e => {
                            const qtd = e.target.value;
                            const valInvest = selectedAction.valor_investimento || 0;
                            const calcValor = qtd ? (parseFloat(qtd) * valInvest).toFixed(2) : '';
                            setApuracaoForm({...apuracaoForm, qtd_vendida: qtd, valor_realizado: calcValor});
                          }} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Quantidade" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Valor Projetado (Comercial)</label>
                          <input type="text" readOnly value={formatCurrency(getValorTotal(selectedAction), false)} className="w-full bg-elevated text-muted border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed font-medium" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Valor Realizado (R$) - Automático</label>
                          <input type="text" readOnly value={apuracaoForm.valor_realizado ? formatCurrency(Number(apuracaoForm.valor_realizado), false) : ''} className="w-full bg-elevated text-emerald-600 dark:text-emerald-400 font-bold border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed" placeholder="Calculado" />
                        </div>
                        <div className="md:col-span-2" ref={boletoDropdownRef}>
                          <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wide">
                            Nota Fiscal
                          </label>

                          {/* Checkbox: Cliente não possui boleto em aberto */}
                          {clientHasBoletoCondition && boletosAbertos.length === 0 && (
                            <div className="mb-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-3">
                              <input
                                id="sem_boleto_checkbox"
                                type="checkbox"
                                checked={semBoleto}
                                onChange={(e) => setSemBoleto(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-purple-500/30 text-purple-600 focus:ring-purple-500/50 bg-background cursor-pointer"
                              />
                              <label htmlFor="sem_boleto_checkbox" className="text-xs text-foreground cursor-pointer select-none">
                                <span className="font-bold block text-purple-300">Cliente não possui boleto em aberto</span>
                                <span className="text-muted block mt-0.5">Sinalize que a apuração será concluída sem boletos associados.</span>
                              </label>
                            </div>
                          )}
                          
                          {/* List of currently associated boletos */}
                          {vinculosBoletos.length > 0 ? (
                            <div className="space-y-2 mb-3">
                              {vinculosBoletos.map((vinculo, index) => (
                                <div key={vinculo.boleto_id || index} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl relative">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-bold text-purple-300 block truncate" title={vinculo.label}>
                                      {vinculo.rede ? `${vinculo.rede} — ` : ''}Nº {vinculo.numero_boleto} {vinculo.tipo_titulo ? `[${vinculo.tipo_titulo}]` : ''}
                                    </span>
                                    {vinculo.valor_total !== undefined && (
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-purple-300/80">
                                        <span>Valor Original: <strong className="text-gold font-bold">{formatCurrency(vinculo.valor_total)}</strong></span>
                                        {vinculo.vencimento && <span className="opacity-40">|</span>}
                                        {vinculo.vencimento && <span>Venc: <strong className="text-foreground">{formatDate(vinculo.vencimento)}</strong></span>}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] text-muted font-bold uppercase text-right leading-tight block">
                                      Valor para<br />abatimento (R$):
                                    </span>
                                    <input
                                      type="text"
                                      value={vinculo.valor_associado}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setVinculosBoletos(prev => prev.map((v, idx) => idx === index ? { ...v, valor_associado: val } : v));
                                      }}
                                      className="w-24 bg-background border border-purple-500/30 rounded-lg px-2.5 py-1 text-xs font-extrabold text-gold text-right focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                      placeholder="0.00"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVinculosBoletos(prev => prev.filter((_, idx) => idx !== index));
                                      }}
                                      className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center justify-center"
                                      title="Remover este boleto"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted italic mb-2 px-1">
                              Nenhum boleto vinculado até o momento.
                            </div>
                          )}

                          {/* Search & Add block */}
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                              <input
                                type="text"
                                value={boletoSearchTerm}
                                onChange={e => {
                                  setBoletoSearchTerm(e.target.value);
                                  setShowBoletoDropdown(true);
                                }}
                                onFocus={() => setShowBoletoDropdown(true)}
                                placeholder={`Adicionar boleto... (mostrando ${boletosAbertos.length} da rede ${selectedAction.rede})`}
                                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-muted/60"
                              />
                              {boletoSearchLoading && (
                                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400 animate-spin" />
                              )}
                            </div>

                            {showBoletoDropdown && (
                              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-2xl max-h-[240px] overflow-y-auto">
                                {/* Boletos da rede (default) */}
                                {boletoSearchTerm.length === 0 && boletosAbertos.length > 0 && (
                                  <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-muted uppercase tracking-wider bg-elevated border-b border-border sticky top-0">
                                      Boletos da rede {selectedAction.rede}
                                    </div>
                                    {boletosAbertos.map(b => (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => {
                                          if (vinculosBoletos.some(v => v.boleto_id === b.id)) {
                                            alert("Este boleto já foi adicionado.");
                                            return;
                                          }
                                          const totalRealizado = parseFloat(apuracaoForm.valor_realizado.replace(',', '.')) || 0;
                                          const alreadyAssociated = vinculosBoletos.reduce((sum, v) => sum + (parseFloat(v.valor_associado.replace(',', '.')) || 0), 0);
                                          const remaining = Math.max(0, totalRealizado - alreadyAssociated);
                                          const defaultVal = Math.min(b.valor_total, remaining);

                                          setVinculosBoletos([
                                            ...vinculosBoletos,
                                            {
                                              boleto_id: b.id,
                                              valor_associado: defaultVal.toFixed(2),
                                              label: `${b.rede} — Nº ${b.numero_boleto} [${b.tipo_titulo || 'BOLETO'}] — Total: ${formatCurrency(b.valor_total)} — Venc: ${new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`,
                                              numero_boleto: b.numero_boleto,
                                              valor_total: b.valor_total,
                                              tipo_titulo: b.tipo_titulo,
                                              vencimento: b.vencimento,
                                              rede: b.rede,
                                              prazo: b.prazo
                                            }
                                          ]);
                                          if (b.prazo) {
                                            const cleanPrazo = String(b.prazo).toLowerCase().includes('dia') 
                                              ? b.prazo 
                                              : `${b.prazo} dias`;
                                            setApuracaoForm(prev => ({ ...prev, condicao_pagamento: cleanPrazo }));
                                          }
                                          setShowBoletoDropdown(false);
                                          setBoletoSearchTerm("");
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-purple-500/10 transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-foreground">Nº {b.numero_boleto}</span>
                                            <span className="text-xs text-muted">{b.rede}</span>
                                            {b.tipo_titulo && (
                                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold border border-blue-500/20 uppercase tracking-wide">
                                                {b.tipo_titulo}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-xs font-bold text-gold">{formatCurrency(b.valor_total)}</span>
                                            <span className="text-[10px] text-muted">Venc: {new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </>
                                )}

                                {/* Empty rede default */}
                                {boletoSearchTerm.length === 0 && boletosAbertos.length === 0 && (
                                  <div className="px-3 py-3 text-center">
                                    <p className="text-xs text-amber-500">Nenhum boleto em aberto para a rede {selectedAction.rede}.</p>
                                    <p className="text-[10px] text-muted mt-1">Digite acima para buscar em todas as redes.</p>
                                  </div>
                                )}

                                {/* Search results */}
                                {boletoSearchTerm.length >= 1 && (
                                  <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-muted uppercase tracking-wider bg-elevated border-b border-border sticky top-0">
                                      {boletoSearchLoading ? 'Buscando...' : `${boletoSearchResults.length} resultado(s) para "${boletoSearchTerm}"`}
                                    </div>
                                    {boletoSearchResults.length === 0 && !boletoSearchLoading && (
                                      <div className="px-3 py-3 text-center text-xs text-muted">
                                        Nenhum boleto encontrado.
                                      </div>
                                    )}
                                    {boletoSearchResults.map(b => (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => {
                                          if (vinculosBoletos.some(v => v.boleto_id === b.id)) {
                                            alert("Este boleto já foi adicionado.");
                                            return;
                                          }
                                          const totalRealizado = parseFloat(apuracaoForm.valor_realizado.replace(',', '.')) || 0;
                                          const alreadyAssociated = vinculosBoletos.reduce((sum, v) => sum + (parseFloat(v.valor_associado.replace(',', '.')) || 0), 0);
                                          const remaining = Math.max(0, totalRealizado - alreadyAssociated);
                                          const defaultVal = Math.min(b.valor_total, remaining);

                                          setVinculosBoletos([
                                            ...vinculosBoletos,
                                            {
                                              boleto_id: b.id,
                                              valor_associado: defaultVal.toFixed(2),
                                              label: `${b.rede} — Nº ${b.numero_boleto} [${b.tipo_titulo || 'BOLETO'}] — Total: ${formatCurrency(b.valor_total)} — Venc: ${new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`,
                                              numero_boleto: b.numero_boleto,
                                              valor_total: b.valor_total,
                                              tipo_titulo: b.tipo_titulo,
                                              vencimento: b.vencimento,
                                              rede: b.rede,
                                              prazo: b.prazo
                                            }
                                          ]);
                                          if (b.prazo) {
                                            const cleanPrazo = String(b.prazo).toLowerCase().includes('dia') 
                                              ? b.prazo 
                                              : `${b.prazo} dias`;
                                            setApuracaoForm(prev => ({ ...prev, condicao_pagamento: cleanPrazo }));
                                          }
                                          setShowBoletoDropdown(false);
                                          setBoletoSearchTerm("");
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-purple-500/10 transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-foreground">Nº {b.numero_boleto}</span>
                                            <span className="text-xs text-muted truncate">{b.rede}</span>
                                            {b.tipo_titulo && (
                                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold border border-blue-500/20 uppercase tracking-wide">
                                                {b.tipo_titulo}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-xs font-bold text-gold">{formatCurrency(b.valor_total)}</span>
                                            <span className="text-[10px] text-muted">Venc: {new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Association status tracking message */}
                          {(() => {
                            const totalRealizado = parseFloat(apuracaoForm.valor_realizado.replace(',', '.')) || 0;
                            const totalVinculado = vinculosBoletos.reduce((sum, v) => sum + (parseFloat(v.valor_associado.replace(',', '.')) || 0), 0);
                            if (totalRealizado > 0) {
                              if (totalVinculado === 0) {
                                if (semBoleto) {
                                  return (
                                    <div className="mt-2 text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                                      ✓ Sinalizado que o cliente não possui boleto em aberto. Apuração pronta para envio.
                                    </div>
                                  );
                                }
                                return (
                                  <div className="mt-2 text-[11px] text-amber-500 font-medium">
                                    ⚠️ Nenhum boleto vinculado. Por favor, adicione pelo menos um boleto.
                                  </div>
                                );
                              }
                              if (totalVinculado < totalRealizado) {
                                return (
                                  <div className="mt-2 text-[11px] text-amber-400 font-medium">
                                    ⏳ Faltam {formatCurrency(totalRealizado - totalVinculado)} para associar (Total Realizado: {formatCurrency(totalRealizado)}).
                                  </div>
                                );
                              }
                              if (totalVinculado === totalRealizado) {
                                return (
                                  <div className="mt-2 text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                                    ✓ Valor apurado totalmente associado aos boletos vinculados!
                                  </div>
                                );
                              }
                              return (
                                <div className="mt-2 text-[11px] text-red-400 font-medium">
                                  ⚠️ A soma dos boletos vinculados ({formatCurrency(totalVinculado)}) excede o valor realizado ({formatCurrency(totalRealizado)}).
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-muted mb-1">Anexar Acordo / Evidência (Obrigatório)</label>
                          <div className="flex items-center gap-3">
                            {selectedAction.documento_url ? (
                              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg flex-1">
                                <FileText className="w-4 h-4" />
                                <span className="text-sm font-medium truncate">Documento Anexado</span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleViewDocument(selectedAction.documento_url!); }}
                                  className="ml-auto text-xs underline hover:text-blue-400"
                                >
                                  Visualizar
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-background hover:bg-border border border-dashed border-border rounded-lg flex-1 cursor-pointer transition-colors group">
                                {uploadingId === selectedAction.id ? (
                                  <RefreshCw className="w-4 h-4 animate-spin text-muted" />
                                ) : (
                                  <>
                                    <FileUp className="w-4 h-4 text-muted group-hover:text-purple-400 transition-colors" />
                                    <span className="text-sm text-muted group-hover:text-foreground font-medium transition-colors">Selecionar arquivo (PDF ou Imagem)...</span>
                                  </>
                                )}
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept=".pdf,image/*"
                                  onChange={(e) => handleFileUpload(selectedAction.id, e.target.files?.[0] || null)}
                                  disabled={uploadingId === selectedAction.id}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleApuracaoSubmit}
                        disabled={actionLoading === selectedAction.id || !apuracaoForm.numero_acordo || (clientHasBoletoCondition && vinculosBoletos.length === 0 && !semBoleto)}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Concluir Apuração
                      </button>
                    </div>
                  )}

                  {(selectedAction.fase_atual || 1) === 4 && (
                    <div className="flex flex-col gap-3">
                      <div className="bg-elevated p-3 rounded-xl border border-border flex flex-col gap-2">
                        <span className="text-sm font-bold text-foreground">Nota Fiscal</span>
                        {vinculosBoletos.length > 0 ? (
                          <div className="space-y-2">
                            {vinculosBoletos.map((vinculo, index) => (
                              <div key={vinculo.boleto_id || index} className="flex flex-col p-2.5 bg-background border border-border rounded-xl">
                                <span className="text-xs font-bold text-foreground-secondary break-all">
                                  {vinculo.rede ? `${vinculo.rede} — ` : ''}Nº {vinculo.numero_boleto} {vinculo.tipo_titulo ? `[${vinculo.tipo_titulo}]` : ''}
                                </span>
                                {vinculo.valor_total !== undefined && (
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground/80">
                                    <span>Valor Original: <strong className="text-gold font-bold">{formatCurrency(vinculo.valor_total)}</strong></span>
                                    {vinculo.vencimento && <span className="text-border mx-1">|</span>}
                                    {vinculo.vencimento && <span>Venc: <strong className="text-foreground">{formatDate(vinculo.vencimento)}</strong></span>}
                                  </div>
                                )}
                                <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-border/50">
                                  <span className="text-[10px] text-muted font-bold uppercase text-left leading-tight block">
                                    Valor para<br />abatimento:
                                  </span>
                                  <span className="text-sm font-extrabold text-gold">
                                    {formatCurrency(Number(vinculo.valor_associado))}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : selectedAction.sem_boleto ? (
                          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            Sinalizado que o cliente não possui boletos em aberto.
                          </div>
                        ) : (
                          <span className="text-xs text-muted italic">Nenhum boleto em aberto ou vinculado.</span>
                        )}
                      </div>
                      {/* Upload boleto do cliente */}
                      <div>
                        <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wide">Boleto do Cliente</label>
                        {(selectedAction as any).financeiro_boleto_url ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg">
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm font-medium truncate flex-1">Boleto Anexado</span>
                            <button
                              type="button"
                              onClick={() => handleViewDocument((selectedAction as any).financeiro_boleto_url)}
                              className="text-xs underline hover:text-blue-400 flex-shrink-0"
                            >
                              Visualizar
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-background hover:bg-border border border-dashed border-border rounded-lg cursor-pointer transition-colors group">
                            {uploadingBoletoFinanceiro ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-muted" />
                            ) : (
                              <>
                                <FileUp className="w-4 h-4 text-muted group-hover:text-blue-400 transition-colors" />
                                <span className="text-sm text-muted group-hover:text-foreground font-medium transition-colors">Selecionar arquivo (PDF ou Imagem)...</span>
                              </>
                            )}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,image/*"
                              onChange={(e) => handleBoletoFinanceiroUpload(selectedAction.id, e.target.files?.[0] || null)}
                              disabled={uploadingBoletoFinanceiro}
                            />
                          </label>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePhaseAction(selectedAction.id, () => conferirTrade(selectedAction.id, true))}
                          disabled={actionLoading === selectedAction.id || (userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO' && userRole !== 'Trade')}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                          title={userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO' && userRole !== 'Trade' ? "Apenas perfil Financeiro ou Trade pode aprovar" : ""}
                        >
                          {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Aprovar
                        </button>
                        <button
                          onClick={() => {
                            const obs = prompt("Motivo da devolução:");
                            if (obs !== null) handlePhaseAction(selectedAction.id, () => conferirTrade(selectedAction.id, false, obs));
                          }}
                          disabled={actionLoading === selectedAction.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Devolver
                        </button>
                      </div>
                    </div>
                  )}

                  {(selectedAction.fase_atual || 1) === 5 && (
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        await handlePhaseAction(selectedAction.id, () => confirmarPagamento(selectedAction.id, formData));
                      }}
                      className="bg-elevated p-3 rounded-xl border border-border flex flex-col gap-3 mt-2"
                    >
                      <span className="text-sm font-bold text-foreground">Finalizar Financeiro</span>
                      
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Observações (Opcional)</label>
                        <textarea 
                          name="financeiro_observacoes" 
                          rows={2} 
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" 
                          placeholder="Detalhes do pagamento, número de transação, etc." 
                        />
                      </div>
                      
                      <button
                        type="submit"
                        disabled={actionLoading === selectedAction.id || (userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO' && userRole !== 'Trade')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        title={userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO' && userRole !== 'Trade' ? "Apenas perfil Financeiro ou Trade pode finalizar" : ""}
                      >
                        {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                        Confirmar Pagamento
                      </button>
                    </form>
                  )}

                  {(selectedAction.fase_atual || 1) === 6 && (
                    <div className="flex flex-col gap-3 mt-2">
                      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <div>
                          <span className="text-sm font-bold text-green-400">Ação Concluída</span>
                          {selectedAction.financeiro_pago_em && (
                            <span className="text-xs text-muted block">Pago em {new Date(selectedAction.financeiro_pago_em).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>

                      {/* ROI Pós-Ação Container */}
                      <div className="bg-elevated p-3 rounded-xl border border-border flex flex-col gap-3">
                        <span className="text-sm font-bold text-foreground">Fechamento Real & ROI Pós-Ação</span>
                        
                        {selectedAction.roi !== null && selectedAction.roi !== undefined && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2.5 bg-background border border-border rounded-lg">
                              <span className="text-xs text-muted font-medium">ROI da Ação:</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-black ${
                                selectedAction.roi < 1.0 ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                                selectedAction.roi <= 1.5 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                                selectedAction.roi <= 3.0 ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
                                'bg-gold/15 text-gold border border-gold/30'
                              }`}>
                                ROI: {Number(selectedAction.roi).toFixed(2)} ({
                                  selectedAction.roi < 1.0 ? 'Crítico' :
                                  selectedAction.roi <= 1.5 ? 'Atenção' :
                                  selectedAction.roi <= 3.0 ? 'Bom' : 'Excelente'
                                })
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 bg-background border border-border rounded-lg flex flex-col">
                                <span className="text-muted font-medium">Resultado:</span>
                                <span className="font-bold text-foreground mt-0.5">{selectedAction.action_result || 'N/A'}</span>
                              </div>
                              <div className="p-2 bg-background border border-border rounded-lg flex flex-col">
                                <span className="text-muted font-medium">Score Execução:</span>
                                <span className="font-bold text-foreground mt-0.5">{selectedAction.execution_score !== null && selectedAction.execution_score !== undefined ? `${selectedAction.execution_score}/100` : 'Pendente'}</span>
                              </div>
                            </div>

                            {selectedAction.post_action_notes && (
                              <div className="p-2.5 bg-background border border-border rounded-lg text-xs">
                                <span className="text-muted font-medium block mb-0.5">Notas Operacionais:</span>
                                <p className="text-foreground/80 italic">&quot;{selectedAction.post_action_notes}&quot;</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-muted mb-0.5">Volume Real</label>
                            <input 
                              type="number" 
                              value={realVolume}
                              onChange={(e) => setRealVolume(e.target.value)}
                              placeholder="0"
                              className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-muted mb-0.5">Faturamento Real</label>
                            <input 
                              type="number" 
                              value={realFaturamento}
                              onChange={(e) => setRealFaturamento(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-muted mb-0.5">Margem Real</label>
                            <input 
                              type="number" 
                              value={realMargem}
                              onChange={(e) => setRealMargem(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-muted mb-0.5">Resultado Qualitativo</label>
                            <select
                              value={actionResult}
                              onChange={(e) => setActionResult(e.target.value)}
                              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none"
                            >
                              <option value="SUCESSO">SUCESSO</option>
                              <option value="PARCIAL">PARCIAL</option>
                              <option value="FRACASSO">FRACASSO</option>
                              <option value="NAO_EXECUTADA">NAO_EXECUTADA</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-muted mb-0.5">Execution Score (0-100)</label>
                            <input 
                              type="number" 
                              min="0"
                              max="100"
                              value={executionScore}
                              onChange={(e) => setExecutionScore(e.target.value)}
                              placeholder="Score Promotor"
                              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-muted mb-0.5">Notas do Fechamento (Operacional)</label>
                          <textarea
                            value={postActionNotes}
                            onChange={(e) => setPostActionNotes(e.target.value)}
                            rows={2}
                            placeholder="Descreva detalhes operacionais, problemas na loja, etc."
                            className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
                          />
                        </div>

                        <button
                          onClick={async () => {
                            if (!realVolume || !realFaturamento || !realMargem) {
                              alert("Por favor, preencha os campos de volume, faturamento e margem real.");
                              return;
                            }
                            await handlePhaseAction(selectedAction.id, () => fecharAcaoInvestimento(selectedAction.id, {
                              real_volume: Number(realVolume),
                              real_faturamento: Number(realFaturamento),
                              real_margem: Number(realMargem),
                              action_result: actionResult,
                              post_action_notes: postActionNotes,
                              execution_score: executionScore ? Number(executionScore) : undefined
                            }));
                          }}
                          disabled={actionLoading === selectedAction.id}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {actionLoading === selectedAction.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Salvar Fechamento & ROI
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => setSelectedAction(null)}
                      className="flex-1 px-6 py-2 bg-elevated hover:bg-border border border-border rounded-xl text-sm font-bold transition-all"
                    >
                      Fechar
                    </button>
                    {((selectedAction.fase_atual || 1) === 1 || selectedAction.is_reopened) && (
                      <Link 
                        href={`/investimento/${selectedAction.id}/editar`}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 rounded-xl text-sm font-bold transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Link>
                    )}
                    {(selectedAction.fase_atual || 1) >= 5 && !selectedAction.is_reopened && ['admin', 'ceo', 'diretor'].includes(userRole?.toLowerCase() || '') && (
                      <button
                        onClick={() => {
                          const reason = prompt("Digite o motivo obrigatório para a reabertura da ação:");
                          if (reason && reason.trim()) {
                            handlePhaseAction(selectedAction.id, () => reabrirAcaoInvestimento(selectedAction.id, reason));
                          } else if (reason !== null) {
                            alert("O motivo da reabertura é obrigatório.");
                          }
                        }}
                        disabled={actionLoading === selectedAction.id}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                      >
                        <Unlock className="w-4 h-4" />
                        Reabrir Ação
                      </button>
                    )}
                  </div>
                </div>
                )}

                {/* Calendar mode: just a close button */}
                {viewMode === 'calendar' && (
                  <div className="pt-3 border-t border-border">
                    <button 
                      onClick={() => setSelectedAction(null)}
                      className="w-full px-6 py-2 bg-elevated hover:bg-border border border-border rounded-xl text-sm font-bold transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}



        {/* AI Insight Modal */}
        {showAiModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowAiModal(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div 
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-card border border-purple-500/20 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-purple-600/10 to-indigo-600/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/15 rounded-xl">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Coffee IA — Investimentos</h2>
                    <p className="text-xs text-muted">Análise inteligente do pipeline de investimentos</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="p-2 text-muted hover:text-foreground hover:bg-elevated rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-16">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                      <Sparkles className="w-5 h-5 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Analisando investimentos...</p>
                      <p className="text-xs text-muted mt-1">O Coffee IA está processando {managerFilteredAcoes.length} ações</p>
                    </div>
                  </div>
                ) : aiInsight ? (
                  <div 
                    className="prose prose-invert prose-sm max-w-none
                      prose-headings:text-foreground prose-headings:font-bold prose-headings:mb-2 prose-headings:mt-4
                      prose-p:text-foreground/85 prose-p:leading-relaxed prose-p:mb-3
                      prose-strong:text-purple-300
                      prose-li:text-foreground/85 prose-li:mb-1
                      prose-ul:mb-3"
                    dangerouslySetInnerHTML={{ 
                      __html: aiInsight
                        .replace(/\n/g, '<br/>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/^- (.*?)(<br\/>|$)/gm, '<li>$1</li>')
                        .replace(/(<li>[\s\S]*<\/li>)/g, '<ul>$1</ul>')
                        .replace(/<\/ul>\s*<ul>/g, '')
                    }}
                  />
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-elevated/50">
                <p className="text-xs text-muted">Powered by Gemini AI</p>
                <div className="flex items-center gap-2">
                  {!aiLoading && aiInsight && (
                    <button
                      onClick={generateInvestimentoInsight}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-all"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regerar
                    </button>
                  )}
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="px-4 py-1.5 text-xs font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


      </main>
    </div>
  );
}
