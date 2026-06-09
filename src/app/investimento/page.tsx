"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  List,
  X,
  Pencil,
  CheckCircle,
  Clock,
  Shield,
  Banknote,
  Eye,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { enviarParaTrade, validarTrade, conferirTrade, atualizarChecklistTrade, confirmarPagamento } from "./lancar/actions";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeProvider";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, addMonths, subMonths, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AcaoInvestimento {
  id: string;
  created_at: string;
  rede: string;
  data_inicio: string;
  data_fim: string;
  tipo_acao: string;
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
  financeiro_observacoes?: string | null;
}

const FASE_CONFIG: Record<number, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  1: { label: "Planejamento", color: "text-amber-400", bgColor: "bg-amber-400/10", borderColor: "border-amber-400/30", icon: "📋" },
  2: { label: "Trade", color: "text-blue-400", bgColor: "bg-blue-400/10", borderColor: "border-blue-400/30", icon: "🔍" },
  3: { label: "Apuração", color: "text-purple-400", bgColor: "bg-purple-400/10", borderColor: "border-purple-400/30", icon: "📝" },
  4: { label: "Conferência", color: "text-indigo-400", bgColor: "bg-indigo-400/10", borderColor: "border-indigo-400/30", icon: "📊" },
  5: { label: "Financeiro", color: "text-emerald-400", bgColor: "bg-emerald-400/10", borderColor: "border-emerald-400/30", icon: "💰" },
  6: { label: "Concluído", color: "text-green-400", bgColor: "bg-green-400/10", borderColor: "border-green-400/30", icon: "✅" },
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
  const [tradeChecklist, setTradeChecklist] = useState({ comunicacao: false, logistica: false, auditoria: false, garantia: false, conferencia: false });
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [apuracaoForm, setApuracaoForm] = useState({ numero_acordo: "", qtd_vendida: "", valor_realizado: "", evidencias_url: "", boleto_id: "" });
  const [boletosAbertos, setBoletosAbertos] = useState<any[]>([]);
  const [boletoSearchTerm, setBoletoSearchTerm] = useState("");
  const [boletoSearchResults, setBoletoSearchResults] = useState<any[]>([]);
  const [boletoSearchLoading, setBoletoSearchLoading] = useState(false);
  const [showBoletoDropdown, setShowBoletoDropdown] = useState(false);
  const [selectedBoletoLabel, setSelectedBoletoLabel] = useState("");
  const boletoDropdownRef = useRef<HTMLDivElement>(null);

  // Calendar State
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [userRole, setUserRole] = useState<string | null>(null);
  
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
        garantia: selectedAction.checklist_garantia || false,
        conferencia: selectedAction.checklist_conferencia || false 
      });
      setApuracaoForm({
        numero_acordo: selectedAction.apuracao_numero_acordo || "",
        qtd_vendida: selectedAction.apuracao_qtd_vendida?.toString() || "",
        valor_realizado: selectedAction.apuracao_valor_realizado?.toString() || "",
        evidencias_url: selectedAction.apuracao_evidencias_url || "",
        boleto_id: selectedAction.apuracao_boleto_id || ""
      });
      
      if ((selectedAction.fase_atual || 1) >= 3) {
        fetchBoletosDaRede(selectedAction.rede).then(() => {
          // If action already has a boleto linked, restore the label
          if (selectedAction.apuracao_boleto_id) {
            supabase
              .from('cm_boletos')
              .select('*')
              .eq('id', selectedAction.apuracao_boleto_id)
              .single()
              .then(({ data: b }) => {
                if (b) {
                  setSelectedBoletoLabel(`${b.rede} — Nº ${b.numero_boleto} — ${formatCurrency(b.valor_total)} — Venc: ${new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`);
                }
              });
          }
        });
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
      await atualizarChecklistTrade(selectedAction.id, newChecklist);
      // Update local data to reflect changes silently
      setData(prev => prev.map(item => item.id === selectedAction.id ? { ...item, [`checklist_${field}`]: checked } : item));
    } catch (err) {
      console.error("Falha ao salvar checklist:", err);
      // Revert state if needed, but for better UX we just log it.
    }
  };

  const redesDisponiveis = useMemo(() => Array.from(new Set(data.map(d => d.rede))).sort(), [data]);
  const familiasDisponiveis = useMemo(() => Array.from(new Set(data.map(d => d.familia_produto).filter(Boolean) as string[])).sort(), [data]);

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
      setFeedback({ type: "success", msg: "Comprovante anexado com sucesso!" });
      setTimeout(() => setFeedback(null), 3000);
      
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", msg: "Erro ao anexar comprovante: " + err.message });
    } finally {
      setUploadingId(null);
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
        .from("cm_acoes_investimento")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setData(rows || []);
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
        const { data } = await supabase.from('cm_user_profiles').select('role').eq('id', user.id).single();
        if (data) setUserRole(data.role);
      }
    };
    fetchUserRole();
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (filterFase !== null && (r.fase_atual || 1) !== filterFase) return false;
      if (filterRede && r.rede !== filterRede) return false;
      if (filterFamilia && r.familia_produto !== filterFamilia) return false;
      if (filterDataInicio && r.data_inicio < filterDataInicio) return false;
      if (filterDataFim && r.data_inicio > filterDataFim) return false;
      return true;
    });
  }, [data, filterRede, filterFamilia, filterDataInicio, filterDataFim, filterFase]);

  const faseCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    data.forEach(r => { const f = r.fase_atual || 1; if (counts[f] !== undefined) counts[f]++; });
    return counts;
  }, [data]);

  const handlePhaseAction = async (id: string, action: () => Promise<void>) => {
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
      setActionLoading(selectedAction.id);
      const fd = new FormData();
      fd.append('apuracao_numero_acordo', apuracaoForm.numero_acordo);
      fd.append('apuracao_qtd_vendida', apuracaoForm.qtd_vendida);
      fd.append('apuracao_valor_realizado', apuracaoForm.valor_realizado);
      fd.append('apuracao_boleto_id', apuracaoForm.boleto_id);
      
      // se tivesse arquivo no form, seria adicionado aqui. Como o usuário pede apenas evidência como URL,
      // usaremos string se tiver, mas para arquivos teríamos que usar supabase storage.
      // Vou focar apenas nos campos do form e no upload separado, ou usar um text input por agora.
      fd.append('apuracao_evidencias_url', apuracaoForm.evidencias_url);
      
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
          investimentos: data,
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

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {(userRole === 'Admin' || userRole === 'Financeiro') && (
              <Link 
                href="/financeiro/boletos"
                className="flex w-full sm:w-auto items-center justify-center gap-2 bg-elevated hover:bg-border text-foreground border border-border px-4 py-2 rounded-xl text-sm font-bold tracking-wide transition-all shadow-sm"
              >
                <FileText className="w-4 h-4" />
                Financeiro (Boletos)
              </Link>
            )}
            <Link 
              href="/investimento/lancar"
              className="flex w-full sm:w-auto items-center justify-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2 rounded-xl text-sm font-bold tracking-wide transition-all shadow-sm"
            >
              <TrendingUp className="w-4 h-4" />
              LANÇAR
            </Link>

            {/* AI Button - Only visible to Admin */}
            {userRole === 'Admin' && (
              <button
                onClick={generateInvestimentoInsight}
                disabled={loading || data.length === 0}
                className="group relative flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-bold tracking-wide transition-all shadow-lg shadow-purple-500/20 border border-purple-400/50 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-50 overflow-hidden"
                title="Análise IA dos Investimentos"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Sparkles className="w-4 h-4 relative z-10" />
                <span className="relative z-10 hidden sm:inline">Coffee IA</span>
              </button>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setViewMode(prev => {
                    const next = prev === 'table' ? 'calendar' : 'table';
                    if (next === 'calendar') setFilterFase(null);
                    return next;
                  });
                }}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-xl transition-all"
                title="Alternar Visualização"
              >
                {viewMode === 'table' ? (
                  <><CalendarIcon className="w-4 h-4" /><span className="hidden xl:inline">Calendário</span></>
                ) : (
                  <><List className="w-4 h-4" /><span className="hidden xl:inline">Lista</span></>
                )}
              </button>

              <button
                onClick={exportToCSV}
                disabled={loading || filteredData.length === 0}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-xl transition-all disabled:opacity-50"
                title="Exportar dados filtrados"
              >
                <Download className="w-4 h-4" />
                <span className="hidden xl:inline">Exportar</span>
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-xl transition-all disabled:opacity-50"
                title="Recarregar"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden xl:inline">Recarregar</span>
              </button>
              
              <div className="hidden sm:block ml-2 pl-4 border-l border-border">
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                  filterFase === null ? 'bg-gold/15 text-gold border-gold/30 shadow-sm' : 'bg-elevated text-muted border-border hover:bg-border hover:text-foreground'
                }`}
              >
                Todas <span className="text-xs opacity-70">({data.length})</span>
              </button>
              {Object.entries(FASE_CONFIG).map(([key, cfg]) => {
                const faseNum = Number(key);
                const count = faseCounts[faseNum] || 0;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterFase(faseNum)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                      filterFase === faseNum ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor} shadow-sm` : 'bg-elevated text-muted border-border hover:bg-border hover:text-foreground'
                    }`}
                  >
                    <span>{cfg.icon}</span> {cfg.label} <span className="text-xs opacity-70">({count})</span>
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
                }}
                className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-xl transition-all whitespace-nowrap"
              >
                Limpar Filtros
              </button>
            </div>
            <div className="flex items-center justify-between text-sm text-muted px-1">
              <span>{filteredData.length} lançamento{filteredData.length !== 1 ? 's' : ''} encontrado{filteredData.length !== 1 ? 's' : ''}</span>
              {filteredData.length > 0 && <span className="font-medium text-gold lg:hidden">Total: {formatCurrency(subtotal)}</span>}
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
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Cód.</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Data Registro</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Rede</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Período Ação</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Tipo</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Fase</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Família</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right">Vlr invest.</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right">PPC</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-right">Exp. Vol.</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border text-center">Ações</th>
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
                        Nenhum lançamento encontrado. Clique em "Lançar Investimento" para começar.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row) => (
                      <tr key={row.id} onClick={() => setSelectedAction(row)} className="hover:bg-elevated/50 transition-colors group cursor-pointer">
                        <td className="px-6 py-4 text-foreground/80 font-mono text-xs">
                          {row.codigo ? `#${row.codigo}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-foreground/80">
                          {new Date(row.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 font-medium text-foreground">
                          {row.rede}
                        </td>
                        <td className="px-6 py-4 text-foreground/80">
                          <div className="flex flex-col gap-0.5 text-xs font-medium">
                            <span>{formatDate(row.data_inicio)}</span>
                            <span className="text-muted">{formatDate(row.data_fim)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium border ${row.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                            {row.tipo_acao}
                          </span>
                        </td>
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4 text-foreground/80">
                          {row.abrangencia === "SKU" ? "Múltiplos SKUs" : row.familia_produto}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          {formatCurrency(getValorTotal(row))}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          {row.abrangencia === "SKU" ? "-" : (row.preco_acao ? formatCurrency(row.preco_acao) : '-')}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          {row.abrangencia === "SKU" ? "-" : (row.expectativa_volume ? row.expectativa_volume.toLocaleString('pt-BR') : '-')}
                        </td>
                        <td className="px-6 py-4 text-center">
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
                      <td colSpan={7} className="px-6 py-4 text-right text-foreground uppercase tracking-wider text-xs">
                        Subtotal (Itens filtrados)
                      </td>
                      <td className="px-6 py-4 text-right text-gold font-bold">
                        {formatCurrency(subtotal)}
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
                        <h3 className="font-bold text-foreground text-lg leading-tight">{row.rede}</h3>
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
                          {formatCurrency(getValorTotal(row))}
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
            ) : (
              <div className="flex-1 flex flex-col p-4 bg-background/50 overflow-y-auto">
                <div className="flex items-center justify-between mb-4 bg-elevated p-3 rounded-2xl border border-border">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-border rounded-xl transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold capitalize text-foreground">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </h2>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-border rounded-xl transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

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
                      </div>
                      <h3 className="font-bold text-foreground text-lg leading-tight uppercase tracking-wide">{selectedAction.rede}</h3>
                      <p className="text-sm text-foreground/80 mt-0.5">{selectedAction.abrangencia === "SKU" ? "Múltiplos SKUs" : selectedAction.familia_produto}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-black text-foreground text-lg tracking-tight">{formatCurrency(getValorTotal(selectedAction))}</span>
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
                      <span className="font-bold text-foreground">{selectedAction.rede}</span>
                    </div>
                    <div className="bg-elevated p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted block mb-1">Família</span>
                      <span className="font-bold text-foreground">{selectedAction.abrangencia === "SKU" ? "Múltiplos SKUs" : selectedAction.familia_produto}</span>
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
                      <span className="font-black text-gold text-lg">{formatCurrency(getValorTotal(selectedAction))}</span>
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
                                  <span className="font-medium text-gold">{s.investimento ? formatCurrency(s.investimento) : '-'}</span>
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
                              {cfg.label === 'Conferência' && <span className="block text-[7px] opacity-70 mt-0.5">(Financeiro)</span>}
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
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="mt-1 flex-shrink-0 w-4 h-4 rounded border-border text-gold focus:ring-gold/50" checked={tradeChecklist.conferencia} onChange={(e) => handleChecklistChange('conferencia', e.target.checked)} />
                        <div>
                          <span className="font-bold text-sm text-foreground block group-hover:text-gold transition-colors">5) Conferência</span>
                          <span className="text-xs text-muted block">Confirmação financeira dos valores apurados.</span>
                        </div>
                      </label>
                    </div>
                  )}

                  {(selectedAction.fase_atual || 1) === 2 && (
                    <button
                      onClick={() => handlePhaseAction(selectedAction.id, () => validarTrade(selectedAction.id, tradeChecklist))}
                      disabled={actionLoading === selectedAction.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                      {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      Validado pelo Trade
                    </button>
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
                          <input type="text" readOnly value={formatCurrency(getValorTotal(selectedAction))} className="w-full bg-elevated text-muted border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed font-medium" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Valor Realizado (R$) - Automático</label>
                          <input type="text" readOnly value={apuracaoForm.valor_realizado ? formatCurrency(Number(apuracaoForm.valor_realizado)) : ''} className="w-full bg-elevated text-emerald-600 dark:text-emerald-400 font-bold border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed" placeholder="Calculado" />
                        </div>
                        <div className="md:col-span-2" ref={boletoDropdownRef}>
                          <label className="block text-xs font-medium text-muted mb-1">Vincular a um Boleto do Financeiro</label>
                          
                          {/* Selected boleto display */}
                          {apuracaoForm.boleto_id && selectedBoletoLabel ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                              <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                              <span className="text-sm text-purple-300 font-medium truncate flex-1">{selectedBoletoLabel}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setApuracaoForm({...apuracaoForm, boleto_id: ""});
                                  setSelectedBoletoLabel("");
                                }}
                                className="p-0.5 hover:bg-purple-500/20 rounded transition-colors"
                              >
                                <X className="w-3.5 h-3.5 text-purple-400" />
                              </button>
                            </div>
                          ) : (
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
                                  placeholder={`Buscar boleto... (mostrando ${boletosAbertos.length} da rede ${selectedAction.rede})`}
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
                                            setApuracaoForm({...apuracaoForm, boleto_id: b.id});
                                            setSelectedBoletoLabel(`${b.rede} — Nº ${b.numero_boleto} — ${formatCurrency(b.valor_total)} — Venc: ${new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`);
                                            setShowBoletoDropdown(false);
                                            setBoletoSearchTerm("");
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-purple-500/10 transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-sm text-foreground">Nº {b.numero_boleto}</span>
                                              <span className="text-xs text-muted">{b.rede}</span>
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
                                            setApuracaoForm({...apuracaoForm, boleto_id: b.id});
                                            setSelectedBoletoLabel(`${b.rede} — Nº ${b.numero_boleto} — ${formatCurrency(b.valor_total)} — Venc: ${new Date(b.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`);
                                            setShowBoletoDropdown(false);
                                            setBoletoSearchTerm("");
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-purple-500/10 transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-sm text-foreground">Nº {b.numero_boleto}</span>
                                              <span className="text-xs text-muted truncate">{b.rede}</span>
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
                          )}
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
                        disabled={actionLoading === selectedAction.id || !apuracaoForm.numero_acordo || !apuracaoForm.boleto_id || !selectedAction.documento_url}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {actionLoading === selectedAction.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Concluir Apuração
                      </button>
                    </div>
                  )}

                  {(selectedAction.fase_atual || 1) === 4 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePhaseAction(selectedAction.id, () => conferirTrade(selectedAction.id, true))}
                        disabled={actionLoading === selectedAction.id || (userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        title={userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO' ? "Apenas perfil Financeiro pode aprovar" : ""}
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
                        disabled={actionLoading === selectedAction.id || (userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        title={userRole !== 'Financeiro' && userRole !== 'Admin' && userRole !== 'CEO' ? "Apenas perfil Financeiro pode finalizar" : ""}
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
                      <p className="text-xs text-muted mt-1">O Coffee IA está processando {data.length} ações</p>
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
