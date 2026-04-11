import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data: networks, error } = await supabase
      .from('network_matrix')
      .select('*')
      .order('network', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, networks });
  } catch (error: unknown) {
    console.error('[NETWORKS API GET]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
