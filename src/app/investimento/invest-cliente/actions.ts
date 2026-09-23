"use server";

import { requireAuth, requireApprovedProfile } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, KaOfficialFaturamentoResult } from "@/lib/governance/analytics";

/**
 * Server Action para obter o Faturamento Oficial do Canal KA (Key Account)
 * para o Dash Resumido de Investimentos.
 * 
 * Consome exclusivamente a Single Source of Truth (SSOT) da AnalyticsEngine,
 * garantindo paridade absoluta com Vendas -> KA.
 */
export async function getFaturamentoKaAction(
  competencia: string
): Promise<KaOfficialFaturamentoResult> {
  const user = await requireAuth();
  await requireApprovedProfile(user.id);

  return AnalyticsEngine.getKaOfficialFaturamento(competencia);
}
