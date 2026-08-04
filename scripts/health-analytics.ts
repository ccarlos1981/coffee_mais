/**
 * Suíte Permanente de Saúde Analítica (Health Analytics) — Coffee++
 * 
 * Executa sequencialmente a suíte completa de auditoria pré-deploy:
 * 1. audit:analytics (Auditoria Estática de Governança)
 * 2. verify:parity (Verificação de Paridade Financeira)
 * 3. npx tsc --noEmit (Checagem de Tipos TypeScript)
 * 4. npm run build (Compilação Next.js)
 * 
 * @see Regra de Governança Financeira (Seção 10)
 */

import { execSync } from 'child_process';

function runStep(name: string, command: string) {
  console.log(`\n▶ Executando Etapa: ${name}...`);
  console.log(`  Comando: ${command}\n`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ETAPA CONCLUÍDA: ${name}\n`);
  } catch (error) {
    console.error(`\n❌ FALHA NA ETAPA: ${name}`);
    console.error(`O comando '${command}' retornou um erro.`);
    process.exit(1);
  }
}

function main() {
  console.log('====================================================');
  console.log('🏥 SUÍTE DE SAÚDE ANALÍTICA E COMPILAÇÃO (Health Analytics)');
  console.log('====================================================');

  runStep('1. Auditoria Estática de Governança', 'npm run audit:analytics');
  runStep('2. Verificação de Paridade Financeira', 'npm run verify:parity');
  runStep('3. Testes Automatizados de Planejamento Comercial', 'npm run test:planning');
  runStep('4. Checagem de Tipos TypeScript', 'npx tsc --noEmit');
  runStep('5. Compilação Oficial Next.js (Build)', 'npm run build');

  console.log('====================================================');
  console.log('🎉 TODOS OS TESTES E AUDITORIAS FORAM APROVADOS!');
  console.log('🏆 SISTEMA 100% CONFORME COM A GOVERNANÇA FINANCEIRA OFICIAL');
  console.log('====================================================\n');
}

main();
