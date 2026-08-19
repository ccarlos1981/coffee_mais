/**
 * Auditoria Automática de Governança Analítica e Componentes React — Coffee++
 * 
 * Script de varredura estática do código-fonte para garantia de 100% de aderência:
 * 1. Uso exclusivo da AnalyticsEngine e fontes oficiais da Governança Financeira.
 * 2. Bloqueio definitivo de renderização de tags <script> em componentes React/JSX.
 * 3. Validação de segurança para dangerouslySetInnerHTML e layouts Next.js.
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
  'upload/page.tsx', // Hub de Importação UI
  'ownership', // Domínio de ownership
];

// Arquivos autorizados no Registry de Views
const ALLOWED_VIEW_REGISTRY_FILES = [
  'sources.ts',
  'engine.ts',
  'audit-analytics.ts',
  'verify-parity.ts',
  'route-engine.ts',
  'daily/route.ts', // Exceção homologada da Seção 10 para faturamento diário
  'import-service.ts', // Motor de importação DRE
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
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const isTsx = filePath.endsWith('.tsx');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // 1. PROIBIÇÃO ABSOLUTA DE <script> EM COMPONENTES JSX/TSX
    if (isTsx) {
      if (/<script[\s>]/i.test(trimmedLine) || (trimmedLine.includes('<script>') || trimmedLine.includes('</script>'))) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PROIBIÇÃO_DE_SCRIPT_EM_JSX',
          detail: `Renderização de tag <script> nativa dentro de componente React/JSX detectada: '${trimmedLine}'. Utilize o ThemeProvider ou next/script fora da árvore JSX quando apropriado.`,
        });
      }

      if (trimmedLine.includes('React.createElement("script"') || trimmedLine.includes("React.createElement('script'")) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PROIBIÇÃO_DE_SCRIPT_EM_REACT',
          detail: `Criação dinâmica de elemento 'script' via React.createElement detectada: '${trimmedLine}'.`,
        });
      }
    }

    // 2. SEGURANÇA EM dangerouslySetInnerHTML
    if (trimmedLine.includes('dangerouslySetInnerHTML')) {
      if (trimmedLine.includes('<script') || trimmedLine.toLowerCase().includes('script')) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'DANGEROUSLY_SET_INNER_HTML_COM_SCRIPT',
          detail: `Injeção de HTML via dangerouslySetInnerHTML contendo a palavra/tag 'script': '${trimmedLine}'.`,
        });
      }
    }

    // 3. CONSULTAS DIRETAS A TABELAS FÍSICAS NÃO HOMOLOGADAS
    if (line.includes('cm_faturamento') || line.includes('cm_faturamento_sankhya') || line.includes('sales_v2')) {
      const isAllowedException = ALLOWED_PHYSICAL_TABLE_EXCEPTIONS.some(exc => filePath.includes(exc) || line.includes(exc));
      if (!isAllowedException) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PROIBIÇÃO_DE_TABELAS_FÍSICAS',
          detail: `Consulta direta a tabela física não homologada encontrada: '${trimmedLine}'`,
        });
      }
    }

    // 4. REFERÊNCIAS DIRETAS A VIEWS OFICIAIS FORA DO REGISTRY
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
          detail: `Nome de view oficial hardcoded fora do Registry ('sources.ts'): '${trimmedLine}'`,
        });
      }
    }

    // 5. DUPLICAÇÃO DE QUERY BUILDER LOCAL EM APIS DO DASHBOARD
    if (filePath.includes('/src/app/api/dashboard/') && (line.includes('function buildWhereClause') || line.includes('let filterSql'))) {
      violations.push({
        file: filePath,
        line: lineNum,
        rule: 'DUPLICAÇÃO_DE_QUERY_BUILDER',
        detail: `Construção local de cláusula WHERE em rota da API. Utilize 'AnalyticsEngine': '${trimmedLine}'`,
      });
    }

    // 6. CONSULTAS SQL BRUTAS EM APIS DO DASHBOARD
    if (filePath.includes('/src/app/api/dashboard/') && line.includes('SELECT ') && !filePath.includes('/api/dashboard/daily')) {
      const isAllowedRegistryFile = ALLOWED_VIEW_REGISTRY_FILES.some(reg => filePath.includes(reg));
      if (!isAllowedRegistryFile) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PROIBIÇÃO_DE_SQL_SOLTO_EM_APIS',
          detail: `SQL montado diretamente na rota da API. A rota deve delegar à 'AnalyticsEngine': '${trimmedLine}'`,
        });
      }
    }
  });
}

function runAudit() {
  console.log('====================================================');
  console.log('🔍 INICIANDO AUDITORIA AUTOMÁTICA DE GOVERNANÇA E REACT (Analytics & Layout)');
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
    console.log('✅ Nenhuma inconsistência técnica ou de governança encontrada!');
    console.log('🏆 100.00% Conforme: Zero tags <script> em JSX e Governança Financeira Ativa.');
    console.log('====================================================\n');
    process.exit(0);
  } else {
    console.error(`❌ Foram encontradas ${violations.length} violação(ões):\n`);
    violations.forEach((v, i) => {
      console.error(`${i + 1}. [${v.rule}] em ${v.file}:${v.line}`);
      console.error(`   ${v.detail}\n`);
    });

    const totalAudited = files.length;
    const cleanFiles = totalAudited - new Set(violations.map(v => v.file)).size;
    const adherenceScore = ((cleanFiles / totalAudited) * 100).toFixed(2);

    console.error(`📊 Percentual de Aderência Global: ${adherenceScore}%`);
    console.error('====================================================\n');
    process.exit(1);
  }
}

runAudit();
