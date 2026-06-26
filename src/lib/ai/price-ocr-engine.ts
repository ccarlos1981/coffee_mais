import { createAdminClient } from "@/lib/supabase/admin";

interface DetectedProduct {
  sku: string;
  product_name: string;
  facings: number;
  detected_facings: number;
  expected_facings: number;
  confidence: number;
  shelf_number: number;
  position_ok: boolean;
  competitor_intrusion: boolean;
}

interface SkuGapAnalysisItem {
  price: number;
  competitor_sku: string;
  competitor_brand: string;
  competitor_price: number;
  gap_percent: number;
  pricing_risk: "COMPETITIVE" | "SLIGHTLY_EXPENSIVE" | "OVERPRICED" | "UNDERPRICED";
  opportunity_score: number;
}

interface SkuGapAnalysis {
  [sku: string]: SkuGapAnalysisItem;
}

interface PriceRecommendationItem {
  action: "REDUCE_PRICE" | "INCREASE_PRICE" | "MAINTAIN_PRICE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  suggested_target_price: number;
  expected_gap_after_action: number;
}

interface OutlierRecord {
  price: number;
  reason: string;
  source_level: string;
}

interface PriceOCRResult {
  detected_prices: {
    sku: string;
    brand: string;
    price: number;
    confidence: number;
    is_promo: boolean;
    ocr_text_raw: string;
    price_bbox: { x1: number; y1: number; x2: number; y2: number };
    digit_confidence: { digit: string; confidence: number }[];
  }[];
  price_index: number;
  price_gap_percent: number;
  pricing_risk: "COMPETITIVE" | "SLIGHTLY_EXPENSIVE" | "OVERPRICED" | "UNDERPRICED";
  sku_gap_analysis: SkuGapAnalysis;
  price_opportunity_score: number;
  ocr_confidence_score: number;
  price_recommendation: Record<string, PriceRecommendationItem>;
  reference_min_price: number;
  reference_target_price: number;
  reference_max_price: number;
  commercial_opportunity: "DEFENSIVE" | "OFFENSIVE" | "EXPANSION" | "CRITICAL" | "STABLE";
  commercial_opportunity_score: number;
  anomaly_reference_level: "PDV" | "NETWORK" | "STATE" | "NATIONAL" | null;
  anomaly_reference_sample_size: number | null;
  anomaly_reference_window_days: number;
  had_outliers_removed: boolean;
  outlier_count: number;
  outlier_values_removed: OutlierRecord[];
}

function getSeedFromHash(hash: string): number {
  let hashVal = 0;
  for (let i = 0; i < hash.length; i++) {
    hashVal = (hashVal << 5) - hashVal + hash.charCodeAt(i);
    hashVal |= 0;
  }
  return Math.abs(hashVal);
}

function createDeterministicRandom(seed: number) {
  let currentSeed = seed;
  return function(min = 0, max = 1) {
    currentSeed = (1103515245 * currentSeed + 12345) % 2147483648;
    return min + (currentSeed / 2147483648) * (max - min);
  };
}

function generateDigitConfidence(priceVal: number, randFn: (min: number, max: number) => number) {
  const str = priceVal.toFixed(2);
  const digitsOnly = str.replace(/[^0-9]/g, "");
  return digitsOnly.split("").map(digit => ({
    digit,
    confidence: parseFloat(randFn(0.90, 0.99).toFixed(4))
  }));
}

// Coffee Mais segment mapping
const COFFEE_MAIS_SEGMENT: Record<string, string> = {
  COFFEE_MAIS_CLASSICO: "MAINSTREAM",
  COFFEE_MAIS_INTENSO: "MAINSTREAM",
  COFFEE_MAIS_GOURMET: "PREMIUM",
  COFFEE_MAIS_ESPRESSO: "SUPER_PREMIUM"
};

/**
 * Performs anti-outlier filtering on a list of prices using std dev from median (deviation > 2.5 sigma).
 * Protection: if sigma < 0.01, do not filter any item.
 */
function processOutliersForLevel(
  rawPrices: number[],
  levelName: "PDV" | "NETWORK" | "STATE" | "NATIONAL"
): {
  cleanedPrices: number[];
  removed: OutlierRecord[];
} {
  if (rawPrices.length < 3) {
    return { cleanedPrices: rawPrices, removed: [] };
  }

  const sorted = [...rawPrices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const mean = rawPrices.reduce((sum, p) => sum + p, 0) / rawPrices.length;
  const variance = rawPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / rawPrices.length;
  const sigma = Math.sqrt(variance);

  if (sigma < 0.01) {
    return { cleanedPrices: rawPrices, removed: [] };
  }

  const cleanedPrices: number[] = [];
  const removed: OutlierRecord[] = [];

  rawPrices.forEach(p => {
    if (Math.abs(p - median) > 2.5 * sigma) {
      removed.push({
        price: p,
        reason: ">2.5_sigma",
        source_level: levelName
      });
    } else {
      cleanedPrices.push(p);
    }
  });

  return { cleanedPrices, removed };
}

/**
 * Simulates Price OCR of tags, calculates gaps, indices, risk levels, and dispatches pricing alerts.
 */
export async function simulatePriceOCR(
  visitaId: string,
  analysisId: string,
  detectedProducts: DetectedProduct[],
  imageMd5: string
): Promise<PriceOCRResult> {
  const supabase = createAdminClient();

  // 1. Fetch expected strategic prices for Coffee Mais
  const { data: priceRefs } = await supabase
    .from("cm_price_reference")
    .select("*");

  const priceRefMap = new Map<string, { sku: string; target_price: number; strategic_floor: number; strategic_ceiling: number }>();
  priceRefs?.forEach(ref => {
    priceRefMap.set(ref.sku, ref);
  });

  // 1.1 Fetch business priorities from product references
  const { data: productRefs } = await supabase
    .from("cm_ai_product_reference")
    .select("sku, business_priority");

  const priorityMap = new Map<string, number>();
  productRefs?.forEach(ref => {
    priorityMap.set(ref.sku, ref.business_priority || 3);
  });

  // 2. Fetch competitor catalog info
  const { data: competitorCatalog } = await supabase
    .from("cm_competitor_reference")
    .select("*");

  const competitorSegmentMap = new Map<string, string>();
  competitorCatalog?.forEach(c => {
    competitorSegmentMap.set(c.sku, c.market_segment || "MAINSTREAM");
  });

  // 3. Setup deterministic seed LCG
  const seed = getSeedFromHash(imageMd5 || visitaId);
  const deterministicRandom = createDeterministicRandom(seed);

  // 4. Simulate Coffee Mais prices
  const detectedPrices: PriceOCRResult["detected_prices"] = [];

  const cmDetected = detectedProducts.filter(p => !p.competitor_intrusion && p.facings > 0);

  cmDetected.forEach(prod => {
    const ref = priceRefMap.get(prod.sku);
    const targetPrice = ref ? parseFloat(ref.suggested_target_price) : 23.90;
    
    // Price variance +/- 5%
    const variance = deterministicRandom(-0.05, 0.05);
    const price = parseFloat((targetPrice * (1 + variance)).toFixed(2));
    const confidence = parseFloat(deterministicRandom(0.92, 0.99).toFixed(4));
    
    const x1 = parseFloat(deterministicRandom(0.05, 0.75).toFixed(2));
    const y1 = parseFloat(deterministicRandom(0.1, 0.75).toFixed(2));

    detectedPrices.push({
      sku: prod.sku,
      brand: "Coffee Mais",
      price,
      confidence,
      is_promo: false,
      ocr_text_raw: `R$ ${price.toFixed(2)}`,
      price_bbox: { x1, y1, x2: parseFloat((x1 + 0.08).toFixed(2)), y2: parseFloat((y1 + 0.04).toFixed(2)) },
      digit_confidence: generateDigitConfidence(price, deterministicRandom)
    });
  });

  // Fallback if no Coffee Mais SKUs are detected
  if (detectedPrices.length === 0) {
    const ref = priceRefs?.[0] || { sku: "COFFEE_MAIS_CLASSICO", suggested_target_price: 23.90 };
    const price = parseFloat(ref.suggested_target_price);
    const confidence = 0.95;
    detectedPrices.push({
      sku: ref.sku,
      brand: "Coffee Mais",
      price,
      confidence,
      is_promo: false,
      ocr_text_raw: `R$ ${price.toFixed(2)}`,
      price_bbox: { x1: 0.2, y1: 0.3, x2: 0.28, y2: 0.34 },
      digit_confidence: generateDigitConfidence(price, deterministicRandom)
    });
  }

  // 5. Simulate Competitor Prices
  const competitorsToSimulate = competitorCatalog || [
    { brand_name: "Pilão", sku: "PILAO_250G", product_name: "Café Pilão Tradicional 250g", market_segment: "MAINSTREAM" },
    { brand_name: "3 Corações", sku: "TRES_CORACOES_250G", product_name: "Café 3 Corações Tradicional 250g", market_segment: "MAINSTREAM" },
    { brand_name: "Melitta", sku: "MELITTA_250G", product_name: "Café Melitta Tradicional 250g", market_segment: "MAINSTREAM" },
    { brand_name: "L'Or", sku: "LOR_250G", product_name: "Café L'Or Classique Moído 250g", market_segment: "PREMIUM" }
  ];

  const selectedCompetitors = competitorsToSimulate.filter((_, idx) => {
    const roll = deterministicRandom();
    if (idx === 4) return true; // L'Or
    return roll > 0.3; // 70% chance to detect each competitor
  });

  if (selectedCompetitors.length === 0) {
    selectedCompetitors.push(competitorsToSimulate[0]);
  }

  selectedCompetitors.forEach(comp => {
    const brand = comp.brand_name;
    const sku = comp.sku;
    
    let baseTarget = 19.90;
    if (brand === "Pilão") baseTarget = 19.90;
    else if (brand === "3 Corações") baseTarget = 18.90;
    else if (brand === "Melitta") baseTarget = 19.50;
    else if (brand === "Santa Clara") baseTarget = 17.90;
    else if (brand === "L'Or") baseTarget = 26.90;

    let price = baseTarget * (1 + deterministicRandom(-0.06, 0.06));
    
    // Aggressive promotion detection
    let isPromo = false;
    if (brand !== "L'Or" && deterministicRandom() < 0.15) {
      price = baseTarget * 0.75; // 25% discount, triggering aggressive promo
      isPromo = true;
    }

    price = parseFloat(price.toFixed(2));
    const confidence = parseFloat(deterministicRandom(0.88, 0.98).toFixed(4));
    
    const x1 = parseFloat(deterministicRandom(0.05, 0.75).toFixed(2));
    const y1 = parseFloat(deterministicRandom(0.1, 0.75).toFixed(2));

    detectedPrices.push({
      sku,
      brand,
      price,
      confidence,
      is_promo: isPromo,
      ocr_text_raw: `R$ ${price.toFixed(2)}`,
      price_bbox: { x1, y1, x2: parseFloat((x1 + 0.08).toFixed(2)), y2: parseFloat((y1 + 0.04).toFixed(2)) },
      digit_confidence: generateDigitConfidence(price, deterministicRandom)
    });
  });

  // Global OCR confidence score
  const ocrConfidenceScore = parseFloat(deterministicRandom(60, 100).toFixed(2));

  // If OCR confidence score is LOW (< 75), trigger manual review
  if (ocrConfidenceScore < 75.0) {
    const { data: currentAnalysis } = await supabase
      .from("cm_ai_shelf_analysis")
      .select("needs_manual_review, review_reason")
      .eq("id", analysisId)
      .single();
    
    let newReason = `Confiança do Price OCR baixa: ${ocrConfidenceScore}%`;
    if (currentAnalysis?.review_reason) {
      newReason = `${currentAnalysis.review_reason} | ${newReason}`;
    }
    
    await supabase
      .from("cm_ai_shelf_analysis")
      .update({
        needs_manual_review: true,
        review_reason: newReason
      })
      .eq("id", analysisId);
  }

  // 6. Compute Individual SKU Gap Analysis & Recommendations
  const skuGapAnalysis: SkuGapAnalysis = {};
  const priceRecommendation: Record<string, PriceRecommendationItem> = {};
  let totalOpportunityScore = 0;
  let cmSkuCount = 0;

  const coffeeMaisDetected = detectedPrices.filter(p => p.brand === "Coffee Mais");
  const competitorDetected = detectedPrices.filter(p => p.brand !== "Coffee Mais");

  // Determine strategic references snapshot for parent row based on primary SKU (COFFEE_MAIS_CLASSICO)
  const primaryRef = priceRefMap.get("COFFEE_MAIS_CLASSICO") || { suggested_min_price: 20.90, suggested_target_price: 23.90, suggested_max_price: 26.90 };
  const referenceMinPrice = parseFloat(primaryRef.suggested_min_price);
  const referenceTargetPrice = parseFloat(primaryRef.suggested_target_price);
  const referenceMaxPrice = parseFloat(primaryRef.suggested_max_price);

  // Fetch PDV and region details
  const { data: visitaDetails } = await supabase
    .from("cm_promotor_visita")
    .select("cod_parceiro, base_atendimento(cod_parceiro, cidade, uf, rede)")
    .eq("id", visitaId)
    .single();

  type BaseAtendimento = { cod_parceiro: string; cidade: string; uf: string; rede: string };
  const pdvId = (visitaDetails?.base_atendimento as BaseAtendimento | null)?.cod_parceiro || "unknown";
  const region = (visitaDetails?.base_atendimento as BaseAtendimento | null)?.uf || "MG";
  const rede = (visitaDetails?.base_atendimento as BaseAtendimento | null)?.rede || "Independente";

  // Historical Reference Window setup
  const anomalyReferenceWindowDays = 30;
  const thirtyDaysAgo = new Date(Date.now() - anomalyReferenceWindowDays * 24 * 60 * 60 * 1000).toISOString();

  // Outlier Audit metrics
  let anomalyReferenceLevel: "PDV" | "NETWORK" | "STATE" | "NATIONAL" | null = null;
  let anomalyReferenceSampleSize: number | null = null;
  let hadOutliersRemoved = false;
  let outlierCount = 0;
  const outlierValuesRemoved: OutlierRecord[] = [];

  for (const cm of coffeeMaisDetected) {
    const ref = priceRefMap.get(cm.sku);
    const prodName = ref?.product_name || cm.sku;

    // Segment matching comparison
    const cmSegment = COFFEE_MAIS_SEGMENT[cm.sku] || "MAINSTREAM";
    const segmentCompetitors = competitorDetected.filter(c => {
      const compSegment = competitorSegmentMap.get(c.sku) || "MAINSTREAM";
      return compSegment === cmSegment;
    });

    const comparisonCompetitors = segmentCompetitors.length > 0 ? segmentCompetitors : competitorDetected;
    const avgCompPrice = comparisonCompetitors.reduce((acc, c) => acc + c.price, 0) / comparisonCompetitors.length;

    const closestComp = comparisonCompetitors[0] || { sku: "PILAO_250G", brand: "Pilão", price: 19.90 };

    const gapPercent = parseFloat((((cm.price - avgCompPrice) / avgCompPrice) * 100).toFixed(2));
    
    let pricingRisk: "COMPETITIVE" | "SLIGHTLY_EXPENSIVE" | "OVERPRICED" | "UNDERPRICED" = "COMPETITIVE";
    if (gapPercent > 15) pricingRisk = "OVERPRICED";
    else if (gapPercent > 5) pricingRisk = "SLIGHTLY_EXPENSIVE";
    else if (gapPercent < -5) pricingRisk = "UNDERPRICED";

    // Price Opportunity Score
    const businessPriority = priorityMap.get(cm.sku) || 3;
    const volumeWeight = businessPriority / 3.0; 
    
    const isRuptured = detectedProducts.some(p => p.sku === cm.sku && p.facings < p.expected_facings);
    const ruptureRiskFactor = isRuptured ? 1.8 : 1.0;

    const opportunityScore = parseFloat((volumeWeight * Math.abs(gapPercent) * ruptureRiskFactor).toFixed(2));

    skuGapAnalysis[cm.sku] = {
      price: cm.price,
      competitor_sku: closestComp.sku,
      competitor_brand: closestComp.brand,
      competitor_price: parseFloat(closestComp.price.toFixed(2)),
      gap_percent: gapPercent,
      pricing_risk: pricingRisk,
      opportunity_score: opportunityScore
    };

    totalOpportunityScore += opportunityScore;
    cmSkuCount++;

    // Generate Recommended Action
    const refTarget = ref ? parseFloat(ref.suggested_target_price) : 23.90;
    const refMin = ref ? parseFloat(ref.suggested_min_price) : 20.90;
    const refMax = ref ? parseFloat(ref.suggested_max_price) : 26.90;

    let suggestedAction: PriceRecommendationItem["action"] = "MAINTAIN_PRICE";
    let suggestedTarget = cm.price;

    if (pricingRisk === "OVERPRICED" || cm.price > refMax) {
      suggestedAction = "REDUCE_PRICE";
      suggestedTarget = refTarget;
    } else if (pricingRisk === "UNDERPRICED" || cm.price < refMin) {
      suggestedAction = "INCREASE_PRICE";
      suggestedTarget = refTarget;
    }

    const expectedGapAfterAction = parseFloat((((suggestedTarget - avgCompPrice) / avgCompPrice) * 100).toFixed(2));

    // Calculate action severity based on gapPercent absolute deviation
    const absGap = Math.abs(gapPercent);
    let severity: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (absGap > 20) {
      severity = "HIGH";
    } else if (absGap > 10) {
      severity = "MEDIUM";
    } else if (absGap >= 5) {
      severity = "LOW";
    }

    priceRecommendation[cm.sku] = {
      action: suggestedAction,
      severity,
      suggested_target_price: suggestedTarget,
      expected_gap_after_action: expectedGapAfterAction
    };

    // --- ALERTS TRIGGERING ---
    
    // Alerta 1: overpriced_versus_market
    if (gapPercent > 15.0) {
      await supabase.from("cm_ai_pricing_alert").insert({
        visita_id: visitaId,
        pdv_id: pdvId,
        sku: cm.sku,
        tipo_alerta: "overpriced_versus_market",
        descricao: `SKU ${prodName} está R$ ${cm.price} (${gapPercent}% acima do segmento concorrente a R$ ${avgCompPrice.toFixed(2)}).`
      });

      // Regional overpriced detection
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: regionalOverpricedCount } = await supabase
        .from("cm_ai_pricing_alert")
        .select("*", { count: "exact", head: true })
        .eq("sku", cm.sku)
        .eq("tipo_alerta", "overpriced_versus_market")
        .eq("is_resolvido", false)
        .gte("created_at", sevenDaysAgo);

      if (regionalOverpricedCount && regionalOverpricedCount >= 2) {
        await supabase.from("cm_ai_pricing_alert").insert({
          visita_id: visitaId,
          pdv_id: pdvId,
          sku: cm.sku,
          tipo_alerta: "overpriced_versus_market",
          descricao: `[ALERTA REGIONAL] Cluster de precificação detectado na região ${region}. SKU ${prodName} está overpriced em 3+ PDVs.`
        });
      }
    }

    // Alerta 2: overpriced_versus_strategy
    if (ref && cm.price > refMax) {
      await supabase.from("cm_ai_pricing_alert").insert({
        visita_id: visitaId,
        pdv_id: pdvId,
        sku: cm.sku,
        tipo_alerta: "overpriced_versus_strategy",
        descricao: `SKU ${prodName} precificado a R$ ${cm.price} (Preço máximo sugerido em estratégia: R$ ${refMax}).`
      });
    }

    // Alerta 3: margin_risk
    if (ref && cm.price < refMin) {
      await supabase.from("cm_ai_pricing_alert").insert({
        visita_id: visitaId,
        pdv_id: pdvId,
        sku: cm.sku,
        tipo_alerta: "margin_risk",
        descricao: `SKU ${prodName} precificado a R$ ${cm.price} (Abaixo do preço mínimo sugerido: R$ ${refMin}). Risco de margem corporativo.`
      });
    }

    // Alerta 4: price_anomaly (varies against recent history with Fallback + Outlier Rejection + Adaptive Threshold)
    try {
      const { data: rawHistory } = await supabase
        .from("cm_ai_price_analysis_item")
        .select(`
          price,
          created_at,
          price_analysis:cm_ai_price_analysis!inner(
            ocr_status,
            visita:cm_promotor_visita!inner(
              cod_parceiro,
              base_atendimento!inner(rede, uf)
            )
          )
        `)
        .eq("sku", cm.sku)
        .eq("brand", "Coffee Mais")
        .eq("price_analysis.ocr_status", "DONE")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });

      if (rawHistory && rawHistory.length > 0) {
        const historyMapped = rawHistory.map((h) => ({
          price: parseFloat(h.price),
          cod_parceiro: h.price_analysis?.visita?.cod_parceiro || "",
          rede: h.price_analysis?.visita?.base_atendimento?.rede || "Independente",
          uf: h.price_analysis?.visita?.base_atendimento?.uf || "MG"
        }));

        let selectedPrices: number[] = [];
        let levelUsed: "PDV" | "NETWORK" | "STATE" | "NATIONAL" | null = null;

        // Fallback checks
        const pdvGroup = historyMapped.filter(h => h.cod_parceiro === pdvId).map(h => h.price);
        if (pdvGroup.length >= 3) {
          selectedPrices = pdvGroup;
          levelUsed = "PDV";
        } else {
          const redeGroup = historyMapped.filter(h => h.rede === rede).map(h => h.price);
          if (redeGroup.length >= 3) {
            selectedPrices = redeGroup;
            levelUsed = "NETWORK";
          } else {
            const stateGroup = historyMapped.filter(h => h.uf === region).map(h => h.price);
            if (stateGroup.length >= 3) {
              selectedPrices = stateGroup;
              levelUsed = "STATE";
            } else {
              const nationalGroup = historyMapped.map(h => h.price);
              if (nationalGroup.length >= 3) {
                selectedPrices = nationalGroup;
                levelUsed = "NATIONAL";
              }
            }
          }
        }

        if (levelUsed && selectedPrices.length >= 3) {
          // Outlier Rejection
          const { cleanedPrices, removed } = processOutliersForLevel(selectedPrices, levelUsed);
          
          if (removed.length > 0) {
            hadOutliersRemoved = true;
            outlierCount += removed.length;
            outlierValuesRemoved.push(...removed);
          }

          if (cleanedPrices.length > 0) {
            anomalyReferenceLevel = levelUsed;
            anomalyReferenceSampleSize = cleanedPrices.length;

            const avgHistoryPrice = cleanedPrices.reduce((a, b) => a + b, 0) / cleanedPrices.length;
            const diffPercent = Math.abs(cm.price - avgHistoryPrice) / avgHistoryPrice;

            // Adaptive threshold
            let anomalyThreshold = 0.30; // default MAINSTREAM
            if (cmSegment === "PREMIUM") {
              anomalyThreshold = 0.40;
            } else if (cmSegment === "SUPER_PREMIUM") {
              anomalyThreshold = 0.50;
            }

            if (diffPercent > anomalyThreshold) {
              // Confidence-weighted anomaly alert
              if (ocrConfidenceScore >= 80.0) {
                await supabase.from("cm_ai_pricing_alert").insert({
                  visita_id: visitaId,
                  pdv_id: pdvId,
                  sku: cm.sku,
                  tipo_alerta: "price_anomaly",
                  descricao: `SKU ${prodName} precificado a R$ ${cm.price} (Desvio de ${(diffPercent * 100).toFixed(1)}% contra a média histórica ${levelUsed} de R$ ${avgHistoryPrice.toFixed(2)} [Threshold segment: ${(anomalyThreshold * 100).toFixed(0)}%]).`
                });
              } else {
                // If OCR confidence < 80, do not generate alert automatically; flag for manual review
                const { data: currentAnalysis } = await supabase
                  .from("cm_ai_shelf_analysis")
                  .select("needs_manual_review, review_reason")
                  .eq("id", analysisId)
                  .single();
                
                let newReason = `Anomalia de preço detectada para ${prodName} (${(diffPercent * 100).toFixed(0)}% de desvio) com confiança OCR baixa (${ocrConfidenceScore}%). Requer revisão manual.`;
                if (currentAnalysis?.review_reason) {
                  newReason = `${currentAnalysis.review_reason} | ${newReason}`;
                }
                
                await supabase
                  .from("cm_ai_shelf_analysis")
                  .update({
                    needs_manual_review: true,
                    review_reason: newReason
                  })
                  .eq("id", analysisId);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Price Anomaly Check Error]:", e);
    }
  }

  // Alerta 5: competitor_promo_detected
  for (const comp of competitorDetected) {
    if (comp.is_promo) {
      await supabase.from("cm_ai_pricing_alert").insert({
        visita_id: visitaId,
        pdv_id: pdvId,
        sku: coffeeMaisDetected[0]?.sku || "COFFEE_MAIS_CLASSICO",
        tipo_alerta: "competitor_promo_detected",
        descricao: `Promoção agressiva de concorrente detectada para ${comp.brand} (SKU: ${comp.sku}) a R$ ${comp.price}.`
      });
    }
  }

  const priceOpportunityScore = cmSkuCount > 0 ? parseFloat((totalOpportunityScore / cmSkuCount).toFixed(2)) : 0.00;

  // 7. Compute Global Metrics
  const avgCoffeeMais = coffeeMaisDetected.reduce((acc, c) => acc + c.price, 0) / coffeeMaisDetected.length;
  const traditionalCompetitors = competitorDetected.filter(c => competitorSegmentMap.get(c.sku) === "MAINSTREAM");
  const avgCompetitor = traditionalCompetitors.length > 0
    ? traditionalCompetitors.reduce((acc, c) => acc + c.price, 0) / traditionalCompetitors.length
    : 19.90;

  const avgMarket = detectedPrices.reduce((acc, c) => acc + c.price, 0) / detectedPrices.length;

  const priceGapPercent = parseFloat((((avgCoffeeMais - avgCompetitor) / avgCompetitor) * 100).toFixed(2));
  const priceIndex = parseFloat(((avgCoffeeMais / avgMarket) * 100).toFixed(2));

  let pricingRisk: "COMPETITIVE" | "SLIGHTLY_EXPENSIVE" | "OVERPRICED" | "UNDERPRICED" = "COMPETITIVE";
  if (priceGapPercent > 15) pricingRisk = "OVERPRICED";
  else if (priceGapPercent > 5) pricingRisk = "SLIGHTLY_EXPENSIVE";
  else if (priceGapPercent < -5) pricingRisk = "UNDERPRICED";

  // 8. Determine Commercial Opportunity and Opportunity Score
  const { data: shelfAnalysis } = await supabase
    .from("cm_ai_shelf_analysis")
    .select("shelf_share_percent")
    .eq("id", analysisId)
    .single();
  const shelfShare = shelfAnalysis?.shelf_share_percent ? parseFloat(String(shelfAnalysis.shelf_share_percent)) : 40.0;

  const isOverpriced = pricingRisk === "OVERPRICED";
  const isRuptured = detectedProducts.some(p => !p.competitor_intrusion && p.facings < p.expected_facings);
  const hasCompetitorPromo = competitorDetected.some(comp => comp.is_promo);

  const isHighMargin = avgCoffeeMais >= referenceTargetPrice;
  const isCompetitivePrice = priceGapPercent <= 5.0;
  const isGoodShelfShare = shelfShare >= 35.0;

  let commercialOpportunity: "DEFENSIVE" | "OFFENSIVE" | "EXPANSION" | "CRITICAL" | "STABLE" = "STABLE";
  let opportunityScoreBase = 10;

  if (isOverpriced && isRuptured && hasCompetitorPromo) {
    commercialOpportunity = "CRITICAL";
    opportunityScoreBase = 80 + Math.min(20, Math.abs(priceGapPercent) * 0.5);
  } else if (hasCompetitorPromo) {
    commercialOpportunity = "DEFENSIVE";
    opportunityScoreBase = 60 + Math.min(20, Math.abs(priceGapPercent) * 0.4);
  } else if (isHighMargin && shelfShare < 35) {
    commercialOpportunity = "EXPANSION";
    opportunityScoreBase = 40 + (35 - shelfShare) * 1.5;
  } else if (isCompetitivePrice && !isRuptured && isGoodShelfShare) {
    commercialOpportunity = "OFFENSIVE";
    opportunityScoreBase = 20 + Math.min(20, Math.abs(priceGapPercent) * 0.5);
  } else {
    commercialOpportunity = "STABLE";
    opportunityScoreBase = 10 + Math.min(10, Math.abs(priceGapPercent) * 0.2);
  }

  // Clamp the opportunity score in [0, 100]
  const commercialOpportunityScore = parseFloat(Math.max(0, Math.min(100, opportunityScoreBase)).toFixed(2));

  return {
    detected_prices: detectedPrices,
    price_index: priceIndex,
    price_gap_percent: priceGapPercent,
    pricing_risk: pricingRisk,
    sku_gap_analysis: skuGapAnalysis,
    price_opportunity_score: priceOpportunityScore,
    ocr_confidence_score: ocrConfidenceScore,
    price_recommendation: priceRecommendation,
    reference_min_price: referenceMinPrice,
    reference_target_price: referenceTargetPrice,
    reference_max_price: referenceMaxPrice,
    commercial_opportunity: commercialOpportunity,
    commercial_opportunity_score: commercialOpportunityScore,
    anomaly_reference_level: anomalyReferenceLevel,
    anomaly_reference_sample_size: anomalyReferenceSampleSize,
    anomaly_reference_window_days: anomalyReferenceWindowDays,
    had_outliers_removed: hadOutliersRemoved,
    outlier_count: outlierCount,
    outlier_values_removed: outlierValuesRemoved
  };
}
