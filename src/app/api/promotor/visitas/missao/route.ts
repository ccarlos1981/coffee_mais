import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/promotor/visitas/missao - Registra execução do checklist de missão
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil do promotor
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) {
      return NextResponse.json({ success: false, error: "Perfil de promotor digital correspondente não encontrado." }, { status: 400 });
    }

    const body = await request.json();
    const { visita_id, missao_id, respostas_checklist, client_action_id } = body;

    if (!visita_id || !missao_id || !respostas_checklist) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    if (client_action_id) {
      const { data: existingMissao } = await supabase
        .from("cm_trade_missao_execucao")
        .select("*")
        .eq("client_action_id", client_action_id)
        .maybeSingle();

      if (existingMissao) {
        return NextResponse.json({
          success: true,
          message: "Checklist de missão registrado com sucesso! (Retorno Idempotente)",
          data: existingMissao
        });
      }
    }

    // 1. Buscar visita e validar se pertence ao promotor logado
    const { data: visita, error: visitaError } = await supabase
      .from("cm_promotor_visita")
      .select(`
        *,
        agenda:cm_promotor_agenda_diaria(promotor_id)
      `)
      .eq("id", visita_id)
      .single();

    if (visitaError || !visita) {
      console.error("[MISSAO EXEC API] Erro ao buscar visita:", visitaError);
      return NextResponse.json({ success: false, error: "Visita não encontrada." }, { status: 404 });
    }

    if (visita.agenda.promotor_id !== perfil.employee_id) {
      return NextResponse.json({ success: false, error: "Acesso negado: Esta visita pertence a outro promotor." }, { status: 403 });
    }

    // Apenas pode executar missões em visitas com check-in realizado ou em andamento
    if (visita.status !== "CHECKIN_REALIZADO" && visita.status !== "EM_EXECUCAO") {
      return NextResponse.json({ success: false, error: "Você deve realizar check-in na loja antes de iniciar o preenchimento de checklists." }, { status: 400 });
    }

    // 2. Persistir respostas do checklist no banco
    const { data: novaExecucao, error: insertError } = await supabase
      .from("cm_trade_missao_execucao")
      .insert({
        visita_id,
        missao_id,
        respostas_checklist,
        client_action_id: client_action_id || null
      })
      .select()
      .single();

    if (insertError) {
      console.error("[MISSAO EXEC API] Erro ao salvar checklist:", insertError);
      // Se der erro por chave única (já respondido), tentamos atualizar
      if (insertError.code === "23505") { // Chave única duplicada
        const { data: execAtualizada, error: updateError } = await supabase
          .from("cm_trade_missao_execucao")
          .update({ respostas_checklist })
          .eq("visita_id", visita_id)
          .eq("missao_id", missao_id)
          .select()
          .single();

        if (updateError) {
          console.error("[MISSAO EXEC API] Erro ao atualizar checklist existente:", updateError);
          return NextResponse.json({ success: false, error: "Erro ao atualizar respostas do checklist." }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Checklist atualizado com sucesso!", data: execAtualizada });
      }

      return NextResponse.json({ success: false, error: "Erro ao gravar respostas do checklist." }, { status: 500 });
    }

    // 3. Atualizar status da visita de CHECKIN_REALIZADO para EM_EXECUCAO (se ainda não estiver)
    if (visita.status === "CHECKIN_REALIZADO") {
      await supabase
        .from("cm_promotor_visita")
        .update({ status: "EM_EXECUCAO" })
        .eq("id", visita.id);
    }

    return NextResponse.json({
      success: true,
      message: "Checklist de missão registrado com sucesso!",
      data: novaExecucao
    });

  } catch (error: unknown) {
    console.error("[MISSAO EXEC API] Erro fatal:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar checklist de missão."
    }, { status: 500 });
  }
}
