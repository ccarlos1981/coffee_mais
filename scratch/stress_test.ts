import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias em .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

function getPercentile(times: number[], p: number): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function getAverage(times: number[]): number {
  if (times.length === 0) return 0;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

async function runStressTest() {
  console.log("==================================================");
  console.log("        INICIANDO STRESS TEST — SPRINT 7        ");
  console.log("==================================================");
  console.log(`URL do Banco: ${supabaseUrl}`);

  // ---- TESTE 1: Concorrência na geração de código amigável ----
  console.log("\n1. Testando concorrência na geração do código de campanha...");
  const concurrencyCount = 50;
  const friendlyCodeTimes: number[] = [];
  let friendlyCodeFailures = 0;
  
  const friendlyCodePromises = Array.from({ length: concurrencyCount }).map(async (_, idx) => {
    const start = Date.now();
    try {
      const { data, error } = await supabase
        .from('cm_campanhas')
        .insert({
          nome_campanha: `Campanha Concorrente ${idx}`,
          rede: 'CONCURRENCY_TEST',
          mes_referencia: '2026-07',
          status_operacional: 'PLANEJAMENTO',
          status_financeiro: 'ABERTA'
        })
        .select('id, codigo_campanha')
        .single();
      
      friendlyCodeTimes.push(Date.now() - start);
      if (error) throw error;
      return data;
    } catch (err) {
      friendlyCodeFailures++;
      return null;
    }
  });

  const createdCampaigns = await Promise.all(friendlyCodePromises);
  const validCampaigns = createdCampaigns.filter(Boolean);
  const codes = validCampaigns.map(c => c!.codigo_campanha);
  const uniqueCodes = new Set(codes);

  console.log(`   - Campanhas criadas: ${validCampaigns.length}/${concurrencyCount}`);
  console.log(`   - Códigos únicos gerados: ${uniqueCodes.size}/${validCampaigns.length}`);
  console.log(`   - Falhas/Colisões físicas de unique constraint: ${friendlyCodeFailures}`);
  console.log(`   - Latência Geração Código: Méd= ${getAverage(friendlyCodeTimes).toFixed(1)}ms, p95= ${getPercentile(friendlyCodeTimes, 95)}ms, p99= ${getPercentile(friendlyCodeTimes, 99)}ms`);

  // ---- TESTE 2: Carga Massiva (1.000 campanhas e 5.000 ações) ----
  console.log("\n2. Inserindo 1.000 campanhas em lotes concorrentes (simulando 50 conexões simultâneas)...");
  const totalCampaigns = 1000;
  const campaignTimes: number[] = [];
  let campaignFailures = 0;
  const campaignIds: string[] = [];

  const campaignBatches = Math.ceil(totalCampaigns / 50);
  for (let b = 0; b < campaignBatches; b++) {
    const promises = Array.from({ length: 50 }).map(async (_, idx) => {
      const globalIdx = b * 50 + idx;
      if (globalIdx >= totalCampaigns) return;
      const start = Date.now();
      try {
        const { data, error } = await supabase
          .from('cm_campanhas')
          .insert({
            nome_campanha: `Campanha Massa ${globalIdx}`,
            rede: `REDE_MASSA_${globalIdx % 10}`,
            mes_referencia: '2026-08',
            status_operacional: 'PLANEJAMENTO',
            status_financeiro: 'ABERTA'
          })
          .select('id')
          .single();
        campaignTimes.push(Date.now() - start);
        if (error) throw error;
        if (data) campaignIds.push(data.id);
      } catch (err) {
        campaignFailures++;
      }
    });
    await Promise.all(promises);
  }

  console.log(`   - Campanhas inseridas: ${campaignIds.length}/${totalCampaigns}`);
  console.log(`   - Falhas na criação: ${campaignFailures}`);
  console.log(`   - Latência Campanhas: Méd= ${getAverage(campaignTimes).toFixed(1)}ms, p95= ${getPercentile(campaignTimes, 95)}ms, p99= ${getPercentile(campaignTimes, 99)}ms`);

  console.log("\n3. Inserindo 5.000 ações em lotes concorrentes (simulando 50 conexões simultâneas)...");
  const totalActions = 5000;
  const actionTimes: number[] = [];
  let actionFailures = 0;
  const actionIds: string[] = [];

  const actionBatches = Math.ceil(totalActions / 50);
  for (let b = 0; b < actionBatches; b++) {
    const promises = Array.from({ length: 50 }).map(async (_, idx) => {
      const globalIdx = b * 50 + idx;
      if (globalIdx >= totalActions) return;
      const campaignId = campaignIds[globalIdx % campaignIds.length];
      const start = Date.now();
      try {
        const { data, error } = await supabase
          .from('cm_acoes_investimento')
          .insert({
            campanha_id: campaignId,
            rede: `REDE_MASSA_${globalIdx % 10}`,
            tipo_acao: 'Sell Out',
            familia_produto: 'Grão',
            valor_investimento: 10,
            expectativa_volume: 100,
            fase_atual: 1,
            status_financeiro: 'NAO_FATURADA',
            data_inicio: '2026-08-01',
            data_fim: '2026-08-31'
          })
          .select('id')
          .single();
        actionTimes.push(Date.now() - start);
        if (error) throw error;
        if (data) actionIds.push(data.id);
      } catch (err) {
        actionFailures++;
      }
    });
    await Promise.all(promises);
  }

  console.log(`   - Ações inseridas: ${actionIds.length}/${totalActions}`);
  console.log(`   - Falhas na criação: ${actionFailures}`);
  console.log(`   - Latência Ações: Méd= ${getAverage(actionTimes).toFixed(1)}ms, p95= ${getPercentile(actionTimes, 95)}ms, p99= ${getPercentile(actionTimes, 99)}ms`);

  // ---- TESTE 3: Edição simultânea da mesma campanha ----
  console.log("\n4. Testando edição concorrente da mesma campanha...");
  const targetCampaignId = campaignIds[0];
  const editTimes: number[] = [];
  let editFailures = 0;

  const editPromises = Array.from({ length: 50 }).map(async (_, idx) => {
    const start = Date.now();
    try {
      const { error } = await supabase
        .from('cm_campanhas')
        .update({ nome_campanha: `Campanha Editada Concorrente ${idx}` })
        .eq('id', targetCampaignId);
      editTimes.push(Date.now() - start);
      if (error) throw error;
    } catch (err) {
      editFailures++;
    }
  });
  await Promise.all(editPromises);

  console.log(`   - Edições bem-sucedidas: ${concurrencyCount - editFailures}/${concurrencyCount}`);
  console.log(`   - Locks/Falhas detectadas: ${editFailures}`);
  console.log(`   - Latência Edição: Méd= ${getAverage(editTimes).toFixed(1)}ms, p95= ${getPercentile(editTimes, 95)}ms, p99= ${getPercentile(editTimes, 99)}ms`);

  // ---- TESTE 4: Upload simultâneo de evidências para a mesma ação ----
  console.log("\n5. Testando concorrência no upload de evidências para a mesma ação...");
  const targetActionId = actionIds[0];
  const evidenceTimes: number[] = [];
  let evidenceFailures = 0;

  // Garantir que a ação alvo está com array vazio
  await supabase.from('cm_acoes_investimento').update({ evidencias_urls: [] }).eq('id', targetActionId);

  const evidencePromises = Array.from({ length: 50 }).map(async (_, idx) => {
    const start = Date.now();
    try {
      // Usaremos transação simples (leitura e append)
      const { data: action } = await supabase
        .from('cm_acoes_investimento')
        .select('evidencias_urls')
        .eq('id', targetActionId)
        .single();
      
      const current = action?.evidencias_urls || [];
      const { error } = await supabase
        .from('cm_acoes_investimento')
        .update({ evidencias_urls: [...current, `evidence_${idx}.pdf`] })
        .eq('id', targetActionId);
      
      evidenceTimes.push(Date.now() - start);
      if (error) throw error;
    } catch (err) {
      evidenceFailures++;
    }
  });
  await Promise.all(evidencePromises);

  console.log(`   - Evidências anexadas: ${concurrencyCount - evidenceFailures}/${concurrencyCount}`);
  console.log(`   - Falhas/Deadlocks detectados: ${evidenceFailures}`);
  console.log(`   - Latência Upload: Méd= ${getAverage(evidenceTimes).toFixed(1)}ms, p95= ${getPercentile(evidenceTimes, 95)}ms, p99= ${getPercentile(evidenceTimes, 99)}ms`);

  // ---- LIMPEZA ----
  console.log("\n6. Limpando dados de teste do banco de dados...");
  
  const { error: delActErr } = await supabase
    .from('cm_acoes_investimento')
    .delete()
    .or('rede.like.REDE_MASSA_%,rede.eq.CONCURRENCY_TEST');
    
  if (delActErr) console.error("   - Erro ao remover ações de teste:", delActErr);
  
  const { error: delCampErr } = await supabase
    .from('cm_campanhas')
    .delete()
    .or('rede.like.REDE_MASSA_%,rede.eq.CONCURRENCY_TEST');
    
  if (delCampErr) console.error("   - Erro ao remover campanhas de teste:", delCampErr);

  console.log("✅ Carga de teste limpa com sucesso!");
  console.log("==================================================");
}

runStressTest().catch(console.error);
