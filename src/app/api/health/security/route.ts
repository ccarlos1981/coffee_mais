import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { EnterpriseSecurityEngine } from "@/lib/governance/security";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const securityData = EnterpriseSecurityEngine.getSecurityData();

    return NextResponse.json({
      success: true,
      data: securityData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
