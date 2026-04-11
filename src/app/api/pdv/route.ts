import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// FORMAT: 00.000.000/0000-00
function cleanCNPJ(cnpj: string) {
  return cnpj.replace(/[^\d]/g, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const networkId = searchParams.get('network_id');

    const supabase = getSupabaseClient();
    
    // We want to fetch pdvs and join with network_matrix
    let query = supabase
      .from('pdvs')
      .select(`
        *,
        network_matrix (
          network,
          manager,
          network_uf
        )
      `)
      .order('created_at', { ascending: false });

    // Client-side text search simulation via Supabase ilike
    if (search) {
      query = query.or(`name.ilike.%${search}%,cnpj.ilike.%${search}%`);
    }
    
    if (networkId) {
      query = query.eq('network_id', networkId);
    }

    const { data: pdvs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, pdvs });
  } catch (error: unknown) {
    console.error('[PDV API GET]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { cnpj, name, network_id, erp_code, status } = body;

    if (!cnpj || !name) {
      return NextResponse.json({ success: false, error: 'CNPJ e Nome são obrigatórios.' }, { status: 400 });
    }

    // Clean CNPJ just in case for uniqueness at DB level if desired, 
    // but the UI should send it formatted. We will store exactly what UI sends but enforce unique constraint.
    const formatedCnpj = cnpj.trim();

    // Verification
    const { data: existing } = await supabase.from('pdvs').select('id').eq('cnpj', formatedCnpj).single();
    if (existing) {
       return NextResponse.json({ success: false, error: 'Este CNPJ já está cadastrado em outro PDV.' }, { status: 400 });
    }

    const { data, error } = await supabase.from('pdvs').insert({
      cnpj: formatedCnpj,
      name: name.trim(),
      network_id: network_id || null,
      erp_code: erp_code || null,
      status: status || 'active'
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, pdv: data }, { status: 201 });
  } catch (error: unknown) {
    console.error('[PDV API POST]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
