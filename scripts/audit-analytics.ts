/**
 * Auditoria Automática de Governança Analítica — Coffee++
 * 
 * Script de varredura estática do código-fonte para garantia de 100% de aderência
 * às regras da Governança Financeira Oficial e uso exclusivo da AnalyticsEngine.
 * 
 * @see Regra de Governança Financeira (Seção 10 e Blindagem Analytics Engine V1)
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  rule: string;
  detail: string;
  line?: number;
}

// Exceções homologadas de infraestrutura de importação, conciliação e BigQuery
const ALLOWED_PHYSICAL_TABLE_EXCEPTIONS = [
  'import-service.ts',
  'sync-faturamento/route.ts',
  'tg_fn_sync_faturamento_sankhya_stmt',
  'daily/route.ts', // Exceção homologada para dados realtime diários
  'process-excel/route.ts', // Engine de importação de planilhas Staging
  'bigquery.ts', // Mapeamento BigQuery
  'conciliation.ts', // Conciliação Fase 6
  'clienteMatching.ts', // Motor de pareamento de nomes de clientes
  'autoAssociacaoService.ts', // Serviço de pareamento
  'motorResponsavel.ts', // Motor de responsáveis
  'scoreConfianca.ts', // Engine de score
  'route-engine.ts', // IA de rotas
  'get_actual_sales_v2', // RPC homologada da Fase 3
];

// Arquivos autorizados no Registry de Views
const ALLOWED_VIEW_REGISTRY_FILES = [
  'sources.ts',
  'engine.ts',
  'audit-analytics.ts',
  'verify-parity.ts',
  'route-engine.ts',
  'daily/route.ts', // Exceção homologada da Seção 10 para faturamento diário
  'OFFICIAL_ANALYTICS_SOURCES', // Uso via constante exportada da AnalyticsEngine
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function auditFile(filePath: string, violations: Violation[]): void {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // 1. Verificar consultas diretas a tabelas físicas não homologadas
    if (line.includes('cm_faturamento') || line.includes('cm_faturamento_sankhya') || line.includes('sales_v2')) {
      const isAllowedException = ALLOWED_PHYSICAL_TABLE_EXCEPTIONS.some(exc => filePath.includes(exc) || line.includes(exc));
      if (!isAllowedException) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PROIBIÇÃO_DE_TABELAS_FÍSICAS',
          detail: `Consulta direta a tabela física não homologada encontrada: '${line.trim()}'`,
        });
      }
    }

    // 2. Verificar referências diretas a views oficiais fora do Registry
    if (
      (line.includes('"mv_vendas_mensal"') || line.includes("'mv_vendas_mensal'") ||
       line.includes('"mv_vendas_cliente_mensal"') || line.includes("'mv_vendas_cliente_mensal'") ||
       line.includes('"mv_positivacao_sku_mensal"') || line.includes("'mv_positivacao_sku_mensal'"))
    ) {
      const isAllowedRegistryFile = ALLOWED_VIEW_REGISTRY_FILES.some(reg => filePath.includes(reg) || content.includes(reg));
      if (!isAllowedRegistryFile) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'EXCLUSIVIDADE_REGISTRY_OFICIAL',
          detail: `Nome de view oficial hardcoded fora do Registry ('sources.ts'): '${line.trim()}'`,
        });
      }
    }

    // 3. Verificar duplicação de cláusula buildWhereClause local em rotas da API do Dashboard
    if (filePath.includes('/src/app/api/dashboard/') && (line.includes('function buildWhereClause') || line.includes('let filterSql'))) {
      violations.push({
        file: filePath,
        line: lineNum,
        rule: 'DUPLICAÇÃO_DE_QUERY_BUILDER',
        detail: `Construção local de cláusula WHERE em rota da API. Utilize 'AnalyticsEngine': '${line.trim()}'`,
      });
    }

    // 4. Verificar consultas SQL brutas em rotas da API do Dashboard
    if (filePath.includes('/src/app/api/dashboard/') && line.includes('SELECT ') && !filePath.includes('/api/dashboard/daily')) {
      const isAllowedRegistryFile = ALLOWED_VIEW_REGISTRY_FILES.some(reg => filePath.includes(reg));
      if (!isAllowedRegistryFile) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PROIBIÇÃO_DE_SQL_SOLTO_EM_APIS',
          detail: `SQL montado diretamente na rota da API. A rota deve delegar à 'AnalyticsEngine': '${line.trim()}'`,
        });
      }
    }
  });
}

function runAudit() {
  console.log('====================================================');
  console.log('🔍 INICIANDO AUDITORIA AUTOMÁTICA DE GOVERNANÇA (Analytics Engine V1)');
  console.log('====================================================\n');

  const rootDir = path.resolve(process.cwd(), 'src');
  const files = getAllFiles(rootDir);
  const violations: Violation[] = [];

  console.log(`Analizando ${files.length} arquivos TypeScript/TSX em 'src/'...\n`);

  files.forEach(file => auditFile(file, violations));

  console.log('----------------------------------------------------');
  console.log('RESULTADO DA AUDITORIA:');
  console.log('----------------------------------------------------');

  if (violations.length === 0) {
    console.log('✅ Nenhuma inconsistência encontrada!');
    console.log('🏆 Percentual de Aderência à Governança Financeira Oficial: 100.00%');
    console.log('====================================================\n');
    process.exit(0);
  } else {
    console.error(`❌ Foram encontradas ${violations.length} violação(ões) de governança:\n`);
    violations.forEach((v, i) => {
      console.error(`${i + 1}. [${v.rule}] em ${v.file}:${v.line}`);
      console.error(`   ${v.detail}\n`);
    });

    const totalAudited = files.length;
    const cleanFiles = totalAudited - new Set(violations.map(v => v.file)).size;
    const adherenceScore = ((cleanFiles / totalAudited) * 100).toFixed(2);

    console.error(`📊 Percentual de Aderência à Governança Financeira Oficial: ${adherenceScore}%`);
    console.error('====================================================\n');
    process.exit(1);
  }
}

runAudit();
