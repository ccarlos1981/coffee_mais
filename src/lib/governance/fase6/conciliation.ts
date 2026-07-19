import { createAdminClient } from "@/lib/supabase/admin";
import { logGovernanceError } from "../logging";
import { ERROR_CODES } from "../constants";

export interface FinancialRecord {
  nro_nota: string;
  dt_faturamento: string;
  cod_top: string;
  desc_top: string;
  valor_liquido: number;
  quantidade: number;
  cod_produto: string;
  desc_produto: string;
}

export interface FinancialMovement {
  clientCode: string;
  periodStart: string;
  periodEnd: string;
  records: FinancialRecord[];
  salesValue: number;
  bonificationValue: number;
  devolutionValue: number;
  praticadoValue: number;
}

/**
 * Sprint 6.2 Motor de Conciliação
 * Queries Sankhya billing records to aggregate commercial movement (sales, devoluções, bonificações)
 * for a specific client within a defined date range.
 */
export async function consolidateFinancialMovement(
  clientCode: string,
  periodStart: string,
  periodEnd: string
): Promise<FinancialMovement> {
  const supabase = createAdminClient();

  try {
    // Query individual billing records from the raw table, filtering out cancelled notes and non-commercial partners
    const { data: rows, error } = await supabase
      .from("cm_faturamento_sankhya")
      .select("nro_nota, dt_faturamento, cod_top, desc_top, vlr_total_liq, quantidade, cod_produto, desc_produto, nome_parceiro, status_nfe, cod_parceiro")
      .eq("cod_parceiro", clientCode)
      .gte("dt_faturamento", periodStart)
      .lte("dt_faturamento", periodEnd);

    if (error) {
      throw error;
    }

    const filteredRecords: FinancialRecord[] = [];
    let salesValue = 0;
    let bonificationValue = 0;
    let devolutionValue = 0;

    const allowedTops = ["1100", "1117", "1200", "1201", "1703", "1713", "1723"];

    for (const row of (rows || [])) {
      // Exclude cancelled notes
      if (row.status_nfe === "CANCELADA") {
        continue;
      }

      // Exclude non-commercial partners (Utam & Coffee Mais Industria)
      const nomeParceiro = (row.nome_parceiro || "").toUpperCase();
      if (
        nomeParceiro.includes("CAFE UTAM S/A") ||
        nomeParceiro.includes("COFFEE MAIS INDUSTRIA") ||
        row.cod_parceiro === "19587" ||
        row.cod_parceiro === "1"
      ) {
        continue;
      }

      // Check if TOP is in the allowed commercial list
      const codTopStr = String(row.cod_top || "");
      if (!allowedTops.includes(codTopStr)) {
        continue;
      }

      const value = Number(row.vlr_total_liq || 0);
      const qty = Number(row.quantidade || 0);

      // Distribute value according to transaction types (TOPs)
      if (codTopStr === "1117") {
        // Bonificação
        bonificationValue += value;
        filteredRecords.push({
          nro_nota: String(row.nro_nota || ""),
          dt_faturamento: row.dt_faturamento,
          cod_top: codTopStr,
          desc_top: String(row.desc_top || "Bonificação"),
          valor_liquido: value,
          quantidade: qty,
          cod_produto: String(row.cod_produto || ""),
          desc_produto: String(row.desc_produto || "")
        });
      } else if (codTopStr === "1200" || codTopStr === "1201") {
        // Devolution (subtracts faturamento - stored as positive or negative in DB but here we ensure absolute reduction)
        const absValue = Math.abs(value);
        devolutionValue += absValue;
        filteredRecords.push({
          nro_nota: String(row.nro_nota || ""),
          dt_faturamento: row.dt_faturamento,
          cod_top: codTopStr,
          desc_top: String(row.desc_top || "Devolução"),
          valor_liquido: -absValue, // Store as negative for correct calculation
          quantidade: -Math.abs(qty),
          cod_produto: String(row.cod_produto || ""),
          desc_produto: String(row.desc_produto || "")
        });
      } else {
        // Commercial Sales (1100, 1703, 1713, 1723)
        salesValue += value;
        filteredRecords.push({
          nro_nota: String(row.nro_nota || ""),
          dt_faturamento: row.dt_faturamento,
          cod_top: codTopStr,
          desc_top: String(row.desc_top || "Venda"),
          valor_liquido: value,
          quantidade: qty,
          cod_produto: String(row.cod_produto || ""),
          desc_produto: String(row.desc_produto || "")
        });
      }
    }

    // net_value calculation: sales + bonifications - devoluções
    const praticadoValue = salesValue + bonificationValue - devolutionValue;

    return {
      clientCode,
      periodStart,
      periodEnd,
      records: filteredRecords,
      salesValue,
      bonificationValue,
      devolutionValue,
      praticadoValue
    };

  } catch (err: any) {
    logGovernanceError("CONCILIATION_ENGINE", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message, err);
    throw err;
  }
}
