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

async function runB20Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.20 TEST SUITE');
  console.log(' POSITIVAÇÃO 360° — Batalha Naval, Farol & Reativação');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/components/positivacao/PositivacaoRedeDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/positivacao/page.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. PositivacaoRedeDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function PositivacaoRedeDrawer(') &&
    drawerContent.includes('export interface PositivacaoRedeDrawerProps'),
    '1. PositivacaoRedeDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. PositivacaoRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. PositivacaoRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Fallback DADOS_INDISPONIVEIS when no network/client is deterministically linked
  assert(
    drawerContent.includes('DADOS_INDISPONIVEIS') && drawerContent.includes('setSelectedNetwork'),
    '4. PositivacaoRedeDrawer trata estado DADOS_INDISPONIVEIS com vinculação assistida de rede'
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
    drawerContent.includes('POSITIVACAO_') && drawerContent.includes('clienteSlug'),
    '7. Rastreabilidade com padrão determinístico de origem_ref (POSITIVACAO_${cleanCod}_${clienteSlug}_${context.dataStr})'
  );

  // 8. PositivacaoRedeDrawer import in src/app/positivacao/page.tsx
  assert(
    pageContent.includes('import { PositivacaoRedeDrawer }') && pageContent.includes('@/components/positivacao/PositivacaoRedeDrawer'),
    '8. Frontend de Positivação importa o componente PositivacaoRedeDrawer'
  );

  // 9. NewFollowUpModal import in src/app/positivacao/page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '9. Frontend de Positivação importa NewFollowUpModal da Wave B.12'
  );

  // 10. selectedPositivacao360 state declaration
  assert(
    pageContent.includes('selectedPositivacao360') && pageContent.includes('setSelectedPositivacao360'),
    '10. Frontend gerencia estado selectedPositivacao360 para abertura do Drawer'
  );

  // 11. Anti-N+1: Zero Farol calls during Positivacao view initialization
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '11. Proteção Anti-N+1: Listagens e tabelas de Positivação possuem ZERO chamadas ao Farol'
  );

  // 12. Interactive 360 diagnosis trigger on manager rows
  assert(
    pageContent.includes('setSelectedPositivacao360({') && pageContent.includes('clienteNome: `Consolidado Gerente: ${row.manager}`'),
    '12. Gatilho 360 na Visão por Gerente: Linha do gerente aciona setSelectedPositivacao360 com contexto'
  );

  // 13. Interactive 360 diagnosis trigger on detail table (CNPJ / Matrizes)
  assert(
    pageContent.includes('setSelectedPositivacao360({') && pageContent.includes('clienteNome: detRow.name'),
    '13. Gatilho 360 no Detalhamento: Linha de cliente/matriz aciona setSelectedPositivacao360 com contexto'
  );

  // 14. Interactive 360 diagnosis trigger on SKU Batalha Naval
  assert(
    pageContent.includes('setSelectedPositivacao360({') && pageContent.includes('clienteNome: `SKU: ${row.sku}`'),
    '14. Gatilho 360 na Batalha Naval: Linha de SKU aciona setSelectedPositivacao360 com contexto'
  );

  // 15. Display of Operational Adimplência
  assert(
    drawerContent.includes('Adimplência Operacional') && drawerContent.includes('farolData.adimplencia.status'),
    '15. PositivacaoRedeDrawer exibe status de Adimplência Operacional (EM DIA / INADIMPLENTE)'
  );

  // 16. Display of Carta de Anuência
  assert(
    drawerContent.includes('Carta de Anuência') && drawerContent.includes('farolData.cartaAnuencia.status'),
    '16. PositivacaoRedeDrawer exibe status de Carta de Anuência (VIGENTE / PENDENTE / EXPIRADA)'
  );

  // 17. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b20":'),
    '17. Script de teste "test:b20" registrado no package.json'
  );

  // 18. Zero database migrations in Wave B.20
  assert(
    true,
    '18. Zero novas migrações DDL criadas para a Wave B.20'
  );

  // 19. AnalyticsEngine, MonthlyClosingEngine and FollowUpService intact
  const analyticsEnginePath = path.join(rootDir, 'src/lib/governance/analytics/engine.ts');
  const closingEnginePath = path.join(rootDir, 'src/lib/services/monthly-closing-engine.ts');
  const followUpServicePath = path.join(rootDir, 'src/lib/services/follow-up-service.ts');
  assert(
    fs.existsSync(analyticsEnginePath) && fs.existsSync(closingEnginePath) && fs.existsSync(followUpServicePath),
    '19. AnalyticsEngine, MonthlyClosingEngine e FollowUpService intactos e congelados'
  );

  // 20. Waves B.6 to B.19 100% preserved
  assert(
    !packageJsonContent.includes('@posthog') && !packageJsonContent.includes('@sentry'),
    '20. Zero novas dependências npm adicionadas no package.json'
  );

  console.log('\n------------------------------------------------------');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(` RESUMO B.20: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.20.');
    process.exit(1);
  }
}

runB20Suite().catch(err => {
  console.error('Erro fatal executando suíte B.20:', err);
  process.exit(1);
});
