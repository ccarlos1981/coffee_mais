/**
 * CommercialDomainService — Fachada Única do Domínio Comercial (SSOT)
 *
 * REGRA ABSOLUTA: Todo módulo da plataforma Coffee++ que necessite de
 * dados do domínio comercial (Canais, Segmentos, Redes, UFs, Regionais,
 * Gerentes, Status, Roles) DEVE consumir EXCLUSIVAMENTE via este Service.
 *
 * Acesso direto a cm_clientes, cm_domain_* para montar listas/filtros
 * é EXPRESSAMENTE PROIBIDO.
 *
 * Arquitetura:
 *   UI → CommercialDomainService → CommercialDomainRepository → Cache → Supabase
 *
 * @see RFC — Domínio Comercial Unificado (Baseline Permanente)
 */

import { CommercialDomainRepository } from "./commercial-domain-repository";
import { CommercialDomainCache } from "./commercial-domain-cache";
import {
  OFFICIAL_COMMERCIAL_ROLES,
  getCommercialManagerRoleOptions,
} from "./commercial-structure";
import { resolveCanonicalManager, canonicalizeKey } from "./canonical";
import type {
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
import type { ManagerInfo } from "./canonical";

// Cache keys
const CK = {
  CHANNELS: "domain:channels",
  SEGMENTS: "domain:segments",
  STATUSES: "domain:statuses",
  BUSINESS_UNITS: "domain:business_units",
  REGIONS: "domain:regions",
  ROLES: "domain:roles",
  STATES: "domain:states",
  NORMALIZATION: "domain:normalization",
  VERSION: "domain:version",
} as const;

/**
 * Canal padrão quando nenhum canal é especificado.
 * Utilizado por importações e criação de registros.
 */
const DEFAULT_CHANNEL_ID = "OUTROS";

export class CommercialDomainService {
  // ============================================================
  // CANAIS COMERCIAIS
  // ============================================================

  /** Retorna todos os canais comerciais ativos, ordenados por sort_order */
  static async getChannels(): Promise<DomainChannel[]> {
    const cached = CommercialDomainCache.get<DomainChannel[]>(CK.CHANNELS);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchChannels();
    CommercialDomainCache.set(CK.CHANNELS, data);
    return data;
  }

  /** Retorna opções de dropdown formatadas para <select> / MultiSelect */
  static async getChannelOptions(): Promise<SelectOption[]> {
    const channels = await this.getChannels();
    return channels.map((c) => ({ value: c.dbValue, label: c.label }));
  }

  /** Resolve um valor de canal (potencialmente legado) para o canal oficial */
  static async resolveChannel(rawValue: string | null | undefined): Promise<DomainChannel> {
    if (!rawValue) {
      const channels = await this.getChannels();
      return channels.find((c) => c.id === DEFAULT_CHANNEL_ID) || channels[channels.length - 1];
    }

    const channels = await this.getChannels();

    // 1. Match direto por dbValue (caso comum)
    const direct = channels.find(
      (c) => c.dbValue === rawValue || c.id === rawValue
    );
    if (direct) return direct;

    // 2. Match case-insensitive
    const normalized = canonicalizeKey(rawValue);
    const caseMatch = channels.find(
      (c) => canonicalizeKey(c.dbValue) === normalized || canonicalizeKey(c.id) === normalized
    );
    if (caseMatch) return caseMatch;

    // 3. Consultar regras de normalização
    const rules = await this.getNormalizationRules();
    const rule = rules.find(
      (r) => r.domain === "channel" && canonicalizeKey(r.legacyValue) === normalized
    );
    if (rule) {
      const resolved = channels.find((c) => c.id === rule.officialId);
      if (resolved) return resolved;
    }

    // 4. Fallback
    return channels.find((c) => c.id === DEFAULT_CHANNEL_ID) || channels[channels.length - 1];
  }

  /** Valida se um valor é um canal oficial válido */
  static async isValidChannel(value: string): Promise<boolean> {
    const channels = await this.getChannels();
    return channels.some((c) => c.dbValue === value || c.id === value);
  }

  /** Retorna o canal padrão para importações e novos registros */
  static async getDefaultChannel(): Promise<DomainChannel> {
    const channels = await this.getChannels();
    return channels.find((c) => c.id === DEFAULT_CHANNEL_ID) || channels[channels.length - 1];
  }

  // ============================================================
  // SEGMENTOS COMERCIAIS
  // ============================================================

  /** Retorna todos os segmentos comerciais ativos, ordenados por sort_order */
  static async getSegments(): Promise<DomainSegment[]> {
    const cached = CommercialDomainCache.get<DomainSegment[]>(CK.SEGMENTS);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchSegments();
    CommercialDomainCache.set(CK.SEGMENTS, data);
    return data;
  }

  /** Retorna opções de dropdown formatadas */
  static async getSegmentOptions(): Promise<SelectOption[]> {
    const segments = await this.getSegments();
    return segments.map((s) => ({ value: s.id, label: s.label }));
  }

  // ============================================================
  // STATUS COMERCIAIS
  // ============================================================

  /** Retorna todos os status comerciais ativos */
  static async getStatuses(category?: string): Promise<DomainStatus[]> {
    const cacheKey = category ? `${CK.STATUSES}:${category}` : CK.STATUSES;
    const cached = CommercialDomainCache.get<DomainStatus[]>(cacheKey);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchStatuses(category);
    CommercialDomainCache.set(cacheKey, data);
    return data;
  }

  /** Retorna opções de dropdown formatadas */
  static async getStatusOptions(category?: string): Promise<SelectOption[]> {
    const statuses = await this.getStatuses(category);
    return statuses.map((s) => ({ value: s.id, label: s.label }));
  }

  // ============================================================
  // UNIDADES DE NEGÓCIO
  // ============================================================

  /** Retorna todas as unidades de negócio ativas */
  static async getBusinessUnits(): Promise<DomainBusinessUnit[]> {
    const cached = CommercialDomainCache.get<DomainBusinessUnit[]>(CK.BUSINESS_UNITS);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchBusinessUnits();
    CommercialDomainCache.set(CK.BUSINESS_UNITS, data);
    return data;
  }

  // ============================================================
  // REGIONAIS
  // ============================================================

  /** Retorna todas as regionais ativas */
  static async getRegions(): Promise<DomainRegion[]> {
    const cached = CommercialDomainCache.get<DomainRegion[]>(CK.REGIONS);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchRegions();
    CommercialDomainCache.set(CK.REGIONS, data);
    return data;
  }

  /** Retorna opções de dropdown formatadas */
  static async getRegionOptions(): Promise<SelectOption[]> {
    const regions = await this.getRegions();
    return regions.map((r) => ({ value: r.id, label: r.label }));
  }

  // ============================================================
  // ROLES COMERCIAIS
  // ============================================================

  /** Retorna todos os roles comerciais ativos */
  static async getRoles(): Promise<DomainRole[]> {
    const cached = CommercialDomainCache.get<DomainRole[]>(CK.ROLES);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchRoles();
    CommercialDomainCache.set(CK.ROLES, data);
    return data;
  }

  // ============================================================
  // REDES / MATRIZES (abstração sobre cm_redes_matrizes — DA1)
  // ============================================================

  /** Retorna redes da tabela oficial cm_redes_matrizes */
  static async getNetworks(filters?: NetworkFilter): Promise<DomainNetwork[]> {
    // Networks não são cacheadas por terem filtros variáveis
    return CommercialDomainRepository.fetchNetworks(filters);
  }

  /** Retorna opções de dropdown de redes */
  static async getNetworkOptions(filters?: NetworkFilter): Promise<SelectOption[]> {
    const networks = await this.getNetworks(filters);
    return networks.map((n) => ({ value: n.codigo, label: n.nome }));
  }

  // ============================================================
  // ESTADOS / UFs (abstração sobre manager_uf_mapping — DA2)
  // ============================================================

  /** Retorna todos os estados com gerente associado */
  static async getStates(): Promise<DomainState[]> {
    const cached = CommercialDomainCache.get<DomainState[]>(CK.STATES);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchStates();
    CommercialDomainCache.set(CK.STATES, data);
    return data;
  }

  /** Retorna opções de dropdown de UFs */
  static async getStateOptions(): Promise<SelectOption[]> {
    const states = await this.getStates();
    return states.map((s) => ({ value: s.uf, label: s.uf }));
  }

  // ============================================================
  // GERENTES (delegação para baseline existente)
  // ============================================================

  /** Delega para OFFICIAL_COMMERCIAL_ROLES (baseline congelada) */
  static getManagerRoles() {
    return OFFICIAL_COMMERCIAL_ROLES;
  }

  /** Delega para resolveCanonicalManager() */
  static resolveManager(identifier: string | null | undefined): ManagerInfo {
    return resolveCanonicalManager(identifier);
  }

  /** Retorna opções de dropdown de gerentes */
  static getManagerOptions(): ManagerOption[] {
    return getCommercialManagerRoleOptions().map((opt) => ({
      value: opt.value,
      label: opt.label,
      managerId: opt.managerId,
    }));
  }

  /** Retorna lista simples de nomes de gerentes (para filtros simples) */
  static getManagerList(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const role of OFFICIAL_COMMERCIAL_ROLES) {
      if (!seen.has(role.managerName)) {
        seen.add(role.managerName);
        result.push(role.managerName);
      }
    }
    return result;
  }

  /** Retorna lista de gerentes "pessoas" (ex: Julliano, Leandro, Luiz, John Guedes) — exclui canais corporativos */
  static getFieldManagerList(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    const corporateChannels = new Set(["Inside Sales", "Ecommerce", "Marketplace", "Distribuidor", "Amazon 1P", "Private Label"]);
    for (const role of OFFICIAL_COMMERCIAL_ROLES) {
      if (!seen.has(role.managerName) && !corporateChannels.has(role.managerName)) {
        seen.add(role.managerName);
        result.push(role.managerName);
      }
    }
    return result;
  }

  /** Verifica se um manager é um canal corporativo (sem segregação KA/DIST) */
  static isStandaloneChannelManager(managerName: string): boolean {
    const corporateChannels = new Set(["Ecommerce", "Marketplace", "Inside Sales", "Amazon 1P", "Private Label", "Distribuidor"]);
    return corporateChannels.has(managerName);
  }

  /** Resolve nome do gerente para manager_id */
  static resolveManagerId(name: string): string {
    const info = resolveCanonicalManager(name);
    return info.managerId;
  }

  // ============================================================
  // NORMALIZAÇÃO
  // ============================================================

  /** Retorna todas as regras de normalização ativas */
  static async getNormalizationRules(): Promise<DomainNormalizationRule[]> {
    const cached = CommercialDomainCache.get<DomainNormalizationRule[]>(CK.NORMALIZATION);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchNormalizationRules();
    CommercialDomainCache.set(CK.NORMALIZATION, data);
    return data;
  }

  /** Resolve um valor legado para o canal+segmento oficial */
  static async normalizeLegacyValue(rawValue: string): Promise<NormalizationResult> {
    const channels = await this.getChannels();
    const segments = await this.getSegments();
    const rules = await this.getNormalizationRules();

    const normalized = canonicalizeKey(rawValue);

    // 1. Valor já é oficial?
    const directMatch = channels.find(
      (c) => canonicalizeKey(c.dbValue) === normalized || canonicalizeKey(c.id) === normalized
    );
    if (directMatch) {
      return {
        channel: directMatch,
        segment: null,
        wasNormalized: false,
        originalValue: rawValue,
      };
    }

    // 2. Aplicar regra de normalização
    const rule = rules.find(
      (r) => r.domain === "channel" && canonicalizeKey(r.legacyValue) === normalized
    );
    if (rule) {
      const channel = channels.find((c) => c.id === rule.officialId);
      const segment = rule.inferredSegmentId
        ? segments.find((s) => s.id === rule.inferredSegmentId) || null
        : null;

      return {
        channel: channel || channels[channels.length - 1],
        segment,
        wasNormalized: true,
        originalValue: rawValue,
      };
    }

    // 3. Fallback
    return {
      channel: channels.find((c) => c.id === DEFAULT_CHANNEL_ID) || channels[channels.length - 1],
      segment: null,
      wasNormalized: true,
      originalValue: rawValue,
    };
  }

  // ============================================================
  // FILTROS CONSOLIDADOS
  // ============================================================

  /** Retorna todas as opções de filtro do domínio em uma única chamada */
  static async getFilterOptions(): Promise<CommercialFilterOptions> {
    const [channels, segments, states, regions, roles, statuses] = await Promise.all([
      this.getChannelOptions(),
      this.getSegmentOptions(),
      this.getStateOptions(),
      this.getRegionOptions(),
      this.getRoles().then((r) => r.map((role) => ({ value: role.id, label: role.label }))),
      this.getStatusOptions(),
    ]);

    return {
      channels,
      segments,
      managers: this.getManagerOptions(),
      states,
      regions,
      roles,
      statuses,
    };
  }

  // ============================================================
  // CACHE E VERSIONAMENTO
  // ============================================================

  /** Invalida todo o cache do domínio comercial */
  static invalidateCache(): void {
    CommercialDomainCache.invalidate();
  }

  /** Retorna a versão atual do domínio comercial */
  static async getDomainVersion(): Promise<DomainVersion | null> {
    const cached = CommercialDomainCache.get<DomainVersion>(CK.VERSION);
    if (cached) return cached;

    const data = await CommercialDomainRepository.fetchDomainVersion();
    if (data) {
      CommercialDomainCache.set(CK.VERSION, data);
    }
    return data;
  }
}
