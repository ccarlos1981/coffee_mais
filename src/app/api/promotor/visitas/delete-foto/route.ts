import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil do promotor para obter employee_id
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) {
      return NextResponse.json({ success: false, error: "Perfil de promotor digital correspondente não encontrado." }, { status: 400 });
    }

    const { foto_id } = await request.json();

    if (!foto_id) {
      return NextResponse.json({ success: false, error: "Parâmetro foto_id obrigatório ausente." }, { status: 400 });
    }

    // 1. Buscar a foto e obter os dados da visita associada
    const { data: foto, error: fotoError } = await supabase
      .from("cm_promotor_visita_foto")
      .select(`
        *,
        visita:cm_promotor_visita(
          *,
          agenda:cm_promotor_agenda_diaria(promotor_id)
        )
      `)
      .eq("id", foto_id)
      .single();

    if (fotoError || !foto) {
      return NextResponse.json({ success: false, error: "Foto não encontrada no sistema." }, { status: 404 });
    }

    const visita = foto.visita as any;

    // 2. Verificar se pertence ao promotor e se a visita está ativa
    if (visita.agenda.promotor_id !== perfil.employee_id) {
      return NextResponse.json({ success: false, error: "Acesso negado: Esta foto pertence à visita de outro promotor." }, { status: 403 });
    }

    const statusPermitidos = ["CHECKIN_REALIZADO", "EM_EXECUCAO", "EM_ROTA"];
    if (!statusPermitidos.includes(visita.status)) {
      return NextResponse.json({ success: false, error: `Não é possível deletar fotos de visitas concluídas ou canceladas. Status atual: ${visita.status}` }, { status: 400 });
    }

    // 3. Executar o soft-delete no banco de dados
    const { error: updateError } = await supabase
      .from("cm_promotor_visita_foto")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq("id", foto_id);

    if (updateError) {
      console.error("[DELETE FOTO] Erro ao aplicar soft-delete:", updateError);
      return NextResponse.json({ success: false, error: "Erro ao atualizar registro para soft-delete." }, { status: 500 });
    }

    // O arquivo físico é mantido no Supabase Storage para auditoria,
    // apenas o registro lógico é marcado como deletado.

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[DELETE FOTO] Erro interno:", err);
    return NextResponse.json({ success: false, error: err.message || "Erro interno no servidor." }, { status: 500 });
  }
}
