import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { EnterprisePerformanceEngine } from "@/lib/governance/performance";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const performanceData = EnterprisePerformanceEngine.getPerformanceData();

    return NextResponse.json({
      success: true,
      data: performanceData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
