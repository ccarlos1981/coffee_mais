import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Atendimento");

    const supabase = createAdminClient();
    
    console.log('[SYNC] Starting customer ownership and historical synchronization...');
    
    // 1. Executar recalculo oficial dos responsáveis pelos clientes
    const { data: rowsAffected, error: rpcError } = await supabase.rpc('recalcular_responsaveis_clientes');
    
    if (rpcError) {
      console.error('[SYNC RPC Error]', rpcError);
      throw rpcError;
    }

    // 2. Enfileirar refresh oficial das materialized views analíticas
    try {
      await supabase.rpc('fn_enqueue_mv_refresh');
    } catch (enqueueErr) {
      console.warn('[SYNC MV Enqueue Warning]', enqueueErr);
    }

    const totalAffected = typeof rowsAffected === 'number' ? rowsAffected : 0;
    console.log(`[SYNC] Success! Affected customer rows: ${totalAffected}`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Sincronização histórica concluída com sucesso!",
      rowsAffected: totalAffected 
    });

  } catch (error: any) {
    if (error.message === "UNAUTHENTICATED" || error.message === "PERMISSION_DENIED" || error.message === "PROFILE_NOT_APPROVED" || error.message === "PROFILE_NOT_FOUND") {
      return handleAuthError(error);
    }
    console.error('[ATENDIMENTO SYNC API Error]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
