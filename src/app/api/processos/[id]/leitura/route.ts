import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get("version");

    if (!version) {
      return NextResponse.json({ error: "Parâmetro version é obrigatório" }, { status: 400 });
    }

    // 1. Obter todos os perfis de usuários ativos
    const { data: userProfiles, error: upErr } = await adminClient
      .from("cm_user_profiles")
      .select("id, employee_code, role");

    if (upErr) throw upErr;

    // 2. Obter informações dos funcionários correspondentes
    const { data: employees } = await adminClient
      .from("cm_employees")
      .select("id, nome_completo");

    const empNameMap = new Map();
    if (employees) employees.forEach(e => empNameMap.set(e.id, e.nome_completo));

    // Mapeamento de user_id a employee_id
    const { data: promotorPerfil } = await adminClient.from("cm_promotor_perfil").select("user_id, employee_id");
    const userToEmpMap = new Map();
    if (promotorPerfil) promotorPerfil.forEach(p => userToEmpMap.set(p.user_id, p.employee_id));

    // 3. Obter todas as leituras desta versão do processo
    const { data: readings, error: readErr } = await adminClient
      .from("cm_processos_leitura")
      .select("user_id, lido_em")
      .eq("processo_id", id)
      .eq("versao_lida", version);

    if (readErr) throw readErr;

    const readUserIds = new Set((readings || []).map(r => r.user_id));
    const readTimesMap = new Map((readings || []).map(r => [r.user_id, r.lido_em]));

    // 4. Montar lista de leitores e pendentes
    const readList: any[] = [];
    const pendingList: any[] = [];

    (userProfiles || []).forEach(p => {
      const empId = userToEmpMap.get(p.id);
      const name = empId ? empNameMap.get(empId) : `Colaborador ${p.employee_code || "000"}`;
      
      const item = {
        user_id: p.id,
        name,
        role: p.role,
        lido_em: readTimesMap.get(p.id) || null
      };

      if (readUserIds.has(p.id)) {
        readList.push(item);
      } else {
        pendingList.push(item);
      }
    });

    const totalUsers = userProfiles?.length || 0;
    const totalRead = readUserIds.size;
    const adhesionPercent = totalUsers > 0 ? Math.round((totalRead / totalUsers) * 100) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        total_users: totalUsers,
        total_read: totalRead,
        adhesion_percent: adhesionPercent,
        read_list: readList,
        pending_list: pendingList
      }
    });
  } catch (error: any) {
    console.error("Erro ao obter estatísticas de leitura:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { version } = body;

    if (!version) {
      return NextResponse.json({ error: "Versão do processo é obrigatória" }, { status: 400 });
    }

    // Inserir registro de confirmação de leitura usando upsert para evitar erros de duplicidade
    const { error: insertErr } = await supabase
      .from("cm_processos_leitura")
      .upsert({
        processo_id: id,
        user_id: user.id,
        versao_lida: version,
        lido_em: new Date().toISOString()
      }, { onConflict: "processo_id,user_id,versao_lida" });

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao registrar leitura de processo:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
