"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { DRE_LINHAS, DREItemInput } from "../constants";

interface ParsedMonth {
  mes: number;
  items: DREItemInput[];
}

interface ExcelParserProps {
  onParsed: (result: { meses: ParsedMonth[]; ano: number }) => void;
}

// Mapeamento fuzzy: variações de nomes do Excel → linha_codigo canônico
const LABEL_MAP: Record<string, string> = {
  "volume (tons)":        "volume_tons",
  "volume":               "volume_tons",
  "tons":                 "volume_tons",
  "receita bruta":        "receita_bruta",
  "impostos":             "impostos",
  "invest. comerciais":   "invest_comerciais",
  "investimentos comerciais": "invest_comerciais",
  "invest comerciais":    "invest_comerciais",
  "receita líquida":      "receita_liquida",
  "receita liquida":      "receita_liquida",
  "custo de produtos":    "custo_produtos",
  "custo produtos":       "custo_produtos",
  "fretes":               "fretes",
  "desp. de exportação":  "desp_exportacao",
  "mrg de contribuição":  "mrg_contribuicao",
  "mrg contribuição":     "mrg_contribuicao",
  "margem de contribuição":"mrg_contribuicao",
  "ggf":                  "ggf",
  "depreciação":          "depreciacao",
  "depreciacao":          "depreciacao",
  "armazenagem":          "armazenagem",
  "mrg bruta":            "mrg_bruta",
  "margem bruta":         "mrg_bruta",
  "desp. comerciais":     "desp_comerciais",
  "despesas comerciais":  "desp_comerciais",
  "marketing":            "marketing",
  "mrg de mercado":       "mrg_mercado",
  "margem de mercado":    "mrg_mercado",
  "ebitda":               "mrg_mercado",
  // Indicadores
  "preço/kg":             "preco_kg",
  "preco/kg":             "preco_kg",
  "% impostos":           "pct_impostos",
  "% investimentos":      "pct_invest",
  "% invest comerciais":  "pct_invest",
  "custo/kg":             "custo_kg",
  "frete/kg":             "frete_kg",
  "frete kg":             "frete_kg",
  "mc/kg":                "mc_kg",
  "%mc":                  "pct_mc",
  "% mc":                 "pct_mc",
  "ggf/kg":               "ggf_kg",
  "armazenagem/kg":       "armazenagem_kg",
  "mb/kg":                "mb_kg",
  "% mb":                 "pct_mb",
  "%mb":                  "pct_mb",
  "% despesas comerciais": "pct_desp_com",
  "% marketing":          "pct_marketing",
  "mm/kg":                "mm_kg",
  "% mm":                 "pct_mm",
  "%mm":                  "pct_mm",
  "ebitda/kg":            "ebitda_kg",
  "% ebitda":             "pct_ebitda",
  "%ebitda":              "pct_ebitda",
};

const MESES_ABREV = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findCodigo(raw: string): string | null {
  const normalized = normalizeLabel(raw);
  return LABEL_MAP[normalized] ?? null;
}

function findLinhaByCode(codigo: string) {
  return DRE_LINHAS.find((l) => l.codigo === codigo);
}

function parseNumero(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const str = String(val).replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

export default function ExcelParser({ onParsed }: ExcelParserProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "parsing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ label: string; values: (number | null)[] }[]>([]);
  const [parsedAno, setParsedAno] = useState<number>(new Date().getFullYear());
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setStatus("parsing");
    setErrorMsg("");
    setFileName(file.name);
    setPreview([]);

    try {
      // Importação dinâmica para não aumentar o bundle do servidor
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });

      // Usa a primeira sheet
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      if (!raw || raw.length < 2) {
        throw new Error("Planilha vazia ou sem dados suficientes.");
      }

      // Detectar cabeçalho: linha que contém "JAN" ou "FEV"
      let headerRowIdx = -1;
      let colMes: number[] = [];
      let anoDetectado = new Date().getFullYear();

      for (let r = 0; r < Math.min(10, raw.length); r++) {
        const row = raw[r] as (string | null)[];
        const found: number[] = [];
        for (let c = 0; c < row.length; c++) {
          const cell = String(row[c] ?? "").toLowerCase().trim();
          if (MESES_ABREV.includes(cell)) found.push(c);
        }
        if (found.length >= 3) {
          headerRowIdx = r;
          colMes = found;

          // Tentar detectar o ano em alguma célula da mesma linha ou anterior
          for (let c2 = 0; c2 < row.length; c2++) {
            const possible = parseInt(String(row[c2] ?? ""));
            if (possible >= 2020 && possible <= 2035) {
              anoDetectado = possible;
              break;
            }
          }
          // Tentar na linha anterior
          if (r > 0) {
            const prevRow = raw[r - 1] as (string | null)[];
            for (let c2 = 0; c2 < prevRow.length; c2++) {
              const possible = parseInt(String(prevRow[c2] ?? ""));
              if (possible >= 2020 && possible <= 2035) {
                anoDetectado = possible;
                break;
              }
            }
          }
          break;
        }
      }

      if (headerRowIdx === -1 || colMes.length === 0) {
        throw new Error(
          "Não encontrei os cabeçalhos de mês (JAN, FEV...) na planilha. " +
          "Verifique se a planilha tem a mesma estrutura do modelo."
        );
      }

      // Mapear colunas de meses para índice 0-11
      const headerRow = raw[headerRowIdx] as (string | null)[];
      const mesColMap: { mesIdx: number; colIdx: number }[] = colMes.map((c) => {
        const label = String(headerRow[c] ?? "").toLowerCase().trim();
        const mesIdx = MESES_ABREV.indexOf(label);
        return { mesIdx, colIdx: c };
      });

      // Parsear cada linha de dados abaixo do cabeçalho
      const mesesData: { [mes: number]: DREItemInput[] } = {};
      const previewRows: { label: string; values: (number | null)[] }[] = [];

      for (let r = headerRowIdx + 1; r < raw.length; r++) {
        const row = raw[r] as (string | null)[];
        const labelCell = String(row[0] ?? "").trim();
        if (!labelCell) continue;

        const codigo = findCodigo(labelCell);
        if (!codigo) continue; // linha não reconhecida, pular

        const linhaInfo = findLinhaByCode(codigo);
        if (!linhaInfo) continue;

        const values: (number | null)[] = Array(12).fill(null);

        for (const { mesIdx, colIdx } of mesColMap) {
          if (mesIdx < 0 || mesIdx > 11) continue;
          const val = parseNumero(row[colIdx]);
          values[mesIdx] = val;

          if (!mesesData[mesIdx + 1]) mesesData[mesIdx + 1] = [];

          // Evitar duplicatas (mesmo código)
          const existing = mesesData[mesIdx + 1].find((i) => i.linha_codigo === codigo);
          if (!existing) {
            mesesData[mesIdx + 1].push({
              linha_codigo: codigo,
              linha_nome: linhaInfo.nome,
              valor: val,
              ordem: linhaInfo.ordem,
            });
          } else {
            existing.valor = val;
          }
        }

        previewRows.push({ label: linhaInfo.nome, values });
      }

      const mesesArray = Object.entries(mesesData).map(([mes, items]) => ({
        mes: parseInt(mes),
        items,
      }));

      if (mesesArray.length === 0) {
        throw new Error("Nenhum dado reconhecido. Verifique se os rótulos das linhas correspondem ao modelo.");
      }

      setPreview(previewRows.slice(0, 8)); // Mostrar apenas primeiras 8 para preview
      setParsedAno(anoDetectado);
      setStatus("success");
      onParsed({ meses: mesesArray, ano: anoDetectado });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao parsear o arquivo.";
      setErrorMsg(msg);
      setStatus("error");
    }
  }, [onParsed]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStatus("idle");
    setFileName("");
    setPreview([]);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="dre-excel-parser">
      {/* Drop Zone */}
      {status === "idle" || status === "error" ? (
        <div
          className={`dre-drop-zone ${isDragging ? "dre-drop-zone--active" : ""} ${status === "error" ? "dre-drop-zone--error" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="dre-file-input-hidden"
            onChange={handleInputChange}
          />
          <FileSpreadsheet size={40} className="dre-drop-icon" />
          <p className="dre-drop-title">
            {isDragging ? "Solte o arquivo aqui" : "Arraste o Excel ou clique para selecionar"}
          </p>
          <p className="dre-drop-sub">Aceita .xlsx, .xls, .csv</p>

          {status === "error" && (
            <div className="dre-error-msg">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Parsing */}
      {status === "parsing" && (
        <div className="dre-parsing-state">
          <div className="dre-spinner" />
          <p>Analisando <strong>{fileName}</strong>...</p>
        </div>
      )}

      {/* Success + Preview */}
      {status === "success" && (
        <div className="dre-success-state">
          <div className="dre-success-header">
            <CheckCircle2 size={20} className="dre-success-icon" />
            <div>
              <p className="dre-success-title">
                <strong>{fileName}</strong> — Ano {parsedAno} detectado
              </p>
              <p className="dre-success-sub">
                Dados extraídos com sucesso. Revise o preview abaixo.
              </p>
            </div>
            <button className="dre-reset-btn" onClick={reset} title="Remover arquivo">
              <Trash2 size={16} />
            </button>
          </div>

          {preview.length > 0 && (
            <div className="dre-preview-table-wrap">
              <table className="dre-preview-table">
                <thead>
                  <tr>
                    <th>Linha</th>
                    {MESES_ABREV.map((m) => <th key={m}>{m.toUpperCase()}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.label}>
                      <td className="dre-preview-label">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className={v === null ? "dre-preview-empty" : ""}>
                          {v !== null ? v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "–"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {preview.length < 8 ? null : (
                    <tr className="dre-preview-more">
                      <td colSpan={13}>... e mais linhas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
