/**
 * API Pública do Domínio Comercial Unificado — Coffee++
 *
 * REGRA: Todo módulo da plataforma DEVE importar o domínio comercial
 * exclusivamente através deste barrel export.
 *
 * @see RFC — Domínio Comercial Unificado (Baseline Permanente)
 */

// === Fachada Única (ponto de acesso principal) ===
export { CommercialDomainService } from "./commercial-domain-service";

// === Tipos e Interfaces ===
export type {
  DomainChannel,
  DomainSegment,
  DomainStatus,
  DomainBusinessUnit,
  DomainRegion,
  DomainRole,
  DomainNetwork,
  DomainState,
  DomainNormalizationRule,
  DomainVersion,
  SelectOption,
  ManagerOption,
  NetworkFilter,
  NormalizationResult,
  CommercialFilterOptions,
} from "./types";

// === Baseline Existente (re-exports para retrocompatibilidade) ===
export {
  OFFICIAL_COMMERCIAL_ROLES,
  VALID_COMMERCIAL_ROLES,
  DISTRIBUTORS_REGISTRY,
  getCommercialManagerRoleOptions,
  buildCommercialRoleSqlFilter,
  validateCommercialStructure,
} from "./commercial-structure";

export type { CommercialRole } from "./commercial-structure";

export {
  resolveCanonicalManager,
  isSameManager,
  canonicalizeKey,
} from "./canonical";

export type { ManagerInfo } from "./canonical";
