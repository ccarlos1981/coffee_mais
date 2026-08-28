import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { OFFICIAL_ANALYTICS_SOURCES, resolveSupabaseTableName } from "@/lib/governance/analytics";
import { assertCronAccess } from "@/lib/supabase/auth-helpers";

export const runtime = 'nodejs';

// Configuração do Supabase (utilizando Service Role Key se possível para evitar RLS local)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Preferir a SERVICE_ROLE para processos de background (crons)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

interface SaleRow {
  manager: string | null;
  rede: string | null;
  nome_parceiro: string | null;
  fat: number | string;
}

/**
 * Endpoint de CRON Job para escanear a tabela de vendas e encontrar Gaps/Queda de faturamento.
 * Pode ser chamado 1 vez por dia via Vercel Cron.
 */
export async function GET(request: Request) {
  try {
    const cronCheck = assertCronAccess(request);
    if (!cronCheck.authorized) {
      return cronCheck.errorResponse!;
    }

    const supabase = getSupabaseClient();
    
    // 1. Determina as janelas de tempo
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // 2. Busca TODAS as vendas do mês anterior na fonte oficial homologada (mv_vendas_cliente_mensal)
    const prevSalesMap = new Map<string, { manager: string; fat: number }>();
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL))
        .select('manager, rede, nome_parceiro, fat')
        .eq('mes', prevMonth)
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;

      console.log(`[Generate Alerts] Processando lote de vendas do Mês Anterior: ${from} a ${from + 999}...`);
      for (const row of (data as any[])) {
        const clientName = row.rede || row.nome_parceiro || 'Não Mapeado';
        const fat = parseFloat(row.fat || 0);
        if (!row.manager) continue; // Ignorar vendas sem gerente
        const manager = row.manager;
        
        const existing = prevSalesMap.get(clientName) || { manager, fat: 0 };
        prevSalesMap.set(clientName, { manager, fat: existing.fat + fat });
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    // Filtra apenas matrizes expressivas (ex: Faturamento > R$ 2.000 no mês passado)
    const MINIMUM_BASE_FAT = 2000;
    const expressivosMap = new Map<string, { manager: string; fatPrev: number; fatCurr: number }>();
    
    for (const [client, data] of prevSalesMap.entries()) {
      if (data.fat >= MINIMUM_BASE_FAT) {
        expressivosMap.set(client, { manager: data.manager, fatPrev: data.fat, fatCurr: 0 });
      }
    }

    // 3. Busca TODAS as vendas do mês ATUAL na fonte oficial homologada para cruzar os dados
    from = 0;
    let pagesCurrProcessed = 0;
    while (pagesCurrProcessed < 100) {
      pagesCurrProcessed++;
      console.log(`[Generate Alerts] Buscando Mês Atual: offset ${from}...`);
      const { data, error } = await supabase
        .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL))
        .select('manager, rede, nome_parceiro, fat')
        .eq('mes', currentMonth)
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of (data as any[])) {
        const clientName = row.rede || row.nome_parceiro || 'Não Mapeado';
        const fat = parseFloat(row.fat || 0);
        
        if (expressivosMap.has(clientName)) {
           const existing = expressivosMap.get(clientName)!;
           existing.fatCurr += fat;
        }
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    // 4. Analisa a Queda com Pacing Temporal Proporcional (evita falso churn no início do mês)
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const pacingFactor = Math.min(1, Math.max(0.1, daysElapsed / totalDaysInMonth));

    const alertsToCreate = [];
    for (const [client, info] of expressivosMap.entries()) {
      // Benchmark ajustado ao ritmo temporal decorrido no mês corrente
      const expectedPacedFat = info.fatPrev * pacingFactor;
      const dropPct = expectedPacedFat > 0
        ? ((expectedPacedFat - info.fatCurr) / expectedPacedFat) * 100
        : (info.fatCurr === 0 ? 100 : 0);

      if (dropPct >= 30) {
        alertsToCreate.push({
          client_name: client,
          manager: info.manager,
          fat_previous: info.fatPrev,
          fat_current: info.fatCurr,
          drop_pct: Number(dropPct.toFixed(2)),
          alert_type: dropPct >= 80 ? 'CHURN_RISK' : 'MILD_DROP',
          status: 'PENDING',
          alert_month: currentMonth
        });
      }
    }

    // 5. Inserir/Atualizar no Banco de Dados (Upsert atualizando fat_current e drop_pct dinamicamente)
    let ops = 0;
    if (alertsToCreate.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('cm_client_alerts')
        .upsert(alertsToCreate, { onConflict: 'client_name, alert_month' })
        .select();
        
      if (insertError) throw insertError;
      ops = inserted ? inserted.length : 0;
    }

    return NextResponse.json({ 
      success: true, 
      scanned_clients: expressivosMap.size,
      alerts_generated: ops,
      period: currentMonth
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CRON] Error generating alerts:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
