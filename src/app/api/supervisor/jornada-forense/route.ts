import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GroupedPDVBlock {
  block_type: "PDV";
  visita_id: string;
  cod_parceiro: string;
  nome_fantasia: string;
  status: string;
  checkin_time: string | null;
  checkout_time: string | null;
  duracao_real_min: number | null;
  duracao_estimada_min: number;
  score_operacional: number;
  fotos: any[];
  ocorrencia: any | null;
  checklists: any[];
  sla_excedido: boolean;
}

interface GroupedDeslocamentoBlock {
  block_type: "DESLOCAMENTO";
  from_name: string;
  to_name: string;
  partida_time: string | null;
  chegada_time: string | null;
  duracao_min: number | null;
  distancia_km: number;
}

interface GroupedPunchBlock {
  block_type: "PONTO_ENTRADA" | "PONTO_SAIDA";
  timestamp: string;
  latitude: number;
  longitude: number;
  foto_url: string | null;
}

type TimelineBlock = GroupedPDVBlock | GroupedDeslocamentoBlock | GroupedPunchBlock;

// Geodetic distance in meters using Haversine
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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Role check: CEO, Admin, Trade, Supervisor
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAuthorized = ["CEO", "Admin", "Trade", "Supervisor"].includes(profile?.role || "");
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Acesso negado: Perfil não autorizado." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const promotorId = searchParams.get("promotor_id");
    const dataParam = searchParams.get("data"); // format: YYYY-MM-DD

    if (!promotorId) {
      return NextResponse.json({ success: false, error: "Parâmetro promotor_id é obrigatório." }, { status: 400 });
    }

    const targetDate = dataParam || new Date().toISOString().split("T")[0];

    const startOfDay = new Date(`${targetDate}T00:00:00-03:00`).toISOString();
    const endOfDay = new Date(`${targetDate}T23:59:59-03:00`).toISOString();

    // 1. Fetch Agenda
    const { data: agenda } = await supabase
      .from("cm_promotor_agenda_diaria")
      .select("id")
      .eq("promotor_id", promotorId)
      .eq("data_agenda", targetDate)
      .maybeSingle();

    if (!agenda) {
      return NextResponse.json({
        success: true,
        date: targetDate,
        timeline: [],
        metrics: { planned_km: 0, actual_km: 0, deviation_percent: 0 }
      });
    }

    // 2. Fetch Visitas
    const { data: visitas } = await supabase
      .from("cm_promotor_visita")
      .select(`
        *,
        pdv:base_atendimento(cod_parceiro, nome_fantasia)
      `)
      .eq("agenda_diaria_id", agenda.id)
      .order("ordem_rota", { ascending: true })
      .order("created_at", { ascending: true });

    const visitaIds = visitas?.map(v => v.id) || [];
    const codsParceiro = visitas?.map(v => v.cod_parceiro) || [];

    // 3. Fetch related visit details
    const { data: execucoes } = await supabase
      .from("cm_trade_missao_execucao")
      .select("*")
      .in("visita_id", visitaIds);

    const { data: missoesPdv } = await supabase
      .from("cm_trade_missao_pdv")
      .select(`
        missao_id,
        cod_parceiro,
        missao:cm_trade_missao(*)
      `)
      .eq("promotor_id", promotorId)
      .in("cod_parceiro", codsParceiro);

    const { data: fotos } = await supabase
      .from("cm_promotor_visita_foto")
      .select("*")
      .in("visita_id", visitaIds)
      .eq("is_deleted", false);

    const { data: ocorrencias } = await supabase
      .from("cm_promotor_visita_ocorrencia")
      .select("*")
      .in("visita_id", visitaIds);

    const { data: geolocs } = await supabase
      .from("cm_promotor_pdv_geoloc")
      .select("*")
      .in("cod_parceiro", codsParceiro);

    // 4. Fetch Jornada (punch logs)
    const { data: jornadaLogs } = await supabase
      .from("cm_promotor_jornada")
      .select("*")
      .eq("employee_id", promotorId)
      .gte("timestamp_dispositivo", startOfDay)
      .lte("timestamp_dispositivo", endOfDay)
      .order("timestamp_dispositivo", { ascending: true });

    // 5. Fetch Heartbeats & Alerts & Blocked checkins
    const { data: trackingLogs } = await supabase
      .from("cm_promotor_heartbeat_log")
      .select("*")
      .eq("promotor_id", promotorId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: true });

    const { data: alertas } = await supabase
      .from("cm_promotor_alerta")
      .select("*")
      .eq("promotor_id", promotorId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    const { data: blockedAttempts } = await supabase
      .from("cm_promotor_visita_tentativa_bloqueada")
      .select("*")
      .eq("promotor_id", promotorId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    // --- OPERATIONAL SCORE CALCULATION FUNCTION ---
    const getOperationalScore = (visita: any): number => {
      const scoreBase = 70;
      let bonus = 0;
      let penalty = 0;

      // 1. Check-in Valid (check if check-in was geofence blocked)
      const hasBlockedCheckin = blockedAttempts?.some(
        b => b.visita_id === visita.id && b.tipo_bloqueio === "GPS_FORA_CERCA"
      );
      if (hasBlockedCheckin) {
        penalty += 30;
      }

      // 2. Mandatory photos based on visit motive
      const motive = visita.motivo_visita || "";
      const visitPhotos = fotos?.filter(f => f.visita_id === visita.id) || [];
      let photoReqMet = true;

      if (motive === "rotina" || motive === "abastecimento") {
        photoReqMet = visitPhotos.some(f => f.tipo_foto === "GONDOLA");
      } else if (motive === "ruptura") {
        photoReqMet = visitPhotos.some(f => f.tipo_foto === "RUPTURA");
      } else if (motive === "auditoria_trade" || motive === "campanha") {
        photoReqMet = visitPhotos.some(f => ["EXTRA", "PONTA_GONDOLA", "ILHA"].includes(f.tipo_foto));
      } else {
        photoReqMet = visitPhotos.length > 0;
      }

      if (photoReqMet) {
        bonus += 15;
      } else {
        penalty += 30;
      }

      // 3. Checklist complete (active trade missions checked off)
      const pdvMissions = missoesPdv?.filter(m => m.cod_parceiro === visita.cod_parceiro) || [];
      const pdvExecs = execucoes?.filter(e => e.visita_id === visita.id) || [];
      const allDone = pdvMissions.every(m => pdvExecs.some(e => e.missao_id === m.missao_id));

      if (pdvMissions.length > 0) {
        if (allDone) {
          bonus += 15;
        } else {
          penalty += 20;
        }
      } else {
        bonus += 15; // default bonus if no missions registered
      }

      // 4. SLA Duration exceeded
      if (visita.checkout_servidor && visita.checkin_servidor) {
        const real = (new Date(visita.checkout_servidor).getTime() - new Date(visita.checkin_servidor).getTime()) / 1000 / 60;
        const est = visita.duracao_estimada_min || 60;
        if (real > 2 * est) {
          penalty += 15;
        }
      }

      // 5. Alerts generated
      const visitAlerts = alertas?.filter(a => a.visita_id === visita.id) || [];
      penalty += visitAlerts.length * 10;

      return Math.max(0, Math.min(100, scoreBase + bonus - penalty));
    };

    // --- CONSOLIDATING BLOCKS ---
    const timeline: TimelineBlock[] = [];

    // PONTO ENTRADA (First log)
    const entrada = jornadaLogs?.find(j => j.tipo_registro === "ENTRADA");
    if (entrada) {
      timeline.push({
        block_type: "PONTO_ENTRADA",
        timestamp: entrada.timestamp_dispositivo,
        latitude: entrada.latitude,
        longitude: entrada.longitude,
        foto_url: entrada.foto_comprovante_url
      });
    }

    let lastMarkerTime: string | null = entrada ? entrada.timestamp_dispositivo : null;
    let lastCoords: L.LatLngTuple | null = entrada ? [entrada.latitude, entrada.longitude] : null;
    let lastStoreName = entrada ? "Ponto de Partida (Check-in do Ponto)" : "";

    visitas?.forEach((v) => {
      const geo = geolocs?.find(g => g.cod_parceiro === v.cod_parceiro);
      const pdvCoords: L.LatLngTuple | null = geo ? [geo.latitude, geo.longitude] : null;

      // 1. Add Deslocamento Block if we have path details
      if (v.em_rota_at && lastMarkerTime) {
        const trLogs = trackingLogs?.filter(
          l => new Date(l.created_at) >= new Date(lastMarkerTime!) && new Date(l.created_at) <= new Date(v.em_rota_at!)
        ) || [];

        let displacementDist = 0;
        let pCoords = lastCoords;
        trLogs.forEach((pt) => {
          if (pCoords && pt.latitude && pt.longitude) {
            displacementDist += calculateDistanceM(pCoords[0], pCoords[1], pt.latitude, pt.longitude);
          }
          pCoords = [pt.latitude, pt.longitude];
        });

        const rotaDur = v.em_rota_at && lastMarkerTime
          ? Math.round((new Date(v.em_rota_at).getTime() - new Date(lastMarkerTime).getTime()) / 1000 / 60)
          : null;

        timeline.push({
          block_type: "DESLOCAMENTO",
          from_name: lastStoreName,
          to_name: v.pdv?.nome_fantasia || "PDV",
          partida_time: lastMarkerTime,
          chegada_time: v.em_rota_at,
          duracao_min: rotaDur,
          distancia_km: displacementDist / 1000
        });
      }

      // 2. Add PDV Block
      const visitPhotos = fotos?.filter(f => f.visita_id === v.id) || [];
      const occurrence = ocorrencias?.find(o => o.visita_id === v.id) || null;
      
      // Match checklist schema fields with responses
      const visitExecs = execucoes?.filter(e => e.visita_id === v.id) || [];
      const checklists = visitExecs.map(e => {
        const missionMapping = missoesPdv?.find(m => m.missao_id === e.missao_id);
        const missaoData = missionMapping?.missao;
        const titulo = (Array.isArray(missaoData) ? (missaoData[0] as any)?.titulo : (missaoData as any)?.titulo) || "Questões de Campo";
        return {
          missao_id: e.missao_id,
          titulo,
          respostas: e.respostas_checklist
        };
      });

      const durReal = v.checkout_servidor && v.checkin_servidor
        ? Math.round((new Date(v.checkout_servidor).getTime() - new Date(v.checkin_servidor).getTime()) / 1000 / 60)
        : null;

      const expected = v.duracao_estimada_min || 60;
      const slaExcedido = durReal !== null && durReal > 2 * expected;

      timeline.push({
        block_type: "PDV",
        visita_id: v.id,
        cod_parceiro: v.cod_parceiro,
        nome_fantasia: v.pdv?.nome_fantasia || "Estabelecimento",
        status: v.status,
        checkin_time: v.checkin_servidor,
        checkout_time: v.checkout_servidor,
        duracao_real_min: durReal,
        duracao_estimada_min: expected,
        score_operacional: getOperationalScore(v),
        fotos: visitPhotos,
        ocorrencia: occurrence,
        checklists,
        sla_excedido: slaExcedido
      });

      // Update trackers for next displacement block
      lastMarkerTime = v.checkout_servidor || v.checkin_servidor || lastMarkerTime;
      lastCoords = pdvCoords || lastCoords;
      lastStoreName = v.pdv?.nome_fantasia || "PDV";
    });

    // PONTO SAIDA (Final log)
    const saida = jornadaLogs?.find(j => j.tipo_registro === "SAIDA");
    if (saida) {
      timeline.push({
        block_type: "PONTO_SAIDA",
        timestamp: saida.timestamp_dispositivo,
        latitude: saida.latitude,
        longitude: saida.longitude,
        foto_url: saida.foto_comprovante_url
      });
    }

    // --- MILEAGE & ROUTE DEVIATION ---
    // 1. Planned KM
    let plannedKm = 0;
    const sortedVisits = [...(visitas || [])].sort((a, b) => (a.ordem_rota || 1) - (b.ordem_rota || 1));
    let lastPdvCoords: L.LatLngTuple | null = null;

    sortedVisits.forEach((v) => {
      const geo = geolocs?.find(g => g.cod_parceiro === v.cod_parceiro);
      if (geo?.latitude && geo?.longitude) {
        if (lastPdvCoords) {
          plannedKm += calculateDistanceM(lastPdvCoords[0], lastPdvCoords[1], geo.latitude, geo.longitude) / 1000;
        }
        lastPdvCoords = [geo.latitude, geo.longitude];
      }
    });

    // Apply logistic correction factor (1.35x Haversine) to approximate real street routing
    plannedKm = plannedKm * 1.35;

    // 2. Actual KM
    let actualKm = 0;
    let pCoords: L.LatLngTuple | null = null;
    trackingLogs?.forEach((pt) => {
      if (pt.latitude && pt.longitude) {
        if (pCoords) {
          actualKm += calculateDistanceM(pCoords[0], pCoords[1], pt.latitude, pt.longitude) / 1000;
        }
        pCoords = [pt.latitude, pt.longitude];
      }
    });

    const diff = actualKm - plannedKm;
    const deviationPercent = plannedKm > 0 ? Math.max(0, Math.round((diff / plannedKm) * 100)) : 0;

    // 3. Daily score KPI (weighted average of visit operational scores by estimated duration)
    let totalScoreWeight = 0;
    let weightedScoreSum = 0;
    visitas?.forEach((v) => {
      const score = getOperationalScore(v);
      const weight = v.duracao_estimada_min || 60;
      weightedScoreSum += score * weight;
      totalScoreWeight += weight;
    });
    const dailyScore = totalScoreWeight > 0 ? Math.round(weightedScoreSum / totalScoreWeight) : 0;

    // 4. Fetch daily fraud metrics from public.cm_promotor_fraud_metrics
    const { data: fraudMetrics } = await supabase
      .from("cm_promotor_fraud_metrics")
      .select("*")
      .eq("promotor_id", promotorId)
      .eq("metric_date", targetDate)
      .maybeSingle();

    const fraudScore = fraudMetrics ? fraudMetrics.fraud_score : 100;
    const fraudDetails = fraudMetrics || {
      gps_mock_count: 0,
      speed_violation_count: 0,
      duplicate_photo_count: 0,
      device_change_count: 0,
      edge_geofence_count: 0
    };

    return NextResponse.json({
      success: true,
      date: targetDate,
      timeline,
      metrics: {
        planned_km: parseFloat(plannedKm.toFixed(2)),
        actual_km: parseFloat(actualKm.toFixed(2)),
        deviation_percent: deviationPercent,
        daily_score: dailyScore,
        fraud_score: fraudScore,
        fraud_details: fraudDetails
      }
    });

  } catch (error: any) {
    console.error("[ROUTE FORENSIC API] Erro:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro no servidor." }, { status: 500 });
  }
}
