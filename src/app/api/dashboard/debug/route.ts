import { NextResponse } from 'next/server';
import { fetchAllSales, aggregate } from '../route';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: baseData } = await supabase.from('base_atendimento').select('*');
    const baseAtendimentoMap = new Map();
    if (baseData) {
      for (const row of baseData) if (row.cod_parceiro) baseAtendimentoMap.set(String(row.cod_parceiro), row);
    }
    
    const filters = {
      manager: null,
      familia: null,
      uf: null,
      channel: null,
      product: null
    };
    
    const sales = await fetchAllSales(supabase, '2026-05-01', '2026-05-31', filters, baseAtendimentoMap);
    const result = aggregate(sales, 0);
    
    return NextResponse.json({ success: true, byManager: result.byManager });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
