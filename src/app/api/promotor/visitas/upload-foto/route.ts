import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerFraudIncident } from "@/lib/antifraud/fraud-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil do promotor para obter employee_id
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
    const tipoFoto = formData.get("tipo_foto") as string;
    const descricao = formData.get("descricao") as string | null;
    const latStr = formData.get("latitude") as string | null;
    const lonStr = formData.get("longitude") as string | null;
    const takenAtStr = formData.get("taken_at") as string | null;
    const ordemStr = formData.get("ordem") as string | null;
    const foto = formData.get("foto") as File | null;

    if (!visitaId || !tipoFoto || !foto) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    const clientActionId = formData.get("client_action_id") as string | null;
    if (clientActionId) {
      const { data: existingFoto } = await supabase
        .from("cm_promotor_visita_foto")
        .select("*")
        .eq("client_action_id", clientActionId)
        .maybeSingle();

      if (existingFoto) {
        return NextResponse.json({
          success: true,
          message: "Foto enviada com sucesso! (Retorno Idempotente)",
          foto: existingFoto
        });
      }
    }

    const latitude = latStr ? parseFloat(latStr) : null;
    const longitude = lonStr ? parseFloat(lonStr) : null;
    const takenAt = takenAtStr ? new Date(takenAtStr).toISOString() : new Date().toISOString();
    const ordem = ordemStr ? parseInt(ordemStr, 10) : null;

    // 1. Buscar visita e validar se pertence ao promotor logado e está em progresso
    const { data: visita, error: visitaError } = await supabase
      .from("cm_promotor_visita")
      .select(`
        *,
        agenda:cm_promotor_agenda_diaria(promotor_id)
      `)
      .eq("id", visitaId)
      .single();

    if (visitaError || !visita) {
      return NextResponse.json({ success: false, error: "Visita não encontrada." }, { status: 404 });
    }

    if (visita.agenda.promotor_id !== perfil.employee_id) {
      return NextResponse.json({ success: false, error: "Acesso negado: Esta visita pertence a outro promotor." }, { status: 403 });
    }

    // Permitir upload de fotos apenas se a visita não estiver concluída/cancelada
    const statusPermitidos = ["CHECKIN_REALIZADO", "EM_EXECUCAO", "EM_ROTA"];
    if (!statusPermitidos.includes(visita.status)) {
      return NextResponse.json({ success: false, error: `Não é permitido enviar fotos para visitas finalizadas ou canceladas. Status atual: ${visita.status}` }, { status: 400 });
    }

    // 2. Upload da Foto para o Storage (promotor-ponto)
    const arrayBuffer = await foto.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate MD5 byte-by-byte hash
    const md5Hash = crypto.createHash("md5").update(buffer).digest("hex");

    // Check for duplicate MD5 hash in cm_promotor_visita_foto
    const { data: duplicate } = await supabase
      .from("cm_promotor_visita_foto")
      .select("id")
      .eq("foto_hash_md5", md5Hash)
      .eq("is_deleted", false)
      .maybeSingle();

    const todayStr = new Date().toISOString().split("T")[0];
    if (duplicate) {
      // Trigger incremental fraud incident for duplicate photo
      await registerFraudIncident(perfil.employee_id, "duplicate_photo", todayStr);
    }

    const fileName = `${Date.now()}-${tipoFoto.toLowerCase()}.jpg`;
    const filePath = `${user.id}/visitas/${visitaId}/${tipoFoto.toLowerCase()}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("promotor-ponto")
      .upload(filePath, buffer, {
        contentType: foto.type,
        upsert: false
      });

    if (uploadError) {
      console.error("[UPLOAD FOTO] Erro ao fazer upload no Storage:", uploadError);
      return NextResponse.json({ success: false, error: "Erro ao salvar o arquivo de foto no storage." }, { status: 500 });
    }

    // Obter URL pública ou caminho relativo do arquivo no bucket
    const fotoUrl = uploadData.path;

    // 3. Inserir o registro na tabela cm_promotor_visita_foto
    const { data: novaFoto, error: insertError } = await supabase
      .from("cm_promotor_visita_foto")
      .insert({
        visita_id: visitaId,
        tipo_foto: tipoFoto,
        foto_url: fotoUrl,
        descricao: descricao || null,
        latitude,
        longitude,
        taken_at: takenAt,
        ordem,
        client_action_id: clientActionId || null,
        foto_hash_md5: md5Hash,
        foto_hash_perceptual: null
      })
      .select()
      .single();

    if (insertError) {
      console.error("[UPLOAD FOTO] Erro ao salvar registro no banco:", insertError);
      return NextResponse.json({ success: false, error: "Erro ao gravar registro de foto no banco de dados." }, { status: 500 });
    }

    // Atualizar status da visita para EM_EXECUCAO se ainda estiver em CHECKIN_REALIZADO
    if (visita.status === "CHECKIN_REALIZADO") {
      await supabase
        .from("cm_promotor_visita")
        .update({ status: "EM_EXECUCAO" })
        .eq("id", visitaId);
    }

    return NextResponse.json({ success: true, foto: novaFoto });

  } catch (err: any) {
    console.error("[UPLOAD FOTO] Erro interno:", err);
    return NextResponse.json({ success: false, error: err.message || "Erro de rede no servidor." }, { status: 500 });
  }
}
