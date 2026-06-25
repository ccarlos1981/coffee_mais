"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  Coffee, 
  UploadCloud, 
  CheckCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  ArrowLeft, 
  Play, 
  PlusCircle, 
  HelpCircle,
  Sparkles,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

interface ParsedRow {
  cod_parceiro: string;
  rede: string;
  nome_pdv: string;
  endereco: string;
  cidade: string;
  uf: string;
  faturamento_mensal: number;
  canal: string;
  cnpj?: string;
  cluster?: string;
  supervisor?: string;
  latitude?: number;
  longitude?: number;
  isValid: boolean;
  errors: string[];
}

export default function PdvImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanColumnName = (col: string): string => {
    return col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const findColValue = (row: any, candidates: string[]): any => {
    for (const cand of candidates) {
      const cleanCand = cleanColumnName(cand);
      const matchedKey = Object.keys(row).find(
        k => cleanColumnName(k) === cleanCand
      );
      if (matchedKey !== undefined && row[matchedKey] !== null && row[matchedKey] !== "") {
        return row[matchedKey];
      }
    }
    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        setFile(droppedFile);
        parseFile(droppedFile);
      } else {
        setErrorMsg("Formato de arquivo inválido. Por favor envie XLSX ou CSV.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      parseFile(e.target.files[0]);
    }
  };

  const parseFile = (fileToParse: File) => {
    setParsing(true);
    setErrorMsg(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Falha ao ler o arquivo.");

        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          throw new Error("A planilha está vazia.");
        }

        const parsed: ParsedRow[] = [];

        rawJson.forEach((row, index) => {
          const rowErrors: string[] = [];

          // Required fields extraction
          const cod_parceiro_raw = findColValue(row, ["cod_parceiro", "codigo", "cod", "id", "cód parceiro", "cód. parceiro"]);
          const rede_raw = findColValue(row, ["rede", "matriz", "grupo", "matriz (rede)"]);
          const nome_pdv_raw = findColValue(row, ["nome_pdv", "nome", "cliente", "razao social", "nome parceiro", "nome fantasia"]);
          const endereco_raw = findColValue(row, ["endereco", "logradouro", "rua", "endereço"]);
          const cidade_raw = findColValue(row, ["cidade", "municipio"]);
          const uf_raw = findColValue(row, ["uf", "estado"]);
          const faturamento_mensal_raw = findColValue(row, ["faturamento_mensal", "faturamento", "receita"]);
          const canal_raw = findColValue(row, ["canal", "canal (parceiro)", "tipo canal"]);

          // Optional fields extraction
          const cnpj_raw = findColValue(row, ["cnpj", "c.n.p.j."]);
          const cluster_raw = findColValue(row, ["cluster", "cluster_canal", "canal_cluster"]);
          const supervisor_raw = findColValue(row, ["supervisor", "manager", "gerente"]);
          const latitude_raw = findColValue(row, ["latitude", "lat"]);
          const longitude_raw = findColValue(row, ["longitude", "lng", "lon"]);

          // Validation
          if (!cod_parceiro_raw) rowErrors.push("Código do parceiro/PDV está em branco.");
          if (!nome_pdv_raw) rowErrors.push("Nome do PDV está em branco.");
          if (!endereco_raw) rowErrors.push("Endereço está em branco.");
          if (!cidade_raw) rowErrors.push("Cidade está em branco.");
          
          let cleanUf = "";
          if (!uf_raw) {
            rowErrors.push("UF está em branco.");
          } else {
            cleanUf = String(uf_raw).trim().toUpperCase();
            if (cleanUf.length !== 2) {
              rowErrors.push("UF deve conter exatamente 2 caracteres (Ex: MG, SP).");
            }
          }

          let fatValue = 0;
          if (faturamento_mensal_raw !== null && faturamento_mensal_raw !== undefined && faturamento_mensal_raw !== "") {
            fatValue = Number(faturamento_mensal_raw);
            if (isNaN(fatValue) || fatValue < 0) {
              rowErrors.push("Faturamento mensal deve ser um valor numérico positivo.");
            }
          } else {
            rowErrors.push("Faturamento mensal está em branco.");
          }

          if (!canal_raw) rowErrors.push("Canal de venda está em branco.");
          if (!rede_raw) rowErrors.push("Rede/Matriz está em branco.");

          let latNum: number | undefined;
          let lngNum: number | undefined;
          
          if (latitude_raw !== null && latitude_raw !== "") {
            latNum = Number(latitude_raw);
            if (isNaN(latNum) || latNum < -90 || latNum > 90) {
              rowErrors.push("Latitude inválida.");
            }
          }
          if (longitude_raw !== null && longitude_raw !== "") {
            lngNum = Number(longitude_raw);
            if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
              rowErrors.push("Longitude inválida.");
            }
          }

          parsed.push({
            cod_parceiro: cod_parceiro_raw ? String(cod_parceiro_raw).replace(/\.0$/, "").trim() : "",
            rede: rede_raw ? String(rede_raw).trim() : "",
            nome_pdv: nome_pdv_raw ? String(nome_pdv_raw).trim() : "",
            endereco: endereco_raw ? String(endereco_raw).trim() : "",
            cidade: cidade_raw ? String(cidade_raw).trim() : "",
            uf: cleanUf,
            faturamento_mensal: fatValue,
            canal: canal_raw ? String(canal_raw).trim() : "",
            cnpj: cnpj_raw ? String(cnpj_raw).trim() : undefined,
            cluster: cluster_raw ? String(cluster_raw).trim() : undefined,
            supervisor: supervisor_raw ? String(supervisor_raw).trim() : undefined,
            latitude: latNum,
            longitude: lngNum,
            isValid: rowErrors.length === 0,
            errors: rowErrors
          });
        });

        setRows(parsed);
        setValidRows(parsed.filter(r => r.isValid));
        setInvalidRows(parsed.filter(r => !r.isValid));
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err?.message || "Erro ao ler o arquivo Excel/CSV.");
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Erro ao carregar o arquivo.");
      setParsing(false);
    };

    reader.readAsArrayBuffer(fileToParse);
  };

  const triggerImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/supervisor/pdv-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: validRows }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Erro durante o processamento no servidor.");
      }

      setResult(resData);
      setRows([]);
      setValidRows([]);
      setInvalidRows([]);
      setFile(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Erro de conexão com o servidor.");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const wsData = [
      {
        "cod_parceiro": "10254",
        "rede": "Supermercados BH",
        "nome_pdv": "Loja BH Centro",
        "endereco": "Av. Afonso Pena, 1500",
        "cidade": "Belo Horizonte",
        "uf": "MG",
        "faturamento_mensal": 45000.00,
        "canal": "AS 10 A 19 CHECK",
        "cnpj": "12.345.678/0001-90",
        "cluster": "A",
        "supervisor": "Rodrigo Santos",
        "latitude": -19.92345,
        "longitude": -43.93562
      }
    ];

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PDVs");
    XLSX.writeFile(wb, "template_importacao_pdvs.xlsx");
  };

  const handleReset = () => {
    setFile(null);
    setRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setResult(null);
    setErrorMsg(null);
  };

  return (
    <div className="flex h-screen bg-background font-sans transition-colors duration-300">
      <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95">
        <div className="p-8 max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <Link href="/supervisor/command-center" className="inline-flex items-center gap-1.5 text-xs text-neutral-450 hover:text-white transition-colors mb-3">
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao CommandCenter
              </Link>
              <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <Coffee className="w-8 h-8 text-amber-500" />
                Importação em Lote de PDVs
              </h1>
              <p className="text-neutral-400 mt-1">
                Cadastre e atualize pontos de venda em massa via planilha Excel ou CSV.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 text-xs font-bold text-amber-500 border border-amber-500/30 rounded-xl hover:bg-amber-500/10 transition-all flex items-center gap-1.5 shadow-md"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Baixar Modelo Excel
              </button>
            </div>
          </div>

          {/* Form / Alert Area */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Aviso de Erro</h4>
                <p className="mt-0.5 text-neutral-300">{errorMsg}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <h3 className="text-lg font-bold">Importação Concluída com Sucesso!</h3>
                  <p className="text-sm text-neutral-300 mt-1">
                    O job de auditoria com ID <code className="bg-neutral-900/50 px-1.5 py-0.5 rounded text-xs font-mono">{result.job_id}</code> foi finalizado.
                  </p>
                  
                  <div className="grid grid-cols-3 gap-6 mt-4 max-w-md">
                    <div className="bg-neutral-900/30 border border-neutral-850 p-3 rounded-xl text-center">
                      <span className="block text-[10px] text-neutral-500 uppercase font-black">Total Processado</span>
                      <span className="text-xl font-mono font-bold text-white mt-1 block">{result.total_rows}</span>
                    </div>
                    <div className="bg-emerald-950/20 border border-emerald-900/20 p-3 rounded-xl text-center">
                      <span className="block text-[10px] text-emerald-500/80 uppercase font-black">Sucesso (Upsert)</span>
                      <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">{result.valid_rows}</span>
                    </div>
                    <div className="bg-rose-950/20 border border-rose-900/20 p-3 rounded-xl text-center">
                      <span className="block text-[10px] text-rose-500/80 uppercase font-black">Inválidos / Erro</span>
                      <span className="text-xl font-mono font-bold text-rose-450 mt-1 block">{result.invalid_rows}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleReset}
                    className="mt-5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black rounded-xl transition-all shadow-md"
                  >
                    Nova Importação
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Area */}
          {!result && (
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Left Column: File Upload */}
              <div className="space-y-6">
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer relative overflow-hidden bg-neutral-900/10 ${
                    file ? "border-amber-500/40 bg-amber-500/5" : "border-neutral-800 hover:border-neutral-700"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  
                  <div className="space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-850 flex items-center justify-center border border-neutral-800 text-neutral-400">
                      <UploadCloud className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {file ? file.name : "Arraste sua planilha aqui"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Formatos aceitos: Excel (.xlsx, .xls) ou CSV
                      </p>
                    </div>
                    {file && (
                      <div className="text-[10px] bg-neutral-850 px-2.5 py-1 rounded-full border border-neutral-800 text-neutral-400 inline-block font-mono">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                </div>

                {/* Import Status card */}
                {rows.length > 0 && (
                  <div className="bg-neutral-900/30 border border-neutral-850 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Status de Validação
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 bg-neutral-900 border border-neutral-850 rounded-xl">
                        <span className="block text-[8px] text-emerald-500 uppercase font-black">Válidos (Sem Erros)</span>
                        <span className="text-2xl font-mono font-bold text-emerald-400 mt-1 block">{validRows.length}</span>
                      </div>
                      <div className="p-3 bg-neutral-900 border border-neutral-850 rounded-xl">
                        <span className="block text-[8px] text-rose-500 uppercase font-black">Com Impedimentos</span>
                        <span className="text-2xl font-mono font-bold text-rose-450 mt-1 block">{invalidRows.length}</span>
                      </div>
                    </div>

                    <div className="text-xs text-neutral-400 leading-relaxed bg-neutral-900/50 p-3 rounded-xl border border-neutral-850/50">
                      💡 Apenas as linhas marcadas como <b>válidas</b> serão importadas e salvas no banco de dados. Registros com o mesmo código de parceiro serão atualizados (Upsert).
                    </div>

                    <button
                      onClick={triggerImport}
                      disabled={validRows.length === 0 || importing}
                      className={`w-full py-3.5 px-4 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                        validRows.length > 0 && !importing
                          ? "bg-amber-500 text-neutral-950 hover:bg-amber-400 active:scale-98"
                          : "bg-neutral-850 text-neutral-500 border border-neutral-800 cursor-not-allowed"
                      }`}
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          IMPORTANDO...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          CONFIRMAR IMPORTAÇÃO ({validRows.length})
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Sheet Preview Table */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">Pré-visualização da Planilha</h3>
                  {rows.length > 0 && (
                    <span className="text-xs text-neutral-400 font-mono">
                      Linhas totais: {rows.length}
                    </span>
                  )}
                </div>

                <div className="bg-neutral-900/30 border border-neutral-850 rounded-2xl overflow-hidden shadow-2xl">
                  {rows.length === 0 ? (
                    <div className="p-16 text-center text-neutral-500 space-y-3">
                      <FileSpreadsheet className="w-12 h-12 text-neutral-600 mx-auto" />
                      <p className="text-sm">Nenhum arquivo processado.</p>
                      <p className="text-xs max-w-sm mx-auto">
                        Envie um arquivo usando o painel lateral para visualizar e validar os dados antes do upload final.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[450px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-neutral-950 border-b border-neutral-850 text-neutral-400 font-bold uppercase text-[9px] tracking-wider">
                            <th className="p-3">Status</th>
                            <th className="p-3">Cód.</th>
                            <th className="p-3">PDV</th>
                            <th className="p-3">Rede</th>
                            <th className="p-3">Cidade/UF</th>
                            <th className="p-3">Faturamento</th>
                            <th className="p-3">Erros / Detalhes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-850/50">
                          {rows.map((r, idx) => (
                            <tr 
                              key={idx} 
                              className={`hover:bg-neutral-900/40 transition-colors ${
                                r.isValid ? "text-neutral-300" : "bg-rose-500/[0.02] text-rose-200"
                              }`}
                            >
                              <td className="p-3">
                                {r.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-950">
                                    VÁLIDO
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-450 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-950">
                                    IMPEDIDO
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono font-bold text-white">{r.cod_parceiro}</td>
                              <td className="p-3 font-semibold truncate max-w-[120px]" title={r.nome_pdv}>
                                {r.nome_pdv}
                              </td>
                              <td className="p-3 truncate max-w-[100px]" title={r.rede}>{r.rede}</td>
                              <td className="p-3">{r.cidade} / {r.uf}</td>
                              <td className="p-3 font-mono text-neutral-400">
                                {r.faturamento_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </td>
                              <td className="p-3">
                                {r.isValid ? (
                                  <span className="text-neutral-500 italic">Pronto para upsert</span>
                                ) : (
                                  <span className="text-rose-400 block font-semibold leading-relaxed">
                                    ⚠️ {r.errors.join(" | ")}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
