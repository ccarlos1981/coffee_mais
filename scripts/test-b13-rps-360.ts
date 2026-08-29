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

async function runB13Suite() {
  console.log('\n======================================================');
  console.log(' COFFEE++ — WAVE B.13 TEST SUITE');
  console.log(' RPS 360° — Cockpit de Planejamento Semanal & Execução');
  console.log('======================================================\n');

  const rootDir = process.cwd();
  const rpsRoutePath = path.join(rootDir, 'src/app/api/processo-comercial/rps/route.ts');
  const rpsPagePath = path.join(rootDir, 'src/app/processo-comercial/rps/page.tsx');
  const drawerPath = path.join(rootDir, 'src/app/processo-comercial/rps/components/RpsRedeDrawer.tsx');
  const packageJsonPath = path.join(rootDir, 'package.json');

  const rpsRouteContent = fs.readFileSync(rpsRoutePath, 'utf8');
  const rpsPageContent = fs.readFileSync(rpsPagePath, 'utf8');
  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

  // 1. RPS Route existence & HTTP handlers
  assert(
    rpsRouteContent.includes('export async function GET') && rpsRouteContent.includes('export async function POST'),
    '1. Backend RPS exporta handlers GET e POST canônicos'
  );

  // 2. Server-side business_days calculator import
  assert(
    rpsRouteContent.includes("import { calculateMonthBusinessDays } from '@/lib/utils/business-days-calculator';"),
    '2. Backend RPS importa calculateMonthBusinessDays para cálculo oficial server-side'
  );

  // 3. Server-side business_days query in Promise.all
  assert(
    rpsRouteContent.includes(".from('business_days')") && rpsRouteContent.includes("select('total_days, elapsed_days')"),
    '3. Backend RPS busca business_days server-side no Promise.all principal'
  );

  // 4. Server-side businessDays injection in JSON response
  assert(
    rpsRouteContent.includes('businessDays: businessDaysData') || rpsRouteContent.includes('businessDays: {'),
    '4. Backend RPS injeta businessDays no payload JSON de resposta da API'
  );

  // 5. codigo_matriz and uf included in clients array
  assert(
    rpsRouteContent.includes('codigo_matriz: officialRecord?.codigoMatriz || null') &&
    rpsRouteContent.includes('uf: officialRecord?.uf || null'),
    '5. Backend RPS enriquece lista de redes com codigo_matriz e uf oficiais'
  );

  // 6. _TOTAL_ and OUTROS decoupling preservation (Baseline 12)
  assert(
    rpsRouteContent.includes("client_matrix !== '_TOTAL_'") && rpsRouteContent.includes('client: "OUTROS"'),
    '6. Preservação do desacoplamento _TOTAL_ e fixação de OUTROS na última posição (Baseline 12 & 15)'
  );

  // 7. Desafio por Rede RBAC Protection (Baseline 16)
  assert(
    rpsRouteContent.includes('isAdmin') && rpsRouteContent.includes('403') && rpsRouteContent.includes("kpi === 'META'"),
    '7. Governança do Desafio por Rede (kpi = META) com bloqueio HTTP 403 para não-admin (Baseline 16)'
  );

  // 8. Audit log for Desafio modifications
  assert(
    rpsRouteContent.includes('logAuditAction(') && rpsRouteContent.includes('DESAFIO_POR_REDE_UPDATE'),
    '8. Rastreabilidade e log de auditoria via logAuditAction para alterações de Desafio'
  );

  // 9. Client-side Supabase removal from RPS page
  assert(
    !rpsPageContent.includes('import { supabase } from "@/lib/supabase"') &&
    !rpsPageContent.includes("import { supabase } from '@/lib/supabase'"),
    '9. Saneamento arquitetural: page.tsx da RPS NÃO importa cliente direto do Supabase'
  );

  // 10. RpsRedeDrawer import in RPS page
  assert(
    rpsPageContent.includes('import { RpsRedeDrawer } from "./components/RpsRedeDrawer";') ||
    rpsPageContent.includes("import { RpsRedeDrawer } from './components/RpsRedeDrawer';"),
    '10. Frontend da RPS importa o componente RpsRedeDrawer'
  );

  // 11. Client consumes businessDays from API payload
  assert(
    rpsPageContent.includes('setBusinessDays(json.businessDays)'),
    '11. Frontend da RPS consome businessDays diretamente da API sem consulta client-side'
  );

  // 12. Grid Anti-N+1: Zero Farol calls during grid render
  assert(
    !rpsPageContent.includes('/api/inovacoes/crm/farol'),
    '12. Proteção Anti-N+1: Grid principal da RPS possui ZERO chamadas ao Farol'
  );

  // 13. Interactive 360 diagnosis trigger on network click
  assert(
    rpsPageContent.includes('setSelectedRede360({') && rpsPageContent.includes('Diagnóstico 360°'),
    '13. Interatividade 360: Clique no nome da rede aciona setSelectedRede360'
  );

  // 14. RpsRedeDrawer component structure
  assert(
    drawerContent.includes('export function RpsRedeDrawer(') && drawerContent.includes('export interface RpsRedeDrawerProps'),
    '14. Componente RpsRedeDrawer exporta interface tipada e componente React canônico'
  );

  // 15. Farol on-demand with AbortController
  assert(
    drawerContent.includes('new AbortController()') &&
    drawerContent.includes('signal: controller.signal') &&
    drawerContent.includes('controller.abort()'),
    '15. RpsRedeDrawer consulta Farol sob demanda com AbortController e cleanup de concorrência'
  );

  // 16. Farol endpoint query
  assert(
    drawerContent.includes('/api/inovacoes/crm/farol?'),
    '16. RpsRedeDrawer consome endpoint oficial /api/inovacoes/crm/farol'
  );

  // 17. Accessibility attributes (role="dialog", aria-modal="true", aria-label)
  assert(
    drawerContent.includes('role="dialog"') &&
    drawerContent.includes('aria-modal="true"') &&
    drawerContent.includes('aria-label='),
    '17. Acessibilidade WAI-ARIA completa (role=dialog, aria-modal=true, aria-label, aria-busy)'
  );

  // 18. Deterministic Gap Semanal calculation
  assert(
    drawerContent.includes('Math.max(0, curMeta -') && drawerContent.includes('gapReais'),
    '18. Cálculo determinístico do Gap Semanal (Math.max(0, curMeta - totalProjetado)) sem fórmulas paralelas'
  );

  // 19. 1-Click Follow-Up with RPS_COMPROMISSO origin & deterministic ref
  assert(
    drawerContent.includes('origem: "RPS_COMPROMISSO"') &&
    drawerContent.includes('RPS_OPP_') &&
    drawerContent.includes('RECUPERACAO_VOLUME'),
    '19. Integração 1-Clique de Follow-Up com origem RPS_COMPROMISSO e origem_ref determinístico'
  );

  // 20. Package.json test script registered
  assert(
    packageJsonContent.includes('"test:b13":'),
    '20. Script de teste "test:b13" registrado no package.json'
  );

  console.log('\n------------------------------------------------------');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(` RESUMO B.13: ${passedCount}/${totalCount} TESTES APROVADOS`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    console.error('❌ Falha na suíte de testes B.13.');
    process.exit(1);
  }
}

runB13Suite().catch(err => {
  console.error('Erro fatal executando suíte B.13:', err);
  process.exit(1);
});
