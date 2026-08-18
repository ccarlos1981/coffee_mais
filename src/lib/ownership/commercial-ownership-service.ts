/**
 * CommercialOwnershipService — Fachada Central de Ownership Comercial (SSOT)
 * 
 * REGRA ABSOLUTA DE GOVERNANÇA:
 * Toda e qualquer resolução de Gerente, Rede, Canal, UF ou Status de um PDV/Cliente
 * na plataforma Coffee++ DEVE consumir EXCLUSIVAMENTE este serviço ou a tabela
 * oficial public.base_atendimento.
 * 
 * É EXPRESSAMENTE PROIBIDO:
 * - Sobrescrever ownership usando nome_vendedor ou classificação de venda.
 * - Usar cm_regras_apuracao_comercial ou regras de override por UF/Rede.
 * - Usar heurísticas/fuzzy matching para PDVs com cod_parceiro.
 * - Inventar dados para PDVs não cadastrados ou com campos nulos.
 * 
 * @see Demanda 025 (Baseline Permanente)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { 
  CommercialOwnership, 
  TransactionSalesClassification, 
  TransactionChannelType 
} from "./types";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export class CommercialOwnershipService {
  private static memoryCache = new Map<string, CacheEntry<CommercialOwnership | null>>();
  private static fullMapCache: CacheEntry<Map<string, CommercialOwnership>> | null = null;

  private static getSupabaseClient() {
    return createAdminClient();
  }

  // =========================================================================
  // CAMADA 1: OWNERSHIP COMERCIAL (SSOT: public.base_atendimento)
  // =========================================================================

  /**
   * Invalida todo o cache em memória de ownership
   */
  static invalidateCache(): void {
    this.memoryCache.clear();
    this.fullMapCache = null;
  }

  /**
   * Resolve o ownership comercial de um único parceiro pelo seu cod_parceiro.
   * Retorna null caso o parceiro não exista na base de atendimento.
   */
  static async resolveOwnershipByParceiro(
    codParceiro: string | number | null | undefined
  ): Promise<CommercialOwnership | null> {
    if (codParceiro === null || codParceiro === undefined) {
      return null;
    }

    const codeStr = String(codParceiro).trim();
    if (!codeStr) {
      return null;
    }

    // Verificar cache individual
    const cached = this.memoryCache.get(codeStr);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // Verificar se já temos o mapa completo em cache
    if (this.fullMapCache && now - this.fullMapCache.timestamp < CACHE_TTL_MS) {
      const record = this.fullMapCache.data.get(codeStr) || null;
      this.memoryCache.set(codeStr, { data: record, timestamp: now });
      return record;
    }

    try {
      const supabase = this.getSupabaseClient();
      const { data, error } = await supabase
        .from('base_atendimento')
        .select('cod_parceiro, nome_parceiro, cnpj, rede, canal, manager, manager_id, uf, regional, status, ka')
        .eq('cod_parceiro', codeStr)
        .maybeSingle();

      if (error) {
        console.error(`[CommercialOwnershipService] Erro ao buscar parceiro ${codeStr}:`, error);
        return null;
      }

      if (!data) {
        this.memoryCache.set(codeStr, { data: null, timestamp: now });
        return null;
      }

      const ownership: CommercialOwnership = {
        cod_parceiro: data.cod_parceiro,
        nome_parceiro: data.nome_parceiro || '',
        cnpj: data.cnpj || null,
        rede: data.rede || null,
        canal: data.canal || null,
        manager: data.manager || null,
        manager_id: data.manager_id || null,
        uf: data.uf || null,
        regional: data.regional || null,
        status: data.status || 'ativo',
        ka: data.ka || null,
      };

      this.memoryCache.set(codeStr, { data: ownership, timestamp: now });
      return ownership;
    } catch (err) {
      console.error(`[CommercialOwnershipService] Falha inesperada ao resolver ${codeStr}:`, err);
      return null;
    }
  }

  /**
   * Resolução em lote (Set-Based) para múltiplos parceiros.
   * Evita 100% de queries N+1 realizando busca indexada com operador IN / ANY.
   */
  static async resolveManyOwnershipByParceiros(
    codParceiros: (string | number | null | undefined)[]
  ): Promise<Map<string, CommercialOwnership>> {
    const result = new Map<string, CommercialOwnership>();
    if (!codParceiros || codParceiros.length === 0) {
      return result;
    }

    // Normalizar e deduplicar códigos
    const validCodes = Array.from(
      new Set(
        codParceiros
          .filter((c): c is string | number => c !== null && c !== undefined)
          .map((c) => String(c).trim())
          .filter((c) => c.length > 0)
      )
    );

    if (validCodes.length === 0) {
      return result;
    }

    const now = Date.now();
    const missingFromCache: string[] = [];

    // Checar cache primeiro
    for (const code of validCodes) {
      const cached = this.memoryCache.get(code);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        if (cached.data) {
          result.set(code, cached.data);
        }
      } else {
        missingFromCache.push(code);
      }
    }

    if (missingFromCache.length === 0) {
      return result;
    }

    // Buscar em lotes de no máximo 1.000 para não exceder limites de URL/query
    const CHUNK_SIZE = 1000;
    const supabase = this.getSupabaseClient();

    for (let i = 0; i < missingFromCache.length; i += CHUNK_SIZE) {
      const chunk = missingFromCache.slice(i, i + CHUNK_SIZE);
      try {
        const { data, error } = await supabase
          .from('base_atendimento')
          .select('cod_parceiro, nome_parceiro, cnpj, rede, canal, manager, manager_id, uf, regional, status, ka')
          .in('cod_parceiro', chunk);

        if (error) {
          console.error('[CommercialOwnershipService] Erro ao buscar lote de parceiros:', error);
          continue;
        }

        const foundSet = new Set<string>();

        for (const row of data || []) {
          const ownership: CommercialOwnership = {
            cod_parceiro: row.cod_parceiro,
            nome_parceiro: row.nome_parceiro || '',
            cnpj: row.cnpj || null,
            rede: row.rede || null,
            canal: row.canal || null,
            manager: row.manager || null,
            manager_id: row.manager_id || null,
            uf: row.uf || null,
            regional: row.regional || null,
            status: row.status || 'ativo',
            ka: row.ka || null,
          };

          result.set(row.cod_parceiro, ownership);
          this.memoryCache.set(row.cod_parceiro, { data: ownership, timestamp: now });
          foundSet.add(row.cod_parceiro);
        }

        // Marcar os não encontrados no cache como null para evitar re-queries
        for (const code of chunk) {
          if (!foundSet.has(code)) {
            this.memoryCache.set(code, { data: null, timestamp: now });
          }
        }
      } catch (err) {
        console.error('[CommercialOwnershipService] Falha no chunk de busca em lote:', err);
      }
    }

    return result;
  }

  /**
   * Retorna todo o mapa de parceiros da base de atendimento em memória.
   * Utilizado para alimentar filtros globais, consolidadores de relatório e joins em memória.
   */
  static async getOwnershipMap(): Promise<Map<string, CommercialOwnership>> {
    const now = Date.now();
    if (this.fullMapCache && now - this.fullMapCache.timestamp < CACHE_TTL_MS) {
      return this.fullMapCache.data;
    }

    const resultMap = new Map<string, CommercialOwnership>();
    const supabase = this.getSupabaseClient();

    try {
      // Buscar todos os registros paginados se necessário
      let from = 0;
      const PAGE_SIZE = 5000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('base_atendimento')
          .select('cod_parceiro, nome_parceiro, cnpj, rede, canal, manager, manager_id, uf, regional, status, ka')
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('[CommercialOwnershipService] Erro ao carregar mapa completo:', error);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of data) {
          const ownership: CommercialOwnership = {
            cod_parceiro: row.cod_parceiro,
            nome_parceiro: row.nome_parceiro || '',
            cnpj: row.cnpj || null,
            rede: row.rede || null,
            canal: row.canal || null,
            manager: row.manager || null,
            manager_id: row.manager_id || null,
            uf: row.uf || null,
            regional: row.regional || null,
            status: row.status || 'ativo',
            ka: row.ka || null,
          };

          resultMap.set(row.cod_parceiro, ownership);
          this.memoryCache.set(row.cod_parceiro, { data: ownership, timestamp: now });
        }

        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      this.fullMapCache = { data: resultMap, timestamp: now };
      return resultMap;
    } catch (err) {
      console.error('[CommercialOwnershipService] Falha inesperada ao carregar getOwnershipMap:', err);
      return resultMap;
    }
  }

  // =========================================================================
  // CAMADA 2: CLASSIFICAÇÃO OPERACIONAL DA TRANSAÇÃO (FATURAMENTO)
  // =========================================================================

  /**
   * Resolve a classificação operacional da venda a partir dos atributos da transação.
   * NÃO altera e NÃO interfere no ownership do cliente.
   */
  static resolveTransactionClassification(transaction: {
    nome_vendedor?: string | null;
    centro_resultado?: string | null;
    cod_top?: string | null;
  }): TransactionSalesClassification {
    const vendedor = (transaction.nome_vendedor || '').trim().toUpperCase();
    const cr = (transaction.centro_resultado || '').trim().toUpperCase();

    let channelType: TransactionChannelType = 'Comercial B2B';
    let isD2C = false;

    if (vendedor === 'SHOPIFY' || vendedor === 'LIVELO') {
      channelType = 'Ecommerce';
      isD2C = true;
    } else if (
      [
        'AMAZONFBA',
        'MELI FULL',
        'SHOPEE',
        'AMAZONBR',
        'ANYMARKET',
        'MAGALU',
        'MELI',
      ].includes(vendedor)
    ) {
      channelType = 'Marketplace';
      isD2C = true;
    } else if (vendedor === 'DISTRIBUIDOR' || cr === 'DISTRIBUIDOR') {
      channelType = 'Distribuidor';
      isD2C = false;
    } else if (vendedor === 'AMAZON 1P') {
      channelType = 'Amazon 1P';
      isD2C = false;
    }

    return {
      nome_vendedor: transaction.nome_vendedor || null,
      centro_resultado: transaction.centro_resultado || null,
      cod_top: transaction.cod_top || null,
      transaction_channel_type: channelType,
      is_d2c: isD2C,
    };
  }
}
