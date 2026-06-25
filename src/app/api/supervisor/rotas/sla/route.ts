import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const GESTOR_ROLES = ["Supervisor", "CEO", "Admin", "Trade"];

// Helper to validate manager permission
async function checkAuthAndRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado", status: 401 };

  const { data: profile } = await supabase
    .from("cm_user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "";
  if (!GESTOR_ROLES.includes(role)) {
    return { error: "Acesso não autorizado", status: 403 };
  }

  return { supabase, user, role };
}

// GET /api/supervisor/rotas/sla
export async function GET() {
  try {
    const auth = await checkAuthAndRole();
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data: rules, error } = await auth.supabase!
      .from("cm_visit_sla_rules")
      .select("*")
      .order("faturamento_min", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, rules });
  } catch (err: any) {
    console.error("Error fetching SLA rules:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/supervisor/rotas/sla (Adicionar / Upsert regra)
export async function POST(request: Request) {
  try {
    const auth = await checkAuthAndRole();
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, faturamento_min, faturamento_max, base_visit_minutes } = body;

    if (faturamento_min === undefined || faturamento_max === undefined || !base_visit_minutes) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes" }, { status: 400 });
    }

    if (Number(faturamento_min) > Number(faturamento_max)) {
      return NextResponse.json({ success: false, error: "O faturamento mínimo não pode exceder o faturamento máximo" }, { status: 400 });
    }

    const payload = {
      faturamento_min: Number(faturamento_min),
      faturamento_max: Number(faturamento_max),
      base_visit_minutes: parseInt(base_visit_minutes, 10)
    };

    let result;
    if (id) {
      // Update
      const { data, error } = await auth.supabase!
        .from("cm_visit_sla_rules")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await auth.supabase!
        .from("cm_visit_sla_rules")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, rule: result });
  } catch (err: any) {
    console.error("Error saving SLA rule:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/supervisor/rotas/sla
export async function DELETE(request: Request) {
  try {
    const auth = await checkAuthAndRole();
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID da regra não fornecido" }, { status: 400 });
    }

    const { error } = await auth.supabase!
      .from("cm_visit_sla_rules")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting SLA rule:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
