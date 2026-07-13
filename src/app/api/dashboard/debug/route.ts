import { NextResponse } from 'next/server';
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (request.method !== "GET") {
    return NextResponse.json({ error: "Método não permitido" }, { status: 405 });
  }

  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('mv_vendas_mensal')
      .select('mes, manager, fat, qty, maco')
      .eq('mes', '2026-05');

    if (error) throw error;

    // Aggregate by manager
    const managerMap = new Map<string, { fat: number; qty: number; maco: number }>();
    for (const row of (data || [])) {
      const m = row.manager || 'Outros';
      const existing = managerMap.get(m) || { fat: 0, qty: 0, maco: 0 };
      existing.fat += Number(row.fat || 0);
      existing.qty += Number(row.qty || 0);
      existing.maco += Number(row.maco || 0);
      managerMap.set(m, existing);
    }

    const byManager = Array.from(managerMap.entries())
      .map(([manager, data]) => ({ manager, ...data }))
      .sort((a, b) => b.fat - a.fat);
    
    return NextResponse.json({ success: true, byManager, mvRows: data?.length || 0 });
  } catch (e: any) {
    return handleAuthError(e);
  }
}
