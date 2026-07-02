import { BigQuery } from "@google-cloud/bigquery";

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

const VIEW_NAME = "`coffee-mais-mkt-data-lake.sankhya.v_dre_sales_coffee_mais`";

export interface BigQueryDRERow {
  ano: number;
  mes: number;
  codigo_matriz: string | null;
  gerente_id: string | null;
  canal_id: string | null;
  sku_id: string | null;
  familia_id: string | null;
  volume: number;
  receita_bruta: number;
}

/**
 * Fetch DRE sales data for a specific year and month from BigQuery view.
 */
export async function queryDRESales(ano: number, mes: number): Promise<BigQueryDRERow[]> {
  const client = getBigQueryClient();
  
  const query = `
    SELECT 
      COALESCE(ano, @ano) as ano,
      COALESCE(mes, @mes) as mes,
      codigo_matriz,
      gerente_id,
      canal_id,
      sku_id,
      familia_id,
      volume,
      receita_bruta
    FROM ${VIEW_NAME}
    WHERE COALESCE(ano, @ano) = @ano AND COALESCE(mes, @mes) = @mes
  `;

  try {
    const [rows] = await client.query({
      query,
      params: { ano, mes },
    });

    return rows.map((r: any) => ({
      ano: Number(r.ano),
      mes: Number(r.mes),
      codigo_matriz: r.codigo_matriz ? String(r.codigo_matriz) : "ALL",
      gerente_id: r.gerente_id ? String(r.gerente_id) : "ALL",
      canal_id: r.canal_id ? String(r.canal_id) : "ALL",
      sku_id: r.sku_id ? String(r.sku_id) : "ALL",
      familia_id: r.familia_id ? String(r.familia_id) : "ALL",
      volume: Number(r.volume) || 0,
      receita_bruta: Number(r.receita_bruta) || 0,
    }));
  } catch (error: any) {
    console.error("Erro ao consultar BigQuery DRE:", error);
    // Para fins de desenvolvimento ou se a view ainda não existir física no BigQuery, 
    // lançamos o erro ou retornamos dados vazios para que o fluxo de normalização continue.
    throw error;
  }
}
