import { createAdminClient } from "@/lib/supabase/admin";

interface DetectedProduct {
  sku: string;
  product_name: string;
  facings: number;
  detected_facings: number; // for backward compatibility with page.tsx
  expected_facings: number;
  confidence: number;
  shelf_number: number;
  position_ok: boolean;
  competitor_intrusion: boolean;
  roi: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface ShelfAnalysisResult {
  detected_products: DetectedProduct[];
  total_facings: number;
  coffee_mais_facings: number;
  shelf_share_percent: number;
  rupture_status: "TOTAL" | "PARCIAL" | "OK";
  planogram_score: number;
  ai_confidence: number;
  quality_score: number;
  quality_status: "GOOD" | "DARK" | "BLURRED" | "CROPPED" | "OVEREXPOSED";
  quality_issues: string[];
  needs_manual_review: boolean;
  review_reason: string | null;
  planogram_version_used: number;
  annotated_image_url: string;
  decision_reasons: string[];
}

/**
 * Converts a string hash into a stable numeric seed
 */
function getSeedFromHash(hash: string): number {
  let hashVal = 0;
  for (let i = 0; i < hash.length; i++) {
    hashVal = (hashVal << 5) - hashVal + hash.charCodeAt(i);
    hashVal |= 0; // Convert to 32bit integer
  }
  return Math.abs(hashVal);
}

/**
 * Creates a deterministic pseudo-random generator (LCG)
 */
function createDeterministicRandom(seed: number) {
  let currentSeed = seed;
  return function(min = 0, max = 1) {
    currentSeed = (1103515245 * currentSeed + 12345) % 2147483648;
    return min + (currentSeed / 2147483648) * (max - min);
  };
}

/**
 * Simulates Computer Vision AI Shelf Analysis based on expected planogram,
 * quality gate (MD5-seeded), business priority weights, versioning, and decision reasons.
 */
export async function simulateAIShelfAnalysis(
  visitaId: string,
  codParceiro: string,
  photoUrl: string,
  imageMd5: string
): Promise<ShelfAnalysisResult> {
  const supabase = createAdminClient();

  // 1. Fetch expected planogram items for this PDV (active version only)
  const { data: planograms, error } = await supabase
    .from("cm_pdv_planograma")
    .select("*")
    .eq("pdv_id", codParceiro)
    .eq("is_active", true);

  // 2. Fetch catalog info to get product names and business priorities
  const { data: productRefs } = await supabase
    .from("cm_ai_product_reference")
    .select("sku, product_name, business_priority");

  const productRefMap = new Map();
  if (productRefs) {
    productRefs.forEach(ref => {
      productRefMap.set(ref.sku, ref);
    });
  }

  // 3. Setup MD5-seeded deterministic random number generator
  const seed = getSeedFromHash(imageMd5 || photoUrl || visitaId);
  const deterministicRandom = createDeterministicRandom(seed);

  // 4. Simulate photo quality gate
  const qualityRoll = deterministicRandom();
  let qualityStatus: "GOOD" | "DARK" | "BLURRED" | "CROPPED" | "OVEREXPOSED" = "GOOD";
  let qualityScore = 100;
  const qualityIssues: string[] = [];
  const decisionReasons: string[] = [];

  if (qualityRoll < 0.04) {
    qualityStatus = "DARK";
    qualityScore = Math.floor(deterministicRandom(50, 74));
    qualityIssues.push("Ambiente de gôndola muito escuro");
    decisionReasons.push("Imagem com baixa luminosidade (DARK) reduziu a confiabilidade do scanner.");
  } else if (qualityRoll < 0.08) {
    qualityStatus = "BLURRED";
    qualityScore = Math.floor(deterministicRandom(55, 74));
    qualityIssues.push("Foto tremida ou fora de foco");
    decisionReasons.push("Imagem com desfoque excessivo (BLURRED) detectado.");
  } else if (qualityRoll < 0.12) {
    qualityStatus = "CROPPED";
    qualityScore = Math.floor(deterministicRandom(60, 74));
    qualityIssues.push("Enquadramento incompleto da gôndola");
    decisionReasons.push("Foto com corte excessivo (CROPPED) impede análise total de facings.");
  } else if (qualityRoll < 0.16) {
    qualityStatus = "OVEREXPOSED";
    qualityScore = Math.floor(deterministicRandom(55, 74));
    qualityIssues.push("Brilho ou reflexo excessivo na embalagem");
    decisionReasons.push("Foto superexposta (OVEREXPOSED) com reflexos de luz invadindo a gôndola.");
  } else {
    qualityStatus = "GOOD";
    qualityScore = Math.floor(deterministicRandom(90, 100));
  }

  const needsManualReview = qualityStatus !== "GOOD";
  const reviewReason = needsManualReview 
    ? `Qualidade da foto classificada como ${qualityStatus} (Score: ${qualityScore})` 
    : null;

  // Fallback if no planogram registered
  if (error || !planograms || planograms.length === 0) {
    const fallbackDetected: DetectedProduct[] = [
      {
        sku: "COFFEE_MAIS_CLASSICO",
        product_name: "Café Clássico Moído 250g",
        facings: 3,
        detected_facings: 3,
        expected_facings: 3,
        confidence: parseFloat(deterministicRandom(0.92, 0.98).toFixed(4)),
        shelf_number: 1,
        position_ok: true,
        competitor_intrusion: false,
        roi: { x1: 0.05, y1: 0.1, x2: 0.45, y2: 0.35 }
      },
      {
        sku: "COFFEE_MAIS_INTENSO",
        product_name: "Café Intenso Moído 250g",
        facings: 2,
        detected_facings: 2,
        expected_facings: 2,
        confidence: parseFloat(deterministicRandom(0.91, 0.98).toFixed(4)),
        shelf_number: 1,
        position_ok: true,
        competitor_intrusion: false,
        roi: { x1: 0.45, y1: 0.1, x2: 0.85, y2: 0.35 }
      }
    ];

    if (needsManualReview) {
      decisionReasons.push("Análise utiliza dados fictícios de fallback devido à ausência de planograma no PDV.");
    } else {
      decisionReasons.push("Gôndola em total conformidade com dados de fallback (Sem planograma configurado).");
    }

    return {
      detected_products: fallbackDetected,
      total_facings: 12,
      coffee_mais_facings: 5,
      shelf_share_percent: parseFloat(((5 / 12) * 100).toFixed(2)),
      rupture_status: "OK",
      planogram_score: 100,
      ai_confidence: parseFloat(deterministicRandom(0.85, 0.98).toFixed(4)),
      quality_score: qualityScore,
      quality_status: qualityStatus,
      quality_issues: qualityIssues,
      needs_manual_review: needsManualReview,
      review_reason: reviewReason,
      planogram_version_used: 1,
      annotated_image_url: photoUrl,
      decision_reasons: decisionReasons
    };
  }

  // 5. Simulate AI detection with SKU priority weights
  const detectedProducts: DetectedProduct[] = [];
  let coffeeMaisFacings = 0;
  let planogramScore = 100;

  const complianceRoll = deterministicRandom();
  const isTotalRupture = complianceRoll < 0.05; // 5% total rupture
  const hasComplianceIssues = complianceRoll >= 0.05 && complianceRoll < 0.35; // 30% issues

  const planogramVersionUsed = planograms[0].planogram_version || 1;

  for (const plan of planograms) {
    const ref = productRefMap.get(plan.sku);
    const productName = ref?.product_name || plan.sku;
    const businessPriority = ref?.business_priority || 3;

    let detectedFacings = plan.expected_facings;
    let positionOk = true;
    let competitorIntrusion = false;

    if (isTotalRupture) {
      detectedFacings = 0;
      const penalty = Math.min(100, 10 * (businessPriority / 3.0) * plan.expected_facings);
      planogramScore -= penalty;
      decisionReasons.push(`Ruptura total de ${productName} (Prioridade: ${businessPriority}) - Penalidade: -${penalty.toFixed(1)} pts`);
    } else if (hasComplianceIssues) {
      const variance = deterministicRandom();
      if (variance < 0.25) {
        detectedFacings = Math.max(0, plan.expected_facings - 1);
        const penalty = Math.min(100, 10 * (businessPriority / 3.0));
        planogramScore -= penalty;
        decisionReasons.push(`SKU ${productName} com 1 facing faltante (Prioridade: ${businessPriority}) - Penalidade: -${penalty.toFixed(1)} pts`);
      } else if (variance < 0.35) {
        detectedFacings = 0;
        const penalty = Math.min(100, 10 * (businessPriority / 3.0) * plan.expected_facings);
        planogramScore -= penalty;
        decisionReasons.push(`Ruptura de SKU ${productName} (Prioridade: ${businessPriority}) - Penalidade: -${penalty.toFixed(1)} pts`);
      }

      // Position check
      if (deterministicRandom() < 0.2) {
        positionOk = false;
        const penalty = 15 * (businessPriority / 3.0);
        planogramScore -= penalty;
        decisionReasons.push(`SKU ${productName} na prateleira/posição incorreta (Prioridade: ${businessPriority}) - Penalidade: -${penalty.toFixed(1)} pts`);
      }

      // Competitor intrusion check
      if (deterministicRandom() < 0.15) {
        competitorIntrusion = true;
        const penalty = 20 * (businessPriority / 3.0);
        planogramScore -= penalty;
        decisionReasons.push(`Invasão de concorrente no espaço de ${productName} (Prioridade: ${businessPriority}) - Penalidade: -${penalty.toFixed(1)} pts`);
      }
    }

    coffeeMaisFacings += detectedFacings;

    // Granular SKU confidence: influenced by image quality
    const baseMinConf = qualityStatus === "GOOD" ? 0.88 : 0.65;
    const baseMaxConf = qualityStatus === "GOOD" ? 0.99 : 0.82;
    const confidence = parseFloat(deterministicRandom(baseMinConf, baseMaxConf).toFixed(4));

    detectedProducts.push({
      sku: plan.sku,
      product_name: productName,
      facings: detectedFacings,
      detected_facings: detectedFacings, // compatibility
      expected_facings: plan.expected_facings,
      confidence,
      shelf_number: plan.shelf_number,
      position_ok: positionOk,
      competitor_intrusion: competitorIntrusion,
      roi: {
        x1: plan.roi_x1 ?? 0.0,
        y1: plan.roi_y1 ?? 0.0,
        x2: plan.roi_x2 ?? 1.0,
        y2: plan.roi_y2 ?? 1.0
      }
    });
  }

  planogramScore = Math.max(0, Math.min(100, Math.round(planogramScore)));

  if (decisionReasons.length === 0) {
    decisionReasons.push("Planograma em total conformidade com as regras vigentes.");
  }

  // Competitor facings simulator
  const competitorFacings = 5 + Math.floor(deterministicRandom() * 10);
  const totalFacings = coffeeMaisFacings + competitorFacings;
  const shelfSharePercent = totalFacings > 0 
    ? parseFloat(((coffeeMaisFacings / totalFacings) * 100).toFixed(2))
    : 0;

  // Rupture Status
  let ruptureStatus: "TOTAL" | "PARCIAL" | "OK" = "OK";
  if (coffeeMaisFacings === 0) {
    ruptureStatus = "TOTAL";
  } else if (detectedProducts.some(p => p.facings < p.expected_facings)) {
    ruptureStatus = "PARCIAL";
  }

  const aiConfidence = parseFloat(deterministicRandom(0.85, 0.98).toFixed(4));
  
  // Annotated image URL: suffixes file format for visual audit
  const annotatedImageUrl = photoUrl 
    ? `${photoUrl.replace(/\.[^/.]+$/, "")}_annotated.jpg` 
    : "";

  return {
    detected_products: detectedProducts,
    total_facings: totalFacings,
    coffee_mais_facings: coffeeMaisFacings,
    shelf_share_percent: shelfSharePercent,
    rupture_status: ruptureStatus,
    planogram_score: planogramScore,
    ai_confidence: aiConfidence,
    quality_score: qualityScore,
    quality_status: qualityStatus,
    quality_issues: qualityIssues,
    needs_manual_review: needsManualReview,
    review_reason: reviewReason,
    planogram_version_used: planogramVersionUsed,
    annotated_image_url: annotatedImageUrl,
    decision_reasons: decisionReasons
  };
}
