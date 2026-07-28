import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { EnterpriseDataLineageEngine } from "@/lib/governance/data-quality";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const lineageData = EnterpriseDataLineageEngine.getLineageData();

    return NextResponse.json({
      success: true,
      data: lineageData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
