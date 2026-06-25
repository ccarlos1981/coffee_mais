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

    // 2. Fetch catalog info
    const { data: productRefs } = await supabaseAdmin
      .from("cm_ai_product_reference")
      .select("sku, product_name, category");

    const productRefMap = new Map<string, { product_name: string; category: string }>();
    productRefs?.forEach(ref => {
      productRefMap.set(ref.sku, {
        product_name: ref.product_name,
        category: ref.category || "Café Moído"
      });
    });

    // 3. Fetch all sell-out analysis records
    const { data: analyses, error: getErr } = await supabaseAdmin
      .from("cm_sellout_analysis")
      .select(`
        pdv_id,
        sku,
        estimated_stock_boxes,
        sellout_velocity,
        days_of_inventory,
        stock_risk,
        slow_mover,
        dead_stock,
        suggested_order_boxes,
        pdv:base_atendimento (
          nome_fantasia,
          rede,
          uf,
          canal
        )
      `);

    if (getErr) throw getErr;

    const items = (analyses || []).filter((a: any) => a.pdv !== null);

    // 4. Aggregate 1: Rupture Forecast Board (stock_risk is CRITICAL or HIGH)
    const ruptureForecast = items
      .filter((a: any) => ["CRITICAL", "HIGH"].includes(a.stock_risk))
      .map((a: any) => {
        const prod = productRefMap.get(a.sku);
        return {
          pdv_id: a.pdv_id,
          nome_fantasia: a.pdv.nome_fantasia,
          sku: a.sku,
          product_name: prod?.product_name || a.sku,
          days_of_inventory: Number(a.days_of_inventory),
          estimated_stock_boxes: Number(a.estimated_stock_boxes),
          sellout_velocity: Number(a.sellout_velocity),
          stock_risk: a.stock_risk
        };
      })
      .sort((a, b) => a.days_of_inventory - b.days_of_inventory)
      .slice(0, 15);

    // 5. Aggregate 2: Slow Movers
    const slowMovers = items
      .filter((a: any) => a.slow_mover === true)
      .map((a: any) => {
        const prod = productRefMap.get(a.sku);
        return {
          pdv_id: a.pdv_id,
          nome_fantasia: a.pdv.nome_fantasia,
          sku: a.sku,
          product_name: prod?.product_name || a.sku,
          sellout_velocity: Number(a.sellout_velocity)
        };
      })
      .sort((a, b) => a.sellout_velocity - b.sellout_velocity)
      .slice(0, 15);

    // 6. Aggregate 3: Dead Stock
    const deadStock = items
      .filter((a: any) => a.dead_stock === true)
      .map((a: any) => {
        const prod = productRefMap.get(a.sku);
        return {
          pdv_id: a.pdv_id,
          nome_fantasia: a.pdv.nome_fantasia,
          sku: a.sku,
          product_name: prod?.product_name || a.sku,
          estimated_stock_boxes: Number(a.estimated_stock_boxes)
        };
      })
      .sort((a, b) => b.estimated_stock_boxes - a.estimated_stock_boxes)
      .slice(0, 15);

    // 7. Aggregate 4: Coverage by Region (avg days_of_inventory grouped by state/UF, excluding 999 fallback)
    const regionGroups: Record<string, { total: number; count: number }> = {};
    items.forEach((a: any) => {
      const uf = a.pdv.uf ? a.pdv.uf.toUpperCase().trim() : "Outros";
      const days = Number(a.days_of_inventory);
      
      if (days < 999.0) {
        if (!regionGroups[uf]) {
          regionGroups[uf] = { total: 0.0, count: 0 };
        }
        regionGroups[uf].total += days;
        regionGroups[uf].count++;
      }
    });

    const coverageByRegion = Object.entries(regionGroups)
      .map(([region, stats]) => ({
        region,
        avg_days_of_inventory: stats.count > 0 ? parseFloat((stats.total / stats.count).toFixed(1)) : 0.0
      }))
      .sort((a, b) => a.avg_days_of_inventory - b.avg_days_of_inventory);

    // 8. Aggregate 5: Suggested Orders Ranking
    const suggestedOrders = items
      .filter((a: any) => Number(a.suggested_order_boxes) > 0)
      .map((a: any) => {
        const prod = productRefMap.get(a.sku);
        return {
          pdv_id: a.pdv_id,
          nome_fantasia: a.pdv.nome_fantasia,
          sku: a.sku,
          product_name: prod?.product_name || a.sku,
          suggested_order_boxes: Number(a.suggested_order_boxes)
        };
      })
      .sort((a, b) => b.suggested_order_boxes - a.suggested_order_boxes)
      .slice(0, 15);

    // 9. Aggregate 6: SKU Turnover Ranking (total sellout velocity by SKU)
    const skuTurnoverMap: Record<string, number> = {};
    items.forEach((a: any) => {
      skuTurnoverMap[a.sku] = (skuTurnoverMap[a.sku] || 0.0) + Number(a.sellout_velocity || 0.0);
    });

    const topTurnoverSkus = Object.entries(skuTurnoverMap)
      .map(([sku, totalVelocity]) => {
        const prod = productRefMap.get(sku);
        return {
          sku,
          product_name: prod?.product_name || sku,
          total_sellout_velocity: parseFloat(totalVelocity.toFixed(2))
        };
      })
      .sort((a, b) => b.total_sellout_velocity - a.total_sellout_velocity);

    return NextResponse.json({
      success: true,
      db_latency_ms: Date.now() - startTime,
      data: {
        top_rupture_risk: ruptureForecast,
        top_slow_movers: slowMovers,
        top_dead_stock: deadStock,
        coverage_by_region: coverageByRegion,
        top_suggested_orders: suggestedOrders,
        top_turnover_skus: topTurnoverSkus
      }
    });

  } catch (error: any) {
    console.error("[SUPERVISOR SELLOUT KPIS API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
