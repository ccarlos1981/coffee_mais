/**
 * CacheInvalidationService — Serviço Intermediário de Invalidação Baseado em Eventos
 * 
 * Camada de desacoplamento entre os serviços de domínio (ex: ImportService)
 * e os caches específicos das rotas de apresentação (ex: DashboardCache).
 */

import { DashboardCache } from "@/lib/cache/dashboard-cache";

export class CacheInvalidationService {
  /**
   * Notifica a conclusão com sucesso de um lote de importação oficial.
   * Coordena a invalidação dos caches afetados pela nova carga sem acoplamento direto.
   */
  static async onImportSuccess(batchId: string): Promise<void> {
    try {
      console.log(`[CacheInvalidationService] Processando evento 'onImportSuccess' para lote: ${batchId}`);
      
      // Invalida o cache do Dashboard de Vendas
      DashboardCache.invalidate();

    } catch (error) {
      // Isolamento total de exceções: falhas na limpeza de cache nunca afetam a resposta da importação
      console.warn(`[CacheInvalidationService] Aviso não-fatal durante invalidação de cache (batch ${batchId}):`, error);
    }
  }
}
