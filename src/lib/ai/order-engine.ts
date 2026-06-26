import { createAdminClient } from "@/lib/supabase/admin";

export interface SKUOrderRecommendation {
  sku: string;
  suggested_boxes: number;
  unit_price: number;
  subtotal: number;
  priority_score: number;
  reason: string[];
}

export interface OrderRecommendationResult {
  id: string;
  visita_id: string;
  pdv_id: string;
  total_recommended_value: number;
  total_recommended_boxes: number;
  urgency_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  conversion_probability: number;
  items: SKUOrderRecommendation[];
}

/**
 * Generates the automatic suggested order for a PDV during a specific visit,
 * calculates priority scores, rounds to case packs, determines urgency,
 * computes conversion probability, and persists the result.
 */
export async function generateOrderRecommendation(
  pdvId: string,
  visitaId: string
): Promise<OrderRecommendationResult> {
  const supabase = createAdminClient();

  // 1. Fetch PDV Monthly Revenue
  const { data: pdvData } = await supabase
    .from("base_atendimento")
    .select("faturamento_mensal")
    .eq("cod_parceiro", pdvId)
    .maybeSingle();

  const monthlyRevenue = Number(pdvData?.faturamento_mensal || 0.00);

  // 2. Fetch expected SKUs from planogram
  const { data: planogramItems } = await supabase
    .from("cm_pdv_planograma")
    .select("sku")
    .eq("pdv_id", pdvId)
    .eq("is_active", true);

  let skus = planogramItems?.map(item => item.sku) || [];

  // Fallback to all Coffee Mais SKUs if planogram has none
  if (skus.length === 0) {
    const { data: refs } = await supabase
      .from("cm_ai_product_reference")
      .select("sku")
      .eq("brand", "Coffee Mais");
    skus = refs?.map(r => r.sku) || [];
  }

  // 3. Fetch latest Shelf Analysis for this visit or PDV
  const { data: shelfAnalysis } = await supabase
    .from("cm_ai_shelf_analysis")
    .select("id, shelf_share_percent, analysis_status")
    .eq("visita_id", visitaId)
    .eq("analysis_status", "DONE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fallback to latest shelf analysis of this PDV
  let activeShelfShare = 30.00; // default fallback
  let shelfAnalysisId = shelfAnalysis?.id || null;
  if (shelfAnalysis) {
    activeShelfShare = Number(shelfAnalysis.shelf_share_percent || 30.00);
  } else {
    const { data: latestPdvShelf } = await supabase
      .from("cm_ai_shelf_analysis")
      .select("id, shelf_share_percent")
      .eq("analysis_status", "DONE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestPdvShelf) {
      activeShelfShare = Number(latestPdvShelf.shelf_share_percent || 30.00);
      shelfAnalysisId = latestPdvShelf.id;
    }
  }

  // 4. Fetch latest Price Analysis and active pricing alerts
  const { data: priceAnalysis } = await supabase
    .from("cm_ai_price_analysis")
    .select("id, pricing_risk, commercial_opportunity")
    .eq("visita_id", visitaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pricingRisk = priceAnalysis?.pricing_risk || "COMPETITIVE";
  const commercialOpportunity = priceAnalysis?.commercial_opportunity || "STABLE";

  const { data: pricingAlerts } = await supabase
    .from("cm_ai_pricing_alert")
    .select("sku, tipo_alerta")
    .eq("visita_id", visitaId)
    .eq("is_resolvido", false);

  // 5. Fetch all SKU catalog references with packaging & price reference
  const { data: skuRefs } = await supabase
    .from("cm_ai_product_reference")
    .select("sku, product_name, case_pack, minimum_order, sell_price_reference");

  const skuRefMap = new Map<string, { sku: string; product_name: string; case_pack: number; minimum_order: number; sell_price_reference: number }>();
  skuRefs?.forEach(ref => {
    skuRefMap.set(ref.sku, ref);
  });

  // 6. Fetch sellout analysis for this PDV
  const { data: selloutData } = await supabase
    .from("cm_sellout_analysis")
    .select("sku, estimated_stock_boxes, sellout_velocity, days_of_inventory, stock_risk")
    .eq("pdv_id", pdvId);

  const selloutMap = new Map<string, { sku: string; estimated_stock_boxes: number; sellout_velocity: number; days_of_inventory: number; stock_risk: string }>();
  selloutData?.forEach(item => {
    selloutMap.set(item.sku, item);
  });

  // 7. Process each SKU
  const items: SKUOrderRecommendation[] = [];
  let maxPriorityScore = 0;
  let frequentPurchaseCount = 0;
  let competitorRuptureDetected = false;
  let hasOverpricedSKU = false;

  for (const sku of skus) {
    const skuRef = skuRefMap.get(sku);
    const casePack = Number(skuRef?.case_pack || 6);
    const minimumOrder = Number(skuRef?.minimum_order || 6);
    const unitPrice = Number(skuRef?.sell_price_reference || 60.00);

    const sellout = selloutMap.get(sku);
    const stockRisk = sellout?.stock_risk || "LOW";
    const estimatedStock = Number(sellout?.estimated_stock_boxes || 0.00);
    const selloutVelocity = Number(sellout?.sellout_velocity || 0.00);
    const daysOfInventory = Number(sellout?.days_of_inventory || 999.00);

    // 7.1. Rupture Risk Score (0-35)
    let ruptureRiskScore = 5;
    if (stockRisk === "CRITICAL") ruptureRiskScore = 35;
    else if (stockRisk === "HIGH") ruptureRiskScore = 25;
    else if (stockRisk === "MEDIUM") ruptureRiskScore = 15;

    // 7.2. Days Since Last Purchase Score (0-20)
    const { data: lastSales } = await supabase
      .from("sales")
      .select("invoice_date")
      .eq("cod_parceiro", pdvId)
      .eq("cod_produto", sku)
      .order("invoice_date", { ascending: false })
      .limit(1);

    const hasSales = lastSales && lastSales.length > 0;
    const lastInvoiceDate = hasSales ? lastSales[0].invoice_date : null;

    let daysSinceLast = 999;
    if (lastInvoiceDate) {
      const diffTime = Math.abs(Date.now() - new Date(lastInvoiceDate).getTime());
      daysSinceLast = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }

    let daysInactiveScore = 20; // Default to maximum inactivity if never purchased
    if (daysSinceLast <= 7) daysInactiveScore = 0;
    else if (daysSinceLast <= 14) daysInactiveScore = 5;
    else if (daysSinceLast <= 30) daysInactiveScore = 10;
    else if (daysSinceLast <= 60) daysInactiveScore = 15;

    if (daysSinceLast <= 15) {
      frequentPurchaseCount++;
    }

    // 7.3. Shelf Share Score (0-15)
    let shelfShareScore = 0;
    if (activeShelfShare < 20.00) shelfShareScore = 15;
    else if (activeShelfShare < 35.00) shelfShareScore = 10;
    else if (activeShelfShare < 50.00) shelfShareScore = 5;

    // 7.4. Pricing Opportunity Score (0-15)
    const hasPromoAlert = pricingAlerts?.some(a => a.sku === sku && a.tipo_alerta === "competitor_promo_detected") || false;
    const hasOverpricedAlert = pricingAlerts?.some(a => a.sku === sku && (a.tipo_alerta === "overpriced_versus_market" || a.tipo_alerta === "overpriced_versus_strategy")) || false;
    
    if (hasOverpricedAlert) {
      hasOverpricedSKU = true;
    }

    let pricingOppScore = 0;
    if (hasPromoAlert || hasOverpricedAlert || pricingRisk === "OVERPRICED" || commercialOpportunity === "CRITICAL" || commercialOpportunity === "DEFENSIVE") {
      pricingOppScore = 15;
    } else if (pricingRisk === "SLIGHTLY_EXPENSIVE" || commercialOpportunity === "EXPANSION") {
      pricingOppScore = 10;
    } else if (pricingRisk === "COMPETITIVE" || commercialOpportunity === "OFFENSIVE") {
      pricingOppScore = 5;
    }

    // 7.5. PDV Revenue Score (0-15)
    let pdvRevenueScore = 0;
    if (monthlyRevenue >= 100000.00) pdvRevenueScore = 15;
    else if (monthlyRevenue >= 50000.00) pdvRevenueScore = 10;
    else if (monthlyRevenue >= 20000.00) pdvRevenueScore = 5;

    // 7.6. Total Priority Score
    const priorityScore = ruptureRiskScore + daysInactiveScore + shelfShareScore + pricingOppScore + pdvRevenueScore;
    maxPriorityScore = Math.max(maxPriorityScore, priorityScore);

    // 7.7. Suggested Quantity
    // suggested_boxes = max(minimum_order, (sellout_velocity * 14) - stock_estimado)
    let suggestedBoxes = 0;
    const rawNeeded = (selloutVelocity * 14) - estimatedStock;
    const isAtRisk = stockRisk === "CRITICAL" || stockRisk === "HIGH" || estimatedStock === 0;
    
    if (rawNeeded > 0 || isAtRisk) {
      suggestedBoxes = Math.max(minimumOrder, rawNeeded);
    }

    // Rounding to case pack multiple
    const roundedBoxes = suggestedBoxes > 0 ? Math.ceil(suggestedBoxes / casePack) * casePack : 0;
    const subtotal = roundedBoxes * unitPrice;

    // 7.8. Reasons
    const reasonList: string[] = [];
    if (daysOfInventory < 3) {
      reasonList.push(`Risco crítico de ruptura (${daysOfInventory.toFixed(1)} dias de estoque)`);
    } else if (daysOfInventory < 7) {
      reasonList.push(`Risco de ruptura (${daysOfInventory.toFixed(1)} dias de estoque)`);
    }

    if (daysSinceLast > 30) {
      reasonList.push(`PDV sem comprar há ${daysSinceLast === 999 ? "muito tempo" : `${daysSinceLast} dias`}`);
    } else if (daysSinceLast > 14) {
      reasonList.push(`Giro inativo por ${daysSinceLast} dias`);
    }

    if (activeShelfShare < 35.00) {
      reasonList.push(`Participação de gôndola baixa (${activeShelfShare.toFixed(1)}%)`);
    }

    if (hasPromoAlert) {
      reasonList.push("Concorrente em promoção detectada");
    }
    if (hasOverpricedAlert) {
      reasonList.push("Preço Coffee Mais overpriced");
    } else if (pricingRisk === "COMPETITIVE") {
      reasonList.push("Oportunidade por preço competitivo");
    }

    if (roundedBoxes > 0) {
      items.push({
        sku,
        suggested_boxes: roundedBoxes,
        unit_price: unitPrice,
        subtotal,
        priority_score: priorityScore,
        reason: reasonList.length > 0 ? reasonList : ["Sugestão de reposição de estoque ideal"]
      });
    }
  }

  // 8. Consolidated Calculations
  const totalRecommendedBoxes = items.reduce((sum, item) => sum + item.suggested_boxes, 0);
  const totalRecommendedValue = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Urgency Classification
  let urgencyLevel: OrderRecommendationResult["urgency_level"] = "LOW";
  if (maxPriorityScore >= 85) urgencyLevel = "CRITICAL";
  else if (maxPriorityScore >= 70) urgencyLevel = "HIGH";
  else if (maxPriorityScore >= 50) urgencyLevel = "MEDIUM";

  // Check if competitor has intrusion or rupture
  if (shelfAnalysisId) {
    const { data: detectedItems } = await supabase
      .from("cm_ai_shelf_analysis")
      .select("detected_products")
      .eq("id", shelfAnalysisId)
      .maybeSingle();
  const productsList = (detectedItems?.detected_products as Array<{ brand: string; facings: number; rupture_status: string }>) || [];
    competitorRuptureDetected = productsList.some(p => p.brand !== "Coffee Mais" && (p.facings === 0 || p.rupture_status === "TOTAL"));
  }

  // Conversion Probability (0 - 100)
  // Base: 50%
  // +15 se compra frequente (pelo menos 1 SKU comprado nos últimos 15 dias)
  // +15 se sem ruptura concorrente (competitorRuptureDetected === false)
  // +10 se preço competitivo
  // -20 se sem compra há muito tempo
  // -15 se overpriced
  let prob = 50;
  if (frequentPurchaseCount > 0) prob += 15;
  if (!competitorRuptureDetected) prob += 15;
  if (pricingRisk === "COMPETITIVE") prob += 10;
  
  // Let's check from our items logic: if max inactivity is > 45 days:
  let maxDaysSinceLast = 0;
  for (const sku of skus) {
    const { data: lastSales } = await supabase
      .from("sales")
      .select("invoice_date")
      .eq("cod_parceiro", pdvId)
      .eq("cod_produto", sku)
      .order("invoice_date", { ascending: false })
      .limit(1);
    if (lastSales && lastSales.length > 0) {
      const diff = Date.now() - new Date(lastSales[0].invoice_date).getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days > maxDaysSinceLast) maxDaysSinceLast = days;
    } else {
      maxDaysSinceLast = 999;
    }
  }

  if (maxDaysSinceLast > 45) prob -= 20;
  if (hasOverpricedSKU || pricingRisk === "OVERPRICED") prob -= 15;

  const conversionProbability = Math.max(0, Math.min(100, prob));

  // 9. Persist into Supabase (upsert recommendation first)
  const { data: recSaved, error: recError } = await supabase
    .from("cm_order_recommendation")
    .upsert({
      visita_id: visitaId,
      pdv_id: pdvId,
      total_recommended_value: totalRecommendedValue,
      total_recommended_boxes: totalRecommendedBoxes,
      urgency_level: urgencyLevel,
      conversion_probability: conversionProbability,
      created_at: new Date().toISOString()
    }, { onConflict: "visita_id" })
    .select()
    .single();

  if (recError) {
    console.error("Error upserting order recommendation:", recError);
    throw recError;
  }

  // Delete previous items for this recommendation and insert new ones
  await supabase
    .from("cm_order_recommendation_item")
    .delete()
    .eq("recommendation_id", recSaved.id);

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("cm_order_recommendation_item")
      .insert(items.map(item => ({
        recommendation_id: recSaved.id,
        sku: item.sku,
        suggested_boxes: item.suggested_boxes,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        reason: item.reason,
        priority_score: item.priority_score
      })));

    if (itemsError) {
      console.error("Error inserting order recommendation items:", itemsError);
      throw itemsError;
    }
  }

  return {
    id: recSaved.id,
    visita_id: visitaId,
    pdv_id: pdvId,
    total_recommended_value: totalRecommendedValue,
    total_recommended_boxes: totalRecommendedBoxes,
    urgency_level: urgencyLevel,
    conversion_probability: conversionProbability,
    items
  };
}
