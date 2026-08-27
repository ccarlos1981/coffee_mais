import { NextRequest, NextResponse } from "next/server";
import { ExecutiveCommercialService } from "@/lib/governance/executive/executiveCommercialService";
import { AnalyticsFilters } from "@/lib/governance/analytics/filters";
import {
  requireAuth,
  requireApprovedProfile,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const userRole = (profile.role || "").trim().toLowerCase();

    // Field-level reps are not authorized to view high-level executive dashboard metrics
    if (userRole === "promotor" || userRole === "vendedor") {
      return NextResponse.json(
        { success: false, error: "Acesso restrito à gestão comercial e executiva." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month") || (new Date().getMonth() + 1).toString().padStart(2, "0");
    const channel = searchParams.get("channel") || undefined;
    const uf = searchParams.get("uf") || undefined;

    // Strict regional manager scoping: force profile's identity regardless of query parameters
    let manager = searchParams.get("manager") || undefined;
    if (userRole === "gerente regional") {
      manager = profile.manager_name || profile.name || undefined;
    }

    const formattedMonth = `${year}-${month.padStart(2, "0")}`;

    const filters: AnalyticsFilters = {
      startMonth: formattedMonth,
      endMonth: formattedMonth,
      channel,
      manager,
      uf,
    };

    const data = await ExecutiveCommercialService.getExecutiveCommercialData(filters, Number(year), Number(month));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED")
    ) {
      return handleAuthError(error);
    }
    console.error("Erro na API GET /api/vendas/executivo:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro interno ao carregar dados do Dashboard Executivo Comercial",
      },
      { status: 500 }
    );
  }
}
