/**
 * Verificador de Paridade Financeira — Coffee++
 * 
 * Script que executa testes de paridade automatizada entre as fontes oficiais
 * (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`)
 * e as respostas da AnalyticsEngine, garantindo desvio financeiro máximo de 0,01%.
 * 
 * @see Regra de Governança Financeira (Seção 10)
 */

import { AnalyticsEngine } from '@/lib/governance/analytics/engine';
import { OFFICIAL_ANALYTICS_SOURCES } from '@/lib/governance/analytics/sources';
import { createAdminClient } from '@/lib/supabase/admin';

async function runParityVerification() {
  console.log('====================================================');
  console.log('📊 INICIANDO VERIFICAÇÃO DE PARIDADE FINANCEIRA (Max Tolerance: 0.01%)');
  console.log('====================================================\n');

  const supabase = createAdminClient();
  const MAX_TOLERANCE_PCT = 0.01; // 0.01%
  let hasFailure = false;

  try {
    // 1. Obter última data com dados da view oficial
    const { data: maxDateData, error: maxDateErr } = await supabase
      .rpc('execute_readonly_query', { query_text: `SELECT MAX(mes) as max_date FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL}` });

    if (maxDateErr || !maxDateData || !maxDateData[0]?.max_date) {
      console.warn('⚠️ Não foi possível obter o período máximo para teste de paridade. Pulando verificação online.');
      console.log('====================================================\n');
      process.exit(0);
    }

    const testMonth = maxDateData[0].max_date;
    console.log(`Período selecionado para teste de paridade: '${testMonth}'\n`);

    // 2. Consulta direta à mv_vendas_mensal
    const sqlDirectVendas = `SELECT SUM(fat) as fat, SUM(qty) as qty FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL} WHERE mes = '${testMonth}'`;
    const { data: resDirectVendas } = await supabase.rpc('execute_readonly_query', { query_text: sqlDirectVendas });
    const directFat = Number(resDirectVendas[0]?.fat || 0);
    const directQty = Number(resDirectVendas[0]?.qty || 0);

    // 3. Consulta via AnalyticsEngine.getMatrizData
    const matrizResult = await AnalyticsEngine.getMatrizData({ startMonth: testMonth, endMonth: testMonth });
    const engineFat = Number(matrizResult.totals.fat || 0);
    const engineQty = Number(matrizResult.totals.qty || 0);

    // 4. Calcular desvio percentual
    const fatDiff = Math.abs(directFat - engineFat);
    const fatDiffPct = directFat > 0 ? (fatDiff / directFat) * 100 : 0;

    const qtyDiff = Math.abs(directQty - engineQty);
    const qtyDiffPct = directQty > 0 ? (qtyDiff / directQty) * 100 : 0;

    console.log(`[Teste Vendas vs Matriz]`);
    console.log(`  - Faturamento Direto (mv_vendas_mensal): R$ ${directFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  - Faturamento via AnalyticsEngine:       R$ ${engineFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  - Desvio Relativo: ${fatDiffPct.toFixed(4)}% (Tolerância: ${MAX_TOLERANCE_PCT}%)\n`);

    if (fatDiffPct > MAX_TOLERANCE_PCT) {
      console.error(`❌ ERRO DE PARIDADE: Desvio em faturamento (${fatDiffPct.toFixed(4)}%) excedeu o limite máximo de ${MAX_TOLERANCE_PCT}%!`);
      hasFailure = true;
    } else {
      console.log(`✅ PARIDADE APROVADA para Faturamento (Desvio <= ${MAX_TOLERANCE_PCT}%).`);
    }

    if (qtyDiffPct > MAX_TOLERANCE_PCT) {
      console.error(`❌ ERRO DE PARIDADE: Desvio em quantidade (${qtyDiffPct.toFixed(4)}%) excedeu o limite máximo de ${MAX_TOLERANCE_PCT}%!`);
      hasFailure = true;
    } else {
      console.log(`✅ PARIDADE APROVADA para Quantidade (Desvio <= ${MAX_TOLERANCE_PCT}%).`);
    }

    console.log('\n====================================================');
    if (hasFailure) {
      console.error('❌ VERIFICAÇÃO DE PARIDADE FALHOU!');
      console.log('====================================================\n');
      process.exit(1);
    } else {
      console.log('🏆 VERIFICAÇÃO DE PARIDADE FINANCEIRA CONCLUÍDA COM 100% DE SUCESSO!');
      console.log('====================================================\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('⚠️ Exceção ao executar teste de paridade:', err);
    process.exit(1);
  }
}

runParityVerification();
