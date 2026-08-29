import { createAdminClient } from "@/lib/supabase/admin";

export type AdimplenciaStatus = "EM_DIA" | "INADIMPLENTE" | "DADOS_INDISPONIVEIS";
export type CartaAnuenciaStatus = "VIGENTE" | "PENDENTE" | "EXPIRADA" | "SEM_CARTA" | "DADOS_INDISPONIVEIS";

export interface ClientFarolSummary {
  clienteId: string;
  codParceiro: string | null;
  codigoMatriz: string | null;
  redeNome: string | null;

  // 1. Bloco de Adimplência Operacional
  adimplencia: {
    status: AdimplenciaStatus;
    titulosAbertosCount: number;
    titulosVencidosCount: number;
    maiorAtrasoDias: number;
    valorVencidoTotal?: number;
  };

  // 2. Bloco de Acordo Comercial (Carta de Anuência)
  cartaAnuencia: {
    status: CartaAnuenciaStatus;
    competencia: string | null;
    validadeAte: string | null;
    numeroCarta: string | null;
    diasParaExpirar: number | null;
  };

  timestamp: string;
}

export interface GetFarolInput {
  clienteId?: string;
  codParceiro?: string | number | null;
  codigoMatriz?: string | number | null;
  redeId?: string | null;
  redeNome?: string | null;
}

export class ClientFarolService {
  /**
   * Obtém o Farol Comercial & Financeiro de um cliente sob demanda.
   * Executa estritamente 2 consultas determinísticas (cm_boletos + cm_cartas_anuencia).
   * ZERO fuzzy matching, ZERO exposição de dados bancários sensíveis.
   */
  static async getFarol(input: GetFarolInput): Promise<ClientFarolSummary> {
    const adminClient = createAdminClient();
    const hojeStr = new Date().toISOString().slice(0, 10);
    const hojeDate = new Date(hojeStr);

    let finalClienteId = input.clienteId || "";
    let finalCodParceiro = input.codParceiro ? String(input.codParceiro).trim() : null;
    let finalCodigoMatriz = input.codigoMatriz ? String(input.codigoMatriz).trim() : null;
    let finalRedeNome = input.redeNome ? String(input.redeNome).trim() : null;

    // 1. Se clienteId foi fornecido e faltam chaves canônicas, buscar metadados básicos em cm_clientes
    if (finalClienteId && (!finalCodParceiro || !finalCodigoMatriz)) {
      const { data: cliente } = await adminClient
        .from("cm_clientes")
        .select("id, cod_parceiro, codigo_matriz, matriz, nome_parceiro")
        .eq("id", finalClienteId)
        .maybeSingle();

      if (cliente) {
        if (!finalCodParceiro && cliente.cod_parceiro) {
          finalCodParceiro = String(cliente.cod_parceiro).trim();
        }
        if (!finalCodigoMatriz && cliente.codigo_matriz) {
          finalCodigoMatriz = String(cliente.codigo_matriz).trim();
        }
        if (!finalRedeNome && cliente.matriz) {
          finalRedeNome = String(cliente.matriz).trim();
        }
      }
    }

    // Identificador para busca em cm_boletos (Precedência: cod_parceiro -> codigo_matriz)
    const chaveBoleto = finalCodParceiro || finalCodigoMatriz;

    // ------------------------------------------------------------------------
    // QUERY 1: Consulta Determinística em cm_boletos (Status de Adimplência)
    // ------------------------------------------------------------------------
    let adimplenciaResult: ClientFarolSummary["adimplencia"] = {
      status: "DADOS_INDISPONIVEIS",
      titulosAbertosCount: 0,
      titulosVencidosCount: 0,
      maiorAtrasoDias: 0,
      valorVencidoTotal: 0,
    };

    if (chaveBoleto) {
      const { data: boletos, error: errBoletos } = await adminClient
        .from("cm_boletos")
        .select("id, vencimento, status, valor_total, valor_liquido, parceiro_codigo")
        .eq("parceiro_codigo", chaveBoleto)
        .limit(100);

      if (!errBoletos && boletos) {
        // Filtrar títulos não pagos/não cancelados
        const statusPagos = new Set(["pago", "cancelado"]);
        const titulosAtivos = boletos.filter(
          (b) => !statusPagos.has((b.status || "").toLowerCase().trim())
        );

        let vencidosCount = 0;
        let maxAtraso = 0;
        let totalVencido = 0;

        titulosAtivos.forEach((b) => {
          if (b.vencimento) {
            const dtVenc = new Date(String(b.vencimento).slice(0, 10));
            if (dtVenc < hojeDate) {
              vencidosCount++;
              const diffMs = hojeDate.getTime() - dtVenc.getTime();
              const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              if (diffDias > maxAtraso) {
                maxAtraso = diffDias;
              }
              const vlr = Number(b.valor_liquido || b.valor_total || 0);
              totalVencido += isNaN(vlr) ? 0 : vlr;
            }
          }
        });

        adimplenciaResult = {
          status: vencidosCount > 0 ? "INADIMPLENTE" : "EM_DIA",
          titulosAbertosCount: titulosAtivos.length,
          titulosVencidosCount: vencidosCount,
          maiorAtrasoDias: maxAtraso,
          valorVencidoTotal: totalVencido,
        };
      }
    }

    // ------------------------------------------------------------------------
    // QUERY 2: Consulta Determinística em cm_cartas_anuencia (Status de Acordo)
    // ------------------------------------------------------------------------
    let cartaResult: ClientFarolSummary["cartaAnuencia"] = {
      status: "DADOS_INDISPONIVEIS",
      competencia: null,
      validadeAte: null,
      numeroCarta: null,
      diasParaExpirar: null,
    };

    const chaveRede = input.redeId || finalCodigoMatriz || finalRedeNome;

    if (chaveRede) {
      let queryCarta = adminClient
        .from("cm_cartas_anuencia")
        .select("id, numero_carta, versao, rede_id, rede_nome, competencia, validade_ate, status, deleted_at, created_at")
        .is("deleted_at", null)
        .order("versao", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(10);

      // Precedência exata: rede_id ou codigo_matriz
      if (input.redeId) {
        queryCarta = queryCarta.eq("rede_id", input.redeId);
      } else if (finalCodigoMatriz) {
        queryCarta = queryCarta.eq("rede_id", finalCodigoMatriz);
      } else if (finalRedeNome) {
        queryCarta = queryCarta.eq("rede_nome", finalRedeNome);
      }

      const { data: cartas, error: errCartas } = await queryCarta;

      if (!errCartas && cartas && cartas.length > 0) {
        const cartaMaisRecente = cartas[0];
        const statusRaw = (cartaMaisRecente.status || "").toUpperCase().trim();
        const validadeStr = cartaMaisRecente.validade_ate
          ? String(cartaMaisRecente.validade_ate).slice(0, 10)
          : null;

        let statusClassificado: CartaAnuenciaStatus = "PENDENTE";
        let diasExpirar: number | null = null;

        if (validadeStr) {
          const dtValidade = new Date(validadeStr);
          const diffMs = dtValidade.getTime() - hojeDate.getTime();
          diasExpirar = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        if (statusRaw === "ASSINADA") {
          if (validadeStr && validadeStr >= hojeStr) {
            statusClassificado = "VIGENTE";
          } else {
            statusClassificado = "EXPIRADA";
          }
        } else if (["PENDENTE", "EMITIDA", "ENVIADA"].includes(statusRaw)) {
          statusClassificado = "PENDENTE";
        } else if (statusRaw === "CANCELADA") {
          statusClassificado = "SEM_CARTA";
        }

        cartaResult = {
          status: statusClassificado,
          competencia: cartaMaisRecente.competencia || null,
          validadeAte: validadeStr,
          numeroCarta: cartaMaisRecente.numero_carta || null,
          diasParaExpirar: diasExpirar,
        };
      } else if (!errCartas) {
        cartaResult = {
          status: "SEM_CARTA",
          competencia: null,
          validadeAte: null,
          numeroCarta: null,
          diasParaExpirar: null,
        };
      }
    }

    return {
      clienteId: finalClienteId,
      codParceiro: finalCodParceiro,
      codigoMatriz: finalCodigoMatriz,
      redeNome: finalRedeNome,
      adimplencia: adimplenciaResult,
      cartaAnuencia: cartaResult,
      timestamp: new Date().toISOString(),
    };
  }
}
