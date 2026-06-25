import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ visita_id: string }> }
) {
  try {
    const { visita_id } = await params;
    if (!visita_id) {
      return NextResponse.json({ success: false, error: "Parâmetro visita_id não fornecido." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Fetch the latest AI shelf analysis for this visit
    const { data: analysis, error } = await supabase
      .from("cm_ai_shelf_analysis")
      .select("*")
      .eq("visita_id", visita_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[GET SHELF ANALYSIS] Error querying DB:", error);
      return NextResponse.json({ success: false, error: "Erro ao consultar a análise de gôndola." }, { status: 500 });
    }

    if (!analysis) {
      return NextResponse.json({
        success: false,
        code: "ANALYSIS_NOT_FOUND",
        message: "Nenhuma análise de gôndola encontrada para esta visita."
      }, { status: 404 });
    }

    // Fetch pricing analysis if it exists
    const { data: priceAnalysis } = await supabase
      .from("cm_ai_price_analysis")
      .select("*")
      .eq("analysis_id", analysis.id)
      .maybeSingle();

    let priceAnalysisData = null;
    if (priceAnalysis) {
      const { data: priceItems } = await supabase
        .from("cm_ai_price_analysis_item")
        .select("*")
        .eq("price_analysis_id", priceAnalysis.id);

      priceAnalysisData = {
        ...priceAnalysis,
        items: priceItems || []
      };
    }

    // Map database columns to the requested response schema
    return NextResponse.json({
      success: true,
      analysis_id: analysis.id,
      visita_id: analysis.visita_id,
      analysis_status: analysis.analysis_status,
      photo_url: analysis.photo_url,
      total_facings: analysis.total_facings,
      coffee_mais_facings: analysis.coffee_mais_facings,
      shelf_share_percent: analysis.shelf_share_percent,
      rupture_status: analysis.rupture_status,
      planogram_score: analysis.planogram_score,
      ai_confidence: analysis.ai_confidence,
      detected_products: analysis.detected_products || [],
      error_message: analysis.error_message,
      captured_at: analysis.captured_at,
      created_at: analysis.created_at,
      quality_score: analysis.quality_score,
      quality_status: analysis.quality_status,
      quality_issues: analysis.quality_issues || [],
      needs_manual_review: analysis.needs_manual_review,
      review_reason: analysis.review_reason,
      planogram_version_used: analysis.planogram_version_used,
      annotated_image_url: analysis.annotated_image_url,
      decision_reasons: analysis.decision_reasons || [],
      price_analysis: priceAnalysisData
    });

  } catch (error: any) {
    console.error("[GET SHELF ANALYSIS] Fatal error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro interno do servidor." }, { status: 500 });
  }
}
