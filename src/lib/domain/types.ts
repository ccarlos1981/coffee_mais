/**
 * Tipos e Interfaces do Domínio Comercial Unificado — Coffee++
 *
 * DIRETRIZ ARQUITETURAL:
 * Estes tipos representam as entidades do Commercial Master Data.
 * Toda estrutura de domínio comercial da plataforma DEVE utilizar
 * exclusivamente estes tipos como contrato público.
 *
 * @see RFC — Domínio Comercial Unificado (Baseline Permanente)
 */

// =====================================================
// ENTIDADES DE DOMÍNIO
// =====================================================

/** Canal Comercial Oficial (persistido em cm_domain_channels) */
export interface DomainChannel {
  id: string;
  label: string;
  dbValue: string;
  sortOrder: number;
  isActive: boolean;
}

/** Segmento Comercial Oficial (persistido em cm_domain_segments) */
export interface DomainSegment {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

/** Status Comercial (persistido em cm_domain_status) */
export interface DomainStatus {
  id: string;
  label: string;
  category: 'client' | 'network' | 'action';
  sortOrder: number;
  isActive: boolean;
}

/** Unidade de Negócio (persistido em cm_domain_business_units) */
export interface DomainBusinessUnit {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

/** Regional Comercial (persistido em cm_domain_regions) */
export interface DomainRegion {
  id: string;
  label: string;
  managerId: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Papel Comercial / Role (persistido em cm_domain_roles) */
export interface DomainRole {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

/** Rede / Matriz Comercial (abstração sobre cm_redes_matrizes) */
export interface DomainNetwork {
  codigo: string;
  nome: string;
  canal: string | null;
  managerId: string | null;
  manager: string | null;
}

/** Estado / UF (abstração sobre manager_uf_mapping) */
export interface DomainState {
  uf: string;
  manager: string | null;
}

/** Regra de Normalização (persistido em cm_domain_normalization_rules) */
export interface DomainNormalizationRule {
  domain: 'channel' | 'segment' | 'status';
  legacyValue: string;
  officialId: string;
  inferredSegmentId: string | null;
}

/** Versão do Domínio Comercial (persistido em cm_domain_version) */
export interface DomainVersion {
  id: number;
  version: string;
  description: string;
  userId: string | null;
  userEmail: string | null;
  checksum: string | null;
  createdAt: string;
}

// =====================================================
// CONTRATOS DE CONSUMO
// =====================================================

/** Opção genérica para <select> / dropdown */
export interface SelectOption {
  value: string;
  label: string;
}

/** Opção de gerente com ID canônico */
export interface ManagerOption extends SelectOption {
  managerId: string;
}

/** Filtro de redes (usado pelo CommercialDomainService.getNetworks) */
export interface NetworkFilter {
  managerId?: string;
  canal?: string;
}

/** Resultado de normalização de valor legado */
export interface NormalizationResult {
  channel: DomainChannel;
  segment: DomainSegment | null;
  wasNormalized: boolean;
  originalValue: string;
}

/** Opções de filtro consolidadas do domínio comercial */
export interface CommercialFilterOptions {
  channels: SelectOption[];
  segments: SelectOption[];
  managers: ManagerOption[];
  states: SelectOption[];
  regions: SelectOption[];
  roles: SelectOption[];
  statuses: SelectOption[];
}

// =====================================================
// CONTRATO OFICIAL — REALIZADO CARTEIRA COMERCIAL
// =====================================================

/** Parâmetros de consulta para o Realizado da Carteira Comercial */
export interface RealizadoCarteiraParams {
  year: number;
  month: number;
  managerName?: string;
  maxDate?: string;
}

/** Resultado individual por gerente comercial */
export interface RealizadoCarteiraManagerResult {
  manager: string;
  managerId: string;
  realizadoFat: number;
  realizadoQty: number;
  targetFat?: number;
  targetVol?: number;
  atingimentoFatPct?: number;
  qtdNfs?: number;
  qtdLinhas?: number;
  canaisBreakdown?: Record<string, number>;
}

/** Resultado consolidado do Realizado da Carteira Comercial */
export interface RealizadoCarteiraResult {
  year: number;
  month: number;
  totalRealizadoFat: number;
  totalRealizadoQty: number;
  totalTargetFat?: number;
  totalAtingimentoFatPct?: number;
  totalNfs?: number;
  gerentes: RealizadoCarteiraManagerResult[];
}

