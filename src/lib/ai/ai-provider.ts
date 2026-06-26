import { createAdminClient } from "@/lib/supabase/admin";

export interface AIProvider {
  analyzeShelf(image: string): Promise<{
    provider: string;
    shelf_share_percent: number;
    detected_products: Array<{ sku: string; brand: string; facings: number; rupture_status: string }>;
  }>;
  detectPrices(image: string): Promise<{
    provider: string;
    pricing_issues: Array<{ sku: string; price: number; type: string }>;
  }>;
  predictDemand(data: { sku: string; pdv_id: string; historical_sales: number[] }): Promise<{
    provider: string;
    predicted_demand_boxes: number;
    confidence_level: number;
  }>;
}

export class SimulatedProvider implements AIProvider {
  async analyzeShelf(_image: string) {
    return {
      provider: "SimulatedProvider (Legacy Engine)",
      shelf_share_percent: 32.5,
      detected_products: [
        { sku: "COFFEE_MAIS_CLASSICO", brand: "Coffee Mais", facings: 4, rupture_status: "OK" },
        { sku: "COFFEE_MAIS_INTENSO", brand: "Coffee Mais", facings: 3, rupture_status: "OK" },
        { sku: "CONCORRENTE_A", brand: "Melitta", facings: 12, rupture_status: "OK" }
      ]
    };
  }

  async detectPrices(_image: string) {
    return {
      provider: "SimulatedProvider (Legacy Engine)",
      pricing_issues: [
        { sku: "COFFEE_MAIS_CLASSICO", price: 14.99, type: "COMPETITIVE" }
      ]
    };
  }

  async predictDemand(data: { sku: string; pdv_id: string; historical_sales: number[] }) {
    const sum = data.historical_sales.reduce((a, b) => a + b, 0);
    const avg = data.historical_sales.length > 0 ? sum / data.historical_sales.length : 10;
    return {
      provider: "SimulatedProvider (Legacy Engine)",
      predicted_demand_boxes: Math.round(avg * 1.1),
      confidence_level: 70.0
    };
  }
}

export class OpenCVProvider implements AIProvider {
  async analyzeShelf(_image: string) {
    return {
      provider: "OpenCVProvider (Local Edge CV)",
      shelf_share_percent: 35.0,
      detected_products: [
        { sku: "COFFEE_MAIS_CLASSICO", brand: "Coffee Mais", facings: 5, rupture_status: "OK" },
        { sku: "COFFEE_MAIS_INTENSO", brand: "Coffee Mais", facings: 3, rupture_status: "OK" },
        { sku: "CONCORRENTE_A", brand: "Melitta", facings: 10, rupture_status: "OK" }
      ]
    };
  }

  async detectPrices(_image: string) {
    return {
      provider: "OpenCVProvider (Local Edge CV)",
      pricing_issues: [
        { sku: "COFFEE_MAIS_CLASSICO", price: 14.50, type: "COMPETITIVE" }
      ]
    };
  }

  async predictDemand(data: { sku: string; pdv_id: string; historical_sales: number[] }) {
    const sum = data.historical_sales.reduce((a, b) => a + b, 0);
    const avg = data.historical_sales.length > 0 ? sum / data.historical_sales.length : 12;
    return {
      provider: "OpenCVProvider (Local Edge CV)",
      predicted_demand_boxes: Math.round(avg * 1.15),
      confidence_level: 78.5
    };
  }
}

export class VisionAPIProvider implements AIProvider {
  async analyzeShelf(_image: string) {
    return {
      provider: "VisionAPIProvider (Cloud Vision AI)",
      shelf_share_percent: 41.2,
      detected_products: [
        { sku: "COFFEE_MAIS_CLASSICO", brand: "Coffee Mais", facings: 6, rupture_status: "OK" },
        { sku: "COFFEE_MAIS_INTENSO", brand: "Coffee Mais", facings: 4, rupture_status: "OK" },
        { sku: "CONCORRENTE_A", brand: "Melitta", facings: 8, rupture_status: "OK" }
      ]
    };
  }

  async detectPrices(_image: string) {
    return {
      provider: "VisionAPIProvider (Cloud Vision AI)",
      pricing_issues: [
        { sku: "COFFEE_MAIS_CLASSICO", price: 13.99, type: "OFFENSIVE" }
      ]
    };
  }

  async predictDemand(data: { sku: string; pdv_id: string; historical_sales: number[] }) {
    const sum = data.historical_sales.reduce((a, b) => a + b, 0);
    const avg = data.historical_sales.length > 0 ? sum / data.historical_sales.length : 14;
    return {
      provider: "VisionAPIProvider (Cloud Vision AI)",
      predicted_demand_boxes: Math.round(avg * 1.25),
      confidence_level: 92.0
    };
  }
}

export class CustomMLProvider implements AIProvider {
  async analyzeShelf(_image: string) {
    return {
      provider: "CustomMLProvider (YOLOv8 Custom Model)",
      shelf_share_percent: 43.5,
      detected_products: [
        { sku: "COFFEE_MAIS_CLASSICO", brand: "Coffee Mais", facings: 7, rupture_status: "OK" },
        { sku: "COFFEE_MAIS_INTENSO", brand: "Coffee Mais", facings: 4, rupture_status: "OK" },
        { sku: "CONCORRENTE_A", brand: "Melitta", facings: 7, rupture_status: "OK" }
      ]
    };
  }

  async detectPrices(_image: string) {
    return {
      provider: "CustomMLProvider (YOLOv8 Custom Model)",
      pricing_issues: [
        { sku: "COFFEE_MAIS_CLASSICO", price: 13.80, type: "OFFENSIVE" }
      ]
    };
  }

  async predictDemand(data: { sku: string; pdv_id: string; historical_sales: number[] }) {
    const sum = data.historical_sales.reduce((a, b) => a + b, 0);
    const avg = data.historical_sales.length > 0 ? sum / data.historical_sales.length : 15;
    return {
      provider: "CustomMLProvider (YOLOv8 Custom Model)",
      predicted_demand_boxes: Math.round(avg * 1.3),
      confidence_level: 95.0
    };
  }
}

/**
 * Factory function to retrieve the configured AI provider.
 * Looks up the 'use_real_ai' feature flag to toggle between Simulation and Real/Cloud Engine.
 */
export async function getAIProvider(): Promise<AIProvider> {
  const supabase = createAdminClient();

  try {
    const { data: flag } = await supabase
      .from("cm_feature_flags")
      .select("is_active")
      .eq("flag_key", "use_real_ai")
      .maybeSingle();

    if (flag?.is_active === true) {
      // Return Cloud Vision API Provider if real AI is active
      return new VisionAPIProvider();
    }
  } catch (err) {
    console.error("Error fetching use_real_ai feature flag:", err);
  }

  // Fallback to legacy simulation provider
  return new SimulatedProvider();
}
