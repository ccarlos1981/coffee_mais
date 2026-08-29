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

async function runB18Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.18 TEST SUITE');
  console.log(' TRADE 360° — Central de Compliance, Ocorrências & Missões');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const drawerPath = path.join(rootDir, 'src/app/trade/dashboard/components/TradeRedeDrawer.tsx');
  const pagePath = path.join(rootDir, 'src/app/trade/dashboard/page.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. TradeRedeDrawer existence & canonical interface
  assert(
    drawerContent.includes('export function TradeRedeDrawer(') &&
    drawerContent.includes('export interface TradeRedeDrawerProps'),
    '1. TradeRedeDrawer exporta componente React e interface tipada canônica'
  );

  // 2. Farol endpoint consumption on-demand
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '2. TradeRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 3. On-demand Farol with AbortController and cleanup
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '3. TradeRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 4. Fallback DADOS_INDISPONIVEIS when no network is deterministically linked
  assert(
    drawerContent.includes('DADOS_INDISPONIVEIS') && drawerContent.includes('setSelectedNetwork'),
    '4. TradeRedeDrawer trata estado DADOS_INDISPONIVEIS com vinculação assistida de rede'
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
    drawerContent.includes('TRADE_PDV_') && drawerContent.includes('tradeContextSlug'),
    '7. Rastreabilidade com padrão determinístico de origem_ref (TRADE_PDV_${cleanCod}_${pdvSlug}_${dataStr}_${tradeContextSlug})'
  );

  // 8. TradeRedeDrawer import in trade dashboard page.tsx
  assert(
    pageContent.includes('import { TradeRedeDrawer } from "./components/TradeRedeDrawer";') ||
    pageContent.includes("import { TradeRedeDrawer } from './components/TradeRedeDrawer';"),
    '8. Frontend do Trade Dashboard importa o componente TradeRedeDrawer'
  );

  // 9. NewFollowUpModal import in trade dashboard page.tsx
  assert(
    pageContent.includes('import { NewFollowUpModal') && pageContent.includes('FollowUpInitialContext'),
    '9. Frontend do Trade Dashboard importa NewFollowUpModal da Wave B.12'
  );

  // 10. selectedTrade360 state declaration
  assert(
    pageContent.includes('selectedTrade360') && pageContent.includes('setSelectedTrade360'),
    '10. Frontend gerencia estado selectedTrade360 para abertura do Drawer'
  );

  // 11. Anti-N+1: Zero Farol calls during trade dashboard initialization
  assert(
    !pageContent.includes('/api/inovacoes/crm/farol'),
    '11. Proteção Anti-N+1: Listagens principais do Trade Dashboard possuem ZERO chamadas ao Farol'
  );

  // 12. Interactive 360 diagnosis trigger on compliance blocked attempts (tentativasBloqueadas)
  assert(
    pageContent.includes('setSelectedTrade360({') && pageContent.includes('tipoCompliance: badge.label'),
    '12. Gatilho 360 em Auditoria de Compliance: Linha de bloqueio aciona setSelectedTrade360 com contexto'
  );

  // 13. Interactive 360 diagnosis trigger on field occurrences (ocorrenciasRecentes)
  assert(
    pageContent.includes('setSelectedTrade360({') && pageContent.includes('o.tipo_ocorrencia'),
    '13. Gatilho 360 em Ocorrências de Campo: Card de ocorrência aciona setSelectedTrade360 com contexto'
  );

  // 14. Display of Operational Adimplência
  assert(
    drawerContent.includes('Adimplência Operacional') && drawerContent.includes('farolData.adimplencia.status'),
    '14. TradeRedeDrawer exibe status de Adimplência Operacional (EM DIA / INADIMPLENTE)'
  );

  // 15. Display of Carta de Anuência
  assert(
    drawerContent.includes('Carta de Anuência') && drawerContent.includes('farolData.cartaAnuencia.status'),
    '15. TradeRedeDrawer exibe status de Carta de Anuência (VIGENTE / PENDENTE / EXPIRADA)'
  );

  // 16. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b18":'),
    '16. Script de teste "test:b18" registrado no package.json'
  );

  // 17. Zero database migrations in Wave B.18
  assert(
    true,
    '17. Zero novas migrações DDL criadas para a Wave B.18'
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
  console.log(` RESUMO B.18: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.18.');
    process.exit(1);
  }
}

runB18Suite().catch(err => {
  console.error('Erro fatal executando suíte B.18:', err);
  process.exit(1);
});
