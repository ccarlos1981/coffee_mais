import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportRow {
  cod_parceiro: string;
  rede: string;
  nome_pdv: string;
  endereco: string;
  cidade: string;
  uf: string;
  faturamento_mensal: number;
  canal: string;
  cnpj?: string;
  cluster?: string;
  supervisor?: string;
  latitude?: number;
  longitude?: number;
}

export async function POST(request: Request) {
  const supabaseAdmin = createAdminClient();
  let user = null;
  
  try {
    // 1. Authenticate user via normal client
    const supabaseNormal = await createClient();
    const { data: { user: supabaseUser }, error: authError } = await supabaseNormal.auth.getUser();
    if (authError || !supabaseUser) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }
    user = supabaseUser;

    // Check user role
    const { data: profile } = await supabaseNormal
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    const isAuthorized = ["CEO", "Admin", "Trade", "Supervisor"].includes(role);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Acesso negado: Perfil não autorizado." }, { status: 403 });
    }

    // 2. Parse body
    const body = await request.json();
    const { rows }: { rows: ImportRow[] } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: "Nenhum registro para importação enviado." }, { status: 400 });
    }

    // 3. Create Import Job in PROCESSING state
    const { data: job, error: jobError } = await supabaseAdmin
      .from("cm_pdv_import_job")
      .insert({
        uploaded_by: user.id,
        total_rows: rows.length,
        valid_rows: 0,
        invalid_rows: 0,
        status: "PROCESSING",
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // 4. Process Upserts
    let validCount = 0;
    let invalidCount = 0;

    for (const row of rows) {
      try {
        const codParceiro = String(row.cod_parceiro).trim();
        if (!codParceiro || !row.nome_pdv || !row.uf || !row.cidade) {
          invalidCount++;
          continue;
        }

        // Upsert into base_atendimento
        const { error: baseError } = await supabaseAdmin
          .from("base_atendimento")
          .upsert({
            cod_parceiro: codParceiro,
            nome_parceiro: row.nome_pdv.trim(),
            nome_fantasia: row.nome_pdv.trim(),
            razao_social: row.nome_pdv.trim(),
            rede: row.rede ? row.rede.trim() : "Independente",
            canal: row.canal ? row.canal.trim() : "VAREJO F OUT",
            uf: row.uf.trim().toUpperCase(),
            cidade: row.cidade.trim(),
            endereco: row.endereco ? row.endereco.trim() : "",
            faturamento_mensal: row.faturamento_mensal ? Number(row.faturamento_mensal) : 0.00,
            cluster_canal: row.cluster ? row.cluster.trim() : "D",
            cnpj: row.cnpj ? row.cnpj.trim() : null,
            manager: row.supervisor ? row.supervisor.trim() : "Inside Sales",
            updated_at: new Date().toISOString()
          }, { onConflict: "cod_parceiro" });

        if (baseError) throw baseError;

        // If coordinates provided, upsert into cm_promotor_pdv_geoloc
        if (typeof row.latitude === "number" && typeof row.longitude === "number") {
          await supabaseAdmin
            .from("cm_promotor_pdv_geoloc")
            .upsert({
              cod_parceiro: codParceiro,
              latitude: row.latitude,
              longitude: row.longitude,
              geofence_radius_m: 100,
              updated_at: new Date().toISOString()
            }, { onConflict: "cod_parceiro" });
        }

        // Create default route profile if doesn't exist
        const { data: existingProfile } = await supabaseAdmin
          .from("cm_pdv_route_profile")
          .select("pdv_id")
          .eq("pdv_id", codParceiro)
          .maybeSingle();

        if (!existingProfile) {
          await supabaseAdmin
            .from("cm_pdv_route_profile")
            .insert({
              pdv_id: codParceiro,
              requires_fifo: false,
              requires_ai_photo: true,
              requires_price_ocr: true,
              requires_tasting: false,
              requires_rupture_detail: false,
              complexity_factor: 1.00,
              commercial_visit_priority_score: 0.00,
              commercial_visit_priority_class: "BAIXO"
            });
        }

        validCount++;
      } catch (err) {
        console.error(`[PDV IMPORT] Error upserting row: ${JSON.stringify(row)}`, err);
        invalidCount++;
      }
    }

    // 5. Update Import Job status
    const finalStatus = validCount > 0 ? "SUCCESS" : "FAILED";
    await supabaseAdmin
      .from("cm_pdv_import_job")
      .update({
        valid_rows: validCount,
        invalid_rows: invalidCount,
        status: finalStatus,
      })
      .eq("id", job.id);

    return NextResponse.json({
      success: true,
      job_id: job.id,
      total_rows: rows.length,
      valid_rows: validCount,
      invalid_rows: invalidCount,
      status: finalStatus,
    });

  } catch (error: any) {
    console.error("[PDV IMPORT API]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
