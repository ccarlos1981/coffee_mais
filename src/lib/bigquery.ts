import { BigQuery } from "@google-cloud/bigquery";

// ─── Configuration ───
export const SYNC_CONFIG = {
  BATCH_SIZE: 500,          // rows per Supabase UPSERT
  STREAM_THRESHOLD: 5_000,  // above this, use streaming
  TIMEOUT_MS: 55_000,       // safety margin (Vercel Pro = 60s)
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1_000,    // exponential backoff base
} as const;

// ─── Trigger types ───
export type SyncTrigger = "manual" | "cron_06" | "cron_12" | "cron_18" | "reconciliation";

// ─── BigQuery Client (singleton) ───
let _client: BigQuery | null = null;

function getBigQueryClient(): BigQuery {
  if (_client) return _client;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing BigQuery credentials. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, and GOOGLE_CLOUD_PRIVATE_KEY."
    );
  }

  _client = new BigQuery({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
  });

  return _client;
}

// ─── Row shape coming from BigQuery VIEW ───
// The VIEW v_sales_coffee_mais centralizes ALL Sankhya business rules.
// The app NEVER queries raw tables directly.
export interface BigQuerySalesRow {
  dt_faturamento: string;
  nro_unico: string;
  nro_nota: string;
  cod_parceiro: string;
  nome_parceiro: string | null;
  cod_produto: string;
  desc_produto: string | null;
  sequencia: string;
  quantidade: number;
  vlr_unitario: number;
  vlr_desconto: number;
  vlr_total_liq: number;
  cod_top: string;
  custo_icms: number;
  cod_vendedor: string | null;
  nome_vendedor: string | null;
  controle: string | null;
  custo_total: number;
  cod_natureza: string | null;
  status_nfe: string | null;
  vlr_frete: number;
  vlr_substituicao: number;
  cod_cr: string | null;
  empresa: string | null;
  cod_cfop: string | null;
  chave_bq: string;
}

// ─── Map BigQuery row → Supabase cm_faturamento_sankhya row ───
export function mapToFaturamentoRow(row: BigQuerySalesRow) {
  return {
    chave_bq: row.chave_bq,
    cod_cfop: row.cod_cfop || null,
    cfop_desc: null,
    dt_faturamento: row.dt_faturamento,
    nro_unico: row.nro_unico,
    nro_nota: row.nro_nota,
    cod_parceiro: row.cod_parceiro,
    nome_parceiro: row.nome_parceiro,
    cod_produto: row.cod_produto,
    desc_produto: row.desc_produto,
    quantidade: Number(row.quantidade) || 0,
    vlr_unitario: Number(row.vlr_unitario) || 0,
    vlr_desconto: Number(row.vlr_desconto) || 0,
    vlr_total_liq: Number(row.vlr_total_liq) || 0,
    cod_top: row.cod_top,
    desc_top: null,
    custo_icms: Number(row.custo_icms) || 0,
    cod_vendedor: row.cod_vendedor,
    nome_vendedor: row.nome_vendedor,
    controle: row.controle?.trim() || null,
    custo_total: Number(row.custo_total) || 0,
    cod_natureza: row.cod_natureza,
    desc_natureza: null,
    status_nfe: row.status_nfe,
    vlr_frete: Number(row.vlr_frete) || 0,
    vlr_substituicao: Number(row.vlr_substituicao) || 0,
    vlr_total_st: Number(row.vlr_substituicao) || 0,
    cod_cr: row.cod_cr,
    centro_resultado: null,
  };
}

// ─── VIEW-based query ───
// All business rules (TIPMOV, CODTIPOPER filters, STATUSNFE, JOINs with
// tgfpar/tgfpro/tgfven, chave_bq generation) live in the BigQuery VIEW.
//
// chave_bq composition (defined in the VIEW):
//   CONCAT(NUNOTA, '_', SEQUENCIA)
//
// - NUNOTA: unique note identifier in Sankhya (tgfcab)
// - SEQUENCIA: item sequence within the note (tgfite)
// Together they form a globally unique key per item-per-note.
//
// Why not include CODPROD? Because SEQUENCIA already guarantees uniqueness
// within a note — each line item has a unique sequence number.
const VIEW_NAME = "`coffee-mais-mkt-data-lake.sankhya.v_sales_coffee_mais`";

const SALES_QUERY = `
  SELECT *
  FROM ${VIEW_NAME}
  WHERE dt_faturamento >= @startDate
    AND dt_faturamento <= @endDate
`;

const COUNT_QUERY = `
  SELECT COUNT(*) as total
  FROM ${VIEW_NAME}
  WHERE dt_faturamento >= @startDate
    AND dt_faturamento <= @endDate
`;

// ─── Cancellation detection query ───
// Finds chave_bq values that exist in Supabase for the period but are
// NO LONGER present in the BigQuery VIEW (meaning the note was cancelled,
// deleted, or excluded by business rules).
const CANCELLED_QUERY = `
  SELECT chave_bq
  FROM UNNEST(@existingKeys) AS chave_bq
  WHERE chave_bq NOT IN (
    SELECT chave_bq FROM ${VIEW_NAME}
    WHERE dt_faturamento >= @startDate
      AND dt_faturamento <= @endDate
  )
`;

/**
 * Fetch all rows for a period using auto-pagination (loads into memory).
 * Best for small periods (2 days ≈ 500-2,000 rows).
 */
export async function queryFaturamentoDirect(
  startDate: string,
  endDate: string
): Promise<BigQuerySalesRow[]> {
  const client = getBigQueryClient();

  const [rows] = await client.query({
    query: SALES_QUERY,
    params: { startDate, endDate },
  });

  return rows as BigQuerySalesRow[];
}

/**
 * Fetch rows using streaming for large periods.
 * Yields batches of BATCH_SIZE rows to avoid memory pressure.
 * Best for reconciliation (30 days ≈ 15,000-50,000 rows).
 */
export async function* queryFaturamentoStream(
  startDate: string,
  endDate: string
): AsyncGenerator<BigQuerySalesRow[]> {
  const client = getBigQueryClient();

  const [job] = await client.createQueryJob({
    query: SALES_QUERY,
    params: { startDate, endDate },
  });

  const stream = job.getQueryResultsStream();
  const batch: BigQuerySalesRow[] = [];

  for await (const row of stream) {
    batch.push(row as BigQuerySalesRow);
    if (batch.length >= SYNC_CONFIG.BATCH_SIZE) {
      yield [...batch];
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * Detect cancelled/deleted notes: finds chave_bq keys that exist in Supabase
 * for the given period but are absent from the BigQuery VIEW.
 */
export async function detectCancelledKeys(
  startDate: string,
  endDate: string,
  existingKeys: string[]
): Promise<string[]> {
  if (existingKeys.length === 0) return [];

  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: CANCELLED_QUERY,
    params: { startDate, endDate, existingKeys },
  });

  return (rows as Array<{ chave_bq: string }>).map((r) => r.chave_bq);
}

/**
 * Get estimated row count for a period (used to decide query method).
 */
export async function getRowCount(startDate: string, endDate: string): Promise<number> {
  const client = getBigQueryClient();
  const [countResult] = await client.query({
    query: COUNT_QUERY,
    params: { startDate, endDate },
  });
  return Number(countResult[0]?.total || 0);
}

// ─── Utility: sleep for retry backoff ───
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Utility: check if should stop (timeout protection) ───
export function shouldStop(startTime: number): boolean {
  return Date.now() - startTime > SYNC_CONFIG.TIMEOUT_MS;
}
