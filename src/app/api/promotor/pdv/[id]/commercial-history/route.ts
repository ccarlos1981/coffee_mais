import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCommercialVisitPriorityScore } from "@/lib/ai/route-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SKUItem {
  sku: string;
  product_name: string;
  quantity: number;
  avg_historical?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pdvId } = await params;
    if (!pdvId) {
      return NextResponse.json({ success: false, error: "Código do PDV é obrigatório." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch faturamento & canal info
    const { data: pdv } = await supabase
      .from("base_atendimento")
      .select("nome_fantasia, faturamento_mensal, canal, cluster_canal")
      .eq("cod_parceiro", pdvId)
      .maybeSingle();

    if (!pdv) {
      return NextResponse.json({ success: false, error: "PDV não encontrado." }, { status: 404 });
    }

    // 2. Fetch all sales for this customer
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("invoice_date, cod_produto, product, quantity, net_value")
      .eq("cod_parceiro", pdvId)
      .order("invoice_date", { ascending: false });

    if (salesError) throw salesError;

    if (!sales || sales.length === 0) {
      // Fallback empty commercial context
      return NextResponse.json({
        success: true,
        data: {
          pdv_name: pdv.nome_fantasia,
          ultimo_pedido_data: null,
          ultimo_pedido_dias: null,
          ultimo_pedido_valor: 0,
          ultimo_pedido_itens: [],
          frequencia_media_compra_dias: 30,
          sell_in_90_dias: 0,
          tendencia: "ESTÁVEL",
          tendencia_percentual: 0,
          insights: ["Nenhum histórico de compras encontrado para este PDV."],
          smart_recommendation: {
            priority_class: "BAIXO",
            score: 0,
            reasons: ["Sem histórico de vendas."],
            suggested_action: "Oferecer portfólio de produtos padrão e iniciar relacionamento comercial.",
            suggested_order: []
          }
        }
      });
    }

    // 3. Last Purchase Details
    const uniqueDates = Array.from(new Set(sales.map(s => s.invoice_date))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const lastOrderDateStr = uniqueDates[0];
    const lastOrderSales = sales.filter(s => s.invoice_date === lastOrderDateStr);
    
    const lastOrderDate = new Date(lastOrderDateStr);
    const diffTime = Math.abs(Date.now() - lastOrderDate.getTime());
    const lastOrderDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const lastOrderValue = lastOrderSales.reduce((acc, s) => acc + Number(s.net_value || 0), 0);

    // Group last order items by SKU/product
    const lastOrderItemsMap = new Map<string, { sku: string; name: string; qty: number }>();
    lastOrderSales.forEach(s => {
      const sku = s.cod_produto || "UNKNOWN";
      const name = s.product || "Produto Desconhecido";
      const qty = Number(s.quantity || 0);
      if (lastOrderItemsMap.has(sku)) {
        lastOrderItemsMap.get(sku)!.qty += qty;
      } else {
        lastOrderItemsMap.set(sku, { sku, name, qty });
      }
    });
    const lastOrderItems = Array.from(lastOrderItemsMap.values());

    // 4. Calculate Expected Purchase Frequency
    let avgFreqDays = 30;
    if (uniqueDates.length >= 2) {
      // Sort dates ascendingly for intervals
      const datesAsc = [...uniqueDates].reverse();
      let totalDiff = 0;
      for (let i = 0; i < datesAsc.length - 1; i++) {
        const d1 = new Date(datesAsc[i]).getTime();
        const d2 = new Date(datesAsc[i + 1]).getTime();
        totalDiff += (d2 - d1) / (1000 * 60 * 60 * 24);
      }
      avgFreqDays = Math.round(totalDiff / (datesAsc.length - 1));
    }

    // 5. Calculate Historical Average per SKU (distinct order dates containing the SKU)
    const skuOrdersCountMap = new Map<string, Set<string>>(); // sku -> Set of invoice_dates
    const skuTotalQtyMap = new Map<string, number>(); // sku -> total quantity
    const skuNameMap = new Map<string, string>();

    sales.forEach(s => {
      const sku = s.cod_produto || "UNKNOWN";
      skuNameMap.set(sku, s.product || "Produto Desconhecido");
      if (!skuOrdersCountMap.has(sku)) {
        skuOrdersCountMap.set(sku, new Set<string>());
      }
      skuOrdersCountMap.get(sku)!.add(s.invoice_date);
      skuTotalQtyMap.set(sku, (skuTotalQtyMap.get(sku) || 0) + Number(s.quantity || 0));
    });

    const avgBoxesPerOrderPerSku: Record<string, number> = {};
    skuTotalQtyMap.forEach((qty, sku) => {
      const ordersCount = skuOrdersCountMap.get(sku)?.size || 1;
      avgBoxesPerOrderPerSku[sku] = parseFloat((qty / ordersCount).toFixed(1));
    });

    // 6. Sell-in 90 Days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const sales90 = sales.filter(s => s.invoice_date >= ninetyDaysAgo);
    const sellIn90 = sales90.reduce((acc, s) => acc + Number(s.net_value || 0), 0);

    // 7. Trend (Last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const sum30 = sales.filter(s => s.invoice_date >= thirtyDaysAgo).reduce((acc, s) => acc + Number(s.net_value || 0), 0);
    const sumPrev30 = sales.filter(s => s.invoice_date >= sixtyDaysAgo && s.invoice_date < thirtyDaysAgo).reduce((acc, s) => acc + Number(s.net_value || 0), 0);

    let trend = "ESTÁVEL";
    let trendPercent = 0;
    if (sumPrev30 > 0) {
      trendPercent = Math.round(((sum30 - sumPrev30) / sumPrev30) * 100);
      if (trendPercent > 5) trend = "ALTA";
      else if (trendPercent < -5) trend = "QUEDA";
    }

    // 8. Priority score & reasons
    const scoreResult = await calculateCommercialVisitPriorityScore(pdvId);

    // 9. Smart Recommendations
    let suggestedAction = "Manter rotina padrão de reposição e arrumação de gôndolas.";
    const hasRupture = scoreResult.reasons.some(r => r.includes("ruptura"));
    const hasDrop = scoreResult.reasons.some(r => r.includes("Queda"));
    
    if (scoreResult.priorityClass === "CRÍTICO") {
      suggestedAction = hasRupture
        ? "Foco imediato no reabastecimento. Abastecer gôndolas e negociar pedido emergencial para os SKUs em ruptura."
        : "Reunião com gerente do PDV para alinhar queda brusca de vendas e propor encarte ou ativação promocional.";
    } else if (scoreResult.priorityClass === "ALTO") {
      suggestedAction = "Apresentar portfólio completo de moídos/grãos e reforçar margem contra concorrência.";
    } else if (scoreResult.priorityClass === "MÉDIO") {
      suggestedAction = hasDrop
        ? "Propor aumento no volume de compras dos SKUs Clássico e Intenso para recuperar volume de vendas."
        : "Alinhar posicionamento de preços na gôndola e aplicar material FIFO nas prateleiras.";
    }

    // Calculate suggested order quantity in boxes per SKU
    const suggestedOrder: { sku: string; name: string; suggested_qty: number; avg_historical: number }[] = [];
    skuTotalQtyMap.forEach((_, sku) => {
      const avgHist = avgBoxesPerOrderPerSku[sku] || 0;
      const lastItem = lastOrderItems.find(item => item.sku === sku);
      const lastQty = lastItem ? lastItem.qty : 0;

      let suggestedQty = 0;
      if (lastOrderDays > 25) {
        // Bought a long time ago, suggest full historical average
        suggestedQty = Math.ceil(avgHist);
      } else if (lastQty < avgHist * 0.8) {
        // Last purchase was below average, suggest replenishment to average + 20%
        suggestedQty = Math.ceil(avgHist * 1.2 - lastQty);
      } else {
        // Bought recently and in sufficient volume, suggest small safety stock
        suggestedQty = Math.max(0, Math.ceil(avgHist * 0.3));
      }

      if (suggestedQty > 0) {
        suggestedOrder.push({
          sku,
          name: skuNameMap.get(sku) || sku,
          suggested_qty: suggestedQty,
          avg_historical: avgHist
        });
      }
    });

    // 10. Sell-out Velocity details and insights
    const totalQtyLast90 = sales90.reduce((acc, s) => acc + Number(s.quantity || 0), 0);
    const sellOutVelocity = totalQtyLast90 / 90.0;
    const insights: string[] = [];

    // Generate smart insights
    if (lastOrderDays > avgFreqDays * 1.5) {
      insights.push(`Alerta: PDV está sem comprar há ${lastOrderDays} dias, superando a frequência média de ${avgFreqDays} dias.`);
    }
    
    // Check specific SKU gaps
    skuOrdersCountMap.forEach((dates, sku) => {
      const sortedDates = Array.from(dates).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
      if (sortedDates.length > 0) {
        const lastSkuDate = new Date(sortedDates[0]);
        const diffSkuDays = Math.floor(Math.abs(Date.now() - lastSkuDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffSkuDays > 21) {
          const skuName = skuNameMap.get(sku) || sku;
          const cleanSkuName = skuName.replace("Café Coffee Mais", "").replace("Moído 250g", "").trim();
          insights.push(`Oportunidade: PDV está há ${diffSkuDays} dias sem comprar o SKU ${cleanSkuName}.`);
        }
      }
    });

    if (sellOutVelocity > 0 && lastOrderDays * sellOutVelocity > 40) {
      insights.push(`Risco de ruptura iminente: Giro diário estimado em ${sellOutVelocity.toFixed(1)} caixas/dia.`);
    }
    if (trend === "QUEDA") {
      insights.push(`Atenção: Queda de volume geral identificada nas últimas semanas (${trendPercent}% vs anterior).`);
    } else if (trend === "ALTA") {
      insights.push(`Destaque: Crescimento de sell-in acelerado (+${trendPercent}%). Ponto de recompra ideal.`);
    }

    if (insights.length === 0) {
      insights.push("PDV com padrão de compras regular e estável.");
    }

    // Attach avg_historical to lastOrderItems for UI comparison
    const lastOrderItemsWithAvg = lastOrderItems.map(item => ({
      ...item,
      avg_historical: avgBoxesPerOrderPerSku[item.sku] || 0,
      avg_boxes_per_order_per_sku: avgBoxesPerOrderPerSku[item.sku] || 0
    }));

    return NextResponse.json({
      success: true,
      data: {
        pdv_name: pdv.nome_fantasia,
        ultimo_pedido_data: lastOrderDateStr,
        ultimo_pedido_dias: lastOrderDays,
        ultimo_pedido_valor: parseFloat(lastOrderValue.toFixed(2)),
        ultimo_pedido_itens: lastOrderItemsWithAvg,
        frequencia_media_compra_dias: avgFreqDays,
        sell_in_90_dias: parseFloat(sellIn90.toFixed(2)),
        tendencia: trend,
        tendencia_percentual: trendPercent,
        insights,
        smart_recommendation: {
          priority_class: scoreResult.priorityClass,
          score: scoreResult.score,
          reasons: scoreResult.reasons,
          suggested_action: suggestedAction,
          suggested_order: suggestedOrder
        }
      }
    });

  } catch (error: any) {
    console.error("[PDV COMMERCIAL HISTORY API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
