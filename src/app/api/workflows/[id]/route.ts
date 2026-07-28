// ==============================================================================
// API ROUTE: /api/workflows/[id]
// Sprint 4.1 — Enterprise Workflow Engine (Phase 3 Workflow Instances)
// ==============================================================================

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { EnterpriseWorkflowEngine } from "@/lib/workflow-enterprise";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/[id]
 * Retrieve specific workflow instance, approval history, audit trail, and domain event log.
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
    const instance = EnterpriseWorkflowEngine.getInstanceById(id);

    if (!instance) {
      return NextResponse.json(
        { success: false, error: `WorkflowInstance não encontrada com ID: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: instance,
    });
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[GET /api/workflows/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao consultar instância de workflow." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflows/[id]
 * Execute state transition or approval action guarded by WorkflowLockService.
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

    const actorName = user.email ? user.email.split("@")[0] : "Usuário";
    const actorRole = profile.role || "Vendedor";

    let updatedInstance;

    // Check if this is an approval action (APPROVE / REJECT / RETURN)
    if (body.approvalAction) {
      updatedInstance = await EnterpriseWorkflowEngine.processApprovalAction({
        workflowId: id,
        stepId: body.stepId,
        approverUserOrRole: user.email || user.id,
        approverName: actorName,
        approverRole: actorRole,
        action: body.approvalAction, // 'APPROVE' | 'REJECT' | 'RETURN'
        comment: body.comment,
        expectedUpdatedAt: body.expectedUpdatedAt,
      });
    } else if (body.targetState) {
      // Standard state machine transition
      updatedInstance = await EnterpriseWorkflowEngine.transitionState({
        workflowId: id,
        targetState: body.targetState,
        actorId: user.id,
        actorName: actorName,
        actorRole: actorRole,
        comment: body.comment,
        expectedUpdatedAt: body.expectedUpdatedAt,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Ação não especificada. Envie 'targetState' ou 'approvalAction'." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Operação executada com sucesso com proteção transacional de concorrência.",
      data: updatedInstance,
    });
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[PATCH /api/workflows/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao executar transição de workflow." },
      { status: 500 }
    );
  }
}
