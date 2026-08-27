import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
  logAuditAction,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    await requireApprovedProfile(user.id);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const networkId = searchParams.get("network_id");

    const supabase = getSupabaseClient();
    
    let query = supabase
      .from("pdvs")
      .select(`
        *,
        network_matrix (
          network,
          manager,
          network_uf
        )
      `)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,cnpj.ilike.%${search}%`);
    }
    
    if (networkId) {
      query = query.eq("network_id", networkId);
    }

    const { data: pdvs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, pdvs });
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED")
    ) {
      return handleAuthError(error);
    }
    console.error("[PDV API GET]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, [
      "Admin",
      "Admin Master",
      "Trade",
      "Supervisor",
      "Gerente Regional",
      "CEO",
    ]);

    const supabase = getSupabaseClient();
    const body = await request.json();
    const { cnpj, name, network_id, erp_code, status } = body;

    if (!cnpj || !name) {
      return NextResponse.json({ success: false, error: "CNPJ e Nome são obrigatórios." }, { status: 400 });
    }

    const formatedCnpj = cnpj.trim();

    // Verification
    const { data: existing } = await supabase.from("pdvs").select("id").eq("cnpj", formatedCnpj).maybeSingle();
    if (existing) {
      return NextResponse.json({ success: false, error: "Este CNPJ já está cadastrado em outro PDV." }, { status: 400 });
    }

    const { data, error } = await supabase.from("pdvs").insert({
      cnpj: formatedCnpj,
      name: name.trim(),
      network_id: network_id || null,
      erp_code: erp_code || null,
      status: status || "active"
    }).select().single();

    if (error) throw error;

    await logAuditAction(user.id, "PDV_CREATE", "pdvs", {
      id: data.id,
      cnpj: formatedCnpj,
      name: name.trim(),
      network_id,
      erp_code,
    });

    return NextResponse.json({ success: true, pdv: data }, { status: 201 });
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED")
    ) {
      return handleAuthError(error);
    }
    console.error("[PDV API POST]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
