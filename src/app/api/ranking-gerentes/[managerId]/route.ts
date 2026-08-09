/**
 * GET /api/ranking-gerentes/[managerId] — Feature 7 Sprint 3: Detalhe do Gerente
 *
 * Fornece dados de drill-down para o Drawer de detalhamento:
 * - Evolução mensal (faturamento por mês no Rolling 3M)
 * - Top 10 clientes (nome, rede, faturamento, participação)
 * - Clientes sem compra (nome, dias, faturamento histórico)
 * - Concentração Top 3 (nomes e participação percentual)
 *
 * Fluxo: Auth → AnalyticsEngine.getManagerPerformanceDetail() → JSON
 */

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine } from "@/lib/governance/analytics/engine";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Calcula o Rolling 3M (últimos 3 meses fechados) com base na data atual.
 */
function computeRolling3MPeriod(): { rollingStart: string; rollingEnd: string } {
  const now = new Date();
  let refYear = now.getFullYear();
  let refMonth = now.getMonth(); // 0-indexed, current month

  // Go back to previous month (last closed month)
  refMonth -= 1;
  if (refMonth < 0) { refMonth = 11; refYear -= 1; }

  // Rolling end = last closed month
  const endYear = refYear;
  const endMonth = refMonth + 1; // 1-indexed

  // Rolling start = 3 months before end
  let startMonth = endMonth - 2;
  let startYear = endYear;
  if (startMonth <= 0) { startMonth += 12; startYear -= 1; }

  return {
    rollingStart: `${startYear}-${String(startMonth).padStart(2, '0')}`,
    rollingEnd: `${endYear}-${String(endMonth).padStart(2, '0')}`,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ managerId: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { managerId } = await params;

    if (!managerId) {
      return NextResponse.json({ success: false, error: "managerId é obrigatório." }, { status: 400 });
    }

    const { rollingStart, rollingEnd } = computeRolling3MPeriod();

    const detail = await AnalyticsEngine.getManagerPerformanceDetail(
      managerId,
      rollingStart,
      rollingEnd,
    );

    return NextResponse.json({
      success: true,
      data: {
        ...detail,
        periodo: { rollingStart, rollingEnd },
      },
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
