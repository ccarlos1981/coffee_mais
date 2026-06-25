import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TimelineEvent {
  id: string;
  timestamp: string; // ISO String
  latitude: number;
  longitude: number;
  event_type:
    | "PONTO_ENTRADA"
    | "DESLOCAMENTO_INICIADO"
    | "CHECKIN"
    | "FOTO_UPLOAD"
    | "OCORRENCIA"
    | "CHECKOUT"
    | "PONTO_SAIDA"
    | "HEARTBEAT_PERIODICO";
  description: string;
  metadata?: {
    bateria_percent?: number;
    bateria_charging?: boolean;
    tipo_conexao?: string;
    accuracy_m?: number;
    foto_url?: string;
    tipo_ocorrencia?: string;
    nome_fantasia?: string;
    tipo_foto?: string;
    visita_id?: string;
  };
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

    // Define timestamps in BRT (-03:00) for the date boundaries
    const startOfDay = new Date(`${targetDate}T00:00:00-03:00`).toISOString();
    const endOfDay = new Date(`${targetDate}T23:59:59-03:00`).toISOString();

    const timeline: TimelineEvent[] = [];

    // 1. Query Heartbeat Logs
    const { data: logs } = await supabase
      .from("cm_promotor_heartbeat_log")
      .select("*")
      .eq("promotor_id", promotorId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: true });

    logs?.forEach((l: any) => {
      let mappedType: TimelineEvent["event_type"] = "HEARTBEAT_PERIODICO";
      let desc = "Ponto de geolocalização periódico.";

      if (l.source_event === "DESLOCAMENTO_INICIADO") {
        mappedType = "DESLOCAMENTO_INICIADO";
        desc = "Deslocamento até o ponto de venda iniciado.";
      } else if (l.source_event === "CHECKIN") {
        mappedType = "CHECKIN";
        desc = "Check-in realizado no PDV.";
      } else if (l.source_event === "CHECKOUT") {
        mappedType = "CHECKOUT";
        desc = "Check-out concluído no PDV.";
      } else if (l.source_event === "FOTO_UPLOAD") {
        mappedType = "FOTO_UPLOAD";
        desc = "Upload de foto executado.";
      } else if (l.source_event === "OCORRENCIA") {
        mappedType = "OCORRENCIA";
        desc = "Ocorrência / Impedimento registrado no PDV.";
      }

      timeline.push({
        id: l.id,
        timestamp: l.created_at,
        latitude: l.latitude,
        longitude: l.longitude,
        event_type: mappedType,
        description: desc,
        metadata: {
          bateria_percent: l.bateria_percent,
          bateria_charging: l.bateria_charging,
          tipo_conexao: l.tipo_conexao,
          accuracy_m: l.accuracy_m
        }
      });
    });

    // 2. Query Jornada (Clock-ins / Clock-outs)
    const { data: jornadaLogs } = await supabase
      .from("cm_promotor_jornada")
      .select("*")
      .eq("employee_id", promotorId)
      .gte("timestamp_dispositivo", startOfDay)
      .lte("timestamp_dispositivo", endOfDay);

    jornadaLogs?.forEach((j: any) => {
      if (j.tipo_registro === "ENTRADA") {
        timeline.push({
          id: j.id,
          timestamp: j.timestamp_dispositivo,
          latitude: j.latitude,
          longitude: j.longitude,
          event_type: "PONTO_ENTRADA",
          description: "Entrada de ponto da jornada de trabalho registrada.",
          metadata: {
            accuracy_m: j.gps_accuracy,
            foto_url: j.foto_comprovante_url
          }
        });
      } else if (j.tipo_registro === "SAIDA") {
        timeline.push({
          id: j.id,
          timestamp: j.timestamp_dispositivo,
          latitude: j.latitude,
          longitude: j.longitude,
          event_type: "PONTO_SAIDA",
          description: "Saída de ponto da jornada de trabalho registrada.",
          metadata: {
            accuracy_m: j.gps_accuracy,
            foto_url: j.foto_comprovante_url
          }
        });
      }
    });

    // 3. Query Agenda & Visitas to get Store Names, Photos & Occurrences
    const { data: agenda } = await supabase
      .from("cm_promotor_agenda_diaria")
      .select("id")
      .eq("promotor_id", promotorId)
      .eq("data_agenda", targetDate)
      .maybeSingle();

    if (agenda) {
      const { data: visitas } = await supabase
        .from("cm_promotor_visita")
        .select(`
          *,
          pdv:base_atendimento(cod_parceiro, nome_fantasia)
        `)
        .eq("agenda_diaria_id", agenda.id);

      const visitaIds = visitas?.map(v => v.id) || [];

      if (visitaIds.length > 0) {
        // A. Fotos upload
        const { data: fotos } = await supabase
          .from("cm_promotor_visita_foto")
          .select("*")
          .in("visita_id", visitaIds)
          .eq("is_deleted", false);

        fotos?.forEach((f: any) => {
          const visita = visitas?.find(v => v.id === f.visita_id);
          timeline.push({
            id: f.id,
            timestamp: f.created_at,
            latitude: f.latitude || 0,
            longitude: f.longitude || 0,
            event_type: "FOTO_UPLOAD",
            description: `Foto de '${f.tipo_foto}' adicionada no PDV ${visita?.pdv?.nome_fantasia || ""}.`,
            metadata: {
              foto_url: f.foto_url,
              tipo_foto: f.tipo_foto,
              nome_fantasia: visita?.pdv?.nome_fantasia,
              visita_id: f.visita_id
            }
          });
        });

        // B. Ocorrências
        const { data: ocorrencias } = await supabase
          .from("cm_promotor_visita_ocorrencia")
          .select("*")
          .in("visita_id", visitaIds);

        // Fetch geolocations for PDVs to map occurrence coordinate
        const codsParceiro = visitas?.map(v => v.cod_parceiro) || [];
        const { data: pdvLocs } = await supabase
          .from("cm_promotor_pdv_geoloc")
          .select("*")
          .in("cod_parceiro", codsParceiro);

        ocorrencias?.forEach((o: any) => {
          const visita = visitas?.find(v => v.id === o.visita_id);
          const geoloc = pdvLocs?.find(g => g.cod_parceiro === visita?.cod_parceiro);
          
          timeline.push({
            id: o.id,
            timestamp: o.created_at,
            latitude: geoloc?.latitude || 0,
            longitude: geoloc?.longitude || 0,
            event_type: "OCORRENCIA",
            description: `Ocorrência registrada: ${o.tipo_ocorrencia}. Obs: ${o.descricao || ""}`,
            metadata: {
              tipo_ocorrencia: o.tipo_ocorrencia,
              foto_url: o.foto_url,
              nome_fantasia: visita?.pdv?.nome_fantasia,
              visita_id: o.visita_id
            }
          });
        });
      }
    }

    // 4. Sort chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Deduplicate exact heartbeat points if they overlap with checkin/checkout/foto/ocorrencia timestamps
    // to keep the timeline clean and compact.
    const filteredTimeline = timeline.filter((evt, idx) => {
      if (evt.event_type !== "HEARTBEAT_PERIODICO") return true;
      
      // Look for a business event within 15 seconds of this heartbeat log
      const timeMs = new Date(evt.timestamp).getTime();
      const hasCloseBusinessEvent = timeline.some(other => 
        other.event_type !== "HEARTBEAT_PERIODICO" && 
        Math.abs(new Date(other.timestamp).getTime() - timeMs) < 15000
      );
      return !hasCloseBusinessEvent;
    });

    return NextResponse.json({ success: true, date: targetDate, timeline: filteredTimeline });

  } catch (error: any) {
    console.error("[ROUTE REPLAY API] Erro:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro no servidor." }, { status: 500 });
  }
}
