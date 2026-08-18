import fs from 'fs';

const envFile = fs.readFileSync('/Users/cristiano/Projetos/Coffe Mais/.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

import { createClient } from '/Users/cristiano/Projetos/Coffe Mais/node_modules/@supabase/supabase-js';
import { AnalyticsEngine } from '/Users/cristiano/Projetos/Coffe Mais/src/lib/governance/analytics/engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function auditFallbackImpact() {
  console.log("================================================================================");
  console.log("     AUDITORIA DE REGRESSÃO DO FALLBACK DA COLUNA 'rede' — DEMANDA 027         ");
  console.log("================================================================================\n");

  // 1. Verificar registros com rede = '' ou rede IS NULL em public.sales
  console.log("1. Análise de registros com rede vazia ou NULL em public.sales (Agosto/2026):");
  const { data: redeStats } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COUNT(*) as total_rows,
        COUNT(CASE WHEN rede IS NULL THEN 1 END) as rede_null_count,
        COUNT(CASE WHEN rede = '' THEN 1 END) as rede_empty_string_count,
        COUNT(CASE WHEN rede IS NOT NULL AND rede != '' THEN 1 END) as rede_filled_count,
        SUM(CASE WHEN rede IS NULL THEN net_value ELSE 0 END) as fat_rede_null,
        SUM(CASE WHEN rede = '' THEN net_value ELSE 0 END) as fat_rede_empty,
        SUM(CASE WHEN rede IS NOT NULL AND rede != '' THEN net_value ELSE 0 END) as fat_rede_filled
      FROM public.sales
      WHERE ano_mes = '2026_08'
    `
  });
  console.table(redeStats);

  // 2. Teste comparativo entre os dois comportamentos de getVendasSummary
  console.log("\n2. Comparação getVendasSummary:");
  // A) Com NULLIF(TRIM(rede), '')
  const { data: queryA } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COALESCE(NULLIF(TRIM(rede), ''), nome_parceiro, 'Não Mapeado') as rede_label,
        COUNT(DISTINCT cod_parceiro) as distinct_partners,
        SUM(net_value) as fat_total
      FROM public.sales
      WHERE ano_mes = '2026_08'
      GROUP BY COALESCE(NULLIF(TRIM(rede), ''), nome_parceiro, 'Não Mapeado')
      ORDER BY fat_total DESC
      LIMIT 10
    `
  });

  // B) Com comportamento padrão COALESCE(rede, 'Não Mapeado')
  const { data: queryB } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COALESCE(rede, 'Não Mapeado') as rede_label,
        COUNT(DISTINCT cod_parceiro) as distinct_partners,
        SUM(net_value) as fat_total
      FROM public.sales
      WHERE ano_mes = '2026_08'
      GROUP BY COALESCE(rede, 'Não Mapeado')
      ORDER BY fat_total DESC
      LIMIT 10
    `
  });

  console.log("Top 10 Redes (Com Fallback nome_parceiro para redes vazias):");
  console.table(queryA);

  console.log("Top 10 Redes (Sem Fallback - Apenas rede):");
  console.table(queryB);

  // 3. Auditoria de outros módulos
  console.log("\n3. Auditoria dos Módulos Downstream:");
  
  // DRE Comercial
  const dre = await AnalyticsEngine.getDreComercial({ startMonth: '2026-08', endMonth: '2026-08' });
  console.log("DRE Sintética Totais:", dre?.totais);

  // Cockpit Comercial
  const cockpit = await AnalyticsEngine.getCockpitComercial({ startMonth: '2026-08', endMonth: '2026-08' });
  console.log("Cockpit Metrics:", cockpit?.metrics);

  // CRM Comercial
  const crm = await AnalyticsEngine.getCrmComercial({ startMonth: '2026-08', endMonth: '2026-08' });
  console.log("CRM Resumo Carteira:", crm?.resumoCarteira);

  // RPS (vw_redes_planejaveis_oficiais)
  const { data: rpsRows } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT COUNT(*) as total_redes_planejaveis FROM public.vw_redes_planejaveis_oficiais`
  });
  console.log("RPS Total Redes Planejáveis:", rpsRows?.[0]);
}

auditFallbackImpact();
