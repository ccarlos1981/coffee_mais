import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePromoterCapacity } from "@/lib/ai/route-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startTime = Date.now();
  const supabaseAdmin = createAdminClient();
  let user = null;

  try {
    // 1. Authenticate user via normal client
    const supabaseNormal = await createClient();
    const { data: { user: supabaseUser }, error: authError } = await supabaseNormal.auth.getUser();
    if (authError || !supabaseUser) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }
    user = supabaseUser;

    // Check user role
    const { data: profile } = await supabaseNormal
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    const isAuthorized = ["CEO", "Admin", "Trade", "Supervisor"].includes(role);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Acesso negado: Perfil não autorizado." }, { status: 403 });
    }

    // 2. KPI 1: Promoters Capacity
    const { data: promotores } = await supabaseAdmin
      .from("cm_employees")
      .select("id, nome_completo")
      .eq("funcao", "Promotor")
      .eq("ativo", true);

    const promoterCapacities = [];
    if (promotores) {
      for (const p of promotores) {
        const capInfo = await calculatePromoterCapacity(p.id);
        promoterCapacities.push({
          promotor_id: p.id,
          name: p.nome_completo,
          capacity: capInfo.capacity,
          total_useful_minutes: capInfo.total_useful_minutes,
          avg_visit_minutes: capInfo.avg_visit_minutes
        });
      }
    }

    // 3. KPI 2: Coverage Gaps by Region
    const { data: allPdvs } = await supabaseAdmin
      .from("base_atendimento")
      .select("cod_parceiro, uf");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentVisits } = await supabaseAdmin
      .from("cm_promotor_visita")
      .select("cod_parceiro")
      .gte("checkin_servidor", thirtyDaysAgo)
      .eq("status", "CONCLUIDA");

    const visitedPdvIds = new Set(recentVisits?.map(v => v.cod_parceiro) || []);

    const regionPdvMap: Record<string, { total: number; visited: number }> = {};
    allPdvs?.forEach(p => {
      const uf = p.uf ? p.uf.toUpperCase().trim() : "Outros";
      if (!regionPdvMap[uf]) {
        regionPdvMap[uf] = { total: 0, visited: 0 };
      }
      regionPdvMap[uf].total++;
      if (visitedPdvIds.has(p.cod_parceiro)) {
        regionPdvMap[uf].visited++;
      }
    });

    const coverageGaps = Object.entries(regionPdvMap).map(([region, stats]) => ({
      region,
      total_pdvs: stats.total,
      visited_pdvs: stats.visited,
      coverage_ratio: stats.total > 0 ? Math.round((stats.visited / stats.total) * 100) : 100,
    })).sort((a, b) => a.coverage_ratio - b.coverage_ratio);

    // 4. KPI 3: Route Efficiency (estimated travel vs execution for today's visits)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todayVisits } = await supabaseAdmin
      .from("cm_promotor_visita")
      .select("duracao_real_min, duracao_estimada_min, checkin_servidor")
      .gte("created_at", todayStart.toISOString());

    let totalExecutionMin = 0;
    const activePromotersToday = new Set<string>();

    todayVisits?.forEach(v => {
      totalExecutionMin += v.duracao_real_min || v.duracao_estimada_min || 60;
    });

    // Fetch active promoters today
    const { data: activeJornadas } = await supabaseAdmin
      .from("cm_promotor_jornada")
      .select("employee_id")
      .gte("created_at", todayStart.toISOString());

    activeJornadas?.forEach(j => activePromotersToday.add(j.employee_id));

    // Travel time estimate: 90 mins per active promoter today
    const totalTravelMin = activePromotersToday.size * 90;
    const routeEfficiency = (totalExecutionMin + totalTravelMin) > 0
      ? Math.round((totalExecutionMin / (totalExecutionMin + totalTravelMin)) * 100)
      : 80; // default benchmark

    // 5. KPI 4: Commercial Opportunity Route Ranking
    const { data: rankingData } = await supabaseAdmin
      .from("cm_pdv_route_profile")
      .select(`
        commercial_visit_priority_score,
        commercial_visit_priority_class,
        pdv:base_atendimento (
          cod_parceiro,
          nome_fantasia,
          faturamento_mensal,
          rede,
          canal,
          endereco
        )
      `)
      .order("commercial_visit_priority_score", { ascending: false })
      .limit(25);

    const ranking = (rankingData || [])
      .filter((r: any) => r.pdv !== null)
      .map((r: any) => ({
        cod_parceiro: r.pdv.cod_parceiro,
        nome_fantasia: r.pdv.nome_fantasia,
        faturamento: r.pdv.faturamento_mensal,
        rede: r.pdv.rede,
        canal: r.pdv.canal,
        endereco: r.pdv.endereco,
        priority_score: r.commercial_visit_priority_score,
        priority_class: r.commercial_visit_priority_class
      }));

    return NextResponse.json({
      success: true,
      db_latency_ms: Date.now() - startTime,
      promoter_capacities: promoterCapacities,
      coverage_gaps: coverageGaps,
      route_efficiency: {
        efficiency_ratio: routeEfficiency,
        productive_minutes: totalExecutionMin,
        transit_minutes: totalTravelMin
      },
      priority_ranking: ranking
    });

  } catch (error: any) {
    console.error("[ROUTE KPIS API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
