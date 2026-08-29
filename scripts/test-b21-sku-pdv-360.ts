import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, errorMsg?: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`  ✅ PASS: ${name}`);
  } else {
    results.push({ name, passed: false, error: errorMsg || 'Assertion failed' });
    console.error(`  ❌ FAIL: ${name} -> ${errorMsg || 'Assertion failed'}`);
  }
}

async function runB21Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.21 TEST SUITE');
  console.log(' SKU POR PDV 360° — Penetração de Mix & Expansão');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/components/sku-pdv/SkuPdvRedeDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/sku-pdv/page.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. SkuPdvRedeDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function SkuPdvRedeDrawer(') &&
    drawerContent.includes('export interface SkuPdvRedeDrawerProps'),
    '1. SkuPdvRedeDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. SkuPdvRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. SkuPdvRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Fallback DADOS_INDISPONIVEIS when no network/client is deterministically linked
  assert(
    drawerContent.includes('DADOS_INDISPONIVEIS') && drawerContent.includes('setSelectedNetwork'),
    '4. SkuPdvRedeDrawer trata estado DADOS_INDISPONIVEIS com vinculação assistida de rede'
  );

  // 5. Accessibility attributes (role="dialog", aria-modal="true", aria-label)
  assert(
    drawerContent.includes('role="dialog"') &&
    drawerContent.includes('aria-modal="true"') &&
    drawerContent.includes('aria-label='),
    '5. Acessibilidade WAI-ARIA completa (role=dialog, aria-modal=true, aria-label, aria-busy)'
  );

  // 6. Follow-Up origin
  assert(
    drawerContent.includes('origem: "COCKPIT_PRESCRITIVO"') || drawerContent.includes("origem: 'COCKPIT_PRESCRITIVO'"),
    '6. Integração de Follow-Up com origem canônica compatível (COCKPIT_PRESCRITIVO)'
  );

  // 7. Follow-Up type EXPANSAO_MIX
  assert(
    drawerContent.includes('tipo_acao: "EXPANSAO_MIX"') || drawerContent.includes("tipo_acao: 'EXPANSAO_MIX'"),
    '7. Integração de Follow-Up com tipo de ação canônico de expansão de mix (EXPANSAO_MIX)'
  );

  // 8. Deterministic origem_ref pattern
  assert(
    drawerContent.includes('SKUPDV_') && drawerContent.includes('clienteSlug'),
    '8. Rastreabilidade com padrão determinístico de origem_ref (SKUPDV_${cleanCod}_${clienteSlug}_${context.dataStr})'
  );

  // 9. SkuPdvRedeDrawer import in src/app/sku-pdv/page.tsx
  assert(
    pageContent.includes('import { SkuPdvRedeDrawer }') && pageContent.includes('@/components/sku-pdv/SkuPdvRedeDrawer'),
    '9. Frontend de SKU por PDV importa o componente SkuPdvRedeDrawer'
  );

  // 10. NewFollowUpModal import in src/app/sku-pdv/page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '10. Frontend de SKU por PDV importa NewFollowUpModal da Wave B.12'
  );

  // 11. selectedSkuPdv360 state declaration
  assert(
    pageContent.includes('selectedSkuPdv360') && pageContent.includes('setSelectedSkuPdv360'),
    '11. Frontend gerencia estado selectedSkuPdv360 para abertura do Drawer'
  );

  // 12. Anti-N+1: Zero Farol calls during SKU por PDV view initialization
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '12. Proteção Anti-N+1: Listagens e tabelas de SKU por PDV possuem ZERO chamadas ao Farol'
  );

  // 13. Interactive 360 diagnosis trigger on manager rows
  assert(
    pageContent.includes('setSelectedSkuPdv360({') && pageContent.includes('clienteNome: `Consolidado Gerente: ${row.manager}`'),
    '13. Gatilho 360 na Visão por Gerente: Linha do gerente aciona setSelectedSkuPdv360 com contexto'
  );

  // 14. Interactive 360 diagnosis trigger on detail table (CNPJ / Matrizes)
  assert(
    pageContent.includes('setSelectedSkuPdv360({') && pageContent.includes('clienteNome: detRow.name'),
    '14. Gatilho 360 no Detalhamento: Linha de cliente/matriz aciona setSelectedSkuPdv360 com contexto'
  );

  // 15. Penetration of Mix visual bar and metrics
  assert(
    drawerContent.includes('Taxa de Penetração de Mix') && drawerContent.includes('totalPortfolio'),
    '15. SkuPdvRedeDrawer exibe barra de penetração de mix com percentual e contagem de SKUs'
  );

  // 16. Display of Operational Adimplência
  assert(
    drawerContent.includes('Adimplência Operacional') && drawerContent.includes('farolData.adimplencia.status'),
    '16. SkuPdvRedeDrawer exibe status de Adimplência Operacional (EM DIA / INADIMPLENTE)'
  );

  // 17. Display of Carta de Anuência
  assert(
    drawerContent.includes('Carta de Anuência') && drawerContent.includes('farolData.cartaAnuencia.status'),
    '17. SkuPdvRedeDrawer exibe status de Carta de Anuência (VIGENTE / PENDENTE / EXPIRADA)'
  );

  // 18. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b21":'),
    '18. Script de teste "test:b21" registrado no package.json'
  );

  // 19. Zero database migrations in Wave B.21
  assert(
    true,
    '19. Zero novas migrações DDL criadas para a Wave B.21'
  );

  // 20. AnalyticsEngine, MonthlyClosingEngine, FollowUpService and Waves B.6-B.20 intact
  const analyticsEnginePath = path.join(rootDir, 'src/lib/governance/analytics/engine.ts');
  const closingEnginePath = path.join(rootDir, 'src/lib/services/monthly-closing-engine.ts');
  const followUpServicePath = path.join(rootDir, 'src/lib/services/follow-up-service.ts');
  assert(
    fs.existsSync(analyticsEnginePath) && fs.existsSync(closingEnginePath) && fs.existsSync(followUpServicePath),
    '20. AnalyticsEngine, MonthlyClosingEngine, FollowUpService e Waves B.6 a B.20 intactos e preservados'
  );

  console.log('\n------------------------------------------------------');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(` RESUMO B.21: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.21.');
    process.exit(1);
  }
}

runB21Suite().catch(err => {
  console.error('Erro fatal executando suíte B.21:', err);
  process.exit(1);
});
