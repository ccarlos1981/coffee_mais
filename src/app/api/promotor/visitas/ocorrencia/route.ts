import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/promotor/visitas/ocorrencia
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

    const formData = await request.formData();
    const visitaId = formData.get("visita_id") as string;
    const tipoOcorrencia = formData.get("tipo_ocorrencia") as string;
    const descricao = formData.get("descricao") as string | null;
    const foto = formData.get("foto") as File | null;

    if (!visitaId || !tipoOcorrencia) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    const clientActionId = formData.get("client_action_id") as string | null;
    if (clientActionId) {
      const { data: existingOcorrencia } = await supabase
        .from("cm_promotor_visita_ocorrencia")
        .select("*")
        .eq("client_action_id", clientActionId)
        .maybeSingle();

      if (existingOcorrencia) {
        return NextResponse.json({
          success: true,
          message: "Ocorrência registrada com sucesso! (Retorno Idempotente)",
          data: {
            ocorrencia: existingOcorrencia,
            status_visita: existingOcorrencia.tipo_ocorrencia === "LOJA_FECHADA" ? "LOJA_FECHADA" : (existingOcorrencia.tipo_ocorrencia === "ACESSO_NEGADO" ? "NAO_REALIZADA" : "PLANEJADA")
          }
        });
      }
    }

    const tiposValidos = ["LOJA_FECHADA", "ACESSO_NEGADO", "SEM_ESTOQUE", "SEM_MATERIAL_MKT", "RUPTURA_GRAVE", "OUTRO"];
    if (!tiposValidos.includes(tipoOcorrencia)) {
      return NextResponse.json({ success: false, error: "Tipo de ocorrência inválido." }, { status: 400 });
    }

    // 1. Buscar visita e validar permissão
    const { data: visita, error: visitaError } = await supabase
      .from("cm_promotor_visita")
      .select(`
        *,
        agenda:cm_promotor_agenda_diaria(promotor_id)
      `)
      .eq("id", visitaId)
      .single();

    if (visitaError || !visita) {
      console.error("[OCORRENCIA API] Erro ao buscar visita:", visitaError);
      return NextResponse.json({ success: false, error: "Visita não encontrada." }, { status: 404 });
    }

    if (visita.agenda.promotor_id !== perfil.employee_id) {
      return NextResponse.json({ success: false, error: "Acesso negado: Esta visita pertence a outro promotor." }, { status: 403 });
    }

    // Impedir ocorrência em visita concluída ou cancelada
    if (visita.status === "CONCLUIDA" || visita.status === "CANCELADA" || visita.status === "LOJA_FECHADA" || visita.status === "NAO_REALIZADA") {
      return NextResponse.json({ success: false, error: "Não é possível registrar ocorrências em visitas já finalizadas ou canceladas." }, { status: 400 });
    }

    let fotoUrl: string | null = null;

    // 2. Fazer upload de foto se fornecida
    if (foto) {
      const fileName = `${Date.now()}-ocorrencia.jpg`;
      const filePath = `${user.id}/visitas/ocorrencias/${fileName}`;
      const arrayBuffer = await foto.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("promotor-ponto")
        .upload(filePath, buffer, {
          contentType: foto.type,
          upsert: false
        });

      if (uploadError) {
        console.error("[OCORRENCIA API] Erro ao fazer upload da foto de ocorrência:", uploadError);
        return NextResponse.json({ success: false, error: "Erro ao anexar foto de comprovante de ocorrência." }, { status: 500 });
      }

      fotoUrl = uploadData.path;
    }

    // 3. Registrar a ocorrência
    const { data: novaOcorrencia, error: insertError } = await supabase
      .from("cm_promotor_visita_ocorrencia")
      .insert({
        visita_id: visita.id,
        tipo_ocorrencia: tipoOcorrencia,
        descricao: descricao || null,
        foto_url: fotoUrl,
        client_action_id: clientActionId || null
      })
      .select()
      .single();

    if (insertError) {
      console.error("[OCORRENCIA API] Erro ao inserir ocorrência:", insertError);
      return NextResponse.json({ success: false, error: "Erro ao salvar ocorrência no banco de dados." }, { status: 500 });
    }

    // 4. Se a ocorrência for impeditiva (Loja Fechada ou Acesso Negado), finaliza a visita imediatamente
    let statusVisitaAtualizado = visita.status;
    let updateFields: any = {};

    if (tipoOcorrencia === "LOJA_FECHADA") {
      statusVisitaAtualizado = "LOJA_FECHADA";
      updateFields = {
        status: "LOJA_FECHADA",
        justificativa_nao_visita: descricao || "Loja fechada reportada pelo promotor.",
        checkout_servidor: new Date().toISOString(),
        duracao_real_min: 0
      };
    } else if (tipoOcorrencia === "ACESSO_NEGADO") {
      statusVisitaAtualizado = "NAO_REALIZADA";
      updateFields = {
        status: "NAO_REALIZADA",
        justificativa_nao_visita: descricao || "Acesso negado ao PDV pelo estabelecimento.",
        checkout_servidor: new Date().toISOString(),
        duracao_real_min: 0
      };
    }

    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await supabase
        .from("cm_promotor_visita")
        .update(updateFields)
        .eq("id", visita.id);

      if (updateError) {
        console.error("[OCORRENCIA API] Erro ao atualizar status da visita para ocorrência impeditiva:", updateError);
        // Continuamos mesmo com o erro na atualização do status da visita
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ocorrência registrada com sucesso! Status da visita: ${statusVisitaAtualizado}.`,
      data: {
        ocorrencia: novaOcorrencia,
        status_visita: statusVisitaAtualizado
      }
    });

  } catch (error: unknown) {
    console.error("[OCORRENCIA API] Erro fatal:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar ocorrência."
    }, { status: 500 });
  }
}
