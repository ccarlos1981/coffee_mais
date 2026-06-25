import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logApiTelemetry } from "@/lib/observability/telemetry";
import { registerFraudIncident } from "@/lib/antifraud/fraud-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Duração/distância geodésica via Haversine
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

// POST /api/promotor/visitas/checkin
export async function POST(request: Request) {
  const startTime = Date.now();
  let employeeId: string | null = null;

  const respond = async (json: any, init?: ResponseInit) => {
    const status = init?.status || 200;
    const duration = Date.now() - startTime;
    await logApiTelemetry({
      route: "/api/promotor/visitas/checkin",
      method: "POST",
      statusCode: status,
      responseTimeMs: duration,
      promotorId: employeeId,
      errorMessage: status >= 400 ? (json.error || JSON.stringify(json)) : null
    });
    return NextResponse.json(json, init);
  };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return respond({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil do promotor
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) {
      return respond({ success: false, error: "Perfil de promotor digital correspondente não encontrado." }, { status: 400 });
    }

    employeeId = perfil.employee_id;

    const formData = await request.formData();
    const visitaId = formData.get("visita_id") as string;
    const latVal = formData.get("latitude") as string;
    const lonVal = formData.get("longitude") as string;
    const dispositivoTimestamp = formData.get("dispositivo_timestamp") as string;
    const fotoFachada = formData.get("foto_fachada") as File | null;

    if (!visitaId || latVal === undefined || lonVal === undefined || !dispositivoTimestamp || !fotoFachada) {
      return respond({ success: false, error: "Parâmetros obrigatórios ausentes. A foto da fachada é obrigatória." }, { status: 400 });
    }

    const latitude = parseFloat(latVal);
    const longitude = parseFloat(lonVal);

    if (isNaN(latitude) || isNaN(longitude)) {
      return respond({ success: false, error: "Coordenadas GPS inválidas." }, { status: 400 });
    }

    const clientActionId = formData.get("client_action_id") as string | null;
    if (clientActionId) {
      const { data: existingCheckin } = await supabase
        .from("cm_promotor_visita")
        .select("*")
        .eq("checkin_client_action_id", clientActionId)
        .maybeSingle();

      if (existingCheckin) {
        return respond({
          success: true,
          message: "Check-in realizado com sucesso! (Retorno Idempotente)",
          data: existingCheckin
        });
      }
    }

    // 1. Buscar visita e validar se pertence ao promotor logado
    const { data: visita, error: visitaError } = await supabase
      .from("cm_promotor_visita")
      .select(`
        *,
        agenda:cm_promotor_agenda_diaria(id, promotor_id, data_agenda)
      `)
      .eq("id", visitaId)
      .single();

    if (visitaError || !visita) {
      console.error("[CHECKIN API] Erro ao buscar visita:", visitaError);
      return respond({ success: false, error: "Visita não encontrada." }, { status: 404 });
    }

    // Validar agenda
    if (!visita.agenda) {
      // Caso a visita esteja órfã ou sem agenda ativa
      await supabase
        .from("cm_promotor_visita_tentativa_bloqueada")
        .insert({
          promotor_id: perfil.employee_id,
          cod_parceiro: visita.cod_parceiro,
          visita_id: visita.id,
          tipo_bloqueio: "FORA_AGENDA",
          latitude_tentada: latitude,
          longitude_tentada: longitude
        });
      return respond({ success: false, error: "Visita inválida: Sem agenda diária associada." }, { status: 400 });
    }

    // Restrição: O promotor só pode bater check-in na sua própria visita
    if (visita.agenda.promotor_id !== perfil.employee_id) {
      return respond({ success: false, error: "Acesso negado: Esta visita pertence a outro promotor." }, { status: 403 });
    }

    // Impedir check-in duplo
    if (visita.status !== "PLANEJADA" && visita.status !== "EM_ROTA") {
      return respond({ success: false, error: `Check-in não permitido para visitas com status atual: ${visita.status}` }, { status: 400 });
    }

    // 2. Buscar a geolocalização e cerca virtual do PDV
    const { data: geoloc, error: geolocError } = await supabase
      .from("cm_promotor_pdv_geoloc")
      .select("latitude, longitude, geofence_radius_m")
      .eq("cod_parceiro", visita.cod_parceiro)
      .maybeSingle();

    if (geolocError || !geoloc) {
      console.error("[CHECKIN API] Erro ao buscar geolocalização do PDV:", geolocError);
      return respond({ success: false, error: "Parâmetros geográficos do PDV não configurados." }, { status: 400 });
    }

    // 3. Calcular distância e validar Cerca Virtual (Geofencing Dinâmico)
    const distanciaMetros = calculateDistanceM(latitude, longitude, geoloc.latitude, geoloc.longitude);
    const limiteRaio = geoloc.geofence_radius_m;

    // Se estiver fora do raio permitido da loja, bloqueia o check-in e loga tentativa em compliance
    // BYPASS para ambiente de desenvolvimento local para fins de teste
    const bypassGeofence = process.env.NODE_ENV === "development";

    if (distanciaMetros > limiteRaio && !bypassGeofence) {
      console.warn(`[CHECKIN API] Tentativa de check-in fora da cerca: Distância de ${distanciaMetros.toFixed(1)}m. Limite: ${limiteRaio}m.`);
      
      // Gravar na tabela de compliance de tentativas bloqueadas
      await supabase
        .from("cm_promotor_visita_tentativa_bloqueada")
        .insert({
          promotor_id: perfil.employee_id,
          cod_parceiro: visita.cod_parceiro,
          visita_id: visita.id,
          tipo_bloqueio: "GPS_FORA_CERCA",
          latitude_tentada: latitude,
          longitude_tentada: longitude,
          distancia_calculada_metros: Math.round(distanciaMetros)
        });

      return respond({
        success: false,
        code: "GPS_FORA_CERCA",
        error: `Você está fora da cerca virtual permitida da loja. Distância: ${Math.round(distanciaMetros)} metros. Limite: ${limiteRaio} metros.`
      }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Check-in suspeito na borda da geocerca (> 85% do raio)
    if (distanciaMetros > 0.85 * limiteRaio) {
      await registerFraudIncident(perfil.employee_id, "edge_geofence", todayStr);
    }

    // 4. Algoritmo Anti-Teleporte (Cálculo de velocidade implícita entre visitas)
    const { data: ultimaVisita } = await supabase
      .from("cm_promotor_visita")
      .select("checkout_latitude, checkout_longitude, checkout_servidor")
      .eq("agenda_diaria_id", visita.agenda.id)
      .eq("status", "CONCLUIDA")
      .not("checkout_servidor", "is", null)
      .order("checkout_servidor", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaVisita && ultimaVisita.checkout_latitude !== null && ultimaVisita.checkout_longitude !== null) {
      const distUltimaM = calculateDistanceM(
        latitude,
        longitude,
        ultimaVisita.checkout_latitude,
        ultimaVisita.checkout_longitude
      );

      const tempoUltimoMs = new Date().getTime() - new Date(ultimaVisita.checkout_servidor).getTime();
      const tempoUltimoHoras = tempoUltimoMs / 1000 / 3600; // ms to hours

      if (tempoUltimoHoras > 0) {
        const velImplicitaKmh = (distUltimaM / 1000) / tempoUltimoHoras;
        
        if (velImplicitaKmh > 120) {
          console.warn(`[CHECKIN API] Alerta Anti-Teleporte: Velocidade de ${velImplicitaKmh.toFixed(1)} km/h.`);
          
          let incidentType: "speed_suspicious" | "speed_alert" | "speed_severe" = "speed_suspicious";
          let alertDesc = `Velocidade implícita suspeita detectada entre visitas: ${velImplicitaKmh.toFixed(1)} km/h.`;

          if (velImplicitaKmh > 250) {
            incidentType = "speed_severe";
            alertDesc = `Fraude de velocidade severa detectada entre visitas (teletransporte): ${velImplicitaKmh.toFixed(1)} km/h.`;
          } else if (velImplicitaKmh > 160) {
            incidentType = "speed_alert";
            alertDesc = `Alerta de velocidade incompatível entre visitas: ${velImplicitaKmh.toFixed(1)} km/h.`;
          }

          // Registrar alerta de compliance de velocidade impossível
          await supabase
            .from("cm_promotor_visita_tentativa_bloqueada")
            .insert({
              promotor_id: perfil.employee_id,
              cod_parceiro: visita.cod_parceiro,
              visita_id: visita.id,
              tipo_bloqueio: "VELOCIDADE_IMPOSSIVEL",
              latitude_tentada: latitude,
              longitude_tentada: longitude,
              distancia_calculada_metros: Math.round(distUltimaM)
            });

          await registerFraudIncident(perfil.employee_id, incidentType, todayStr);
        }
      }
    }

    // 4.5 Upload da Foto de Fachada para o Storage
    const arrayBuffer = await fotoFachada.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `${Date.now()}-fachada.jpg`;
    const filePath = `${user.id}/visitas/${visitaId}/checkin/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("promotor-ponto")
      .upload(filePath, buffer, {
        contentType: fotoFachada.type,
        upsert: false
      });

    if (uploadError) {
      console.error("[CHECKIN API] Erro ao fazer upload da foto de fachada:", uploadError);
      return respond({ success: false, error: "Erro ao fazer upload da foto de fachada." }, { status: 500 });
    }

    // 5. Atualizar a Visita com status de Check-in Realizado
    const { data: visitaAtualizada, error: updateError } = await supabase
      .from("cm_promotor_visita")
      .update({
        status: "CHECKIN_REALIZADO",
        checkin_servidor: new Date().toISOString(),
        checkin_dispositivo: dispositivoTimestamp,
        checkin_latitude: latitude,
        checkin_longitude: longitude,
        distancia_checkin_metros: Math.round(distanciaMetros),
        checkin_foto_fachada_url: uploadData.path,
        checkin_client_action_id: clientActionId || null
      })
      .eq("id", visita.id)
      .select()
      .single();

    if (updateError) {
      console.error("[CHECKIN API] Erro ao atualizar status da visita:", updateError);
      return respond({ success: false, error: "Erro ao gravar informações de check-in." }, { status: 500 });
    }

    // 6. Atualizar live status do promotor imediatamente no banco
    await supabase
      .from("cm_promotor_live_status")
      .upsert({
        promotor_id: perfil.employee_id,
        status: "EM_LOJA_CHECKIN",
        current_visita_id: visita.id,
        latitude,
        longitude,
        last_heartbeat: new Date().toISOString()
      });

    // 7. Gravar log histórico de trajeto na timeline
    await supabase
      .from("cm_promotor_heartbeat_log")
      .insert({
        promotor_id: perfil.employee_id,
        latitude,
        longitude,
        source_event: "CHECKIN"
      });

    return respond({
      success: true,
      message: "Check-in realizado com sucesso!",
      data: visitaAtualizada
    });

  } catch (error: unknown) {
    console.error("[CHECKIN API] Erro fatal:", error);
    return respond({
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar check-in."
    }, { status: 500 });
  }
}
