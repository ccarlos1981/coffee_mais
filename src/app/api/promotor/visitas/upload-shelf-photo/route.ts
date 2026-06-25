import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { simulateAIShelfAnalysis } from "@/lib/ai/shelf-engine";
import { simulatePriceOCR } from "@/lib/ai/price-ocr-engine";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Get promotor profile to retrieve employee_id
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) {
      return NextResponse.json({ success: false, error: "Perfil de promotor correspondente não encontrado." }, { status: 400 });
    }

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

    // 1. Fetch visit and validate if it exists and belongs to this promotor
    const { data: visita, error: visitaError } = await supabase
      .from("cm_promotor_visita")
      .select("id, status, cod_parceiro")
      .eq("id", visitaId)
      .single();

    if (visitaError || !visita) {
      return NextResponse.json({ success: false, error: "Visita não encontrada." }, { status: 404 });
    }

    // Permit uploads only if visit is checked-in or in execution
    const statusPermitidos = ["CHECKIN_REALIZADO", "EM_EXECUCAO"];
    if (!statusPermitidos.includes(visita.status)) {
      return NextResponse.json({
        success: false,
        error: `Não é permitido enviar fotos de gôndola para visitas neste status. Status: ${visita.status}`
      }, { status: 400 });
    }

    // 2. Upload photo to Supabase Storage in 'promotor-ponto' bucket
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

    // 3. Insert PENDING analysis log in cm_ai_shelf_analysis
    const { data: analysisLog, error: insertError } = await supabase
      .from("cm_ai_shelf_analysis")
      .insert({
        visita_id: visitaId,
        promotor_id: perfil.employee_id,
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

    // 4. Execute AI Engine simulation asynchronously
    (async () => {
      const db = await createClient();
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

        // --- Sprint 5.2: Price OCR Integration ---
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
              result.detected_products as any,
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

          } catch (ocrErr: any) {
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

      } catch (err: any) {
        console.error(`[AI Shelf Simulation Error] Job ${analysisJobId}:`, err);
        await db
          .from("cm_ai_shelf_analysis")
          .update({
            analysis_status: "FAILED",
            error_message: err.message || "Erro durante o processamento da simulação de IA.",
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

  } catch (error: any) {
    console.error("[UPLOAD SHELF FOTO] Fatal error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro interno do servidor." }, { status: 500 });
  }
}
