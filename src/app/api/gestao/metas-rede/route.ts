import { NextRequest, NextResponse } from "next/server";
import { CommercialPlanningService } from "@/lib/planning/commercial-planning-service";
import { PlanningTelemetry } from "@/lib/planning/planning-telemetry";
import { createClient } from "@/lib/supabase/server";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
  logAuditAction,
} from "@/lib/supabase/auth-helpers";

const ALLOWED_METAS_ROLES = [
  "Admin",
  "Admin Master",
  "CEO",
  "Presidência",
  "Presidencia",
  "Presidente",
  "Diretoria",
  "Diretor",
  "Diretor Comercial",
  "Gerente Nacional",
  "Trade",
  "Gerente Regional",
  "Gerente Comercial",
  "Gerente",
];

const TOP_DOWN_EXECUTIVE_ROLES = [
  "Admin",
  "Admin Master",
  "CEO",
  "Presidência",
  "Presidencia",
  "Presidente",
  "Diretoria",
  "Diretor",
  "Diretor Comercial",
  "Gerente Nacional",
];

/**
 * GET /api/gestao/metas-rede
 * Domain Handler for Commercial Planning (Metas por Rede).
 * Integrates full structured logging, telemetry, query metrics, and audit logging.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = PlanningTelemetry.createRequestId();
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const managerParam = searchParams.get("manager") || "all";
  const year = yearParam ? parseInt(yearParam, 10) : 2026;
  const month = monthParam ? parseInt(monthParam, 10) : 8;

  let userId = "anonymous";
  let userRole = "Admin";
  let userManagerName = "";
  let isGerenteOnly = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: profile } = await supabase
        .from("cm_user_profiles")
        .select("role, name, manager_name, employee_code")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        userRole = profile.role || "Gerente";
        userManagerName = profile.manager_name || profile.name || "";
        const normalizedRole = userRole.toLowerCase().trim();
        const allAccessRoles = [
          "admin",
          "admin master",
          "ceo",
          "presidência",
          "presidencia",
          "presidente",
          "diretoria",
          "diretor",
          "diretor comercial"
        ];
        isGerenteOnly = !allAccessRoles.includes(normalizedRole);
      }
    }
  } catch (err) {
    // Graceful fallback for public/internal calls
  }

  try {
    const viewModel = await CommercialPlanningService.getMetasRedeViewModel(year, month);

    // SEGURANÇA POR PERFIL (ITEM 1): Filtragem estrita no Backend para Gerentes
    if (isGerenteOnly && userManagerName) {
      const normUserMgr = userManagerName.toLowerCase().trim();
      const filteredBlocks = viewModel.managerBlocks.filter((mb) => {
        const mbMgr = mb.manager.toLowerCase().trim();
        const mbMgrId = (mb.manager_id || "").toLowerCase().trim();
        return mbMgr.includes(normUserMgr) || normUserMgr.includes(mbMgr) || (mbMgrId && mbMgrId === normUserMgr);
      });

      // Recalcular totais restritos à carteira do gerente
      let grandTotalFat = 0;
      let grandTotalMed3M = 0;
      let grandTotalMed3MKg = 0;
      let grandTotalMeta = 0;
      let grandTotalKg = 0;
      let preenchidas = 0;
      let totalRedes = 0;

      filteredBlocks.forEach((mb) => {
        grandTotalFat += mb.grandTotalFat || 0;
        grandTotalMed3M += mb.grandTotalMed3M || 0;
        grandTotalMed3MKg += mb.grandTotalMed3MKg || 0;
        grandTotalMeta += mb.grandTotalMeta || 0;
        grandTotalKg += mb.mgrVolPrevKg || 0;
        preenchidas += mb.mgrPreenchidas || 0;
        totalRedes += mb.redes.length;
      });

      viewModel.managerBlocks = filteredBlocks;
      viewModel.grandTotalFat = grandTotalFat;
      viewModel.grandTotalMed3M = grandTotalMed3M;
      viewModel.grandTotalMed3MKg = grandTotalMed3MKg;
      viewModel.grandTotalMeta = grandTotalMeta;
      viewModel.grandTotalKg = grandTotalKg;
      viewModel.preenchidas = preenchidas;
      viewModel.totalRedes = totalRedes;
      viewModel.totalManagers = filteredBlocks.length;
    }

    const executionTimeMs = Date.now() - startTime;
    const jsonStr = JSON.stringify(viewModel);
    const payloadSizeBytes = Buffer.byteLength(jsonStr, "utf8");

    // Record telemetry log
    await PlanningTelemetry.logRequest({
      requestId,
      timestamp: new Date().toISOString(),
      userId,
      managerId: managerParam,
      year,
      executionTimeMs,
      queryTimings: {
        sqlTimeMs: viewModel.telemetry.sqlTimeMs,
        backendTimeMs: viewModel.telemetry.backendTimeMs
      },
      recordCounts: {
        redes: viewModel.totalRedes,
        sales: viewModel.totalManagers,
        metas: viewModel.preenchidas
      },
      payloadSizeBytes,
      status: "SUCCESS"
    });

    const responsePayload = {
      ...viewModel,
      userProfile: {
        role: userRole,
        isGerenteOnly,
        userManagerName
      }
    };

    const response = NextResponse.json(responsePayload);
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("X-Execution-Time-MS", String(executionTimeMs));
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;

    await PlanningTelemetry.logRequest({
      requestId,
      timestamp: new Date().toISOString(),
      userId,
      managerId: managerParam,
      year,
      executionTimeMs,
      queryTimings: { viewSql: 0, salesMv: 0, metasTable: 0 },
      recordCounts: { redes: 0, sales: 0, metas: 0 },
      payloadSizeBytes: 0,
      status: "ERROR",
      error: error?.message || "Internal server error"
    });

    return NextResponse.json(
      { error: error?.message || "Internal server error during metas-rede fetching." },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}

/**
 * POST /api/gestao/metas-rede
 * Handles Workflow Status Transitions and Goal Upserts.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    // 1. Role verification for Metas module
    requireRole(profile, ALLOWED_METAS_ROLES);

    const body = await req.json();
    const { action, year, month, targetStatus, comments } = body;

    if (action === "WORKFLOW_TRANSITION") {
      if (!year || !month || !targetStatus) {
        return NextResponse.json(
          { success: false, error: "Parâmetros inválidos para transição de workflow: year, month e targetStatus são obrigatórios." },
          { status: 400 }
        );
      }

      const validStatuses = ["DRAFT", "REVIEW", "APPROVED", "FROZEN"];
      if (!validStatuses.includes(targetStatus)) {
        return NextResponse.json(
          { success: false, error: `Status de workflow inválido: ${targetStatus}` },
          { status: 400 }
        );
      }

      // 2. Specific role gate for top-down workflow approval / freezing / reopening
      if (targetStatus === "APPROVED" || targetStatus === "FROZEN" || targetStatus === "DRAFT") {
        requireRole(profile, TOP_DOWN_EXECUTIVE_ROLES);
      }

      // 3. User identity derived exclusively from the authenticated profile (ignoring body.user spoofing)
      const authenticatedUserIdentifier =
        profile.name ||
        profile.manager_name ||
        user.email ||
        user.id;

      const updatedWorkflow = await CommercialPlanningService.updateWorkflowStatus(
        Number(year),
        Number(month),
        targetStatus,
        authenticatedUserIdentifier,
        comments
      );

      await logAuditAction(user.id, "METAS_REDE_WORKFLOW_TRANSITION", "cm_weekly_projections_workflow", {
        year: Number(year),
        month: Number(month),
        targetStatus,
        executedBy: authenticatedUserIdentifier,
        role: profile.role,
      });

      return NextResponse.json({ success: true, workflow: updatedWorkflow });
    }

    return NextResponse.json({ success: false, error: "Ação não suportada." }, { status: 400 });
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message === "NOT_FOUND" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED") ||
      error.message === "FORBIDDEN"
    ) {
      return handleAuthError(error);
    }
    console.error("[POST /api/gestao/metas-rede] Error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Erro ao processar requisição." }, { status: 500 });
  }
}
