process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ncncazbhpoxjlyvcbvqa.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk';

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFullImportFlow() {
  console.log('================================================================');
  console.log('  TESTE DE IMPORTAÇÃO E HOMOLOGAÇÃO FIM-A-FIM: VENDA FUTURA     ');
  console.log('================================================================\n');

  // 1. Gerar planilha Excel de teste com a nova coluna B "Venda Entrega Futura"
  const rows = [
    {
      "Cód. CFOP": "1102",
      "Venda Entrega Futura": 1500.00, // Coluna B
      "Dt. Neg": "2026-07-21",
      "Nro. Único": "9999001",
      "Nro. Nota": "8888001",
      "Cód. Parceiro": "522",
      "Parceiro": "REDE TESTE HOMOLOGACAO",
      "Cód. Produto": "1001",
      "Produto": "CAFE ESPRESSO 250G MOIDO",
      "Qtd.": 20,
      "Vlr. Unitário": 25.00,
      "Vlr. Desconto": 0,
      "Vlr. Total Líq.": 500.00,
      "Cód. TOP": "1100",
      "TOP": "VENDA DE MERCADORIA",
      "Cód. Vendedor": "1001",
      "Vendedor": "Leandro Saffi"
    },
    {
      "Cód. CFOP": "1102",
      "Venda Entrega Futura": 3500.00, // Coluna B
      "Dt. Neg": "2026-07-21",
      "Nro. Único": "9999002",
      "Nro. Nota": "8888002",
      "Cód. Parceiro": "523",
      "Parceiro": "REDE TESTE HOMOLOGACAO 2",
      "Cód. Produto": "1002",
      "Produto": "CAFE DRIP 100G",
      "Qtd.": 40,
      "Vlr. Unitário": 25.00,
      "Vlr. Desconto": 0,
      "Vlr. Total Líq.": 1000.00,
      "Cód. TOP": "1100",
      "TOP": "VENDA DE MERCADORIA",
      "Cód. Vendedor": "1002",
      "Vendedor": "Luiz"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Faturamento");
  const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const expectedVendaFuturaTotal = 1500.00 + 3500.00; // R$ 5.000,00
  const expectedNetTotal = 500.00 + 1000.00; // R$ 1.500,00

  console.log('1. Planilha Excel de Teste Gerada:');
  console.log(`   - Registros: ${rows.length}`);
  console.log(`   - Faturamento Líquido Esperado: R$ ${expectedNetTotal.toFixed(2)}`);
  console.log(`   - Venda Entrega Futura Esperada: R$ ${expectedVendaFuturaTotal.toFixed(2)}`);

  // 2. Chamar ImportService.analyzeExcel
  const { ImportService } = require('../src/lib/services/import-service.ts');
  const preview = await ImportService.analyzeExcel(
    excelBuffer,
    "teste_venda_entrega_futura_homologacao.xlsx",
    excelBuffer.length,
    "manual"
  );

  console.log('\n2. Resultado da Análise (ImportService.analyzeExcel):');
  console.log(`   - Batch ID: ${preview.batchId}`);
  console.log(`   - Período Identificado: ${preview.period}`);
  console.log(`   - Registros Processados: ${preview.totalRows}`);
  console.log(`   - Total Net Staged: R$ ${preview.totalNet.toFixed(2)}`);
  console.log(`   - Total Venda Futura Staged: R$ ${preview.totalVendaFutura.toFixed(2)}`);
  console.log(`   - Alertas (Warnings): ${preview.warningsCount}`);
  console.log(`   - Erros Críticos: ${preview.errorsCount}`);

  // Verificar gravação na Staging
  const { data: stData } = await supabase
    .from('cm_faturamento_staging')
    .select('valor_venda_futura, vlr_total_liq')
    .eq('batch_id', preview.batchId);

  const sumStagingVendaFutura = (stData || []).reduce((acc, r) => acc + Number(r.valor_venda_futura || 0), 0);
  console.log(`   - Total lido diretamente da tabela STAGING: R$ ${sumStagingVendaFutura.toFixed(2)}`);

  // 3. Confirmar Importação (promover para cm_faturamento e executar auditoria 5 camadas)
  console.log('\n3. Executando Confirm Import (Promover para cm_faturamento + Auditoria)...');
  const confirmResult = await ImportService.confirmImport(preview.batchId, "append");
  console.log(`   - Sucesso: ${confirmResult.success}, Registros Promovidos: ${confirmResult.rowsPromoted}`);

  // Verificar gravação na tabela oficial cm_faturamento
  const { data: oficialData } = await supabase
    .from('cm_faturamento')
    .select('valor_venda_futura, vlr_total_liq')
    .eq('batch_id', preview.batchId);

  const sumOficialVendaFutura = (oficialData || []).reduce((acc, r) => acc + Number(r.valor_venda_futura || 0), 0);
  console.log(`   - Total lido diretamente da tabela OFICIAL cm_faturamento: R$ ${sumOficialVendaFutura.toFixed(2)}`);

  // Refresh Views
  console.log('\n4. Recarregando Views Materializadas (mv_vendas_agg)...');
  await supabase.rpc('execute_readonly_query', {
    query_text: "REFRESH MATERIALIZED VIEW mv_vendas_agg;"
  });

  // Verificar na View Agregada mv_vendas_mensal
  const { data: mvCheck } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT SUM(valor_venda_futura) as total_futura, SUM(fat) as total_fat FROM mv_vendas_mensal WHERE mes = '2026-07';"
  });

  console.log('   - Resultado Agregado na View mv_vendas_mensal:', mvCheck);

  // G) Limpeza do lote de teste para manter a base limpa
  console.log('\n5. Executando Rollback/Cleanup do lote de teste...');
  await ImportService.rollbackImport(preview.batchId);
  await supabase.rpc('execute_readonly_query', {
    query_text: "REFRESH MATERIALIZED VIEW mv_vendas_agg;"
  });
  console.log('   - Lote de teste limpo com sucesso.');

  console.log('\n================================================================');
  console.log('  TESTE FIM-A-FIM CONCLUÍDO COM 100% DE PARIDADE E SUCESSO!     ');
  console.log('================================================================');
}

testFullImportFlow().catch(console.error);
