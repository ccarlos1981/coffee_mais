import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 1. Buscar todos os processos ativos, publicados e que sejam de LEITURA OBRIGATÓRIA
    const { data: mandatoryProcesses, error: dbErr } = await supabase
      .from("cm_processos")
      .select("id, titulo, versao, departamento_responsavel, updated_at")
      .eq("ativo", true)
      .eq("status", "PUBLICADO")
      .eq("mandatory_read", true);

    if (dbErr) throw dbErr;

    if (!mandatoryProcesses || mandatoryProcesses.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 2. Buscar todas as leituras feitas por este usuário
    const { data: readings, error: readErr } = await supabase
      .from("cm_processos_leitura")
      .select("processo_id, versao_lida")
      .eq("user_id", user.id);

    if (readErr) throw readErr;

    // Criar um set com chaves únicas para busca rápida: "processoId_versao"
    const readSet = new Set(
      (readings || []).map(r => `${r.processo_id}_${r.versao_lida}`)
    );

    // 3. Filtrar processos onde o usuário não leu a versão atual
    const pending = mandatoryProcesses.filter(p => {
      const key = `${p.id}_${p.versao}`;
      return !readSet.has(key);
    });

    return NextResponse.json({ success: true, data: pending });
  } catch (error: any) {
    console.error("Erro ao buscar pendências de leitura:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
