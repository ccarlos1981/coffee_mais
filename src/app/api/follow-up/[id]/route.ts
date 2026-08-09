/**
 * GET & PATCH /api/follow-up/[id] — Feature A: Follow-up Comercial Inteligente (Sprint 1)
 *
 * Handlers for retrieving single follow-up detail with timeline history,
 * and performing status transition / field editing.
 */

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { FollowUpService } from "@/lib/services/follow-up-service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    
    try {
      await requirePermission(profile.role, "Vendas");
    } catch {
      await requirePermission(profile.role, "Processo Comercial");
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID é obrigatório." }, { status: 400 });
    }

    const detail = await FollowUpService.getById(id);

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error: any) {
    if (error.message && error.message.includes('não encontrado')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return handleAuthError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    
    try {
      await requirePermission(profile.role, "Vendas");
    } catch {
      await requirePermission(profile.role, "Processo Comercial");
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID é obrigatório." }, { status: 400 });
    }

    const body = await request.json();

    let result;

    if (body.status) {
      // Status transition call
      result = await FollowUpService.updateStatus(
        id,
        {
          status: body.status,
          resultado: body.resultado,
          motivo_cancelamento: body.motivo_cancelamento,
          observacao: body.observacao,
        },
        user.id,
        profile.role,
        profile.manager_name
      );
    } else {
      // Content fields update call
      result = await FollowUpService.update(
        id,
        {
          tipo_acao: body.tipo_acao,
          motivo: body.motivo,
          descricao: body.descricao,
          prazo: body.prazo,
          prioridade: body.prioridade,
        },
        user.id,
        profile.role,
        profile.manager_name
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message && (
      error.message.includes('obrigatório') ||
      error.message.includes('inválida') ||
      error.message.includes('não é possível')
    )) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error.message && error.message.includes('não autorizado')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error.message && error.message.includes('não encontrado')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return handleAuthError(error);
  }
}
