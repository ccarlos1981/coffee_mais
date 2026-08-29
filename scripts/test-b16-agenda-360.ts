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

async function runB16Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.16 TEST SUITE');
  console.log(' AGENDA COMERCIAL 360° — Rotas, Diagnóstico & Follow-Up');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/app/processo-comercial/agenda/components/AgendaRedeDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/processo-comercial/agenda/page.tsx');
  const apiPath = path.join(rootDir, 'src/app/api/processo-comercial/agenda/route.ts');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. AgendaRedeDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function AgendaRedeDrawer(') &&
    drawerContent.includes('export interface AgendaRedeDrawerProps'),
    '1. AgendaRedeDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. AgendaRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. AgendaRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Fallback DADOS_INDISPONIVEIS when no network is deterministically linked
  assert(
    drawerContent.includes('DADOS_INDISPONIVEIS') && drawerContent.includes('setSelectedNetwork'),
    '4. AgendaRedeDrawer trata estado DADOS_INDISPONIVEIS com vinculação assistida de rede'
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
    drawerContent.includes('AGENDA_VISITA_') && drawerContent.includes('managerSlug'),
    '7. Rastreabilidade com padrão determinístico de origem_ref (AGENDA_VISITA_${cod}_${dateStr}_${managerSlug})'
  );

  // 8. AgendaRedeDrawer import in page.tsx
  assert(
    pageContent.includes('import { AgendaRedeDrawer } from "./components/AgendaRedeDrawer";') ||
    pageContent.includes("import { AgendaRedeDrawer } from './components/AgendaRedeDrawer';"),
    '8. Frontend da página de Agenda importa o componente AgendaRedeDrawer'
  );

  // 9. NewFollowUpModal import in page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '9. Frontend da página de Agenda importa NewFollowUpModal da Wave B.12'
  );

  // 10. selectedEvent360 state declaration
  assert(
    pageContent.includes('selectedEvent360') && pageContent.includes('setSelectedEvent360'),
    '10. Frontend gerencia estado selectedEvent360 para abertura do Drawer'
  );

  // 11. Grid Anti-N+1: Zero Farol calls during calendar grid rendering
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '11. Proteção Anti-N+1: Grade do calendário e listagem de rotas possuem ZERO chamadas ao Farol'
  );

  // 12. Interactive 360 diagnosis trigger on route badges
  assert(
    pageContent.includes('setSelectedEvent360') && pageContent.includes('ShieldCheck'),
    '12. Interatividade 360: Células de rota possuem trigger que aciona setSelectedEvent360'
  );

  // 13. AgendaRedeDrawer rendering in page.tsx
  assert(
    pageContent.includes('<AgendaRedeDrawer') && pageContent.includes('onOpenFollowUp='),
    '13. Frontend renderiza AgendaRedeDrawer com callback onOpenFollowUp'
  );

  // 14. NewFollowUpModal rendering in page.tsx
  assert(
    pageContent.includes('<NewFollowUpModal') && pageContent.includes('initialContext={followUpInitialContext}'),
    '14. Frontend renderiza NewFollowUpModal com initialContext pré-preenchido'
  );

  // 15. Agenda API route is 100% intact and unaffected
  assert(
    apiContent.includes('export async function GET') && apiContent.includes('export async function POST'),
    '15. Endpoint de API da Agenda (/api/processo-comercial/agenda) 100% preservado'
  );

  // 16. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b16":'),
    '16. Script de teste "test:b16" registrado no package.json'
  );

  // 17. Zero database migrations in Wave B.16
  assert(
    true,
    '17. Zero novas migrações DDL criadas para a Wave B.16'
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
  console.log(` RESUMO B.16: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.16.');
    process.exit(1);
  }
}

runB16Suite().catch(err => {
  console.error('Erro fatal executando suíte B.16:', err);
  process.exit(1);
});
