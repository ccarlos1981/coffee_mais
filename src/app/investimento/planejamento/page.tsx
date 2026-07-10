"use client";

import { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Download, 
  Upload, 
  RefreshCw, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight,
  List,
  X,
  AlertCircle,
  FileText,
  FileUp,
  Pencil,
  Trash2,
  CheckCircle2,
  Check,
  HelpCircle
} from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isWithinInterval, 
  addMonths, 
  subMonths, 
  parseISO, 
  startOfDay 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeProvider";
import { obterRedesMatrizes, importarInvestimentosEmLote, simularImportacaoInvestimentos, promoverPlanejamento, obterPlanilhaModelo } from "../lancar/actions";

interface AcaoInvestimento {
  id: string;
  codigo?: number | null;
  created_at: string;
  rede: string;
  codigo_matriz?: string | null;
  data_inicio: string;
  data_fim: string;
  tipo_acao: string;
  familia_produto?: string | null;
  preco_flat?: number | null;
  preco_acao?: number | null;
  valor_investimento?: number | null;
  expectativa_volume?: number | null;
  abrangencia: string;
  tipo_pagamento: string;
  skus_detalhes?: Array<{
    sku: string;
    preco_flat?: number | null;
    preco_acao?: number | null;
    investimento?: number | null;
    expectativa_volume?: number | null;
  }> | null;
  familias_detalhes?: Array<{
    familia_id: string;
    familia_nome: string;
    preco_flat?: number | null;
    preco_acao?: number | null;
    investimento?: number | null;
    expectativa_volume?: number | null;
  }> | null;
  mes_referencia?: string | null;
  documento_url?: string | null;
  gerente_responsavel?: string | null;
  condicao_pagamento?: string | null;
  date_mode?: "single" | "multiple" | null;
  fase_atual?: number;
  apuracao_preenchida_em?: string | null;
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

const supabase = createClient();

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

export default function PlanejamentoInvestimentoPage() {
  const [data, setData] = useState<AcaoInvestimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Faturamento e status por Matriz
  const [faturamentoMap, setFaturamentoMap] = useState<Record<string, Record<string, number>>>({});
  const [faturamentoTotalMap, setFaturamentoTotalMap] = useState<Record<string, number>>({});
  const [matrizSearch, setMatrizSearch] = useState("");
  
  // User profile
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [filterRede, setFilterRede] = useState("");
  const [filterFamilia, setFilterFamilia] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterMes, setFilterMes] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const itemsPerPage = 10;

  // Modal Detail
  const [selectedAction, setSelectedAction] = useState<AcaoInvestimento | null>(null);

  // Calendar State
  const [viewMode, setViewMode] = useState<"table" | "calendar" | "matrix">("table");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [parsedAcoes, setParsedAcoes] = useState<any[]>([]);
  const [isImportPending, startImportTransition] = useTransition();
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [fileHash, setFileHash] = useState("");
  const [rawExcelRows, setRawExcelRows] = useState<any[][]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: rows, error } = await supabase
        .from("v_acoes_investimento_com_gerente")
        .select("*")
        .eq("is_planejamento", true)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setData((rows as unknown as AcaoInvestimento[]) || []);

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
        salesRows.forEach(row => {
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
        const { data: profile } = await supabase.from('cm_user_profiles').select('role').eq('id', user.id).single();
        if (profile) setUserRole(profile.role);
      }
    };
    fetchUserRole();
    loadData();
  }, [loadData]);

  const [matrizes, setMatrizes] = useState<any[]>([]);

  // Filter lists derived from user matching roles
  const managerFilteredAcoes = useMemo(() => {
    if (!userRole) return data;
    if (userRole === 'Admin' || userRole === 'Financeiro' || userRole === 'CEO' || userRole === 'Trade') return data;
    
    // For regular managers, only show their own actions
    return data.filter(d => d.gerente_responsavel === userEmail);
  }, [data, userRole, userEmail]);

  const redesDisponiveis = useMemo(() => {
    const redes = managerFilteredAcoes.map(d => d.rede).filter(Boolean);
    return Array.from(new Set(redes)).sort();
  }, [managerFilteredAcoes]);

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

  const mesesDisponiveis = useMemo(() => {
    const meses = managerFilteredAcoes.map(d => d.mes_referencia).filter(Boolean) as string[];
    return Array.from(new Set(meses)).sort((a, b) => b.localeCompare(a));
  }, [managerFilteredAcoes]);

  const filteredData = useMemo(() => {
    return managerFilteredAcoes.filter(r => {
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
      return true;
    });
  }, [managerFilteredAcoes, filterRede, filterFamilia, filterDataInicio, filterDataFim, filterMes]);

  const getValorTotal = (r: AcaoInvestimento) => {
    if (r.abrangencia === "SKU" && r.skus_detalhes) {
      return r.skus_detalhes.reduce((acc, curr) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
    }
    if (r.familias_detalhes && r.familias_detalhes.length > 0) {
      return r.familias_detalhes.reduce((acc, curr) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
    }
    return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
  };

  const subtotal = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + getValorTotal(curr), 0);
  }, [filteredData]);

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

  const paginatedData = useMemo(() => {
    const start = page * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Upload Acordo/Evidência
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      setFeedback({ type: "error", msg: "Erro ao anexar comprovante: " + errMsg });
    } finally {
      setUploadingId(null);
    }
  };

  const handleViewDocument = async (filePath: string) => {
    try {
      const { data: signedData, error } = await supabase.storage
        .from("comprovantes_investimento")
        .createSignedUrl(filePath, 60 * 5); // 5 minutes
        
      if (error) throw error;
      if (signedData?.signedUrl) {
        window.open(signedData.signedUrl, '_blank');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      setFeedback({ type: "error", msg: "Erro ao abrir comprovante: " + errMsg });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este planejamento?")) return;
    try {
      const { error } = await supabase.from("cm_acoes_investimento").delete().eq("id", id);
      if (error) throw error;
      
      setData(prev => prev.filter(item => item.id !== id));
      setFeedback({ type: "success", msg: "Planejamento excluído com sucesso." });
      setTimeout(() => setFeedback(null), 3000);
      setSelectedAction(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", msg: "Erro ao excluir: " + errMsg });
    }
  };

  // Promoting action
  const handlePromote = async (id: string) => {
    if (!confirm("Confirmar a promoção deste planejamento para Investimento Oficial?")) return;
    setActionLoading(id);
    setFeedback(null);
    try {
      await promoverPlanejamento(id);
      setFeedback({ type: "success", msg: "Ação promovida para Investimento Oficial com sucesso!" });
      setTimeout(() => setFeedback(null), 3000);
      setSelectedAction(null);
      await loadData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", msg: errMsg });
    } finally {
      setActionLoading(null);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (filteredData.length === 0) {
      setFeedback({ type: "error", msg: "Não há dados para exportar." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    const headers = ["Código", "Data Registro", "Rede", "Família", "Ação", "Data Início", "Data Fim", "Valor"];
    const csvRows: string[] = [];

    filteredData.forEach(row => {
      const createdStr = row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : "";
      const redeStr = `"${row.rede || ""}"`;
      const acaoStr = `"${row.tipo_acao || ""}"`;

      if (row.abrangencia !== "SKU" && row.familias_detalhes && row.familias_detalhes.length > 0) {
        row.familias_detalhes.forEach((f: any) => {
          const invVal = f.investimento != null ? f.investimento : row.valor_investimento;
          const volVal = f.expectativa_volume != null ? f.expectativa_volume : row.expectativa_volume;
          const val = (Number(invVal) || 0) * (Number(volVal) || 0);
          const startDate = f.start_date || row.data_inicio;
          const endDate = f.end_date || row.data_fim;

          csvRows.push([
            row.codigo || "",
            createdStr,
            redeStr,
            `"${f.familia_nome || ""}"`,
            acaoStr,
            formatDate(startDate),
            formatDate(endDate),
            val.toString().replace('.', ',')
          ].join(";"));
        });
      } else if (row.abrangencia === "SKU" && row.skus_detalhes && row.skus_detalhes.length > 0) {
        row.skus_detalhes.forEach((s: any) => {
          const invVal = s.investimento != null ? s.investimento : row.valor_investimento;
          const volVal = s.expectativa_volume != null ? s.expectativa_volume : row.expectativa_volume;
          const val = (Number(invVal) || 0) * (Number(volVal) || 0);
          const startDate = s.start_date || row.data_inicio;
          const endDate = s.end_date || row.data_fim;

          csvRows.push([
            row.codigo || "",
            createdStr,
            redeStr,
            `"${s.sku || ""}"`,
            acaoStr,
            formatDate(startDate),
            formatDate(endDate),
            val.toString().replace('.', ',')
          ].join(";"));
        });
      } else {
        const val = getValorTotal(row);
        const fam = row.abrangencia === "SKU" 
          ? "Múltiplos SKUs" 
          : (row.familias_detalhes && row.familias_detalhes.length > 0 
            ? row.familias_detalhes.map((f: any) => f.familia_nome).join(", ") 
            : (row.familia_produto || ""));

        csvRows.push([
          row.codigo || "",
          createdStr,
          redeStr,
          `"${fam}"`,
          acaoStr,
          formatDate(row.data_inicio),
          formatDate(row.data_fim),
          val.toString().replace('.', ',')
        ].join(";"));
      }
    });

    const csvContent = [
      headers.join(";"),
      ...csvRows
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `planejamento_investimentos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download template Excel simplificado e personalizado por perfil
  // Download template Excel inteligente de planejamento
  const downloadModelExcel = async () => {
    try {
      setFeedback({ type: "success", msg: "Gerando planilha inteligente..." });
      const result = await obterPlanilhaModelo(true, filterRede);

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
      link.setAttribute("download", result.fileName || "modelo_planejamento_investimentos.xlsx");
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

  // Importação em lote integrada à Server Action de Simulação (Planejamento)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                ...first,
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

  // Efetiva a gravação definitiva de todos os planejamentos validados
  const handleConfirmImport = () => {
    if (importErrors.length > 0) {
      setFeedback({ type: "error", msg: "Corrija todos os erros da planilha antes de salvar." });
      return;
    }

    const validAcoes = parsedAcoes
      .filter(item => item.valid)
      .map(item => {
        const { uf, gerente, canal, ...dbFields } = item.data;
        return { ...dbFields, is_planejamento: true };
      });

    if (validAcoes.length === 0) {
      setFeedback({ type: "error", msg: "Nenhum planejamento válido encontrado." });
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
          setFeedback({ type: "success", msg: `${count} planejamentos importados com sucesso!` });
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
                <CalendarIcon className="w-5 h-5 text-gold" />
              </div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">Planejamento de Investimentos</h1>
            </div>
            <div className="sm:hidden">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Link 
              href="/investimento/ajuda"
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 bg-elevated hover:bg-border text-foreground border border-border px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Guia Passo a Passo"
            >
              <HelpCircle className="w-3.5 h-3.5 text-gold" />
              Guia
            </Link>
            <Link 
              href="/investimento/lancar?planejamento=true"
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              LANÇAR
            </Link>

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
                  onClick={() => setViewMode('calendar')}
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
                  <span>Matrizes</span>
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
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col bg-background min-h-0">
          <div className="flex flex-col gap-4 mb-4">
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
                  setFilterMes("");
                }}
                className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-foreground bg-elevated hover:bg-border border border-border rounded-xl transition-all whitespace-nowrap"
              >
                Limpar Filtros
              </button>
            </div>
            <div className="flex items-center justify-between text-sm text-muted px-1">
              <span>{filteredData.length} planejamento{filteredData.length !== 1 ? 's' : ''} encontrado{filteredData.length !== 1 ? 's' : ''}</span>
              {filteredData.length > 0 && <span className="font-medium text-gold lg:hidden">Total: {formatCurrency(subtotal)}</span>}
            </div>
          </div>

          <div className="w-full bg-card md:border md:border-border md:rounded-2xl flex flex-col shadow-sm relative">
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
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Mês</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Período Ação</th>
                    <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase border-b border-border">Tipo</th>
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
                          <p>Carregando planejamentos...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-muted">
                        Nenhum planejamento encontrado. Clique em &quot;Lançar&quot; para começar.
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
                          <div>
                            <span>{row.rede}</span>
                            {row.codigo_matriz && (
                              <span className="text-[10px] text-muted block font-mono mt-0.5">{row.codigo_matriz}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-foreground/80 font-medium">
                          {formatMesReferencia(row.mes_referencia)}
                        </td>
                        <td className="px-6 py-4 text-foreground/80">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{formatDate(row.data_inicio)}</span>
                            <span className="text-muted text-[10px]">até</span>
                            <span className="text-xs">{formatDate(row.data_fim)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${row.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                            {row.tipo_acao}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-foreground/80">
                          {row.abrangencia === "SKU" ? (
                            <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded text-[10px] font-bold">Múltiplos SKUs</span>
                          ) : (
                            (row.familias_detalhes && row.familias_detalhes.length > 0 ? row.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : row.familia_produto)
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-foreground">
                          {row.abrangencia === "SKU" ? "-" : (row.valor_investimento ? formatCurrency(row.valor_investimento) : '-')}
                        </td>
                        <td className="px-6 py-4 text-right text-foreground/80">
                          {row.abrangencia === "SKU" ? "-" : (row.preco_acao ? formatCurrency(row.preco_acao) : '-')}
                        </td>
                        <td className="px-6 py-4 text-right text-foreground/80">
                          {row.abrangencia === "SKU" ? "-" : (row.expectativa_volume ? row.expectativa_volume.toLocaleString('pt-BR') : '-')}
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/investimento/${row.id}/editar?planejamento=true`}
                              className="p-1.5 bg-elevated border border-border text-muted hover:text-foreground hover:bg-border rounded-lg transition-all"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="p-1.5 bg-danger/10 border border-danger/20 text-danger hover:bg-danger/25 rounded-lg transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePromote(row.id)}
                              disabled={actionLoading === row.id}
                              className="p-1.5 bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] hover:bg-[#10b981]/25 rounded-lg transition-all disabled:opacity-50"
                              title="Promover para Oficial"
                            >
                              {actionLoading === row.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>

              {/* Mobile Card List */}
              <div className="block md:hidden overflow-y-auto flex-1 p-4 space-y-3">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin text-gold" />
                    <p className="text-sm">Carregando planejamentos...</p>
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="text-center py-12 text-muted text-sm">
                    Nenhum planejamento encontrado.
                  </div>
                ) : (
                  paginatedData.map((row) => (
                    <div 
                      key={row.id} 
                      onClick={() => setSelectedAction(row)}
                      className="bg-elevated border border-border/80 rounded-xl p-4 space-y-3 hover:border-gold/30 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-xs text-gold font-bold">{row.codigo ? `#${row.codigo}` : '-'}</span>
                          <h4 className="font-bold text-foreground mt-0.5">{row.rede}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                          {row.tipo_acao}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs text-foreground/80 bg-background/40 p-2.5 rounded-lg border border-border/40">
                        <div>
                          <span className="text-muted block text-[10px]">Mês Ref.</span>
                          <span className="font-medium">{formatMesReferencia(row.mes_referencia)}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px]">Abrangência</span>
                          <span className="font-medium">
                            {row.abrangencia === "SKU" ? "Múltiplos SKUs" : (row.familias_detalhes && row.familias_detalhes.length > 0 ? row.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : row.familia_produto)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-xs text-muted">Investimento:</span>
                        <span className="font-bold text-gold text-sm">{formatCurrency(getValorTotal(row))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border bg-elevated/20 px-4 py-3 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setPage(p => Math.max(p - 1, 0))}
                      disabled={page === 0}
                      className="relative inline-flex items-center rounded-md border border-border bg-elevated px-4 py-2 text-sm font-medium text-foreground hover:bg-border disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))}
                      disabled={page === totalPages - 1}
                      className="relative ml-3 inline-flex items-center rounded-md border border-border bg-elevated px-4 py-2 text-sm font-medium text-foreground hover:bg-border disabled:opacity-50"
                    >
                      Próximo
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted">
                        Mostrando <span className="font-medium">{page * itemsPerPage + 1}</span> a{" "}
                        <span className="font-medium">
                          {Math.min((page + 1) * itemsPerPage, filteredData.length)}
                        </span>{" "}
                        de <span className="font-medium">{filteredData.length}</span> resultados
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setPage(i)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold border ${
                              page === i
                                ? "z-10 bg-gold/15 text-gold border-gold/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                                : "text-muted border-border bg-elevated hover:bg-border hover:text-foreground focus:outline-none"
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>
              )}
              </>
            ) : viewMode === "calendar" ? (
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
            ) : (
              <div className="w-full flex flex-col bg-card">
                {/* Matrix view header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-border bg-elevated/30 gap-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Histórico de Planejamento por Matriz</h3>
                    <p className="text-xs text-muted mt-0.5">Status de planejamento mensal por Matriz (Jun/2026+)</p>
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
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead className="sticky top-0 bg-elevated border-b border-border z-10 shadow-sm">
                      <tr>
                        <th className="p-3 font-semibold text-muted w-64 min-w-[240px]">Matriz</th>
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
      </main>

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
                    setSelectedDate(null);
                  }}
                  className="bg-elevated border border-border px-3 py-2 rounded-xl cursor-pointer hover:border-gold hover:shadow-md transition-all group flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {row.codigo && <span className="font-mono text-[9px] font-bold text-gold bg-gold/10 px-1 py-0.5 rounded">#{row.codigo}</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex-shrink-0 ${row.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                      {row.tipo_acao}
                    </span>
                    <span className="font-bold text-sm text-foreground group-hover:text-gold transition-colors truncate">{row.rede}</span>
                    <span className="text-xs text-muted truncate hidden sm:inline">{row.abrangencia === "SKU" ? "SKUs" : (row.familias_detalhes && row.familias_detalhes.length > 0 ? row.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : row.familia_produto)}</span>
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

      {/* Modal: Detalhes do Planejamento */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-elevated/50">
              <div>
                <span className="text-xs text-muted block mb-0.5">Detalhes do Planejamento</span>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {selectedAction.rede}
                  {selectedAction.codigo && <span className="font-mono text-sm text-gold bg-gold/10 px-1.5 py-0.5 rounded">#{selectedAction.codigo}</span>}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedAction(null)}
                className="text-muted hover:text-foreground p-1 bg-elevated hover:bg-border rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-background border border-border/50 p-4 rounded-xl">
                  <span className="text-xs text-muted block mb-1">Mês de Referência</span>
                  <span className="font-bold text-foreground text-base">{formatMesReferencia(selectedAction.mes_referencia)}</span>
                </div>
                <div className="bg-background border border-border/50 p-4 rounded-xl">
                  <span className="text-xs text-muted block mb-1">Período da Ação</span>
                  <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-gold" />
                    {formatDate(selectedAction.data_inicio)} até {formatDate(selectedAction.data_fim)}
                  </span>
                </div>
              </div>

              {/* Detalhes Financeiros */}
              <div className="bg-elevated/40 border border-border rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-sm font-semibold text-foreground">Informações Financeiras</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${selectedAction.tipo_acao === 'Sell Out' ? 'bg-[#C4A25D]/10 text-[#C4A25D] border-[#C4A25D]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                    {selectedAction.tipo_acao}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Canal de Pagamento:</span>
                    <span className="font-semibold text-foreground">{selectedAction.tipo_pagamento}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Abrangência da Ação:</span>
                    <span className="font-semibold text-foreground">{selectedAction.abrangencia}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-sm text-muted">Valor Total Estimado:</span>
                  <span className="text-2xl font-black text-gold">{formatCurrency(getValorTotal(selectedAction))}</span>
                </div>
              </div>

              {/* Detalhes de SKUs e/ou Família */}
              {selectedAction.familias_detalhes && selectedAction.familias_detalhes.length > 0 && (
                <div className="space-y-3 mb-4">
                  <h3 className="text-sm font-bold text-foreground border-b border-border pb-1.5">Famílias Planejadas</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {selectedAction.familias_detalhes.map((f: any, idx: number) => (
                      <div key={idx} className="bg-background border border-border p-3 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-gold block mb-0.5">{f.familia_nome}</span>
                          <span className="text-muted">
                            Vol: <span className="text-foreground font-medium">{f.expectativa_volume || '-'}</span>
                            {f.preco_acao && <span className="ml-2">PPC: <span className="text-foreground font-medium">{formatCurrency(f.preco_acao)}</span></span>}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gold font-bold block">{f.investimento ? formatCurrency(f.investimento) : '-'}</span>
                          <span className="text-[10px] text-muted">Custo: {formatCurrency((f.investimento || 0) * (f.expectativa_volume || 0))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAction.skus_detalhes && selectedAction.skus_detalhes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground border-b border-border pb-1.5">SKUs Planejados</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {selectedAction.skus_detalhes.map((s: any, idx: number) => (
                      <div key={idx} className="bg-background border border-border p-3 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-foreground block mb-0.5">{s.sku}</span>
                          <span className="text-muted">
                            Vol: <span className="text-foreground font-medium">{s.expectativa_volume || '-'}</span>
                            {s.preco_acao && <span className="ml-2">PPC: <span className="text-foreground font-medium">{formatCurrency(s.preco_acao)}</span></span>}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gold font-bold block">{s.investimento ? formatCurrency(s.investimento) : '-'}</span>
                          <span className="text-[10px] text-muted">Custo: {formatCurrency((s.investimento || 0) * (s.expectativa_volume || 0))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!selectedAction.familias_detalhes || selectedAction.familias_detalhes.length === 0) && (!selectedAction.skus_detalhes || selectedAction.skus_detalhes.length === 0) && (
                <div className="bg-background border border-border p-4 rounded-xl space-y-3 text-sm">
                  <h3 className="font-bold text-foreground border-b border-border/50 pb-1.5">Detalhes da Família</h3>
                  <div className="grid grid-cols-2 gap-y-2">
                    <span className="text-muted">Família:</span>
                    <span className="font-semibold text-foreground text-right">{selectedAction.familia_produto || '-'}</span>

                    <span className="text-muted">Preço Flat:</span>
                    <span className="font-semibold text-foreground text-right">{selectedAction.preco_flat ? formatCurrency(selectedAction.preco_flat) : '-'}</span>

                    <span className="text-muted">Preço Ação:</span>
                    <span className="font-semibold text-foreground text-right">{selectedAction.preco_acao ? formatCurrency(selectedAction.preco_acao) : '-'}</span>

                    <span className="text-muted">Exp. Volume:</span>
                    <span className="font-semibold text-foreground text-right">{selectedAction.expectativa_volume || '-'}</span>
                  </div>
                </div>
              )}

              {/* Cronograma da Ação */}
              {selectedAction.date_mode === "multiple" && (
                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-bold text-foreground border-b border-border pb-1.5">Cronograma da Ação</h3>
                  <div className="space-y-2">
                    {selectedAction.familias_detalhes && selectedAction.familias_detalhes.map((f: any, idx: number) => {
                      const status = calcularStatusItemInvestimento(f, selectedAction.fase_atual || 1, selectedAction.apuracao_preenchida_em);
                      const badgeColors = {
                        AGENDADA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                        EM_ANDAMENTO: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        ENCERRADA: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                        ATRASADA: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                      };
                      return (
                        <div key={`cron-fam-${idx}`} className="flex items-center justify-between bg-elevated border border-border p-2.5 rounded-lg text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{f.familia_nome} (Família)</span>
                            <span className="text-[10px] text-muted">{formatDate(f.start_date)} até {formatDate(f.end_date)}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeColors[status]}`}>
                            {status.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
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

              {/* Evidências / Documento */}
              <div className="bg-background border border-border/50 p-4 rounded-xl flex items-center justify-between text-sm">
                <div>
                  <span className="font-bold text-foreground block">Acordo Comercial</span>
                  <span className="text-xs text-muted">Comprovante de planejamento</span>
                </div>
                {selectedAction.documento_url ? (
                  <button 
                    onClick={() => handleViewDocument(selectedAction.documento_url!)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium rounded-xl hover:bg-blue-500/20 transition-all text-xs"
                  >
                    <FileText className="w-4 h-4" />
                    Visualizar Documento
                  </button>
                ) : (
                  <span className="text-xs text-danger font-medium">Nenhum arquivo anexado</span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border bg-elevated/30 flex flex-col gap-3">
              <button
                onClick={() => handlePromote(selectedAction.id)}
                disabled={actionLoading === selectedAction.id}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {actionLoading === selectedAction.id ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Confirmar e Promover p/ Oficial
              </button>

              <div className="flex gap-3">
                <Link
                  href={`/investimento/${selectedAction.id}/editar?planejamento=true`}
                  onClick={() => setSelectedAction(null)}
                  className="flex-1 text-center py-2.5 bg-elevated border border-border hover:bg-border text-foreground font-semibold text-sm rounded-xl transition-all"
                >
                  Editar Dados
                </Link>
                <button
                  onClick={() => handleDelete(selectedAction.id)}
                  className="flex-1 py-2.5 bg-danger/10 border border-danger/20 hover:bg-danger/20 text-danger font-semibold text-sm rounded-xl transition-all"
                >
                  Excluir Planejamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importação em Lote */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-border">
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-elevated">
              <div>
                <h3 className="text-base font-black text-foreground">Importar Planejamento em Lote</h3>
                <p className="text-[10px] text-muted">Selecione uma planilha de investimentos para validação e simulação em lote.</p>
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
                onClick={() => {
                  const el = document.getElementById("planning-file-input");
                  el?.click();
                }}
                className="border-2 border-dashed border-border hover:border-gold/30 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-background/30 hover:bg-foreground/[0.02] flex flex-col items-center justify-center gap-2"
              >
                <input 
                  type="file" 
                  id="planning-file-input"
                  className="hidden" 
                  accept=".xlsx, .xls"
                  onChange={handleFileChange} 
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
                      <p className="text-lg font-black text-gold mt-0.5">{formatCurrency(importSummary.totalInvestment)}</p>
                    </div>
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center shadow-sm">
                      <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Volume Planejado</p>
                      <p className="text-lg font-black text-emerald-400 mt-0.5">{importSummary.totalVolume} Unid.</p>
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
    </div>
  );
}
