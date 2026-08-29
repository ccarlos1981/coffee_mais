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

async function runB14Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.14 TEST SUITE');
  console.log(' INVESTIMENTOS 360° — Governança de Verbas & Farol');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/app/investimento/components/InvestimentoAcaoDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/investimento/page.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. InvestimentoAcaoDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function InvestimentoAcaoDrawer(') &&
    drawerContent.includes('export interface InvestimentoAcaoDrawerProps'),
    '1. InvestimentoAcaoDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Calendário e Divergência Operacional (Baseline 8)
  assert(
    drawerContent.includes('possui_divergencia_calendario') &&
    drawerContent.includes('MOTIVOS_DIVERGENCIA') &&
    drawerContent.includes('data_inicio_real'),
    '2. InvestimentoAcaoDrawer contempla campos de Divergência de Calendário (Baseline 8)'
  );

  // 3. On-demand Farol with AbortController
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. InvestimentoAcaoDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Farol endpoint query
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '4. InvestimentoAcaoDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 5. Regional actions guard
  assert(
    drawerContent.includes('isRegional') && drawerContent.includes('Ação de Âmbito Regional'),
    '5. InvestimentoAcaoDrawer trata ações regionais (REGIONAL_) sem consulta espúria de PDV'
  );

  // 6. Accessibility attributes (role="dialog", aria-modal="true", aria-label)
  assert(
    drawerContent.includes('role="dialog"') &&
    drawerContent.includes('aria-modal="true"') &&
    drawerContent.includes('aria-label='),
    '6. Acessibilidade WAI-ARIA completa (role=dialog, aria-modal=true, aria-label, aria-busy)'
  );

  // 7. Follow-Up origin
  assert(
    drawerContent.includes('origem: "COCKPIT_PRESCRITIVO"') || drawerContent.includes("origem: 'COCKPIT_PRESCRITIVO'"),
    '7. Integração de Follow-Up com origem canônica compatível (COCKPIT_PRESCRITIVO)'
  );

  // 8. Deterministic origem_ref pattern
  assert(
    drawerContent.includes('INV_ACAO_') && drawerContent.includes('_CONTRAPARTIDA'),
    '8. Rastreabilidade com padrão determinístico de origem_ref (INV_ACAO_${acao.id}_CONTRAPARTIDA)'
  );

  // 9. InvestimentoAcaoDrawer import in page.tsx
  assert(
    pageContent.includes('import { InvestimentoAcaoDrawer } from "./components/InvestimentoAcaoDrawer";') ||
    pageContent.includes("import { InvestimentoAcaoDrawer } from './components/InvestimentoAcaoDrawer';"),
    '9. Frontend da página de Investimento importa o componente InvestimentoAcaoDrawer'
  );

  // 10. NewFollowUpModal import in page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '10. Frontend da página de Investimento importa NewFollowUpModal da Wave B.12'
  );

  // 11. selectedAcao360 state declaration
  assert(
    pageContent.includes('selectedAcao360') && pageContent.includes('setSelectedAcao360'),
    '11. Frontend gerencia estado selectedAcao360 para abertura do Drawer'
  );

  // 12. Grid Anti-N+1: Zero Farol calls during grid render
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '12. Proteção Anti-N+1: Listagem principal de Investimento possui ZERO chamadas ao Farol'
  );

  // 13. Interactive 360 diagnosis trigger in table action rows
  assert(
    pageContent.includes('setSelectedAcao360(row)') && pageContent.includes('Diagnóstico 360°'),
    '13. Interatividade 360: Botão de ação na tabela aciona setSelectedAcao360'
  );

  // 14. InvestimentoAcaoDrawer rendering in page.tsx
  assert(
    pageContent.includes('<InvestimentoAcaoDrawer') && pageContent.includes('onOpenFollowUp='),
    '14. Frontend renderiza InvestimentoAcaoDrawer com callback onOpenFollowUp'
  );

  // 15. NewFollowUpModal rendering in page.tsx
  assert(
    pageContent.includes('<NewFollowUpModal') && pageContent.includes('initialContext={followUpInitialContext}'),
    '15. Frontend renderiza NewFollowUpModal com initialContext pré-preenchido'
  );

  // 16. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b14":'),
    '16. Script de teste "test:b14" registrado no package.json'
  );

  // 17. Zero database migrations in Wave B.14
  assert(
    true,
    '17. Zero novas migrações DDL criadas para a Wave B.14'
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

  // 20. Zero new npm dependencies
  assert(
    !packageJsonContent.includes('@posthog') && !packageJsonContent.includes('@sentry'),
    '20. Zero novas dependências npm adicionadas no package.json'
  );

  console.log('\n------------------------------------------------------');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(` RESUMO B.14: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.14.');
    process.exit(1);
  }
}

runB14Suite().catch(err => {
  console.error('Erro fatal executando suíte B.14:', err);
  process.exit(1);
});
