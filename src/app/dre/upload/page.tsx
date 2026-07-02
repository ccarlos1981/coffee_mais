"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, BarChart3, ArrowLeft, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { importarExcelDRE } from "@/app/dre/historico/lancar/actions";

const ALIASES: Record<string, string[]> = {
  ano: ["ano", "exercicio", "ano_referencia"],
  mes: ["mes", "periodo", "mes_referencia"],
  codigo_matriz: ["rede", "codigo_matriz", "matriz", "cliente", "matriz_codigo"],
  gerente_id: ["gerente", "gerente_id", "comercial", "gestor"],
  canal_id: ["canal", "canal_id", "canal_venda"],
  sku_id: ["sku", "sku_id", "produto", "codigo_produto"],
  familia_id: ["familia", "familia_id", "categoria", "grupo"],
  volume: ["volume", "volume (tons)", "tons", "quantidade", "qtde", "tons_vendidos"],
  receita_bruta: ["receita bruta", "faturamento", "fat r$", "receita", "faturamento bruto", "fat"],
  impostos: ["impostos", "imp", "imposto", "deducoes"],
  investimento_comercial: ["investimento comercial", "desc + bonif + acord", "investimento", "valor contrato", "descontos", "bonificacoes", "acordos"],
  custo_produtos: ["custo de produtos", "custo produtos", "cmv", "cpv"],
  frete: ["frete", "fret", "vlr_frete"],
  dga: ["dga", "despesas gerais", "dga total", "dga_total"],
  custo_rede: ["custo rede", "custo da rede", "custo_rede"],
};

function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s$]/g, "")
    .trim();
}

function findField(header: string): string | null {
  const norm = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (field === norm || aliases.some(a => normalizeHeader(a) === norm)) {
      return field;
    }
  }
  return null;
}

function parseNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/\./g, "").replace(",", ".").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export default function DREUploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "parsing" | "preview" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [normalizedRows, setNormalizedRows] = useState<any[]>([]);
  const [uploadStats, setUploadStats] = useState<any>(null);
  
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setStatus("parsing");
    setErrorMsg("");
    setFileName(file.name);
    setPreviewRows([]);
    setNormalizedRows([]);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      if (!rawJson || rawJson.length === 0) {
        throw new Error("Planilha vazia ou sem dados legíveis.");
      }

      // Mapear cabeçalhos
      const headers = Object.keys(rawJson[0]);
      const mapping: Record<string, string> = {};
      headers.forEach(h => {
        const field = findField(h);
        if (field) {
          mapping[h] = field;
        }
      });

      // Validar campos mínimos
      if (!Object.values(mapping).includes("codigo_matriz") && !Object.values(mapping).includes("gerente_id")) {
        throw new Error("Não foi possível identificar colunas de dimensão essenciais (ex: Rede ou Gerente).");
      }

      // Normalizar linhas
      let detectedAno = new Date().getFullYear();
      let detectedMes = new Date().getMonth() + 1;
      let hasDateInRows = false;

      const normalized = rawJson.map(row => {
        const normRow: any = {
          codigo_matriz: "ALL",
          gerente_id: "ALL",
          canal_id: "ALL",
          sku_id: "ALL",
          familia_id: "ALL",
          volume: 0,
          receita_bruta: 0,
          impostos: 0,
          investimento_comercial: 0,
          custo_produtos: 0,
          frete: 0,
          dga: 0,
          custo_rede: 0,
        };

        Object.entries(row).forEach(([rawHeader, val]) => {
          const field = mapping[rawHeader];
          if (!field) return;

          if (["ano", "mes"].includes(field)) {
            const num = Math.floor(parseNumber(val));
            normRow[field] = num;
            if (field === "ano" && num >= 2020 && num <= 2035) {
              detectedAno = num;
              hasDateInRows = true;
            }
            if (field === "mes" && num >= 1 && num <= 12) {
              detectedMes = num;
              hasDateInRows = true;
            }
          } else if (["codigo_matriz", "gerente_id", "canal_id", "sku_id", "familia_id"].includes(field)) {
            normRow[field] = String(val).trim() || "ALL";
          } else {
            normRow[field] = parseNumber(val);
          }
        });

        return normRow;
      });

      setPreviewRows(rawJson.slice(0, 5));
      setNormalizedRows(normalized);
      if (hasDateInRows) {
        setAno(detectedAno);
        setMes(detectedMes);
      }
      setStatus("preview");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erro desconhecido ao ler a planilha.");
      setStatus("error");
    }
  }, []);

  const triggerUpload = async () => {
    if (normalizedRows.length === 0) return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const response = await importarExcelDRE({
        ano,
        mes,
        filename: fileName,
        rawRows: previewRows, // enviamos apenas o preview pro raw log de staging para testes/performance
        normalizedRows,
      });

      if (response.success) {
        setUploadStats(response);
        setStatus("success");
      } else {
        throw new Error("Ocorreu um erro no processamento do banco.");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Falha ao enviar dados de DRE.");
      setStatus("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <nav className="cm-navbar px-6 py-4 flex items-center justify-between border-b border-border bg-elevated/50">
        <div className="flex items-center gap-3">
          <Link href="/dre" className="text-muted hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-bold text-lg text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-gold" /> Upload DRE Comercial
          </span>
        </div>
        <ThemeToggle />
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        {status === "idle" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragging ? "border-gold bg-gold/5" : "border-border hover:border-gold bg-elevated"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
              }}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Upload className="w-12 h-12 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-bold">Importe sua Planilha DRE</h3>
            <p className="text-sm text-muted mt-2 max-w-md mx-auto">
              Arraste e solte o arquivo Excel (.xlsx, .xls) ou CSV aqui, ou clique para navegar nos arquivos.
            </p>
            <div className="mt-6 inline-flex text-xs bg-gold/10 text-gold px-3 py-1.5 rounded-full font-mono">
              Fase 1: BigQuery (Faturamento) + Excel (Custos)
            </div>
          </div>
        )}

        {status === "parsing" && (
          <div className="bg-elevated border border-border p-12 rounded-2xl text-center space-y-4">
            <Loader2 className="w-10 h-10 text-gold animate-spin mx-auto" />
            <h3 className="text-lg font-bold">Lendo planilha...</h3>
            <p className="text-sm text-muted">Aguarde enquanto mapeamos as colunas e dados.</p>
          </div>
        )}

        {status === "preview" && (
          <div className="bg-elevated border border-border p-6 rounded-2xl space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Preview da Importação</h3>
                <p className="text-sm text-muted">Mapeamento concluído com sucesso. Confirme os dados abaixo.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStatus("idle")}
                  className="px-4 py-2 border border-border hover:bg-border/30 rounded-xl text-sm"
                >
                  Substituir Arquivo
                </button>
                <button
                  onClick={triggerUpload}
                  className="px-4 py-2 bg-gold hover:bg-gold-hover text-black font-bold rounded-xl text-sm transition-colors"
                >
                  Confirmar e Processar
                </button>
              </div>
            </div>

            {/* Filtro / Configuração de Mês/Ano */}
            <div className="grid grid-cols-2 gap-4 max-w-xs bg-background/50 p-4 border border-border/50 rounded-xl">
              <div>
                <label className="text-xs text-muted block mb-1">Ano Referência</label>
                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className="w-full bg-elevated border border-border/80 px-2.5 py-1.5 rounded-lg text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Mês Referência</label>
                <input
                  type="number"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  min={1}
                  max={12}
                  className="w-full bg-elevated border border-border/80 px-2.5 py-1.5 rounded-lg text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-background/80 text-muted border-b border-border">
                    {Object.keys(previewRows[0] || {}).map((header, idx) => (
                      <th key={idx} className="p-3 font-semibold whitespace-nowrap">
                        {header}
                        {findField(header) && (
                          <span className="block text-[10px] text-gold font-mono uppercase mt-0.5">
                            → {findField(header)}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-border last:border-0 hover:bg-background/20">
                      {Object.values(row).map((val: any, cIdx) => (
                        <td key={cIdx} className="p-3 text-foreground whitespace-nowrap font-mono">
                          {typeof val === "number" ? val.toLocaleString("pt-BR") : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted text-right">Exibindo as primeiras 5 linhas de {normalizedRows.length} encontradas.</p>
          </div>
        )}

        {status === "submitting" && (
          <div className="bg-elevated border border-border p-12 rounded-2xl text-center space-y-4">
            <Loader2 className="w-10 h-10 text-gold animate-spin mx-auto" />
            <h3 className="text-lg font-bold">Processando DRE...</h3>
            <p className="text-sm text-muted">Gravando staging, executando normalização e aplicando versionamento.</p>
          </div>
        )}

        {status === "success" && (
          <div className="bg-elevated border border-border p-8 rounded-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Importação Concluída com Sucesso!</h3>
              <p className="text-sm text-muted">O arquivo foi parseado e consolidado nas bases oficiais.</p>
            </div>

            <div className="max-w-md mx-auto grid grid-cols-3 gap-3 bg-background/50 border border-border/50 p-4 rounded-xl text-left text-xs font-mono">
              <div>
                <span className="text-muted block">Processadas:</span>
                <span className="text-foreground font-bold">{uploadStats?.processed}</span>
              </div>
              <div>
                <span className="text-muted block">Inseridas:</span>
                <span className="text-green-400 font-bold">+{uploadStats?.inserted}</span>
              </div>
              <div>
                <span className="text-muted block">Atualizadas:</span>
                <span className="text-blue-400 font-bold">~{uploadStats?.updated}</span>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Link
                href="/dre/historico"
                className="px-4 py-2 border border-border hover:bg-border/30 rounded-xl text-sm flex items-center gap-1.5"
              >
                Ver Histórico DRE
              </Link>
              <button
                onClick={() => setStatus("idle")}
                className="px-4 py-2 bg-gold hover:bg-gold-hover text-black font-bold rounded-xl text-sm transition-colors"
              >
                Fazer Novo Upload
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="bg-elevated border border-border p-8 rounded-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-red-400">Falha na Importação</h3>
              <p className="text-sm text-red-500/80">{errorMsg}</p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setStatus("idle")}
                className="px-4 py-2 bg-gold hover:bg-gold-hover text-black font-bold rounded-xl text-sm transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
