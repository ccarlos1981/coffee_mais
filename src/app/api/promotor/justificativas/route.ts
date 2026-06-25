import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Perfis com autorização de gestor
const GESTOR_ROLES = ["Supervisor", "CEO", "Admin", "Trade"];

// 1. GET: Retorna as ocorrências/justificativas
// - Se for promotor: retorna apenas as suas.
// - Se for gestor: retorna as dos seus promotores sob responsabilidade (ou todas se for Admin).
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    const isGestor = GESTOR_ROLES.includes(role);

    // Buscar employee_id do usuário logado na tabela auxiliar cm_promotor_perfil
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: employee } = perfil ? await supabase
      .from("cm_employees")
      .select("id")
      .eq("id", perfil.employee_id)
      .maybeSingle() : { data: null };

    let query = supabase.from("cm_promotor_jornada_ocorrencias").select(`
      *,
      employee:cm_employees(id, nome_completo, cpf)
    `);

    if (!isGestor) {
      // Se for promotor, só vê suas próprias ocorrências
      if (!employee) {
        return NextResponse.json({ success: true, data: [] });
      }
      query = query.eq("employee_id", employee.id);
    } else if (role === "Supervisor" && employee) {
      // Se for supervisor, vê apenas dos promotores que ele lidera
      const { data: subordinates } = await supabase
        .from("cm_promotor_supervisor_mapping")
        .select("promotor_id")
        .eq("supervisor_id", employee.id);

      const subordinateIds = subordinates?.map(s => s.promotor_id) || [];
      
      if (subordinateIds.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      query = query.in("employee_id", subordinateIds);
    }

    const { data: ocorrencias, error: fetchError } = await query.order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[JUSTIFICATIVAS API GET] Erro ao buscar ocorrências:", fetchError);
      throw fetchError;
    }

    return NextResponse.json({ success: true, data: ocorrencias });

  } catch (error: unknown) {
    console.error("[JUSTIFICATIVAS API GET] Erro fatal:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao listar justificativas." 
    }, { status: 500 });
  }
}

// 2. POST: Criar uma nova justificativa (Promotor)
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
      return NextResponse.json({ success: false, error: "Perfil de promotor digital correspondente a este usuário não foi encontrado." }, { status: 400 });
    }

    // Buscar employee_id correspondente
    const { data: employee } = await supabase
      .from("cm_employees")
      .select("id")
      .eq("id", perfil.employee_id)
      .eq("ativo", true)
      .maybeSingle();

    if (!employee) {
      return NextResponse.json({ success: false, error: "Cadastro de funcionário ativo não encontrado." }, { status: 400 });
    }

    const formData = await request.formData();
    const tipoAjuste = formData.get("tipo_ajuste") as string;
    const dataOcorrencia = formData.get("data_ocorrencia") as string;
    const tipoRegistroAfetado = formData.get("tipo_registro_afetado") as string;
    const horarioProposto = formData.get("horario_proposto") as string | null;
    const justificativa = formData.get("justificativa") as string;
    const comprovante = formData.get("comprovante") as File | null;

    if (!tipoAjuste || !dataOcorrencia || !tipoRegistroAfetado || !justificativa) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    let comprovanteUrl = null;

    // Se tiver anexo de comprovante, fazer upload
    if (comprovante) {
      const ext = comprovante.name.split(".").pop() || "pdf";
      const sanitizedExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
      const fileName = `${Date.now()}-comprovante.${sanitizedExt}`;
      const filePath = `${user.id}/comprovantes/${fileName}`;
      const arrayBuffer = await comprovante.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("promotor-ponto")
        .upload(filePath, buffer, {
          contentType: comprovante.type,
          upsert: false
        });

      if (uploadError) {
        console.error("[JUSTIFICATIVAS API POST] Erro ao fazer upload de anexo:", uploadError);
        return NextResponse.json({ success: false, error: "Erro ao anexar o comprovante." }, { status: 500 });
      }

      comprovanteUrl = uploadData.path;
    }

    const { data: novaOcorrencia, error: insertError } = await supabase
      .from("cm_promotor_jornada_ocorrencias")
      .insert({
        employee_id: employee.id,
        tipo_ajuste: tipoAjuste,
        data_ocorrencia: dataOcorrencia,
        tipo_registro_afetado: tipoRegistroAfetado,
        horario_proposto: horarioProposto || null,
        justificativa,
        documento_comprovante_url: comprovanteUrl,
        status: "PENDENTE"
      })
      .select()
      .single();

    if (insertError) {
      console.error("[JUSTIFICATIVAS API POST] Erro ao salvar ocorrência:", insertError);
      return NextResponse.json({ success: false, error: "Erro ao registrar a ocorrência no banco." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Justificativa enviada com sucesso!", data: novaOcorrencia });

  } catch (error: unknown) {
    console.error("[JUSTIFICATIVAS API POST] Erro fatal:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao enviar justificativa." 
    }, { status: 500 });
  }
}

// 3. PUT: Analisar uma justificativa (Supervisor/Admin)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Validar se é gestor
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    if (!GESTOR_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: "Acesso negado. Apenas supervisores e administradores podem analisar ocorrências." }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, observacao_supervisor } = body;

    if (!id || !status || !["APROVADO", "REJEITADO"].includes(status)) {
      return NextResponse.json({ success: false, error: "Parâmetros de decisão inválidos." }, { status: 400 });
    }

    const { data: ocorrencia, error: updateError } = await supabase
      .from("cm_promotor_jornada_ocorrencias")
      .update({
        status,
        observacao_supervisor,
        aprovado_por: user.id,
        data_analise: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[JUSTIFICATIVAS API PUT] Erro ao salvar decisão:", updateError);
      return NextResponse.json({ success: false, error: "Erro ao registrar a aprovação/rejeição no banco." }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Ocorrência ${status === "APROVADO" ? "aprovada" : "rejeitada"} com sucesso!`,
      data: ocorrencia 
    });

  } catch (error: unknown) {
    console.error("[JUSTIFICATIVAS API PUT] Erro fatal:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao processar análise da ocorrência." 
    }, { status: 500 });
  }
}
