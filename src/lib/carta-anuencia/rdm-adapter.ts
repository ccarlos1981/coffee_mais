/**
 * 🏛️ COFFEE++ — ADAPTER DO RDM PARA CARTA DE ANUÊNCIA (SLIDE 15)
 * 
 * Regras de Governança:
 * 1. ZERO Hardcoding de competência (sem competência fixa ou fallback arbitrário).
 * 2. Determinação determinística da competência operacional (ciclo não encerrado com cartas emitidas).
 * 3. Consumo estrito do SSOT `obterDadosFarolGerencial` (sem duplicar regra de status de cartas).
 * 4. Consumo direto de `cartas_para_assinar`, `cartas_assinadas`, `total_cartas` e `pct_cartas_assinadas`.
 * 5. TOTAL BRASIL com recálculo matemático de percentual: (total_assinadas / total_cartas) * 100.
 * 6. Suporte aos 4 gerentes canônicos: JULLIANO, LEANDRO, LUIZ, JOHN GUEDES.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { obterDadosFarolGerencial } from "@/app/investimento/carta-anuencia/actions";

export interface RdmCartaAnuenciaItem {
  posicao: number;
  gerente: string; // Nome canônico: 'JULLIANO' | 'LEANDRO' | 'LUIZ' | 'JOHN GUEDES'
  total_cartas: number;
  cartas_para_assinar: number;
  cartas_assinadas: number;
  pct_cartas_assinadas: number;
}

export interface RdmCartaAnuenciaData {
  competencia: string | null;
  status: "OK" | "SEM_COMPETENCIA_COM_CARTAS" | "SEM_COMPETENCIA_VIGENTE";
  ranking: RdmCartaAnuenciaItem[];
  totalBrasil: {
    total_cartas: number;
    cartas_para_assinar: number;
    cartas_assinadas: number;
    pct_cartas_assinadas: number;
  };
}

/**
 * Mapeia o nome do gerente retornado pelo módulo de Cartas para a convenção canônica do RDM.
 */
export function toCanonicalManagerName(raw: string): string {
  const norm = (raw || "").trim().toUpperCase();
  if (norm.includes("LEANDRO")) return "LEANDRO";
  if (norm.includes("JULLIANO")) return "JULLIANO";
  if (norm.includes("LUIZ")) return "LUIZ";
  if (norm.includes("JOHN")) return "JOHN GUEDES";
  return norm;
}

/**
 * Determina dinamicamente a competência operacional oficial de Carta de Anuência para o RDM:
 * Regra Canônica (PO 10/09/2026):
 * 1. Consultar cm_competencias_anuencia;
 * 2. Considerar somente competências com encerrada = false;
 * 3. Verificar quais dessas competências possuem pelo menos uma carta em cm_cartas_anuencia com status != 'CANCELADA';
 * 4. Ordenar as competências elegíveis por data_inicio DESC;
 * 5. Selecionar a primeira;
 * 6. Se nenhuma competência não encerrada possuir cartas emitidas, retornar null (estado seguro).
 */
export async function obterCompetenciaOperacionalCartaAnuencia(
  supabaseClient = createAdminClient(),
  overrideData?: {
    competencias?: Array<{ competencia: string; data_inicio: string; encerrada: boolean }>;
    cartasAtivas?: Array<{ competencia: string; status: string }>;
  }
): Promise<string | null> {
  // Se dados de override foram fornecidos (para testes semânticos sem mutação de banco)
  if (overrideData) {
    const elegiveisComp = (overrideData.competencias || [])
      .filter((c) => !c.encerrada)
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));

    const comCartas = new Set(
      (overrideData.cartasAtivas || [])
        .filter((c) => c.status !== "CANCELADA")
        .map((c) => c.competencia)
    );

    const match = elegiveisComp.find((c) => comCartas.has(c.competencia));
    return match?.competencia || null;
  }

  // 1. Consultar cm_competencias_anuencia com encerrada = false ordenadas por data_inicio DESC
  const { data: competencias, error: compErr } = await supabaseClient
    .from("cm_competencias_anuencia")
    .select("competencia, data_inicio, encerrada")
    .eq("encerrada", false)
    .order("data_inicio", { ascending: false });

  if (compErr || !competencias || competencias.length === 0) {
    return null;
  }

  // 2. Verificar quais dessas competências possuem pelo menos uma carta ativa (status != 'CANCELADA')
  const nomesCompetencias = competencias.map((c) => c.competencia);
  const { data: cartasAtivas, error: cartasErr } = await supabaseClient
    .from("cm_cartas_anuencia")
    .select("competencia")
    .neq("status", "CANCELADA")
    .in("competencia", nomesCompetencias);

  if (cartasErr || !cartasAtivas || cartasAtivas.length === 0) {
    return null;
  }

  const competenciasComCartas = new Set(cartasAtivas.map((c) => c.competencia));

  // 3. A primeira competência em ordem decrescente de data_inicio que possui cartas ativas é selecionada
  const elegivel = competencias.find((c) => competenciasComCartas.has(c.competencia));
  return elegivel?.competencia || null;
}

/**
 * Alias retrocompatível para obterCompetenciaOperacionalCartaAnuencia.
 */
export const obterCompetenciaVigenteCartaAnuencia = obterCompetenciaOperacionalCartaAnuencia;

/**
 * Obtém os dados consolidados do Ranking de Assinatura para o Slide 15 do RDM.
 */
export async function getRdmCartaAnuenciaData(): Promise<RdmCartaAnuenciaData> {
  try {
    const competenciaOperacional = await obterCompetenciaOperacionalCartaAnuencia();

    if (!competenciaOperacional) {
      return {
        competencia: null,
        status: "SEM_COMPETENCIA_COM_CARTAS",
        ranking: [],
        totalBrasil: {
          total_cartas: 0,
          cartas_para_assinar: 0,
          cartas_assinadas: 0,
          pct_cartas_assinadas: 0,
        },
      };
    }

    // Consome estritamente o SSOT oficial do módulo Carta de Anuência
    const resumo = await obterDadosFarolGerencial({ competencia: competenciaOperacional });

    const rawRanking = resumo.ranking_assinatura || [];

    // Mapeamento dos gerentes respeitando o ranking e valores entregues pelo SSOT
    const ranking: RdmCartaAnuenciaItem[] = rawRanking.map((item, idx) => ({
      posicao: item.posicao || (idx + 1),
      gerente: toCanonicalManagerName(item.gerente),
      total_cartas: Number(item.total_cartas || 0),
      cartas_para_assinar: Number(item.cartas_para_assinar || 0),
      cartas_assinadas: Number(item.cartas_assinadas || 0),
      pct_cartas_assinadas: Number(item.pct_cartas_assinadas || 0),
    }));

    // TOTAL BRASIL: soma dos 4 gerentes e recálculo do percentual nacional
    const total_cartas = ranking.reduce((acc, i) => acc + i.total_cartas, 0);
    const cartas_para_assinar = ranking.reduce((acc, i) => acc + i.cartas_para_assinar, 0);
    const cartas_assinadas = ranking.reduce((acc, i) => acc + i.cartas_assinadas, 0);
    const pct_cartas_assinadas = total_cartas > 0
      ? Number(((cartas_assinadas / total_cartas) * 100).toFixed(1))
      : 0;

    return {
      competencia: competenciaOperacional,
      status: "OK",
      ranking,
      totalBrasil: {
        total_cartas,
        cartas_para_assinar,
        cartas_assinadas,
        pct_cartas_assinadas,
      },
    };
  } catch (err) {
    console.error("[RDM Adapter] Erro ao obter dados de Carta de Anuência:", err);
    return {
      competencia: null,
      status: "SEM_COMPETENCIA_COM_CARTAS",
      ranking: [],
      totalBrasil: {
        total_cartas: 0,
        cartas_para_assinar: 0,
        cartas_assinadas: 0,
        pct_cartas_assinadas: 0,
      },
    };
  }
}
