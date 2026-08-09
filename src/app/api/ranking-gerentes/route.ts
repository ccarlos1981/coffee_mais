/**
 * GET /api/ranking-gerentes — Feature 7: Ranking Dinâmico de Performance de Gerentes de Campo
 *
 * Orquestra AnalyticsEngine (dados brutos) + ManagerPerformanceScoreService (cálculo de Score).
 * Segue o padrão arquitetural do Coffee++: handler HTTP sem regras comerciais.
 *
 * Fluxo:
 * 1. Autenticação + permissão
 * 2. Resolução de gerentes de campo via CommercialDomainService (SSOT)
 * 3. AnalyticsEngine.getManagerPerformanceRanking() → dados brutos
 * 4. ManagerPerformanceScoreService.calculate() → ranking com Score
 * 5. Resposta JSON
 *
 * @see Feature 7 Discovery Document
 */

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { AnalyticsEngine } from "@/lib/governance/analytics/engine";
import { ManagerPerformanceScoreService } from "@/lib/services/manager-performance-score-service";
import { CommercialDomainService } from "@/lib/domain";
import { OFFICIAL_COMMERCIAL_ROLES } from "@/lib/domain/commercial-structure";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolve a lista de manager_ids únicos dos Gerentes de Campo,
 * excluindo canais corporativos (Inside Sales, Ecommerce, etc.).
 * Consome CommercialDomainService como SSOT.
 */
function resolveFieldManagerIds(): string[] {
  const fieldManagerNames = CommercialDomainService.getFieldManagerList();
  const fieldManagerNameSet = new Set(fieldManagerNames);

  // Extrair manager_ids únicos das OFFICIAL_COMMERCIAL_ROLES para gerentes de campo
  const idsSet = new Set<string>();
  for (const role of OFFICIAL_COMMERCIAL_ROLES) {
    if (fieldManagerNameSet.has(role.managerName)) {
      idsSet.add(role.managerId);
    }
  }

  return Array.from(idsSet);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    // Enforce automatic manager RLS scoping for non-admin profiles
    const isAdmin = ["Admin", "Admin Master", "Presidência", "Diretoria", "Gerente Nacional", "CEO"].includes(profile.role);
    if (!isAdmin && (profile.manager_name || user.id)) {
      filters.manager_id = profile.manager_name || user.id;
    }

    // 1. Resolver lista oficial de Gerentes de Campo (via CommercialDomainService SSOT)
    const fieldManagerIds = resolveFieldManagerIds();

    if (fieldManagerIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          ranking: [],
          periodo: null,
          meta: { totalGerentes: 0 },
        },
      });
    }

    // 2. Obter dados analíticos brutos do AnalyticsEngine (sem Score)
    const rawData = await AnalyticsEngine.getManagerPerformanceRanking(filters, fieldManagerIds);

    // 3. Calcular Score, normalização e classificação (serviço puro)
    const ranking = ManagerPerformanceScoreService.calculate(rawData.rawDataArray);

    // 4. Enriquecer nomes usando CommercialDomainService quando necessário
    const enrichedRanking = ranking.map((entry) => {
      // Se o nome veio vazio do SQL (gerente sem vendas no período), resolver via SSOT
      if (!entry.managerName) {
        const resolved = CommercialDomainService.resolveManager(entry.managerId);
        entry.managerName = resolved.managerName || entry.managerId;
      }
      return entry;
    });

    return NextResponse.json({
      success: true,
      data: {
        ranking: enrichedRanking,
        periodo: rawData.periodo,
        meta: {
          totalGerentes: enrichedRanking.length,
        },
      },
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
