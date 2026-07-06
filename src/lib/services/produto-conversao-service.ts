import { SupabaseClient } from "@supabase/supabase-js";

export interface FatorConversao {
  id: string;
  product_id: number;
  codigo_integracao: string | null;
  peso_embalagem_kg: number;
  unidades_por_caixa: number;
  peso_total_caixa_kg: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
}

export class ProdutoConversaoService {
  // Cache estático local em memória com controle de TTL (5 minutos)
  private static cacheFatores: Record<number, FatorConversao[]> | null = null;
  private static cacheTimestamp = 0;
  private static readonly TTL_MS = 300000; // 300.000 ms = 5 minutos
  private static initPromise: Promise<Record<number, FatorConversao[]>> | null = null;

  private fatores: Record<number, FatorConversao[]> = {};

  constructor(fatores: Record<number, FatorConversao[]>) {
    this.fatores = fatores;
  }

  /**
   * Inicializa o serviço carregando e cacheando os fatores de conversão ativos do banco de dados
   * 
   * WARNING: O cache estático local é apenas uma otimização no ciclo de vida de requisições de processo
   * ou execução batch. Ambientes serverless (Vercel) recriam containers constantemente, portanto 
   * este cache não deve ser considerado um cache distribuído.
   */
  static async init(supabaseClient: SupabaseClient, forceReload = false): Promise<ProdutoConversaoService> {
    const agora = Date.now();
    const expirado = agora - ProdutoConversaoService.cacheTimestamp > ProdutoConversaoService.TTL_MS;

    if (forceReload || expirado) {
      ProdutoConversaoService.cacheFatores = null;
      ProdutoConversaoService.initPromise = null;
    }

    if (!ProdutoConversaoService.cacheFatores) {
      if (!ProdutoConversaoService.initPromise) {
        ProdutoConversaoService.initPromise = (async () => {
          // Consulta diretamente a tabela mestre, deixando a View para relatórios/telas
          const { data, error } = await supabaseClient
            .from("cm_skus_conversao")
            .select("id, product_id, codigo_integracao, peso_embalagem_kg, unidades_por_caixa, vigencia_inicio, vigencia_fim, ativo");

          if (error) {
            throw new Error(`Erro ao inicializar ProdutoConversaoService: ${error.message}`);
          }

          const cacheMap: Record<number, FatorConversao[]> = {};
          for (const item of (data || [])) {
            const peso = Number(item.peso_embalagem_kg) || 0;
            const un = Number(item.unidades_por_caixa) || 1;
            
            if (!cacheMap[item.product_id]) {
              cacheMap[item.product_id] = [];
            }
            
            cacheMap[item.product_id].push({
              id: item.id,
              product_id: item.product_id,
              codigo_integracao: item.codigo_integracao,
              peso_embalagem_kg: peso,
              unidades_por_caixa: un,
              peso_total_caixa_kg: peso * un,
              vigencia_inicio: item.vigencia_inicio,
              vigencia_fim: item.vigencia_fim,
              ativo: item.ativo
            });
          }
          return cacheMap;
        })();
      }
      
      ProdutoConversaoService.cacheFatores = await ProdutoConversaoService.initPromise;
      ProdutoConversaoService.cacheTimestamp = agora;
    }

    return new ProdutoConversaoService(ProdutoConversaoService.cacheFatores);
  }

  /**
   * Invalida explicitamente o cache em memória
   */
  static limparCache(): void {
    ProdutoConversaoService.cacheFatores = null;
    ProdutoConversaoService.cacheTimestamp = 0;
  }

  private obterFator(productId: number): FatorConversao {
    const lista = this.fatores[productId] || [];
    if (lista.length === 0) {
      throw new Error(`Fator de conversão logística não cadastrado para o produto ID: ${productId}`);
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Encontra o primeiro fator que corresponda à vigência e esteja ativo
    for (const f of lista) {
      if (!f.ativo) {
        throw new Error(`Fator de conversão logística inativo para o produto ID: ${productId}`);
      }

      if (f.vigencia_inicio) {
        const inicio = new Date(f.vigencia_inicio + "T00:00:00");
        if (hoje < inicio) {
          throw new Error(`Fator de conversão logística para o produto ID: ${productId} ainda não entrou em vigência.`);
        }
      }
      if (f.vigencia_fim) {
        const fim = new Date(f.vigencia_fim + "T00:00:00");
        if (hoje > fim) {
          throw new Error(`Fator de conversão logística expirado para o produto ID: ${productId}.`);
        }
      }

      return f;
    }

    throw new Error(`Fator de conversão logística não cadastrado para o produto ID: ${productId}`);
  }

  /**
   * Converte uma quantidade física de unidades para o correspondente em caixas
   */
  unidadesParaCaixas(productId: number, unidades: number): number {
    const fator = this.obterFator(productId);
    return unidades / fator.unidades_por_caixa;
  }

  /**
   * Converte uma quantidade de caixas para o correspondente em unidades físicas
   */
  caixasParaUnidades(productId: number, caixas: number): number {
    const fator = this.obterFator(productId);
    return caixas * fator.unidades_por_caixa;
  }

  /**
   * Converte uma quantidade de peso em Kg para o correspondente em caixas
   */
  kgParaCaixas(productId: number, kg: number): number {
    const fator = this.obterFator(productId);
    if (fator.peso_total_caixa_kg <= 0) {
      throw new Error(`Peso total da caixa inválido para o produto ID: ${productId}`);
    }
    return kg / fator.peso_total_caixa_kg;
  }

  /**
   * Converte uma quantidade de caixas para o correspondente em peso em Kg
   */
  caixasParaKg(productId: number, caixas: number): number {
    const fator = this.obterFator(productId);
    return caixas * fator.peso_total_caixa_kg;
  }

  /**
   * Converte uma quantidade física de unidades para o correspondente em peso em Kg
   */
  unidadesParaKg(productId: number, unidades: number): number {
    const fator = this.obterFator(productId);
    return unidades * fator.peso_embalagem_kg;
  }

  /**
   * Converte uma quantidade de peso em Kg para o correspondente em unidades físicas
   */
  kgParaUnidades(productId: number, kg: number): number {
    const fator = this.obterFator(productId);
    if (fator.peso_embalagem_kg <= 0) {
      throw new Error(`Peso unitário da embalagem inválido para o produto ID: ${productId}`);
    }
    return kg / fator.peso_embalagem_kg;
  }
}
