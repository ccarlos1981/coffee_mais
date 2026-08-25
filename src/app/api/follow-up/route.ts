/**
 * GET & POST /api/follow-up — Feature A: Follow-up Comercial Inteligente (Sprint 1)
 *
 * Route handlers for listing and creating follow-up actions.
 * Delegates all business logic, validation, and lifecycle state management to FollowUpService.
 */

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { FollowUpService, FollowUpListFilters, FollowUpStatus, FollowUpOrigem, FollowUpPrioridade } from "@/lib/services/follow-up-service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['Admin', 'Admin Master', 'Diretoria', 'Presidência', 'CEO', 'Gerente Nacional']);

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    
    // Permission check
    try {
      await requirePermission(profile.role, "Vendas");
    } catch {
      await requirePermission(profile.role, "Processo Comercial");
    }

    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const filters: FollowUpListFilters = {
      clienteId: searchParams.get("clienteId") || searchParams.get("cliente_id") || undefined,
      status: (searchParams.get("status") || "ALL") as FollowUpStatus | "ALL",
      origem: (searchParams.get("origem") || "ALL") as FollowUpOrigem | "ALL",
      origemRef: searchParams.get("origemRef") || searchParams.get("origem_ref") || undefined,
      origemRefs: searchParams.get("origemRefs") ? searchParams.get("origemRefs")!.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      prioridade: (searchParams.get("prioridade") || "ALL") as FollowUpPrioridade | "ALL",
      searchCliente: searchParams.get("searchCliente") || searchParams.get("q") || undefined,
      dataInicio: searchParams.get("dataInicio") || undefined,
      dataFim: searchParams.get("dataFim") || undefined,
    };

    // Scoping for non-admin field managers
    const requestedManager = searchParams.get("managerId") || searchParams.get("manager_id");
    const isAdmin = ADMIN_ROLES.has(profile.role);

    if (!isAdmin && profile.manager_name) {
      filters.managerId = profile.manager_name;
    } else if (requestedManager) {
      filters.managerId = requestedManager;
    }

    const result = await FollowUpService.list(filters, { page, pageSize });

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    
    try {
      await requirePermission(profile.role, "Vendas");
    } catch {
      await requirePermission(profile.role, "Processo Comercial");
    }

    const body = await request.json();

    const created = await FollowUpService.create(
      {
        cliente_id: body.cliente_id,
        tipo_acao: body.tipo_acao,
        motivo: body.motivo,
        descricao: body.descricao,
        prazo: body.prazo,
        prioridade: body.prioridade,
        origem: body.origem,
        origem_ref: body.origem_ref,
        manager_id: body.manager_id,
        gap_original_reais: body.gap_original_reais !== undefined ? body.gap_original_reais : null,
      },
      user.id,
      profile.role,
      profile.manager_name
    );

    return NextResponse.json({
      success: true,
      data: created,
    }, { status: 201 });
  } catch (error: any) {
    if (error.message && (
      error.message.includes('obrigatório') ||
      error.message.includes('não existe')
    )) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
