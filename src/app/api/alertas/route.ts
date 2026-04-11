import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/alertas
 * Obtém os alertas ativos para o mês. Pode filtrar por gerente.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const manager = searchParams.get('manager');
    const month = searchParams.get('month'); // Ex: "2026-04"

    const supabase = getSupabaseClient();
    let query = supabase.from('cm_client_alerts').select(`
      *,
      cm_action_notes(id, note, created_at, created_by)
    `);

    // Busca apenas o mês requisitado ou o mês atual como fallback (opcional mas bom para performance)
    if (month) {
        query = query.eq('alert_month', month);
    }

    if (manager && manager !== 'all') {
      query = query.eq('manager', manager);
    }

    // Ordenar por Queda R$ (diferença entre prev e curr)
    const { data: alerts, error } = await query;
    if (error) throw error;

    // Ordenação no backend JS para resolver a regra de negócio da prioridade
    const sortedAlerts = (alerts || []).sort((a: any, b: any) => {
      const dropA = a.fat_previous - a.fat_current;
      const dropB = b.fat_previous - b.fat_current;
      return dropB - dropA;
    });

    return NextResponse.json({ success: true, alerts: sortedAlerts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/alertas
 * Adiciona uma nota/ação em um alerta e atualiza seu status
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alert_id, client_name, note, created_by, status_update } = body;

    if (!alert_id || !note) {
      return NextResponse.json({ success: false, error: "Missing body params" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. Inserir a Action Note
    const { error: noteError } = await supabase.from('cm_action_notes').insert({
      alert_id,
      client_name,
      note,
      created_by: created_by || 'Unknown'
    });

    if (noteError) throw noteError;

    // 2. Atualizar o status do Alerta principal
    if (status_update) {
      const { error: statusError } = await supabase
        .from('cm_client_alerts')
        .update({ status: status_update, updated_at: new Date().toISOString() })
        .eq('id', alert_id);

      if (statusError) throw statusError;
    }

    return NextResponse.json({ success: true, message: "Action registered" });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
