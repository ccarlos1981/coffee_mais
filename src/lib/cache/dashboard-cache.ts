/**
 * DashboardCache — Encapsulamento de Cache em Memória da API Dashboard
 * 
 * Mantém TTL de 5 minutos para navegabilidade padrão e expõe método de invalidação específico.
 */

const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutos

export class DashboardCache {
  /**
   * Obtém um payload armazenado em cache se for válido (TTL < 5 min).
   */
  static get<T = unknown>(key: string): T | null {
    const cached = API_CACHE.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp >= CACHE_TTL) {
      API_CACHE.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Armazena um payload em cache com o timestamp corrente.
   */
  static set(key: string, data: unknown): void {
    API_CACHE.set(key, { timestamp: Date.now(), data });
  }

  /**
   * Invalidação específica e controlada de todo o cache do Dashboard.
   */
  static invalidate(): void {
    const totalEntries = API_CACHE.size;
    API_CACHE.clear();
    console.log(`[DashboardCache] Invalidação executada com sucesso. ${totalEntries} chave(s) removida(s).`);
  }
}
