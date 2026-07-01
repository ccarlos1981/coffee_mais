"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
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
  Pencil,
  CheckCircle,
  Clock,
  Shield,
  Banknote,
  Eye,
  RotateCcw,
  Sparkles,
  HelpCircle
} from "lucide-react";
import { enviarParaTrade, validarTrade, conferirTrade, atualizarChecklistTrade, confirmarPagamento, importarInvestimentosEmLote, marcarAcaoNaoAconteceu } from "./lancar/actions";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, addMonths, subMonths, addWeeks, subWeeks, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ThemeToggle } from "@/components/ThemeProvider";


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
  // Phase fields
  checklist_comunicacao?: boolean;
  checklist_logistica?: boolean;
  checklist_auditoria?: boolean;
  checklist_garantia?: boolean;
  checklist_conferencia?: boolean;
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
  const [page, setPage] = useState(0);
  const itemsPerPage = 50;
  const [showFilters, setShowFilters] = useState(false);
  const [filterFase, setFilterFase] = useState<number | null>(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tradeChecklist, setTradeChecklist] = useState({ comunicacao: false, logistica: false, auditoria: false, garantia: false });
  const [filterMes, setFilterMes] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedAcoes, setParsedAcoes] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const boletoDropdownRef = useRef<HTMLDivElement>(null);
  const [uploadingBoletoFinanceiro, setUploadingBoletoFinanceiro] = useState(false);

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
      }
    }
  }, []);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAction, setSelectedAction] = useState<AcaoInvestimento | null>(null);
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
        garantia: selectedAction.checklist_garantia || false
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

      checkBoletoCondition();
      
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

  const handleChecklistChange = async (field: keyof typeof tradeChecklist, checked: boolean) => {
    if (!selectedAction) return;
    const newChecklist = { ...tradeChecklist, [field]: checked };
    setTradeChecklist(newChecklist);
    try {
      await atualizarChecklistTrade(selectedAction.id, { ...newChecklist, conferencia: true });
      // Update local data to reflect changes silently
      setData(prev => prev.map(item => item.id === selectedAction.id ? { ...item, [`checklist_${field}`]: checked } : item));
    } catch (err) {
      console.error("Falha ao salvar checklist:", err);
      // Revert state if needed, but for better UX we just log it.
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
  const familiasDisponiveis = useMemo(() => Array.from(new Set(managerFilteredAcoes.map(d => d.familia_produto).filter(Boolean) as string[])).sort(), [managerFilteredAcoes]);

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

  const temInvestimentoNoMes = useCallback((m: any, mes: string) => {
    return data.some(action => 
      (action.codigo_matriz === m.codigo || (action.rede && action.rede.toUpperCase().trim() === m.nome.toUpperCase().trim())) &&
      action.mes_referencia === mes
    );
  }, [data]);

  const sortedMatrizesWithInvestimento = useMemo(() => {
    return myMatrizes.map(m => {
      const redeKey = m.nome ? m.nome.toUpperCase().trim() : "";
      const faturamentoTotal = faturamentoTotalMap[redeKey] || 0;
      return {
        ...m,
        faturamentoTotal
      };
    }).sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);
  }, [myMatrizes, faturamentoTotalMap]);

  const filteredMatrizesInView = useMemo(() => {
    if (!matrizSearch) return sortedMatrizesWithInvestimento;
    const searchLower = matrizSearch.toLowerCase();
    return sortedMatrizesWithInvestimento.filter(m => 
      (m.nome && m.nome.toLowerCase().includes(searchLower)) ||
      (m.codigo && m.codigo.toLowerCase().includes(searchLower)) ||
      (m.gerente && m.gerente.toLowerCase().includes(searchLower))
    );
  }, [sortedMatrizesWithInvestimento, matrizSearch]);

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

  // Download do modelo Excel de investimentos
  const downloadModelExcel = () => {
    try {
      const headers = [
        ["Código da Matriz", "Rede", "UF", "Gerente", "Canal", "Tipo de Ação", "Pagamento", "Mês de Referência", "Data Início", "Data Fim", "Família ou SKU", "Família de Produto", "SKU", "Preço Flat", "Preço da Ação", "Investimento", "Expectativa de Volume"]
      ];

      let rows: any[][] = [];

      if (userRole === "Gerente Regional" && userEmail) {
        // Filter matrices assigned to this manager
        const emailPrefix = userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        const myMatrizes = matrizes.filter(m => {
          if (!m.gerente) return false;
          const cleanGerente = m.gerente.toLowerCase().replace(/[^a-z0-9]/g, "");
          return emailPrefix.startsWith(cleanGerente) || cleanGerente.startsWith(emailPrefix);
        });

        if (myMatrizes.length > 0) {
          rows = myMatrizes.map(m => [
            m.codigo,          // Código da Matriz
            m.nome,            // Rede
            m.uf || "",        // UF
            m.gerente || "",   // Gerente
            m.canal || "",     // Canal
            "", "", "", "", "", "", "", "", "", "", "", "" // Empty blanks for action info
          ]);
        }
      }

      if (rows.length === 0) {
        rows = [
          ["146775.0", "BISTEK", "SC", "Leandro", "KA", "Sell Out", "Boleto", "06/2026", "26/06/2026", "01/07/2026", "Família", "Grão", "", "129,90", "129,90", "10,00", "300"],
          ["146775.0", "BISTEK", "SC", "Leandro", "KA", "Sell Out", "Boleto", "06/2026", "26/06/2026", "01/07/2026", "SKU", "", "Café Tradicional 250g", "24,99", "24,99", "2,50", "1000"],
          ["146775.0", "BISTEK", "SC", "Leandro", "KA", "Sell Out", "Boleto", "06/2026", "26/06/2026", "01/07/2026", "SKU", "", "Café Extra Forte 250g", "24,99", "24,99", "2,50", "1000"]
        ];
      }

      const dataExcel = [...headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(dataExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo Investimentos");
      
      worksheet['!cols'] = [
        { wch: 18 }, // Código da Matriz
        { wch: 20 }, // Rede
        { wch: 8 },  // UF
        { wch: 15 }, // Gerente
        { wch: 12 }, // Canal
        { wch: 15 }, // Tipo de Ação
        { wch: 15 }, // Pagamento
        { wch: 18 }, // Mês de Referência
        { wch: 15 }, // Data Início
        { wch: 15 }, // Data Fim
        { wch: 15 }, // Abrangência
        { wch: 18 }, // Família de Produto
        { wch: 25 }, // SKU
        { wch: 12 }, // Preço Flat
        { wch: 12 }, // Preço da Ação
        { wch: 12 }, // Investimento
        { wch: 20 }  // Expectativa de Volume
      ];

      XLSX.writeFile(workbook, "modelo_lancamento_investimentos.xlsx");
      setFeedback({ type: "success", msg: "Modelo de planilha baixado com sucesso!" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", msg: "Erro ao gerar modelo de planilha." });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Importação em lote
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rawRows.length === 0) {
          setFeedback({ type: "error", msg: "A planilha está vazia." });
          setTimeout(() => setFeedback(null), 3000);
          return;
        }

        const headers = rawRows[0].map(h => String(h || "").trim().toLowerCase());
        
        const colIndices = {
          codigo_matriz: headers.findIndex(h => h.includes("código") || h.includes("codigo") || h.includes("matriz")),
          rede: headers.findIndex(h => h.includes("rede")),
          uf: headers.findIndex(h => h.includes("uf") || h.includes("estado")),
          gerente: headers.findIndex(h => h.includes("gerente") || h.includes("responsavel")),
          canal: headers.findIndex(h => h.includes("canal")),
          tipo: headers.findIndex(h => h.includes("tipo")),
          pagamento: headers.findIndex(h => h.includes("pagamento")),
          mes: headers.findIndex(h => h.includes("mês") || h.includes("mes") || h.includes("ref")),
          inicio: headers.findIndex(h => h.includes("início") || h.includes("inicio")),
          fim: headers.findIndex(h => h.includes("fim") || h.includes("final")),
          abrangencia: headers.findIndex(h => h.includes("abrangência") || h.includes("abrangencia") || h.includes("família ou sku") || h.includes("familia ou sku")),
          familia: headers.findIndex(h => h.includes("família") || h.includes("familia")),
          sku: headers.findIndex(h => h.includes("sku")),
          flat: headers.findIndex(h => h.includes("flat")),
          acao: headers.findIndex(h => (h.includes("preço") || h.includes("preco")) && (h.includes("ação") || h.includes("acao"))),
          investimento: headers.findIndex(h => h.includes("investimento") || h.includes("inv")),
          volume: headers.findIndex(h => h.includes("volume") || h.includes("vol"))
        };

        if (colIndices.codigo_matriz === -1 || colIndices.tipo === -1 || colIndices.pagamento === -1 || colIndices.mes === -1 || colIndices.inicio === -1 || colIndices.fim === -1 || colIndices.abrangencia === -1) {
          setFeedback({ type: "error", msg: "Cabeçalhos obrigatórios (Código da Matriz, Tipo, Pagamento, Mês, Datas, Família ou SKU) não encontrados." });
          setTimeout(() => setFeedback(null), 3000);
          return;
        }

        const parsedLines: any[] = [];

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) {
            continue;
          }

          const errors: string[] = [];
          
          const rawCodigoMatriz = colIndices.codigo_matriz !== -1 ? row[colIndices.codigo_matriz] : "";
          const rawRede = colIndices.rede !== -1 ? row[colIndices.rede] : "";
          const rawUf = colIndices.uf !== -1 ? row[colIndices.uf] : "";
          const rawGerente = colIndices.gerente !== -1 ? row[colIndices.gerente] : "";
          const rawCanal = colIndices.canal !== -1 ? row[colIndices.canal] : "";
          const rawTipo = colIndices.tipo !== -1 ? row[colIndices.tipo] : "";
          const rawPagamento = colIndices.pagamento !== -1 ? row[colIndices.pagamento] : "";
          const rawMes = colIndices.mes !== -1 ? row[colIndices.mes] : "";
          const rawInicio = colIndices.inicio !== -1 ? row[colIndices.inicio] : "";
          const rawFim = colIndices.fim !== -1 ? row[colIndices.fim] : "";
          const rawAbrangencia = colIndices.abrangencia !== -1 ? row[colIndices.abrangencia] : "";
          const rawFamilia = colIndices.familia !== -1 ? row[colIndices.familia] : "";
          const rawSku = colIndices.sku !== -1 ? row[colIndices.sku] : "";
          const rawFlat = colIndices.flat !== -1 ? row[colIndices.flat] : "";
          const rawAcao = colIndices.acao !== -1 ? row[colIndices.acao] : "";
          const rawInvestimento = colIndices.investimento !== -1 ? row[colIndices.investimento] : "";
          const rawVolume = colIndices.volume !== -1 ? row[colIndices.volume] : "";

          let codigoMatrizVal = rawCodigoMatriz ? String(rawCodigoMatriz).trim() : "";
          let redeVal = rawRede ? String(rawRede).trim() : "";

          if (!codigoMatrizVal) {
            errors.push("Código da Matriz é obrigatório.");
          } else {
            // Se o código for lido como inteiro (ex: 146775) no Excel
            let matched = matrizes.find(m => m.codigo === codigoMatrizVal);
            if (!matched && !codigoMatrizVal.includes(".")) {
              matched = matrizes.find(m => m.codigo === codigoMatrizVal + ".0" || m.codigo.startsWith(codigoMatrizVal + "."));
            }
            if (matched) {
              codigoMatrizVal = matched.codigo;
              redeVal = matched.nome; // Nome da rede correto
            } else {
              errors.push(`Código de Matriz "${codigoMatrizVal}" não encontrado no cadastro.`);
            }
          }

          let tipoVal = rawTipo ? String(rawTipo).trim() : "";
          if (!tipoVal) {
            errors.push("Tipo de Ação é obrigatório.");
          } else {
            const tLower = tipoVal.toLowerCase();
            if (tLower.includes("out")) tipoVal = "Sell Out";
            else if (tLower.includes("in")) tipoVal = "Sell In";
            else errors.push("Tipo de Ação inválido.");
          }

          let pagamentoVal = rawPagamento ? String(rawPagamento).trim() : "";
          if (!pagamentoVal) {
            errors.push("Pagamento é obrigatório.");
          } else {
            const pLower = pagamentoVal.toLowerCase();
            if (pLower.includes("abat") || pLower.includes("bole")) pagamentoVal = "Boleto";
            else if (pLower.includes("trans") || pLower.includes("tran")) pagamentoVal = "Transf. Bancária";
            else if (pLower.includes("boni")) pagamentoVal = "Bonificação";
            else errors.push("Pagamento inválido.");
          }

          let mesVal: string | null = null;
          if (!rawMes) {
            errors.push("Mês de referência é obrigatório.");
          } else {
            if (typeof rawMes === "number") {
              const d = excelSerialToDate(rawMes);
              if (d) mesVal = d.slice(0, 7);
            } else {
              const str = String(rawMes).trim();
              const parts = str.split("/");
              if (parts.length === 2) {
                const m = parts[0].padStart(2, '0');
                const y = parts[1];
                if (y.length === 4 && !isNaN(Number(m)) && !isNaN(Number(y))) {
                  mesVal = `${y}-${m}`;
                }
              } else if (str.split("-").length === 2) {
                mesVal = str;
              }
            }
            if (!mesVal) errors.push("Mês inválido. Use MM/AAAA.");
          }

          let inicioVal: string | null = null;
          if (!rawInicio) {
            errors.push("Data início é obrigatória.");
          } else {
            inicioVal = typeof rawInicio === "number" ? excelSerialToDate(rawInicio) : parseDateString(rawInicio);
            if (!inicioVal) errors.push("Data início inválida.");
          }

          let fimVal: string | null = null;
          if (!rawFim) {
            errors.push("Data fim é obrigatória.");
          } else {
            fimVal = typeof rawFim === "number" ? excelSerialToDate(rawFim) : parseDateString(rawFim);
            if (!fimVal) errors.push("Data fim inválida.");
          }

          let abrangenciaVal = rawAbrangencia ? String(rawAbrangencia).trim() : "";
          if (!abrangenciaVal) {
            errors.push("Abrangência é obrigatória.");
          } else {
            const aLower = abrangenciaVal.toLowerCase();
            if (aLower.includes("fam")) abrangenciaVal = "Família";
            else if (aLower.includes("sku")) abrangenciaVal = "SKU";
            else errors.push("Abrangência inválida.");
          }

          let familiaVal: string | null = null;
          let skuVal = "";
          let flatVal: number | null = null;
          let acaoVal: number | null = null;
          let investVal: number | null = null;
          let volVal: number | null = null;

          const parseExcelNum = (val: any) => {
            if (val === undefined || val === null || val === "") return null;
            if (typeof val === "number") return val;
            const clean = String(val).replace(/[R$\s\.]/g, '').replace(',', '.');
            const n = parseFloat(clean);
            return isNaN(n) ? null : n;
          };

          flatVal = parseExcelNum(rawFlat);
          acaoVal = parseExcelNum(rawAcao);
          investVal = parseExcelNum(rawInvestimento);

          if (rawVolume !== undefined && rawVolume !== null && rawVolume !== "") {
            if (typeof rawVolume === "number") volVal = rawVolume;
            else {
              const clean = String(rawVolume).replace(/\./g, '').replace(',', '.');
              const n = parseFloat(clean);
              volVal = isNaN(n) ? null : n;
            }
          }

          if (abrangenciaVal === "Família") {
            familiaVal = rawFamilia ? String(rawFamilia).trim() : "";
            if (!familiaVal) {
              errors.push("Família é obrigatória para abrangência Família.");
            } else {
              const validFams = ["Grão", "Moído", "Drip", "Capsula", "1KG"];
              const match = validFams.find(vf => vf.toLowerCase() === familiaVal!.toLowerCase());
              if (match) familiaVal = match;
              else errors.push("Família inválida.");
            }
            if (investVal === null) errors.push("Investimento é obrigatório.");
            if (volVal === null) errors.push("Volume é obrigatório.");
          } else if (abrangenciaVal === "SKU") {
            skuVal = rawSku ? String(rawSku).trim() : "";
            if (!skuVal) {
              errors.push("SKU é obrigatório.");
            }
          }

          parsedLines.push({
            originalRow: row,
            data: {
              rede: redeVal,
              codigo_matriz: codigoMatrizVal,
              uf: rawUf ? String(rawUf).trim() : "",
              gerente: rawGerente ? String(rawGerente).trim() : "",
              canal: rawCanal ? String(rawCanal).trim() : "",
              tipo_acao: tipoVal,
              tipo_pagamento: pagamentoVal,
              mes_referencia: mesVal || "",
              data_inicio: inicioVal || "",
              data_fim: fimVal || "",
              abrangencia: abrangenciaVal,
              familia_produto: familiaVal,
              sku: skuVal,
              preco_flat: flatVal,
              preco_acao: acaoVal,
              valor_investimento: investVal,
              expectativa_volume: volVal
            },
            valid: errors.length === 0,
            errors
          });
        }

        // Agrupamento de SKUs
        const groupedAcoes: any[] = [];
        const skuGroups: Record<string, any[]> = {};

        parsedLines.forEach(line => {
          if (!line.valid) {
            groupedAcoes.push({
              originalRow: line.originalRow,
              data: {
                ...line.data,
                skus_detalhes: []
              },
              valid: false,
              errors: line.errors
            });
            return;
          }

          if (line.data.abrangencia === "Família") {
            groupedAcoes.push({
              originalRow: line.originalRow,
              data: {
                rede: line.data.rede,
                codigo_matriz: line.data.codigo_matriz,
                uf: line.data.uf,
                gerente: line.data.gerente,
                canal: line.data.canal,
                tipo_acao: line.data.tipo_acao,
                tipo_pagamento: line.data.tipo_pagamento,
                mes_referencia: line.data.mes_referencia,
                data_inicio: line.data.data_inicio,
                data_fim: line.data.data_fim,
                abrangencia: "Família",
                familia_produto: line.data.familia_produto,
                preco_flat: line.data.preco_flat,
                preco_acao: line.data.preco_acao,
                valor_investimento: line.data.valor_investimento,
                expectativa_volume: line.data.expectativa_volume,
                skus_detalhes: [],
                fase_atual: 1
              },
              valid: true,
              errors: []
            });
          } else {
            const key = `${line.data.codigo_matriz}|${line.data.tipo_acao}|${line.data.tipo_pagamento}|${line.data.mes_referencia}|${line.data.data_inicio}|${line.data.data_fim}`;
            if (!skuGroups[key]) {
              skuGroups[key] = [];
            }
            skuGroups[key].push(line);
          }
        });

        Object.entries(skuGroups).forEach(([key, lines]) => {
          const first = lines[0].data;
          const skusDetails = lines.map(line => ({
            sku: line.data.sku,
            preco_flat: line.data.preco_flat,
            preco_acao: line.data.preco_acao,
            investimento: line.data.valor_investimento,
            expectativa_volume: line.data.expectativa_volume
          }));

          const skusList = skusDetails.map(s => s.sku);
          const duplicateSkus = skusList.filter((item, index) => skusList.indexOf(item) !== index);
          const groupErrors: string[] = [];
          if (duplicateSkus.length > 0) {
            groupErrors.push(`SKUs duplicados: ${Array.from(new Set(duplicateSkus)).join(", ")}`);
          }

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
              skus_detalhes: skusDetails,
              fase_atual: 1
            },
            valid: groupErrors.length === 0,
            errors: groupErrors
          });
        });

        setParsedAcoes(groupedAcoes);
      } catch (err) {
        console.error(err);
        setFeedback({ type: "error", msg: "Erro ao processar o arquivo Excel." });
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    const validAcoes = parsedAcoes
      .filter(item => item.valid)
      .map(item => {
        // Strip out columns that don't exist in the database table
        const { uf, gerente, canal, ...dbFields } = item.data;
        return { ...dbFields, is_planejamento: false };
      });

    if (validAcoes.length === 0) {
      setFeedback({ type: "error", msg: "Nenhum investimento válido." });
      return;
    }

    startImportTransition(async () => {
      try {
        const res = await importarInvestimentosEmLote(validAcoes);
        if (res.success) {
          setFeedback({ type: "success", msg: `${res.count} investimentos importados com sucesso!` });
          setIsImportModalOpen(false);
          setParsedAcoes([]);
          setImportFileName("");
          loadData();
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
        .from("mv_vendas_mensal")
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
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        const { data } = await supabase.from('cm_user_profiles').select('role').eq('id', user.id).single();
        if (data) setUserRole(data.role);
      }
    };
    fetchUserRole();
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

  const mesesDisponiveis = useMemo(() => {
    const meses = managerFilteredAcoes.map(d => d.mes_referencia).filter(Boolean) as string[];
    return Array.from(new Set(meses)).sort((a, b) => b.localeCompare(a));
  }, [managerFilteredAcoes]);

  const filteredData = useMemo(() => {
    return managerFilteredAcoes.filter(r => {
      if (filterFase !== null && (r.fase_atual || 1) !== filterFase) return false;
      if (filterRede && r.rede !== filterRede) return false;
      if (filterFamilia && r.familia_produto !== filterFamilia) return false;
      if (filterDataInicio && r.data_inicio < filterDataInicio) return false;
      if (filterDataFim && r.data_inicio > filterDataFim) return false;
      if (filterMes && r.mes_referencia !== filterMes) return false;
      return true;
    });
  }, [managerFilteredAcoes, filterRede, filterFamilia, filterDataInicio, filterDataFim, filterFase, filterMes]);

  const faseCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    managerFilteredAcoes.forEach(r => { const f = r.fase_atual || 1; if (counts[f] !== undefined) counts[f]++; });
    return counts;
  }, [managerFilteredAcoes]);

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

  const getValorTotal = (r: AcaoInvestimento) => {
    if (r.abrangencia === "SKU" && r.skus_detalhes) {
      return r.skus_detalhes.reduce((acc, curr) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
    }
    return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
  };

  const subtotal = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + getValorTotal(curr), 0);
  }, [filteredData]);

  const paginatedData = useMemo(() => {
    const start = page * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

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

    const headers = ["Código", "Data Registro", "Rede", "Família", "Ação", "Data Início", "Data Fim", "Valor"];
    
    const csvContent = [
      headers.join(";"),
      ...filteredData.map(row => {
        const val = getValorTotal(row);
        const fam = row.abrangencia === "SKU" ? "Múltiplos SKUs" : (row.familia_produto || "");
        return [
          row.codigo || "",
          new Date(row.created_at).toLocaleDateString("pt-BR"),
          `"${row.rede}"`,
          `"${fam}"`,
          `"${row.tipo_acao}"`,
          formatDate(row.data_inicio),
          formatDate(row.data_fim),
          val.toString().replace('.', ',')
        ].join(";");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // \uFEFF BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `investimentos_${new Date().toISOString().split('T')[0]}.csv`);
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

        {/* Data Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col bg-background">
          <div className="flex flex-col gap-4 mb-4">
            {/* Phase Tabs - only in table mode */}
            {viewMode === 'table' && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterFase(null)}
                className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                  filterFase === null ? 'bg-gold/15 text-gold border-gold/30 shadow-sm' : 'bg-elevated text-muted border-border hover:bg-border hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  Todas <span className="text-xs opacity-70 font-normal">({managerFilteredAcoes.length})</span>
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
            )}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-between w-full p-3 bg-elevated border border-border rounded-xl text-sm font-medium text-foreground lg:hidden"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gold" />
                Filtros e Buscas
              </div>
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <div className={`flex-col lg:flex-row gap-3 ${showFilters ? 'flex' : 'hidden lg:flex'}`}>
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <select
                  value={filterMes}
                  onChange={(e) => setFilterMes(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none"
                >
                  <option value="">Todos os Meses</option>
                  {mesesDisponiveis.map(m => (
                    <option key={m} value={m}>{formatMesReferencia(m)}</option>
                  ))}
                </select>

                <select
                  value={filterRede}
                  onChange={(e) => setFilterRede(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none"
                >
                  <option value="">Todas as Redes</option>
                  {redesDisponiveis.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                  value={filterFamilia}
                  onChange={(e) => setFilterFamilia(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all appearance-none"
                >
                  <option value="">Todas as Famílias</option>
                  {familiasDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="flex gap-3 flex-1">
                <div className="flex items-center flex-1 bg-elevated border border-border rounded-xl px-3 focus-within:ring-2 focus-within:ring-gold/50 transition-all">
                  <span className="text-muted text-xs mr-2">De:</span>
                  <input
                    type="date"
                    value={filterDataInicio}
                    onChange={(e) => setFilterDataInicio(e.target.value)}
                    className="w-full bg-transparent py-2 text-sm text-foreground focus:outline-none placeholder:text-muted [color-scheme:dark]"
                  />
                </div>

                <div className="flex items-center flex-1 bg-elevated border border-border rounded-xl px-3 focus-within:ring-2 focus-within:ring-gold/50 transition-all">
                  <span className="text-muted text-xs mr-2">Até:</span>
                  <input
                    type="date"
                    value={filterDataFim}
                    onChange={(e) => setFilterDataFim(e.target.value)}
                    className="w-full bg-transparent py-2 text-sm text-foreground focus:outline-none placeholder:text-muted [color-scheme:dark]"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  setFilterRede("");
                  setFilterFamilia("");
                  setFilterDataInicio("");
                  setFilterDataFim("");
                  setFilterFase(null);
                  setFilterMes("");
                }}
                className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-xl transition-all whitespace-nowrap"
              >
                Limpar Filtros
              </button>
            </div>
            <div className="flex items-center justify-between text-sm text-muted px-1">
              <span>{filteredData.length} lançamento{filteredData.length !== 1 ? 's' : ''} encontrado{filteredData.length !== 1 ? 's' : ''}</span>
              {filteredData.length > 0 && <span className="font-medium text-gold lg:hidden">Total: {formatCurrency(subtotal, false)}</span>}
            </div>
          </div>

          <div className="flex-1 bg-card md:border md:border-border md:rounded-2xl overflow-hidden flex flex-col shadow-sm relative">
            
            {viewMode === "table" ? (
              <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-elevated sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Cód.</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Data Registro</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Rede</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Mês</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Período Ação</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Tipo</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Fase</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Família</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right">Vlr invest.</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right">PPC</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right">Exp. Vol.</th>
                    <th className="px-3 xl:px-4 py-3 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-center">Ações</th>
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
                    paginatedData.map((row) => (
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
                            <span>{formatDate(row.data_inicio)}</span>
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
                          {row.abrangencia === "SKU" ? "Múltiplos SKUs" : row.familia_produto}
                        </td>
                        <td className="px-3 xl:px-4 py-3 text-right font-medium text-foreground">
                          {formatCurrency(getValorTotal(row), false)}
                        </td>
                        <td className="px-3 xl:px-4 py-3 text-right font-medium text-foreground">
                          {row.abrangencia === "SKU" ? "-" : (row.preco_acao ? formatCurrency(row.preco_acao) : '-')}
                        </td>
                        <td className="px-3 xl:px-4 py-3 text-right font-medium text-foreground">
                          {row.abrangencia === "SKU" ? "-" : (row.expectativa_volume ? row.expectativa_volume.toLocaleString('pt-BR') : '-')}
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
                    ))
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
                paginatedData.map((row) => (
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
                        <p className="text-sm text-foreground/80 mt-0.5">{row.abrangencia === "SKU" ? "Múltiplos SKUs" : row.familia_produto}</p>
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
                      <span className="font-medium">{formatDate(row.data_inicio)} até {formatDate(row.data_fim)}</span>
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
                ))
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
                                          {action.abrangencia === "SKU" ? "SKUs" : action.familia_produto}
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
              <div className="flex-1 flex flex-col min-h-0 bg-card overflow-hidden">
                {/* Matrix view header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-border bg-elevated/30 gap-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Histórico de Investimentos por Rede</h3>
                    <p className="text-xs text-muted mt-0.5">Status de investimentos mensal por Rede (Jun/2026+)</p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="Buscar rede, código ou gerente..."
                      value={matrizSearch}
                      onChange={(e) => setMatrizSearch(e.target.value)}
                      className="w-full md:w-64 bg-elevated border border-border rounded-xl px-3.5 py-1.5 text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
                    />
                  </div>
                </div>

                {/* Matrix view body */}
                <div className="flex-1 overflow-auto">
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
                        filteredMatrizesInView.map((m) => (
                          <tr key={m.codigo} className="hover:bg-elevated/20 transition-colors">
                            <td className="p-3 min-w-[240px]">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-gold bg-gold/10 px-1 py-0.5 rounded font-bold">{m.codigo}</span>
                                  <span className="font-bold text-foreground text-sm">{m.nome}</span>
                                </div>
                                <span className="text-[10px] text-muted mt-1">Gerente: <span className="text-foreground/80 font-medium">{m.gerente || 'Não definido'}</span></span>
                              </div>
                            </td>
                            {MATRIX_MONTHS.map(month => {
                              const hasInv = temInvestimentoNoMes(m, month.value);
                              return (
                                <td key={month.value} className="p-2 text-center">
                                  <div className="flex items-center justify-center">
                                    {hasInv ? (
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#10b981]/15 text-[#10b981] font-bold text-sm">
                                        ✓
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
                      <span className="text-xs text-muted truncate hidden sm:inline">{row.abrangencia === "SKU" ? "SKUs" : row.familia_produto}</span>
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

                {parsedAcoes.length > 0 && (
                  <div className="space-y-4">
                    {/* Resumo */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-2.5 bg-foreground/5 border border-border rounded-xl text-center">
                        <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Ações Lidas</p>
                        <p className="text-lg font-bold text-foreground mt-0.5">{parsedAcoes.length}</p>
                      </div>
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                        <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Válidas</p>
                        <p className="text-lg font-bold text-emerald-400 mt-0.5">{parsedAcoes.filter(e => e.valid).length}</p>
                      </div>
                      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                        <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Com Erros</p>
                        <p className="text-lg font-bold text-red-400 mt-0.5">{parsedAcoes.filter(e => !e.valid).length}</p>
                      </div>
                    </div>

                    {/* Tabela de Pré-visualização */}
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
                              <th className="p-2.5 font-semibold text-muted text-[10px] uppercase">Erros/Observações</th>
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
                                <td className="p-2.5 text-muted">{item.data.uf || "-"}</td>
                                <td className="p-2.5 text-muted">{item.data.gerente || "-"}</td>
                                <td className="p-2.5 text-muted">{item.data.canal || "-"}</td>
                                <td className="p-2.5 text-muted">{formatMesReferencia(item.data.mes_referencia) || <span className="text-red-400 italic">Vazio</span>}</td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${item.data.abrangencia === 'Família' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>
                                    {item.data.abrangencia}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  {item.data.abrangencia === "Família" ? (
                                    <span className="text-foreground-secondary">{item.data.familia_produto} — {item.data.expectativa_volume} un.</span>
                                  ) : (
                                    <span className="text-foreground-secondary">{item.data.skus_detalhes?.length || 0} SKU(s) detalhado(s)</span>
                                  )}
                                </td>
                                <td className="p-2.5">
                                  {item.valid ? (
                                    <span className="text-muted">Pronto</span>
                                  ) : (
                                    <ul className="list-disc pl-4 text-red-400 space-y-0.5">
                                      {item.errors.map((err: string, errIdx: number) => (
                                        <li key={errIdx}>{err}</li>
                                      ))}
                                    </ul>
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
                  }}
                  disabled={isImportPending}
                  className="px-4 py-2 text-sm font-semibold text-muted hover:bg-border rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImportPending || parsedAcoes.length === 0 || parsedAcoes.filter(e => e.valid).length === 0}
                  className="px-4 py-2 text-sm font-bold bg-gold text-black rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImportPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Importar ({parsedAcoes.filter(e => e.valid).length}) Registros
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
                  </div>
                </div>
                <button onClick={() => setSelectedAction(null)} className="p-2 hover:bg-border rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
              
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
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
                          : selectedAction.familia_produto === "KG" 
                            ? "1KG" 
                            : selectedAction.familia_produto}
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

                {detailsExpanded && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Rede</span>
                      <span className="font-bold text-foreground">
                        {selectedAction.rede}
                        {selectedAction.codigo_matriz && <span className="text-xs text-muted font-mono ml-1.5">({selectedAction.codigo_matriz})</span>}
                      </span>
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
                      const dias = selectedAction.condicao_pagamento ? parseInt(selectedAction.condicao_pagamento) : null;
                      return (dias !== null && !isNaN(dias) && dias > 35)
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-elevated border-border';
                    })()}`}>
                      <span className="text-xs text-muted block mb-1">Prazo de Pagamento</span>
                      {(() => {
                        const raw = selectedAction.condicao_pagamento;
                        const dias = raw ? parseInt(raw) : null;
                        if (!raw || dias === null || isNaN(dias)) {
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
                          : selectedAction.familia_produto === "KG" 
                            ? "1KG" 
                            : selectedAction.familia_produto}
                      </span>
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border col-span-2">
                      <span className="text-xs text-muted block mb-1">Período</span>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gold" />
                        <span className="font-medium text-foreground">{formatDate(selectedAction.data_inicio)} até {formatDate(selectedAction.data_fim)}</span>
                      </div>
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border col-span-2">
                      <span className="text-xs text-muted block mb-1">Valor do Investimento Total Estimado</span>
                      <span className="font-black text-gold text-lg">{formatCurrency(getValorTotal(selectedAction), false)}</span>
                    </div>
                    {selectedAction.abrangencia !== "SKU" && (
                      <>
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
                      </>
                    )}
                    {selectedAction.abrangencia === "SKU" && selectedAction.skus_detalhes && (
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
                  </div>
                )}

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
                    <div className="bg-elevated p-3 rounded-xl border border-border flex flex-col gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">Checklist de Validação (Trade)</span>
                      
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="mt-1 flex-shrink-0 w-4 h-4 rounded border-border text-gold focus:ring-gold/50" checked={tradeChecklist.comunicacao} onChange={(e) => handleChecklistChange('comunicacao', e.target.checked)} />
                        <div>
                          <span className="font-bold text-sm text-foreground block group-hover:text-gold transition-colors">1) Comunicação</span>
                          <span className="text-xs text-muted block">Envio do calendário para a equipe de campo e agências.</span>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="mt-1 flex-shrink-0 w-4 h-4 rounded border-border text-gold focus:ring-gold/50" checked={tradeChecklist.logistica} onChange={(e) => handleChecklistChange('logistica', e.target.checked)} />
                        <div>
                          <span className="font-bold text-sm text-foreground block group-hover:text-gold transition-colors">2) Logística</span>
                          <span className="text-xs text-muted block">Verificação de estoque para garantir ruptura zero durante a ação.</span>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="mt-1 flex-shrink-0 w-4 h-4 rounded border-border text-gold focus:ring-gold/50" checked={tradeChecklist.auditoria} onChange={(e) => handleChecklistChange('auditoria', e.target.checked)} />
                        <div>
                          <span className="font-bold text-sm text-foreground block group-hover:text-gold transition-colors">3) Auditoria</span>
                          <span className="text-xs text-muted block">Promotores confirmam a implementação (fotos e preços na gôndola).</span>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="mt-1 flex-shrink-0 w-4 h-4 rounded border-border text-gold focus:ring-gold/50" checked={tradeChecklist.garantia} onChange={(e) => handleChecklistChange('garantia', e.target.checked)} />
                        <div>
                          <span className="font-bold text-sm text-foreground block group-hover:text-gold transition-colors">4) Garantia</span>
                          <span className="text-xs text-muted block">Validação de que o que foi planejado está sendo executado.</span>
                        </div>
                      </label>

                    </div>
                  )}

                  {(selectedAction.fase_atual || 1) === 2 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePhaseAction(selectedAction.id, () => marcarAcaoNaoAconteceu(selectedAction.id))}
                        disabled={actionLoading === selectedAction.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                        Ação Não Aconteceu
                      </button>
                      <button
                        onClick={() => handlePhaseAction(selectedAction.id, () => validarTrade(selectedAction.id, { ...tradeChecklist, conferencia: true }))}
                        disabled={actionLoading === selectedAction.id || !allTradeChecked}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Validado pelo Trade
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
                    <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <span className="text-sm font-bold text-green-400">Ação Concluída</span>
                        {selectedAction.financeiro_pago_em && (
                          <span className="text-xs text-muted block">Pago em {new Date(selectedAction.financeiro_pago_em).toLocaleDateString('pt-BR')}</span>
                        )}
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
                    {(selectedAction.fase_atual || 1) === 1 && (
                      <Link 
                        href={`/investimento/${selectedAction.id}/editar`}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 rounded-xl text-sm font-bold transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Link>
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
