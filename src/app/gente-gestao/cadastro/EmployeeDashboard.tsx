"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Loader2, 
  Save, 
  UserPlus, 
  Edit, 
  Trash2, 
  ArrowLeft, 
  X, 
  UserCheck, 
  UserX,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { upsertEmployee, deleteEmployee, importEmployeesInBulk } from "./actions";

interface Employee {
  id: string;
  nome_completo: string;
  cpf: string;
  identidade: string | null;
  data_nascimento: string | null;
  funcao: string | null;
  area_funcao: string | null;
  data_admissao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface EmployeeDashboardProps {
  employees: Employee[];
}

// Algoritmo de validação matemática de CPF
function isCpfValid(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  
  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) soma = soma + parseInt(clean.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(clean.substring(9, 10))) return false;
  
  soma = 0;
  for (let i = 1; i <= 10; i++) soma = soma + parseInt(clean.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(clean.substring(10, 11))) return false;
  
  return true;
}

// Converter string de data (DD/MM/AAAA) para formato do banco (YYYY-MM-DD)
function parseDateString(dateStr: any): string | null {
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
}

// Converter número serial do Excel para string de data YYYY-MM-DD
function excelSerialToDate(serial: number): string | null {
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
}

export function EmployeeDashboard({ employees }: EmployeeDashboardProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Form states
  const [id, setId] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [identidade, setIdentidade] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [funcao, setFuncao] = useState("");
  const [areaFuncao, setAreaFuncao] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [ativo, setAtivo] = useState(true);
  
  const [isPending, startTransition] = useTransition();

  // Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedEmployees, setParsedEmployees] = useState<{
    originalRow: any;
    data: {
      nome_completo: string;
      cpf: string;
      identidade: string | null;
      data_nascimento: string | null;
      funcao: string | null;
      area_funcao: string | null;
      data_admissao: string | null;
      ativo: boolean;
    };
    valid: boolean;
    errors: string[];
  }[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportPending, startImportTransition] = useTransition();

  // Exportar modelo Excel
  const downloadModelExcel = () => {
    try {
      const headers = [
        ["Nome completo", "CPF", "Identidade", "Data de Nascimento", "Função", "Área da função", "Data de admissão", "Ativo"]
      ];
      const exampleRow = [
        ["João da Silva", "123.456.789-00", "MG-12.345.678", "15/10/1990", "Supervisor", "Comercial", "01/02/2023", "Sim"]
      ];
      const data = [...headers, ...exampleRow];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo Cadastro");
      
      worksheet['!cols'] = [
        { wch: 30 }, // Nome completo
        { wch: 18 }, // CPF
        { wch: 18 }, // Identidade
        { wch: 20 }, // Data de Nascimento
        { wch: 20 }, // Função
        { wch: 20 }, // Área da função
        { wch: 20 }, // Data de admissão
        { wch: 10 }  // Ativo
      ];

      XLSX.writeFile(workbook, "modelo_cadastro_funcionarios.xlsx");
      toast.success("Modelo de planilha baixado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar modelo de planilha.");
    }
  };

  // Ler e processar arquivo Excel
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
          toast.error("A planilha está vazia.");
          return;
        }

        const headers = rawRows[0].map(h => String(h || "").trim().toLowerCase());
        
        const colIndices = {
          nome: headers.findIndex(h => h.includes("nome") || h.includes("completo")),
          cpf: headers.findIndex(h => h.includes("cpf")),
          identidade: headers.findIndex(h => h.includes("identidade") || h.includes("rg")),
          nascimento: headers.findIndex(h => h.includes("nascimento") || h.includes("nasc")),
          funcao: headers.findIndex(h => h.includes("função") || h.includes("funcao") || h.includes("cargo")),
          area: headers.findIndex(h => h.includes("área") || h.includes("area") || h.includes("depto") || h.includes("departamento")),
          admissao: headers.findIndex(h => h.includes("admissão") || h.includes("admissao")),
          ativo: headers.findIndex(h => h.includes("ativo"))
        };

        if (colIndices.nome === -1 || colIndices.cpf === -1) {
          toast.error("Cabeçalhos obrigatórios 'Nome completo' e 'CPF' não foram encontrados na primeira linha.");
          return;
        }

        const employeesToValidate: any[] = [];
        const seenCpfsInSheet = new Set<string>();

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) {
            continue;
          }

          const errors: string[] = [];
          
          const rawNome = colIndices.nome !== -1 ? row[colIndices.nome] : undefined;
          const rawCpf = colIndices.cpf !== -1 ? row[colIndices.cpf] : undefined;
          const rawIdentidade = colIndices.identidade !== -1 ? row[colIndices.identidade] : undefined;
          const rawNascimento = colIndices.nascimento !== -1 ? row[colIndices.nascimento] : undefined;
          const rawFuncao = colIndices.funcao !== -1 ? row[colIndices.funcao] : undefined;
          const rawArea = colIndices.area !== -1 ? row[colIndices.area] : undefined;
          const rawAdmissao = colIndices.admissao !== -1 ? row[colIndices.admissao] : undefined;
          const rawAtivo = colIndices.ativo !== -1 ? row[colIndices.ativo] : undefined;

          // 1. Validar Nome
          const nomeCompletoVal = rawNome ? String(rawNome).trim() : "";
          if (!nomeCompletoVal) {
            errors.push("Nome completo é obrigatório.");
          }

          // 2. Validar CPF
          const cpfVal = rawCpf ? String(rawCpf).replace(/\D/g, "") : "";
          if (!cpfVal) {
            errors.push("CPF é obrigatório.");
          } else if (cpfVal.length !== 11) {
            errors.push("CPF deve ter exatamente 11 números.");
          } else if (!isCpfValid(cpfVal)) {
            errors.push("CPF inválido.");
          } else if (seenCpfsInSheet.has(cpfVal)) {
            errors.push("CPF duplicado na planilha.");
          } else {
            seenCpfsInSheet.add(cpfVal);
          }

          // 3. Validar Data de Nascimento
          let nascimentoVal: string | null = null;
          if (rawNascimento !== undefined && rawNascimento !== null && rawNascimento !== "") {
            if (typeof rawNascimento === "number") {
              nascimentoVal = excelSerialToDate(rawNascimento);
            } else {
              nascimentoVal = parseDateString(rawNascimento);
            }
            if (!nascimentoVal) {
              errors.push("Data de Nascimento inválida. Use DD/MM/AAAA.");
            }
          }

          // 4. Validar Data de Admissão
          let admissaoVal: string | null = null;
          if (rawAdmissao !== undefined && rawAdmissao !== null && rawAdmissao !== "") {
            if (typeof rawAdmissao === "number") {
              admissaoVal = excelSerialToDate(rawAdmissao);
            } else {
              admissaoVal = parseDateString(rawAdmissao);
            }
            if (!admissaoVal) {
              errors.push("Data de admissão inválida. Use DD/MM/AAAA.");
            }
          }

          // 5. Validar Ativo (Sim/Não)
          let ativoVal = true;
          if (rawAtivo !== undefined && rawAtivo !== null && rawAtivo !== "") {
            const rawAtivoStr = String(rawAtivo).trim().toLowerCase();
            if (["não", "nao", "n", "false", "f", "0"].includes(rawAtivoStr)) {
              ativoVal = false;
            }
          }

          employeesToValidate.push({
            originalRow: row,
            data: {
              nome_completo: nomeCompletoVal,
              cpf: cpfVal,
              identidade: rawIdentidade ? String(rawIdentidade).trim() : null,
              data_nascimento: nascimentoVal,
              funcao: rawFuncao ? String(rawFuncao).trim() : null,
              area_funcao: rawArea ? String(rawArea).trim() : null,
              data_admissao: admissaoVal,
              ativo: ativoVal
            },
            valid: errors.length === 0,
            errors
          });
        }

        setParsedEmployees(employeesToValidate);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao ler ou processar o arquivo Excel.");
      }
    };

    reader.readAsBinaryString(file);
  };

  // Enviar importação em lote
  const handleConfirmImport = () => {
    const validEmployees = parsedEmployees
      .filter(emp => emp.valid)
      .map(emp => emp.data);

    if (validEmployees.length === 0) {
      toast.error("Nenhum registro válido para importar.");
      return;
    }

    startImportTransition(async () => {
      const res = await importEmployeesInBulk(validEmployees);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || "Importação concluída com sucesso!");
        setIsImportModalOpen(false);
        setParsedEmployees([]);
        setImportFileName("");
        router.refresh();
      }
    });
  };

  // CPF formatter helper
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Mask: 000.000.000-00
    if (value.length > 9) {
      value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, "$1.$2.$3-$4");
    } else if (value.length > 6) {
      value = value.replace(/^(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    } else if (value.length > 3) {
      value = value.replace(/^(\d{3})(\d{1,3})/, "$1.$2");
    }
    setCpf(value);
  };

  // Date formatter (YYYY-MM-DD to DD/MM/YYYY)
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  // Open modal for creating new employee
  const handleNewEmployee = () => {
    setSelectedEmployee(null);
    setId("");
    setNomeCompleto("");
    setCpf("");
    setIdentidade("");
    setDataNascimento("");
    setFuncao("");
    setAreaFuncao("");
    setDataAdmissao("");
    setAtivo(true);
    setIsModalOpen(true);
  };

  // Open modal for editing employee
  const handleEditEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setId(emp.id);
    setNomeCompleto(emp.nome_completo);
    
    // Formatar CPF
    let formattedCpf = emp.cpf;
    if (formattedCpf.length === 11) {
      formattedCpf = formattedCpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    setCpf(formattedCpf);
    
    setIdentidade(emp.identidade || "");
    setDataNascimento(emp.data_nascimento || "");
    setFuncao(emp.funcao || "");
    setAreaFuncao(emp.area_funcao || "");
    setDataAdmissao(emp.data_admissao || "");
    setAtivo(emp.ativo);
    setIsModalOpen(true);
  };

  // Open delete confirmation
  const handleDeleteTrigger = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the edit modal
    setSelectedEmployee(emp);
    setIsDeleteConfirmOpen(true);
  };

  // Submit Form Action
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nomeCompleto.trim()) {
      toast.error("Por favor, insira o nome completo.");
      return;
    }
    
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF inválido. Deve conter exatamente 11 números.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      if (id) formData.append("id", id);
      formData.append("nome_completo", nomeCompleto);
      formData.append("cpf", cleanCpf);
      formData.append("identidade", identidade);
      formData.append("data_nascimento", dataNascimento);
      formData.append("funcao", funcao);
      formData.append("area_funcao", areaFuncao);
      formData.append("data_admissao", dataAdmissao);
      formData.append("ativo", ativo ? "true" : "false");

      const res = await upsertEmployee(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || "Funcionário salvo com sucesso!");
        setIsModalOpen(false);
        router.refresh();
      }
    });
  };

  // Delete Action
  const handleDeleteConfirm = () => {
    if (!selectedEmployee) return;
    
    startTransition(async () => {
      const res = await deleteEmployee(selectedEmployee.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || "Funcionário excluído!");
        setIsDeleteConfirmOpen(false);
        setSelectedEmployee(null);
        router.refresh();
      }
    });
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.cpf.includes(searchTerm.replace(/\D/g, ""));
      
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && emp.ativo) ||
      (statusFilter === "inactive" && !emp.ativo);
      
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Back Button */}
        <button 
          onClick={() => router.push("/")} 
          className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors font-medium text-sm w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </button>

        {/* Header Section */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-linear-to-br from-teal-600 to-teal-800 text-white">
                <UserCheck className="w-6 h-6" />
              </span>
              Cadastro de Funcionários
            </h1>
            <p className="text-foreground-secondary text-sm mt-1">
              Gerencie a base de funcionários da empresa, dados contratuais e cargos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={downloadModelExcel}
              style={{
                padding: "10px 20px",
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer"
              }}
              className="transition-all hover:bg-foreground/10 active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Modelo Planilha
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              style={{
                padding: "10px 20px",
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer"
              }}
              className="transition-all hover:bg-foreground/10 active:scale-[0.98]"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              Importar Planilha
            </button>

            <button
              onClick={handleNewEmployee}
              style={{
                padding: "10px 20px",
                background: "var(--accent-gold)",
                color: "#000",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(200, 169, 110, 0.3)",
                cursor: "pointer"
              }}
              className="transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4" />
              Incluir Funcionário
            </button>
          </div>
        </header>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background-card border border-border rounded-xl text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-colors"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2 p-1 bg-background-card border border-border rounded-xl w-full md:w-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === "all" 
                  ? "bg-foreground/10 text-foreground" 
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              Todos ({employees.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === "active" 
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              Ativos ({employees.filter(e => e.ativo).length})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === "inactive" 
                  ? "bg-red-500/15 text-red-400 border border-red-500/20" 
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              Inativos ({employees.filter(e => !e.ativo).length})
            </button>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-background-card border border-border rounded-2xl overflow-x-auto shadow-2xl">
          {filteredEmployees.length === 0 ? (
            <div className="p-12 text-center text-foreground-secondary flex flex-col items-center justify-center gap-3">
              <UserX className="w-12 h-12 text-foreground-muted" />
              <div>
                <p className="font-semibold text-lg text-foreground">Nenhum funcionário encontrado</p>
                <p className="text-sm text-foreground-muted mt-1">
                  {employees.length === 0 
                    ? "Comece incluindo o primeiro funcionário no botão no topo."
                    : "Tente mudar os termos da busca ou filtros."}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-max text-xs">
              <thead>
                <tr className="bg-background-elevated border-b border-border">
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider">
                    Nome completo
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider text-center">
                    CPF
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider text-center">
                    Identidade (RG)
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider text-center">
                    Nascimento
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider">
                    Função
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider">
                    Área
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider text-center">
                    Admissão
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider text-center">
                    Ativo?
                  </th>
                  <th className="p-4 font-bold text-foreground text-[10px] uppercase tracking-wider text-center">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((emp) => (
                  <tr 
                    key={emp.id} 
                    className="hover:bg-foreground/5 transition-colors cursor-pointer group"
                    onClick={() => handleEditEmployee(emp)}
                  >
                    <td className="p-4 font-semibold text-foreground group-hover:text-accent-gold transition-colors">
                      {emp.nome_completo}
                    </td>
                    <td className="p-4 text-center text-foreground-secondary font-mono">
                      {emp.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}
                    </td>
                    <td className="p-4 text-center text-foreground-secondary">
                      {emp.identidade || "-"}
                    </td>
                    <td className="p-4 text-center text-foreground-secondary">
                      {formatDate(emp.data_nascimento)}
                    </td>
                    <td className="p-4 text-foreground-secondary">
                      {emp.funcao || "-"}
                    </td>
                    <td className="p-4 text-foreground-secondary">
                      {emp.area_funcao || "-"}
                    </td>
                    <td className="p-4 text-center text-foreground-secondary">
                      {formatDate(emp.data_admissao)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        emp.ativo 
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                          : "bg-foreground/5 text-foreground-muted border border-border"
                      }`}>
                        {emp.ativo ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditEmployee(emp)}
                          className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-foreground/5 transition-all cursor-pointer"
                          title="Editar Funcionário"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTrigger(emp, e)}
                          className="p-1.5 rounded-lg text-foreground-secondary hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Excluir Funcionário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* CRUD Upsert Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="w-full max-w-lg bg-background-card border border-border rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-accent-gold/15 text-accent-gold">
                  <UserPlus className="w-4 h-4" />
                </span>
                {selectedEmployee ? "Editar Funcionário" : "Incluir Funcionário"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-foreground-secondary hover:text-foreground p-1.5 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  disabled={isPending}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                    CPF <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    disabled={isPending}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                    Identidade (RG)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MG-12.345.678"
                    value={identidade}
                    onChange={(e) => setIdentidade(e.target.value)}
                    disabled={isPending}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    disabled={isPending}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                    disabled={isPending}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                    Função (Cargo)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Supervisor"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    disabled={isPending}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                    Área da Função
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Comercial"
                    value={areaFuncao}
                    onChange={(e) => setAreaFuncao(e.target.value)}
                    disabled={isPending}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <label className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-accent-gold/30 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => setAtivo(e.target.checked)}
                    disabled={isPending}
                    className="w-4 h-4 text-accent-gold border-border rounded focus:ring-accent-gold/20 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-foreground">
                    Funcionário ativo no quadro?
                  </span>
                </label>
              </div>

              {/* Footer */}
              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold text-foreground-secondary hover:bg-foreground/5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    padding: "8px 18px",
                    background: "var(--accent-gold)",
                    color: "#000",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: isPending ? 0.6 : 1,
                    cursor: isPending ? "not-allowed" : "pointer"
                  }}
                  className="transition-opacity hover:opacity-95"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-background-card border border-border rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/10 text-red-400 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Excluir Funcionário?</h3>
                <p className="text-sm text-foreground-secondary mt-1">
                  Tem certeza que deseja excluir <strong>{selectedEmployee?.nome_completo}</strong>? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setSelectedEmployee(null);
                }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-semibold text-foreground-secondary hover:bg-foreground/5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="px-4 py-2 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="w-full max-w-4xl bg-background-card border border-border rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-accent-gold/15 text-accent-gold">
                  <Upload className="w-4 h-4" />
                </span>
                Importar Funcionários em Lote
              </h2>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedEmployees([]);
                  setImportFileName("");
                }}
                className="text-foreground-secondary hover:text-foreground p-1.5 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-accent-gold/30 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-background/30 hover:bg-foreground/[0.02] flex flex-col items-center justify-center gap-3"
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImportFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-foreground-muted" />
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {importFileName ? importFileName : "Clique para selecionar ou arraste sua planilha aqui"}
                  </p>
                  <p className="text-xs text-foreground-muted mt-1">
                    Suporta arquivos Excel (.xlsx, .xls) baseados no modelo.
                  </p>
                </div>
              </div>

              {parsedEmployees.length > 0 && (
                <div className="space-y-4">
                  {/* Resumo */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-foreground/5 border border-border rounded-xl text-center">
                      <p className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">Total Lidas</p>
                      <p className="text-xl font-bold text-foreground mt-0.5">{parsedEmployees.length}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Válidas</p>
                      <p className="text-xl font-bold text-emerald-400 mt-0.5">{parsedEmployees.filter(e => e.valid).length}</p>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Com Erros</p>
                      <p className="text-xl font-bold text-red-400 mt-0.5">{parsedEmployees.filter(e => !e.valid).length}</p>
                    </div>
                  </div>

                  {/* Tabela de Pré-visualização */}
                  <div className="border border-border rounded-xl overflow-hidden bg-background/50">
                    <div className="max-h-[35vh] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-background-elevated border-b border-border sticky top-0">
                            <th className="p-3 font-semibold text-foreground text-[10px] uppercase">Status</th>
                            <th className="p-3 font-semibold text-foreground text-[10px] uppercase">Nome</th>
                            <th className="p-3 font-semibold text-foreground text-[10px] uppercase">CPF</th>
                            <th className="p-3 font-semibold text-foreground text-[10px] uppercase">Cargo</th>
                            <th className="p-3 font-semibold text-foreground text-[10px] uppercase">Erros/Observações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {parsedEmployees.map((emp, index) => (
                            <tr key={index} className="hover:bg-foreground/[0.02]">
                              <td className="p-3 whitespace-nowrap">
                                {emp.valid ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" /> Válido
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-full">
                                    <XCircle className="w-3 h-3" /> Erro
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-medium text-foreground">
                                {emp.data.nome_completo || <span className="text-red-400 italic">Ausente</span>}
                              </td>
                              <td className="p-3 text-foreground-secondary font-mono">
                                {emp.data.cpf ? emp.data.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : <span className="text-red-400 italic">Ausente</span>}
                              </td>
                              <td className="p-3 text-foreground-secondary">
                                {emp.data.funcao || "-"}
                              </td>
                              <td className="p-3">
                                {emp.valid ? (
                                  <span className="text-foreground-muted">Pronto para importar</span>
                                ) : (
                                  <ul className="list-disc pl-4 text-red-400 space-y-0.5">
                                    {emp.errors.map((err, errIdx) => (
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
            <footer className="p-5 border-t border-border flex justify-end gap-3 bg-background-elevated/30">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedEmployees([]);
                  setImportFileName("");
                }}
                disabled={isImportPending}
                className="px-4 py-2 text-sm font-semibold text-foreground-secondary hover:bg-foreground/5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImportPending || parsedEmployees.length === 0 || parsedEmployees.filter(e => e.valid).length === 0}
                style={{
                  padding: "8px 18px",
                  background: "var(--accent-gold)",
                  color: "#000",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: (isImportPending || parsedEmployees.length === 0 || parsedEmployees.filter(e => e.valid).length === 0) ? 0.5 : 1,
                  cursor: (isImportPending || parsedEmployees.length === 0 || parsedEmployees.filter(e => e.valid).length === 0) ? "not-allowed" : "pointer"
                }}
                className="transition-opacity hover:opacity-95"
              >
                {isImportPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar ({parsedEmployees.filter(e => e.valid).length}) Registros
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
