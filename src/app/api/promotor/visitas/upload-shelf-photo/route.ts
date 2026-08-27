import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { simulateAIShelfAnalysis } from "@/lib/ai/shelf-engine";
import { simulatePriceOCR } from "@/lib/ai/price-ocr-engine";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  assertVisitaAccess,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_UPLOAD_ROLES = [
  "Promotor",
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

    // 1. Role verification
    requireRole(profile.role, ALLOWED_UPLOAD_ROLES);

    const supabase = await createClient();

    // Get promotor profile to retrieve employee_id if available
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const formData = await request.formData();
    const visitaId = formData.get("visita_id") as string;
    const foto = formData.get("foto") as File | null;
    const widthStr = formData.get("width") as string | null;
    const heightStr = formData.get("height") as string | null;
    const capturedAtStr = formData.get("captured_at") as string | null;
    const cameraMetadataStr = formData.get("camera_metadata") as string | null;

    if (!visitaId || !foto) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes: visita_id e foto." }, { status: 400 });
    }

    const width = widthStr ? parseInt(widthStr, 10) : 1920;
    const height = heightStr ? parseInt(heightStr, 10) : 1080;
    const capturedAt = capturedAtStr ? new Date(capturedAtStr).toISOString() : new Date().toISOString();
    let cameraMetadata = {};
    try {
      if (cameraMetadataStr) {
        cameraMetadata = JSON.parse(cameraMetadataStr);
      }
    } catch (_) {}

    // 2. Strict Object-Level Authorization: verify visit exists and belongs to this user/team
    const { visita } = await assertVisitaAccess(user.id, profile, visitaId);

    // Permit uploads only if visit is checked-in or in execution
    const statusPermitidos = ["CHECKIN_REALIZADO", "EM_EXECUCAO", "EM_ROTA"];
    if (!statusPermitidos.includes(visita.status)) {
      return NextResponse.json({
        success: false,
        error: `Não é permitido enviar fotos de gôndola para visitas neste status. Status: ${visita.status}`
      }, { status: 400 });
    }

    // 3. Upload photo to Supabase Storage in 'promotor-ponto' bucket
    const arrayBuffer = await foto.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageMd5 = crypto.createHash("md5").update(buffer).digest("hex");

    const fileName = `${Date.now()}-shelf-ia.jpg`;
    const filePath = `${user.id}/visitas/${visitaId}/shelf_ia/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("promotor-ponto")
      .upload(filePath, buffer, {
        contentType: foto.type,
        upsert: false
      });

    if (uploadError) {
      console.error("[UPLOAD SHELF FOTO] Storage upload error:", uploadError);
      return NextResponse.json({ success: false, error: "Erro ao salvar arquivo no storage." }, { status: 500 });
    }

    const photoUrl = uploadData.path;
    const promotorIdToStore = perfil?.employee_id || user.id;

    // 4. Insert PENDING analysis log in cm_ai_shelf_analysis
    const { data: analysisLog, error: insertError } = await supabase
      .from("cm_ai_shelf_analysis")
      .insert({
        visita_id: visitaId,
        promotor_id: promotorIdToStore,
        photo_url: photoUrl,
        image_width: width,
        image_height: height,
        captured_at: capturedAt,
        camera_metadata: cameraMetadata,
        analysis_status: "PENDING",
        quality_score: 100,
        quality_status: "GOOD",
        needs_manual_review: false
      })
      .select("id")
      .single();

    if (insertError || !analysisLog) {
      console.error("[UPLOAD SHELF FOTO] DB insert error:", insertError);
      // Clean up uploaded file
      await supabase.storage.from("promotor-ponto").remove([photoUrl]);
      return NextResponse.json({ success: false, error: "Erro ao registrar a análise de gôndola no banco." }, { status: 500 });
    }

    const analysisJobId = analysisLog.id;

    // 5. Execute AI Engine simulation asynchronously
    (async () => {
      const db = createAdminClient();
      try {
        // Set state to PROCESSING
        await db
          .from("cm_ai_shelf_analysis")
          .update({
            analysis_status: "PROCESSING",
            processing_started_at: new Date().toISOString()
          })
          .eq("id", analysisJobId);

        // Run simulation
        const result = await simulateAIShelfAnalysis(visitaId, visita.cod_parceiro, photoUrl, imageMd5);

        // Set state to DONE with results
        await db
          .from("cm_ai_shelf_analysis")
          .update({
            analysis_status: "DONE",
            detected_products: result.detected_products,
            total_facings: result.total_facings,
            coffee_mais_facings: result.coffee_mais_facings,
            shelf_share_percent: result.shelf_share_percent,
            rupture_status: result.rupture_status,
            planogram_score: result.planogram_score,
            ai_confidence: result.ai_confidence,
            processing_finished_at: new Date().toISOString(),
            quality_score: result.quality_score,
            quality_status: result.quality_status,
            quality_issues: result.quality_issues,
            needs_manual_review: result.needs_manual_review,
            review_reason: result.review_reason,
            planogram_version_used: result.planogram_version_used,
            annotated_image_url: result.annotated_image_url,
            decision_reasons: result.decision_reasons
          })
          .eq("id", analysisJobId);

        // Price OCR Integration
        const { data: priceLog, error: priceLogErr } = await db
          .from("cm_ai_price_analysis")
          .insert({
            visita_id: visitaId,
            analysis_id: analysisJobId,
            ocr_status: "PROCESSING"
          })
          .select("id")
          .single();

        if (!priceLogErr && priceLog) {
          try {
            const priceResult = await simulatePriceOCR(
              visitaId,
              analysisJobId,
              result.detected_products as never,
              imageMd5
            );

            await db
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

            await db.from("cm_ai_price_analysis_item").insert(itemsToInsert);

          } catch (ocrErr: unknown) {
            console.error(`[Price OCR Simulation Error] Job ${priceLog.id}:`, ocrErr);
            await db
              .from("cm_ai_price_analysis")
              .update({
                ocr_status: "FAILED"
              })
              .eq("id", priceLog.id);
          }
        } else {
          console.error("[Price OCR Log Insert Error]:", priceLogErr);
        }

      } catch (err: unknown) {
        const errorObj = err as { message?: string };
        console.error(`[AI Shelf Simulation Error] Job ${analysisJobId}:`, err);
        await db
          .from("cm_ai_shelf_analysis")
          .update({
            analysis_status: "FAILED",
            error_message: errorObj.message || "Erro durante o processamento da simulação de IA.",
            processing_finished_at: new Date().toISOString()
          })
          .eq("id", analysisJobId);
      }
    })();

    return NextResponse.json({
      success: true,
      message: "Foto de gôndola enviada. Análise IA iniciada.",
      analysis_job_id: analysisJobId
    });

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
    console.error("[UPLOAD SHELF FOTO] Fatal error:", error);
    return NextResponse.json({ success: false, error: err.message || "Erro interno do servidor." }, { status: 500 });
  }
}
