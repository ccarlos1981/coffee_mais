import { NextRequest, NextResponse } from "next/server";
import { ExecutiveCommercialService } from "@/lib/governance/executive/executiveCommercialService";
import { AnalyticsFilters } from "@/lib/governance/analytics/filters";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month") || (new Date().getMonth() + 1).toString().padStart(2, "0");
    const channel = searchParams.get("channel") || undefined;
    const manager = searchParams.get("manager") || undefined;
    const uf = searchParams.get("uf") || undefined;

    const formattedMonth = `${year}-${month.padStart(2, "0")}`;

    const filters: AnalyticsFilters = {
      startMonth: formattedMonth,
      endMonth: formattedMonth,
      channel,
      manager,
      uf,
    };

    const data = await ExecutiveCommercialService.getExecutiveCommercialData(filters, Number(year), Number(month));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Erro na API GET /api/vendas/executivo:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro interno ao carregar dados do Dashboard Executivo Comercial",
      },
      { status: 500 }
    );
  }
}
