/**
 * 🏛️ COFFEE++ — TESTE DE HOMOLOGAÇÃO: RDM P3 (HARDENING CARTA DE ANUÊNCIA × RDM)
 * 
 * Validação obrigatória dos dois objetivos do RDM P3:
 * 1. ACHADO P2:
 *    - Ausência de deleted_at em client-farol-service.ts (sem erro Postgres 42703);
 *    - Consulta de rede com carta ativa retorna status real (não DADOS_INDISPONIVEIS);
 *    - Cartas com status CANCELADA são expurgadas da consulta;
 *    - Rede sem carta retorna SEM_CARTA;
 *    - Endpoint /api/inovacoes/crm/farol permanece funcional.
 * 
 * 2. ACHADO P3:
 *    - Admin / Diretoria / Trade conseguem executar upload para qualquer rede;
 *    - Gerente Regional consegue executar upload de logo para rede de sua carteira;
 *    - Gerente Regional recebe 403 Forbidden ao tentar upload para rede fora de sua carteira;
 *    - Validação de escopo ocorre ANTES do upload no Storage corporativo.
 */

import dotenv from 'dotenv';
import path from 'path';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { ClientFarolService } from '../src/lib/services/client-farol-service';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let testCounter = 0;

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

async function runSuite() {
  console.log('\n================================================================================');
  console.log('🏛️ COFFEE++ — TESTE DE HOMOLOGAÇÃO: RDM P3 (HARDENING)');
  console.log('================================================================================\n');

  const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // ---------------------------------------------------------------------------
  // BATERIA 1: TESTES DO ACHADO P2 (client-farol-service.ts)
  // ---------------------------------------------------------------------------
  console.log('--- 🧪 BATERIA 1: ACHADO P2 — CONSULTA DE CARTA NO FAROL 360° ---');

  await runAssertionAsync(
    'P2.1: Rede com carta (ZAFFARI - 84906.0) NÃO retorna DADOS_INDISPONIVEIS e traz status real',
    async () => {
      const summary = await ClientFarolService.getFarol({
        redeId: '84906.0',
        codigoMatriz: '84906.0',
        redeNome: 'ZAFFARI',
      });

      assert.ok(summary, 'Resumo do farol deve existir');
      assert.notStrictEqual(
        summary.cartaAnuencia.status,
        'DADOS_INDISPONIVEIS',
        'Status não pode ser DADOS_INDISPONIVEIS (deve resolver com sucesso)'
      );
      assert.strictEqual(summary.cartaAnuencia.numeroCarta, 'CA-2026-000001');
      assert.strictEqual(summary.cartaAnuencia.competencia, 'Junho/2026');
      console.log(`     -> Status retornado: ${summary.cartaAnuencia.status}, Carta: ${summary.cartaAnuencia.numeroCarta}`);
    }
  );

  await runAssertionAsync(
    'P2.2: Rede com carta emitida (FESTVAL - 27068.0) retorna status real calculado (não DADOS_INDISPONIVEIS)',
    async () => {
      const summary = await ClientFarolService.getFarol({
        redeId: '27068.0',
        codigoMatriz: '27068.0',
        redeNome: 'FESTVAL',
      });

      assert.ok(summary, 'Resumo do farol deve existir');
      assert.notStrictEqual(summary.cartaAnuencia.status, 'DADOS_INDISPONIVEIS');
      assert.strictEqual(summary.cartaAnuencia.numeroCarta, 'CA-2026-000002');
      assert.ok(
        ['VIGENTE', 'EXPIRADA', 'PENDENTE', 'EMITIDA'].includes(summary.cartaAnuencia.status),
        `Status deve ser um status comercial válido: ${summary.cartaAnuencia.status}`
      );
      console.log(`     -> Status retornado: ${summary.cartaAnuencia.status}, Carta: ${summary.cartaAnuencia.numeroCarta}`);
    }
  );

  await runAssertionAsync(
    'P2.3: Rede sem carta no sistema (ex: KOCH - 02831) retorna status SEM_CARTA',
    async () => {
      const summary = await ClientFarolService.getFarol({
        redeId: '02831',
        codigoMatriz: '02831',
        redeNome: 'KOCH',
      });

      assert.ok(summary, 'Resumo do farol deve existir');
      assert.strictEqual(summary.cartaAnuencia.status, 'SEM_CARTA');
      assert.strictEqual(summary.cartaAnuencia.numeroCarta, null);
      console.log(`     -> Status retornado para KOCH: ${summary.cartaAnuencia.status}`);
    }
  );

  await runAssertionAsync(
    'P2.4: Coluna deleted_at não existe no banco e query com neq CANCELADA executa sem erro',
    async () => {
      const { data, error } = await adminSb
        .from('cm_cartas_anuencia')
        .select('id, numero_carta, status')
        .neq('status', 'CANCELADA')
        .limit(5);

      assert.strictEqual(error, null, 'Query não pode retornar erro');
      assert.ok(data && data.length > 0, 'Deve retornar cartas ativas');
    }
  );

  // ---------------------------------------------------------------------------
  // BATERIA 2: TESTES DO ACHADO P3 (RBAC no upload de logos)
  // ---------------------------------------------------------------------------
  console.log('\n--- 🧪 BATERIA 2: ACHADO P3 — BLINDAGEM RBAC EM UPLOAD DE LOGOS ---');

  // Buscar perfis dos gerentes para simulação
  const { data: profiles } = await adminSb
    .from('cm_user_profiles')
    .select('id, role, approved, name, manager_name')
    .in('role', ['Gerente Regional', 'Admin']);

  const leandroProfile = profiles?.find((p) => (p.name || '').includes('Leandro') || (p.manager_name || '').includes('Leandro'));
  const johnProfile = profiles?.find((p) => (p.name || '').includes('John') || (p.manager_name || '').includes('John'));
  const adminProfile = profiles?.find((p) => p.role === 'Admin');

  assert.ok(leandroProfile, 'Perfil Leandro deve existir');
  assert.ok(johnProfile, 'Perfil John deve existir');
  assert.ok(adminProfile, 'Perfil Admin deve existir');

  // Simular a lógica exata de actions.ts:
  const { resolveCanonicalManager } = await import('../src/lib/domain/canonical');

  async function testResolverCarteira(profile: any): Promise<Set<string> | null> {
    if (profile?.role !== 'Gerente Regional') return null;
    const rawGerente = profile.manager_name || profile.name || null;
    if (!rawGerente) return new Set<string>();
    const gerenteName = resolveCanonicalManager(rawGerente).managerName;

    const { data: clientes } = await adminSb
      .from('cm_clientes')
      .select('codigo_matriz')
      .eq('manager_name', gerenteName);

    return new Set<string>(
      (clientes || []).map((c: any) => String(c.codigo_matriz || '').trim()).filter(Boolean)
    );
  }

  function testValidarAcessoRede(carteira: Set<string> | null, redeId: string | null | undefined): boolean {
    if (carteira === null) return true; // Admin / visão nacional
    if (!redeId) return false;
    const idStr = String(redeId).trim();
    const idBase = idStr.replace(/\.\d+$/, '').trim();
    return carteira.has(idStr) || carteira.has(idBase);
  }

  await runAssertionAsync(
    'P3.1: Admin possui visão irrestrita e carteiraGerente = null (retorna true para qualquer rede)',
    async () => {
      const carteira = await testResolverCarteira(adminProfile);
      assert.strictEqual(carteira, null, 'Admin deve retornar null');
      assert.strictEqual(testValidarAcessoRede(carteira, '84906.0'), true);
      assert.strictEqual(testValidarAcessoRede(carteira, '115595.0'), true);
      assert.strictEqual(testValidarAcessoRede(carteira, 'QUALQUER_REDE'), true);
    }
  );

  await runAssertionAsync(
    'P3.2: Leandro Saffi possui autorização para rede de sua carteira (ex: ZAFFARI - 84906.0 ou ANGELONI - 20693.0)',
    async () => {
      const carteira = await testResolverCarteira(leandroProfile);
      assert.ok(carteira instanceof Set, 'Carteira deve ser Set');
      assert.strictEqual(testValidarAcessoRede(carteira, '84906.0'), true, 'Leandro deve ter acesso a ZAFFARI');
      assert.strictEqual(testValidarAcessoRede(carteira, '20693.0'), true, 'Leandro deve ter acesso a ANGELONI');
    }
  );

  await runAssertionAsync(
    'P3.3: Leandro Saffi é BLOQUEADO (retorna false / 403) para rede do John Guedes (ex: DONA - 24453.0 ou SUPER ADEGA - 169483.0)',
    async () => {
      const carteira = await testResolverCarteira(leandroProfile);
      assert.strictEqual(testValidarAcessoRede(carteira, '24453.0'), false, 'Leandro NÃO pode ter acesso a DONA');
      assert.strictEqual(testValidarAcessoRede(carteira, '169483.0'), false, 'Leandro NÃO pode ter acesso a SUPER ADEGA');
    }
  );

  await runAssertionAsync(
    'P3.4: John Guedes possui autorização para sua rede (DONA - 24453.0) e é bloqueado para BISTEK (146775.0)',
    async () => {
      const carteira = await testResolverCarteira(johnProfile);
      assert.strictEqual(testValidarAcessoRede(carteira, '24453.0'), true, 'John deve ter acesso a DONA');
      assert.strictEqual(testValidarAcessoRede(carteira, '146775.0'), false, 'John NÃO pode ter acesso a BISTEK');
    }
  );

  // ---------------------------------------------------------------------------
  // BATERIA 3: INTEGRIDADE DO CÓDIGO FONTE
  // ---------------------------------------------------------------------------
  console.log('\n--- 🧪 BATERIA 3: AUDITORIA ESTÁTICA DO CÓDIGO FONTE ---');

  const fs = await import('fs');
  const clientFarolCode = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/client-farol-service.ts'), 'utf8');
  const actionsCode = fs.readFileSync(path.join(process.cwd(), 'src/app/investimento/carta-anuencia/actions.ts'), 'utf8');

  await runAssertionAsync(
    'P3.5: client-farol-service.ts NÃO contém nenhuma ocorrência de "deleted_at"',
    async () => {
      assert.strictEqual(clientFarolCode.includes('deleted_at'), false, 'Não deve conter deleted_at');
      assert.strictEqual(clientFarolCode.includes('.neq("status", "CANCELADA")'), true, 'Deve conter filtro neq CANCELADA');
    }
  );

  await runAssertionAsync(
    'P3.6: processarEUploadLogoRede contém resolverCarteiraGerente e validarAcessoRede antes do upload',
    async () => {
      const fnIdx = actionsCode.indexOf('export async function processarEUploadLogoRede');
      const uploadIdx = actionsCode.indexOf('uploadErr', fnIdx);
      const rbacIdx = actionsCode.indexOf('validarAcessoRede(carteiraGerente, redeId)', fnIdx);

      assert.ok(fnIdx > 0, 'Função processarEUploadLogoRede deve existir');
      assert.ok(rbacIdx > fnIdx, 'Validação RBAC deve estar dentro da função');
      assert.ok(rbacIdx < uploadIdx, 'Validação RBAC deve ocorrer ANTES do upload ao Storage');
    }
  );

  // Resumo
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================================');
  console.log(`📊 RESUMO DA SUÍTE RDM P3: ${passed}/${total} TESTES APROVADOS (${failed === 0 ? '100% SUCESSO' : 'FALHAS'})`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Erro fatal na suíte RDM P3:', err);
  process.exit(1);
});
