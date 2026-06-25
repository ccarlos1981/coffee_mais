import { NextResponse } from "next/server";
import { generateOrderRecommendation } from "@/lib/ai/order-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const recommendation = await generateOrderRecommendation(pdvId, visitaId);

    return NextResponse.json({
      success: true,
      recommendation
    });

  } catch (error: any) {
    console.error("[PROMOTOR PDV ORDER RECOMMENDATION API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
