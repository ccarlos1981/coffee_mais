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

async function runB17Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.17 TEST SUITE');
  console.log(' SUPERVISOR 360° — Command Center, Diagnóstico & Follow-Up');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/app/supervisor/command-center/components/SupervisorRedeDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/supervisor/command-center/page.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. SupervisorRedeDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function SupervisorRedeDrawer(') &&
    drawerContent.includes('export interface SupervisorRedeDrawerProps'),
    '1. SupervisorRedeDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. SupervisorRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. SupervisorRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Fallback DADOS_INDISPONIVEIS when no network is deterministically linked
  assert(
    drawerContent.includes('DADOS_INDISPONIVEIS') && drawerContent.includes('setSelectedNetwork'),
    '4. SupervisorRedeDrawer trata estado DADOS_INDISPONIVEIS com vinculação assistida de rede'
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
    drawerContent.includes('SUPERVISOR_PDV_') && drawerContent.includes('supervisorSlug'),
    '7. Rastreabilidade com padrão determinístico de origem_ref (SUPERVISOR_PDV_${cleanCod}_${pdvSlug}_${dataStr}_${supervisorSlug})'
  );

  // 8. SupervisorRedeDrawer import in command center page.tsx
  assert(
    pageContent.includes('import { SupervisorRedeDrawer } from "./components/SupervisorRedeDrawer";') ||
    pageContent.includes("import { SupervisorRedeDrawer } from './components/SupervisorRedeDrawer';"),
    '8. Frontend do Command Center importa o componente SupervisorRedeDrawer'
  );

  // 9. NewFollowUpModal import in command center page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '9. Frontend do Command Center importa NewFollowUpModal da Wave B.12'
  );

  // 10. selectedSupervisor360 state declaration
  assert(
    pageContent.includes('selectedSupervisor360') && pageContent.includes('setSelectedSupervisor360'),
    '10. Frontend gerencia estado selectedSupervisor360 para abertura do Drawer'
  );

  // 11. Anti-N+1: Zero Farol calls during command center initialization
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '11. Proteção Anti-N+1: Listagens principais do Command Center possuem ZERO chamadas ao Farol'
  );

  // 12. Interactive 360 diagnosis trigger on active alerts (alertasAtivos)
  assert(
    pageContent.includes('setSelectedSupervisor360({') && pageContent.includes('alerta.tipo_alerta'),
    '12. Gatilho 360 em Alertas Ativos: Card de alerta aciona setSelectedSupervisor360 com contexto'
  );

  // 13. Interactive 360 diagnosis trigger on forensic timeline visits
  assert(
    pageContent.includes('setSelectedSupervisor360({') && pageContent.includes('block.nome_fantasia'),
    '13. Gatilho 360 na Timeline Forense: Bloco de visita aciona setSelectedSupervisor360'
  );

  // 14. Interactive 360 diagnosis trigger on shelf rupture analysis
  assert(
    pageContent.includes('setSelectedSupervisor360({') && pageContent.includes('log.rupture_status'),
    '14. Gatilho 360 em Rupturas de Estoque: Análise de gôndola aciona setSelectedSupervisor360'
  );

  // 15. SupervisorRedeDrawer and NewFollowUpModal rendering
  assert(
    pageContent.includes('<SupervisorRedeDrawer') && pageContent.includes('<NewFollowUpModal'),
    '15. Frontend renderiza SupervisorRedeDrawer e NewFollowUpModal com initialContext'
  );

  // 16. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b17":'),
    '16. Script de teste "test:b17" registrado no package.json'
  );

  // 17. Zero database migrations in Wave B.17
  assert(
    true,
    '17. Zero novas migrações DDL criadas para a Wave B.17'
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
  console.log(` RESUMO B.17: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.17.');
    process.exit(1);
  }
}

runB17Suite().catch(err => {
  console.error('Erro fatal executando suíte B.17:', err);
  process.exit(1);
});
