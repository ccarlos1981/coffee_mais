import { NextResponse } from 'next/server';
import { AnalyticsEngine } from '@/lib/governance/analytics';
import {
  requireAuth,
  requireApprovedProfile,
  handleAuthError,
} from '@/lib/supabase/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const userRole = (profile.role || "").trim().toLowerCase();

    // Field-level reps are not authorized to view aggregated commercial investment matrix
    if (userRole === "promotor" || userRole === "vendedor") {
      return NextResponse.json(
        { success: false, error: "Acesso restrito à gestão comercial, trade e executiva." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startMonth = searchParams.get('startMonth') || undefined;
    const endMonth = searchParams.get('endMonth') || undefined;
    const uf = searchParams.get('uf') || undefined;
    const channel = searchParams.get('channel') || undefined;
    const matriz = searchParams.get('rede') || searchParams.get('matriz') || undefined;

    // Strict regional manager scoping: force profile's identity regardless of query parameters
    let manager = searchParams.get('manager') || undefined;
    if (userRole === "gerente regional") {
      manager = profile.manager_name || profile.name || undefined;
    }

    const result = await AnalyticsEngine.getInvestimentoPorRede({
      startMonth,
      endMonth,
      manager,
      uf,
      channel,
      matriz,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED")
    ) {
      return handleAuthError(error);
    }
    console.error("[API Investimento por Rede Error]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao carregar dados de investimento por rede" },
      { status: 500 }
    );
  }
}
