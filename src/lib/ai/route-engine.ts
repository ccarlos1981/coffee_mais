import { createAdminClient } from "@/lib/supabase/admin";

interface RouteProfile {
  requires_fifo: boolean;
  requires_ai_photo: boolean;
  requires_price_ocr: boolean;
  requires_tasting: boolean;
  requires_rupture_detail: boolean;
  complexity_factor: number;
}

/**
 * Calculates the expected visit duration (in minutes) for a PDV based on its monthly faturamento
 * and task requirements defined in its route profile.
 */
export async function calculateVisitDuration(pdvId: string): Promise<number> {
  const supabase = createAdminClient();

  // 1. Fetch faturamento from base_atendimento
  const { data: pdvData } = await supabase
    .from("base_atendimento")
    .select("faturamento_mensal")
    .eq("cod_parceiro", pdvId)
    .maybeSingle();

  const faturamento = pdvData?.faturamento_mensal ? Number(pdvData.faturamento_mensal) : 0;

  // 2. Fetch matched SLA rule
  const { data: slaRules } = await supabase
    .from("cm_visit_sla_rules")
    .select("base_visit_minutes")
    .lte("faturamento_min", faturamento)
    .gte("faturamento_max", faturamento)
    .order("base_visit_minutes", { ascending: false });

  let baseMinutes = 30; // default fallback
  if (slaRules && slaRules.length > 0) {
    baseMinutes = slaRules[0].base_visit_minutes;
  } else {
    // If no rule matches via range, query all rules and match manually
    const { data: allRules } = await supabase
      .from("cm_visit_sla_rules")
      .select("faturamento_min, faturamento_max, base_visit_minutes");
    
    if (allRules) {
      const match = allRules.find(r => faturamento >= Number(r.faturamento_min) && faturamento <= Number(r.faturamento_max));
      if (match) {
        baseMinutes = match.base_visit_minutes;
      }
    }
  }

  // 3. Fetch route profile
  const { data: profile } = await supabase
    .from("cm_pdv_route_profile")
    .select("*")
    .eq("pdv_id", pdvId)
    .maybeSingle();

  const activeProfile: RouteProfile = {
    requires_fifo: profile?.requires_fifo ?? false,
    requires_ai_photo: profile?.requires_ai_photo ?? true,
    requires_price_ocr: profile?.requires_price_ocr ?? true,
    requires_tasting: profile?.requires_tasting ?? false,
    requires_rupture_detail: profile?.requires_rupture_detail ?? false,
    complexity_factor: profile?.complexity_factor ? Number(profile.complexity_factor) : 1.0,
  };

  // 4. Calculate extra execution times (weights)
  let extraTime = 0;
  if (activeProfile.requires_fifo) extraTime += 10;
  if (activeProfile.requires_ai_photo) extraTime += 5;
  if (activeProfile.requires_price_ocr) extraTime += 5;
  if (activeProfile.requires_rupture_detail) extraTime += 8;
  if (activeProfile.requires_tasting) extraTime += 20;

  // Formula: total = (base * complexity) + extra
  const totalDuration = Math.round((baseMinutes * activeProfile.complexity_factor) + extraTime);
  return totalDuration;
}

/**
 * Calculates the capacity of a promoter (how many PDVs they can visit per day)
 * using their workday schedule, lunch break, and average visit duration of their wallet.
 */
export async function calculatePromoterCapacity(promotorId: string): Promise<{
  capacity: number;
  total_useful_minutes: number;
  avg_visit_minutes: number;
}> {
  const supabase = createAdminClient();

  // 1. Determine day of week (1: Monday, 7: Sunday)
  let dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0) dayOfWeek = 7; // Sunday maps to 7 in db

  // 2. Fetch escala
  const { data: escala } = await supabase
    .from("cm_promotor_escala")
    .select("hora_entrada, hora_saida, hora_saida_intervalo, hora_retorno_intervalo")
    .eq("employee_id", promotorId)
    .eq("dia_semana", dayOfWeek)
    .maybeSingle();

  let totalWorkingMinutes = 528; // default: 8.8h (e.g. 08:00 to 17:48)
  let lunchMinutes = 60; // default: 1h

  if (escala) {
    const parseTimeToMinutes = (tStr: string) => {
      const parts = tStr.split(":");
      return Number(parts[0]) * 60 + Number(parts[1]);
    };

    try {
      const entrada = parseTimeToMinutes(escala.hora_entrada);
      const saida = parseTimeToMinutes(escala.hora_saida);
      totalWorkingMinutes = saida - entrada;

      if (escala.hora_saida_intervalo && escala.hora_retorno_intervalo) {
        const saidaInt = parseTimeToMinutes(escala.hora_saida_intervalo);
        const retornoInt = parseTimeToMinutes(escala.hora_retorno_intervalo);
        lunchMinutes = retornoInt - saidaInt;
      }
    } catch (e) {
      console.error("[CAPACITY ENGINE] Error parsing scale hours", e);
    }
  }

  // useful = total - lunch - 90 mins (estimated travel time)
  const usefulMinutes = Math.max(0, totalWorkingMinutes - lunchMinutes - 90);

  // 3. Fetch promoter's wallet (carteira)
  const { data: wallet } = await supabase
    .from("cm_promotor_carteira_pdv")
    .select("cod_parceiro")
    .eq("promotor_id", promotorId);

  let avgVisitMinutes = 60; // default fallback

  if (wallet && wallet.length > 0) {
    let totalVisitMinutes = 0;
    for (const item of wallet) {
      totalVisitMinutes += await calculateVisitDuration(item.cod_parceiro);
    }
    avgVisitMinutes = totalVisitMinutes / wallet.length;
  }

  const capacity = avgVisitMinutes > 0 ? (usefulMinutes / avgVisitMinutes) : 0;
  return {
    capacity: parseFloat(capacity.toFixed(1)),
    total_useful_minutes: usefulMinutes,
    avg_visit_minutes: parseFloat(avgVisitMinutes.toFixed(1)),
  };
}

/**
 * Calculates the commercial visit priority score (0-100) for a PDV,
 * taking into account faturamento, purchase inactivity, sell-in drops, shelf share, and sell-out velocity.
 */
export async function calculateCommercialVisitPriorityScore(pdvId: string): Promise<{
  score: number;
  priorityClass: "CRÍTICO" | "ALTO" | "MÉDIO" | "BAIXO";
  reasons: string[];
}> {
  const supabase = createAdminClient();
  const reasons: string[] = [];

  // 1. Fetch PDV faturamento and cluster
  const { data: pdv } = await supabase
    .from("base_atendimento")
    .select("faturamento_mensal, cluster_canal")
    .eq("cod_parceiro", pdvId)
    .maybeSingle();

  const faturamento = pdv?.faturamento_mensal ? Number(pdv.faturamento_mensal) : 0;

  // 2. Variable 1: Purchase Inactivity (max 30 pts)
  // Fetch latest order date from sales (union of sales_v2 and cm_faturamento_sankhya)
  const { data: latestSale } = await supabase
    .from("sales")
    .select("invoice_date")
    .eq("cod_parceiro", pdvId)
    .order("invoice_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let daysSinceLast = 45; // default fallback if never bought
  if (latestSale?.invoice_date) {
    const saleDate = new Date(latestSale.invoice_date);
    const diffTime = Math.abs(Date.now() - saleDate.getTime());
    daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    reasons.push(`Última compra realizada há ${daysSinceLast} dias (em ${latestSale.invoice_date.split("-").reverse().join("/")}).`);
  } else {
    reasons.push("Nenhuma compra registrada nos históricos.");
  }

  let inactivityPts = 0;
  if (daysSinceLast > 30) {
    inactivityPts = 30;
  } else if (daysSinceLast >= 15) {
    inactivityPts = 20;
  } else if (daysSinceLast >= 7) {
    inactivityPts = 10;
  }

  // 3. Variable 2: Rupture Risk (max 25 pts)
  const { data: shelfAnalysis } = await supabase
    .from("cm_ai_shelf_analysis")
    .select("planogram_score, needs_manual_review")
    .eq("pdv_id", pdvId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let rupturePts = 10; // neutral default
  if (shelfAnalysis) {
    const score = shelfAnalysis.planogram_score ? Number(shelfAnalysis.planogram_score) : 100;
    if (score < 70) {
      rupturePts = 25;
      reasons.push(`Score de conformidade de gôndola crítico: ${score}% (alto risco de ruptura).`);
    } else if (score < 85) {
      rupturePts = 15;
      reasons.push(`Score de conformidade de gôndola moderado: ${score}%.`);
    } else {
      rupturePts = 0;
    }
  } else {
    reasons.push("Nenhuma auditoria de gôndola realizada recentemente.");
  }

  // 4. Variable 3: Sell-in Drop (max 20 pts)
  // Calculate sales in last 30 days vs previous 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: salesLast30 } = await supabase
    .from("sales")
    .select("net_value")
    .eq("cod_parceiro", pdvId)
    .gte("invoice_date", thirtyDaysAgo);

  const { data: salesPrev30 } = await supabase
    .from("sales")
    .select("net_value")
    .eq("cod_parceiro", pdvId)
    .gte("invoice_date", sixtyDaysAgo)
    .lt("invoice_date", thirtyDaysAgo);

  const sumLast = salesLast30?.reduce((acc, s) => acc + Number(s.net_value || 0), 0) || 0;
  const sumPrev = salesPrev30?.reduce((acc, s) => acc + Number(s.net_value || 0), 0) || 0;

  let sellInPts = 0;
  if (sumPrev > 0) {
    const dropPercent = ((sumPrev - sumLast) / sumPrev) * 100;
    if (dropPercent > 20) {
      sellInPts = 20;
      reasons.push(`Queda expressiva de sell-in no PDV: -${dropPercent.toFixed(1)}% nos últimos 30 dias.`);
    } else if (dropPercent > 5) {
      sellInPts = 10;
      reasons.push(`Queda moderada de sell-in no PDV: -${dropPercent.toFixed(1)}% nos últimos 30 dias.`);
    }
  }

  // 5. Variable 4: Revenue Level (max 15 pts)
  let revenuePts = 0;
  if (faturamento > 100000) {
    revenuePts = 15;
  } else if (faturamento >= 50000) {
    revenuePts = 10;
  } else if (faturamento >= 20000) {
    revenuePts = 5;
  }

  // 6. Variable 5: Pricing Opportunity (max 10 pts)
  const { data: priceAnalysis } = await supabase
    .from("cm_ai_price_analysis")
    .select("commercial_opportunity")
    .eq("ocr_status", "DONE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let pricePts = 0;
  if (priceAnalysis?.commercial_opportunity) {
    const opp = priceAnalysis.commercial_opportunity;
    if (opp === "CRITICAL") {
      pricePts = 10;
      reasons.push("Oportunidade crítica de precificação (Coffee Mais muito caro + ruptura + promo concorrente).");
    } else if (opp === "DEFENSIVE") {
      pricePts = 7;
      reasons.push("Estratégia defensiva: Concorrente direto está em promoção agressiva.");
    } else if (opp === "EXPANSION") {
      pricePts = 5;
      reasons.push("Oportunidade de expansão de margem/espaço (shelf share < 35%).");
    } else if (opp === "OFFENSIVE") {
      pricePts = 2;
    }
  }

  // 7. Refinement: Sell-out Velocity and Depletion Risk (max 20 pts)
  // Calculate average daily quantity sold in last 90 days (sell-out velocity)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: salesLast90 } = await supabase
    .from("sales")
    .select("quantity")
    .eq("cod_parceiro", pdvId)
    .gte("invoice_date", ninetyDaysAgo);

  const totalQtyLast90 = salesLast90?.reduce((acc, s) => acc + Number(s.quantity || 0), 0) || 0;
  const sellOutVelocity = totalQtyLast90 / 90.0; // boxes per day
  const depletionRisk = daysSinceLast * sellOutVelocity;

  let sellOutPts = 0;
  if (depletionRisk > 100) {
    sellOutPts = 20;
    reasons.push(`Alto risco de desabastecimento: Depleção estimada de ${depletionRisk.toFixed(1)} caixas.`);
  } else if (depletionRisk >= 50) {
    sellOutPts = 15;
    reasons.push(`Risco moderado de desabastecimento: Depleção estimada de ${depletionRisk.toFixed(1)} caixas.`);
  } else if (depletionRisk >= 20) {
    sellOutPts = 10;
    reasons.push(`Leve risco de desabastecimento: Depleção estimada de ${depletionRisk.toFixed(1)} caixas.`);
  } else if (depletionRisk >= 5) {
    sellOutPts = 5;
  }

  // 8. Consolidated Score and Classification
  const score = Math.max(0, Math.min(100, inactivityPts + rupturePts + sellInPts + revenuePts + pricePts + sellOutPts));
  
  let priorityClass: "CRÍTICO" | "ALTO" | "MÉDIO" | "BAIXO" = "BAIXO";
  if (score >= 80) {
    priorityClass = "CRÍTICO";
  } else if (score >= 60) {
    priorityClass = "ALTO";
  } else if (score >= 40) {
    priorityClass = "MÉDIO";
  }

  // 9. Cache / Save priority score and class in public.cm_pdv_route_profile
  await supabase
    .from("cm_pdv_route_profile")
    .upsert({
      pdv_id: pdvId,
      commercial_visit_priority_score: score,
      commercial_visit_priority_class: priorityClass,
      updated_at: new Date().toISOString()
    }, { onConflict: "pdv_id" });

  return {
    score,
    priorityClass,
    reasons: reasons.filter(Boolean),
  };
}
