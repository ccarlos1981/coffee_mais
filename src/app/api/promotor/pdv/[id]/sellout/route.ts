import { NextResponse } from "next/server";
import { processPDVSellout } from "@/lib/ai/sellout-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pdvId } = await params;
    if (!pdvId) {
      return NextResponse.json({ success: false, error: "Código do PDV é obrigatório." }, { status: 400 });
    }

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
    console.error("[PROMOTOR PDV SELLOUT API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
