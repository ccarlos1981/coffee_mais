import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Perfis com autorização de gestor
const GESTOR_ROLES = ["Supervisor", "CEO", "Admin", "Trade"];

// Função Haversine para cálculo de distância geodésica em metros
function calculateDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. GET /api/promotor/agenda - Retorna ou gera a agenda do dia
export async function GET(request: Request) {
  try {
    console.log("[AGENDA GET] Request received at:", new Date().toISOString());
    const { searchParams } = new URL(request.url);
    const latParam = searchParams.get("latitude");
    const lonParam = searchParams.get("longitude");

    const promotorLat = latParam ? parseFloat(latParam) : null;
    const promotorLon = lonParam ? parseFloat(lonParam) : null;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    const isGestor = GESTOR_ROLES.includes(role);

    // Buscar employee_id do promotor na tabela auxiliar de perfil
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil && !isGestor) {
      return NextResponse.json({ success: false, error: "Usuário não possui perfil de promotor vinculado." }, { status: 400 });
    }

    const promotorId = perfil?.employee_id;

    // Se for gestor e quiser visualizar a agenda de outro promotor, ele deve passar ?promotor_id=UUID
    const queryPromotorId = searchParams.get("promotor_id");
    const targetPromotorId = isGestor && queryPromotorId ? queryPromotorId : promotorId;

    if (!targetPromotorId) {
      return NextResponse.json({ success: false, error: "Nenhum promotor selecionado para consulta da agenda." }, { status: 400 });
    }

    // 1. Verificar se a agenda diária para hoje já existe
    const dataHoje = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    
    let { data: agenda, error: fetchAgendaError } = await supabase
      .from("cm_promotor_agenda_diaria")
      .select("*")
      .eq("promotor_id", targetPromotorId)
      .eq("data_agenda", dataHoje)
      .maybeSingle();

    if (fetchAgendaError) {
      console.error("[AGENDA GET] Erro ao buscar agenda diária:", fetchAgendaError);
      return NextResponse.json({ success: false, error: "Erro ao buscar agenda diária." }, { status: 500 });
    }

    // 2. Se a agenda não existe, tentar gerá-la (apenas se for o próprio promotor ou admin gerando para o dia de hoje)
    if (!agenda) {
      // Verificar se o promotor já bateu o ponto de entrada na data de hoje
      const { data: jornada, error: jornadaError } = await supabase
        .from("cm_promotor_jornada")
        .select("id")
        .eq("employee_id", targetPromotorId)
        .eq("tipo_registro", "ENTRADA")
        .gte("timestamp_dispositivo", `${dataHoje}T00:00:00Z`)
        .lte("timestamp_dispositivo", `${dataHoje}T23:59:59Z`)
        .maybeSingle();

      if (jornadaError) {
        console.error("[AGENDA GET] Erro ao buscar jornada:", jornadaError);
        return NextResponse.json({ success: false, error: "Erro ao validar jornada de ponto." }, { status: 500 });
      }

      if (!jornada) {
        return NextResponse.json({ 
          success: false, 
          code: "PONTO_PENDENTE",
          error: "Você precisa registrar o ponto de entrada com biometria facial antes de gerar a agenda diária." 
        }, { status: 403 });
      }

      // Gerar nova agenda
      const { data: novaAgenda, error: createAgendaError } = await supabase
        .from("cm_promotor_agenda_diaria")
        .insert({
          promotor_id: targetPromotorId,
          jornada_id: jornada.id,
          data_agenda: dataHoje
        })
        .select()
        .single();

      if (createAgendaError) {
        console.error("[AGENDA GET] Erro ao criar agenda diária:", createAgendaError);
        return NextResponse.json({ success: false, error: "Erro ao instanciar agenda diária." }, { status: 500 });
      }

      agenda = novaAgenda;

      // Buscar a Rota Base planejada para o dia da semana corrente (1-7)
      // JS `new Date().getDay()` -> 0: Domingo, 1: Segunda, ..., 6: Sábado
      const diaSemanaJs = new Date().getDay();
      const diaSemanaPg = diaSemanaJs === 0 ? 7 : diaSemanaJs;

       const { data: rotaBase } = await supabase
        .from("cm_promotor_carteira_pdv")
        .select(`
          *,
          pdv:base_atendimento(is_star)
        `)
        .eq("promotor_id", targetPromotorId)
        .eq("dia_semana", diaSemanaPg);

      // Buscar missões de trade marketing dinâmicas vigentes para este promotor/PDV
      const { data: missoesPdv } = await supabase
        .from("cm_trade_missao_pdv")
        .select(`
          missao_id,
          cod_parceiro,
          missao:cm_trade_missao(*),
          pdv:base_atendimento(is_star)
        `)
        .eq("promotor_id", targetPromotorId)
        .eq("status", "PENDENTE");

      const missoesAtivas = missoesPdv?.filter(m => {
        if (!m.missao) return false;
        const mInfo = m.missao as any;
        const inicio = new Date(mInfo.data_inicio);
        const fim = new Date(mInfo.data_fim);
        const hoje = new Date(dataHoje);
        return hoje >= inicio && hoje <= fim;
      }) || [];

      // Consolidar visitas a serem inseridas
      const visitasParaInserir: any[] = [];

      // Adicionar PDVs da Rota Base
      if (rotaBase && rotaBase.length > 0) {
        rotaBase.forEach((pdv: any) => {
          const isStar = pdv.pdv?.is_star || false;
          visitasParaInserir.push({
            agenda_diaria_id: agenda.id,
            cod_parceiro: pdv.cod_parceiro,
            tipo_visita: "ROTA_BASE",
            criticidade_visita: isStar ? "OBRIGATORIA" : (pdv.criticidade_visita || "NORMAL"),
            motivo_visita: pdv.motivo_visita || "rotina",
            status: "PLANEJADA",
            duracao_estimada_min: pdv.duracao_estimada_min || 60
          });
        });
      }

      // Adicionar Missões Dinâmicas extras (se o PDV da missão não estiver na Rota Base do dia)
      missoesAtivas.forEach(missao => {
        const jaEstaNaRota = visitasParaInserir.some(v => v.cod_parceiro === missao.cod_parceiro);
        if (!jaEstaNaRota) {
          const missaoData = missao.missao as any;
          const isStar = (missao.pdv as any)?.is_star || false;
          // Determina a criticidade com base na prioridade da missão ou status estrela
          let criticidade: "OBRIGATORIA" | "ALTA" | "NORMAL" | "BAIXA" = "NORMAL";
          const p = missaoData.prioridade || 50;
          if (isStar) criticidade = "OBRIGATORIA";
          else if (p >= 90) criticidade = "OBRIGATORIA";
          else if (p >= 70) criticidade = "ALTA";
          else if (p >= 40) criticidade = "NORMAL";
          else criticidade = "BAIXA";

          visitasParaInserir.push({
            agenda_diaria_id: agenda.id,
            cod_parceiro: missao.cod_parceiro,
            tipo_visita: "MISSAO_EXTRA",
            criticidade_visita: criticidade,
            motivo_visita: "auditoria_trade",
            status: "PLANEJADA",
            duracao_estimada_min: missaoData.sla_minutos || 30
          });
        }
      });

      // Inserir visitas criadas em lote se houver alguma
      if (visitasParaInserir.length > 0) {
        const { error: insertVisitasError } = await supabase
          .from("cm_promotor_visita")
          .insert(visitasParaInserir);

        if (insertVisitasError) {
          console.error("[AGENDA GET] Erro ao inserir visitas do dia:", insertVisitasError);
          // Opcional: deletar a agenda diária criada para manter atomicidade
          await supabase.from("cm_promotor_agenda_diaria").delete().eq("id", agenda.id);
          return NextResponse.json({ success: false, error: "Erro ao gerar visitas da agenda diária." }, { status: 500 });
        }
      }
    }

    // 3. Buscar todas as visitas geradas para a agenda
    const { data: visitas, error: fetchVisitasError } = await supabase
      .from("cm_promotor_visita")
      .select(`
        *,
        pdv:base_atendimento(
          cod_parceiro, 
          nome_fantasia, 
          razao_social,
          geoloc:cm_promotor_pdv_geoloc(latitude, longitude, geofence_radius_m)
        )
      `)
      .eq("agenda_diaria_id", agenda.id);

    if (fetchVisitasError) {
      console.error("[AGENDA GET] Erro ao buscar visitas cadastradas:", fetchVisitasError);
      return NextResponse.json({ success: false, error: "Erro ao listar visitas." }, { status: 500 });
    }

    // 4. Aplicar o Algoritmo de Ordenação Inteligente por Score Composto
    let visitasOrdenadas = [...(visitas || [])];

    if (promotorLat !== null && promotorLon !== null) {
      // Ordenação Inteligente (GPS do Promotor fornecido):
      // Score = (Crit_Score * 0.6) + (Dist_Score * 0.4)
      visitasOrdenadas = visitasOrdenadas.map(v => {
        const latLoja = v.pdv?.geoloc?.latitude;
        const lonLoja = v.pdv?.geoloc?.longitude;
        let distScore = 0;
        let distanciaMetros = null;

        if (latLoja && lonLoja) {
          distanciaMetros = calculateDistanceM(promotorLat, promotorLon, latLoja, lonLoja);
          // Normalização de distância: quanto menor a distância em km, maior o score (limite superior de 1)
          const distKm = distanciaMetros / 1000;
          distScore = 1 / (1 + distKm);
        }

        // Pontuação de Criticidade
        let critScore = 0.5; // NORMAL
        if (v.criticidade_visita === "OBRIGATORIA") critScore = 1.0;
        else if (v.criticidade_visita === "ALTA") critScore = 0.75;
        else if (v.criticidade_visita === "NORMAL") critScore = 0.5;
        else if (v.criticidade_visita === "BAIXA") critScore = 0.25;

        // Cálculo composto
        const scoreComposto = critScore * 0.6 + distScore * 0.4;

        return {
          ...v,
          distancia_calculada_m: distanciaMetros ? Math.round(distanciaMetros) : null,
          score_ordenacao: scoreComposto
        };
      });

      // Ordenar decrescente por score composto
      visitasOrdenadas.sort((a, b) => (b.score_ordenacao || 0) - (a.score_ordenacao || 0));
    } else {
      // Sem GPS: ordena prioritariamente por criticidade e depois por ID (estabilidade de visualização)
      const pesoCriticidadeMap: Record<string, number> = {
        OBRIGATORIA: 4,
        ALTA: 3,
        NORMAL: 2,
        BAIXA: 1
      };

      visitasOrdenadas.sort((a, b) => {
        const pesoA = pesoCriticidadeMap[a.criticidade_visita] || 2;
        const pesoB = pesoCriticidadeMap[b.criticidade_visita] || 2;
        if (pesoB !== pesoA) {
          return pesoB - pesoA;
        }
        return a.created_at.localeCompare(b.created_at);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        agenda_diaria_id: agenda.id,
        data_agenda: agenda.data_agenda,
        promotor_id: targetPromotorId,
        jornada_id: agenda.jornada_id,
        visitas: visitasOrdenadas
      }
    });

  } catch (error: unknown) {
    console.error("[AGENDA GET] Erro fatal:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar agenda."
    }, { status: 500 });
  }
}
