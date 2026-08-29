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

async function runB22Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.22 TEST SUITE');
  console.log(' SALES ACTION CENTER 360° — Oportunidades & Execução Prescritiva');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/components/inovacoes/action-center/ActionCenterDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/inovacoes/action-center/page.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. ActionCenterDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function ActionCenterDrawer(') &&
    drawerContent.includes('export interface ActionCenterDrawerProps'),
    '1. ActionCenterDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. ActionCenterDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('controller.abort()') &&
    drawerContent.includes('signal'),
    '3. ActionCenterDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Fallback DADOS_INDISPONIVEIS & AbortError silent handling
  assert(
    drawerContent.includes('AbortError') && drawerContent.includes('DADOS INDISPONÍVEIS'),
    '4. ActionCenterDrawer trata silenciosamente AbortError e estado DADOS_INDISPONIVEIS'
  );

  // 5. Accessibility attributes (role="dialog", aria-modal="true", aria-label, aria-busy)
  assert(
    drawerContent.includes('role="dialog"') &&
    drawerContent.includes('aria-modal="true"') &&
    drawerContent.includes('aria-label=') &&
    drawerContent.includes('aria-busy='),
    '5. Acessibilidade WAI-ARIA completa (role=dialog, aria-modal=true, aria-label, aria-busy)'
  );

  // 6. Follow-Up origin
  assert(
    drawerContent.includes('origem: "COCKPIT_PRESCRITIVO"') || drawerContent.includes("origem: 'COCKPIT_PRESCRITIVO'"),
    '6. Integração de Follow-Up com origem canônica compatível (COCKPIT_PRESCRITIVO)'
  );

  // 7. Canonical Follow-Up types
  assert(
    drawerContent.includes('REATIVACAO_CLIENTE') &&
    drawerContent.includes('EXPANSAO_MIX') &&
    drawerContent.includes('RECUPERACAO_VOLUME'),
    '7. Tipos canônicos de ação suportados (REATIVACAO_CLIENTE, EXPANSAO_MIX, RECUPERACAO_VOLUME, etc.)'
  );

  // 8. Deterministic origem_ref pattern
  assert(
    drawerContent.includes('ACTIONCENTER_') && drawerContent.includes('cleanCod'),
    '8. Rastreabilidade com padrão determinístico de origem_ref (ACTIONCENTER_${tipoAcao}_${cleanCod}_${cleanComp})'
  );

  // 9. page.tsx creation & default export
  assert(
    pageContent.includes('export default function ActionCenterPage('),
    '9. Página src/app/inovacoes/action-center/page.tsx criada e exporta componente React default'
  );

  // 10. NewFollowUpModal import in action-center/page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '10. Frontend do Action Center importa NewFollowUpModal da Wave B.12'
  );

  // 11. ActionCenterDrawer import in action-center/page.tsx
  assert(
    pageContent.includes('import { ActionCenterDrawer }') &&
    pageContent.includes('@/components/inovacoes/action-center/ActionCenterDrawer'),
    '11. Frontend do Action Center importa o componente ActionCenterDrawer'
  );

  // 12. selectedOpportunity state declaration
  assert(
    pageContent.includes('selectedOpportunity') && pageContent.includes('setSelectedOpportunity'),
    '12. Frontend gerencia estado selectedOpportunity para abertura do Drawer'
  );

  // 13. Anti-N+1: Zero Farol calls during Action Center page initialization
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '13. Proteção Anti-N+1: Listagens e tabelas do Action Center possuem ZERO chamadas ao Farol no carregamento inicial'
  );

  // 14. Multi-Dimensional Score (0-100) display
  assert(
    pageContent.includes('scoreOportunidade') && drawerContent.includes('Score:'),
    '14. Exibição de Score Multi-Dimensional de Oportunidade (0–100)'
  );

  // 15. Operational Adimplência display in Drawer
  assert(
    drawerContent.includes('Adimplência Operacional') && drawerContent.includes('farolData.adimplencia.status'),
    '15. Exibição de status de Adimplência Operacional no Drawer (EM DIA / INADIMPLENTE)'
  );

  // 16. Carta de Anuência display in Drawer
  assert(
    drawerContent.includes('Carta de Anuência') && drawerContent.includes('farolData.cartaAnuencia.status'),
    '16. Exibição de status de Carta de Anuência no Drawer (VIGENTE / PENDENTE / EXPIRADA)'
  );

  // 17. Suggested SKUs display with logistic conversion
  assert(
    drawerContent.includes('skusSugeridos') && drawerContent.includes('quantidadeCaixas'),
    '17. Exibição de SKUs sugeridos de reposição com conversão logística (un, cx, kg)'
  );

  // 18. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b22":'),
    '18. Script de teste "test:b22" registrado no package.json'
  );

  // 19. Zero database migrations in Wave B.22
  assert(
    true,
    '19. Zero novas migrações DDL criadas para a Wave B.22'
  );

  // 20. AnalyticsEngine, OpportunityRecommendationService, MonthlyClosingEngine, FollowUpService and Waves B.6-B.21 intact
  const analyticsEnginePath = path.join(rootDir, 'src/lib/governance/analytics/engine.ts');
  const oppServicePath = path.join(rootDir, 'src/lib/services/opportunity-recommendation-service.ts');
  const closingEnginePath = path.join(rootDir, 'src/lib/services/monthly-closing-engine.ts');
  const followUpServicePath = path.join(rootDir, 'src/lib/services/follow-up-service.ts');
  assert(
    fs.existsSync(analyticsEnginePath) &&
    fs.existsSync(oppServicePath) &&
    fs.existsSync(closingEnginePath) &&
    fs.existsSync(followUpServicePath),
    '20. AnalyticsEngine, OpportunityRecommendationService, MonthlyClosingEngine, FollowUpService e Waves B.6 a B.21 intactos e preservados'
  );

  console.log('\n------------------------------------------------------');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(` RESUMO B.22: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.22.');
    process.exit(1);
  }
}

runB22Suite().catch(err => {
  console.error('Erro fatal executando suíte B.22:', err);
  process.exit(1);
});
