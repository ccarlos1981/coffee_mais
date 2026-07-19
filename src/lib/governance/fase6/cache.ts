import { ConciliationResult } from "./orchestrator";

interface CacheEntry {
  result: ConciliationResult;
  timestamp: number;
}

// In-memory cache map for conciliation results
const conciliationCache = new Map<string, CacheEntry>();
// Time-To-Live (TTL) configuration: configurable via environment variable (default: 5 minutes)
const CACHE_TTL_MS = process.env.CONCILIATION_CACHE_TTL_MS 
  ? parseInt(process.env.CONCILIATION_CACHE_TTL_MS, 10) 
  : 5 * 60 * 1000;

/**
 * Generates a unique key for the cache entry based on audit parameters
 */
function getCacheKey(
  matrixCode: string,
  periodStart: string,
  periodEnd: string,
  plannedAcaoId?: string
): string {
  return `${matrixCode}_${periodStart}_${periodEnd}_${plannedAcaoId || "ALL"}`;
}

/**
 * Retrieves a cached conciliation result if it exists and is still valid
 */
export function getCachedConciliation(
  matrixCode: string,
  periodStart: string,
  periodEnd: string,
  plannedAcaoId?: string
): ConciliationResult | null {
  const key = getCacheKey(matrixCode, periodStart, periodEnd, plannedAcaoId);
  const entry = conciliationCache.get(key);

  if (!entry) {
    return null;
  }

  // Check TTL expiration
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    conciliationCache.delete(key);
    return null;
  }

  return entry.result;
}

/**
 * Stores a conciliation result in the cache
 */
export function setCachedConciliation(
  matrixCode: string,
  periodStart: string,
  periodEnd: string,
  result: ConciliationResult,
  plannedAcaoId?: string
): void {
  const key = getCacheKey(matrixCode, periodStart, periodEnd, plannedAcaoId);
  conciliationCache.set(key, {
    result,
    timestamp: Date.now()
  });
}

/**
 * Clears all cached entries (e.g. when a new justification is registered)
 */
export function clearConciliationCache(): void {
  conciliationCache.clear();
}
