import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { queryDRESales } from "@/lib/dre-bigquery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds (Vercel Pro max)

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const startedAt = new Date();
  const supabase = getSupabaseClient();
  let logId: string | null = null;
  let ano: number;
  let mes: number;

  try {
    const body = await request.json();
    ano = Number(body.ano);
    mes = Number(body.mes);

    if (!ano || !mes || isNaN(ano) || isNaN(mes)) {
      return NextResponse.json({ error: "Parâmetros 'ano' e 'mes' são obrigatórios." }, { status: 400 });
    }

    // 1. Criar o log de importação inicial com status 'uploaded'
    const { data: log, error: logError } = await supabase
      .from("cm_dre_import_logs")
      .insert({
        filename: `BigQuery Sync DRE - ${ano}/${mes.toString().padStart(2, '0')}`,
        source: "bigquery",
        status: "uploaded",
        started_at: startedAt.toISOString(),
      })
      .select("id")
      .single();

    if (logError || !log) {
      return NextResponse.json({ error: "Falha ao inicializar log de importação." }, { status: 500 });
    }

    logId = log.id;

    // 2. Mudar status do log para 'syncing_bigquery'
    await supabase
      .from("cm_dre_import_logs")
      .update({ status: "syncing_bigquery" })
      .eq("id", logId);

    // 3. Consultar faturamento/volume no BigQuery
    let bqRows;
    try {
      bqRows = await queryDRESales(ano, mes);
    } catch (bqErr: any) {
      await supabase
        .from("cm_dre_import_logs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt.getTime(),
          error_log: `Erro ao consultar BigQuery: ${bqErr.message || String(bqErr)}`,
        })
        .eq("id", logId);

      return NextResponse.json({ error: "Erro ao consultar dados no BigQuery.", details: bqErr.message }, { status: 502 });
    }

    // 4. Mudar status para 'normalizing'
    await supabase
      .from("cm_dre_import_logs")
      .update({ status: "normalizing" })
      .eq("id", logId);

    // Obter ID do usuário autenticado no cabeçalho (se houver, ou usar um ID padrão do sistema)
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }

    // 5. Chamar a Stored Procedure RPC sync_dre_sales_data no Supabase
    // Ela adquire o lock consultivo e faz o merge versão a versão
    const { data: syncResult, error: syncError } = await supabase.rpc("sync_dre_sales_data", {
      p_ano: ano,
      p_mes: mes,
      p_import_log_id: logId,
      p_uploaded_by: userId,
      p_rows: bqRows,
    });

    if (syncError) {
      await supabase
        .from("cm_dre_import_logs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt.getTime(),
          error_log: `Erro no processamento do banco: ${syncError.message}`,
        })
        .eq("id", logId);

      return NextResponse.json({ error: "Erro durante a sincronização dos dados no banco.", details: syncError.message }, { status: 500 });
    }

    // 6. Atualizar log para 'success'
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    
    await supabase
      .from("cm_dre_import_logs")
      .update({
        status: "success",
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
        rows_imported: syncResult?.processed || 0,
      })
      .eq("id", logId);

    return NextResponse.json({
      success: true,
      log_id: logId,
      processed: syncResult?.processed || 0,
      inserted: syncResult?.inserted || 0,
      updated: syncResult?.updated || 0,
      duration_ms: durationMs,
    });

  } catch (error: any) {
    console.error("Erro geral na API de DRE Sync:", error);

    if (logId) {
      await supabase
        .from("cm_dre_import_logs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt.getTime(),
          error_log: error.message || String(error),
        })
        .eq("id", logId);
    }

    return NextResponse.json({ error: "Erro interno do servidor.", details: error.message }, { status: 500 });
  }
}
