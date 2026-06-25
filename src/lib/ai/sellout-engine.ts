import { createAdminClient } from "@/lib/supabase/admin";

export interface SkuSelloutResult {
  sku: string;
  estimated_stock_boxes: number;
  sellout_velocity: number;
  days_of_inventory: number;
  stock_risk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  slow_mover: boolean;
  dead_stock: boolean;
  suggested_order_boxes: number;
}

/**
 * Calculates the sell-out velocity, days of inventory, and suggested order for all SKUs of a PDV,
 * dispatches alerts, and persists the analysis results.
 */
export async function processPDVSellout(pdvId: string): Promise<SkuSelloutResult[]> {
  const supabase = createAdminClient();

  // 1. Fetch expected SKUs from the PDV's planogram
  const { data: planogramItems } = await supabase
    .from("cm_pdv_planograma")
    .select("sku")
    .eq("pdv_id", pdvId);

  let skus = planogramItems?.map(item => item.sku) || [];

  // Fallback to all Coffee Mais SKUs if no planogram is defined
  if (skus.length === 0) {
    const { data: refs } = await supabase
      .from("cm_ai_product_reference")
      .select("sku")
      .eq("brand", "Coffee Mais");
    skus = refs?.map(r => r.sku) || [];
  }

  // 2. Fetch the latest shelf analysis to estimate current stock
  const { data: latestAnalysis } = await supabase
    .from("cm_ai_shelf_analysis")
    .select("detected_products, created_at")
    .eq("analysis_status", "DONE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const detectedProducts = (latestAnalysis?.detected_products as any[]) || [];

  // 3. Recalculate each SKU
  const results: SkuSelloutResult[] = [];

  for (const sku of skus) {
    // 3.1. Fetch last order details from sales
    const { data: lastSales } = await supabase
      .from("sales")
      .select("invoice_date, quantity")
      .eq("cod_parceiro", pdvId)
      .eq("cod_produto", sku)
      .order("invoice_date", { ascending: false })
      .limit(1);

    const hasSale = lastSales && lastSales.length > 0;
    const lastInvoiceDate = hasSale ? lastSales[0].invoice_date : null;
    const lastOrderQty = hasSale ? Number(lastSales[0].quantity || 0) : 0;

    let daysSinceLast = 45; // Default fallback if never bought
    if (lastInvoiceDate) {
      const saleDate = new Date(lastInvoiceDate);
      const diffTime = Math.abs(Date.now() - saleDate.getTime());
      daysSinceLast = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }

    // 3.2. Get estimated stock from shelf analysis
    const detectedItem = detectedProducts.find(p => p.sku === sku);
    // Estimated stock is based on detected facings (each facing is assumed to correspond to 2 boxes in storage/shelf, or directly as facings quantity)
    // To match the formula in the prompt (Comprou 20, Restam 8, Velocity 1.2), we assume detected facings represents boxes.
    const estimatedStock = detectedItem ? Number(detectedItem.facings || detectedItem.detected_facings || 0) : 0.0;

    // 3.3. Calculate sell-out velocity
    // Formula: sellout_velocity = (caixas compradas - estoque atual estimado) / dias desde último pedido
    let selloutVelocity = 0.0;
    if (hasSale && daysSinceLast > 0) {
      selloutVelocity = Math.max(0, (lastOrderQty - estimatedStock) / daysSinceLast);
    }
    selloutVelocity = parseFloat(selloutVelocity.toFixed(2));

    // 3.4. Calculate days of inventory
    // Formula: days_of_inventory = estimated_stock_boxes / sellout_velocity
    let daysOfInventory = 999.0;
    if (selloutVelocity > 0) {
      daysOfInventory = parseFloat((estimatedStock / selloutVelocity).toFixed(1));
    }

    // 3.5. Risk Classification
    let stockRisk: SkuSelloutResult["stock_risk"] = "LOW";
    if (daysOfInventory < 3) {
      stockRisk = "CRITICAL";
    } else if (daysOfInventory < 7) {
      stockRisk = "HIGH";
    } else if (daysOfInventory <= 15) {
      stockRisk = "MEDIUM";
    }

    // 3.6. Suggested Order Engine (Objective: maintain 14 days of coverage)
    // Formula: suggested_order_boxes = max(0, (sellout_velocity * 14) - estimated_stock_boxes)
    const suggestedOrderBoxes = Math.max(0, Math.round((selloutVelocity * 14) - estimatedStock));

    // 3.7. Slow Mover and Dead Stock detection (placeholder first, filled in step 4)
    results.push({
      sku,
      estimated_stock_boxes: estimatedStock,
      sellout_velocity: selloutVelocity,
      days_of_inventory: daysOfInventory,
      stock_risk: stockRisk,
      slow_mover: false,
      dead_stock: false,
      suggested_order_boxes: suggestedOrderBoxes
    });
  }

  // 4. Category-wide comparison for Slow Mover detection
  // Get product categories
  const { data: productRefs } = await supabase
    .from("cm_ai_product_reference")
    .select("sku, category, product_name");

  const categoryMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  productRefs?.forEach(ref => {
    categoryMap.set(ref.sku, ref.category || "Café Moído");
    nameMap.set(ref.sku, ref.product_name);
  });

  // Calculate average category velocity across the network
  const { data: allAnalyses } = await supabase
    .from("cm_sellout_analysis")
    .select("sku, sellout_velocity");

  const categoryVelocities: Record<string, number[]> = {};
  allAnalyses?.forEach(a => {
    const cat = categoryMap.get(a.sku) || "Café Moído";
    if (!categoryVelocities[cat]) categoryVelocities[cat] = [];
    categoryVelocities[cat].push(Number(a.sellout_velocity || 0));
  });

  const categoryAverages: Record<string, number> = {};
  Object.entries(categoryVelocities).forEach(([cat, vels]) => {
    categoryAverages[cat] = vels.reduce((sum, v) => sum + v, 0) / vels.length;
  });

  // Fetch sales for dead stock check
  const { data: allSales } = await supabase
    .from("sales")
    .select("cod_produto, invoice_date")
    .eq("cod_parceiro", pdvId);

  for (const res of results) {
    const cat = categoryMap.get(res.sku) || "Café Moído";
    const catAvg = categoryAverages[cat] || 1.0; // Fallback to 1.0 if no history
    
    // Slow mover if: velocity < 40% of category average
    res.slow_mover = res.sellout_velocity < (catAvg * 0.40);

    // Dead Stock check: no sales in 30+ days OR velocity ~ zero (where they have stock)
    const skuSales = allSales?.filter(s => s.cod_produto === res.sku) || [];
    const hasRecentSale = skuSales.some(s => {
      const diff = Date.now() - new Date(s.invoice_date).getTime();
      return diff < 30 * 24 * 60 * 60 * 1000;
    });

    res.dead_stock = !hasRecentSale || (res.sellout_velocity <= 0.05 && res.estimated_stock_boxes > 0);

    // 5. Persist calculated analysis
    await supabase
      .from("cm_sellout_analysis")
      .upsert({
        pdv_id: pdvId,
        sku: res.sku,
        estimated_stock_boxes: res.estimated_stock_boxes,
        sellout_velocity: res.sellout_velocity,
        days_of_inventory: res.days_of_inventory,
        stock_risk: res.stock_risk,
        slow_mover: res.slow_mover,
        dead_stock: res.dead_stock,
        suggested_order_boxes: res.suggested_order_boxes,
        updated_at: new Date().toISOString()
      }, { onConflict: "pdv_id,sku" });

    // 6. Generate Alerts
    const prodName = nameMap.get(res.sku) || res.sku;

    // Helper to replace unresolved alerts of a certain type
    const replaceAlert = async (alertType: string, description: string, condition: boolean) => {
      await supabase
        .from("cm_sellout_alert")
        .delete()
        .eq("pdv_id", pdvId)
        .eq("sku", res.sku)
        .eq("alert_type", alertType)
        .eq("is_resolved", false);

      if (condition) {
        await supabase.from("cm_sellout_alert").insert({
          pdv_id: pdvId,
          sku: res.sku,
          alert_type: alertType,
          description,
          is_resolved: false
        });
      }
    };

    // Alert 1: RUPTURE_RISK (coverage < 3 days)
    await replaceAlert(
      "RUPTURE_RISK",
      `Risco crítico de ruptura para ${prodName}: estoque estimado de ${res.estimated_stock_boxes} caixas cobrirá apenas ${res.days_of_inventory} dias.`,
      res.stock_risk === "CRITICAL"
    );

    // Alert 2: SLOW_MOVER (velocity < 40% category avg)
    await replaceAlert(
      "SLOW_MOVER",
      `Giro do produto ${prodName} está muito baixo (${res.sellout_velocity} cx/dia vs média da categoria ${catAvg.toFixed(2)} cx/dia).`,
      res.slow_mover
    );

    // Alert 3: DEAD_STOCK (no sales 30+ days)
    await replaceAlert(
      "DEAD_STOCK",
      `Estoque sem vendas há 30+ dias para ${prodName}. Estoque estimado: ${res.estimated_stock_boxes} caixas.`,
      res.dead_stock
    );

    // Alert 4: OVERSTOCK (coverage > 45 days)
    await replaceAlert(
      "OVERSTOCK",
      `Excesso de estoque para ${prodName}: cobertura estimada de ${res.days_of_inventory} dias supera a meta ideal.`,
      res.days_of_inventory > 45.0 && res.sellout_velocity > 0
    );
  }

  return results;
}
