"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  ArrowLeft, 
  Search, 
  Download, 
  Upload, 
  Users,
  MapPin,
  Building,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  X,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { sincronizarClientesSankhya, importarClientesEmLote } from "./actions";

const FASE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  comercial: { label: "Comercial", color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20", icon: "📋" },
  financeiro: { label: "Financeiro", color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", icon: "🔍" },
  operacoes: { label: "Operações", color: "text-purple-500", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20", icon: "📝" },
  concluido: { label: "Concluído", color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20", icon: "✅" },
};

export default function ClientesListPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLocal, setSearchLocal] = useState("");
  const [searchGeneral, setSearchGeneral] = useState("");
  const [filterFase, setFilterFase] = useState<string | null>(null);

  const phaseCounts = {
    comercial: clientes.filter(c => (c.fase || 'comercial') === 'comercial').length,
    financeiro: clientes.filter(c => c.fase === 'financeiro').length,
    operacoes: clientes.filter(c => c.fase === 'operacoes').length,
    concluido: clientes.filter(c => c.fase === 'concluido').length,
  };
  
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingLight, setExportingLight] = useState(false);
  const [exportingFull, setExportingFull] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Detail Modal State
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cm_clientes")
        .select("*")
        .order("nome_parceiro", { ascending: true });
        
      if (error) {
        console.error("Erro ao buscar clientes:", error);
        toast.error("Erro ao buscar clientes no banco.");
      } else if (data) {
        const mapped = data.map((c: any) => ({
          ...c,
          matriz_original: c.matriz || ""
        }));
        setClientes(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  // Inline edit handler
  const handleMatrizChange = (idx: number, newVal: string) => {
    const updated = [...clientes];
    updated[idx].matriz = newVal;
    setClientes(updated);
  };

  const handleMatrizBlur = async (cliente: any, val: string) => {
    if (cliente.matriz_original === val) return;
    
    try {
      const { error } = await supabase
        .from("cm_clientes")
        .update({ matriz: val })
        .eq("id", cliente.id);
        
      if (error) throw error;
      
      toast.success(`Matriz do cliente #${cliente.codigo} atualizada para "${val}"`);
      cliente.matriz_original = val;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar nome da matriz.");
    }
  };

  const handleToggleStatus = async (cliente: any) => {
    const nextStatus = cliente.status === "ativo" ? "inativo" : "ativo";
    try {
      const { error } = await supabase
        .from("cm_clientes")
        .update({ status: nextStatus })
        .eq("id", cliente.id);
        
      if (error) throw error;
      
      setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, status: nextStatus } : c));
      toast.success(`Cliente #${cliente.codigo} marcado como ${nextStatus === 'ativo' ? 'Ativo' : 'Inativo'}.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao alterar status do cliente.");
    }
  };

  // Sync Action
  const handleSyncSankhya = async () => {
    setSyncing(true);
    try {
      const res = await sincronizarClientesSankhya();
      if (res.success) {
        if (res.count > 0) {
          toast.success(`${res.count} novos clientes importados do faturamento do Sankhya!`);
          fetchClientes();
        } else {
          toast.info("Nenhum novo cliente encontrado para sincronização.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro na sincronização: " + (err.message || "Erro desconhecido"));
    } finally {
      setSyncing(false);
    }
  };

  // Import Action
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows = XLSX.utils.sheet_to_json<any>(ws);

        if (rawRows.length === 0) {
          toast.error("Planilha vazia.");
          setImporting(false);
          return;
        }

        // Mapear cabeçalhos de todos os campos
        const headerMapping: Record<string, string> = {
          "código do cliente": "codigo",
          "cod. parceiro": "codigo",
          "cod. cliente": "codigo",
          "código parceiro": "codigo",
          "cnpj": "cnpj",
          "nome do parceiro": "nome_parceiro",
          "nome fantasia": "nome_parceiro",
          "parceiro": "nome_parceiro",
          "razão social": "razao_social",
          "razao social": "razao_social",
          "inscrição estadual": "inscricao_estadual",
          "inscricao estadual": "inscricao_estadual",
          "cep": "cep",
          "endereço": "endereco",
          "endereco": "endereco",
          "número": "numero",
          "numero": "numero",
          "complemento": "complemento",
          "cidade": "cidade",
          "uf": "uf",
          "estado": "uf",
          "código da matriz": "codigo_matriz",
          "cod. matriz": "codigo_matriz",
          "matriz": "matriz",
          "rede": "matriz",
          "responsável": "responsavel",
          "responsavel": "responsavel",
          "gerente": "responsavel",
          "canal": "tipo_parceiro",
          "tipo": "tipo_parceiro",
          "condição de pagamento": "condicao_pagamento",
          "condicao de pagamento": "condicao_pagamento",
          "sugestão de venda": "condicao_pagamento",
          "classificação icms": "classificacao_icms",
          "classificacao icms": "classificacao_icms",
          "retirar st": "retirar_st",
          "retirar st do preço": "retirar_st",
          "empresa preferencial": "empresa_preferencial",
          "tipo geração boleto": "tipo_geracao_boleto",
          "tipo geracao boleto": "tipo_geracao_boleto",
          "enviar danfe": "enviar_danfe",
          "e-mail para envio": "email_nfe",
          "email para envio": "email_nfe",
          "banco": "banco",
          "agência": "agencia",
          "agencia": "agencia",
          "conta": "conta",
          "desconto contratual (%)": "desconto_contratual",
          "desconto contratual": "desconto_contratual",
          "data vigor": "data_vigor",
          "data de vigor": "data_vigor",
        };

        const firstRow = rawRows[0];
        const columns = Object.keys(firstRow);
        const mappedCols: Record<string, string> = {};

        columns.forEach(col => {
          const cleanCol = col.toLowerCase().trim();
          if (headerMapping[cleanCol]) {
            mappedCols[col] = headerMapping[cleanCol];
          } else {
            // Tenta match parcial
            for (const [key, dbField] of Object.entries(headerMapping)) {
              if (cleanCol.includes(key) || key.includes(cleanCol)) {
                mappedCols[col] = dbField;
                break;
              }
            }
          }
        });

        // Verificar colunas obrigatórias
        const targetFields = Object.values(mappedCols);
        if (!targetFields.includes("codigo")) {
          toast.error("Coluna 'Código do Cliente' ou 'Cód. Parceiro' é obrigatória.");
          setImporting(false);
          return;
        }

        const validRecords: any[] = [];
        rawRows.forEach((row) => {
          const record: any = {};
          
          columns.forEach(col => {
            const dbField = mappedCols[col];
            if (dbField) {
              const val = row[col];
              if (val !== undefined && val !== null) {
                if (dbField === "codigo") {
                  record.codigo = parseInt(String(val).replace(/\.0$/, "").replace(/\D/g, ""));
                } else {
                  record[dbField] = String(val).trim();
                }
              }
            }
          });

          if (record.codigo && !isNaN(record.codigo)) {
            if (record.cnpj) {
              record.cnpj = record.cnpj.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
            }
            record.status = record.status || "ativo";
            validRecords.push(record);
          }
        });

        if (validRecords.length === 0) {
          toast.error("Nenhum registro de cliente válido encontrado.");
          setImporting(false);
          return;
        }

        const res = await importarClientesEmLote(validRecords);
        if (res.success) {
          toast.success(`${res.count} clientes importados/atualizados com sucesso!`);
          fetchClientes();
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Erro ao processar planilha: " + (err.message || "Erro desconhecido"));
      } finally {
        setImporting(false);
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // Export Light Action (Only columns displayed on screen)
  const handleExportLight = () => {
    setExportingLight(true);
    
    setTimeout(() => {
      const headers = [
        "Código", "Nome", "Código da Matriz", "Nome da Matriz", "UF", "Responsável", "Status"
      ];
      const rows = filteredClientes.map(c => [
        c.codigo || "",
        c.nome_parceiro || c.razao_social || "",
        c.codigo_matriz || "",
        c.matriz || "",
        c.uf || "",
        c.responsavel || "",
        c.status === "ativo" ? "Ativo" : "Inativo"
      ]);
      
      const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `carteira_clientes_export_light_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Carteira (Exportação Light) exportada com sucesso!");
      setExportingLight(false);
    }, 500);
  };

  // Export Full Action (All columns)
  const handleExportFull = () => {
    setExportingFull(true);
    
    setTimeout(() => {
      const headers = [
        "Código", "CNPJ", "Nome do Parceiro", "Razão Social", 
        "Inscrição Estadual", "CEP", "Endereço", "Número", "Complemento", 
        "Cidade", "UF", "Código da Matriz", "Nome da Matriz", "Responsável", "Canal", 
        "Condição de Pagamento", "Classificação ICMS", "Retirar ST", 
        "Empresa Preferencial", "Tipo Geração Boleto", "Enviar DANFE", 
        "E-mail para envio", "Banco", "Agência", "Conta", "Desconto Contratual (%)", "Data Vigor", "Status"
      ];
      const rows = filteredClientes.map(c => [
        c.codigo || "",
        c.cnpj || "",
        c.nome_parceiro || "",
        c.razao_social || "",
        c.inscricao_estadual || "",
        c.cep || "",
        c.endereco || "",
        c.numero || "",
        c.complemento || "",
        c.cidade || "",
        c.uf || "",
        c.codigo_matriz || "",
        c.matriz || "",
        c.responsavel || "",
        c.tipo_parceiro || "",
        c.condicao_pagamento || "",
        c.classificacao_icms || "",
        c.retirar_st || "",
        c.empresa_preferencial || "",
        c.tipo_geracao_boleto || "",
        c.enviar_danfe || "",
        c.email_nfe || "",
        c.banco || "",
        c.agencia || "",
        c.conta || "",
        c.desconto_contratual || "",
        c.data_vigor || "",
        c.status === "ativo" ? "Ativo" : "Inativo"
      ]);
      
      const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `carteira_clientes_export_full_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Carteira (Exportação Completa) exportada com sucesso!");
      setExportingFull(false);
    }, 500);
  };

  // Export complete template with all fields
  const handleDownloadTemplate = () => {
    const headers = [
      "Código do Cliente", "CNPJ", "Nome do Parceiro", "Razão Social", 
      "Inscrição Estadual", "CEP", "Endereço", "Número", "Complemento", 
      "Cidade", "UF", "Código da Matriz", "Matriz", "Responsável", "Canal", 
      "Condição de Pagamento", "Classificação ICMS", "Retirar ST", 
      "Empresa Preferencial", "Tipo Geração Boleto", "Enviar DANFE", 
      "E-mail para envio", "Banco", "Agência", "Conta", "Desconto Contratual (%)", "Data Vigor"
    ];
    
    const sampleRows = [
      ["78273", "05.011.000/0001-00", "HIPPO SUPERMERCADOS", "HIPPO SUPERMERCADOS LTDA", "123456", "88010-000", "Rua das Flores", "100", "Lote 2", "Florianópolis", "SC", "78273.0", "HIPPO", "Luciano", "KA", "30 DD COB", "Revendedor", "Não", "Coffee Mais LTDA", "Boleto Digital", "Sim", "financeiro@hippo.com.br", "Banco do Brasil", "0001-9", "12345-6", "5%", "2026-01-01"],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Clientes");
    XLSX.writeFile(wb, "modelo_importacao_clientes_completo.xlsx");
    toast.success("Modelo completo baixado!");
  };

  // Filter local & general & phase
  const filteredClientes = clientes.filter(cliente => {
    if (filterFase !== null && (cliente.fase || 'comercial') !== filterFase) {
      return false;
    }

    const matchLocal = !searchLocal.trim() || 
      `${cliente.cidade || ""} ${cliente.uf || ""}`.toLowerCase().includes(searchLocal.toLowerCase());

    const matchGeneral = !searchGeneral.trim() ||
      `${cliente.codigo || ""} ${cliente.nome_parceiro || ""} ${cliente.razao_social || ""} ${cliente.matriz || ""} ${cliente.codigo_matriz || ""} ${cliente.responsavel || ""}`
        .toLowerCase()
        .includes(searchGeneral.toLowerCase());

    return matchLocal && matchGeneral;
  });

  // Pagination Logic
  const totalItems = filteredClientes.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClientes = filteredClientes.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchGeneral, searchLocal, filterFase]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb / Back */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors font-medium text-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="text-accent-gold" /> 
              Lista de Clientes (Cadastro Único)
            </h1>
            <p className="text-foreground-secondary mt-1 text-sm">
              Gerencie a carteira de clientes, vincule gerentes/matrizes e sincronize novos clientes do faturamento do Sankhya.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Cadastrar Cliente Button */}
            <button
              onClick={() => router.push("/config-financeiro/cadastro")}
              className="flex-1 md:flex-none h-10 px-4 bg-accent-gold hover:brightness-110 text-white rounded-lg flex items-center justify-center gap-2 transition-all font-bold text-sm shadow-[0_4px_14px_rgba(200,169,110,0.3)]"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Cliente
            </button>

            {/* Sync Sankhya Button */}
            <button
              onClick={handleSyncSankhya}
              disabled={syncing}
              className="flex-1 md:flex-none h-10 px-4 bg-background-elevated border border-border hover:border-accent-gold/50 text-foreground rounded-lg flex items-center justify-center gap-2 transition-all font-semibold text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-accent-gold ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar Sankhya
            </button>

            {/* Import Button */}
            <button
              onClick={() => document.getElementById('import-file')?.click()}
              disabled={importing}
              className="flex-1 md:flex-none h-10 px-4 bg-background-elevated border border-border hover:border-accent-gold/50 text-foreground rounded-lg flex items-center justify-center gap-2 transition-all font-semibold text-sm disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-accent-gold" />}
              Importar Clientes
            </button>
            <input 
              type="file" 
              id="import-file" 
              className="hidden" 
              accept=".xls,.xlsx"
              onChange={handleImportExcel}
            />

            {/* Template Button */}
            <button
              onClick={handleDownloadTemplate}
              className="h-10 px-3 bg-background-elevated border border-border hover:border-accent-gold/30 text-foreground rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-semibold"
              title="Baixar planilha modelo de importação completo"
            >
              <FileSpreadsheet className="w-4 h-4 text-accent-gold" />
              Modelo Completo
            </button>
            
            {/* Exp. Light Button */}
            <button
              onClick={handleExportLight}
              disabled={exportingLight || filteredClientes.length === 0}
              className="flex-1 md:flex-none h-10 px-3 bg-accent-gold/10 border border-accent-gold/20 hover:bg-accent-gold hover:text-white text-accent-gold rounded-lg flex items-center justify-center gap-1.5 transition-all font-semibold text-xs disabled:opacity-50"
            >
              {exportingLight ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Exp. Light
            </button>

            {/* Exp. Full Button */}
            <button
              onClick={handleExportFull}
              disabled={exportingFull || filteredClientes.length === 0}
              className="flex-1 md:flex-none h-10 px-3 bg-accent-gold/10 border border-accent-gold/20 hover:bg-accent-gold hover:text-white text-accent-gold rounded-lg flex items-center justify-center gap-1.5 transition-all font-semibold text-xs disabled:opacity-50"
            >
              {exportingFull ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Exp. Full
            </button>
          </div>
        </header>

        {/* Phase Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterFase(null)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
              filterFase === null ? 'bg-accent-gold/15 text-accent-gold border-accent-gold/30 shadow-sm' : 'bg-background-card text-foreground-secondary border-border hover:bg-background-elevated hover:text-foreground'
            }`}
          >
            Todas <span className="text-xs opacity-70">({clientes.length})</span>
          </button>
          {Object.entries(FASE_CONFIG).map(([key, cfg]) => {
            const count = phaseCounts[key as keyof typeof phaseCounts] || 0;
            return (
              <button
                key={key}
                onClick={() => setFilterFase(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                  filterFase === key ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor} shadow-sm` : 'bg-background-card text-foreground-secondary border-border hover:bg-background-elevated hover:text-foreground'
                }`}
              >
                <span>{cfg.icon}</span> {cfg.label} <span className="text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-background-card border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 shadow-sm">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
              Busca Geral
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-dim" />
              <input
                type="text"
                value={searchGeneral}
                onChange={(e) => setSearchGeneral(e.target.value)}
                placeholder="Código, Nome, Matriz ou Responsável..."
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
              Localização (Cidade / UF)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-dim" />
              <input
                type="text"
                value={searchLocal}
                onChange={(e) => setSearchLocal(e.target.value)}
                placeholder="Ex: Belo Horizonte, SP, RS..."
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Listing Table */}
        <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-background-elevated border-b border-border text-foreground-secondary text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-3.5 py-3">Cód. Cliente/Parceiro</th>
                  <th className="px-3.5 py-3">Nome / Parceiro</th>
                  <th className="px-3.5 py-3">Cód. Matriz</th>
                  <th className="px-3.5 py-3">Matriz (Input)</th>
                  <th className="px-3.5 py-3 text-center">UF</th>
                  <th className="px-3.5 py-3">Responsável</th>
                  <th className="px-3.5 py-3">Fase</th>
                  <th className="px-3.5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3.5 py-12 text-center text-foreground-secondary">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-gold" />
                      Carregando carteira de clientes...
                    </td>
                  </tr>
                ) : paginatedClientes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3.5 py-12 text-center text-foreground-secondary">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-base font-medium text-foreground">Nenhum cliente encontrado.</p>
                      <p className="text-sm mt-1">Experimente mudar o filtro de busca ou sincronizar com o Sankhya.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedClientes.map((cliente, idx) => {
                    const globalIdx = (currentPage - 1) * itemsPerPage + idx;
                    return (
                      <tr 
                        key={cliente.id || idx} 
                        onClick={() => setSelectedClient(cliente)}
                        className="hover:bg-background-elevated/50 transition-colors cursor-pointer group"
                      >
                        {/* Código do Cliente */}
                        <td className="px-3.5 py-3 font-semibold text-foreground font-mono">
                          #{cliente.codigo || "-"}
                        </td>
                        
                        {/* Nome do Cliente */}
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-foreground max-w-[180px] xl:max-w-[240px] truncate" title={cliente.nome_parceiro}>
                            {cliente.nome_parceiro || cliente.razao_social || "Sem nome"}
                          </div>
                          <div className="text-xs text-foreground-secondary max-w-[180px] xl:max-w-[240px] truncate">{cliente.cidade || "-"}</div>
                        </td>
                        
                        {/* Código da Matriz */}
                        <td className="px-3.5 py-3 font-mono text-foreground font-semibold">
                          {cliente.codigo_matriz || <span className="text-foreground-secondary italic text-xs font-normal">Sem código</span>}
                        </td>
                        
                        {/* Nome da Matriz (Input Inline Edit) */}
                        <td className="px-3.5 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={cliente.matriz || ""}
                            onChange={(e) => handleMatrizChange(globalIdx, e.target.value)}
                            onBlur={(e) => handleMatrizBlur(cliente, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="bg-transparent hover:bg-background/80 focus:bg-background border border-transparent hover:border-border/60 focus:border-accent-gold rounded px-2 py-1 text-sm font-semibold text-foreground w-full max-w-[130px] xl:max-w-[170px] transition-all focus:outline-none"
                            placeholder="Nome matriz..."
                          />
                        </td>
                        
                        {/* UF */}
                        <td className="px-3.5 py-3 text-center font-bold text-foreground">
                          {cliente.uf || cliente.cidade?.split("-")?.[1]?.trim() || "-"}
                        </td>
                        
                        {/* Responsável */}
                        <td className="px-3.5 py-3 font-medium text-foreground">
                          {cliente.responsavel || (
                            <span className="text-foreground-secondary italic text-xs font-normal">Não associado</span>
                          )}
                        </td>
                        
                        {/* Fase */}
                        <td className="px-3.5 py-3">
                          {(() => {
                            const f = cliente.fase || 'comercial';
                            const cfg = FASE_CONFIG[f] || FASE_CONFIG.comercial;
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                                <span>{cfg.icon}</span>
                                {cfg.label}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Status */}
                        <td 
                          className="px-3.5 py-3 text-center" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(cliente);
                          }}
                        >
                          <span 
                            title="Clique para alternar o status do cliente"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all select-none ${
                              cliente.status === "ativo" 
                                ? "bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20" 
                                : "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cliente.status === "ativo" ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            {cliente.status === "ativo" ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-background-elevated px-6 py-4 border-t border-border flex items-center justify-between text-sm text-foreground-secondary">
              <div>
                Exibindo <span className="font-semibold text-foreground">{startIndex + 1}</span> a{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(startIndex + itemsPerPage, totalItems)}
                </span>{" "}
                de <span className="font-semibold text-foreground">{totalItems}</span> clientes
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 rounded bg-background border border-border flex items-center justify-center hover:border-accent-gold/40 text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 rounded bg-background border border-border flex items-center justify-center hover:border-accent-gold/40 text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Client Details Modal Popup */}
        {selectedClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setSelectedClient(null)}
            />
            
            {/* Modal Body */}
            <div className="relative w-full max-w-2xl bg-background border border-border rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="bg-background-elevated px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center border border-accent-gold/20">
                    <Building className="w-5 h-5 text-accent-gold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-foreground">Detalhes do Cliente</h3>
                      {(() => {
                        const f = selectedClient.fase || 'comercial';
                        const cfg = FASE_CONFIG[f] || FASE_CONFIG.comercial;
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                            <span>{cfg.icon}</span>
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-foreground-secondary">Código Parceiro: #{selectedClient.codigo}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 hover:bg-background rounded-lg text-foreground-secondary hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable details */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm leading-relaxed">
                
                {/* 1. Identificação Geral (CNPJ here!) */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">Identificação Geral</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-foreground-secondary block">CNPJ (Exclusivo no Detalhe)</span>
                      <span className="font-mono text-foreground font-bold text-base bg-accent-gold/5 border border-accent-gold/15 px-2.5 py-1 rounded inline-block">{selectedClient.cnpj || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Inscrição Estadual</span>
                      <span className="font-mono text-foreground">{selectedClient.inscricao_estadual || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Nome Fantasia</span>
                      <span className="font-semibold text-foreground">{selectedClient.nome_parceiro || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Razão Social</span>
                      <span className="font-semibold text-foreground">{selectedClient.razao_social || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Regras Comerciais */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">Estrutura Comercial e Matriz</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-foreground-secondary block">Rede / Matriz</span>
                      <span className="font-semibold text-foreground">{selectedClient.matriz || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Código da Matriz</span>
                      <span className="font-mono text-foreground font-semibold">{selectedClient.codigo_matriz || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Responsável (Gerente)</span>
                      <span className="font-semibold text-foreground">{selectedClient.responsavel || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Canal / Tipo de Parceiro</span>
                      <span className="font-semibold text-foreground">{selectedClient.tipo_parceiro || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Localização & Endereço */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">Localização</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <span className="text-xs text-foreground-secondary block">Endereço</span>
                      <span className="text-foreground">{selectedClient.endereco || "—"} {selectedClient.numero ? `, Nº ${selectedClient.numero}` : ""} {selectedClient.complemento ? `(${selectedClient.complemento})` : ""}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Cidade</span>
                      <span className="text-foreground">{selectedClient.cidade || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Estado / UF</span>
                      <span className="text-foreground font-bold">{selectedClient.uf || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">CEP</span>
                      <span className="font-mono text-foreground">{selectedClient.cep || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Financeiro e Cobrança */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">Dados de Faturamento e Fiscal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-foreground-secondary block">Condição de Pagamento</span>
                      <span className="text-foreground">{selectedClient.condicao_pagamento || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Classificação ICMS</span>
                      <span className="text-foreground">{selectedClient.classificacao_icms || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Retirar ST do Preço</span>
                      <span className="text-foreground">{selectedClient.retirar_st || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Empresa Preferencial</span>
                      <span className="text-foreground">{selectedClient.empresa_preferencial || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Geração de Boleto</span>
                      <span className="text-foreground">{selectedClient.tipo_geracao_boleto || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 5. NF-e e Faturamento */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">DANFE e NF-e</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-foreground-secondary block">Enviar DANFE por E-mail</span>
                      <span className="text-foreground">{selectedClient.enviar_danfe || "Não"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">E-mail de NF-e</span>
                      <span className="text-foreground font-semibold">{selectedClient.email_nfe || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Contatos da Rede */}
                {(selectedClient.emails_comercial || selectedClient.emails_trade || selectedClient.emails_abatimento) && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">Contatos de E-mail da Rede</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-xs text-foreground-secondary block">E-mails do Comercial/Comprador</span>
                        <span className="text-foreground text-xs break-all">{selectedClient.emails_comercial || "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-foreground-secondary block">E-mails do Trade</span>
                        <span className="text-foreground text-xs break-all">{selectedClient.emails_trade || "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-foreground-secondary block">E-mails de Abatimento</span>
                        <span className="text-foreground text-xs break-all">{selectedClient.emails_abatimento || "—"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Descontos e Histórico */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">Descontos e Histórico</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-foreground-secondary block">Desconto Contratual</span>
                      <span className="text-foreground font-semibold">{selectedClient.desconto_contratual || "—"}</span>
                      {selectedClient.data_vigor && (
                        <span className="text-[10px] text-foreground-secondary block font-mono">Vigor: {new Date(selectedClient.data_vigor).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Desconto Logístico</span>
                      <span className="text-foreground font-semibold">{selectedClient.desconto_logistico || "—"}</span>
                      {selectedClient.data_vigor_logistico && (
                        <span className="text-[10px] text-foreground-secondary block font-mono">Vigor: {new Date(selectedClient.data_vigor_logistico).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Desconto CD</span>
                      <span className="text-foreground font-semibold">{selectedClient.desconto_cd || "—"}</span>
                      {selectedClient.data_vigor_cd && (
                        <span className="text-[10px] text-foreground-secondary block font-mono">Vigor: {new Date(selectedClient.data_vigor_cd).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Desconto de Marketing</span>
                      <span className="text-foreground font-semibold">{selectedClient.desconto_marketing || "—"}</span>
                      {selectedClient.data_vigor_marketing && (
                        <span className="text-[10px] text-foreground-secondary block font-mono">Vigor: {new Date(selectedClient.data_vigor_marketing).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Desconto de Aniversário</span>
                      <span className="text-foreground font-semibold">{selectedClient.desconto_aniversario || "—"}</span>
                      {selectedClient.data_vigor_aniversario && (
                        <span className="text-[10px] text-foreground-secondary block font-mono">Vigor: {new Date(selectedClient.data_vigor_aniversario).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Desconto de Inauguração</span>
                      <span className="text-foreground font-semibold">{selectedClient.desconto_inauguracao || "—"}</span>
                      {selectedClient.data_vigor_inauguracao && (
                        <span className="text-[10px] text-foreground-secondary block font-mono">Vigor: {new Date(selectedClient.data_vigor_inauguracao).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 6. Dados Bancários */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-accent-gold text-xs uppercase tracking-wider border-b border-border pb-1">Dados Bancários</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-foreground-secondary block">Banco</span>
                      <span className="text-foreground font-semibold">{selectedClient.banco || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Agência</span>
                      <span className="font-mono text-foreground">{selectedClient.agencia || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary block">Conta</span>
                      <span className="font-mono text-foreground">{selectedClient.conta || "—"}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Actions Footer */}
              <div className="bg-background-elevated px-6 py-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedClient(null)}
                  className="h-10 px-5 bg-background border border-border hover:bg-background-elevated text-foreground rounded-lg font-semibold text-sm transition-all"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    router.push(`/config-financeiro/cadastro?codigo=${selectedClient.codigo}`);
                  }}
                  className="h-10 px-5 bg-accent-gold text-white hover:bg-accent-gold/90 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition-all shadow-[0_0_15px_rgba(200,169,110,0.2)]"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar Cadastro
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
