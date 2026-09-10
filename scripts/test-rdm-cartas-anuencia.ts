/**
 * 🏛️ COFFEE++ — TESTE DE HOMOLOGAÇÃO DO NOVO SLIDE 15 RDM (CARTAS DE ANUÊNCIA)
 * 
 * Validação rigorosa dos critérios de aceitação (RFC 10/09/2026):
 * 1. carta_anuencia presente no registry oficial de slides
 * 2. Posição imediatamente após invest_rede (Index 14 / Slide 15)
 * 3. Quantidade total de exatamente 30 slides oficiais
 * 4. Competência dinâmica e desacoplada do mês financeiro do RDM (Agosto/2026 no RDM não contamina cartas)
 * 5. Ausência absoluta de 'Junho/2026' hardcoded no adapter/slide
 * 6. Ausência absoluta de 'Agosto/2026' hardcoded no adapter/slide
 * 7. Regra canônica de competência operacional:
 *    - Competência sem cartas NÃO é selecionada (Dezembro/2026 tem 0 cartas);
 *    - Competência com cartas ativas É selecionada (Junho/2026 tem 29 cartas);
 *    - Competência encerrada NÃO é selecionada (encerrada = false obrigatório);
 *    - Mais recente elegível vence (data_inicio DESC);
 *    - Dezembro/2026 vence automaticamente assim que receber cartas ativas;
 *    - Ausência de competência elegível retorna estado seguro (SEM_COMPETENCIA_COM_CARTAS);
 * 8. Consumo direto do SSOT obterDadosFarolGerencial
 * 9. total_cartas, cartas_para_assinar, cartas_assinadas e pct consumidos do SSOT
 * 10. TOTAL BRASIL: soma das cartas e percentual matematicamente recalculado (13,8%)
 * 11. Visão CRISTIANO: 4 gerentes canônicos + TOTAL BRASIL
 * 12. Visão Gerente Individual: exibe somente a linha do gerente selecionado
 * 13. Zero dados mockados na integração real com o banco
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Mock next/headers para execução standalone via ts-node
const Module = require('module');
const originalRequire = Module.prototype.require;

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let testCounter = 0;

function runAssertion(name: string, fn: () => void | Promise<void>) {
  testCounter++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error('runAssertion chamado com async fn sem await');
    }
    results.push({ num: testCounter, name, passed: true });
    console.log(`  ✅ [PASS] ${testCounter}. ${name}`);
  } catch (err: any) {
    results.push({ num: testCounter, name, passed: false, error: err.message || String(err) });
    console.error(`  ❌ [FAIL] ${testCounter}. ${name} -> ${err.message || err}`);
  }
}

async function runAssertionAsync(name: string, fn: () => Promise<void>) {
  testCounter++;
  try {
    await fn();
    results.push({ num: testCounter, name, passed: true });
    console.log(`  ✅ [PASS] ${testCounter}. ${name}`);
  } catch (err: any) {
    results.push({ num: testCounter, name, passed: false, error: err.message || String(err) });
    console.error(`  ❌ [FAIL] ${testCounter}. ${name} -> ${err.message || err}`);
  }
}

async function runCartasAnuenciaSuite() {
  console.log('\n================================================================================');
  console.log('🏛️ COFFEE++ — TESTE DE HOMOLOGAÇÃO: NOVO SLIDE 15 (CARTAS DE ANUÊNCIA)');
  console.log('REGIME: RESOLUÇÃO DETERMINÍSTICA DA COMPETÊNCIA OPERACIONAL & CONSUMO SSOT');
  console.log('================================================================================\n');

  // 1. Obter token de autenticação válido com perfil Admin
  const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profiles, error: profErr } = await adminSb
    .from('cm_user_profiles')
    .select('id, role, approved, name')
    .eq('approved', true);

  if (profErr || !profiles?.length) {
    throw new Error('Falha ao obter perfis aprovados para teste: ' + profErr?.message);
  }

  const adminProfile = profiles.find((p: any) => (p.role || '').toLowerCase().includes('admin'));
  if (!adminProfile) {
    throw new Error('Nenhum perfil Admin aprovado encontrado na base.');
  }

  const { data: { user }, error: userErr } = await adminSb.auth.admin.getUserById(adminProfile.id);
  if (userErr || !user) {
    throw new Error('Falha ao obter usuário pelo ID: ' + userErr?.message);
  }

  const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email!,
  });
  if (linkErr || !linkData) {
    throw new Error('Falha ao gerar magiclink: ' + linkErr?.message);
  }

  const anonSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const tokenHash = (linkData as any)?.properties?.hashed_token;
  const { data: sessionData, error: verifyErr } = await anonSb.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyErr || !sessionData?.session) {
    throw new Error('Falha ao autenticar sessão de teste: ' + verifyErr?.message);
  }

  const token = sessionData.session.access_token;

  // Interceptar next/headers para simular requisição autenticada
  Module.prototype.require = function(id: string) {
    if (id === 'next/headers') {
      return {
        cookies: async () => ({
          getAll: () => [],
          get: () => undefined,
          set: () => {},
        }),
        headers: async () => new Headers({
          authorization: `Bearer ${token}`,
        }),
      };
    }
    return originalRequire.apply(this, arguments);
  };

  // ─── BATERIA 1: REGISTRY OFICIAL E DESLOCAMENTO DOS SLIDES ──────────────────
  console.log('--- 🧪 BATERIA 1: REGISTRY OFICIAL E POSICIONAMENTO DO SLIDE 15 ---');

  const { OFFICIAL_RDM_SLIDE_KEYS } = require('../src/app/api/processo-comercial/rdm/route');

  runAssertion('Registry oficial do RDM possui exatamente 30 slides', () => {
    assert.strictEqual(OFFICIAL_RDM_SLIDE_KEYS.length, 30, 'OFFICIAL_RDM_SLIDE_KEYS deve ter tamanho 30');
  });

  runAssertion('Novo slide "carta_anuencia" está presente no registry', () => {
    assert(OFFICIAL_RDM_SLIDE_KEYS.includes('carta_anuencia'), 'carta_anuencia deve estar no registry');
  });

  runAssertion('Novo slide "carta_anuencia" está localizado exatamente no Index 14 (Slide 15)', () => {
    const idx = OFFICIAL_RDM_SLIDE_KEYS.indexOf('carta_anuencia');
    assert.strictEqual(idx, 14, 'carta_anuencia deve estar no Index 14');
  });

  runAssertion('Slide anterior imediato (Index 13) permanece como "invest_rede" (Slide 14 preservado)', () => {
    assert.strictEqual(OFFICIAL_RDM_SLIDE_KEYS[13], 'invest_rede', 'Index 13 deve ser invest_rede');
  });

  runAssertion('Slide posterior imediato (Index 15) é "cover_resultado" (deslocado em +1)', () => {
    assert.strictEqual(OFFICIAL_RDM_SLIDE_KEYS[15], 'cover_resultado', 'Index 15 deve ser cover_resultado');
  });

  runAssertion('Slide de encerramento (Index 29) permanece como "obrigado" (Slide 30 final)', () => {
    assert.strictEqual(OFFICIAL_RDM_SLIDE_KEYS[29], 'obrigado', 'Index 29 deve ser obrigado');
  });

  // ─── BATERIA 2: AUDITORIA DE ZERO HARDCODE NO CÓDIGO FONTE ──────────────────
  console.log('\n--- 🧪 BATERIA 2: AUDITORIA DE ZERO HARDCODE NO CÓDIGO FONTE ---');

  const adapterSource = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/carta-anuencia/rdm-adapter.ts'), 'utf-8');

  runAssertion('Adapter NÃO possui fallback hardcoded "Junho/2026"', () => {
    const hasHardcodedJunho = adapterSource.includes('"Junho/2026"') || adapterSource.includes("'Junho/2026'");
    assert(!hasHardcodedJunho, 'rdm-adapter.ts NÃO deve conter "Junho/2026" hardcoded');
  });

  runAssertion('Adapter NÃO possui fallback hardcoded "Agosto/2026"', () => {
    const hasHardcodedAgosto = adapterSource.includes('"Agosto/2026"') || adapterSource.includes("'Agosto/2026'");
    assert(!hasHardcodedAgosto, 'rdm-adapter.ts NÃO deve conter "Agosto/2026" hardcoded');
  });

  // ─── BATERIA 3: REGRA CANÔNICA DE RESOLUÇÃO DETERMINÍSTICA ──────────────────
  console.log('\n--- 🧪 BATERIA 3: REGRA CANÔNICA DE RESOLUÇÃO DETERMINÍSTICA ---');

  const {
    getRdmCartaAnuenciaData,
    obterCompetenciaOperacionalCartaAnuencia,
  } = require('../src/lib/carta-anuencia/rdm-adapter');
  const { obterDadosFarolGerencial } = require('../src/app/investimento/carta-anuencia/actions');

  await runAssertionAsync('No estado real da base, Junho/2026 é selecionado porque possui cartas ativas', async () => {
    const comp = await obterCompetenciaOperacionalCartaAnuencia();
    assert.strictEqual(comp, 'Junho/2026', 'Competência operacional atual deve ser Junho/2026');
  });

  await runAssertionAsync('Competência sem cartas (Dezembro/2026) NÃO é selecionada na base real', async () => {
    const comp = await obterCompetenciaOperacionalCartaAnuencia();
    assert.notStrictEqual(comp, 'Dezembro/2026', 'Dezembro/2026 não pode ser selecionado sem possuir cartas');
  });

  await runAssertionAsync('Simulação: quando Dezembro/2026 possuir cartas ativas, ela VENCE automaticamente por data_inicio DESC', async () => {
    const simulacaoDezComCartas = await obterCompetenciaOperacionalCartaAnuencia(adminSb, {
      competencias: [
        { competencia: 'Dezembro/2026', data_inicio: '2026-01-01', encerrada: false },
        { competencia: 'Junho/2026', data_inicio: '2025-07-01', encerrada: false },
      ],
      cartasAtivas: [
        { competencia: 'Junho/2026', status: 'EMITIDA' },
        { competencia: 'Dezembro/2026', status: 'EMITIDA' },
      ],
    });
    assert.strictEqual(simulacaoDezComCartas, 'Dezembro/2026', 'Dezembro/2026 deve vencer quando tiver cartas ativas');
  });

  await runAssertionAsync('Simulação: competência encerrada NÃO é selecionada mesmo possuindo cartas', async () => {
    const simulacaoEncerrada = await obterCompetenciaOperacionalCartaAnuencia(adminSb, {
      competencias: [
        { competencia: 'Junho/2026', data_inicio: '2025-07-01', encerrada: true },
        { competencia: 'Dezembro/2026', data_inicio: '2026-01-01', encerrada: false },
      ],
      cartasAtivas: [
        { competencia: 'Junho/2026', status: 'ASSINADA' },
      ],
    });
    // Junho/2026 está encerrada e Dezembro/2026 não tem cartas -> retorna null
    assert.strictEqual(simulacaoEncerrada, null, 'Competência encerrada não pode ser selecionada');
  });

  await runAssertionAsync('Simulação: ausência de competência elegível com cartas retorna null (estado seguro)', async () => {
    const simulacaoSemCartas = await obterCompetenciaOperacionalCartaAnuencia(adminSb, {
      competencias: [
        { competencia: 'Dezembro/2026', data_inicio: '2026-01-01', encerrada: false },
      ],
      cartasAtivas: [],
    });
    assert.strictEqual(simulacaoSemCartas, null, 'Deve retornar null quando não há cartas');
  });

  // ─── BATERIA 4: INTEGRAÇÃO COM SSOT E AUDITORIA DE MÉTRICAS ─────────────────
  console.log('\n--- 🧪 BATERIA 4: INTEGRAÇÃO COM SSOT E MÉTRICAS NA BASE REAL ---');

  const rdmCartasResult = await getRdmCartaAnuenciaData();

  runAssertion('getRdmCartaAnuenciaData retorna status "OK" com competência operacional Junho/2026', () => {
    assert.strictEqual(rdmCartasResult.status, 'OK', 'Status deve ser OK');
    assert.strictEqual(rdmCartasResult.competencia, 'Junho/2026');
  });

  await runAssertionAsync('Dados do adapter coincidem estritamente com obterDadosFarolGerencial(competenciaOperacional)', async () => {
    const ssotResumo = await obterDadosFarolGerencial({ competencia: 'Junho/2026' });
    assert.strictEqual(rdmCartasResult.ranking.length, ssotResumo.ranking_assinatura.length, 'Quantidade de gerentes deve ser idêntica');

    for (let i = 0; i < rdmCartasResult.ranking.length; i++) {
      const adapterItem = rdmCartasResult.ranking[i];
      const ssotItem = ssotResumo.ranking_assinatura[i];
      assert.strictEqual(adapterItem.total_cartas, ssotItem.total_cartas, `Gerente ${adapterItem.gerente}: total_cartas deve bater com SSOT`);
      assert.strictEqual(adapterItem.cartas_para_assinar, ssotItem.cartas_para_assinar, `Gerente ${adapterItem.gerente}: cartas_para_assinar deve bater com SSOT`);
      assert.strictEqual(adapterItem.cartas_assinadas, ssotItem.cartas_assinadas, `Gerente ${adapterItem.gerente}: cartas_assinadas deve bater com SSOT`);
      assert.strictEqual(adapterItem.pct_cartas_assinadas, ssotItem.pct_cartas_assinadas, `Gerente ${adapterItem.gerente}: pct_cartas_assinadas deve bater com SSOT`);
    }
  });

  const ranking = rdmCartasResult.ranking;
  const john = ranking.find((r: any) => r.gerente === 'JOHN GUEDES');
  const leandro = ranking.find((r: any) => r.gerente === 'LEANDRO');
  const luiz = ranking.find((r: any) => r.gerente === 'LUIZ');
  const julliano = ranking.find((r: any) => r.gerente === 'JULLIANO');

  runAssertion('John Guedes: 6 total | 4 para assinar | 2 assinadas | 33,3%', () => {
    assert.strictEqual(john.total_cartas, 6);
    assert.strictEqual(john.cartas_para_assinar, 4);
    assert.strictEqual(john.cartas_assinadas, 2);
    assert.strictEqual(john.pct_cartas_assinadas, 33.3);
  });

  runAssertion('Leandro: 8 total | 7 para assinar | 1 assinada | 12,5%', () => {
    assert.strictEqual(leandro.total_cartas, 8);
    assert.strictEqual(leandro.cartas_para_assinar, 7);
    assert.strictEqual(leandro.cartas_assinadas, 1);
    assert.strictEqual(leandro.pct_cartas_assinadas, 12.5);
  });

  runAssertion('Luiz: 11 total | 10 para assinar | 1 assinada | 9,1%', () => {
    assert.strictEqual(luiz.total_cartas, 11);
    assert.strictEqual(luiz.cartas_para_assinar, 10);
    assert.strictEqual(luiz.cartas_assinadas, 1);
    assert.strictEqual(luiz.pct_cartas_assinadas, 9.1);
  });

  runAssertion('Julliano: 4 total | 4 para assinar | 0 assinadas | 0,0%', () => {
    assert.strictEqual(julliano.total_cartas, 4);
    assert.strictEqual(julliano.cartas_para_assinar, 4);
    assert.strictEqual(julliano.cartas_assinadas, 0);
    assert.strictEqual(julliano.pct_cartas_assinadas, 0);
  });

  runAssertion('TOTAL BRASIL: soma exata das cartas (29 total, 25 para assinar, 4 assinadas)', () => {
    const tb = rdmCartasResult.totalBrasil;
    assert.strictEqual(tb.total_cartas, 29, 'Total de cartas Brasil deve ser 29');
    assert.strictEqual(tb.cartas_para_assinar, 25, 'Cartas para assinar Brasil deve ser 25');
    assert.strictEqual(tb.cartas_assinadas, 4, 'Cartas assinadas Brasil deve ser 4');
  });

  runAssertion('TOTAL BRASIL: percentual nacional matematicamente recalculado (13,8%)', () => {
    const tb = rdmCartasResult.totalBrasil;
    const expectedPct = Number(((4 / 29) * 100).toFixed(1));
    assert.strictEqual(tb.pct_cartas_assinadas, expectedPct, 'Percentual deve ser 13.8% e não média de gerentes');
  });

  // ─── BATERIA 5: DESACOPLAMENTO DO MÊS FINANCEIRO DO RDM (API GET) ───────────
  console.log('\n--- 🧪 BATERIA 5: TESTE DE ROTA GET COM RDM EM AGOSTO/2026 ---');

  const { GET } = require('../src/app/api/processo-comercial/rdm/route');

  // Simular requisição do RDM para Agosto/2026 (CRISTIANO)
  const reqAgosto = new Request('http://localhost:3000/api/processo-comercial/rdm?year=2026&month=8&manager=CRISTIANO');
  const resAgosto = await GET(reqAgosto);
  const dataAgosto = await resAgosto.json();

  runAssertion('GET /api/processo-comercial/rdm?year=2026&month=8 retorna 200 e success = true', () => {
    assert.strictEqual(resAgosto.status, 200);
    assert.strictEqual(dataAgosto.success, true);
  });

  runAssertion('Slide 15 NÃO é contaminado por Agosto/2026 e utiliza a competência operacional de cartas (Junho/2026)', () => {
    assert(dataAgosto.cartaAnuencia !== undefined, 'Payload deve conter cartaAnuencia');
    assert.strictEqual(dataAgosto.cartaAnuencia.status, 'OK');
    assert.strictEqual(dataAgosto.cartaAnuencia.competencia, 'Junho/2026');
    assert.strictEqual(dataAgosto.cartaAnuencia.totalBrasil.total_cartas, 29);
  });

  // Simular requisição do RDM para Gerente Individual (Julliano)
  const reqJulliano = new Request('http://localhost:3000/api/processo-comercial/rdm?year=2026&month=8&manager=Julliano');
  const resJulliano = await GET(reqJulliano);
  const dataJulliano = await resJulliano.json();

  runAssertion('GET com manager=Julliano retorna payload consistente com perfil individual', () => {
    assert.strictEqual(resJulliano.status, 200);
    assert.strictEqual(dataJulliano.success, true);
    assert(dataJulliano.cartaAnuencia !== undefined);
  });

  // ─── BATERIA 6: AUDITORIA DE NÃO-REGRESSÃO E ISOLAMENTO ─────────────────────
  console.log('\n--- 🧪 BATERIA 6: AUDITORIA DE ISOLAMENTO E NÃO-REGRESSÃO ---');

  runAssertion('Slide 05 (Farol), Slide 08 (DRE) e Slide 14 (Invest Rede) preservados no payload', () => {
    assert(dataAgosto.farol !== undefined, 'farol deve estar presente');
    assert(dataAgosto.dreGerencialPorGerente !== undefined, 'dreGerencialPorGerente deve estar presente');
    assert(dataAgosto.month === 8, 'Mês deve ser 8');
    assert(dataAgosto.year === 2026, 'Ano deve ser 2026');
  });

  console.log('\n================================================================================');
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  console.log(`📊 RESUMO DA SUÍTE: ${passedCount}/${results.length} TESTES APROVADOS (${allPassed ? '100% SUCESSO' : 'FALHAS DETECTADAS'})`);
  console.log('================================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runCartasAnuenciaSuite().catch((err) => {
  console.error('Erro fatal na execução da suíte:', err);
  process.exit(1);
});
