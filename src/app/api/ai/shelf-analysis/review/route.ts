import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { simulateAIShelfAnalysis } from "@/lib/ai/shelf-engine";
import { simulatePriceOCR } from "@/lib/ai/price-ocr-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const { analysis_id, action, planogram_score_override, review_reason } = await request.json();

    if (!analysis_id || !action) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes: analysis_id e action." }, { status: 400 });
    }

    if (action === "APPROVE") {
      const updatePayload: any = {
        needs_manual_review: false,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (review_reason) {
        updatePayload.review_reason = review_reason;
      }
      
      if (typeof planogram_score_override === "number") {
        updatePayload.planogram_score = Math.max(0, Math.min(100, planogram_score_override));
        updatePayload.decision_reasons = [
          `Aprovado manualmente pelo supervisor com nota sobrescrita para ${planogram_score_override}.`,
          review_reason || "Sem observações adicionais."
        ];
      } else {
        updatePayload.decision_reasons = [
          "Aprovado manualmente pelo supervisor.",
          review_reason || "Sem observações adicionais."
        ];
      }

      const { error: updateError } = await supabase
        .from("cm_ai_shelf_analysis")
        .update(updatePayload)
        .eq("id", analysis_id);

      if (updateError) {
        console.error("[REVIEW APPROVE] DB update error:", updateError);
        return NextResponse.json({ success: false, error: "Erro ao aprovar a análise de prateleira." }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Análise aprovada com sucesso." });
    }

    if (action === "REPROCESS") {
      const { data: analysis, error: selectError } = await supabase
        .from("cm_ai_shelf_analysis")
        .select(`
          *,
          visita:cm_promotor_visita(cod_parceiro)
        `)
        .eq("id", analysis_id)
        .single();

      if (selectError || !analysis) {
        console.error("[REVIEW REPROCESS] DB fetch error:", selectError);
        return NextResponse.json({ success: false, error: "Análise não encontrada." }, { status: 404 });
      }

      const visita = analysis.visita as any;
      if (!visita || !visita.cod_parceiro) {
        return NextResponse.json({ success: false, error: "Visita ou parceiro correspondente não encontrado." }, { status: 400 });
      }

      // Reprocess analysis by regenerating using the original image path as seed
      const imageMd5 = analysis.photo_url.split("/").pop() || "reprocess-seed";
      const result = await simulateAIShelfAnalysis(analysis.visita_id, visita.cod_parceiro, analysis.photo_url, imageMd5);

      // Force compliance issues or quality score to 100 on reprocess request to override manual issues
      const updatePayload = {
        analysis_status: "DONE" as const,
        detected_products: result.detected_products,
        total_facings: result.total_facings,
        coffee_mais_facings: result.coffee_mais_facings,
        shelf_share_percent: result.shelf_share_percent,
        rupture_status: result.rupture_status,
        planogram_score: result.planogram_score,
        ai_confidence: result.ai_confidence,
        quality_score: 100, 
        quality_status: "GOOD" as const,
        quality_issues: [] as string[],
        needs_manual_review: false,
        review_reason: "Reprocessado manualmente pelo supervisor.",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        planogram_version_used: result.planogram_version_used,
        annotated_image_url: result.annotated_image_url,
        decision_reasons: [
          "Análise reprocessada manualmente pelo supervisor.",
          ...result.decision_reasons
        ]
      };

      const { error: updateError } = await supabase
        .from("cm_ai_shelf_analysis")
        .update(updatePayload)
        .eq("id", analysis_id);

      if (updateError) {
        console.error("[REVIEW REPROCESS] DB update error:", updateError);
        return NextResponse.json({ success: false, error: "Erro ao atualizar a análise após reprocessamento." }, { status: 500 });
      }

      // Clear previous pricing data and pricing alerts
      await supabase.from("cm_ai_price_analysis").delete().eq("analysis_id", analysis_id);
      await supabase.from("cm_ai_pricing_alert").delete().eq("visita_id", analysis.visita_id);

      // Trigger fresh pricing OCR
      const { data: priceLog, error: priceLogErr } = await supabase
        .from("cm_ai_price_analysis")
        .insert({
          visita_id: analysis.visita_id,
          analysis_id,
          ocr_status: "PROCESSING"
        })
        .select("id")
        .single();

      if (!priceLogErr && priceLog) {
        try {
          const priceResult = await simulatePriceOCR(
            analysis.visita_id,
            analysis_id,
            result.detected_products as any,
            imageMd5
          );

          await supabase
            .from("cm_ai_price_analysis")
            .update({
              ocr_status: "DONE",
              detected_prices: priceResult.detected_prices,
              price_index: priceResult.price_index,
              price_gap_percent: priceResult.price_gap_percent,
              pricing_risk: priceResult.pricing_risk,
              sku_gap_analysis: priceResult.sku_gap_analysis,
              price_opportunity_score: priceResult.price_opportunity_score,
              ocr_confidence_score: priceResult.ocr_confidence_score,
              price_recommendation: priceResult.price_recommendation,
              reference_min_price: priceResult.reference_min_price,
              reference_target_price: priceResult.reference_target_price,
              reference_max_price: priceResult.reference_max_price,
              commercial_opportunity: priceResult.commercial_opportunity,
              commercial_opportunity_score: priceResult.commercial_opportunity_score,
              anomaly_reference_level: priceResult.anomaly_reference_level,
              anomaly_reference_sample_size: priceResult.anomaly_reference_sample_size,
              anomaly_reference_window_days: priceResult.anomaly_reference_window_days,
              had_outliers_removed: priceResult.had_outliers_removed,
              outlier_count: priceResult.outlier_count,
              outlier_values_removed: priceResult.outlier_values_removed
            })
            .eq("id", priceLog.id);

          const itemsToInsert = priceResult.detected_prices.map(item => ({
            price_analysis_id: priceLog.id,
            sku: item.sku,
            brand: item.brand,
            price: item.price,
            confidence: item.confidence,
            is_promo: item.is_promo,
            ocr_text_raw: item.ocr_text_raw,
            price_bbox: item.price_bbox,
            digit_confidence: item.digit_confidence
          }));

          await supabase.from("cm_ai_price_analysis_item").insert(itemsToInsert);
        } catch (ocrErr: any) {
          console.error(`[Price OCR Reprocess Error] Job ${priceLog.id}:`, ocrErr);
          await supabase
            .from("cm_ai_price_analysis")
            .update({ ocr_status: "FAILED" })
            .eq("id", priceLog.id);
        }
      }

      return NextResponse.json({ success: true, message: "Análise reprocessada com sucesso." });
    }

    return NextResponse.json({ success: false, error: `Ação inválida: ${action}` }, { status: 400 });

  } catch (error: any) {
    console.error("[REVIEW API] Fatal error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro interno do servidor." }, { status: 500 });
  }
}
