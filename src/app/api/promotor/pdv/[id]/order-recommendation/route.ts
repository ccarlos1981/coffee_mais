import { NextResponse } from "next/server";
import { generateOrderRecommendation } from "@/lib/ai/order-engine";
import {
  requireAuth,
  requireApprovedProfile,
  assertPdvAccess,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const { id: pdvId } = await params;
    if (!pdvId) {
      return NextResponse.json(
        { success: false, error: "Código do PDV é obrigatório." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const visitaId = searchParams.get("visita_id");

    if (!visitaId) {
      return NextResponse.json(
        { success: false, error: "ID da visita é obrigatório." },
        { status: 400 }
      );
    }

    // Strict Object-Level Authorization: verify user's portfolio / route scope over this PDV
    await assertPdvAccess(user.id, profile, pdvId);

    const recommendation = await generateOrderRecommendation(pdvId, visitaId);

    return NextResponse.json({
      success: true,
      recommendation
    });

  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED") ||
      error.message === "FORBIDDEN"
    ) {
      return handleAuthError(error);
    }
    console.error("[PROMOTOR PDV ORDER RECOMMENDATION API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
