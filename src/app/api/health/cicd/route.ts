import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { EnterpriseCICDEngine } from "@/lib/governance/devex";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const cicdData = EnterpriseCICDEngine.getCicdData();

    return NextResponse.json({
      success: true,
      data: cicdData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
