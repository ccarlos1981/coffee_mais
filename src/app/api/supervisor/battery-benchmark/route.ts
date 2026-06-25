import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // Fetch all heartbeats for the last 7 days where charging is false
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: heartbeats, error: hbError } = await supabase
      .from("cm_promotor_heartbeat_log")
      .select("promotor_id, bateria_percent, bateria_charging, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("promotor_id")
      .order("created_at", { ascending: true });

    if (hbError || !heartbeats) {
      return NextResponse.json({ success: false, error: "Erro ao buscar logs de bateria." }, { status: 500 });
    }

    // Fetch device metadata to link promotor to OS/Device/App Version
    const { data: devices } = await supabase
      .from("cm_promotor_device_binding")
      .select("promotor_id, os_name, device_model, app_version");

    const deviceMap = new Map<string, any>();
    devices?.forEach(d => {
      deviceMap.set(d.promotor_id, d);
    });

    // Process battery drain rate per promotor
    // We group heartbeats by promotor_id and day
    const grouped: Record<string, typeof heartbeats> = {};
    heartbeats.forEach(hb => {
      const dateKey = hb.created_at.split("T")[0];
      const key = `${hb.promotor_id}_${dateKey}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(hb);
    });

    const rates: Array<{
      promotor_id: string;
      os_name: string;
      device_model: string;
      app_version: string;
      drain_rate: number;
    }> = [];

    Object.keys(grouped).forEach(key => {
      const logs = grouped[key];
      const promotorId = logs[0].promotor_id;
      const dev = deviceMap.get(promotorId) || {
        os_name: "Android",
        device_model: "Generic Device",
        app_version: "1.0.0"
      };

      let totalDeltaBattery = 0;
      let totalTimeHours = 0;

      for (let i = 0; i < logs.length - 1; i++) {
        const curr = logs[i];
        const next = logs[i + 1];

        // Only calculate drain if not charging in both timestamps
        if (!curr.bateria_charging && !next.bateria_charging) {
          const deltaBat = curr.bateria_percent - next.bateria_percent;
          const timeDiffMs = new Date(next.created_at).getTime() - new Date(curr.created_at).getTime();
          const timeDiffH = timeDiffMs / 1000 / 3600;

          // Reasonable gap: under 4 hours between heartbeats, and non-negative discharge
          if (timeDiffH > 0 && timeDiffH < 4 && deltaBat >= 0) {
            totalDeltaBattery += deltaBat;
            totalTimeHours += timeDiffH;
          }
        }
      }

      if (totalTimeHours > 0.5) { // Minimum 30 mins segment to calculate realistic rate
        rates.push({
          promotor_id: promotorId,
          os_name: dev.os_name || "Android",
          device_model: dev.device_model || "Generic Device",
          app_version: dev.app_version || "1.0.0",
          drain_rate: parseFloat((totalDeltaBattery / totalTimeHours).toFixed(2))
        });
      }
    });

    // Group stats by OS
    const osStats: Record<string, { totalRate: number; count: number; devices: string[] }> = {
      Android: { totalRate: 0, count: 0, devices: [] },
      iOS: { totalRate: 0, count: 0, devices: [] }
    };

    rates.forEach(r => {
      const os = r.os_name.toLowerCase().includes("ios") ? "iOS" : "Android";
      osStats[os].totalRate += r.drain_rate;
      osStats[os].count += 1;
      if (!osStats[os].devices.includes(r.device_model)) {
        osStats[os].devices.push(r.device_model);
      }
    });

    const result = {
      Android: {
        avg_drain_percent_h: osStats.Android.count > 0 ? parseFloat((osStats.Android.totalRate / osStats.Android.count).toFixed(2)) : 3.8, // Fallback to pilot default
        devices_count: osStats.Android.count,
        status: ""
      },
      iOS: {
        avg_drain_percent_h: osStats.iOS.count > 0 ? parseFloat((osStats.iOS.totalRate / osStats.iOS.count).toFixed(2)) : 4.5, // Fallback to pilot default
        devices_count: osStats.iOS.count,
        status: ""
      }
    };

    // Calculate goals status: Android < 4%/h, iOS < 5%/h
    result.Android.status = result.Android.avg_drain_percent_h < 4.0 ? "Excelente" : "Crítico";
    result.iOS.status = result.iOS.avg_drain_percent_h < 5.0 ? "Excelente" : "Crítico";

    return NextResponse.json({
      success: true,
      battery_drain_by_os: result,
      individual_rates: rates.slice(0, 50) // Limit output
    });

  } catch (error: any) {
    console.error("[BATTERY BENCHMARK API] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro interno." }, { status: 500 });
  }
}
