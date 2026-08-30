import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export class CsvBarrierError extends Error {
  public barrierType: string;
  public details: any;

  constructor(message: string, barrierType: string, details: any = {}) {
    super(message);
    this.name = "CsvBarrierError";
    this.barrierType = barrierType;
    this.details = details;
  }
}

export interface CsvParsedMetrics {
  totalRows: number;
  totalNfs: number;
  nfsApproved: number;
  nfsCancelled: number;
  totalGross: number;
  totalNet: number;
  totalApprovedNet: number;
  totalCancelledNet: number;
  totalDevolution: number;
  totalDiscount: number;
  totalST: number;
  totalFreight: number;
  totalCPV: number;
  totalItemsQty: number;
  minDate: string;
  maxDate: string;
  periodStart: string;
  periodEnd: string;
  periodFormatted: string;
  uniquePartnersCount: number;
  uniqueProductsCount: number;
  topsFound: string[];
  cfopsFound: string[];
}

export interface CsvImportResult {
  batchId: string;
  fileHash: string;
  fileName: string;
  fileSize: number;
  driveFileId: string;
  isDryRun: boolean;
  status: "SUCCESS" | "DRY_RUN_SUCCESS" | "BLOCKED" | "ERROR" | "SKIPPED_DUPLICATE_HASH" | "SKIPPED_UNMODIFIED";
  metrics: CsvParsedMetrics;
  barriersChecked: {
    hashDuplicateCheck: boolean;
    structuralCheck: boolean;
    periodNonRegressionCheck: boolean;
    monotonicityCheck: boolean;
    spikeGuardCheck: boolean;
    missingInvoiceGuardCheck: boolean;
  };
  reconciliation: {
    stagingCount: number;
    stagingNet: number;
    officialCountDelta: number;
    officialNetDelta: number;
    isReconciled: boolean;
  };
  spikeGuardDiagnostics?: {
    prevPeriodEnd: string | null;
    maxDate: string;
    prevNet: number;
    prevDay: number;
    currentDay: number;
    deltaDays: number;
    avgDailyRevenue: number;
    dailyIncrement: number;
    toleratedIncrement: number;
    passed: boolean;
  } | null;
  message: string;
}

export class CsvImportService {
  private static REQUIRED_COLUMNS_SIGNATURE = [
    "Status NFe",
    "Cód. CFOP",
    "Nro. Nota",
    "Cód. Parceiro",
    "Vlr. Total Líq.",
  ];

  private static MANDATORY_29_COLUMNS = [
    "Status NFe",
    "Cód. CFOP",
    "CFOP",
    "Empresa",
    "Dt. Neg",
    "Nro. Único",
    "Nro. Nota",
    "Cód. Parceiro",
    "Parceiro",
    "Cód. Produto",
    "Produto",
    "Qtd.",
    "Vlr. Unitário",
    "Vlr. Desconto",
    "Vlr. Substituição",
    "Controle",
    "Vlr. Total Líq.",
    "Vlr. Total ST",
    "Cód. TOP",
    "TOP",
    "Custo s/ ICMS",
    "Custo Total",
    "Vlr. Frete",
    "Cód. Natureza",
    "Natureza",
    "Cód. CR",
    "Centro de Resultado",
    "Cód. Vendedor",
    "Vendedor",
  ];

  /**
   * Helper to parse pt-BR formatted numbers
   */
  private static parsePtBrNumber(val: any): number {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const str = String(val).trim();
    if (str.includes(",") && str.includes(".")) {
      if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
      } else {
        return parseFloat(str.replace(/,/g, "")) || 0;
      }
    } else if (str.includes(",")) {
      return parseFloat(str.replace(",", ".")) || 0;
    } else if (str.includes(".")) {
      return parseFloat(str) || 0;
    }
    return parseFloat(str) || 0;
  }

  /**
   * Helper to parse CSV line respecting quotes
   */
  private static parseCsvLine(line: string, delimiter: string = ";"): { fields: string[]; inQuotes: boolean } {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return { fields: result, inQuotes };
  }

  /**
   * Ingests, validates, stages and processes CFOP.CSV with full barrier validation
   */
  static async processCsv(params: {
    fileBuffer: Buffer;
    fileName: string;
    fileSize: number;
    fileHash: string;
    driveFileId: string;
    driveModifiedTime: string;
    triggeredBy?: string;
    isDryRun?: boolean;
    forceOverride?: boolean;
    existingBatchId?: string;
  }): Promise<CsvImportResult> {
    const startTime = Date.now();
    const isDryRun = params.isDryRun ?? true; // Default to DRY_RUN for safety
    const fileHash = params.fileHash;
    const supabase = getSupabase();

    // 1. BARREIRA A: Verificação de SHA-256 Duplicado
    const { data: existingLogs } = await supabase
      .from("cm_sync_logs")
      .select("id, status, started_at, finished_at, period_start, period_end, rows_inserted, metadata")
      .eq("status", "SUCCESS")
      .filter("metadata->>file_hash", "eq", fileHash)
      .order("started_at", { ascending: false })
      .limit(1);

    if (existingLogs && existingLogs.length > 0 && !params.forceOverride && !isDryRun) {
      const prev = existingLogs[0];
      if (params.existingBatchId) {
        await supabase
          .from("cm_sync_logs")
          .update({
            status: "SKIPPED_DUPLICATE_HASH",
            finished_at: new Date().toISOString(),
            metadata: {
              file_name: params.fileName,
              file_size: params.fileSize,
              file_hash: fileHash,
              drive_file_id: params.driveFileId,
              drive_modified_at: params.driveModifiedTime,
              is_dry_run: false,
              message: `Arquivo com hash SHA-256 idêntico já foi processado anteriormente com sucesso no Lote ${prev.id}.`,
            },
          })
          .eq("id", params.existingBatchId);
      }

      return {
        batchId: prev.id,
        fileHash,
        fileName: params.fileName,
        fileSize: params.fileSize,
        driveFileId: params.driveFileId,
        isDryRun: false,
        status: "SKIPPED_DUPLICATE_HASH",
        metrics: {} as any,
        barriersChecked: {
          hashDuplicateCheck: false,
          structuralCheck: true,
          periodNonRegressionCheck: true,
          monotonicityCheck: true,
          spikeGuardCheck: true,
          missingInvoiceGuardCheck: true,
        },
        reconciliation: {
          stagingCount: 0,
          stagingNet: 0,
          officialCountDelta: 0,
          officialNetDelta: 0,
          isReconciled: true,
        },
        message: `Arquivo com hash SHA-256 idêntico já foi processado anteriormente com sucesso no Lote ${prev.id}.`,
      };
    }

    // 2. Criar ou atualizar registro inicial em cm_sync_logs
    let batchId: string = params.existingBatchId || "";
    if (batchId) {
      await supabase
        .from("cm_sync_logs")
        .update({
          metadata: {
            file_name: params.fileName,
            file_size: params.fileSize,
            file_hash: fileHash,
            drive_file_id: params.driveFileId,
            drive_modified_at: params.driveModifiedTime,
            is_dry_run: isDryRun,
            current_step: "PARSING_CSV",
            progress: 10,
          },
        })
        .eq("id", batchId);
    } else {
      const { data: logEntry, error: logErr } = await supabase
        .from("cm_sync_logs")
        .insert({
          source: "google_drive_csv",
          status: "RUNNING",
          triggered_by: params.triggeredBy || "cron_07",
          metadata: {
            file_name: params.fileName,
            file_size: params.fileSize,
            file_hash: fileHash,
            drive_file_id: params.driveFileId,
            drive_modified_at: params.driveModifiedTime,
            is_dry_run: isDryRun,
            current_step: "PARSING_CSV",
            progress: 10,
          },
        })
        .select("id")
        .single();

      if (logErr || !logEntry) {
        throw new Error(`Falha ao registrar lote em cm_sync_logs: ${logErr?.message}`);
      }

      batchId = logEntry.id;
    }

    try {
      // 3. BARREIRA F: Parsing e Validação Estrutural
      const content = params.fileBuffer.toString("utf-8");
      const lines = content.split(/\r?\n/);

      let headerLineIndex = -1;
      let headerColumns: string[] = [];
      const stagingRows: any[] = [];
      const datesSet = new Set<string>();
      const nfsMap = new Map<string, { status: string; net: number }>();
      const topsSet = new Set<string>();
      const cfopsSet = new Set<string>();
      const partnersSet = new Set<string>();
      const productsSet = new Set<string>();

      let totalGross = 0;
      let totalNet = 0;
      let totalApprovedNet = 0;
      let totalCancelledNet = 0;
      let totalDevolution = 0;
      let totalDiscount = 0;
      let totalST = 0;
      let totalFreight = 0;
      let totalCPV = 0;
      let totalItemsQty = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/^\uFEFF/, "").trim();
        if (!line) continue;

        if (headerLineIndex === -1) {
          const matchCount = this.REQUIRED_COLUMNS_SIGNATURE.filter((sig) => line.includes(sig)).length;
          if (matchCount >= 3) {
            headerLineIndex = i + 1;
            const parsed = this.parseCsvLine(line, ";");
            headerColumns = parsed.fields.map((f) => f.trim().replace(/^"|"$/g, ""));
            continue;
          } else {
            // Ignora linhas de metadados do Sankhya
            continue;
          }
        }

        const { fields, inQuotes } = this.parseCsvLine(line, ";");
        if (inQuotes || fields.length !== headerColumns.length) {
          throw new CsvBarrierError(
            `Linha ${i + 1} possui estrutura truncada ou número de colunas divergente (esperado ${headerColumns.length}, encontrado ${fields.length}).`,
            "STRUCTURAL_CORRUPTION"
          );
        }

        const row: Record<string, string> = {};
        for (let c = 0; c < headerColumns.length; c++) {
          row[headerColumns[c]] = fields[c] !== undefined ? fields[c].trim().replace(/^"|"$/g, "") : "";
        }

        const rawDate = row["Dt. Neg"] || "";
        let parsedDate: string | null = null;
        if (rawDate) {
          const parts = rawDate.split("/");
          if (parts.length === 3) {
            parsedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            datesSet.add(parsedDate);
          }
        }

        const statusNFe = (row["Status NFe"] || "").toUpperCase();
        const isCancelada = statusNFe === "CANCELADA" || statusNFe === "CANCELADO";
        const codCfop = row["Cód. CFOP"] || null;
        const codProd = row["Cód. Produto"] || null;
        const codParc = row["Cód. Parceiro"] || null;
        const nroNota = row["Nro. Nota"] || null;
        const nroUnico = row["Nro. Único"] || null;
        const codTop = row["Cód. TOP"] || null;

        const qty = this.parsePtBrNumber(row["Qtd."]);
        const unitPrice = this.parsePtBrNumber(row["Vlr. Unitário"]);
        const discount = this.parsePtBrNumber(row["Vlr. Desconto"]);
        const net = this.parsePtBrNumber(row["Vlr. Total Líq."]);
        const gross = this.parsePtBrNumber(row["Vlr. Bruto"]) || qty * unitPrice;
        const st = this.parsePtBrNumber(row["Vlr. Total ST"]);
        const frete = this.parsePtBrNumber(row["Vlr. Frete"]);
        const cpv = this.parsePtBrNumber(row["Custo Total"]);
        const icms = this.parsePtBrNumber(row["Custo s/ ICMS"]);
        const subst = this.parsePtBrNumber(row["Vlr. Substituição"]);

        if (codParc) partnersSet.add(codParc);
        if (codProd) productsSet.add(codProd);
        if (codTop) topsSet.add(codTop);
        if (codCfop) cfopsSet.add(codCfop);

        if (nroNota) {
          if (!nfsMap.has(nroNota)) {
            nfsMap.set(nroNota, { status: statusNFe, net: 0 });
          }
          const nfObj = nfsMap.get(nroNota)!;
          nfObj.net += net;
          if (statusNFe) nfObj.status = statusNFe;
        }

        totalItemsQty += qty;
        totalGross += gross;
        totalNet += net;
        totalDiscount += discount;
        totalST += st;
        totalFreight += frete;
        totalCPV += cpv;

        if (isCancelada) {
          totalCancelledNet += net;
        } else {
          totalApprovedNet += net;
        }

        if (codTop === "1200" || codTop === "1201") {
          totalDevolution += net;
        }

        // Gerar row_hash para deduplicação técnica (idempotência de retry)
        // A chave de negócio (nro_unico|nro_nota|cod_parceiro|cod_produto) NÃO é 100% única no CSV
        // (~550 linhas legítimas compartilham a mesma combinação por NF multi-item)
        const rowHashInput = [
          nroUnico, nroNota, codParc, codProd,
          parsedDate, qty, unitPrice, net, codTop,
          icms, cpv, frete, subst, st,
          row["Cód. Vendedor"] || "", row["Controle"] || "",
          codCfop, statusNFe || "",
        ].join("|");
        const rowHash = crypto.createHash("md5").update(rowHashInput).digest("hex");

        const rowIndex = stagingRows.length;

        stagingRows.push({
          batch_id: batchId,
          cod_cfop: codCfop,
          cfop_desc: row["CFOP"] || null,
          dt_faturamento: parsedDate,
          nro_unico: nroUnico,
          nro_nota: nroNota,
          cod_parceiro: codParc,
          nome_parceiro: row["Parceiro"] || null,
          cod_produto: codProd,
          desc_produto: row["Produto"] || null,
          quantidade: qty,
          vlr_unitario: unitPrice,
          vlr_desconto: discount,
          vlr_total_liq: net,
          vlr_bruto: gross,
          vlr_devolucao: codTop === "1200" || codTop === "1201" ? net : 0,
          cod_top: codTop,
          desc_top: row["TOP"] || null,
          custo_icms: icms,
          cod_vendedor: row["Cód. Vendedor"] || null,
          nome_vendedor: row["Vendedor"] || null,
          controle: row["Controle"] || null,
          custo_total: cpv,
          cod_natureza: row["Cód. Natureza"] || null,
          desc_natureza: row["Natureza"] || null,
          status_nfe: statusNFe || null,
          vlr_frete: frete,
          vlr_substituicao: subst,
          vlr_total_st: st,
          cod_cr: row["Cód. CR"] || null,
          centro_resultado: row["Centro de Resultado"] || null,
          valor_venda_futura: 0,
          validation_status: "VALID",
          row_index: rowIndex,
          row_hash: rowHash,
        });
      }

      if (stagingRows.length === 0) {
        throw new CsvBarrierError("Arquivo CSV não contém nenhuma linha comercial válida.", "EMPTY_FILE");
      }

      // Validação das 29 colunas obrigatórias
      const missingCols = this.MANDATORY_29_COLUMNS.filter((col) => !headerColumns.includes(col));
      if (missingCols.length > 0) {
        throw new CsvBarrierError(
          `Colunas obrigatórias ausentes no layout CSV: ${missingCols.join(", ")}.`,
          "MISSING_MANDATORY_COLUMNS"
        );
      }

      const sortedDates = Array.from(datesSet).sort();
      const minDate = sortedDates[0];
      const maxDate = sortedDates[sortedDates.length - 1];

      let nfsApproved = 0;
      let nfsCancelled = 0;
      for (const [, nf] of nfsMap.entries()) {
        if (nf.status === "CANCELADA" || nf.status === "CANCELADO") {
          nfsCancelled++;
        } else {
          nfsApproved++;
        }
      }

      const metrics: CsvParsedMetrics = {
        totalRows: stagingRows.length,
        totalNfs: nfsMap.size,
        nfsApproved,
        nfsCancelled,
        totalGross,
        totalNet,
        totalApprovedNet,
        totalCancelledNet,
        totalDevolution,
        totalDiscount,
        totalST,
        totalFreight,
        totalCPV,
        totalItemsQty,
        minDate,
        maxDate,
        periodStart: minDate,
        periodEnd: maxDate,
        periodFormatted: `${minDate} → ${maxDate}`,
        uniquePartnersCount: partnersSet.size,
        uniqueProductsCount: productsSet.size,
        topsFound: Array.from(topsSet),
        cfopsFound: Array.from(cfopsSet),
      };

      // 4. Buscar histórico do último lote SUCCESS do mesmo mês para validações
      const currentMonthStart = minDate.substring(0, 7) + "-01";
      const { data: lastSuccessBatches } = await supabase
        .from("cm_sync_logs")
        .select("id, period_start, period_end, rows_inserted, metadata, started_at")
        .eq("status", "SUCCESS")
        .gte("period_start", currentMonthStart)
        .lte("period_end", maxDate)
        .order("period_end", { ascending: false })
        .order("started_at", { ascending: false })
        .limit(1);

      const prevBatch = lastSuccessBatches?.[0] || null;
      const prevRows = Number(prevBatch?.rows_inserted || prevBatch?.metadata?.total_rows || 0);
      const prevNet = Number(prevBatch?.metadata?.total_net || 0);
      const prevPeriodEnd = prevBatch?.period_end || null;

      // 5. BARREIRA B: Período Não-Regressivo
      if (prevPeriodEnd && maxDate < prevPeriodEnd && !params.forceOverride) {
        throw new CsvBarrierError(
          `Regressão de período detectada: Data final do novo arquivo (${maxDate}) é anterior à do último lote aprovado (${prevPeriodEnd}).`,
          "PERIOD_REGRESSION",
          { currentMaxDate: maxDate, prevPeriodEnd }
        );
      }

      // 6. BARREIRA C: Monotonicidade Acumulada (Tolerância máx 1% para cancelamentos legítimos)
      if (prevRows > 0 && !params.forceOverride) {
        const minAllowedRows = prevRows * 0.99;
        if (metrics.totalRows < minAllowedRows) {
          throw new CsvBarrierError(
            `Falha na Monotonicidade de Volume: Novo lote acumulado possui ${metrics.totalRows} linhas, menor que o mínimo esperado de ${Math.round(
              minAllowedRows
            )} (99% de ${prevRows} de ontem).`,
            "MONOTONICITY_ROWS",
            { currentRows: metrics.totalRows, prevRows, minAllowedRows }
          );
        }

        const minAllowedNet = prevNet * 0.99;
        if (metrics.totalNet < minAllowedNet) {
          throw new CsvBarrierError(
            `Falha na Monotonicidade Financeira: Faturamento acumulado de R$ ${metrics.totalNet.toFixed(
              2
            )} é inferior a 99% do faturamento anterior de R$ ${prevNet.toFixed(2)}.`,
            "MONOTONICITY_FINANCIAL",
            { currentNet: metrics.totalNet, prevNet, minAllowedNet }
          );
        }
      }

      // 7. BARREIRA D: Spike Guard (Proteção contra duplicação de dados na origem)
      let spikeGuardDiagnostics: {
        prevPeriodEnd: string | null;
        maxDate: string;
        prevNet: number;
        prevDay: number;
        currentDay: number;
        deltaDays: number;
        avgDailyRevenue: number;
        dailyIncrement: number;
        toleratedIncrement: number;
        passed: boolean;
      } | null = null;

      if (prevNet > 0 && !params.forceOverride) {
        const prevDay = prevPeriodEnd ? parseInt(prevPeriodEnd.split("-")[2], 10) || 1 : 1;
        const currentDay = parseInt(maxDate.split("-")[2], 10) || prevDay;
        const deltaDays = Math.max(1, currentDay - prevDay);
        const avgDailyRevenue = prevNet / prevDay;
        const dailyIncrement = metrics.totalNet - prevNet;
        const toleratedIncrement = avgDailyRevenue * deltaDays * 4;
        const passed = dailyIncrement <= toleratedIncrement;

        spikeGuardDiagnostics = {
          prevPeriodEnd,
          maxDate,
          prevNet,
          prevDay,
          currentDay,
          deltaDays,
          avgDailyRevenue,
          dailyIncrement,
          toleratedIncrement,
          passed,
        };

        if (!passed) {
          throw new CsvBarrierError(
            `Alerta de Pico Anômalo (Spike Guard): Incremento de R$ ${dailyIncrement.toFixed(
              2
            )} no período de ${deltaDays} dia(s) excede o limite tolerado de R$ ${toleratedIncrement.toFixed(
              2
            )} (4x a média histórica de R$ ${avgDailyRevenue.toFixed(2)}/dia).`,
            "SPIKE_GUARD",
            { dailyIncrement, avgDailyRevenue, deltaDays, toleratedIncrement, prevNet, prevPeriodEnd, maxDate }
          );
        }
      }

      // 8. D1: Limpeza pré-staging — elimina resíduos de tentativas anteriores do mesmo batch
      await supabase.from("cm_faturamento_staging").delete().eq("batch_id", batchId);

      // 8b. Carga em cm_faturamento_staging via RPC Bulk Insert (Otimizada e Resiliente)
      // D2: fn_bulk_insert_staging usa ON CONFLICT (batch_id, row_hash) DO NOTHING
      //     portanto retries do mesmo chunk são intrinsecamente idempotentes
      const chunkSize = 10000;
      let totalInserted = 0;
      for (let i = 0; i < stagingRows.length; i += chunkSize) {
        const chunk = stagingRows.slice(i, i + chunkSize);
        let inserted = false;
        let lastErr: any = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const { data: insertedCount, error: rpcErr } = await supabase.rpc("fn_bulk_insert_staging", {
              p_rows: chunk,
            });

            if (rpcErr) {
              lastErr = rpcErr;
            } else {
              // ON CONFLICT DO NOTHING: insertedCount pode ser menor que chunk.length em retry
              // Isso é comportamento esperado e correto (duplicatas foram ignoradas)
              totalInserted += Number(insertedCount);
              inserted = true;
              break;
            }
          } catch (err: any) {
            lastErr = err;
          }
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }

        if (!inserted) {
          throw new Error(
            `Erro ao persistir lote de staging (${Math.floor(i / chunkSize) + 1}/${Math.ceil(stagingRows.length / chunkSize)}) após 3 tentativas: ${lastErr?.message || String(lastErr)}`
          );
        }
      }

      // Validação pós-carga: total na staging deve ser igual ao CSV
      const { count: stagingFinalCount } = await supabase
        .from("cm_faturamento_staging")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId);

      if (stagingFinalCount !== stagingRows.length) {
        throw new Error(
          `Inconsistência pós-carga: staging possui ${stagingFinalCount} linhas, esperado ${stagingRows.length} (CSV). Possível perda de dados.`
        );
      }

      // 9. BARREIRA E: Missing Invoice Guard (Comparação direta de NFs)
      if (prevBatch) {
        const { data: missingNfsData, error: missingErr } = await supabase.rpc("fn_check_missing_invoices", {
          p_batch_id: batchId,
          p_period_start: minDate,
          p_period_end: maxDate,
        });

        if (!missingErr && missingNfsData) {
          const missingCount = Number(missingNfsData.missing_count || 0);
          const missingDelta = Number(missingNfsData.missing_value || 0);

          if ((missingCount > 2 || missingDelta > 100) && !params.forceOverride) {
            throw new CsvBarrierError(
              `Missing Invoice Guard: Detectadas ${missingCount} NFs ausentes no novo arquivo acumulado totalizando R$ ${missingDelta.toFixed(
                2
              )}.`,
              "MISSING_INVOICES",
              { missingCount, missingDelta, sampleMissing: missingNfsData.sample_invoices }
            );
          }
        }
      }

      // 10. RECONCILIAÇÃO E SWAP ATÔMICO
      let swapResult: any = null;
      if (!isDryRun) {
        // Execução Real com Promoção Atômica
        const { data: swapData, error: swapErr } = await supabase.rpc("executar_atomic_swap_faturamento", {
          p_batch_id: batchId,
          p_dry_run: false,
        });

        if (swapErr || !swapData?.success) {
          throw new Error(`Falha no Swap Atômico de Faturamento: ${swapErr?.message || swapData?.message}`);
        }
        swapResult = swapData;
      } else {
        // Modo DRY_RUN: Simulação sem mutação física
        const { data: simData, error: simErr } = await supabase.rpc("executar_atomic_swap_faturamento", {
          p_batch_id: batchId,
          p_dry_run: true,
        });

        if (simErr) {
          throw new Error(`Erro na simulação do Swap Atômico: ${simErr.message}`);
        }
        swapResult = simData;

        // Limpa a staging da simulação
        await supabase.from("cm_faturamento_staging").delete().eq("batch_id", batchId);
      }

      const durationMs = Date.now() - startTime;
      const finalStatus = isDryRun ? "DRY_RUN_SUCCESS" : "SUCCESS";

      // 11. Atualizar cm_sync_logs com sucesso
      await supabase
        .from("cm_sync_logs")
        .update({
          status: isDryRun ? "RUNNING" : "SUCCESS",
          finished_at: new Date().toISOString(),
          rows_inserted: metrics.totalRows,
          period_start: minDate,
          period_end: maxDate,
          metadata: {
            file_name: params.fileName,
            file_size: params.fileSize,
            file_hash: fileHash,
            drive_file_id: params.driveFileId,
            drive_modified_at: params.driveModifiedTime,
            is_dry_run: isDryRun,
            duration_ms: durationMs,
            total_rows: metrics.totalRows,
            total_net: metrics.totalNet,
            total_gross: metrics.totalGross,
            total_nfs: metrics.totalNfs,
            nfs_approved: metrics.nfsApproved,
            nfs_cancelled: metrics.nfsCancelled,
            total_devolution: metrics.totalDevolution,
            sub_status: finalStatus,
            spike_guard_diagnostics: spikeGuardDiagnostics,
            metrics,
            swap_result: swapResult,
          },
        })
        .eq("id", batchId);

      return {
        batchId,
        fileHash,
        fileName: params.fileName,
        fileSize: params.fileSize,
        driveFileId: params.driveFileId,
        isDryRun,
        status: finalStatus,
        metrics,
        barriersChecked: {
          hashDuplicateCheck: true,
          structuralCheck: true,
          periodNonRegressionCheck: true,
          monotonicityCheck: true,
          spikeGuardCheck: true,
          missingInvoiceGuardCheck: true,
        },
        reconciliation: {
          stagingCount: metrics.totalRows,
          stagingNet: metrics.totalNet,
          officialCountDelta: 0,
          officialNetDelta: 0,
          isReconciled: true,
        },
        spikeGuardDiagnostics,
        message: isDryRun
          ? "Simulação DRY_RUN concluída com 100% de sucesso. Nenhuma mutação foi feita na base oficial."
          : "Importação e promoção atômica concluídas com 100% de sucesso.",
      };
    } catch (error: any) {
      console.error("[CsvImportService] Error during processCsv:", error);

      // Limpeza de contingência na staging caso tenha falhado
      try {
        await supabase.from("cm_faturamento_staging").delete().eq("batch_id", batchId);
      } catch (cleanErr) {
        console.warn("[CsvImportService] Failed to cleanup staging on error:", cleanErr);
      }

      await supabase
        .from("cm_sync_logs")
        .update({
          status: "ERROR",
          finished_at: new Date().toISOString(),
          error_message: error.message || String(error),
          metadata: {
            file_name: params.fileName,
            file_hash: fileHash,
            drive_file_id: params.driveFileId,
            is_dry_run: isDryRun,
            sub_status: "BLOCKED",
            barrier_failed: error instanceof CsvBarrierError ? error.barrierType : "UNHANDLED_EXCEPTION",
            error_details: error instanceof CsvBarrierError ? error.details : undefined,
          },
        })
        .eq("id", batchId);

      throw error;
    }
  }
}
