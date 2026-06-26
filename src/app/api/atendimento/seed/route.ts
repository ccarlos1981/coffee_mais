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
    
    // 1. Fetching base mapping data from sales table in batches
    console.log('[SEED] Fetching historical sales mapping...');
    interface SalesRow {
      uf: string | null;
      manager: string | null;
      cod_parceiro: string | null;
      nome_parceiro: string | null;
      rede: string | null;
      channel: string | null;
    }
    const allSales: SalesRow[] = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('sales_enriched')
        .select('uf, manager, cod_parceiro, nome_parceiro, rede, channel')
        .range(from, from + batchSize - 1);
        
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allSales.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    
    console.log(`[SEED] Fetched ${allSales.length} rows for distinct scanning.`);
    
    // 2. Getting Distinct UF -> Manager
    // (If a UF has multiple managers historically, the last one processed overwrites it. 
    // Ideally we would want the most recent, but for standardizing we'll just take the distinct occurrences map)
    const ufMap: Record<string, string> = {};
    const pdvMap: Record<string, { nome_parceiro: string | null, rede: string | null, canal: string, manager: string, uf: string | null }> = {};
    
    for (const row of allSales) {
      if (row.uf && row.manager) {
        ufMap[row.uf] = row.manager;
      }
      if (row.cod_parceiro && row.manager && row.channel) {
        pdvMap[row.cod_parceiro] = {
          nome_parceiro: row.nome_parceiro || null,
          rede: row.rede || null,
          canal: row.channel,
          manager: row.manager,
          uf: row.uf || null,
        };
      }
    }
    
    const ufPayload = Object.entries(ufMap).map(([uf, manager]) => ({ uf, manager }));
    const pdvPayload = Object.entries(pdvMap).map(([cod, data]) => ({
      cod_parceiro: cod,
      nome_parceiro: data.nome_parceiro,
      rede: data.rede,
      canal: data.canal,
      manager: data.manager,
      uf: data.uf,
    }));
    
    console.log(`[SEED] Found ${ufPayload.length} distinct UFs and ${pdvPayload.length} distinct PDVs.`);
    
    // 3. Upsert mappings into new tables
    if (ufPayload.length > 0) {
      const { error: err1 } = await supabase.from('manager_uf_mapping').upsert(ufPayload, { onConflict: 'uf' });
      if (err1) console.error('[SEED UF Error]', err1);
    }
    
    // Upserting PDVs by batches of 500 to prevent payload too large errors
    let pdvSuccess = 0;
    for (let i = 0; i < pdvPayload.length; i += 500) {
      const batch = pdvPayload.slice(i, i + 500);
      const { error: err2 } = await supabase.from('base_atendimento').upsert(batch, { onConflict: 'cod_parceiro' });
      if (err2) {
        console.error('[SEED PDV Error at batch ' + i + ']', err2);
      } else {
        pdvSuccess += batch.length;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Semente aplicada: ${ufPayload.length} UFs e ${pdvSuccess} PDVs preenchidos na tabela de configuração!`,
      uf_count: ufPayload.length,
      pdv_count: pdvSuccess
    });

  } catch (error: unknown) {
    console.error('[ATENDIMENTO SEED API Error]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
