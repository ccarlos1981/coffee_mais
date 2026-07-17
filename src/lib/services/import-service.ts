import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Service-role Supabase client to bypass RLS in the staging/import pipelines
const supabase = createClient(supabaseUrl, supabaseKey);

export interface ImportPreviewResult {
  batchId: string;
  filename: string;
  fileSize: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  totalRows: number;
  uniquePartners: number;
  uniqueProducts: number;
  totalGross: number;
  totalDevolution: number;
  totalNet: number;
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
    triggeredBy: string
  ): Promise<ImportPreviewResult> {
    const startTime = Date.now();

    // 1. Calculate SHA-256 hash of the file
    const fileHash = crypto
      .createHash("sha256")
      .update(Buffer.from(fileBuffer))
      .digest("hex");

    // 2. Check if this exact file hash has already been successfully imported
    const { data: duplicateCheck, error: dupError } = await supabase
      .from("cm_sync_logs")
      .select("id")
      .eq("status", "SUCCESS")
      .eq("source", "excel")
      .filter("metadata->>file_hash", "eq", fileHash)
      .limit(1);

    if (dupError) {
      console.error("[analyzeExcel] duplicateCheck query error:", dupError);
    }

    if (duplicateCheck && duplicateCheck.length > 0) {
      throw new Error(`Este arquivo já foi importado anteriormente (Lote ID: ${duplicateCheck[0].id}).`);
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
      await this.updateLogProgress(batchId, 10, "Lendo Arquivo");

      // 4. Parse Excel Workbook
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      let sheet: XLSX.WorkSheet | null = null;
      let sheetName = "";

      // Find the first sheet that matches the faturamento columns
      const expectedKeys = ["Cód. CFOP", "Dt. Neg", "Produto"];
      for (const name of workbook.SheetNames) {
        const s = workbook.Sheets[name];
        const rawRows = XLSX.utils.sheet_to_json(s, { header: 1 }) as any[][];
        // Scan first 20 rows for headers
        for (let i = 0; i < Math.min(20, rawRows.length); i++) {
          const row = rawRows[i];
          if (row && Array.isArray(row)) {
            const matchCount = expectedKeys.filter((k) => row.includes(k)).length;
            if (matchCount >= 2) {
              sheet = s;
              sheetName = name;
              break;
            }
          }
        }
        if (sheet) break;
      }

      if (!sheet) {
        throw new Error(
          "Não foi encontrada nenhuma aba de faturamento válida no arquivo. Certifique-se de que a planilha contenha as colunas obrigatórias: 'Cód. CFOP', 'Dt. Neg' e 'Produto'."
        );
      }

      await this.updateLogProgress(batchId, 30, "Validando registros");

      // 5. Parse rows and execute validation
      // Find header range row index
      let headerIndex = 0;
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      for (let i = 0; i < Math.min(20, rawRows.length); i++) {
        const row = rawRows[i];
        if (row && expectedKeys.filter((k) => row.includes(k)).length >= 2) {
          headerIndex = i;
          break;
        }
      }

      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: null,
        range: headerIndex,
      });

      const inconsistencies: ImportPreviewResult["inconsistencies"] = [];
      const stagingRows: any[] = [];
      const partnersSet = new Set<string>();
      const productsSet = new Set<string>();
      const datesList: string[] = [];

      let totalGross = 0;
      let totalDevolution = 0;
      let totalNet = 0;
      let errorsCount = 0;
      let warningsCount = 0;

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
        const lineNum = index + headerIndex + 2; // Excel row numbering is 1-indexed, and header offset is applied

        const rawDate = row["Dt. Neg"] || row["Data Faturamento"];
        const parsedDate = parseRowDate(rawDate);
        const codCfop = row["Cód. CFOP"] ? String(row["Cód. CFOP"]).trim() : null;
        const codProduto = row["Cód. Produto"] ? String(row["Cód. Produto"]).trim() : null;
        const codParceiro = row["Cód. Parceiro"] ? String(row["Cód. Parceiro"]).trim() : null;

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
        
        // Faturamento Líquido calculation rule:
        let netVal = row["Vlr. Total Líq."] !== undefined && row["Vlr. Total Líq."] !== null 
          ? parseNumber(row["Vlr. Total Líq."]) 
          : null;

        const bruto = parseNumber(row["Vlr. Bruto"] || row["Faturamento Bruto"] || (qty * unitPrice));
        const dev = parseNumber(row["Vlr. Devolução"] || row["Devolução"]);

        if (netVal === null) {
          netVal = bruto - dev;
        }

        // Metrics aggregation
        if (parsedDate) datesList.push(parsedDate);
        if (codParceiro) partnersSet.add(codParceiro);
        if (codProduto) productsSet.add(codProduto);

        totalGross += bruto;
        totalDevolution += dev;
        totalNet += netVal;

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
          status_nfe: row["Status NFe"] ? String(row["Status NFe"]).trim() : null,
          vlr_frete: parseNumber(row["Vlr. Frete"]),
          vlr_substituicao: parseNumber(row["Vlr. Substituição"]),
          vlr_total_st: parseNumber(row["Vlr. Total ST"]),
          cod_cr: row["Cód. CR"] ? String(row["Cód. CR"]).trim() : null,
          centro_resultado: row["Centro de Resultado"] ? String(row["Centro de Resultado"]).trim() : null,
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

      // 6. Write parsed rows into the staging table in chunks
      const chunkSize = 200;
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

      // 7. Check if data already exists in the official table for this period, and query statistics
      const { data: dbStats } = await supabase
        .from("cm_faturamento")
        .select("cod_parceiro, cod_produto, vlr_total_liq, nro_unico")
        .gte("dt_faturamento", periodStart)
        .lte("dt_faturamento", periodEnd);

      const needsConfirmation = (dbStats && dbStats.length > 0) || false;

      let currentBaseStats: ImportPreviewResult["currentBaseStats"] = null;
      if (needsConfirmation && dbStats) {
        currentBaseStats = {
          totalRows: dbStats.length,
          uniquePartners: new Set(dbStats.map(r => r.cod_parceiro).filter(Boolean)).size,
          uniqueProducts: new Set(dbStats.map(r => r.cod_produto).filter(Boolean)).size,
          totalNet: dbStats.reduce((sum, r) => sum + (Number(r.vlr_total_liq) || 0), 0),
        };
      }

      const totalRowsCount = jsonData.length || 1;
      const qualityScore = Math.max(0, parseFloat((100 - (errorsCount * 100 / totalRowsCount) - (warningsCount * 15 / totalRowsCount)).toFixed(1)));

      const validationChecklist = {
        layoutRecognized: true,
        headersValid: true,
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
        period: periodStr,
        periodStart,
        periodEnd,
        totalRows: stagingRows.length,
        uniquePartners: partnersSet.size,
        uniqueProducts: productsSet.size,
        totalGross,
        totalDevolution,
        totalNet,
        warningsCount,
        errorsCount,
        qualityScore,
        inconsistencies: inconsistencies.slice(0, 100), // Cap output size for safety
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
          period_start: periodStart,
          period_end: periodEnd,
          period: periodStr,
          total_rows: stagingRows.length,
          unique_partners: partnersSet.size,
          unique_products: productsSet.size,
          total_gross: totalGross,
          total_devolution: totalDevolution,
          total_net: totalNet,
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
  static async confirmImport(batchId: string, mode: "replace" | "append"): Promise<{ success: boolean; rowsPromoted: number }> {
    const startTime = Date.now();
    await this.updateLogProgress(batchId, 95, "Persistindo na Tabela Oficial");

    try {
      // Call transaction-safe RPC
      const { data, error } = await supabase.rpc("confirmar_importacao_faturamento", {
        p_batch_id: batchId,
        p_mode: mode,
      });

      if (error) throw error;

      // Refresh views (Async Enqueue)
      try {
        await this.updateLogProgress(batchId, 98, "Atualizando Dashboards (assíncrono)");
        await supabase.rpc("fn_enqueue_mv_refresh", { p_batch_id: batchId });
      } catch (mvErr) {
        console.warn("MV refresh enqueue failed (non-fatal):", mvErr);
      }

      const rowsPromoted = data?.rowsPromoted || 0;
      await this.updateLogProgress(
        batchId,
        100,
        "Importação Concluída com Sucesso",
        { duration_ms: Date.now() - startTime, rows_inserted: rowsPromoted, sub_status: "SUCCESS" },
        "SUCCESS"
      );

      return { success: true, rowsPromoted };
    } catch (error: any) {
      console.error("[ImportService] Error during confirmImport:", error);
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

      // Clean staging for this batch to avoid clutter
      await supabase.from("cm_faturamento_staging").delete().eq("batch_id", batchId);

      throw error;
    }
  }

  /**
   * Rolls back a batch (deletes all records belonging to this batch)
   */
  static async rollbackImport(batchId: string): Promise<{ success: boolean; deletedCount: number }> {
    try {
      // 1. Delete rows from official table
      const { error: deleteError, count } = await supabase
        .from("cm_faturamento")
        .delete({ count: "exact" })
        .eq("batch_id", batchId);

      if (deleteError) throw deleteError;

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
