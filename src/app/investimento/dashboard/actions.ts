"use server";

import { createClient } from "@/lib/supabase/server";

export async function obterMetricasEstabilizacao() {
  const supabase = await createClient();

  // Executar queries em paralelo
  const [
    inconsistenciasRes,
    tempoCicloRes,
    roiCampanhaRes,
    roiRedeRes,
    roiFamiliaRes,
    campanhasPorDiaRes,
    mediaAcoesRes,
    campanhasOrfasRes,
    acoesOrfasRes,
    divergenciaRes,
    dailySnapshotsRes
  ] = await Promise.all([
    supabase.rpc('check_investimentos_integrity'),
    supabase.from('v_metrics_tempo_ciclo').select('*'),
    supabase.from('v_metrics_roi_campanha').select('*').order('roi_medio', { ascending: false }).limit(10),
    supabase.from('v_metrics_roi_rede').select('*').order('roi_medio', { ascending: false }).limit(10),
    supabase.from('v_metrics_roi_familia').select('*').order('roi_medio', { ascending: false }).limit(10),
    // Query agrupamento campanhas por dia
    supabase.rpc('get_campanhas_criadas_por_dia'),
    // Query média de ações por campanha
    supabase.rpc('get_media_acoes_por_campanha'),
    // Query campanhas órfãs
    supabase.rpc('get_campanhas_orfas_count'),
    // Query ações órfãs
    supabase.from('cm_acoes_investimento').select('id', { count: 'exact', head: true }).is('campanha_id', null),
    // Query divergência operacional x financeiro (ações quitadas com saldo diferente de zero)
    supabase.rpc('get_divergencias_financeiras_count'),
    // Query histórico de snapshots diários
    supabase.from('cm_investimentos_daily_snapshots').select('*').order('snapshot_date', { ascending: true }).limit(30)
  ]);

  return {
    inconsistencias: inconsistenciasRes.data || [],
    tempoCiclo: tempoCicloRes.data?.[0] || {
      tempo_medio_aprovacao_dias: 0,
      tempo_medio_execucao_dias: 0,
      tempo_medio_quitacao_dias: 0
    },
    roiCampanha: roiCampanhaRes.data || [],
    roiRede: roiRedeRes.data || [],
    roiFamilia: roiFamiliaRes.data || [],
    campanhasPorDia: campanhasPorDiaRes.data || [],
    mediaAcoes: Number(mediaAcoesRes.data) || 0,
    campanhasOrfas: Number(campanhasOrfasRes.data) || 0,
    acoesOrfas: acoesOrfasRes.count || 0,
    divergencias: Number(divergenciaRes.data) || 0,
    dailySnapshots: dailySnapshotsRes.data || []
  };
}
