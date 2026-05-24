/**
 * import_vendas.js
 * 
 * Importa a planilha de Vendas (dados transacionais)
 * para a tabela sales_v2 no Supabase.
 * 
 * IMPORTANTE: Executar DEPOIS do import_atendimento.js,
 * pois cada venda referencia um cod_parceiro da base_atendimento.
 * 
 * Uso: node import_vendas.js [caminho_do_arquivo.xlsx]
 * 
 * Dedup automático via chave UNIQUE — re-importar é seguro.
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

// ── Carregar variáveis de ambiente ──
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) envVars[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function formatDateISO(date) {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function excelDateToDate(serial) {
  if (!serial || serial < 1) return null;
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400000);
}

/**
 * Mapa flexível de headers para campos do banco.
 * Adicione variantes conforme surgirem novos formatos de planilha.
 */
const HEADER_MAP = {
  // Chave
  'Chave': 'chave',

  // Data
  'Data Faturamento': 'invoice_date',
  'Dt. do Faturamento': 'invoice_date',
  'Dt. Neg': 'invoice_date',
  'Dt. Neg.': 'invoice_date',

  // Nota
  'Nro. Nota': 'invoice_number',
  'Nro. Único': 'unique_number',

  // Parceiro
  'Cód. Parceiro': 'cod_parceiro',
  'Cod. Parceiro': 'cod_parceiro',

  // Produto
  'Produto': 'product',
  'Cód. Produto': 'cod_produto',
  'Cod. Produto': 'cod_produto',
  'Tipo de Produto': 'tipo_produto',

  // Quantidades
  'Qtd.': 'quantity',
  'Qtd': 'quantity',

  // Financeiro
  'Vlr. Total Líq.': 'net_value',
  ' Vlr. Total Líq.': 'net_value',
  'Vlr. Unitário': 'vlr_unitario',
  'Imposto': 'imposto',
  'Custo Total': 'custo_total',
  'Custo': 'custo_unitario',
  'Vlr. Desconto': 'discount',
  ' Vlr. Desconto': 'discount',

  // Frete
  'Receita Frete': 'receita_frete',
  ' Receita Frete': 'receita_frete',
  'Custo Frete': 'custo_frete',
  'Vlr. Frete': 'vlr_frete',
  'Vlr. do Frete': 'vlr_frete',

  // Substituição
  'Vlr. Substituição': 'vlr_substituicao',
  'Vlr. Total ST': 'vlr_substituicao',

  // Classificação
  'Descrição (Natureza)': 'channel_desc',
  'CFOP': 'cfop',
  'Vendedor': 'seller',
  'Apelido (Vendedor)': 'seller',
  'Empresa': 'empresa',
  'Tipo Pagamento': 'payment_type',

  // Tempo
  'Ano': 'ano',
  'Mês': 'mes',
  'Dia': 'dia',
  'Ano_Mês': 'ano_mes',

  // Extras ignorados mas logados
  'Responsável': '_responsavel',
  'Regional': '_regional',
  'UF': '_uf',
  'Rede_UF': '_rede_uf',
  'KA': '_ka',
  'Rede': '_rede',
  'Nome do Parceiro': '_nome_parceiro',
  'Ativo?': '_ativo',
};

function normalizeHeaders(rawHeaders) {
  const mapping = {};
  for (const h of rawHeaders) {
    const trimmed = (h || '').toString().trim();
    if (HEADER_MAP[trimmed]) {
      mapping[trimmed] = HEADER_MAP[trimmed];
    } else {
      // Tentar variação com espaço no início
      const withSpace = ' ' + trimmed;
      if (HEADER_MAP[withSpace]) {
        mapping[h] = HEADER_MAP[withSpace];
      }
    }
  }
  return mapping;
}

function parseDate(rawDate) {
  if (!rawDate) return null;
  if (rawDate instanceof Date) return formatDateISO(rawDate);
  if (typeof rawDate === 'number') return formatDateISO(excelDateToDate(rawDate));
  if (typeof rawDate === 'string') {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) return formatDateISO(d);
  }
  return null;
}

function safeFloat(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function safeStr(val) {
  if (val === null || val === undefined || val === false) return null;
  return String(val).trim() || null;
}

async function importVendas() {
  const filePath = process.argv[2] || './Dados da Coffee mais/vendas.xlsx';
  
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Arquivo não encontrado: ${filePath}`);
    console.log(`\nUso: node import_vendas.js [caminho_do_arquivo.xlsx]`);
    console.log(`Exemplo: node import_vendas.js "./Dados da Coffee mais/vendas_2024.xlsx"\n`);
    process.exit(1);
  }

  console.log(`\n📂 Carregando: ${filePath} (pode demorar para arquivos grandes)...`);
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  
  console.log(`📋 Abas encontradas: ${workbook.SheetNames.join(', ')}`);
  
  // Processar cada aba
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  const batchId = crypto.randomUUID();
  await supabase.from('upload_batches').insert({
    id: batchId,
    filename: filePath.split('/').pop(),
    file_type: 'xlsx',
    status: 'processing',
  });

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n────────── Processando aba: ${sheetName} ──────────`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rawData.length < 2) {
      console.log(`   ⚠️ Aba vazia ou sem dados, pulando...`);
      continue;
    }

    // Encontrar headers (procura nas primeiras 10 linhas)
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && Array.isArray(row)) {
        const found = row.some(cell => {
          const s = (cell || '').toString();
          return s.includes('Faturamento') || s.includes('Nota') || 
                 s.includes('Produto') || s.includes('Chave');
        });
        if (found) { headerRowIdx = i; break; }
      }
    }

    const headers = (rawData[headerRowIdx] || []).map(h => (h || '').toString().trim());
    const headerMapping = normalizeHeaders(headers);
    
    const mappedFields = Object.values(headerMapping);
    console.log(`   📋 ${headers.length} colunas, ${mappedFields.length} mapeadas`);
    
    // Verificar campos mínimos
    if (!mappedFields.includes('invoice_date')) {
      console.log(`   ⚠️ Sem coluna de data, pulando aba...`);
      continue;
    }

    // Parse rows
    const dbRows = [];
    let abaSkipped = 0;

    for (let i = headerRowIdx + 1; i < rawData.length; i++) {
      const rawRow = rawData[i];
      if (!rawRow || !Array.isArray(rawRow) || rawRow.length === 0) continue;

      // Mapear
      const mapped = {};
      headers.forEach((h, idx) => {
        const field = headerMapping[h];
        if (field && rawRow[idx] !== undefined) {
          mapped[field] = rawRow[idx];
        }
      });

      // Data obrigatória
      const invoiceDate = parseDate(mapped.invoice_date);
      if (!invoiceDate) { abaSkipped++; continue; }

      // Filtrar anos antigos
      const dateObj = new Date(invoiceDate + 'T00:00:00');
      if (dateObj.getFullYear() < 2020) { abaSkipped++; continue; }

      const ano = mapped.ano || dateObj.getFullYear();
      const mes = mapped.mes || dateObj.getMonth() + 1;
      const dia = mapped.dia || dateObj.getDate();

      // Construir chave única
      const invoiceNumber = safeStr(mapped.invoice_number)?.replace(/\.0$/, '');
      const uniqueNumber = safeStr(mapped.unique_number)?.replace(/\.0$/, '');
      const codProduto = safeStr(mapped.cod_produto)?.replace(/\.0$/, '');
      const codParceiro = safeStr(mapped.cod_parceiro)?.replace(/\.0$/, '');
      
      let chave = safeStr(mapped.chave);
      if (!chave && invoiceNumber) {
        // Gerar chave a partir de: nota + único + cod_produto
        chave = [invoiceNumber, uniqueNumber || '', codProduto || ''].join('|');
      }
      if (!chave) { abaSkipped++; continue; } // Sem chave = impossível dedup

      // Imposto pode vir em KR$ (multiplicado por 1000)
      let imposto = safeFloat(mapped.imposto);
      // Heurística: se imposto < 1 e net_value > 1000, provavelmente está em KR$
      const netVal = safeFloat(mapped.net_value);
      if (imposto > 0 && imposto < 10 && netVal > 1000) {
        imposto = imposto * 1000;
      }

      dbRows.push({
        chave,
        invoice_date: invoiceDate,
        ano: typeof ano === 'number' ? ano : parseInt(ano) || null,
        mes: typeof mes === 'number' ? mes : parseInt(mes) || null,
        dia: typeof dia === 'number' ? dia : parseInt(dia) || null,
        ano_mes: mapped.ano_mes || `${ano}_${String(mes).padStart(2, '0')}`,
        invoice_number: invoiceNumber || null,
        unique_number: uniqueNumber || null,
        cod_parceiro: codParceiro || null,
        cod_produto: codProduto || null,
        product: safeStr(mapped.product),
        tipo_produto: safeStr(mapped.tipo_produto),
        quantity: safeFloat(mapped.quantity) || null,
        net_value: netVal,
        vlr_unitario: safeFloat(mapped.vlr_unitario),
        imposto,
        custo_unitario: safeFloat(mapped.custo_unitario),
        custo_total: safeFloat(mapped.custo_total),
        discount: safeFloat(mapped.discount),
        receita_frete: safeFloat(mapped.receita_frete),
        custo_frete: safeFloat(mapped.custo_frete),
        vlr_frete: safeFloat(mapped.vlr_frete),
        vlr_substituicao: safeFloat(mapped.vlr_substituicao),
        cfop: safeStr(mapped.cfop),
        seller: safeStr(mapped.seller),
        empresa: safeStr(mapped.empresa),
        payment_type: safeStr(mapped.payment_type),
        upload_batch_id: batchId,
      });
    }

    totalSkipped += abaSkipped;
    console.log(`   ✅ ${dbRows.length} linhas válidas (${abaSkipped} ignoradas)`);

    if (dbRows.length === 0) continue;

    // Estatísticas antes de inserir
    let sumFat = 0;
    dbRows.forEach(r => sumFat += r.net_value);
    console.log(`   💰 Faturamento total da aba: R$ ${sumFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    // Inserção com upsert (ON CONFLICT chave DO UPDATE)
    console.log(`   🚀 Inserindo com upsert (batch de 500)...`);
    
    const batchSize = 500;
    let abaInserted = 0;
    let abaErrors = 0;

    for (let i = 0; i < dbRows.length; i += batchSize) {
      const batch = dbRows.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabase
        .from('sales_v2')
        .upsert(batch, { 
          onConflict: 'chave',
          ignoreDuplicates: false  // Atualiza se já existe
        });
      
      if (upsertError) {
        console.error(`   ❌ Erro no batch ${i}:`, upsertError.message);
        // Tentar inserção individual para encontrar a linha problema
        for (const row of batch) {
          const { error: singleError } = await supabase
            .from('sales_v2')
            .upsert(row, { onConflict: 'chave' });
          if (singleError) {
            abaErrors++;
            if (abaErrors <= 5) {
              console.error(`      Linha erro (NF ${row.invoice_number}, chave=${row.chave}):`, singleError.message);
            }
          } else {
            abaInserted++;
          }
        }
      } else {
        abaInserted += batch.length;
      }

      // Progress
      if (abaInserted % 5000 === 0 && abaInserted > 0) {
        const pct = ((abaInserted / dbRows.length) * 100).toFixed(1);
        console.log(`      ${abaInserted}/${dbRows.length} (${pct}%)`);
      }
    }

    totalProcessed += dbRows.length;
    totalInserted += abaInserted;
    totalErrors += abaErrors;
    console.log(`   ✅ Aba concluída: ${abaInserted} inseridos, ${abaErrors} erros`);
  }

  // Atualizar batch status
  await supabase.from('upload_batches').update({
    status: 'completed',
    records_processed: totalInserted,
  }).eq('id', batchId);

  // Verificar integridade referencial
  console.log('\n🔍 Verificando integridade referencial...');
  const { data: orphans } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT COUNT(*) as total 
      FROM sales_v2 s 
      WHERE s.cod_parceiro IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM base_atendimento b WHERE b.cod_parceiro = s.cod_parceiro
        )
    `
  });
  
  // Alternative check via direct query
  const { count: totalSales } = await supabase
    .from('sales_v2')
    .select('*', { count: 'exact', head: true });

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎉 IMPORTAÇÃO CONCLUÍDA!`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`   📊 Total processado: ${totalProcessed}`);
  console.log(`   ✅ Inseridos/atualizados: ${totalInserted}`);
  console.log(`   ⚠️ Ignorados (sem data/chave): ${totalSkipped}`);
  console.log(`   ❌ Erros: ${totalErrors}`);
  console.log(`   📦 Total em sales_v2: ${totalSales}`);
  console.log(`   📋 Batch ID: ${batchId}\n`);
}

importVendas().catch(err => {
  console.error('\n💥 Erro fatal:', err);
  process.exit(1);
});
