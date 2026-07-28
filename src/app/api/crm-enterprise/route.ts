import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { CrmEnterpriseEngine, CrmFilterOptions } from "@/lib/crm-enterprise";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters: CrmFilterOptions = {
      gerente: searchParams.get("gerente") || undefined,
      rede: searchParams.get("rede") || undefined,
      regional: searchParams.get("regional") || undefined,
      estagio: searchParams.get("estagio") || undefined,
      periodo: searchParams.get("periodo") || undefined,
    };

    const crmData = CrmEnterpriseEngine.getCrmEnterpriseData(filters);

    return NextResponse.json({
      success: true,
      data: crmData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
