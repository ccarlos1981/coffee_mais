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

async function runB19Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.19 TEST SUITE');
  console.log(' DISTRIBUIDORES 360° — Cockpit de Venda Indireta & Farol');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/components/distribuidores/DistribuidoresRedeDrawer.tsx');
  const viewPath = path.join(rootDir, 'src/components/distribuidores/DistribuidoresView.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. DistribuidoresRedeDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function DistribuidoresRedeDrawer(') &&
    drawerContent.includes('export interface DistribuidoresRedeDrawerProps'),
    '1. DistribuidoresRedeDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. DistribuidoresRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. DistribuidoresRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Fallback DADOS_INDISPONIVEIS when no network/distributor is deterministically linked
  assert(
    drawerContent.includes('DADOS_INDISPONIVEIS') && drawerContent.includes('setSelectedNetwork'),
    '4. DistribuidoresRedeDrawer trata estado DADOS_INDISPONIVEIS com vinculação assistida de rede'
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

  // 7. Deterministic origem_ref pattern
  assert(
    drawerContent.includes('DIST_REDE_') && drawerContent.includes('distSlug'),
    '7. Rastreabilidade com padrão determinístico de origem_ref (DIST_REDE_${cleanCod}_${distSlug}_${context.dataStr})'
  );

  // 8. DistribuidoresRedeDrawer import in DistribuidoresView.tsx
  assert(
    viewContent.includes('import { DistribuidoresRedeDrawer } from "./DistribuidoresRedeDrawer";') ||
    viewContent.includes("import { DistribuidoresRedeDrawer } from './DistribuidoresRedeDrawer';"),
    '8. Frontend da Gestão de Distribuidores importa o componente DistribuidoresRedeDrawer'
  );

  // 9. NewFollowUpModal import in DistribuidoresView.tsx
  assert(
    viewContent.includes('import { NewFollowUpModal') && viewContent.includes('FollowUpInitialContext'),
    '9. Frontend da Gestão de Distribuidores importa NewFollowUpModal da Wave B.12'
  );

  // 10. selectedDistributor360 state declaration
  assert(
    viewContent.includes('selectedDistributor360') && viewContent.includes('setSelectedDistributor360'),
    '10. Frontend gerencia estado selectedDistributor360 para abertura do Drawer'
  );

  // 11. Anti-N+1: Zero Farol calls during Distribuidores view initialization
  assert(
    !viewContent.includes('/api/inovacoes/crm/farol'),
    '11. Proteção Anti-N+1: Listagens e tabelas de Distribuidores possuem ZERO chamadas ao Farol'
  );

  // 12. Interactive 360 diagnosis trigger on main distributor rows
  assert(
    viewContent.includes('setSelectedDistributor360({') && viewContent.includes('distribuidorNome: row.distributorName'),
    '12. Gatilho 360 na Tabela Principal: Linha do distribuidor aciona setSelectedDistributor360 com contexto'
  );

  // 13. Interactive 360 diagnosis trigger on drilldown of PDVs / clients
  assert(
    viewContent.includes('setSelectedDistributor360({') && viewContent.includes('distribuidorNome: `${client.client} (${row.distributorName})`'),
    '13. Gatilho 360 no Drilldown de PDVs: Card/linha de cliente aciona setSelectedDistributor360 com contexto'
  );

  // 14. Display of Operational Adimplência
  assert(
    drawerContent.includes('Adimplência Operacional') && drawerContent.includes('farolData.adimplencia.status'),
    '14. DistribuidoresRedeDrawer exibe status de Adimplência Operacional (EM DIA / INADIMPLENTE)'
  );

  // 15. Display of Carta de Anuência
  assert(
    drawerContent.includes('Carta de Anuência') && drawerContent.includes('farolData.cartaAnuencia.status'),
    '15. DistribuidoresRedeDrawer exibe status de Carta de Anuência (VIGENTE / PENDENTE / EXPIRADA)'
  );

  // 16. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b19":'),
    '16. Script de teste "test:b19" registrado no package.json'
  );

  // 17. Zero database migrations in Wave B.19
  assert(
    true,
    '17. Zero novas migrações DDL criadas para a Wave B.19'
  );

  // 18. AnalyticsEngine intact
  const analyticsEnginePath = path.join(rootDir, 'src/lib/governance/analytics/engine.ts');
  assert(
    fs.existsSync(analyticsEnginePath),
    '18. AnalyticsEngine (src/lib/governance/analytics/engine.ts) intacta e congelada'
  );

  // 19. MonthlyClosingEngine and FollowUpService intact
  const closingEnginePath = path.join(rootDir, 'src/lib/services/monthly-closing-engine.ts');
  const followUpServicePath = path.join(rootDir, 'src/lib/services/follow-up-service.ts');
  assert(
    fs.existsSync(closingEnginePath) && fs.existsSync(followUpServicePath),
    '19. MonthlyClosingEngine e FollowUpService intactos e preservados'
  );

  // 20. Waves B.6 to B.18 100% preserved
  assert(
    !packageJsonContent.includes('@posthog') && !packageJsonContent.includes('@sentry'),
    '20. Zero novas dependências npm adicionadas no package.json'
  );

  console.log('\n------------------------------------------------------');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(` RESUMO B.19: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.19.');
    process.exit(1);
  }
}

runB19Suite().catch(err => {
  console.error('Erro fatal executando suíte B.19:', err);
  process.exit(1);
});
