import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import DOMPurify from "isomorphic-dompurify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const dept = searchParams.get("dept") || "Todos";

    // 1. Obter perfil do usuário
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "Promotor";
    const allowedEditRoles = ["Admin", "CEO", "RH"];
    const isEditor = allowedEditRoles.includes(role);

    let query = supabase
      .from("cm_processos")
      .select("*")
      .eq("ativo", true);

    // Se NÃO for editor, só pode ver processos PUBLICADOS
    if (!isEditor) {
      query = query.eq("status", "PUBLICADO");
    }

    if (dept !== "Todos") {
      query = query.eq("departamento_responsavel", dept);
    }

    if (search.trim().length > 0) {
      // Formata a busca para suportar prefixos e múltiplos termos com AND (&)
      const formattedSearch = search
        .trim()
        .split(/\s+/)
        .map(term => `${term}:*`)
        .join(" & ");
      query = query.textSearch("fts", formattedSearch, { config: "portuguese" });
    }

    const { data: processes, error: dbErr } = await query.order("titulo", { ascending: true });
    if (dbErr) throw dbErr;

    let filtered = processes || [];

    let metrics = null;
    if (isEditor) {
      // 1. Calcular total de processos ativos por status
      const totalCount = processes.length;
      const publishedCount = processes.filter(p => p.status === "PUBLICADO").length;
      const inReviewCount = processes.filter(p => p.status === "EM_REVISAO" || p.status === "AGUARDANDO_APROVACAO_CEO").length;

      // 2. Obter total de colaboradores para taxa de adesão
      const { count: totalUsersCount } = await supabase
        .from("cm_user_profiles")
        .select("*", { count: "exact", head: true });

      const n = totalUsersCount || 1; // evitar divisão por zero

      // 3. Obter contagem de leitores por processo e versão
      const { data: readCounts } = await supabase
        .from("cm_processos_leitura")
        .select("processo_id, versao_lida");

      // Agrupar contagens de leitura por processo_id e versão
      const readMap = new Map();
      (readCounts || []).forEach(r => {
        const key = `${r.processo_id}_${r.versao_lida}`;
        readMap.set(key, (readMap.get(key) || 0) + 1);
      });

      // Calcular taxa média e processos críticos (pendentes > 20%, ou seja, adesão < 80%)
      let totalAdhesionSum = 0;
      let criticalPendingCount = 0;
      const publishedMandatory = processes.filter(p => p.status === "PUBLICADO" && p.mandatory_read);

      publishedMandatory.forEach(p => {
        const key = `${p.id}_${p.versao}`;
        const reads = readMap.get(key) || 0;
        const rate = (reads / n) * 100;
        totalAdhesionSum += rate;
        if (rate < 80) {
          criticalPendingCount++;
        }
      });

      const averageAdhesion = publishedMandatory.length > 0 
        ? Math.round(totalAdhesionSum / publishedMandatory.length) 
        : 100;

      metrics = {
        total_processes: totalCount,
        published: publishedCount,
        in_review: inReviewCount,
        average_adhesion: averageAdhesion,
        critical_pending: criticalPendingCount
      };
    }

    return NextResponse.json({ success: true, data: filtered, metrics });
  } catch (error: any) {
    console.error("Erro ao buscar processos:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const allowedEditRoles = ["Admin", "CEO", "RH"];
    if (!profile || !allowedEditRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão para criar processos" }, { status: 403 });
    }

    const body = await request.json();
    const { titulo, categoria, departamento_responsavel, conteudo, status, mandatory_read, file_type, render_mode, original_file_url } = body;

    if (!titulo) {
      return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
    }

    const sanitizedConteudo = DOMPurify.sanitize(conteudo || "");

    // Inserir processo
    const { data: newProcess, error: insertErr } = await supabase
      .from("cm_processos")
      .insert({
        titulo,
        categoria: categoria || departamento_responsavel, // fallback
        departamento_responsavel,
        conteudo: sanitizedConteudo,
        versao: "v1.0",
        status: status || "DRAFT",
        mandatory_read: !!mandatory_read,
        file_type: file_type || "docx",
        render_mode: render_mode || "HTML",
        original_file_url: original_file_url || null,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Criar entrada de histórico inicial
    const { error: histErr } = await supabase
      .from("cm_processos_historico")
      .insert({
        processo_id: newProcess.id,
        versao: "v1.0",
        conteudo_snapshot: sanitizedConteudo,
        change_log: "Criação inicial do processo",
        updated_by: user.id
      });

    if (histErr) throw histErr;

    return NextResponse.json({ success: true, data: newProcess });
  } catch (error: any) {
    console.error("Erro ao criar processo:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
