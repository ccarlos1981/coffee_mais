import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { EnterpriseQualityEngine } from "@/lib/governance/quality";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const testsData = EnterpriseQualityEngine.getTestsData();

    return NextResponse.json({
      success: true,
      data: testsData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
