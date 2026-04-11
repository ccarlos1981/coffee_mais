import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST() {
  try {
    const supabase = getSupabaseClient();
    
    console.log('[SYNC] Starting historical synchronization (ler para trás)...');
    
    // Calling the RPC function created in the database migration
    const { data: rowsAffected, error } = await supabase.rpc('sync_historical_sales');
    
    if (error) {
      console.error('[SYNC RPC Error]', error);
      throw error;
    }

    console.log(`[SYNC] Success! Affected historical rows: ${rowsAffected}`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Sincronização histórica concluída com sucesso!",
      rowsAffected: rowsAffected 
    });

  } catch (error: unknown) {
    console.error('[ATENDIMENTO SYNC API Error]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
