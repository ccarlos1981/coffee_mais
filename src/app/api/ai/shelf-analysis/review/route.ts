import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { simulateAIShelfAnalysis } from "@/lib/ai/shelf-engine";
import { simulatePriceOCR } from "@/lib/ai/price-ocr-engine";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  assertVisitaAccess,
  logAuditAction,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REVIEW_ROLES = [
  "Supervisor",
  "Admin",
  "Admin Master",
  "CEO",
  "Trade",
];

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    // 1. Role verification: Only Supervisors and National Trade/Admin roles may review
    requireRole(profile.role, ALLOWED_REVIEW_ROLES);

    const body = await request.json();
    const { analysis_id, action, planogram_score_override, review_reason } = body;

    if (!analysis_id || typeof analysis_id !== "string" || !action) {
      return NextResponse.json(
        { success: false, error: "Parâmetros obrigatórios ausentes: analysis_id e action." },
        { status: 400 }
      );
    }

    if (action !== "APPROVE" && action !== "REPROCESS") {
      return NextResponse.json(
        { success: false, error: `Ação inválida: ${action}` },
        { status: 400 }
      );
    }

    // Validate score override if present
    if (planogram_score_override !== undefined && planogram_score_override !== null) {
      if (
        typeof planogram_score_override !== "number" ||
        !Number.isInteger(planogram_score_override) ||
        planogram_score_override < 0 ||
        planogram_score_override > 100
      ) {
        return NextResponse.json(
          { success: false, error: "Nota sobrescrita inválida. Deve ser um número inteiro entre 0 e 100." },
          { status: 400 }
        );
      }

      if (!review_reason || typeof review_reason !== "string" || review_reason.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Justificativa é obrigatória ao sobrescrever a nota de conformidade." },
          { status: 400 }
        );
      }
    }

    const adminClient = createAdminClient();

    // 2. Fetch the analysis to resolve its visita_id
    const { data: analysis, error: selectError } = await adminClient
      .from("cm_ai_shelf_analysis")
      .select("id, visita_id, photo_url, planogram_score, needs_manual_review")
      .eq("id", analysis_id)
      .maybeSingle();

    if (selectError || !analysis) {
      return NextResponse.json({ success: false, error: "Análise de gôndola não encontrada." }, { status: 404 });
    }

    // 3. Object-Level Access: Validate user has authority over this specific visit
    await assertVisitaAccess(user.id, profile, analysis.visita_id);

    if (action === "APPROVE") {
      const updatePayload: Record<string, unknown> = {
        needs_manual_review: false,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (review_reason) {
        updatePayload.review_reason = review_reason.trim();
      }

      if (typeof planogram_score_override === "number") {
        updatePayload.planogram_score = planogram_score_override;
        updatePayload.decision_reasons = [
          `Aprovado manualmente pelo supervisor com nota sobrescrita para ${planogram_score_override}.`,
          review_reason ? review_reason.trim() : "Sem observações adicionais."
        ];
      } else {
        updatePayload.decision_reasons = [
          "Aprovado manualmente pelo supervisor.",
          review_reason ? review_reason.trim() : "Sem observações adicionais."
        ];
      }

      const { data: updated, error: updateError } = await adminClient
        .from("cm_ai_shelf_analysis")
        .update(updatePayload)
        .eq("id", analysis_id)
        .select("id, planogram_score, needs_manual_review")
        .maybeSingle();

      if (updateError || !updated) {
        console.error("[REVIEW APPROVE] DB update error:", updateError);
        return NextResponse.json({ success: false, error: "Erro ao aprovar a análise de prateleira." }, { status: 500 });
      }

      await logAuditAction(user.id, "APPROVE_SHELF_ANALYSIS", "cm_ai_shelf_analysis", {
        analysis_id,
        visita_id: analysis.visita_id,
        planogram_score_override: planogram_score_override ?? null,
        review_reason: review_reason ?? null,
        reviewer_role: profile.role
      });

      return NextResponse.json({ success: true, message: "Análise aprovada com sucesso.", data: updated });
    }

    if (action === "REPROCESS") {
      const { data: visitaRecord, error: visitaFetchErr } = await adminClient
        .from("cm_promotor_visita")
        .select("cod_parceiro")
        .eq("id", analysis.visita_id)
        .maybeSingle();

      if (visitaFetchErr || !visitaRecord || !visitaRecord.cod_parceiro) {
        return NextResponse.json({ success: false, error: "Visita ou parceiro correspondente não encontrado." }, { status: 400 });
      }

      // Reprocess analysis by regenerating using the original image path as seed
      const imageMd5 = (analysis.photo_url || "").split("/").pop() || "reprocess-seed";
      const result = await simulateAIShelfAnalysis(analysis.visita_id, visitaRecord.cod_parceiro, analysis.photo_url || "", imageMd5);

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

      const { error: updateError } = await adminClient
        .from("cm_ai_shelf_analysis")
        .update(updatePayload)
        .eq("id", analysis_id);

      if (updateError) {
        console.error("[REVIEW REPROCESS] DB update error:", updateError);
        return NextResponse.json({ success: false, error: "Erro ao atualizar a análise após reprocessamento." }, { status: 500 });
      }

      // Clear previous pricing data and pricing alerts
      await adminClient.from("cm_ai_price_analysis").delete().eq("analysis_id", analysis_id);
      await adminClient.from("cm_ai_pricing_alert").delete().eq("visita_id", analysis.visita_id);

      // Trigger fresh pricing OCR
      const { data: priceLog, error: priceLogErr } = await adminClient
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
            result.detected_products as never,
            imageMd5
          );

          await adminClient
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

          await adminClient.from("cm_ai_price_analysis_item").insert(itemsToInsert);
        } catch (ocrErr: unknown) {
          console.error(`[Price OCR Reprocess Error] Job ${priceLog.id}:`, ocrErr);
          await adminClient
            .from("cm_ai_price_analysis")
            .update({ ocr_status: "FAILED" })
            .eq("id", priceLog.id);
        }
      }

      await logAuditAction(user.id, "REPROCESS_SHELF_ANALYSIS", "cm_ai_shelf_analysis", {
        analysis_id,
        visita_id: analysis.visita_id,
        reviewer_role: profile.role
      });

      return NextResponse.json({ success: true, message: "Análise reprocessada com sucesso." });
    }

    return NextResponse.json({ success: false, error: `Ação inválida: ${action}` }, { status: 400 });

  } catch (error: unknown) {
    const err = error as { message?: string };
    if (
      err.message === "UNAUTHENTICATED" ||
      err.message === "NOT_FOUND" ||
      err.message?.includes("PROFILE_") ||
      err.message?.includes("ROLE_NOT_ALLOWED") ||
      err.message === "FORBIDDEN"
    ) {
      return handleAuthError(error);
    }
    console.error("[REVIEW API] Fatal error:", error);
    return NextResponse.json({ success: false, error: err.message || "Erro interno do servidor." }, { status: 500 });
  }
}
