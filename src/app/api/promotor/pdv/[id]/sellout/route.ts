import { NextResponse } from "next/server";
import { processPDVSellout } from "@/lib/ai/sellout-engine";
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
      return NextResponse.json({ success: false, error: "Código do PDV é obrigatório." }, { status: 400 });
    }

    // Strict Object-Level Authorization: verify user's portfolio / route scope over this PDV
    await assertPdvAccess(user.id, profile, pdvId);

    const analysis = await processPDVSellout(pdvId);

    // Format output as requested
    const formatted = analysis.map(item => ({
      sku: item.sku,
      estimated_stock_boxes: item.estimated_stock_boxes,
      sellout_velocity: item.sellout_velocity,
      days_of_inventory: item.days_of_inventory,
      stock_risk: item.stock_risk,
      suggested_order_boxes: item.suggested_order_boxes
    }));

    return NextResponse.json({
      success: true,
      sku_analysis: formatted
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
    console.error("[PROMOTOR PDV SELLOUT API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
