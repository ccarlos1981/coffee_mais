// ==============================================================================
// API ROUTE: /api/workflow-definitions/[id]
// Sprint 4.1 — Enterprise Workflow Engine (Phase 2 Workflow Definitions)
// ==============================================================================

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { WorkflowDefinitionService } from "@/lib/workflow-enterprise/definition-service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflow-definitions/[id]
 * Retrieve specific workflow definition by ID.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { id } = await params;
    const definition = await WorkflowDefinitionService.getDefinitionById(id);

    if (!definition) {
      return NextResponse.json(
        { success: false, error: `WorkflowDefinition não encontrado com ID: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: definition,
    });
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[GET /api/workflow-definitions/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao consultar definição de workflow." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflow-definitions/[id]
 * Update an existing workflow definition or toggle active status.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { id } = await params;
    const body = await request.json();

    const updated = await WorkflowDefinitionService.updateDefinition(id, body);

    return NextResponse.json({
      success: true,
      message: "WorkflowDefinition atualizada com sucesso.",
      data: updated,
    });
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[PATCH /api/workflow-definitions/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar definição de workflow." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflow-definitions/[id]
 * Soft delete (deactivate) a workflow definition.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { id } = await params;

    const deactivated = await WorkflowDefinitionService.deactivateDefinition(id);

    return NextResponse.json({
      success: true,
      message: "WorkflowDefinition desativada logicamente com sucesso.",
      data: deactivated,
    });
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[DELETE /api/workflow-definitions/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao desativar definição de workflow." },
      { status: 500 }
    );
  }
}
