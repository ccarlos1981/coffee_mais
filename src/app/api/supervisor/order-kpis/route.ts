import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startTime = Date.now();
  const supabaseAdmin = createAdminClient();
  let user = null;

  try {
    // 1. Authenticate user
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

    // 2. Fetch catalog details
    const { data: productRefs } = await supabaseAdmin
      .from("cm_ai_product_reference")
      .select("sku, product_name");
    
    const productRefMap = new Map<string, string>();
    productRefs?.forEach(ref => {
      productRefMap.set(ref.sku, ref.product_name);
    });

    // 3. Fetch all active order recommendations with PDV details
    const { data: recommendations, error: recError } = await supabaseAdmin
      .from("cm_order_recommendation")
      .select(`
        id,
        visita_id,
        pdv_id,
        total_recommended_value,
        total_recommended_boxes,
        urgency_level,
        conversion_probability,
        pdv:base_atendimento (
          nome_fantasia,
          rede,
          uf,
          canal,
          faturamento_mensal
        ),
        visita:cm_promotor_visita (
          agenda_diaria_id
        )
      `);

    if (recError) throw recError;

    const activeRecs = (recommendations || []).filter((r: any) => r.pdv !== null);

    // 4. Aggregate 1: Suggested orders by region/UF
    const regionMap: Record<string, { value: number; boxes: number }> = {};
    activeRecs.forEach((r: any) => {
      const uf = r.pdv.uf ? r.pdv.uf.toUpperCase().trim() : "Outros";
      if (!regionMap[uf]) {
        regionMap[uf] = { value: 0, boxes: 0 };
      }
      regionMap[uf].value += Number(r.total_recommended_value);
      regionMap[uf].boxes += Number(r.total_recommended_boxes);
    });

    const regionKpis = Object.entries(regionMap).map(([region, stats]) => ({
      region,
      total_value: stats.value,
      total_boxes: stats.boxes
    })).sort((a, b) => b.total_value - a.total_value);

    // 5. Aggregate 2: Value by Promotor
    // Load daily agendas and employee profiles to map promotor_id -> name
    const { data: agendas } = await supabaseAdmin
      .from("cm_promotor_agenda_diaria")
      .select("id, promotor_id");
    
    const { data: employees } = await supabaseAdmin
      .from("cm_employees")
      .select("id, name");

    const agendaPromotorMap = new Map<string, string>();
    const promotorNameMap = new Map<string, string>();

    employees?.forEach(e => {
      promotorNameMap.set(e.id, e.name);
    });
    agendas?.forEach(a => {
      const name = promotorNameMap.get(a.promotor_id) || "Promotor";
      agendaPromotorMap.set(a.id, name);
    });

    const promotorMap: Record<string, { value: number; boxes: number }> = {};
    activeRecs.forEach((r: any) => {
      const agendaId = r.visita?.agenda_diaria_id;
      const promotorName = agendaPromotorMap.get(agendaId) || "Outros / Sem Identificação";
      
      if (!promotorMap[promotorName]) {
        promotorMap[promotorName] = { value: 0, boxes: 0 };
      }
      promotorMap[promotorName].value += Number(r.total_recommended_value);
      promotorMap[promotorName].boxes += Number(r.total_recommended_boxes);
    });

    const promotorKpis = Object.entries(promotorMap).map(([name, stats]) => ({
      promotor_name: name,
      total_value: stats.value,
      total_boxes: stats.boxes
    })).sort((a, b) => b.total_value - a.total_value);

    // 6. Aggregate 3: Conversion Probability Distribution
    let highProbCount = 0; // > 75%
    let mediumProbCount = 0; // 50-75%
    let lowProbCount = 0; // < 50%

    activeRecs.forEach((r: any) => {
      const prob = Number(r.conversion_probability);
      if (prob > 75) highProbCount++;
      else if (prob >= 50) mediumProbCount++;
      else lowProbCount++;
    });

    const probabilityDistribution = {
      high: highProbCount,
      medium: mediumProbCount,
      low: lowProbCount,
      total: activeRecs.length
    };

    // 7. Aggregate 4: Top Opportunity PDVs
    const topOpportunityPdvs = activeRecs
      .map((r: any) => ({
        pdv_id: r.pdv_id,
        nome_fantasia: r.pdv.nome_fantasia,
        rede: r.pdv.rede || "Independente",
        total_value: Number(r.total_recommended_value),
        total_boxes: Number(r.total_recommended_boxes),
        urgency_level: r.urgency_level,
        conversion_probability: Number(r.conversion_probability)
      }))
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, 10);

    // 8. Aggregate 5: Recommended SKU Ranking (sum suggested boxes)
    // Fetch all recommendation items
    const { data: recItems } = await supabaseAdmin
      .from("cm_order_recommendation_item")
      .select("sku, suggested_boxes, subtotal");

    const skuMap: Record<string, { boxes: number; value: number }> = {};
    recItems?.forEach((item: any) => {
      if (!skuMap[item.sku]) {
        skuMap[item.sku] = { boxes: 0, value: 0 };
      }
      skuMap[item.sku].boxes += Number(item.suggested_boxes);
      skuMap[item.sku].value += Number(item.subtotal);
    });

    const recommendedSkus = Object.entries(skuMap).map(([sku, stats]) => ({
      sku,
      product_name: productRefMap.get(sku) || sku,
      total_boxes: stats.boxes,
      total_value: stats.value
    })).sort((a, b) => b.total_boxes - a.total_boxes);

    // 9. Aggregate 6: Lost Opportunity Board
    // PDVs that have critical/high stock risks but no completed visits in the last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch PDVs visited in the last 14 days
    const { data: recentVisits } = await supabaseAdmin
      .from("cm_promotor_visita")
      .select("cod_parceiro")
      .eq("status", "CONCLUIDA")
      .gt("checkout_servidor", fourteenDaysAgo);

    const visitedPdvIds = new Set(recentVisits?.map(v => v.cod_parceiro) || []);

    // Get sellout analysis for unvisited PDVs that have critical/high stock risk
    const { data: riskyPdvs } = await supabaseAdmin
      .from("cm_sellout_analysis")
      .select(`
        pdv_id,
        stock_risk,
        pdv:base_atendimento (
          nome_fantasia,
          rede,
          uf,
          canal,
          faturamento_mensal
        )
      `)
      .in("stock_risk", ["CRITICAL", "HIGH"]);

    const lostOpportunityMap = new Map<string, any>();
    riskyPdvs?.forEach((item: any) => {
      if (item.pdv && !visitedPdvIds.has(item.pdv_id)) {
        if (!lostOpportunityMap.has(item.pdv_id)) {
          lostOpportunityMap.set(item.pdv_id, {
            pdv_id: item.pdv_id,
            nome_fantasia: item.pdv.nome_fantasia,
            rede: item.pdv.rede || "Independente",
            uf: item.pdv.uf,
            canal: item.pdv.canal,
            faturamento_mensal: Number(item.pdv.faturamento_mensal || 0),
            highest_risk: item.stock_risk
          });
        } else {
          // If already exists, keep CRITICAL over HIGH
          const existing = lostOpportunityMap.get(item.pdv_id);
          if (item.stock_risk === "CRITICAL") {
            existing.highest_risk = "CRITICAL";
          }
        }
      }
    });

    const lostOpportunities = Array.from(lostOpportunityMap.values())
      .sort((a, b) => b.faturamento_mensal - a.faturamento_mensal)
      .slice(0, 15);

    return NextResponse.json({
      success: true,
      db_latency_ms: Date.now() - startTime,
      data: {
        potential_revenue_by_region: regionKpis,
        potential_value_by_promotor: promotorKpis,
        conversion_probability_distribution: probabilityDistribution,
        top_opportunity_pdvs: topOpportunityPdvs,
        recommended_skus: recommendedSkus,
        lost_opportunities: lostOpportunities
      }
    });

  } catch (error: any) {
    console.error("[SUPERVISOR ORDER KPIS API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
