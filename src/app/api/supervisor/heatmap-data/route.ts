import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number; // Duration in minutes or relative density factor
  label?: string;
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
    const dataParam = searchParams.get("data"); // format: YYYY-MM-DD
    const targetDate = dataParam || new Date().toISOString().split("T")[0];

    const startOfDay = new Date(`${targetDate}T00:00:00-03:00`).toISOString();
    const endOfDay = new Date(`${targetDate}T23:59:59-03:00`).toISOString();

    const points: HeatmapPoint[] = [];

    // 1. Fetch completed visits with check-in and check-out to calculate duration in store
    const { data: agendas } = await supabase
      .from("cm_promotor_agenda_diaria")
      .select("id")
      .eq("data_agenda", targetDate);

    const agendaIds = agendas?.map(a => a.id) || [];

    if (agendaIds.length > 0) {
      const { data: visits } = await supabase
        .from("cm_promotor_visita")
        .select(`
          *,
          pdv:base_atendimento(cod_parceiro, nome_fantasia)
        `)
        .in("agenda_diaria_id", agendaIds)
        .not("checkin_servidor", "is", null);

      const codsParceiro = visits?.map(v => v.cod_parceiro) || [];
      const visitIds = visits?.map(v => v.id) || [];
      const { data: pdvLocs } = await supabase
        .from("cm_promotor_pdv_geoloc")
        .select("*")
        .in("cod_parceiro", codsParceiro);

      let fotos: any[] = [];
      let ocorrencias: any[] = [];
      let alertas: any[] = [];

      if (visitIds.length > 0) {
        const { data: fData } = await supabase
          .from("cm_promotor_visita_foto")
          .select("visita_id, tipo_foto")
          .in("visita_id", visitIds)
          .eq("is_deleted", false);
        fotos = fData || [];

        const { data: oData } = await supabase
          .from("cm_promotor_visita_ocorrencia")
          .select("visita_id")
          .in("visita_id", visitIds);
        ocorrencias = oData || [];

        const { data: aData } = await supabase
          .from("cm_promotor_alerta")
          .select("visita_id")
          .in("visita_id", visitIds);
        alertas = aData || [];
      }

      visits?.forEach((v: any) => {
        const loc = pdvLocs?.find(g => g.cod_parceiro === v.cod_parceiro);
        if (loc?.latitude && loc?.longitude) {
          // Duration in minutes, default to 30 mins if check-out hasn't been done yet
          let durationMin = 30;
          if (v.checkin_servidor && v.checkout_servidor) {
            const timeDiff = new Date(v.checkout_servidor).getTime() - new Date(v.checkin_servidor).getTime();
            durationMin = Math.max(10, Math.round(timeDiff / 1000 / 60));
          }

          const hasOcorrencia = ocorrencias.some(o => o.visita_id === v.id);
          const hasRuptura = fotos.some(f => f.visita_id === v.id && f.tipo_foto === "RUPTURA");
          const visitAlertsCount = alertas.filter(a => a.visita_id === v.id).length;

          // Compound weight factoring criticity: duration + impedance + rupture + alerts
          const criticityWeight = durationMin + (hasOcorrencia ? 50 : 0) + (hasRuptura ? 40 : 0) + (visitAlertsCount * 20);
          const cappedWeight = Math.min(150, criticityWeight);
          
          points.push({
            lat: loc.latitude,
            lng: loc.longitude,
            weight: cappedWeight,
            label: `${v.pdv?.nome_fantasia || "PDV"} (Criticidade: ${cappedWeight} | Tempo: ${durationMin}m | Ocorrências: ${hasOcorrencia ? 1 : 0} | Rupturas: ${hasRuptura ? 1 : 0} | Alertas: ${visitAlertsCount})`
          });
        }
      });
    }

    // 2. Fetch heartbeat tracking points for route transit densities
    const { data: trackingLogs } = await supabase
      .from("cm_promotor_heartbeat_log")
      .select("latitude, longitude")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    trackingLogs?.forEach((log: any) => {
      if (log.latitude && log.longitude) {
        // Transit points have a low base weight of 1
        points.push({
          lat: log.latitude,
          lng: log.longitude,
          weight: 1,
          label: "Ponto em Trânsito"
        });
      }
    });

    return NextResponse.json({
      success: true,
      date: targetDate,
      points
    });

  } catch (error: any) {
    console.error("[HEATMAP DATA API] Erro:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro no servidor." }, { status: 500 });
  }
}
