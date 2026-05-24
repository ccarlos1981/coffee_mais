/**
 * import_atendimento.js
 * 
 * Importa a planilha de Atendimento (cadastro de clientes/PDVs)
 * para a tabela base_atendimento no Supabase.
 * 
 * Uso: node import_atendimento.js [caminho_do_arquivo.xlsx]
 * 
 * Se não informar o caminho, usa o padrão definido abaixo.
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// ── Carregar variáveis de ambiente ──
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) envVars[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// ── Canais válidos ──
const CANAIS_VALIDOS = ['KA', 'Distribuidor'];

/**
 * Mapeia os headers da planilha para os campos do banco.
 * Isso torna o script resiliente a variações nos nomes de coluna.
 */
const HEADER_MAP = {
  // cod_parceiro
  'Cód. Parceiro': 'cod_parceiro',
  'Cod. Parceiro': 'cod_parceiro',
  'Código Parceiro': 'cod_parceiro',
  'CÓD. PARCEIRO': 'cod_parceiro',
  'cod_parceiro': 'cod_parceiro',

  // nome_parceiro
  'Nome / Razão': 'nome_parceiro',
  'Nome/Razão': 'nome_parceiro',
  'Nome do Parceiro': 'nome_parceiro',
  'NOME / RAZÃO': 'nome_parceiro',
  'Parceiro': 'nome_parceiro',
  'nome_parceiro': 'nome_parceiro',

  // matriz_rede
  'Matriz (Rede)': 'matriz_rede',
  'Rede': 'matriz_rede',
  'MATRIZ (REDE)': 'matriz_rede',
  'Rede_UF': 'rede_uf',

  // canal
  'Canal': 'canal',
  'CANAL': 'canal',
  'canal': 'canal',

  // manager
  'Gerente': 'manager',
  'GERENTE': 'manager',
  'Responsável': 'manager',
  'gerente': 'manager',

  // uf
  'UF': 'uf',
  'uf': 'uf',
  'Estado': 'uf',

  // regional
  'Regional': 'regional',
  'REGIONAL': 'regional',
  'regional': 'regional',

  // ka
  'KA': 'ka',
  'ka': 'ka',

  // cnpj
  'CNPJ': 'cnpj',
  'cnpj': 'cnpj',
};

function normalizeHeaders(rawHeaders) {
  const mapping = {};
  for (const h of rawHeaders) {
    const trimmed = (h || '').toString().trim();
    if (HEADER_MAP[trimmed]) {
      mapping[trimmed] = HEADER_MAP[trimmed];
    } else {
      // Tenta match case-insensitive
      const lower = trimmed.toLowerCase();
      for (const [key, val] of Object.entries(HEADER_MAP)) {
        if (key.toLowerCase() === lower) {
          mapping[trimmed] = val;
          break;
        }
      }
    }
  }
  return mapping;
}

async function importAtendimento() {
  const filePath = process.argv[2] || './Dados da Coffee mais/base_atendimento.xlsx';
  
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Arquivo não encontrado: ${filePath}`);
    console.log(`\nUso: node import_atendimento.js [caminho_do_arquivo.xlsx]`);
    console.log(`Exemplo: node import_atendimento.js "./Dados da Coffee mais/atendimento.xlsx"\n`);
    process.exit(1);
  }

  console.log(`\n📂 Carregando: ${filePath}`);
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  
  console.log(`📋 Abas encontradas: ${workbook.SheetNames.join(', ')}`);
  
  // Usar primeira aba
  const sheetName = workbook.SheetNames[0];
  console.log(`📖 Lendo aba: ${sheetName}`);
  
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Encontrar a linha de headers (procura nas primeiras 10 linhas)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    if (row && Array.isArray(row)) {
      const hasPartner = row.some(cell => 
        typeof cell === 'string' && (
          cell.includes('Parceiro') || cell.includes('parceiro') || 
          cell.includes('PARCEIRO') || cell.includes('Nome')
        )
      );
      if (hasPartner) {
        headerRowIdx = i;
        break;
      }
    }
  }
  
  const headers = rawData[headerRowIdx].map(h => (h || '').toString().trim());
  console.log(`\n📋 Headers detectados na linha ${headerRowIdx + 1}:`);
  headers.forEach((h, i) => console.log(`   [${i}] ${h}`));
  
  const headerMapping = normalizeHeaders(headers);
  console.log(`\n🔗 Mapeamento de colunas:`);
  Object.entries(headerMapping).forEach(([from, to]) => console.log(`   "${from}" → ${to}`));
  
  // Verificar se temos os campos mínimos
  const mappedFields = new Set(Object.values(headerMapping));
  if (!mappedFields.has('cod_parceiro')) {
    console.error('\n❌ Coluna obrigatória não encontrada: Cód. Parceiro');
    console.log('Headers disponíveis:', headers.join(', '));
    process.exit(1);
  }
  
  // Parsear dados
  const rows = [];
  const skipped = { noCode: 0, noName: 0, total: 0 };
  
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const rawRow = rawData[i];
    if (!rawRow || !Array.isArray(rawRow) || rawRow.length === 0) continue;
    
    // Mapear colunas
    const mapped = {};
    headers.forEach((h, idx) => {
      const field = headerMapping[h];
      if (field && rawRow[idx] !== undefined && rawRow[idx] !== null) {
        mapped[field] = String(rawRow[idx]).trim();
      }
    });
    
    // Validações
    if (!mapped.cod_parceiro || mapped.cod_parceiro === '' || mapped.cod_parceiro === 'undefined') {
      skipped.noCode++;
      continue;
    }
    
    // Limpar código do parceiro (remover .0 de números)
    mapped.cod_parceiro = mapped.cod_parceiro.replace(/\.0$/, '');
    
    // Construir rede_uf se não existe
    if (!mapped.rede_uf && mapped.matriz_rede && mapped.uf) {
      mapped.rede_uf = `${mapped.matriz_rede}_${mapped.uf}`;
    }
    
    // Garantir canal válido
    if (mapped.canal && !CANAIS_VALIDOS.includes(mapped.canal)) {
      // Tentar normalizar
      const canalUpper = mapped.canal.toUpperCase();
      if (canalUpper.includes('KA')) mapped.canal = 'KA';
      else if (canalUpper.includes('DISTRIB')) mapped.canal = 'Distribuidor';
      // Se não for KA nem Distribuidor, manter o original — será filtrado na consulta
    }
    
    rows.push({
      cod_parceiro: mapped.cod_parceiro,
      nome_parceiro: mapped.nome_parceiro || null,
      rede: mapped.matriz_rede || null,
      rede_uf: mapped.rede_uf || null,
      canal: mapped.canal || null,
      manager: mapped.manager || null,
      uf: mapped.uf || null,
      regional: mapped.regional || null,
      ka: mapped.ka || null,
      cnpj: mapped.cnpj || null,
      status: 'ativo',
    });
  }
  
  console.log(`\n📊 Resumo da leitura:`);
  console.log(`   Total de linhas válidas: ${rows.length}`);
  console.log(`   Ignoradas (sem código): ${skipped.noCode}`);
  
  // Estatísticas
  const canalDist = {};
  const managerDist = {};
  rows.forEach(r => {
    canalDist[r.canal || 'SEM CANAL'] = (canalDist[r.canal || 'SEM CANAL'] || 0) + 1;
    managerDist[r.manager || 'SEM GERENTE'] = (managerDist[r.manager || 'SEM GERENTE'] || 0) + 1;
  });
  
  console.log(`\n📡 Distribuição por Canal:`);
  Object.entries(canalDist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const marker = CANAIS_VALIDOS.includes(k) ? '✅' : '⚠️';
    console.log(`   ${marker} ${k}: ${v}`);
  });
  
  console.log(`\n👥 Distribuição por Gerente:`);
  Object.entries(managerDist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`   ${k}: ${v}`);
  });
  
  // Inserção com upsert
  console.log(`\n🚀 Inserindo/atualizando ${rows.length} registros na base_atendimento...`);
  
  let successCount = 0;
  let errorCount = 0;
  const batchSize = 500;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error: upsertError } = await supabase
      .from('base_atendimento')
      .upsert(batch, { onConflict: 'cod_parceiro' });
    
    if (upsertError) {
      console.error(`   ❌ Erro no batch ${i}-${i + batchSize}:`, upsertError.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
    }
  }
  
  console.log(`\n🎉 Importação concluída!`);
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  
  // Verificar totais no banco
  const { count } = await supabase
    .from('base_atendimento')
    .select('*', { count: 'exact', head: true });
  console.log(`   📦 Total na base_atendimento: ${count}`);
}

importAtendimento().catch(err => {
  console.error('\n💥 Erro fatal:', err);
  process.exit(1);
});
