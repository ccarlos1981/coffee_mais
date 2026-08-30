/**
 * CommercialDomainRepository — Camada de Acesso a Dados do Domínio Comercial
 *
 * Responsável por todas as queries às tabelas de domínio:
 * - cm_domain_channels, cm_domain_segments, cm_domain_status
 * - cm_domain_business_units, cm_domain_regions, cm_domain_roles
 * - cm_domain_normalization_rules, cm_domain_version
 *
 * Abstrai tabelas existentes da Baseline sem duplicação:
 * - cm_redes_matrizes → exposta como DomainNetwork
 * - manager_uf_mapping → exposta como DomainState
 *
 * @see RFC — Domínio Comercial Unificado (Baseline Permanente)
 * @see Decisão Arquitetural DA1, DA2 — Política de Não Duplicação
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
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
  NetworkFilter,
  RealizadoCarteiraParams,
} from "./types";

export class CommercialDomainRepository {
  private static getClient() {
    if (typeof window !== "undefined") {
      return createBrowserClient();
    }
    return createAdminClient();
  }

  // ============================================================
  // CANAIS COMERCIAIS (cm_domain_channels)
  // ============================================================

  static async fetchChannels(): Promise<DomainChannel[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("cm_domain_channels")
      .select("id, label, db_value, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("[CommercialDomainRepository] fetchChannels error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      label: row.label,
      dbValue: row.db_value,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }

  // ============================================================
  // SEGMENTOS COMERCIAIS (cm_domain_segments)
  // ============================================================

  static async fetchSegments(): Promise<DomainSegment[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("cm_domain_segments")
      .select("id, label, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("[CommercialDomainRepository] fetchSegments error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      label: row.label,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }

  // ============================================================
  // STATUS COMERCIAIS (cm_domain_status)
  // ============================================================

  static async fetchStatuses(category?: string): Promise<DomainStatus[]> {
    const supabase = this.getClient();
    let query = supabase
      .from("cm_domain_status")
      .select("id, label, category, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[CommercialDomainRepository] fetchStatuses error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      label: row.label,
      category: row.category as DomainStatus["category"],
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }

  // ============================================================
  // UNIDADES DE NEGÓCIO (cm_domain_business_units)
  // ============================================================

  static async fetchBusinessUnits(): Promise<DomainBusinessUnit[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("cm_domain_business_units")
      .select("id, label, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("[CommercialDomainRepository] fetchBusinessUnits error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      label: row.label,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }

  // ============================================================
  // REGIONAIS (cm_domain_regions)
  // ============================================================

  static async fetchRegions(): Promise<DomainRegion[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("cm_domain_regions")
      .select("id, label, manager_id, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("[CommercialDomainRepository] fetchRegions error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      label: row.label,
      managerId: row.manager_id,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }

  // ============================================================
  // ROLES COMERCIAIS (cm_domain_roles)
  // ============================================================

  static async fetchRoles(): Promise<DomainRole[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("cm_domain_roles")
      .select("id, label, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("[CommercialDomainRepository] fetchRoles error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      label: row.label,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }

  // ============================================================
  // REDES / MATRIZES (abstração sobre cm_redes_matrizes — DA1)
  // ============================================================

  static async fetchNetworks(filters?: NetworkFilter): Promise<DomainNetwork[]> {
    const supabase = this.getClient();
    let query = supabase
      .from("cm_redes_matrizes")
      .select("codigo, nome, canal, manager_id, manager")
      .order("nome");

    if (filters?.managerId) {
      query = query.eq("manager_id", filters.managerId);
    }
    if (filters?.canal) {
      query = query.eq("canal", filters.canal);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[CommercialDomainRepository] fetchNetworks error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      codigo: row.codigo,
      nome: row.nome,
      canal: row.canal,
      managerId: row.manager_id,
      manager: row.manager,
    }));
  }

  static async fetchOfficialNetworks(): Promise<import("./canonical").OfficialNetworkRecord[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("vw_redes_planejaveis_oficiais")
      .select("rede, manager, manager_id, codigo_matriz, uf, total_pdvs_vinculados")
      .eq("is_rede_planejavel", true);

    if (error) {
      console.error("[CommercialDomainRepository] fetchOfficialNetworks error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      rede: row.rede,
      manager: row.manager,
      managerId: String(row.manager_id || ""),
      codigoMatriz: String(row.codigo_matriz || ""),
      uf: row.uf || null,
      totalPdvsVinculados: row.total_pdvs_vinculados,
    }));
  }

  // ============================================================
  // ESTADOS / UFs (abstração sobre manager_uf_mapping — DA2)
  // ============================================================

  static async fetchStates(): Promise<DomainState[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("manager_uf_mapping")
      .select("uf, manager")
      .order("uf");

    if (error) {
      console.error("[CommercialDomainRepository] fetchStates error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      uf: row.uf,
      manager: row.manager,
    }));
  }

  // ============================================================
  // REGRAS DE NORMALIZAÇÃO (cm_domain_normalization_rules)
  // ============================================================

  static async fetchNormalizationRules(): Promise<DomainNormalizationRule[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("cm_domain_normalization_rules")
      .select("domain, legacy_value, official_id, inferred_segment_id")
      .eq("is_active", true);

    if (error) {
      console.error("[CommercialDomainRepository] fetchNormalizationRules error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      domain: row.domain as DomainNormalizationRule["domain"],
      legacyValue: row.legacy_value,
      officialId: row.official_id,
      inferredSegmentId: row.inferred_segment_id,
    }));
  }

  // ============================================================
  // VERSIONAMENTO (cm_domain_version)
  // ============================================================

  static async fetchDomainVersion(): Promise<DomainVersion | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("cm_domain_version")
      .select("id, version, description, user_id, user_email, checksum, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.error("[CommercialDomainRepository] fetchDomainVersion error:", error?.message);
      return null;
    }

    return {
      id: data.id,
      version: data.version,
      description: data.description,
      userId: data.user_id,
      userEmail: data.user_email,
      checksum: data.checksum,
      createdAt: data.created_at,
    };
  }

  // ============================================================
  // REALIZADO CARTEIRA COMERCIAL (public.sales / targets)
  // ============================================================

  static async fetchRealizadoCarteiraSales(params: RealizadoCarteiraParams): Promise<any[]> {
    const supabase = this.getClient();
    const dateClause = params.maxDate ? `AND s.invoice_date <= '${params.maxDate}'` : "";
    const query = `
      SELECT 
        s.manager,
        s.manager_id,
        s.channel,
        COUNT(DISTINCT s.invoice_number) as qtd_nfs,
        COUNT(*) as qtd_linhas,
        SUM(s.quantity) as total_unidades,
        SUM(s.net_value) as total_realizado
      FROM public.sales s
      WHERE s.ano = ${params.year} AND s.mes = ${params.month}
        ${dateClause}
        AND s.manager IN ('Leandro Saffi', 'Luiz', 'Julliano', 'John Guedes')
      GROUP BY s.manager, s.manager_id, s.channel
      ORDER BY s.manager, total_realizado DESC
    `;

    const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: query });
    if (error) {
      console.error("[CommercialDomainRepository] fetchRealizadoCarteiraSales error:", error.message);
      return [];
    }
    return data || [];
  }

  static async fetchTargets(year: number, month: number): Promise<any[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("targets")
      .select("manager, manager_id, target_revenue, target_tons, year, month")
      .eq("year", year)
      .eq("month", month);

    if (error) {
      console.error("[CommercialDomainRepository] fetchTargets error:", error.message);
      return [];
    }
    return data || [];
  }
}

