import { createAdminClient } from "@/lib/supabase/admin";
import { getRecalibratedWeights } from "./learning-engine";
import { getCompanyKPIConfig, validateAIDecision } from "./governance-engine";

export interface PrescriptiveRecommendation {
  id?: string;
  entity_type: "PDV" | "SKU" | "REGION" | "DISTRIBUTOR";
  entity_id: string;
  recommendation_type:
    | "PRICE_REDUCTION"
    | "PRICE_INCREASE"
    | "TRADE_PROMOTION"
    | "EXTRA_VISIT"
    | "DEGUSTATION"
    | "DISPLAY_EXPANSION"
    | "STOCK_REPLENISHMENT"
    | "DISTRIBUTOR_REPLENISHMENT"
    | "NEGOTIATE_SPACE";
  priority_score: number;
  urgency_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  expected_sellout_uplift_percent: number;
  expected_revenue_uplift: number;
  expected_margin_uplift: number;
  estimated_cost: number;
  estimated_roi: number;
  recommendation_confidence: number;
  reasoning: string[];
  recommended_action: Record<string, any>;
  status: "OPEN" | "IN_PROGRESS" | "EXECUTED" | "DISMISSED";
  assigned_user_id?: string;
  company_id: string;
  recommendation_fingerprint?: string;
  alternative_actions?: any[];
  requires_approval?: boolean;
  approval_status?: "PENDING" | "APPROVED" | "REJECTED";
  governance_badge?: string;
  override_reason?: string;
}

export interface TradeSimulationResult {
  sellout_uplift_percent: number;
  expected_revenue_uplift: number;
  expected_margin_uplift: number;
  estimated_cost: number;
  estimated_roi: number;
}

/**
 * Simulates a trade investment action with multiple parameters:
 * - discount_percent (percentage price reduction)
 * - extra_display_investment (financial cost for extra display displays/ponta de gondola)
 * - degustation_days (number of days of degustation/sampling events)
 * - promotor_hours (number of extra promotor hours allocated)
 */
export function simulateTradeAction(
  actionType: string,
  context: {
    baselineSelloutValue: number;
    discount_percent?: number;
    extra_display_investment?: number;
    degustation_days?: number;
    promotor_hours?: number;
  }
): TradeSimulationResult {
  const baseline = context.baselineSelloutValue || 5000.00; // default baseline value R$ 5,000.00
  const discount = Number(context.discount_percent || 0.0);
  const displayInvest = Number(context.extra_display_investment || 0.0);
  const degustationDays = Number(context.degustation_days || 0.0);
  const promotorHours = Number(context.promotor_hours || 0.0);

  // 1. Calculate Costs
  const discountCost = baseline * (discount / 100.0);
  const displayCost = displayInvest;
  const degustationCost = degustationDays * 150.00; // R$ 150.00 per day (contractor + sampling kit)
  const promotorCost = promotorHours * 25.00;       // R$ 25.00 per hour
  const totalCost = Math.max(100.00, discountCost + displayCost + degustationCost + promotorCost); // default min R$ 100 to avoid div by zero

  // 2. Calculate Uplifts
  let discountUplift = discount * 2.4; // 5% discount -> 12% uplift, 10% discount -> 24% uplift
  let displayUplift = displayInvest > 0 ? 22.0 + Math.min(10.0, (displayInvest / 500.0) * 2.0) : 0.0;
  let degustationUplift = degustationDays > 0 ? 18.0 + Math.min(12.0, degustationDays * 2.0) : 0.0;
  let promotorUplift = promotorHours > 0 ? Math.min(15.0, promotorHours * 0.4) : 0.0;

  // Combine uplifts with a saturation dampening (capped at 80% total)
  const rawCombinedUplift = discountUplift + displayUplift + degustationUplift + promotorUplift;
  const combinedUpliftPercent = Math.min(80.00, rawCombinedUplift);

  // 3. Revenue & Margin uplifts
  const expectedRevenueUplift = baseline * (combinedUpliftPercent / 100.0);
  const expectedMarginUplift = expectedRevenueUplift * 0.40; // Assumed 40% margin of product sales

  // 4. Calculate ROI
  const estimatedRoi = (expectedMarginUplift - totalCost) / totalCost;

  return {
    sellout_uplift_percent: Number(combinedUpliftPercent.toFixed(2)),
    expected_revenue_uplift: Number(expectedRevenueUplift.toFixed(2)),
    expected_margin_uplift: Number(expectedMarginUplift.toFixed(2)),
    estimated_cost: Number(totalCost.toFixed(2)),
    estimated_roi: Number(estimatedRoi.toFixed(2))
  };
}

/**
 * Generates AI prescriptive next best actions for a specific PDV,
 * implements 7-day deduplication, priority calculations, and AI confidence factors.
 */
export async function generateNextBestActions(
  pdvId: string,
  companyId: string
): Promise<PrescriptiveRecommendation[]> {
  const supabase = createAdminClient();

  const kpis = await getCompanyKPIConfig(companyId);
  const getWeight = (code: string, def: number) => {
    const kpi = kpis.find(k => k.kpi_code === code && k.is_enabled);
    return kpi ? kpi.weight / 100 : def;
  };

  const weights = {
    impact: getWeight("SELL_OUT", 0.30),
    roi: getWeight("ROI", 0.20),
    urgency: getWeight("STOCK_RISK", 0.25),
    ease: getWeight("ROUTE_EFFICIENCY", 0.125),
    strategic: getWeight("SHELF_COMPLIANCE", 0.0625) + getWeight("PRICE_GAP", 0.0625)
  };

  // Fetch model performances to adjust confidence scores
  const { data: performances } = await supabase
    .from("cm_ai_model_performance")
    .select("recommendation_type, model_confidence_score")
    .eq("company_id", companyId);

  const confidenceMap = new Map<string, number>();
  performances?.forEach(p => {
    confidenceMap.set(p.recommendation_type, Number(p.model_confidence_score));
  });

  const getAdjustedConfidence = (type: string, baseConfidence: number): number => {
    const historicalScore = confidenceMap.has(type) ? confidenceMap.get(type)! : 100.00;
    const calculated = (baseConfidence * historicalScore) / 100.00;
    return Number(Math.max(25.00, calculated).toFixed(2));
  };

  // 1. 7-Day Deduplication check helper
  const isDuplicate = async (type: string): Promise<any | null> => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data } = await supabase
      .from("cm_ai_recommendation")
      .select("id, created_at, status")
      .eq("entity_type", "PDV")
      .eq("entity_id", pdvId)
      .eq("recommendation_type", type)
      .eq("status", "OPEN")
      .eq("company_id", companyId)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data || null;
  };

  // 2. Fetch Context Data
  const { data: pdv } = await supabase
    .from("base_atendimento")
    .select("cod_parceiro, nome_fantasia, faturamento_mensal, manager")
    .eq("cod_parceiro", pdvId)
    .single();

  if (!pdv) return [];

  const faturamento = Number(pdv.faturamento_mensal || 0);

  // Fetch sellout stats
  const { data: sellout } = await supabase
    .from("cm_sellout_analysis")
    .select("sku, estimated_stock_boxes, sellout_velocity, days_of_inventory, stock_risk")
    .eq("pdv_id", pdvId);

  // Fetch latest Shelf Analysis
  const { data: shelf } = await supabase
    .from("cm_ai_shelf_analysis")
    .select("id, shelf_share_percent, planogram_score, ai_confidence, created_at")
    .eq("analysis_status", "DONE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch latest Price Analysis
  const { data: price } = await supabase
    .from("cm_ai_price_analysis")
    .select("id, pricing_risk, commercial_opportunity")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch pricing alerts
  const { data: priceAlerts } = await supabase
    .from("cm_ai_pricing_alert")
    .select("sku, tipo_alerta")
    .eq("is_resolvido", false);

  // Fetch last visit info to check route SLA
  const { data: lastVisits } = await supabase
    .from("cm_promotor_visita")
    .select("created_at, status")
    .eq("cod_parceiro", pdvId)
    .eq("status", "CONCLUIDA")
    .order("created_at", { ascending: false })
    .limit(1);

  // Find a supervisor or trade representative to assign
  const { data: assignedRep } = await supabase
    .from("cm_user_profiles")
    .select("id")
    .eq("company_id", companyId)
    .in("role", ["Supervisor", "Trade", "Admin"])
    .limit(1)
    .maybeSingle();

  const assignedUserId = assignedRep?.id || null;

  // Compute Baseline Sellout Value for ROI Context
  let totalSelloutVelocity = 0.00;
  sellout?.forEach(s => {
    totalSelloutVelocity += Number(s.sellout_velocity || 0.00);
  });
  const baselineSelloutValue = Math.max(1000.00, totalSelloutVelocity * 30.0 * 60.00); // default min R$ 1,000

  const recommendations: PrescriptiveRecommendation[] = [];

  // ==========================================
  // CASE 1: OVERPRICED -> PRICE_REDUCTION
  // ==========================================
  const isOverpriced = price?.pricing_risk === "OVERPRICED";
  const shelfCompliance = Number(shelf?.planogram_score || 0.0);
  const hasRupture = sellout?.some(s => ["CRITICAL", "HIGH"].includes(s.stock_risk)) || false;

  if (isOverpriced && shelfCompliance >= 80 && !hasRupture) {
    const type = "PRICE_REDUCTION";
    const duplicate = await isDuplicate(type);
    if (!duplicate) {
      const roiContext = { baselineSelloutValue, discount_percent: 8.0 };
      const sim = simulateTradeAction(type, roiContext);
      
      // Scale ROI score (min 100, ROI 4.0 = 100 pts)
      const roiScore = Math.min(100.00, sim.estimated_roi * 25.0);
      const impactScore = Math.min(100.00, (sim.expected_revenue_uplift / 5000.0) * 100.0);
      const urgencyScore = 75.00; // Overpriced is high urgency
      const easeScore = 80.00;    // Price cuts are easy to run
      const strategicScore = Math.min(100.00, (faturamento / 120000.0) * 100.0);

      const priorityScore = (impactScore * weights.impact) + (roiScore * weights.roi) + (urgencyScore * weights.urgency) + (easeScore * weights.ease) + (strategicScore * weights.strategic);

      // AI Confidence
      let confidence = 90.00;
      if (shelf?.ai_confidence && shelf.ai_confidence > 0.95) confidence += 5.00;
      const dataAgeDays = shelf ? Math.floor(Math.abs(Date.now() - new Date(shelf.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 99;
      if (dataAgeDays > 7) confidence -= 10.00;
      confidence = Math.max(10.00, Math.min(100.00, confidence));

      recommendations.push({
        entity_type: "PDV",
        entity_id: pdvId,
        recommendation_type: type,
        priority_score: Number(priorityScore.toFixed(2)),
        urgency_level: "HIGH",
        expected_sellout_uplift_percent: sim.sellout_uplift_percent,
        expected_revenue_uplift: sim.expected_revenue_uplift,
        expected_margin_uplift: sim.expected_margin_uplift,
        estimated_cost: sim.estimated_cost,
        estimated_roi: sim.estimated_roi,
        recommendation_confidence: getAdjustedConfidence(type, confidence),
        reasoning: ["PDV com preço posicionado acima do mercado", "Conformidade de gôndola ideal (>80%) sem rupturas activas"],
        recommended_action: { discount_percent: 8.0, target_sku: "COFFEE_MAIS_CLASSICO" },
        status: "OPEN",
        assigned_user_id: assignedUserId || undefined,
        company_id: companyId,
        recommendation_fingerprint: `${companyId}:PDV:${pdvId}:${type}`,
        alternative_actions: [
          { discount_percent: 5.0, reason_dismissed: "ROI inferior ao desconto ideal de 8%" },
          { discount_percent: 10.0, reason_dismissed: "Margem excessivamente comprimida no PDV" }
        ]
      });
    }
  }

  // ==========================================
  // CASE 2: RUPTURA -> STOCK_REPLENISHMENT
  // ==========================================
  if (hasRupture) {
    const type = "STOCK_REPLENISHMENT";
    const duplicate = await isDuplicate(type);
    if (!duplicate) {
      // Calculate missing boxes needed
      let boxesNeeded = 0;
      sellout?.forEach(s => {
        if (["CRITICAL", "HIGH"].includes(s.stock_risk)) {
          boxesNeeded += Math.max(6, Math.round((s.sellout_velocity || 0.5) * 14));
        }
      });

      const roiContext = { baselineSelloutValue, extra_display_investment: 0.0 };
      // Stock replenishment simulates displaying normal availability -> uplift of ~15%
      const sim = simulateTradeAction(type, roiContext);
      sim.sellout_uplift_percent = 15.00;
      sim.expected_revenue_uplift = Number((baselineSelloutValue * 0.15).toFixed(2));
      sim.expected_margin_uplift = Number((sim.expected_revenue_uplift * 0.40).toFixed(2));
      sim.estimated_cost = Number((boxesNeeded * 60.00).toFixed(2));
      sim.estimated_roi = Number(((sim.expected_margin_uplift - sim.estimated_cost) / sim.estimated_cost).toFixed(2));

      const roiScore = Math.max(0, Math.min(100.00, sim.estimated_roi * 25.0));
      const impactScore = Math.min(100.00, (sim.expected_revenue_uplift / 5000.0) * 100.0);
      const urgencyScore = 95.00; // Rupture is CRITICAL urgency
      const easeScore = 90.00;    // Replenishment is easy
      const strategicScore = Math.min(100.00, (faturamento / 120000.0) * 100.0);

      const priorityScore = (impactScore * weights.impact) + (roiScore * weights.roi) + (urgencyScore * weights.urgency) + (easeScore * weights.ease) + (strategicScore * weights.strategic);

      recommendations.push({
        entity_type: "PDV",
        entity_id: pdvId,
        recommendation_type: type,
        priority_score: Number(priorityScore.toFixed(2)),
        urgency_level: "CRITICAL",
        expected_sellout_uplift_percent: sim.sellout_uplift_percent,
        expected_revenue_uplift: sim.expected_revenue_uplift,
        expected_margin_uplift: sim.expected_margin_uplift,
        estimated_cost: sim.estimated_cost,
        estimated_roi: sim.estimated_roi,
        recommendation_confidence: getAdjustedConfidence(type, 95.00),
        reasoning: ["Risco de ruptura ou ruptura ativa identificada em gôndola"],
        recommended_action: { boxes_to_order: boxesNeeded },
        status: "OPEN",
        assigned_user_id: assignedUserId || undefined,
        company_id: companyId,
        recommendation_fingerprint: `${companyId}:PDV:${pdvId}:${type}`,
        alternative_actions: [
          { boxes_to_order: Math.round(boxesNeeded * 0.5), reason_dismissed: "Volume insuficiente para cobrir velocidade de venda atual" }
        ]
      });
    }
  }

  // ==========================================
  // CASE 3: BAIXO SHARE -> DISPLAY_EXPANSION
  // ==========================================
  const shelfShare = Number(shelf?.shelf_share_percent || 0.0);
  if (shelfShare > 0 && shelfShare < 35.0) {
    const type = "DISPLAY_EXPANSION";
    const duplicate = await isDuplicate(type);
    if (!duplicate) {
      const roiContext = { baselineSelloutValue, extra_display_investment: 300.00 }; // display display investment R$ 300
      const sim = simulateTradeAction(type, roiContext);
      
      const roiScore = Math.max(0, Math.min(100.00, sim.estimated_roi * 25.0));
      const impactScore = Math.min(100.00, (sim.expected_revenue_uplift / 5000.0) * 100.0);
      const urgencyScore = 50.00; // Medium urgency
      const easeScore = 40.00;    // Low ease (hard negotiation)
      const strategicScore = Math.min(100.00, (faturamento / 120000.0) * 100.0);

      const priorityScore = (impactScore * weights.impact) + (roiScore * weights.roi) + (urgencyScore * weights.urgency) + (easeScore * weights.ease) + (strategicScore * weights.strategic);

      recommendations.push({
        entity_type: "PDV",
        entity_id: pdvId,
        recommendation_type: type,
        priority_score: Number(priorityScore.toFixed(2)),
        urgency_level: "MEDIUM",
        expected_sellout_uplift_percent: sim.sellout_uplift_percent,
        expected_revenue_uplift: sim.expected_revenue_uplift,
        expected_margin_uplift: sim.expected_margin_uplift,
        estimated_cost: sim.estimated_cost,
        estimated_roi: sim.estimated_roi,
        recommendation_confidence: getAdjustedConfidence(type, 85.00),
        reasoning: [`Participação de gôndola baixa (${shelfShare.toFixed(1)}%) versus alvo estratégico de 35%`],
        recommended_action: { target_facings_increase: 2, display_cost: 300.00 },
        status: "OPEN",
        assigned_user_id: assignedUserId || undefined,
        company_id: companyId,
        recommendation_fingerprint: `${companyId}:PDV:${pdvId}:${type}`,
        alternative_actions: [
          { negotiate_ponta: true, reason_dismissed: "Custo de verba excedeu limite de ROI esperado" }
        ]
      });
    }
  }

  // ==========================================
  // CASE 4: CONCORRENTE EM PROMOÇÃO -> TRADE_PROMOTION
  // ==========================================
  const competitorPromo = priceAlerts?.some(a => a.tipo_alerta === "competitor_promo_detected") || false;
  if (competitorPromo) {
    const type = "TRADE_PROMOTION";
    const duplicate = await isDuplicate(type);
    if (!duplicate) {
      const roiContext = { baselineSelloutValue, discount_percent: 5.0, promotor_hours: 8 };
      const sim = simulateTradeAction(type, roiContext);

      const roiScore = Math.max(0, Math.min(100.00, sim.estimated_roi * 25.0));
      const impactScore = Math.min(100.00, (sim.expected_revenue_uplift / 5000.0) * 100.0);
      const urgencyScore = 80.00; // High urgency response
      const easeScore = 60.00;    // Medium ease
      const strategicScore = Math.min(100.00, (faturamento / 120000.0) * 100.0);

      const priorityScore = (impactScore * weights.impact) + (roiScore * weights.roi) + (urgencyScore * weights.urgency) + (easeScore * weights.ease) + (strategicScore * weights.strategic);

      recommendations.push({
        entity_type: "PDV",
        entity_id: pdvId,
        recommendation_type: type,
        priority_score: Number(priorityScore.toFixed(2)),
        urgency_level: "HIGH",
        expected_sellout_uplift_percent: sim.sellout_uplift_percent,
        expected_revenue_uplift: sim.expected_revenue_uplift,
        expected_margin_uplift: sim.expected_margin_uplift,
        estimated_cost: sim.estimated_cost,
        estimated_roi: sim.estimated_roi,
        recommendation_confidence: getAdjustedConfidence(type, 88.00),
        reasoning: ["Promoção ativa de marca concorrente detectada no PDV"],
        recommended_action: { discount_percent: 5.0, action_promotor_hours: 8 },
        status: "OPEN",
        assigned_user_id: assignedUserId || undefined,
        company_id: companyId,
        recommendation_fingerprint: `${companyId}:PDV:${pdvId}:${type}`,
        alternative_actions: [
          { degustation_only: true, reason_dismissed: "Necessidade de promotor extra no local para conversão de vendas" }
        ]
      });
    }
  }

  // ==========================================
  // CASE 5: SLA ESTOURADO -> EXTRA_VISIT
  // ==========================================
  let daysSinceLastVisit = 99;
  if (lastVisits && lastVisits.length > 0) {
    const diff = Date.now() - new Date(lastVisits[0].created_at).getTime();
    daysSinceLastVisit = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Check if SLA (e.g. 14 days) is broken
  if (daysSinceLastVisit > 14) {
    const type = "EXTRA_VISIT";
    const duplicate = await isDuplicate(type);
    if (!duplicate) {
      // Extra visit has low cost (just R$ 50 travel expense) -> returns moderate uplift of ~8%
      const roiContext = { baselineSelloutValue, promotor_hours: 2 };
      const sim = simulateTradeAction(type, roiContext);
      sim.sellout_uplift_percent = 8.00;
      sim.expected_revenue_uplift = Number((baselineSelloutValue * 0.08).toFixed(2));
      sim.expected_margin_uplift = Number((sim.expected_revenue_uplift * 0.40).toFixed(2));
      sim.estimated_cost = 50.00;
      sim.estimated_roi = Number(((sim.expected_margin_uplift - 50.00) / 50.00).toFixed(2));

      const roiScore = Math.max(0, Math.min(100.00, sim.estimated_roi * 25.0));
      const impactScore = Math.min(100.00, (sim.expected_revenue_uplift / 5000.0) * 100.0);
      const urgencyScore = 70.00; // Medium-high urgency
      const easeScore = 70.00;    // Easy scheduling
      const strategicScore = Math.min(100.00, (faturamento / 120000.0) * 100.0);

      const priorityScore = (impactScore * weights.impact) + (roiScore * weights.roi) + (urgencyScore * weights.urgency) + (easeScore * weights.ease) + (strategicScore * weights.strategic);

      recommendations.push({
        entity_type: "PDV",
        entity_id: pdvId,
        recommendation_type: type,
        priority_score: Number(priorityScore.toFixed(2)),
        urgency_level: "MEDIUM",
        expected_sellout_uplift_percent: sim.sellout_uplift_percent,
        expected_revenue_uplift: sim.expected_revenue_uplift,
        expected_margin_uplift: sim.expected_margin_uplift,
        estimated_cost: sim.estimated_cost,
        estimated_roi: sim.estimated_roi,
        recommendation_confidence: getAdjustedConfidence(type, 90.00),
        reasoning: [`PDV sem visitas completadas há ${daysSinceLastVisit} dias, estourando a regra de SLA (14 dias)`],
        recommended_action: { schedule_visit: true },
        status: "OPEN",
        assigned_user_id: assignedUserId || undefined,
        company_id: companyId,
        recommendation_fingerprint: `${companyId}:PDV:${pdvId}:${type}`,
        alternative_actions: [
          { call_only: true, reason_dismissed: "SLA exige verificação física dos estoques em gôndola" }
        ]
      });
    }
  }

  // 3. Validate recommendations with Governance Policy
  for (const rec of recommendations) {
    const val = await validateAIDecision({
      recommendation_type: rec.recommendation_type,
      recommendation_confidence: rec.recommendation_confidence,
      recommended_action: rec.recommended_action,
      entity_id: rec.entity_id,
      entity_type: rec.entity_type
    }, companyId);

    rec.requires_approval = !val.approved;
    rec.approval_status = val.approved ? "APPROVED" : "PENDING";
    rec.governance_badge = val.badge;
  }

  // 4. Persist recommendations into DB
  if (recommendations.length > 0) {
    const { data: existingRecs, error: fetchErr } = await supabase
      .from("cm_ai_recommendation")
      .select("id, recommendation_fingerprint")
      .eq("entity_id", pdvId)
      .eq("status", "OPEN")
      .eq("company_id", companyId);

    if (fetchErr) {
      console.error("Error fetching existing recommendations:", fetchErr);
      throw fetchErr;
    }

    const existingMap = new Map<string, string>();
    existingRecs?.forEach(r => {
      if (r.recommendation_fingerprint) {
        existingMap.set(r.recommendation_fingerprint, r.id);
      }
    });

    const inserts: any[] = [];
    for (const rec of recommendations) {
      const existingId = rec.recommendation_fingerprint ? existingMap.get(rec.recommendation_fingerprint) : null;
      if (existingId) {
        // Update existing OPEN recommendation
        const { error: updErr } = await supabase
          .from("cm_ai_recommendation")
          .update({
            priority_score: rec.priority_score,
            urgency_level: rec.urgency_level,
            expected_sellout_uplift_percent: rec.expected_sellout_uplift_percent,
            expected_revenue_uplift: rec.expected_revenue_uplift,
            expected_margin_uplift: rec.expected_margin_uplift,
            estimated_cost: rec.estimated_cost,
            estimated_roi: rec.estimated_roi,
            recommendation_confidence: rec.recommendation_confidence,
            reasoning: rec.reasoning,
            recommended_action: rec.recommended_action,
            assigned_user_id: rec.assigned_user_id,
            alternative_actions: rec.alternative_actions,
            requires_approval: rec.requires_approval,
            approval_status: rec.approval_status,
            governance_badge: rec.governance_badge
          })
          .eq("id", existingId);

        if (updErr) {
          console.error(`Error updating recommendation ${existingId}:`, updErr);
          throw updErr;
        }
      } else {
        inserts.push({
          entity_type: rec.entity_type,
          entity_id: rec.entity_id,
          recommendation_type: rec.recommendation_type,
          priority_score: rec.priority_score,
          urgency_level: rec.urgency_level,
          expected_sellout_uplift_percent: rec.expected_sellout_uplift_percent,
          expected_revenue_uplift: rec.expected_revenue_uplift,
          expected_margin_uplift: rec.expected_margin_uplift,
          estimated_cost: rec.estimated_cost,
          estimated_roi: rec.estimated_roi,
          recommendation_confidence: rec.recommendation_confidence,
          reasoning: rec.reasoning,
          recommended_action: rec.recommended_action,
          status: rec.status,
          assigned_user_id: rec.assigned_user_id,
          company_id: rec.company_id,
          recommendation_fingerprint: rec.recommendation_fingerprint,
          alternative_actions: rec.alternative_actions,
          requires_approval: rec.requires_approval,
          approval_status: rec.approval_status,
          governance_badge: rec.governance_badge
        });
      }
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabase
        .from("cm_ai_recommendation")
        .insert(inserts);

      if (insErr) {
        console.error("Error inserting prescriptive recommendations:", insErr);
        throw insErr;
      }
    }
  }

  return recommendations;
}
