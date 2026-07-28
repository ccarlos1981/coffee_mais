import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { CommercialExecutionEngine, ExecutionFilterOptions } from "@/lib/commercial-execution";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters: ExecutionFilterOptions = {
      gerente: searchParams.get("gerente") || undefined,
      regional: searchParams.get("regional") || undefined,
      data: searchParams.get("data") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const executionData = CommercialExecutionEngine.getCommercialExecutionData(filters);

    return NextResponse.json({
      success: true,
      data: executionData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
