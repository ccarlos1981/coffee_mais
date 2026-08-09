/**
 * CommercialDomainCache — Cache em Memória do Domínio Comercial
 *
 * Padrão idêntico ao DashboardCache existente na plataforma.
 * - TTL de 10 minutos
 * - Invalidação explícita via CommercialDomainService.invalidateCache()
 * - Invalidação automática após alteração nas tabelas de domínio
 *
 * @see RFC — Domínio Comercial Unificado (Baseline Permanente)
 */

const DOMAIN_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutos

export class CommercialDomainCache {
  /**
   * Obtém um payload armazenado em cache se for válido (TTL < 10 min).
   */
  static get<T = unknown>(key: string): T | null {
    const cached = DOMAIN_CACHE.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp >= CACHE_TTL) {
      DOMAIN_CACHE.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Armazena um payload em cache com o timestamp corrente.
   */
  static set(key: string, data: unknown): void {
    DOMAIN_CACHE.set(key, { timestamp: Date.now(), data });
  }

  /**
   * Invalidação completa de todo o cache do domínio comercial.
   */
  static invalidate(): void {
    const totalEntries = DOMAIN_CACHE.size;
    DOMAIN_CACHE.clear();
    if (totalEntries > 0) {
      console.log(`[CommercialDomainCache] Invalidação executada. ${totalEntries} chave(s) removida(s).`);
    }
  }

  /**
   * Invalidação seletiva por prefixo de chave.
   */
  static invalidateByPrefix(prefix: string): void {
    let removed = 0;
    for (const key of DOMAIN_CACHE.keys()) {
      if (key.startsWith(prefix)) {
        DOMAIN_CACHE.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[CommercialDomainCache] Invalidação seletiva '${prefix}*': ${removed} chave(s) removida(s).`);
    }
  }
}
