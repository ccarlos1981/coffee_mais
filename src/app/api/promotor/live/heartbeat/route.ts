import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logApiTelemetry } from "@/lib/observability/telemetry";
import { registerFraudIncident } from "@/lib/antifraud/fraud-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const startTime = Date.now();
  let employeeId: string | null = null;

  const respond = async (json: any, init?: ResponseInit) => {
    const status = init?.status || 200;
    const duration = Date.now() - startTime;
    await logApiTelemetry({
      route: "/api/promotor/live/heartbeat",
      method: "POST",
      statusCode: status,
      responseTimeMs: duration,
      promotorId: employeeId,
      errorMessage: status >= 400 ? (json.error || JSON.stringify(json)) : null
    });
    return NextResponse.json(json, init);
  };

  try {
    let supabase;
    let user = null;
    const stressTestId = request.headers.get("x-stress-test-promotor-id");
    
    if (process.env.NODE_ENV === "development" && stressTestId) {
      supabase = createAdminClient();
      user = { id: stressTestId };
    } else {
      supabase = await createClient();
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !supabaseUser) {
        return respond({ success: false, error: "Não autenticado." }, { status: 401 });
      }
      user = supabaseUser;
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

    const body = await request.json();
    const { latitude, longitude, accuracy_m, bateria_percent, bateria_charging, tipo_conexao } = body;

    if (latitude === undefined || longitude === undefined) {
      return respond({ success: false, error: "Coordenadas lat/lng são obrigatórias." }, { status: 400 });
    }

    const dataHoje = new Date().toISOString().split("T")[0];

    // 1. Obter agenda diária do promotor para hoje
    const { data: agenda } = await supabase
      .from("cm_promotor_agenda_diaria")
      .select("id")
      .eq("promotor_id", perfil.employee_id)
      .eq("data_agenda", dataHoje)
      .maybeSingle();

    let statusDeterminado = "DISPONIVEL";
    let currentVisitaId: string | null = null;

    if (agenda) {
      // 2. Buscar visitas de hoje
      const { data: visitas } = await supabase
        .from("cm_promotor_visita")
        .select("id, status")
        .eq("agenda_diaria_id", agenda.id);

      if (visitas && visitas.length > 0) {
        // Procurar visita ativa (Priorizando na ordem: Ocorrência/Impedimento, Execução, Checkin, Rota)
        const visitActive = visitas.find(v => ["EM_ROTA", "CHECKIN_REALIZADO", "EM_EXECUCAO"].includes(v.status));

        if (visitActive) {
          currentVisitaId = visitActive.id;

          // Verificar se essa visita ativa possui ocorrências pendentes
          const { data: ocorrencia } = await supabase
            .from("cm_promotor_visita_ocorrencia")
            .select("id")
            .eq("visita_id", visitActive.id)
            .maybeSingle();

          if (ocorrencia) {
            statusDeterminado = "EM_OCORRENCIA";
          } else if (visitActive.status === "EM_EXECUCAO") {
            statusDeterminado = "EM_EXECUCAO";
          } else if (visitActive.status === "CHECKIN_REALIZADO") {
            statusDeterminado = "EM_LOJA_CHECKIN";
          } else if (visitActive.status === "EM_ROTA") {
            statusDeterminado = "EM_ROTA";
          }
        } else {
          // Se todas as visitas estão concluídas ou canceladas
          const todasConcluidas = visitas.every(v => ["CONCLUIDA", "NAO_REALIZADA", "CANCELADA", "LOJA_FECHADA"].includes(v.status));
          if (todasConcluidas) {
            // Verificar se bateu o ponto de saída
            const { data: jornada } = await supabase
              .from("cm_promotor_jornada")
              .select("checkout_servidor")
              .eq("agenda_diaria_id", agenda.id)
              .maybeSingle();

            if (jornada && jornada.checkout_servidor) {
              statusDeterminado = "JORNADA_ENCERRADA";
            } else {
              statusDeterminado = "DISPONIVEL";
            }
          }
        }
      }
    } else {
      statusDeterminado = "JORNADA_ENCERRADA";
    }

    // 3. Obter status live anterior para verificar mudança de status
    const { data: liveAnterior } = await supabase
      .from("cm_promotor_live_status")
      .select("status")
      .eq("promotor_id", perfil.employee_id)
      .maybeSingle();

    // 4. Salvar ou atualizar no Live Status
    const { error: liveError } = await supabase
      .from("cm_promotor_live_status")
      .upsert({
        promotor_id: perfil.employee_id,
        status: statusDeterminado,
        current_visita_id: currentVisitaId,
        latitude,
        longitude,
        accuracy_m,
        bateria_percent,
        bateria_charging,
        tipo_conexao,
        last_heartbeat: new Date().toISOString()
      });

    if (liveError) {
      console.error("[HEARTBEAT API] Erro ao atualizar live status:", liveError);
      return respond({ success: false, error: "Erro ao atualizar status live." }, { status: 500 });
    }

    // 5. Otimização de gravação de logs históricos de trajeto
    const { data: lastLog } = await supabase
      .from("cm_promotor_heartbeat_log")
      .select("*")
      .eq("promotor_id", perfil.employee_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let deveGravarLog = false;

    if (!lastLog) {
      deveGravarLog = true;
    } else {
      // Condição 1: distância percorrida > 100m
      const dist = calculateDistanceM(latitude, longitude, lastLog.latitude, lastLog.longitude);
      if (dist > 100) deveGravarLog = true;

      // Check speed limit/impossible velocity between consecutive heartbeats
      const tempoDecorridoMs = new Date().getTime() - new Date(lastLog.created_at).getTime();
      if (tempoDecorridoMs > 10000) { // minimum 10 seconds to avoid GPS accuracy noise
        const tempoDecorridoHoras = tempoDecorridoMs / 1000 / 3600;
        const speedKmH = (dist / 1000) / tempoDecorridoHoras;

        if (speedKmH > 120) {
          const todayStr = new Date().toISOString().split("T")[0];
          let incidentType: "speed_suspicious" | "speed_alert" | "speed_severe" = "speed_suspicious";
          let alertDesc = `Velocidade suspeita detectada: ${speedKmH.toFixed(1)} km/h.`;

          if (speedKmH > 250) {
            incidentType = "speed_severe";
            alertDesc = `Fraude de velocidade severa detectada (possível spoofing/teletransporte): ${speedKmH.toFixed(1)} km/h.`;
          } else if (speedKmH > 160) {
            incidentType = "speed_alert";
            alertDesc = `Alerta de velocidade incompatível: ${speedKmH.toFixed(1)} km/h.`;
          }

          const supabaseAdmin = createAdminClient();
          await supabaseAdmin
            .from("cm_promotor_alerta")
            .insert({
              promotor_id: perfil.employee_id,
              tipo_alerta: "VELOCIDADE_IMPOSSIVEL",
              descricao: alertDesc
            });

          await registerFraudIncident(perfil.employee_id, incidentType, todayStr);
        }
      }

      // Condição 2: status mudou
      if (liveAnterior && liveAnterior.status !== statusDeterminado) deveGravarLog = true;

      // Condição 3: passaram 15 minutos desde o último log
      const tempoDecorridoMin = tempoDecorridoMs / 1000 / 60;
      if (tempoDecorridoMin >= 15) deveGravarLog = true;
    }

    if (deveGravarLog) {
      await supabase
        .from("cm_promotor_heartbeat_log")
        .insert({
          promotor_id: perfil.employee_id,
          latitude,
          longitude,
          accuracy_m,
          bateria_percent,
          bateria_charging,
          tipo_conexao,
          source_event: "HEARTBEAT_PERIODICO"
        });
    }

    // 6. Motor de Alerta de Bateria Crítica (Thresholds)
    if (bateria_percent !== null && bateria_percent !== undefined) {
      const supabaseAdmin = createAdminClient();

      if (bateria_percent < 10 && !bateria_charging) {
        // Buscar se já existe alerta ativo
        const { data: alertaExistente } = await supabase
          .from("cm_promotor_alerta")
          .select("id")
          .eq("promotor_id", perfil.employee_id)
          .eq("tipo_alerta", "BATERIA_CRITICA")
          .eq("is_resolvido", false)
          .maybeSingle();

        if (!alertaExistente) {
          await supabaseAdmin
            .from("cm_promotor_alerta")
            .insert({
              promotor_id: perfil.employee_id,
              tipo_alerta: "BATERIA_CRITICA",
              descricao: `Celular com bateria crítica (${bateria_percent}%) e desconectado da tomada.`
            });
        }
      } else if (bateria_percent >= 10 || bateria_charging) {
        // Resolver automaticamente se carregador conectado ou subiu de 10%
        await supabaseAdmin
          .from("cm_promotor_alerta")
          .update({
            is_resolvido: true,
            resolvido_at: new Date().toISOString(),
            descricao: `Resolvido: Bateria subiu para ${bateria_percent}% ou carregador conectado.`
          })
          .eq("promotor_id", perfil.employee_id)
          .eq("tipo_alerta", "BATERIA_CRITICA")
          .eq("is_resolvido", false);
      }
    }

    return respond({ success: true, status: statusDeterminado });

  } catch (error: any) {
    console.error("[HEARTBEAT API] Erro interno:", error);
    return respond({ success: false, error: error.message || "Erro de rede no servidor." }, { status: 500 });
  }
}
