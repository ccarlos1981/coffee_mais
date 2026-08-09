/**
 * GET /api/follow-up/kpis — Feature A: Follow-up Comercial Inteligente (Sprint 1)
 *
 * Handler to calculate operational KPIs:
 * Ações Abertas, Ações Concluidas, Ações Atrasadas, Taxa de Conclusão %, Tempo Médio de Resolução.
 */

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { FollowUpService, FollowUpListFilters, FollowUpOrigem } from "@/lib/services/follow-up-service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['Admin', 'Admin Master', 'Diretoria', 'Presidência', 'CEO', 'Gerente Nacional']);

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    
    try {
      await requirePermission(profile.role, "Vendas");
    } catch {
      await requirePermission(profile.role, "Processo Comercial");
    }

    const { searchParams } = new URL(request.url);

    const filters: FollowUpListFilters = {
      origem: (searchParams.get("origem") || "ALL") as FollowUpOrigem | "ALL",
      dataInicio: searchParams.get("dataInicio") || undefined,
      dataFim: searchParams.get("dataFim") || undefined,
    };

    const requestedManager = searchParams.get("managerId") || searchParams.get("manager_id");
    const isAdmin = ADMIN_ROLES.has(profile.role);

    if (!isAdmin && profile.manager_name) {
      filters.managerId = profile.manager_name;
    } else if (requestedManager) {
      filters.managerId = requestedManager;
    }

    const kpis = await FollowUpService.getKpis(filters);

    return NextResponse.json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
