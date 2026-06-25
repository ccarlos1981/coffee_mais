import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Função Haversine para cálculo de distância geodésica em metros
function calculateDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// POST /api/promotor/visitas/checkout
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
    const latStr = formData.get("latitude") as string;
    const lonStr = formData.get("longitude") as string;
    const dispositivoTimestamp = formData.get("dispositivo_timestamp") as string;
    const fotoExecucao = formData.get("foto_execucao") as File | null;

    if (!visitaId || !latStr || !lonStr || !dispositivoTimestamp) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);

    const clientActionId = formData.get("client_action_id") as string | null;
    if (clientActionId) {
      const { data: existingCheckout } = await supabase
        .from("cm_promotor_visita")
        .select("*")
        .eq("checkout_client_action_id", clientActionId)
        .maybeSingle();

      if (existingCheckout) {
        return NextResponse.json({
          success: true,
          message: "Checkout realizado com sucesso! (Retorno Idempotente)",
          data: existingCheckout
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
      .eq("id", visitaId)
      .single();

    if (visitaError || !visita) {
      console.error("[CHECKOUT API] Erro ao buscar visita:", visitaError);
      return NextResponse.json({ success: false, error: "Visita não encontrada." }, { status: 404 });
    }

    if (visita.agenda.promotor_id !== perfil.employee_id) {
      return NextResponse.json({ success: false, error: "Acesso negado: Esta visita pertence a outro promotor." }, { status: 403 });
    }

    // Apenas pode fazer check-out se já realizou check-in
    if (visita.status !== "CHECKIN_REALIZADO" && visita.status !== "EM_EXECUCAO") {
      return NextResponse.json({ success: false, error: "Não é possível realizar checkout de uma visita que não foi iniciada." }, { status: 400 });
    }

    // 2. Buscar a geolocalização e cerca virtual do PDV
    const { data: geoloc, error: geolocError } = await supabase
      .from("cm_promotor_pdv_geoloc")
      .select("latitude, longitude, geofence_radius_m")
      .eq("cod_parceiro", visita.cod_parceiro)
      .maybeSingle();

    if (geolocError || !geoloc) {
      console.error("[CHECKOUT API] Erro ao buscar geolocalização do PDV:", geolocError);
      return NextResponse.json({ success: false, error: "Parâmetros geográficos do PDV não configurados." }, { status: 400 });
    }

    // 3. Calcular distância e validar Cerca Virtual de Saída
    const distanciaMetros = calculateDistanceM(latitude, longitude, geoloc.latitude, geoloc.longitude);
    const limiteRaio = geoloc.geofence_radius_m;

    // Converter foto de execução para Buffer (se fornecida como fallback)
    let buffer: Buffer | null = null;
    if (fotoExecucao) {
      const arrayBuffer = await fotoExecucao.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // Se estiver fora do raio permitido da loja no checkout, bloqueia e registra compliance
    // BYPASS para ambiente de desenvolvimento local para fins de teste
    const bypassGeofence = process.env.NODE_ENV === "development";

    if (distanciaMetros > limiteRaio && !bypassGeofence) {
      console.warn(`[CHECKOUT API] Tentativa de checkout fora da cerca: Distância de ${distanciaMetros.toFixed(1)}m. Limite: ${limiteRaio}m.`);
      
      let uploadPath = null;
      if (buffer && fotoExecucao) {
        // Upload da foto de tentativa de fraude para auditoria
        const fileName = `${Date.now()}-fraude-gps-checkout.jpg`;
        const filePath = `${user.id}/visitas/tentativas/${fileName}`;
        
        const { data: uploadFraude } = await supabase.storage
          .from("promotor-ponto")
          .upload(filePath, buffer, {
            contentType: fotoExecucao.type,
            upsert: false
          });
        uploadPath = uploadFraude?.path || null;
      }

      // Gravar na tabela de compliance
      await supabase
        .from("cm_promotor_visita_tentativa_bloqueada")
        .insert({
          promotor_id: perfil.employee_id,
          cod_parceiro: visita.cod_parceiro,
          visita_id: visita.id,
          tipo_bloqueio: "GPS_FORA_CERCA",
          latitude_tentada: latitude,
          longitude_tentada: longitude,
          distancia_calculada_metros: Math.round(distanciaMetros),
          foto_tentada_url: uploadPath
        });

      return NextResponse.json({
        success: false,
        code: "GPS_FORA_CERCA",
        error: `Você está fora da cerca virtual permitida da loja. Checkout bloqueado. Distância: ${Math.round(distanciaMetros)}m. O limite é de ${limiteRaio}m.`
      }, { status: 400 });
    }

    // 4. Validar se todos os checklists de missões de trade foram preenchidos
    const dataHoje = new Date().toISOString().split("T")[0];
    
    const { data: missoesVinculadas } = await supabase
      .from("cm_trade_missao_pdv")
      .select(`
        missao_id,
        missao:cm_trade_missao(*)
      `)
      .eq("promotor_id", perfil.employee_id)
      .eq("cod_parceiro", visita.cod_parceiro)
      .eq("status", "PENDENTE");

    const missoesAtivas = missoesVinculadas?.filter(m => {
      if (!m.missao) return false;
      const mInfo = m.missao as any;
      const inicio = new Date(mInfo.data_inicio);
      const fim = new Date(mInfo.data_fim);
      const hoje = new Date(dataHoje);
      return hoje >= inicio && hoje <= fim;
    }) || [];

    if (missoesAtivas.length > 0) {
      const { data: execucoes, error: execError } = await supabase
        .from("cm_trade_missao_execucao")
        .select("missao_id")
        .eq("visita_id", visita.id);

      if (execError) {
        console.error("[CHECKOUT API] Erro ao buscar execuções de missão:", execError);
        return NextResponse.json({ success: false, error: "Erro ao validar status das missões vinculadas." }, { status: 500 });
      }

      const missaoIdsExecutados = new Set(execucoes?.map(e => e.missao_id) || []);
      const missaoNaoExecutadas = missoesAtivas.filter(m => !missaoIdsExecutados.has(m.missao_id));

      if (missaoNaoExecutadas.length > 0) {
        const titulosFaltantes = missaoNaoExecutadas.map(m => `"${(m.missao as any)?.titulo}"`).join(", ");
        return NextResponse.json({
          success: false,
          code: "CHECKLIST_PENDENTE",
          error: `Você deve preencher todos os checklists de missões antes de fechar a visita. Missões pendentes: ${titulosFaltantes}.`
        }, { status: 400 });
      }
    }

    // 5. Validar obrigatoriedade de fotos com base no motivo da visita
    const { data: fotosExistentes, error: fotosError } = await supabase
      .from("cm_promotor_visita_foto")
      .select("tipo_foto, foto_url")
      .eq("visita_id", visita.id)
      .eq("is_deleted", false);

    if (fotosError) {
      console.error("[CHECKOUT API] Erro ao buscar fotos da visita:", fotosError);
      return NextResponse.json({ success: false, error: "Erro ao validar fotos da visita." }, { status: 500 });
    }

    const totalFotosValidas = fotosExistentes ? [...fotosExistentes] : [];

    // Fallback: Se enviou foto no form (ex: cliente antigo), faz upload e adiciona na lista
    let fallbackFotoUrl: string | null = null;
    if (fotoExecucao && buffer) {
      const fileName = `${Date.now()}-checkout-legacy.jpg`;
      const filePath = `${user.id}/visitas/${visita.id}/checkout/${fileName}`;
      const { data: uploadLegacy } = await supabase.storage
        .from("promotor-ponto")
        .upload(filePath, buffer, {
          contentType: fotoExecucao.type,
          upsert: false
        });

      if (uploadLegacy) {
        fallbackFotoUrl = uploadLegacy.path;
        
        // Inserir registro no banco
        const { data: novaFoto } = await supabase
          .from("cm_promotor_visita_foto")
          .insert({
            visita_id: visita.id,
            tipo_foto: visita.motivo_visita === "ruptura" ? "RUPTURA" : "GONDOLA",
            foto_url: fallbackFotoUrl,
            latitude,
            longitude,
            taken_at: new Date().toISOString(),
            ordem: totalFotosValidas.length + 1
          })
          .select()
          .single();
        
        if (novaFoto) {
          totalFotosValidas.push(novaFoto);
        }
      }
    }

    const tiposFotosSet = new Set(totalFotosValidas.map(f => f.tipo_foto));

    // Regras de negócio por motivo_visita
    const motivo = visita.motivo_visita;
    if (motivo === "rotina" || motivo === "abastecimento") {
      if (!tiposFotosSet.has("GONDOLA")) {
        return NextResponse.json({
          success: false,
          code: "FOTO_OBRIGATORIA",
          error: "Para visitas de rotina ou abastecimento, é obrigatório registrar pelo menos uma foto de GÔNDOLA."
        }, { status: 400 });
      }
    } else if (motivo === "ruptura") {
      if (!tiposFotosSet.has("RUPTURA")) {
        return NextResponse.json({
          success: false,
          code: "FOTO_OBRIGATORIA",
          error: "Para visitas de auditoria de ruptura, é obrigatório registrar pelo menos uma foto de RUPTURA."
        }, { status: 400 });
      }
    } else if (motivo === "campanha" || motivo === "auditoria_trade") {
      const temPontoExtra = tiposFotosSet.has("EXTRA") || tiposFotosSet.has("PONTA_GONDOLA") || tiposFotosSet.has("ILHA");
      if (!temPontoExtra) {
        return NextResponse.json({
          success: false,
          code: "FOTO_OBRIGATORIA",
          error: "Para visitas de campanha ou auditoria, é obrigatório registrar pelo menos uma foto de exibição extra (Ponto Extra, Ponta de Gôndola ou Ilha)."
        }, { status: 400 });
      }
    } else {
      // Qualquer outro motivo exige pelo menos 1 foto
      if (totalFotosValidas.length === 0) {
        return NextResponse.json({
          success: false,
          code: "FOTO_OBRIGATORIA",
          error: "Você deve tirar pelo menos uma foto de qualquer tipo para finalizar esta visita."
        }, { status: 400 });
      }
    }

    // Definir foto principal para retrocompatibilidade com campos legados
    let mainFotoUrl = fallbackFotoUrl;
    if (!mainFotoUrl && totalFotosValidas.length > 0) {
      const gondolaFoto = totalFotosValidas.find(f => f.tipo_foto === "GONDOLA");
      mainFotoUrl = gondolaFoto ? gondolaFoto.foto_url : totalFotosValidas[0].foto_url;
    }

    // 6. Calcular a Duração Real da Visita em Minutos
    const checkinTime = new Date(visita.checkin_servidor).getTime();
    const checkoutTime = new Date().getTime();
    const duracaoMs = checkoutTime - checkinTime;
    const duracaoRealMinutos = Math.max(1, Math.round(duracaoMs / 1000 / 60)); // Mínimo de 1 minuto

    // 7. Atualizar a Visita com status de Concluída e Registrar Checkout
    const { data: visitaConcluida, error: updateError } = await supabase
      .from("cm_promotor_visita")
      .update({
        status: "CONCLUIDA",
        checkout_servidor: new Date().toISOString(),
        checkout_dispositivo: dispositivoTimestamp,
        checkout_latitude: latitude,
        checkout_longitude: longitude,
        checkout_foto_execucao_url: mainFotoUrl,
        distancia_checkout_metros: Math.round(distanciaMetros),
        duracao_real_min: duracaoRealMinutos,
        checkout_client_action_id: clientActionId || null
      })
      .eq("id", visita.id)
      .select()
      .single();

    if (updateError) {
      console.error("[CHECKOUT API] Erro ao atualizar visita no checkout:", updateError);
      return NextResponse.json({ success: false, error: "Erro ao finalizar a visita no banco de dados." }, { status: 500 });
    }

    // 8. Atualizar o status das missões vinculadas de PENDENTE para EXECUTADA
    if (missoesAtivas.length > 0) {
      const missaoIdsParaAtualizar = missoesAtivas.map(m => m.missao_id);
      
      const { error: updateMissoesError } = await supabase
        .from("cm_trade_missao_pdv")
        .update({ status: "EXECUTADA" })
        .eq("promotor_id", perfil.employee_id)
        .eq("cod_parceiro", visita.cod_parceiro)
        .in("missao_id", missaoIdsParaAtualizar);

      if (updateMissoesError) {
        console.error("[CHECKOUT API] Erro ao atualizar status das missões do PDV:", updateMissoesError);
        // Continuamos de qualquer forma, pois a visita já foi concluída
      }
    }

    return NextResponse.json({
      success: true,
      message: "Visita concluída com sucesso!",
      data: visitaConcluida
    });

  } catch (error: unknown) {
    console.error("[CHECKOUT API] Erro fatal:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar checkout."
    }, { status: 500 });
  }
}
