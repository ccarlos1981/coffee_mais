const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Carregar variáveis de ambiente (pode usar dotenv, ou ler diretamente)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ncncazbhpoxjlyvcbvqa.supabase.co';
// Usa service_role_key para ignorar RLS
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const filePath = '/Users/cristiano/Desktop/00.Realizado Jan 2025 a 18mai26.xlsx';

async function importData() {
  console.log('Iniciando importação de faturamento Sankhya...');
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: 'emit' // emit as events
  });

  let rowCount = 0;
  let batch = [];
  const BATCH_SIZE = 1000;
  let headers = [];

  for await (const worksheetReader of workbook) {
    if (worksheetReader.name !== 'BASE') {
       console.log(`Pulando aba: ${worksheetReader.name}`);
       continue;
    }
    console.log(`Processando aba: ${worksheetReader.name}...`);

    for await (const row of worksheetReader) {
      // Row is 1-indexed by ExcelJS
      const rowValues = row.values;
      if (rowCount === 0) {
        console.log('Pulando linha 0 (descrições)');
        rowCount++;
        continue;
      }
      if (rowCount === 1) {
        // Headers (ExcelJS usually has index 1 as first column)
        headers = rowValues;
        console.log('Headers encontrados:', headers);
        rowCount++;
        continue;
      }

      // Se a linha estiver vazia, ignorar
      if (!rowValues || rowValues.length === 0) continue;

      // Pegando os valores baseados nas colunas. Precisamos mapear os índices do header.
      // row.values retorna array onde o index 1 é a coluna A.
      
      const getVal = (headerName) => {
        const idx = headers.findIndex(h => h === headerName);
        return idx !== -1 ? rowValues[idx] : null;
      };

      // Formatar valores e tratar
      const dtNegValue = getVal('Dt. Neg');
      let dtFaturamento = null;
      if (dtNegValue) {
        if (dtNegValue instanceof Date) {
          dtFaturamento = dtNegValue.toISOString().split('T')[0];
        } else if (typeof dtNegValue === 'number') {
           // Excel date number
           const d = new Date((dtNegValue - 25569) * 86400 * 1000);
           dtFaturamento = d.toISOString().split('T')[0];
        } else {
           // try parsing string
           dtFaturamento = new Date(dtNegValue).toISOString().split('T')[0];
        }
      }
      
      const formatNumber = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
        return 0;
      };

      const record = {
        cod_cfop: getVal('Cód. CFOP') ? String(getVal('Cód. CFOP')) : null,
        cfop_desc: getVal('CFOP') ? String(getVal('CFOP')) : null,
        dt_faturamento: dtFaturamento,
        nro_unico: getVal('Nro. Único') ? String(getVal('Nro. Único')) : null,
        nro_nota: getVal('Nro. Nota') ? String(getVal('Nro. Nota')) : null,
        cod_parceiro: getVal('Cód. Parceiro') ? String(getVal('Cód. Parceiro')) : null,
        nome_parceiro: getVal('Parceiro') ? String(getVal('Parceiro')) : null,
        cod_produto: getVal('Cód. Produto') ? String(getVal('Cód. Produto')) : null,
        desc_produto: getVal('Produto') ? String(getVal('Produto')) : null,
        quantidade: formatNumber(getVal('Qtd.')),
        vlr_unitario: formatNumber(getVal('Vlr. Unitário')),
        vlr_desconto: formatNumber(getVal('Vlr. Desconto')),
        vlr_total_liq: formatNumber(getVal('Vlr. Total Líq.')),
        cod_top: getVal('Cód. TOP') ? String(getVal('Cód. TOP')) : null,
        desc_top: getVal('TOP') ? String(getVal('TOP')) : null,
        custo_icms: formatNumber(getVal('Custo s/ ICMS')),
        cod_vendedor: getVal('Cód. Vendedor') ? String(getVal('Cód. Vendedor')) : null,
        nome_vendedor: getVal('Vendedor') ? String(getVal('Vendedor')) : null,
        controle: getVal('Controle') ? String(getVal('Controle')) : null,
        custo_total: formatNumber(getVal('Custo Total')),
        cod_natureza: getVal('Cód. Natureza') ? String(getVal('Cód. Natureza')) : null,
        desc_natureza: getVal('Natureza') ? String(getVal('Natureza')) : null,
        status_nfe: getVal('Status NFe') ? String(getVal('Status NFe')) : null,
        vlr_frete: formatNumber(getVal('Vlr. Frete')),
        vlr_substituicao: formatNumber(getVal('Vlr. Substituição')),
        vlr_total_st: formatNumber(getVal('Vlr. Total ST')),
        cod_cr: getVal('Cód. CR') ? String(getVal('Cód. CR')) : null,
        centro_resultado: getVal('Centro de Resultado') ? String(getVal('Centro de Resultado')) : null
      };

      batch.push(record);
      rowCount++;

      if (batch.length >= BATCH_SIZE) {
        console.log(`Inserindo lote. Registros processados: ${rowCount}...`);
        const { error } = await supabase.from('cm_faturamento_sankhya').insert(batch);
        if (error) {
           console.error('Erro ao inserir lote:', error);
        }
        batch = [];
      }
    }
    
    // Inserir os últimos remanescentes da aba BASE
    if (batch.length > 0) {
      console.log(`Inserindo último lote. Registros totais: ${rowCount}...`);
      const { error } = await supabase.from('cm_faturamento_sankhya').insert(batch);
      if (error) {
         console.error('Erro ao inserir último lote:', error);
      }
    }
  }

  console.log(`Importação concluída! Total de linhas processadas: ${rowCount - 1}`);
}

importData().catch(console.error);
