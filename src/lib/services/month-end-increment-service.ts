import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export interface CommercialToleranceResult {
  referenceValue: number;
  calculatedValue: number;
  deltaAbsolute: number;
  deltaPercent: number;
  thresholdPercent: number;
  status: "NORMAL" | "WITHIN_COMMERCIAL_TOLERANCE" | "BLOCKED";
}

export function evaluateCommercialTolerance(
  referenceValue: number,
  calculatedValue: number,
  thresholdPercent: number = 3.0
): CommercialToleranceResult {
  const deltaAbsolute = Math.abs(calculatedValue - referenceValue);
  const deltaPercent = referenceValue > 0 ? (deltaAbsolute / referenceValue) * 100 : 0;

  let status: "NORMAL" | "WITHIN_COMMERCIAL_TOLERANCE" | "BLOCKED";
  if (deltaPercent <= 1.0) {
    status = "NORMAL";
  } else if (deltaPercent <= thresholdPercent) {
    status = "WITHIN_COMMERCIAL_TOLERANCE";
  } else {
    status = "BLOCKED";
  }

  return {
    referenceValue,
    calculatedValue,
    deltaAbsolute,
    deltaPercent,
    thresholdPercent,
    status,
  };
}

export interface ControlledIncrementParams {
  batchId: string;
  targetDate: string; // YYYY-MM-DD
  expectedRows: number;
  expectedNet: number;
  sourceFile?: string;
  sourceSha256?: string;
  justification?: string;
  isDryRun?: boolean;
}

export interface ControlledIncrementResult {
  success: boolean;
  mode: "DRY_RUN_SIMULATION" | "REAL_INCREMENT_COMMITTED" | "ERROR";
  batchId: string;
  targetDate: string;
  rowsInserted: number;
  netInserted: number;
  rowsBefore: number;
  netBefore: number;
  totalRowsAfter: number;
  totalNetAfter: number;
  kaNet: number;
  kaBonif: number;
  distNet: number;
  distBonif: number;
  insertExecutionMs?: number;
  recompositionExecutionMs?: number;
  totalExecutionMs?: number;
  message: string;
  error?: string;
}

export interface RollbackIncrementParams {
  batchId: string;
  targetDate: string;
  justification?: string;
}

export interface RollbackIncrementResult {
  success: boolean;
  mode: "ROLLBACK_COMMITTED" | "ERROR";
  batchId: string;
  targetDate: string;
  rowsDeleted: number;
  netDeleted: number;
  durationMs: number;
  message: string;
  error?: string;
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export class MonthEndIncrementService {
  private supabase: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.supabase = client || getSupabaseClient();
  }

  /**
   * Carga chunks na staging cm_faturamento_staging com idempotência por row_index
   */
  async loadRowsToStaging(
    batchId: string,
    rows: any[],
    chunkSize: number = 5000
  ): Promise<{ totalStaged: number }> {
    let totalStaged = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data, error } = await this.supabase.rpc("fn_bulk_insert_staging", {
        p_rows: chunk,
      });

      if (error) {
        throw new Error(`Falha ao inserir lote na staging (${i} a ${i + chunk.length}): ${error.message}`);
      }
      totalStaged += Number(data || chunk.length);
    }

    return { totalStaged };
  }

  /**
   * Executa simulação DRY-RUN sem mutação física no banco
   */
  async simulateIncrement(params: ControlledIncrementParams): Promise<ControlledIncrementResult> {
    const { data, error } = await this.supabase.rpc("executar_incremento_fechamento_mensal", {
      p_batch_id: params.batchId,
      p_target_date: params.targetDate,
      p_expected_rows: params.expectedRows,
      p_expected_net: params.expectedNet,
      p_justification: params.justification || "Simulação de fechamento incremental de fim de mês",
      p_source_file: params.sourceFile || null,
      p_source_sha256: params.sourceSha256 || null,
      p_dry_run: true,
    });

    if (error) {
      return {
        success: false,
        mode: "ERROR",
        batchId: params.batchId,
        targetDate: params.targetDate,
        rowsInserted: 0,
        netInserted: 0,
        rowsBefore: 0,
        netBefore: 0,
        totalRowsAfter: 0,
        totalNetAfter: 0,
        kaNet: 0,
        kaBonif: 0,
        distNet: 0,
        distBonif: 0,
        message: `Falha na simulação: ${error.message}`,
        error: error.message,
      };
    }

    return {
      success: true,
      mode: "DRY_RUN_SIMULATION",
      batchId: params.batchId,
      targetDate: params.targetDate,
      rowsInserted: 0,
      netInserted: Number(data.staging_net || 0),
      rowsBefore: Number(data.rows_before || 0),
      netBefore: Number(data.net_before || 0),
      totalRowsAfter: Number(data.projected_rows || 0),
      totalNetAfter: Number(data.projected_net || 0),
      kaNet: Number(data.ka_net_increment || 0),
      kaBonif: Number(data.ka_bonif_increment || 0),
      distNet: Number(data.dist_net_increment || 0),
      distBonif: Number(data.dist_bonif_increment || 0),
      totalExecutionMs: Number(data.execution_time_ms || 0),
      message: data.message || "Simulação aprovada com zero mutações físicas.",
    };
  }

  /**
   * Executa a operação real atômica com commit e refresh enfileirado
   */
  async executeIncrement(params: ControlledIncrementParams): Promise<ControlledIncrementResult> {
    const { data, error } = await this.supabase.rpc("executar_incremento_fechamento_mensal", {
      p_batch_id: params.batchId,
      p_target_date: params.targetDate,
      p_expected_rows: params.expectedRows,
      p_expected_net: params.expectedNet,
      p_justification: params.justification || "Fechamento incremental oficial de fim de mês",
      p_source_file: params.sourceFile || null,
      p_source_sha256: params.sourceSha256 || null,
      p_dry_run: false,
    });

    if (error) {
      throw new Error(`Falha no incremento controlado: ${error.message}`);
    }

    return {
      success: data.success,
      mode: data.mode,
      batchId: data.batch_id,
      targetDate: data.target_date,
      rowsInserted: Number(data.rows_inserted || 0),
      netInserted: Number(data.net_inserted || 0),
      rowsBefore: Number(data.rows_before || 0),
      netBefore: Number(data.net_before || 0),
      totalRowsAfter: Number(data.total_rows_after || 0),
      totalNetAfter: Number(data.total_net_after || 0),
      kaNet: Number(data.ka_net || 0),
      kaBonif: Number(data.ka_bonif || 0),
      distNet: Number(data.dist_net || 0),
      distBonif: Number(data.dist_bonif || 0),
      insertExecutionMs: Number(data.insert_execution_ms || 0),
      recompositionExecutionMs: Number(data.recomposition_execution_ms || 0),
      totalExecutionMs: Number(data.total_execution_ms || 0),
      message: data.message,
    };
  }

  /**
   * Executa rollback cirúrgico de um incremento prévio
   */
  async rollbackIncrement(params: RollbackIncrementParams): Promise<RollbackIncrementResult> {
    const { data, error } = await this.supabase.rpc("executar_rollback_incremento_mensal", {
      p_batch_id: params.batchId,
      p_target_date: params.targetDate,
      p_justification: params.justification || "Rollback cirúrgico de incremento",
    });

    if (error) {
      throw new Error(`Falha no rollback: ${error.message}`);
    }

    return {
      success: data.success,
      mode: data.mode,
      batchId: data.batch_id,
      targetDate: data.target_date,
      rowsDeleted: Number(data.rows_deleted || 0),
      netDeleted: Number(data.net_deleted || 0),
      durationMs: Number(data.duration_ms || 0),
      message: data.message,
    };
  }
}
