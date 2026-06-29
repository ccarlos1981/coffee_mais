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
import { obterRedesMatrizes, importarInvestimentosEmLote, promoverPlanejamento } from "../lancar/actions";

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
  mes_referencia?: string | null;
  documento_url?: string | null;
  gerente_responsavel?: string | null;
  condicao_pagamento?: string | null;
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
    const fams = managerFilteredAcoes.map(d => d.familia_produto).filter(Boolean) as string[];
    return Array.from(new Set(fams)).sort();
  }, [managerFilteredAcoes]);

  const mesesDisponiveis = useMemo(() => {
    const meses = managerFilteredAcoes.map(d => d.mes_referencia).filter(Boolean) as string[];
    return Array.from(new Set(meses)).sort((a, b) => b.localeCompare(a));
  }, [managerFilteredAcoes]);

  const filteredData = useMemo(() => {
    return managerFilteredAcoes.filter(r => {
      if (filterRede && r.rede !== filterRede) return false;
      if (filterFamilia && r.familia_produto !== filterFamilia) return false;
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

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `planejamento_investimentos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download template Excel
  const downloadModelExcel = () => {
    const workbook = XLSX.utils.book_new();
    const headers = [
      ["Código da Matriz", "Rede", "UF", "Gerente", "Canal", "Tipo de Ação", "Pagamento", "Mês de Referência", "Data Início", "Data Fim", "Família ou SKU", "Família de Produto", "SKU", "Preço Flat", "Preço da Ação", "Investimento", "Expectativa de Volume"]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo Planejamento");
    XLSX.writeFile(workbook, "modelo_planejamento_investimentos.xlsx");
  };

  // Excel parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setFeedback(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        if (rawRows.length <= 1) {
          setFeedback({ type: "error", msg: "A planilha está vazia." });
          return;
        }
        const headers = rawRows[0].map((h: any) => String(h).trim().toLowerCase());
        const colIndices = {
          matriz: headers.findIndex(h => h.includes("código") || h.includes("matriz") || h.includes("cod")),
          rede: headers.findIndex(h => h.includes("rede")),
          uf: headers.findIndex(h => h.includes("uf")),
          gerente: headers.findIndex(h => h.includes("gerente")),
          canal: headers.findIndex(h => h.includes("canal")),
          tipo: headers.findIndex(h => h.includes("tipo")),
          pagamento: headers.findIndex(h => h.includes("pagamento")),
          mes: headers.findIndex(h => h.includes("mês") || h.includes("mes")),
          inicio: headers.findIndex(h => h.includes("início") || h.includes("inicio") || h.includes("data de inicio") || h.includes("data inicio")),
          fim: headers.findIndex(h => h.includes("fim") || h.includes("data de fim") || h.includes("data fim")),
          abrangencia: headers.findIndex(h => h.includes("abrangência") || h.includes("abrangencia") || h.includes("família ou sku") || h.includes("familia ou sku")),
          familia: headers.findIndex(h => h.includes("família") || h.includes("familia")),
          sku: headers.findIndex(h => h.includes("sku")),
          flat: headers.findIndex(h => h.includes("flat")),
          precoAcao: headers.findIndex(h => h.includes("ação") || h.includes("acao")),
          investimento: headers.findIndex(h => h.includes("investimento") || h.includes("inv")),
          volume: headers.findIndex(h => h.includes("volume") || h.includes("vol"))
        };

        const parseDateString = (val: any) => {
          if (!val) return null;
          const clean = String(val).trim();
          const dParts = clean.split("/");
          if (dParts.length === 3) {
            const d = dParts[0].padStart(2, '0');
            const m = dParts[1].padStart(2, '0');
            const y = dParts[2];
            return `${y}-${m}-${d}`;
          }
          if (clean.split("-").length === 3) return clean;
          return null;
        };

        const excelSerialToDate = (serial: number) => {
          const utc_days = Math.floor(serial - 25569);
          const utc_value = utc_days * 86400;
          const date_info = new Date(utc_value * 1000);
          const y = date_info.getFullYear();
          const m = String(date_info.getMonth() + 1).padStart(2, '0');
          const d = String(date_info.getDate() + 1).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        const parsedLines: any[] = [];
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (row.length === 0 || row.every(cell => cell === undefined || cell === "")) continue;
          const errors: string[] = [];
          const rawMatriz = colIndices.matriz !== -1 ? row[colIndices.matriz] : "";
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
          const rawAcao = colIndices.precoAcao !== -1 ? row[colIndices.precoAcao] : "";
          const rawInvestimento = colIndices.investimento !== -1 ? row[colIndices.investimento] : "";
          const rawVolume = colIndices.volume !== -1 ? row[colIndices.volume] : "";

          let codigoMatrizVal = rawMatriz ? String(rawMatriz).trim() : "";
          let redeVal = rawRede ? String(rawRede).trim() : "";
          if (!codigoMatrizVal) {
            errors.push("Código da Matriz é obrigatório.");
          } else {
            let matched = matrizes.find(m => m.codigo === codigoMatrizVal);
            if (!matched && !codigoMatrizVal.includes(".")) {
              matched = matrizes.find(m => m.codigo === codigoMatrizVal + ".0" || m.codigo.startsWith(codigoMatrizVal + "."));
            }
            if (matched) {
              codigoMatrizVal = matched.codigo;
              redeVal = matched.nome;
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

        const groupedAcoes: any[] = [];
        const skuGroups: Record<string, any[]> = {};

        parsedLines.forEach(line => {
          if (!line.valid) {
            groupedAcoes.push({
              originalRow: line.originalRow,
              data: { ...line.data, skus_detalhes: [] },
              valid: false,
              errors: line.errors
            });
            return;
          }

          if (line.data.abrangencia === "Família") {
            groupedAcoes.push({
              originalRow: line.originalRow,
              data: {
                ...line.data,
                skus_detalhes: [],
                fase_atual: 1
              },
              valid: true,
              errors: []
            });
          } else {
            const key = `${line.data.codigo_matriz}|${line.data.tipo_acao}|${line.data.tipo_pagamento}|${line.data.mes_referencia}|${line.data.data_inicio}|${line.data.data_fim}`;
            if (!skuGroups[key]) skuGroups[key] = [];
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
      } catch (err: unknown) {
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
        const { uf, gerente, canal, ...dbFields } = item.data;
        // Set is_planejamento to true for planning page import!
        return { ...dbFields, is_planejamento: true };
      });

    if (validAcoes.length === 0) {
      setFeedback({ type: "error", msg: "Nenhum investimento válido." });
      return;
    }

    startImportTransition(async () => {
      try {
        const res = await importarInvestimentosEmLote(validAcoes);
        if (res.success) {
          setFeedback({ type: "success", msg: `${res.count} planejamentos importados com sucesso!` });
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
        <div className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col bg-background">
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
                            row.familia_produto
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
                            {row.abrangencia === "SKU" ? "Múltiplos SKUs" : row.familia_produto}
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
              <div className="flex-1 flex flex-col min-h-0 bg-card overflow-hidden">
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
                <div className="flex-1 overflow-auto">
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

              {/* Detalhes de SKUs ou Família */}
              {selectedAction.abrangencia === "SKU" && selectedAction.skus_detalhes && selectedAction.skus_detalhes.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground border-b border-border pb-1.5">SKUs Planejados</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {selectedAction.skus_detalhes.map((s, idx) => (
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
              ) : (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-foreground">Importar Planejamento em Lote</h3>
            <p className="text-xs text-muted">Importe múltiplos registros através de uma planilha Excel pré-formatada.</p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-xl cursor-pointer hover:bg-elevated/40 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-muted mb-2" />
                    <p className="text-xs text-muted">
                      {importFileName ? (
                        <span className="font-semibold text-gold">{importFileName}</span>
                      ) : (
                        <span>Clique para selecionar a planilha .xlsx</span>
                      )}
                    </p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".xlsx,.xls"
                    onChange={handleFileChange} 
                  />
                </label>
              </div>

              {parsedAcoes.length > 0 && (
                <div className="p-3 bg-elevated rounded-xl border border-border max-h-40 overflow-y-auto space-y-1.5">
                  <p className="text-xs font-bold text-foreground mb-1">
                    Linhas processadas ({parsedAcoes.length}):
                  </p>
                  {parsedAcoes.map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-medium">
                      <span className="truncate max-w-[70%]">
                        Linha {idx + 2}: {line.data.rede || 'Sem Rede'} - {line.data.abrangencia}
                      </span>
                      {line.valid ? (
                        <span className="text-[#10b981]">Válido</span>
                      ) : (
                        <span className="text-danger" title={line.errors.join(', ')}>Inválido</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedAcoes([]);
                  setImportFileName("");
                }}
                className="flex-1 py-2.5 bg-elevated border border-border hover:bg-border text-foreground font-semibold text-sm rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isImportPending || parsedAcoes.length === 0 || !parsedAcoes.some(x => x.valid)}
                onClick={handleConfirmImport}
                className="flex-1 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
              >
                {isImportPending ? "Salvando..." : "Confirmar Importação"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Importação em Lote */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-foreground">Importar Planejamento em Lote</h3>
            <p className="text-xs text-muted">Importe múltiplos registros através de uma planilha Excel pré-formatada.</p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-xl cursor-pointer hover:bg-elevated/40 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-muted mb-2" />
                    <p className="text-xs text-muted">
                      {importFileName ? (
                        <span className="font-semibold text-gold">{importFileName}</span>
                      ) : (
                        <span>Clique para selecionar a planilha .xlsx</span>
                      )}
                    </p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".xlsx,.xls"
                    onChange={handleFileChange} 
                  />
                </label>
              </div>

              {parsedAcoes.length > 0 && (
                <div className="p-3 bg-elevated rounded-xl border border-border max-h-40 overflow-y-auto space-y-1.5">
                  <p className="text-xs font-bold text-foreground mb-1">
                    Linhas processadas ({parsedAcoes.length}):
                  </p>
                  {parsedAcoes.map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-medium">
                      <span className="truncate max-w-[70%]">
                        Linha {idx + 2}: {line.data.rede || 'Sem Rede'} - {line.data.abrangencia}
                      </span>
                      {line.valid ? (
                        <span className="text-[#10b981]">Válido</span>
                      ) : (
                        <span className="text-danger" title={line.errors.join(', ')}>Inválido</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedAcoes([]);
                  setImportFileName("");
                }}
                className="flex-1 py-2.5 bg-elevated border border-border hover:bg-border text-foreground font-semibold text-sm rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isImportPending || parsedAcoes.length === 0 || !parsedAcoes.some(x => x.valid)}
                onClick={handleConfirmImport}
                className="flex-1 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
              >
                {isImportPending ? "Salvando..." : "Confirmar Importação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
