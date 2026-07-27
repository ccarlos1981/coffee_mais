import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { SimulationEngine } from "@/lib/governance/analytics/simulation";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const nomeCenario = searchParams.get("nomeCenario") || undefined;
    const tipoAcao = (searchParams.get("tipoAcao") as any) || undefined;
    const variacaoFaturamentoPct = searchParams.get("variacaoFaturamentoPct") ? Number(searchParams.get("variacaoFaturamentoPct")) : undefined;
    const variacaoMacoPct = searchParams.get("variacaoMacoPct") ? Number(searchParams.get("variacaoMacoPct")) : undefined;
    const investimentoAdicionalR$ = searchParams.get("investimentoAdicionalR$") ? Number(searchParams.get("investimentoAdicionalR$")) : undefined;
    const targetRedeOuCliente = searchParams.get("targetRedeOuCliente") || undefined;

    const simulationData = await SimulationEngine.runSimulation(filters, {
      nomeCenario,
      tipoAcao,
      variacaoFaturamentoPct,
      variacaoMacoPct,
      investimentoAdicionalR$,
      targetRedeOuCliente,
    });

    return NextResponse.json({
      success: true,
      data: simulationData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
