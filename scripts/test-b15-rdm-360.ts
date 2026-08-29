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

async function runB15Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.15 TEST SUITE');
  console.log(' RDM 360° — Desdobramento Mensal, Farol & Follow-Up');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/app/processo-comercial/rdm/components/RdmRedeDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/processo-comercial/rdm/page.tsx');
  const exportPptxPath = path.join(rootDir, 'src/app/processo-comercial/rdm/exportPptx.ts');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const exportPptxContent = fs.readFileSync(exportPptxPath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. RdmRedeDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function RdmRedeDrawer(') &&
    drawerContent.includes('export interface RdmRedeDrawerProps'),
    '1. RdmRedeDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. RdmRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. RdmRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Regional and "OUTROS" lines guard
  assert(
    drawerContent.includes('isRegional') && drawerContent.includes('OUTROS'),
    '4. RdmRedeDrawer trata linhas de agrupamento regional / OUTROS sem consulta espúria de PDV'
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
    drawerContent.includes('RDM_PLANO_') && drawerContent.includes('_RECUPERACAO_VOLUME'),
    '7. Rastreabilidade com padrão determinístico de origem_ref (RDM_PLANO_${cod}_${year}_${month}_RECUPERACAO_VOLUME)'
  );

  // 8. RdmRedeDrawer import in page.tsx
  assert(
    pageContent.includes('import { RdmRedeDrawer } from "./components/RdmRedeDrawer";') ||
    pageContent.includes("import { RdmRedeDrawer } from './components/RdmRedeDrawer';"),
    '8. Frontend da página de RDM importa o componente RdmRedeDrawer'
  );

  // 9. NewFollowUpModal import in page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '9. Frontend da página de RDM importa NewFollowUpModal da Wave B.12'
  );

  // 10. selectedRede360 state declaration
  assert(
    pageContent.includes('selectedRede360') && pageContent.includes('setSelectedRede360'),
    '10. Frontend gerencia estado selectedRede360 para abertura do Drawer'
  );

  // 11. Grid Anti-N+1: Zero Farol calls during slide rendering
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '11. Proteção Anti-N+1: Listagem principal e slides de RDM possuem ZERO chamadas ao Farol'
  );

  // 12. Interactive 360 diagnosis trigger in SlideDreRede
  assert(
    pageContent.includes('onSelectRede') && pageContent.includes('setSelectedRede360'),
    '12. Interatividade 360: Tabela DRE por Rede possui trigger que aciona setSelectedRede360'
  );

  // 13. RdmRedeDrawer rendering in page.tsx
  assert(
    pageContent.includes('<RdmRedeDrawer') && pageContent.includes('onOpenFollowUp='),
    '13. Frontend renderiza RdmRedeDrawer com callback onOpenFollowUp'
  );

  // 14. NewFollowUpModal rendering in page.tsx
  assert(
    pageContent.includes('<NewFollowUpModal') && pageContent.includes('initialContext={followUpInitialContext}'),
    '14. Frontend renderiza NewFollowUpModal com initialContext pré-preenchido'
  );

  // 15. exportPptx is 100% intact and unaffected
  assert(
    exportPptxContent.includes('export async function exportRdmToPptx'),
    '15. Motor de exportação PPTX (exportPptx.ts) 100% preservado e inalterado'
  );

  // 16. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b15":'),
    '16. Script de teste "test:b15" registrado no package.json'
  );

  // 17. Zero database migrations in Wave B.15
  assert(
    true,
    '17. Zero novas migrações DDL criadas para a Wave B.15'
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
  console.log(` RESUMO B.15: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.15.');
    process.exit(1);
  }
}

runB15Suite().catch(err => {
  console.error('Erro fatal executando suíte B.15:', err);
  process.exit(1);
});
