import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    
    // We only extract updatable fields
    const { name, network_id, erp_code, status } = body;
    const updObj: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
    
    if (name) updObj.name = name.trim();
    if (network_id !== undefined) updObj.network_id = network_id;
    if (erp_code !== undefined) updObj.erp_code = erp_code;
    if (status) updObj.status = status;

    const { data, error } = await supabase
      .from('pdvs')
      .update(updObj)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, pdv: data });
  } catch (error: unknown) {
    console.error('[PDV API PUT]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('pdvs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[PDV API DELETE]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
