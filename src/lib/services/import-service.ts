import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import crypto from "crypto";
import { CacheInvalidationService } from "@/lib/services/cache-invalidation-service";
import { logAuditAction } from "@/lib/supabase/auth-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Service-role Supabase client to bypass RLS in the staging/import pipelines
const supabase = createClient(supabaseUrl, supabaseKey);

export class IntegrityBarrierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrityBarrierError";
  }
}

export interface ImportPreviewResult {
  batchId: string;
  filename: string;
  fileSize: number;
  templateName: string;
  templateRecognized: boolean;
  period: string;
  periodStart: string;
  periodEnd: string;
  periodFormatted: string;
  totalRows: number;
  uniquePartners: number;
  uniqueProducts: number;
  unmappedPartnersCount: number;
  totalGross: number;
  totalApproved: number;
  totalCancelled: number;
  totalDevolution: number;
  totalNet: number;
  totalVendaFutura: number;
  topsFound: string[];
  cfopsFound: string[];
  warningsCount: number;
  errorsCount: number;
  qualityScore: number;
  inconsistencies: Array<{
    line: number;
    field: string;
    value: string;
    message: string;
    severity: "INFO" | "WARNING" | "ERROR";
    action: string;
  }>;
  needsConfirmation: boolean;
  currentBaseStats: {
    totalRows: number;
    uniquePartners: number;
    uniqueProducts: number;
    totalNet: number;
  } | null;
  validationChecklist: {
    layoutRecognized: boolean;
    headersValid: boolean;
    datesValid: boolean;
    productsValid: boolean;
    partnersValid: boolean;
    valuesValid: boolean;
    periodIdentified: boolean;
    fileAnalyzed: boolean;
  };
}

export class ImportService {
  /**
   * Helper to write logs and progress into the metadata of cm_sync_logs
   */
  private static async updateLogProgress(
    logId: string,
    progress: number,
    step: string,
    additionalMeta: Record<string, any> = {},
    status: "RUNNING" | "PENDING_CONFIRMATION" | "SUCCESS" | "ERROR" = "RUNNING",
    tableUpdates: Record<string, any> = {}
  ) {
    const { data: current } = await supabase
      .from("cm_sync_logs")
      .select("metadata")
      .eq("id", logId)
      .single();

    const oldMeta = current?.metadata || {};
    const oldLogs = oldMeta.logs || [];
    const newLog = {
      timestamp: new Date().toISOString(),
      step,
      progress,
    };

    const { error } = await supabase
      .from("cm_sync_logs")
      .update({
        status,
        ...tableUpdates,
        metadata: {
          ...oldMeta,
          ...additionalMeta,
          progress,
          current_step: step,
          logs: [...oldLogs, newLog],
        },
      })
      .eq("id", logId);

    if (error) {
      console.error("[updateLogProgress] Error updating log:", logId, error);
    }
  }

  /**
   * Reads, validates, and stages the uploaded Excel file.
   */
  static async analyzeExcel(
    fileBuffer: ArrayBuffer,
    fileName: string,
    fileSize: number,
    triggeredBy: string = "manual"
  ): Promise<ImportPreviewResult> {
    const startTime = Date.now();

    // 1. Compute SHA-256 hash of file content to detect duplicates
    const fileHash = crypto
      .createHash("sha256")
      .update(Buffer.from(fileBuffer))
      .digest("hex");

    // 2. Check if this exact file hash has already been successfully imported
    const { data: duplicateCheck, error: dupError } = await supabase
      .from("cm_sync_logs")
      .select("id, started_at, finished_at, period_start, period_end, rows_inserted, triggered_by, metadata")
      .eq("status", "SUCCESS")
      .eq("source", "excel")
      .filter("metadata->>file_hash", "eq", fileHash)
      .order("started_at", { ascending: false })
      .limit(1);

    if (dupError) {
      console.error("[analyzeExcel] duplicateCheck query error:", dupError);
    }

    let existingDuplicateBatchInfo: any = null;
    if (duplicateCheck && duplicateCheck.length > 0) {
      const existing = duplicateCheck[0];
      existingDuplicateBatchInfo = {
        batchId: existing.id,
        importedAt: existing.finished_at || existing.started_at,
        importedBy: existing.metadata?.triggered_by_email || existing.triggered_by || "Sistema",
        period: existing.metadata?.period || `${existing.period_start} a ${existing.period_end}`,
        periodStart: existing.period_start,
        periodEnd: existing.period_end,
        totalRows: existing.metadata?.total_rows || existing.rows_inserted || 0,
        totalNet: existing.metadata?.total_net || 0,
      };
    }

    if (existingDuplicateBatchInfo) {
      const err: any = new Error(
        `Este arquivo já foi importado anteriormente em ${existingDuplicateBatchInfo.importedAt} por ${existingDuplicateBatchInfo.importedBy}.`
      );
      err.isDuplicate = true;
      err.existingBatch = existingDuplicateBatchInfo;
      throw err;
    }

    const allowedTriggers = ["manual", "cron_06", "cron_12", "cron_18", "reconciliation"];
    const triggerValue = allowedTriggers.includes(triggeredBy) ? triggeredBy : "manual";
    const triggeredEmail = allowedTriggers.includes(triggeredBy) ? null : triggeredBy;

    // Check if there is an existing RUNNING log with the same hash
    // and automatically clean/rollback it to avoid duplicate key conflicts.
    const { data: runningCheck } = await supabase
      .from("cm_sync_logs")
      .select("id, metadata")
      .eq("status", "RUNNING")
      .eq("source", "excel")
      .filter("metadata->>file_hash", "eq", fileHash)
      .limit(1);

    if (runningCheck && runningCheck.length > 0) {
      const oldBatchId = runningCheck[0].id;
      try {
        console.log(`[analyzeExcel] Auto-cleaning stuck running batch: ${oldBatchId}`);
        await supabase.from("cm_faturamento_staging").delete().eq("batch_id", oldBatchId);
        await supabase
          .from("cm_sync_logs")
          .update({
            status: "ERROR",
            finished_at: new Date().toISOString(),
            error_message: "Substituído por uma nova tentativa de upload.",
            metadata: {
              ...(runningCheck[0].metadata as Record<string, any> || {}),
              sub_status: "ROLLBACKED",
              rollback_at: new Date().toISOString(),
            }
          })
          .eq("id", oldBatchId);
      } catch (cleanErr) {
        console.warn("[analyzeExcel] Failed to auto-cleanup old batch:", cleanErr);
      }
    }

    // 3. Create the initial cm_sync_logs entry
    const { data: logEntry, error: logError } = await supabase
      .from("cm_sync_logs")
      .insert({
        source: "excel",
        status: "RUNNING",
        triggered_by: triggerValue,
        metadata: {
          file_name: fileName,
          file_size: fileSize,
          file_hash: fileHash,
          triggered_by_email: triggeredEmail,
          progress: 0,
          current_step: "Recebido",
          logs: [],
        },
      })
      .select("id")
      .single();

    if (logError || !logEntry) {
      throw new Error("Falha ao criar lote de sincronização: " + logError?.message);
    }

    const batchId = logEntry.id;

    try {
      // 4. Parse Excel Workbook & Template Recognition
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      let sheet: XLSX.WorkSheet | null = null;
      let sheetName = "";
      let headerIndex = 0;
      let detectedHeaders: string[] = [];

      // Colunas obrigatórias do Template Oficial CFOP
      const CFOP_REQUIRED_COLUMNS = [
        "Cód. Parceiro",
        "Parceiro",
        "Status NFe",
        "Vlr. Total Líq.",
        "Vendedor",
        "Cód. TOP",
        "Cód. CFOP",
        "Nro. Nota",
      ];

      // Procura a primeira aba que contenha o cabeçalho CFOP
      for (const name of workbook.SheetNames) {
        const s = workbook.Sheets[name];
        const rawRows = XLSX.utils.sheet_to_json(s, { header: 1 }) as any[][];
        for (let i = 0; i < Math.min(25, rawRows.length); i++) {
          const row = rawRows[i];
          if (row && Array.isArray(row)) {
            const rowStr = row.map((c) => String(c || "").trim());
            const matchCount = CFOP_REQUIRED_COLUMNS.filter((k) => rowStr.includes(k)).length;
            if (matchCount >= 4) {
              sheet = s;
              sheetName = name;
              headerIndex = i;
              detectedHeaders = rowStr;
              break;
            }
          }
        }
        if (sheet) break;
      }

      if (!sheet) {
        throw new Error(
          "Não foi encontrada nenhuma aba de faturamento com o layout oficial CFOP. Certifique-se de que a planilha contenha as colunas obrigatórias: 'Cód. Parceiro', 'Parceiro', 'Status NFe', 'Vlr. Total Líq.', 'Vendedor', 'Cód. TOP', 'Cód. CFOP', 'Nro. Nota'."
        );
      }

      await this.updateLogProgress(batchId, 30, "Validando estrutura e colunas");

      const missingRequiredCols = CFOP_REQUIRED_COLUMNS.filter((k) => !detectedHeaders.includes(k));
      const templateRecognized = missingRequiredCols.length === 0;

      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: null,
        range: headerIndex,
      });

      const inconsistencies: ImportPreviewResult["inconsistencies"] = [];
      const stagingRows: any[] = [];
      const partnersSet = new Set<string>();
      const productsSet = new Set<string>();
      const topsSet = new Set<string>();
      const cfopsSet = new Set<string>();
      const datesList: string[] = [];

      let totalGross = 0;
      let totalApproved = 0;
      let totalCancelled = 0;
      let totalDevolution = 0;
      let totalNet = 0;
      let totalVendaFutura = 0;
      let errorsCount = 0;
      let warningsCount = 0;

      if (missingRequiredCols.length > 0) {
        errorsCount++;
        inconsistencies.push({
          line: headerIndex + 1,
          field: missingRequiredCols.join(", "),
          value: "Ausente",
          message: `Colunas obrigatórias do template CFOP ausentes: ${missingRequiredCols.join(", ")}.`,
          severity: "ERROR",
          action: "Utilize a planilha padrão de exportação CFOP contendo todas as colunas obrigatórias.",
        });
      }

      // Check if header contains Venda Entrega Futura
      const sampleRow = jsonData[0] || {};
      const headerKeys = Object.keys(sampleRow).map(k => k.trim().toLowerCase());
      const hasVendaFuturaHeader = headerKeys.some(k => 
        k === "venda entrega futura" || k === "venda futura" || k === "valor_venda_futura"
      );

      if (!hasVendaFuturaHeader) {
        warningsCount++;
        inconsistencies.push({
          line: headerIndex + 1,
          field: "Venda Entrega Futura",
          value: "-",
          message: "Coluna 'Venda Entrega Futura' ausente no modelo Excel. O valor foi preenchido com 0.00 para retrocompatibilidade.",
          severity: "WARNING",
          action: "Para lançar faturamento com entrega futura, utilize o modelo oficial atualizado contendo a coluna B 'Venda Entrega Futura'.",
        });
      }

      const parseRowDate = (val: any): string | null => {
        if (!val) return null;
        if (val instanceof Date) {
          const y = val.getUTCFullYear();
          const m = String(val.getUTCMonth() + 1).padStart(2, '0');
          const d = String(val.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        if (typeof val === "number") {
          // Excel serial date epoch conversion
          const utcDays = Math.floor(val) - 25569;
          const d = new Date(utcDays * 86400000);
          if (isNaN(d.getTime())) return null;
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
        if (typeof val === "string") {
          const str = val.trim();
          
          // Check dd/mm/yyyy format first
          const parts = str.split("/");
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            if (year.length === 4 && !isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
              return `${year}-${month}-${day}`;
            }
          }
          
          // Fallback to general date parser (handles yyyy-mm-dd etc)
          const d = new Date(str);
          return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
        }
        return null;
      };

      const parseNumber = (val: any): number => {
        if (val === null || val === undefined || val === "") return 0;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const cleaned = val.replace(/\./g, "").replace(",", ".");
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      // Keep track of nro_unico + cod_produto combinations to detect internal duplicates
      const uniqueKeys = new Set<string>();

      for (let index = 0; index < jsonData.length; index++) {
        const row = jsonData[index];
        const lineNum = index + headerIndex + 2;

        const rawDate = row["Dt. Neg"] || row["Data Faturamento"];
        const parsedDate = parseRowDate(rawDate);
        const codCfop = row["Cód. CFOP"] ? String(row["Cód. CFOP"]).trim() : null;
        const codProduto = row["Cód. Produto"] ? String(row["Cód. Produto"]).trim() : null;
        const codParceiro = row["Cód. Parceiro"] ? String(row["Cód. Parceiro"]).trim() : null;
        const rawStatusNFe = row["Status NFe"] ? String(row["Status NFe"]).trim().toUpperCase() : null;
        const isCancelada = rawStatusNFe === "CANCELADA" || rawStatusNFe === "CANCELADO";

        // Skip completely empty rows
        const isAllNull = Object.values(row).every((v) => v === null || v === "");
        if (isAllNull) continue;

        let rowSeverity: "INFO" | "WARNING" | "ERROR" | null = null;
        let rowMsg = "";
        let rowField = "";
        let rowVal = "";
        let rowAction = "";

        // Check required fields
        if (!parsedDate) {
          rowSeverity = "ERROR";
          rowField = "Dt. Neg";
          rowVal = String(rawDate || "");
          rowMsg = "Data do faturamento ('Dt. Neg') ausente ou inválida.";
          rowAction = "Verifique o formato da data ou preencha o campo.";
        } else if (!codCfop) {
          rowSeverity = "ERROR";
          rowField = "Cód. CFOP";
          rowVal = "";
          rowMsg = "Código CFOP ('Cód. CFOP') obrigatório ausente.";
          rowAction = "Insira um código CFOP válido (ex: 1102).";
        } else if (!codProduto) {
          rowSeverity = "ERROR";
          rowField = "Cód. Produto";
          rowVal = "";
          rowMsg = "Código do produto ('Cód. Produto') obrigatório ausente.";
          rowAction = "Vincule o código de produto oficial Coffee Mais.";
        } else if (!codParceiro) {
          rowSeverity = "ERROR";
          rowField = "Cód. Parceiro";
          rowVal = "";
          rowMsg = "Código do parceiro ('Cód. Parceiro') obrigatório ausente.";
          rowAction = "Vincule o código do parceiro/cliente cadastrado.";
        }

        // Check internal duplicates within file
        if (!rowSeverity && codProduto && row["Nro. Único"]) {
          const dupKey = `${row["Nro. Único"]}_${codProduto}`;
          if (uniqueKeys.has(dupKey)) {
            rowSeverity = "WARNING";
            rowField = "Nro. Único";
            rowVal = String(row["Nro. Único"]);
            rowMsg = `Registro duplicado encontrado no arquivo para a nota/único ${row["Nro. Único"]} e produto ${codProduto}.`;
            rowAction = "Consolide as linhas na planilha ou verifique se há duplicação indesejada.";
          } else {
            uniqueKeys.add(dupKey);
          }
        }

        if (rowSeverity) {
          if (rowSeverity === "ERROR") {
            errorsCount++;
          } else {
            warningsCount++;
          }
          inconsistencies.push({
            line: lineNum,
            field: rowField,
            value: rowVal,
            message: rowMsg,
            severity: rowSeverity,
            action: rowAction,
          });
        }

        // Values
        const qty = parseNumber(row["Qtd."] || row["Quantidade"]);
        const unitPrice = parseNumber(row["Vlr. Unitário"]);
        const discount = parseNumber(row["Vlr. Desconto"]);
        
        const bruto = parseNumber(row["Vlr. Bruto"] || row["Faturamento Bruto"] || (qty * unitPrice));
        const dev = parseNumber(row["Vlr. Devolução"] || row["Devolução"]);
        const valVendaFutura = parseNumber(row["Venda Entrega Futura"] || row["Venda Futura"] || row["valor_venda_futura"]);

        let netVal = row["Vlr. Total Líq."] !== undefined && row["Vlr. Total Líq."] !== null 
          ? parseNumber(row["Vlr. Total Líq."]) 
          : (bruto - dev);

        // Metrics aggregation
        if (parsedDate) datesList.push(parsedDate);
        if (codParceiro) partnersSet.add(codParceiro);
        if (codProduto) productsSet.add(codProduto);
        if (row["Cód. TOP"]) topsSet.add(String(row["Cód. TOP"]).trim());
        if (row["Cód. CFOP"]) cfopsSet.add(String(row["Cód. CFOP"]).trim());

        totalGross += bruto;
        totalDevolution += dev;
        totalVendaFutura += valVendaFutura;

        if (isCancelada) {
          totalCancelled += (bruto || netVal);
        } else {
          totalApproved += netVal;
          totalNet += netVal;
        }

        stagingRows.push({
          batch_id: batchId,
          cod_cfop: codCfop,
          cfop_desc: row["CFOP"] ? String(row["CFOP"]).trim() : null,
          dt_faturamento: parsedDate,
          nro_unico: row["Nro. Único"] ? String(row["Nro. Único"]).trim() : null,
          nro_nota: row["Nro. Nota"] ? String(row["Nro. Nota"]).trim() : null,
          cod_parceiro: codParceiro,
          nome_parceiro: row["Parceiro"] ? String(row["Parceiro"]).trim() : null,
          cod_produto: codProduto,
          desc_produto: row["Produto"] ? String(row["Produto"]).trim() : null,
          quantidade: qty,
          vlr_unitario: unitPrice,
          vlr_desconto: discount,
          vlr_total_liq: netVal,
          vlr_bruto: bruto,
          vlr_devolucao: dev,
          cod_top: row["Cód. TOP"] ? String(row["Cód. TOP"]).trim() : null,
          desc_top: row["TOP"] ? String(row["TOP"]).trim() : null,
          custo_icms: parseNumber(row["Custo s/ ICMS"]),
          cod_vendedor: row["Cód. Vendedor"] ? String(row["Cód. Vendedor"]).trim() : null,
          nome_vendedor: row["Vendedor"] ? String(row["Vendedor"]).trim() : null,
          controle: row["Controle"] ? String(row["Controle"]).trim() : null,
          custo_total: parseNumber(row["Custo Total"]),
          cod_natureza: row["Cód. Natureza"] ? String(row["Cód. Natureza"]).trim() : null,
          desc_natureza: row["Natureza"] ? String(row["Natureza"]).trim() : null,
          status_nfe: rawStatusNFe,
          vlr_frete: parseNumber(row["Vlr. Frete"]),
          vlr_substituicao: parseNumber(row["Vlr. Substituição"]),
          vlr_total_st: parseNumber(row["Vlr. Total ST"]),
          cod_cr: row["Cód. CR"] ? String(row["Cód. CR"]).trim() : null,
          centro_resultado: row["Centro de Resultado"] ? String(row["Centro de Resultado"]).trim() : null,
          valor_venda_futura: valVendaFutura,
          validation_status: rowSeverity || "VALID",
          validation_message: rowMsg || null,
        });
      }

      if (stagingRows.length === 0) {
        throw new Error("A planilha lida está vazia ou não contém nenhum registro comercial válido.");
      }

      await this.updateLogProgress(batchId, 60, "Persistindo em Staging");

      // Sort dates to identify the period
      datesList.sort();
      const periodStart = datesList[0];
      const periodEnd = datesList[datesList.length - 1];

      // Format month/year representation (ex: "Julho/2026")
      const minDateObj = new Date(periodStart);
      const monthsPt = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const periodStr = `${monthsPt[minDateObj.getUTCMonth()]}/${minDateObj.getUTCFullYear()}`;

      const formatPtDate = (dStr: string) => {
        if (!dStr) return "";
        const [y, m, d] = dStr.split("-");
        return `${d}/${m}/${y}`;
      };
      const periodFormatted = `${formatPtDate(periodStart)} → ${formatPtDate(periodEnd)}`;

      // 6. Check unmapped partners in batch
      let unmappedPartnersCount = 0;
      const partnersList = Array.from(partnersSet);
      if (partnersList.length > 0) {
        try {
          const { data: validPartners } = await supabase
            .from("cm_clientes")
            .select("codigo")
            .in("codigo", partnersList.slice(0, 5000));
          const validSet = new Set((validPartners || []).map((p) => String(p.codigo)));
          const unmapped = partnersList.filter((p) => !validSet.has(p));
          unmappedPartnersCount = unmapped.length;
        } catch {
          // Non-fatal
        }
      }

      // Write parsed rows into staging in chunks
      const chunkSize = 2500;
      for (let i = 0; i < stagingRows.length; i += chunkSize) {
        const chunk = stagingRows.slice(i, i + chunkSize);
        const { error: stageError } = await supabase
          .from("cm_faturamento_staging")
          .insert(chunk);

        if (stageError) {
          throw new Error("Erro ao salvar dados na tabela temporária (staging): " + stageError.message);
        }
      }

      await this.updateLogProgress(batchId, 90, "Finalizando análise");

      // 7. Check if data already exists in the official table for this period using ultra-fast RPC
      const { data: dbStatsRows } = await supabase
        .rpc("fn_get_import_baseline_stats", {
          p_period_start: periodStart,
          p_period_end: periodEnd,
        });

      const dbStats = Array.isArray(dbStatsRows) && dbStatsRows.length > 0 ? dbStatsRows[0] : null;
      const totalDbRows = Number(dbStats?.total_rows || 0);
      const needsConfirmation = totalDbRows > 0;

      let currentBaseStats: ImportPreviewResult["currentBaseStats"] = null;
      if (needsConfirmation && dbStats) {
        currentBaseStats = {
          totalRows: totalDbRows,
          uniquePartners: Number(dbStats.unique_partners || 0),
          uniqueProducts: Number(dbStats.unique_products || 0),
          totalNet: Number(dbStats.total_net || 0),
        };
      }

      const totalRowsCount = jsonData.length || 1;
      const qualityScore = Math.max(0, parseFloat((100 - (errorsCount * 100 / totalRowsCount) - (warningsCount * 15 / totalRowsCount)).toFixed(1)));

      const validationChecklist = {
        layoutRecognized: templateRecognized,
        headersValid: missingRequiredCols.length === 0,
        datesValid: !inconsistencies.some(err => err.field === "Dt. Neg"),
        productsValid: !inconsistencies.some(err => err.field === "Cód. Produto"),
        partnersValid: !inconsistencies.some(err => err.field === "Cód. Parceiro"),
        valuesValid: errorsCount === 0,
        periodIdentified: !!periodStart && !!periodEnd,
        fileAnalyzed: true,
      };

      // Update sync logs metadata with the summary metrics and progress
      const durationMs = Date.now() - startTime;
      const previewData: ImportPreviewResult = {
        batchId,
        filename: fileName,
        fileSize,
        templateName: "CFOP OFICIAL",
        templateRecognized,
        period: periodStr,
        periodStart,
        periodEnd,
        periodFormatted,
        totalRows: stagingRows.length,
        uniquePartners: partnersSet.size,
        uniqueProducts: productsSet.size,
        unmappedPartnersCount,
        totalGross,
        totalApproved,
        totalCancelled,
        totalDevolution,
        totalNet,
        totalVendaFutura,
        topsFound: Array.from(topsSet),
        cfopsFound: Array.from(cfopsSet),
        warningsCount,
        errorsCount,
        qualityScore,
        inconsistencies: inconsistencies.slice(0, 100),
        needsConfirmation,
        currentBaseStats,
        validationChecklist,
      };

      await this.updateLogProgress(
        batchId,
        100,
        "Aguardando Confirmação",
        {
          file_hash: fileHash,
          template_name: "CFOP OFICIAL",
          period_start: periodStart,
          period_end: periodEnd,
          period_formatted: periodFormatted,
          period: periodStr,
          total_rows: stagingRows.length,
          unique_partners: partnersSet.size,
          unique_products: productsSet.size,
          unmapped_partners_count: unmappedPartnersCount,
          total_gross: totalGross,
          total_approved: totalApproved,
          total_cancelled: totalCancelled,
          total_devolution: totalDevolution,
          total_net: totalNet,
          total_venda_futura: totalVendaFutura,
          tops_found: Array.from(topsSet),
          cfops_found: Array.from(cfopsSet),
          warnings_count: warningsCount,
          errors_count: errorsCount,
          duration_ms: durationMs,
          quality_score: qualityScore,
          sub_status: errorsCount > 0 ? "ERROR" : "PENDING_CONFIRMATION",
        },
        errorsCount > 0 ? "ERROR" : "RUNNING",
        {
          period_start: periodStart,
          period_end: periodEnd,
        }
      );

      // If we have fatal errors, set the log status directly to ERROR
      if (errorsCount > 0) {
        await supabase
          .from("cm_sync_logs")
          .update({
            status: "ERROR",
            error_message: `O arquivo contém ${errorsCount} erros críticos que impedem a importação.`,
          })
          .eq("id", batchId);
      }

      if (existingDuplicateBatchInfo) {
        const dupErr: any = new Error(`Este arquivo já foi importado anteriormente (Lote ID: ${existingDuplicateBatchInfo.batchId}).`);
        dupErr.isDuplicate = true;
        dupErr.existingBatch = existingDuplicateBatchInfo;
        dupErr.preview = previewData;
        dupErr.fileHash = fileHash;
        throw dupErr;
      }

      return previewData;
    } catch (error: unknown) {
      console.error("[ImportService] Error during analyzeExcel:", error);
      const message = error instanceof Error ? error.message : String(error);
      // Update log to error status
      await supabase
        .from("cm_sync_logs")
        .update({
          status: "ERROR",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", batchId);

      throw error;
    }
  }

  /**
   * Promotes the staged rows of a batch into production using a transaction-safe Postgres function
   */
  /**
   * Promotes the staged rows of a batch into production using a transaction-safe Postgres function
   */
  static async confirmImport(
    batchId: string,
    mode: "replace" | "append",
    overrideReason?: {
      motivo_padrao: string;
      motivo_descricao?: string;
      user_id?: string;
      role?: string;
      email?: string;
    }
  ): Promise<{
    success: boolean;
    rowsPromoted: number;
    reconciliation?: {
      excelTotal: number;
      cmFaturamentoTotal: number;
      salesTotal: number;
      delta: number;
      isReconciled: boolean;
      periodStart: string | null;
      periodEnd: string | null;
      periodFormatted: string;
    } | null;
    autoCadastro?: {
      eligible_found: number;
      created: number;
      already_exists: number;
      ignored_non_commercial: number;
      errors: number;
      parceiros_criados: string[];
      total_criados?: number;
    } | null;
  }> {
    const startTime = Date.now();

    // Recálculo 100% Server-Side do período a partir dos dados em cm_faturamento_staging
    const { data: minDateData } = await supabase
      .from("cm_faturamento_staging")
      .select("dt_emissao")
      .eq("batch_id", batchId)
      .not("dt_emissao", "is", null)
      .order("dt_emissao", { ascending: true })
      .limit(1);

    const { data: maxDateData } = await supabase
      .from("cm_faturamento_staging")
      .select("dt_emissao")
      .eq("batch_id", batchId)
      .not("dt_emissao", "is", null)
      .order("dt_emissao", { ascending: false })
      .limit(1);

    const serverPeriodStart = minDateData?.[0]?.dt_emissao || null;
    const serverPeriodEnd = maxDateData?.[0]?.dt_emissao || null;

    const { data: currentLog } = await supabase
      .from("cm_sync_logs")
      .select("metadata")
      .eq("id", batchId)
      .single();

    const currentFileHash = currentLog?.metadata?.file_hash;
    let oldBatchIdToSupersede: string | null = null;

    if (currentFileHash && serverPeriodStart && serverPeriodEnd) {
      // D4 (Demanda 065): Barreira — impedir que o Excel sobrescreva fotografia oficial do Google Drive CSV
      const { data: existingDriveBatch } = await supabase
        .from("cm_sync_logs")
        .select("id, period_start, period_end, finished_at")
        .eq("status", "SUCCESS")
        .eq("source", "google_drive_csv")
        .lte("period_start", serverPeriodEnd)
        .gte("period_end", serverPeriodStart)
        .order("finished_at", { ascending: false })
        .limit(1);

      if (existingDriveBatch && existingDriveBatch.length > 0) {
        const driveBatch = existingDriveBatch[0];
        throw new IntegrityBarrierError(
          `BLOQUEADO: O período ${serverPeriodStart} a ${serverPeriodEnd} já possui carga oficial via Google Drive CSV ` +
          `(batch ${driveBatch.id}, concluído em ${driveBatch.finished_at}). ` +
          `O upload Excel não pode sobrescrever a fotografia oficial. ` +
          `Utilize o fluxo Google Drive CSV para atualizar os dados de faturamento.`
        );
      }

      const { data: existingSuccessLog } = await supabase
        .from("cm_sync_logs")
        .select("id, period_start, period_end")
        .eq("status", "SUCCESS")
        .eq("source", "excel")
        .eq("period_start", serverPeriodStart)
        .eq("period_end", serverPeriodEnd)
        .filter("metadata->>file_hash", "eq", currentFileHash)
        .neq("id", batchId)
        .order("started_at", { ascending: false })
        .limit(1);

      if (existingSuccessLog && existingSuccessLog.length > 0) {
        if (!overrideReason || !overrideReason.motivo_padrao) {
          throw new Error("A reimportação deste lote exige autorização de Administrador e motivo justificado.");
        }
        if (overrideReason.motivo_padrao === "Outro" && !overrideReason.motivo_descricao?.trim()) {
          throw new Error("Para o motivo 'Outro', a descrição textual é obrigatória.");
        }
        oldBatchIdToSupersede = existingSuccessLog[0].id;
      }
    }
    const telemetry: {
      batch_id: string;
      mode: string;
      bypass_used: boolean;
      rpcs_executed: string[];
      performance_alerts: Array<{ level: "WARNING" | "CRITICAL"; step: string; duration_ms: number; message: string }>;
      step_durations_ms: Record<string, number>;
      total_rows_staging?: number;
      rows_promoted?: number;
      promotion_calls?: any[];
      pre_finalization_validation?: any;
      audit_result?: any;
      reconciliation?: any;
      mv_refresh_enqueued?: boolean;
      auto_cadastro?: any;
      total_duration_ms?: number;
    } = {
      batch_id: batchId,
      mode,
      bypass_used: true,
      rpcs_executed: [],
      performance_alerts: [],
      step_durations_ms: {},
    };

    const trackStep = async <T>(stepName: string, fn: () => Promise<T>): Promise<T> => {
      const stepStart = Date.now();
      try {
        const res = await fn();
        const duration = Date.now() - stepStart;
        telemetry.step_durations_ms[stepName] = duration;

        if (duration > 30000) {
          const alert = { level: "CRITICAL" as const, step: stepName, duration_ms: duration, message: `ALERTA CRÍTICO: Etapa '${stepName}' levou ${duration}ms (> 30s)` };
          telemetry.performance_alerts.push(alert);
          console.warn(`[PERFORMANCE CRITICAL] Batch ${batchId} - ${alert.message}`);
        } else if (duration > 10000) {
          const alert = { level: "WARNING" as const, step: stepName, duration_ms: duration, message: `ALERTA WARNING: Etapa '${stepName}' levou ${duration}ms (> 10s)` };
          telemetry.performance_alerts.push(alert);
          console.warn(`[PERFORMANCE WARNING] Batch ${batchId} - ${alert.message}`);
        }
        return res;
      } catch (err) {
        const duration = Date.now() - stepStart;
        telemetry.step_durations_ms[stepName] = duration;
        throw err;
      }
    };

    await this.updateLogProgress(batchId, 90, "Preparando Importação");

    let promotionStarted = false;

    try {
      // 1. Preparar importação (com bypass de trigger ativado na RPC SQL)
      await trackStep("preparar_importacao", async () => {
        telemetry.rpcs_executed.push("preparar_importacao_faturamento");
        const { error: prepError } = await supabase.rpc("preparar_importacao_faturamento", {
          p_batch_id: batchId,
          p_mode: mode,
        });
        if (prepError) throw prepError;
      });

      // 2. Obter total de registros a processar na staging
      const { count, error: countError } = await supabase
        .from("cm_faturamento_staging")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId);
      if (countError) throw countError;

      const totalRows = count || 0;
      telemetry.total_rows_staging = totalRows;
      let rowsPromoted = 0;
      const BATCH_SIZE = 1000;

      // Telemetria detalhada de cada chamada da RPC
      const promotionLogs: Array<{
        batch_id: string;
        call_index: number;
        p_last_id_sent: string;
        last_id_returned: string;
        inserted: number;
        rows_promoted_accumulated: number;
        duration_ms: number;
        staging_remaining: number;
      }> = [];

      // 3. Processar em batches sequenciais no backend (sem offset numérico, guiado por progresso real)
      await trackStep("promover_lote", async () => {
        promotionStarted = true;
        telemetry.rpcs_executed.push("promover_lote_faturamento");
        let lastId = "00000000-0000-0000-0000-000000000000";
        let callIndex = 0;

        while (rowsPromoted < totalRows) {
          callIndex++;
          const callStart = Date.now();
          const currentLimit = BATCH_SIZE;
          const progressPercent = Math.min(95, Math.round(90 + (5 * (rowsPromoted / totalRows))));
          
          await this.updateLogProgress(
            batchId,
            progressPercent,
            `Persistindo na Tabela Oficial (${rowsPromoted} de ${totalRows} registros)`
          );

          const { data, error: promoError } = await supabase.rpc("promover_lote_faturamento", {
            p_batch_id: batchId,
            p_last_id: lastId,
            p_limit: currentLimit,
          });

          const callDuration = Date.now() - callStart;

          if (promoError) {
            telemetry.promotion_calls = promotionLogs;
            throw promoError;
          }

          const promoData = data as any;
          const insertedInChunk = promoData?.inserted || 0;
          const returnedLastId = promoData?.last_id || lastId;

          rowsPromoted += insertedInChunk;
          lastId = returnedLastId;

          promotionLogs.push({
            batch_id: batchId,
            call_index: callIndex,
            p_last_id_sent: lastId,
            last_id_returned: returnedLastId,
            inserted: insertedInChunk,
            rows_promoted_accumulated: rowsPromoted,
            duration_ms: callDuration,
            staging_remaining: totalRows - rowsPromoted,
          });

          // Se a RPC retornar 0 inserções antes de atingir totalRows, interromper a tentativa de loop
          if (insertedInChunk === 0) {
            break;
          }
        }
      });
      telemetry.rows_promoted = rowsPromoted;
      telemetry.promotion_calls = promotionLogs;

      // BARREIRA DE INTEGRIDADE PRÉ-FINALIZAÇÃO (FASE 1)
      await this.updateLogProgress(batchId, 96, "Validando integridade pré-finalização");

      // a. Consulta contagem exata em cm_faturamento
      const { count: actualPromotedCount, error: countCheckError } = await supabase
        .from("cm_faturamento")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId);
      if (countCheckError) throw countCheckError;

      // b. Soma financeira via RPC server-side (elimina limite de linhas do PostgREST)
      const { data: sumNetResult, error: sumError } = await supabase.rpc("fn_sum_net_by_batch", {
        p_batch_id: batchId,
      });
      if (sumError) throw sumError;

      const actualPromotedNet = Number(sumNetResult || 0);

      const { data: syncLogBeforeFinalize } = await supabase
        .from("cm_sync_logs")
        .select("metadata")
        .eq("id", batchId)
        .single();

      const expectedNet = Number(syncLogBeforeFinalize?.metadata?.total_net || 0);

      // c. Validações Mandatórias (2 condições)
      const isCountValid = totalRows === (actualPromotedCount || 0);
      const isNetValid = expectedNet === 0 || Math.abs(actualPromotedNet - expectedNet) < 0.05;

      telemetry.pre_finalization_validation = {
        staging_count: totalRows,
        rows_promoted: rowsPromoted,
        cm_faturamento_count: actualPromotedCount || 0,
        expected_net: expectedNet,
        promoted_net: actualPromotedNet,
        passed: isCountValid && isNetValid,
      };

      if (!isCountValid || !isNetValid) {
        const errorMsg = `FALHA NA BARREIRA DE INTEGRIDADE PRÉ-FINALIZAÇÃO: ` +
          `Staging Original: ${totalRows} | Promovidos no Banco: ${actualPromotedCount || 0} | ` +
          `Net Esperado: R$ ${expectedNet.toFixed(2)} | Net Promovido: R$ ${actualPromotedNet.toFixed(2)}. ` +
          `Finalização abortada e staging preservada.`;
        
        await this.updateLogProgress(batchId, 100, errorMsg, {}, "ERROR");
        throw new IntegrityBarrierError(errorMsg);
      }


      // 4. Finalizar importação (somente se a barreira passou 100%)
      await this.updateLogProgress(batchId, 97, "Finalizando processamento e consolidando dados");
      await trackStep("finalizar_importacao", async () => {
        telemetry.rpcs_executed.push("finalizar_importacao_faturamento");
        const { error: finalizeError } = await supabase.rpc("finalizar_importacao_faturamento", {
          p_batch_id: batchId,
        });
        if (finalizeError) throw finalizeError;
      });

      // 4b. Auditoria de integridade em 5 Camadas (Excel -> Staging -> cm_faturamento) via RPC fn_validate_import_integrity
      await trackStep("auditoria_integridade", async () => {
        telemetry.rpcs_executed.push("fn_validate_import_integrity");
        const { data: logData } = await supabase
          .from("cm_sync_logs")
          .select("metadata")
          .eq("id", batchId)
          .single();

        const expectedTotalVendaFutura = Number(logData?.metadata?.total_venda_futura || 0);

        const { data: auditRes, error: auditError } = await supabase.rpc("fn_validate_import_integrity", {
          p_batch_id: batchId,
          p_expected_venda_futura: expectedTotalVendaFutura,
        });

        if (auditError) throw auditError;
        const audit = Array.isArray(auditRes) && auditRes.length > 0 ? auditRes[0] : null;

        if (!audit || !audit.passed) {
          throw new IntegrityBarrierError(
            audit?.message || "Falha de auditoria (5 Camadas): Divergência detectada no banco de dados. Importação abortada."
          );
        }
        telemetry.audit_result = audit;
      });

      // 5. Atualizar dashboards de forma assíncrona
      await trackStep("enqueue_mv_refresh", async () => {
        try {
          await this.updateLogProgress(batchId, 98, "Atualizando Dashboards (assíncrono)");
          telemetry.rpcs_executed.push("fn_enqueue_mv_refresh");
          await supabase.rpc("fn_enqueue_mv_refresh", { p_batch_id: batchId });
          telemetry.mv_refresh_enqueued = true;
        } catch (mvErr) {
          console.warn("MV refresh enqueue failed (non-fatal):", mvErr);
          telemetry.mv_refresh_enqueued = false;
        }

        // 5b. Enfileirar recálculo de atividade comercial em background (não-bloqueante / desacoplado)
        try {
          telemetry.rpcs_executed.push("fn_enqueue_clientes_atividade_refresh");
          await supabase.rpc("fn_enqueue_clientes_atividade_refresh", {
            p_batch_id: batchId,
            p_trigger_source: "IMPORT_JOB",
          });
        } catch (atvErr) {
          console.warn("Clientes atividade refresh enqueue failed (non-fatal):", atvErr);
        }
      });

      // 5c. Auto-cadastro mínimo de PDVs comerciais elegíveis ausentes em base_atendimento (Demanda 021/024)
      let autoCadastroResult: {
        eligible_found: number;
        created: number;
        already_exists: number;
        ignored_non_commercial: number;
        errors: number;
        parceiros_criados: string[];
        total_criados?: number;
      } = {
        eligible_found: 0,
        created: 0,
        already_exists: 0,
        ignored_non_commercial: 0,
        errors: 0,
        parceiros_criados: [],
        total_criados: 0,
      };

      await trackStep("auto_cadastro_pdvs", async () => {
        try {
          telemetry.rpcs_executed.push("auto_cadastro_pdvs");

          // 1. Contagem total de parceiros distintos no lote
          const { data: batchStats } = await supabase.rpc("execute_readonly_query", {
            query_text: `
              SELECT 
                COUNT(DISTINCT s.cod_parceiro) as total_distinct_partners
              FROM public.cm_faturamento_staging s
              WHERE s.batch_id = '${batchId}'
                AND s.cod_parceiro IS NOT NULL
                AND s.cod_parceiro != ''
            `,
          });

          const totalDistinctInBatch = Number(batchStats?.[0]?.total_distinct_partners || 0);

          // 2. Identificar parceiros comerciais ELEGÍVEIS no lote (Regra Oficial Demanda 024)
          // Regra Primária: centro_resultado B2B ('KEY ACCOUNT', 'DISTRIBUIDOR', 'INSIDE SALES')
          // Regra Secundária: Exclusão de canais digitais/brindes/exportação
          // Regra de Operação: TOPs oficiais de venda/bonificação comercial ('1100', '1117', '1713', '1723')
          const { data: eligiblePartners, error: eligibleErr } = await supabase.rpc("execute_readonly_query", {
            query_text: `
              SELECT DISTINCT 
                s.cod_parceiro,
                s.nome_parceiro,
                s.uf,
                EXISTS (
                  SELECT 1 FROM public.base_atendimento b 
                  WHERE b.cod_parceiro = s.cod_parceiro
                ) as already_in_atendimento
              FROM public.cm_faturamento_staging s
              WHERE s.batch_id = '${batchId}'
                AND s.cod_parceiro IS NOT NULL
                AND s.cod_parceiro != ''
                AND UPPER(TRIM(COALESCE(s.centro_resultado, ''))) IN ('KEY ACCOUNT', 'DISTRIBUIDOR', 'INSIDE SALES')
                AND UPPER(TRIM(COALESCE(s.nome_vendedor, ''))) NOT IN (
                  'SHOPIFY', 'LIVELO', 'AMAZONFBA', 'AMAZONBR', 'MELI FULL', 'MELI', 
                  'SHOPEE', 'ANYMARKET', 'MAGALU', 'BRINDES', 'EXPORTAÇÃO'
                )
                AND s.cod_top IN ('1100', '1117', '1713', '1723')
            `,
          });

          if (eligibleErr) {
            console.warn("[AUTO_CADASTRO] Erro ao buscar parceiros elegíveis:", eligibleErr);
            autoCadastroResult.errors = 1;
            telemetry.auto_cadastro = autoCadastroResult;
            return;
          }

          const eligibleList = eligiblePartners || [];
          const eligibleCount = eligibleList.length;
          const alreadyExistsCount = eligibleList.filter((p: any) => p.already_in_atendimento === true).length;
          const missingEligible = eligibleList.filter((p: any) => !p.already_in_atendimento);
          const ignoredCount = Math.max(0, totalDistinctInBatch - eligibleCount);

          autoCadastroResult.eligible_found = eligibleCount;
          autoCadastroResult.already_exists = alreadyExistsCount;
          autoCadastroResult.ignored_non_commercial = ignoredCount;

          if (missingEligible.length > 0) {
            const toInsert = missingEligible.map((p: any) => ({
              cod_parceiro: String(p.cod_parceiro).trim(),
              nome_parceiro: String(p.nome_parceiro || '').trim(),
              uf: p.uf ? String(p.uf).trim().toUpperCase() : null,
              rede: null,
              canal: null,
              manager: null,
              status: "pendente",
            }));

            for (let i = 0; i < toInsert.length; i += 500) {
              const chunk = toInsert.slice(i, i + 500);
              const { error: insertErr } = await supabase
                .from("base_atendimento")
                .upsert(chunk, { onConflict: "cod_parceiro", ignoreDuplicates: true });
              if (insertErr) {
                console.warn("[AUTO_CADASTRO] Erro ao inserir chunk no base_atendimento:", insertErr);
                autoCadastroResult.errors += 1;
              }
            }

            autoCadastroResult.created = toInsert.length;
            autoCadastroResult.total_criados = toInsert.length;
            autoCadastroResult.parceiros_criados = toInsert.map((p: any) => p.cod_parceiro);
          }

          telemetry.auto_cadastro = autoCadastroResult;
        } catch (autoErr) {
          console.warn("[AUTO_CADASTRO] Falha não-bloqueante no auto-cadastro:", autoErr);
          autoCadastroResult.errors += 1;
          telemetry.auto_cadastro = autoCadastroResult;
        }
      });

      // 5d. Reconciliação Financeira Automática Pós-Promoção (Excel vs cm_faturamento vs public.sales)
      let reconciliationResult: {
        excelTotal: number;
        cmFaturamentoTotal: number;
        salesTotal: number;
        delta: number;
        isReconciled: boolean;
        periodStart: string | null;
        periodEnd: string | null;
        periodFormatted: string;
      } | null = null;

      await trackStep("reconciliacao_financeira", async () => {
        telemetry.rpcs_executed.push("reconciliacao_financeira");
        const pStartAnoMes = serverPeriodStart ? serverPeriodStart.substring(0, 7).replace("-", "_") : null;
        const pEndAnoMes = serverPeriodEnd ? serverPeriodEnd.substring(0, 7).replace("-", "_") : null;

        let salesNet = 0;
        if (pStartAnoMes && pEndAnoMes) {
          const { data: salesSum } = await supabase.rpc("execute_readonly_query", {
            query_text: `
              SELECT SUM(net_value) as total_sales
              FROM public.sales
              WHERE ano_mes >= '${pStartAnoMes}' AND ano_mes <= '${pEndAnoMes}'
            `,
          });
          salesNet = Number(salesSum?.[0]?.total_sales || 0);
        }

        const delta = Math.abs(actualPromotedNet - salesNet);
        reconciliationResult = {
          excelTotal: expectedNet,
          cmFaturamentoTotal: actualPromotedNet,
          salesTotal: salesNet,
          delta: delta,
          isReconciled: delta < 0.05,
          periodStart: serverPeriodStart,
          periodEnd: serverPeriodEnd,
          periodFormatted: `${serverPeriodStart} → ${serverPeriodEnd}`,
        };

        telemetry.reconciliation = reconciliationResult;
      });

      const totalDuration = Date.now() - startTime;
      telemetry.total_duration_ms = totalDuration;

      await this.updateLogProgress(
        batchId,
        100,
        "Importação Concluída com Sucesso",
        {
          duration_ms: totalDuration,
          rows_inserted: rowsPromoted,
          sub_status: "SUCCESS",
          telemetry,
        },
        "SUCCESS"
      );

      // Se foi um override homologado, atualizar relacionamentos de lote e registrar auditoria
      if (oldBatchIdToSupersede) {
        const { data: newLog } = await supabase.from("cm_sync_logs").select("metadata").eq("id", batchId).single();
        const newMeta = {
          ...(newLog?.metadata || {}),
          is_override: true,
          replacement_of_batch_id: oldBatchIdToSupersede,
          motivo_padrao: overrideReason?.motivo_padrao,
          motivo_descricao: overrideReason?.motivo_descricao || null,
          override_authorized_by: overrideReason?.user_id || overrideReason?.email,
        };
        await supabase.from("cm_sync_logs").update({ metadata: newMeta }).eq("id", batchId);

        const { data: oldLog } = await supabase.from("cm_sync_logs").select("metadata").eq("id", oldBatchIdToSupersede).single();
        const oldMeta = {
          ...(oldLog?.metadata || {}),
          superseded_by_batch_id: batchId,
        };
        await supabase.from("cm_sync_logs").update({ metadata: oldMeta }).eq("id", oldBatchIdToSupersede);

        if (overrideReason?.user_id) {
          await logAuditAction(overrideReason.user_id, "IMPORT_EXCEL_OVERRIDE_EXECUTED", "cm_sync_logs", {
            old_batch_id: oldBatchIdToSupersede,
            new_batch_id: batchId,
            motivo_padrao: overrideReason.motivo_padrao,
            motivo_descricao: overrideReason.motivo_descricao || null,
            role: overrideReason.role,
            email: overrideReason.email,
          });
        }
      }

      // Disparar evento de invalidação de cache desacoplado
      await CacheInvalidationService.onImportSuccess(batchId);

      return {
        success: true,
        rowsPromoted,
        reconciliation: reconciliationResult,
        autoCadastro: autoCadastroResult,
      };
    } catch (error: any) {
      console.error("[ImportService] Error during confirmImport, executing rollback:", error);
      
      const isIntegrityError = error instanceof IntegrityBarrierError || (typeof promotionStarted !== "undefined" && promotionStarted);

      // Executar rollback inteligente por batch_id
      try {
        // Deleta dados parciais inseridos na oficial
        await supabase.from("cm_faturamento").delete().eq("batch_id", batchId);
        // Limpa lista temporária de parceiros afetados
        await supabase.from("cm_import_affected_partners").delete().eq("batch_id", batchId);
        
        // TIPO A: Se for erro de integridade/promoção (ou se a promoção já começou), PRESERVAR a staging!
        // TIPO B: Apenas se o erro ocorreu ANTES do início da promoção, limpa a staging.
        if (!isIntegrityError) {
          await supabase.from("cm_faturamento_staging").delete().eq("batch_id", batchId);
        } else {
          console.warn(`[ImportService] Staging PRESERVADA para o lote ${batchId} devido a erro de integridade/promoção.`);
        }
      } catch (rollbackErr) {
        console.error("[ImportService] Rollback query failed:", rollbackErr);
      }

      let message = "";
      if (error instanceof Error) {
        message = error.message;
      } else if (error && typeof error === "object") {
        message = error.message || error.details || JSON.stringify(error);
      } else {
        message = String(error);
      }
      
      await supabase
        .from("cm_sync_logs")
        .update({
          status: "ERROR",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", batchId);

      throw error;
    }
  }

  /**
   * Rolls back a batch (deletes all records belonging to this batch)
   */
  static async rollbackImport(batchId: string): Promise<{ success: boolean; deletedCount: number }> {
    try {
      // 1. Delete rows from official table and staging table
      const { error: deleteError, count } = await supabase
        .from("cm_faturamento")
        .delete({ count: "exact" })
        .eq("batch_id", batchId);

      if (deleteError) throw deleteError;

      // Clean staging table if batch was still in staging
      await supabase
        .from("cm_faturamento_staging")
        .delete()
        .eq("batch_id", batchId);

      // 2. Fetch current metadata to preserve it
      const { data: current } = await supabase
        .from("cm_sync_logs")
        .select("metadata")
        .eq("id", batchId)
        .single();
      const currentMeta = current?.metadata || {};

      // 3. Update log to ERROR status with ROLLBACKED sub_status
      await supabase
        .from("cm_sync_logs")
        .update({
          status: "ERROR",
          error_message: "Importação desfeita pelo usuário.",
          metadata: {
            ...currentMeta,
            sub_status: "ROLLBACKED",
            rollback_at: new Date().toISOString(),
          },
        })
        .eq("id", batchId);

      // 4. Refresh views (Async Enqueue)
      try {
        await supabase.rpc("fn_enqueue_mv_refresh");
      } catch (mvErr) {
        console.warn("MV refresh enqueue failed (non-fatal):", mvErr);
      }

      return { success: true, deletedCount: count || 0 };
    } catch (error: unknown) {
      console.error("[ImportService] Error during rollbackImport:", error);
      throw error;
    }
  }
}
