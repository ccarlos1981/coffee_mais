import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { MonthlyClosingEngine } from "@/lib/services/monthly-closing-engine";
import { resolveCanonicalManager, isSameManager } from "@/lib/domain/canonical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FULL_ACCESS_ROLES = ["Admin", "Admin Master", "CEO", "Gerente Nacional", "Diretoria", "Diretor"];

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    try {
      await requirePermission(profile.role, "RDM");
    } catch {
      try {
        await requirePermission(profile.role, "RPS");
      } catch {
        try {
          await requirePermission(profile.role, "Vendas");
        } catch {
          await requirePermission(profile.role, "Inovações");
        }
      }
    }

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get("year") || String(new Date().getFullYear());
    const monthStr = searchParams.get("month") || String(new Date().getMonth() + 1);
    const requestedManager = searchParams.get("manager") || undefined;
    const requestedChannel = searchParams.get("channel") || undefined;

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Validação estrita de parâmetros de data
    if (isNaN(year) || year < 2020 || year > 2035 || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: "Parâmetros de ano (year) ou mês (month) inválidos." },
        { status: 400 }
      );
    }

    const isFullAccess = FULL_ACCESS_ROLES.includes(profile.role || "");
    let managerFilter: string | undefined = requestedManager;

    if (!isFullAccess) {
      // Perfil restrito a regional
      const userCanonical = resolveCanonicalManager(profile.manager_name || profile.name);
      const userManagerName = userCanonical.managerName;

      if (requestedManager && !isSameManager(requestedManager, userManagerName)) {
        return NextResponse.json(
          {
            success: false,
            error: `Acesso negado (403 Forbidden): Você só possui permissão para visualizar os dados da sua própria regional (${userManagerName}).`,
          },
          { status: 403 }
        );
      }
      managerFilter = userManagerName;
    }

    const summary = await MonthlyClosingEngine.getClosingSummary({
      year,
      month,
      manager: managerFilter,
      channel: requestedChannel,
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
