// ==============================================================================
// API ROUTE: /api/workflow-definitions
// Sprint 4.1 — Enterprise Workflow Engine (Phase 2 Workflow Definitions)
// ==============================================================================

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { WorkflowDefinitionService } from "@/lib/workflow-enterprise/definition-service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflow-definitions
 * List all registered workflow definition schemas with optional filters.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const workflowKey = searchParams.get("workflowKey") || undefined;
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const search = searchParams.get("search") || undefined;

    const definitions = await WorkflowDefinitionService.listDefinitions({
      entityType,
      workflowKey,
      activeOnly,
      search,
    });

    return NextResponse.json({
      success: true,
      data: definitions,
      total: definitions.length,
    });
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[GET /api/workflow-definitions] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao consultar definições de workflow." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow-definitions
 * Register a new versioned WorkflowDefinition template via Repository Pattern.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const body = await request.json();

    if (!body.workflowKey || !body.name || !body.entityType || !body.stateMachine) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos obrigatórios ausentes: workflowKey, name, entityType, stateMachine.",
        },
        { status: 400 }
      );
    }

    const definition = await WorkflowDefinitionService.createDefinition({
      workflowKey: body.workflowKey,
      name: body.name,
      description: body.description || "",
      entityType: body.entityType,
      version: body.version || 1,
      active: body.active !== false,
      stateMachine: body.stateMachine,
      approvalPolicies: body.approvalPolicies || [],
      metadata: body.metadata || {},
    });

    return NextResponse.json(
      {
        success: true,
        message: "WorkflowDefinition registrada com sucesso via Repository Pattern.",
        data: definition,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    console.error("[POST /api/workflow-definitions] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao criar definição de workflow." },
      { status: 500 }
    );
  }
}
