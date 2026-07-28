// ==============================================================================
// API ROUTE: /api/workflows
// Sprint 4.1 — Enterprise Workflow Engine (Phase 3 Workflow Instances)
// ==============================================================================

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { EnterpriseWorkflowEngine } from "@/lib/workflow-enterprise";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows
 * List workflow instances with optional filtering + engine analytics summary.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const workflowKey = searchParams.get("workflowKey") || undefined;
    const currentState = searchParams.get("currentState") || undefined;
    const assignedTo = searchParams.get("assignedTo") || undefined;
    const priority = (searchParams.get("priority") as any) || undefined;
    const search = searchParams.get("search") || undefined;

    const instances = EnterpriseWorkflowEngine.listInstances({
      entityType,
      workflowKey,
      currentState,
      assignedTo,
      priority,
      search,
    });

    const analytics = await EnterpriseWorkflowEngine.getAnalyticsSummary();

    return NextResponse.json({
      success: true,
      data: instances,
      total: instances.length,
      analytics,
    });
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[GET /api/workflows] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao consultar instâncias de workflow." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Instantiate a new WorkflowInstance bound to a WorkflowDefinition.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const body = await request.json();

    if (!body.entityType || !body.entityId || !body.title) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos obrigatórios ausentes: entityType, entityId, title.",
        },
        { status: 400 }
      );
    }

    const instance = EnterpriseWorkflowEngine.createInstance({
      definitionId: body.definitionId,
      workflowKey: body.workflowKey,
      entityType: body.entityType,
      entityId: body.entityId,
      title: body.title,
      createdBy: user.email || "usuario@coffeemais.com.br",
      assignedTo: body.assignedTo,
      priority: body.priority || "MEDIUM",
      dueDate: body.dueDate,
      metadata: body.metadata || {},
    });

    return NextResponse.json(
      {
        success: true,
        message: "Instância de Workflow criada com sucesso.",
        data: instance,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[POST /api/workflows] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao instanciar workflow." },
      { status: 500 }
    );
  }
}
