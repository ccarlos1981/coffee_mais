/**
 * DRE Gerencial — Serviço de Importação de Planilha
 * 
 * Fluxo: Upload → Parse → Normalização → Match → Staging → Validação → UPSERT
 */

import * as XLSX from 'xlsx';
import { createAdminClient } from '@/lib/supabase/admin';
import { type ImportPreview, type ImportPreviewRow, UF_PREFIXES } from './types';

const SCALE_FACTOR = 1000;

// ─── Normalização de nomes de redes ───

/** Remove acentos para comparação normalizada */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeRedeName(name: string): string {
  let normalized = name.trim().toUpperCase();
  
  // Remover prefixo UF (ex: "SP ZAFFARI" → "ZAFFARI")
  for (const uf of UF_PREFIXES) {
    if (normalized.startsWith(uf + ' ')) {
      normalized = normalized.substring(uf.length + 1).trim();
      break;
    }
  }
  
  return normalized;
}

/** Normalização profunda para matching (sem acentos, sem chars especiais) */
function deepNormalize(name: string): string {
  return removeAccents(name.trim().toUpperCase()).replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeCompetencia(comp: string): string {
  // '2026_07' → '2026-07', '2026-07' → '2026-07'
  return comp.replace('_', '-');
}

// ─── Parse da Planilha ───

interface ParsedRow {
  rede: string;
  redeUf: string;         // Coluna Rede_UF da planilha (ex: "SP ZAFFARI")
  responsavel: string;
  competencia: string;
  icmsPct: number;
  cpvCusto: number;       // R$ mil
  investimento: number;   // R$ mil (= Abatimento)
  valorContrato: number;  // R$ mil
  fatBrutoInfo: number;   // Informativo, R$ mil
}

interface RedeAlias {
  rede_planilha: string;
  rede_sistema: string;
  rede_uf_match: string | null;
}

function parseSpreadsheet(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  
  // Buscar guia "Análise"
  const wsName = wb.SheetNames.find(n => n.includes('Análise') || n.includes('Analise'));
  if (!wsName) throw new Error('Guia "Análise" não encontrada na planilha');
  
  const ws = wb.Sheets[wsName];
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  
  if (rawData.length < 2) throw new Error('Planilha vazia ou sem dados');
  
  // Mapear colunas por nome do cabeçalho
  const headers = rawData[0] as string[];
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => { if (h) colMap[String(h).trim()] = i; });
  
  // Validar colunas obrigatórias
  const requiredCols = ['Rede', 'Competência', 'ICMS', 'CPV Custo', 'Investimento', 'Valor Contrato'];
  const missing = requiredCols.filter(c => colMap[c] === undefined);
  if (missing.length > 0) {
    throw new Error(`Colunas obrigatórias não encontradas: ${missing.join(', ')}`);
  }
  
  const rows: ParsedRow[] = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as (string | number)[];
    const rede = String(row[colMap['Rede']] || '').trim();
    const comp = String(row[colMap['Competência']] || '').trim();
    
    if (!rede || !comp) continue;
    
    rows.push({
      rede,
      redeUf: String(row[colMap['Rede_UF']] || '').trim().toUpperCase(),
      responsavel: String(row[colMap['Responsável']] || '').trim(),
      competencia: normalizeCompetencia(comp),
      icmsPct: Number(row[colMap['ICMS']] || 0),
      cpvCusto: Number(row[colMap['CPV Custo']] || 0),
      investimento: Number(row[colMap['Investimento']] || 0),
      valorContrato: Number(row[colMap['Valor Contrato']] || 0),
      fatBrutoInfo: Number(row[colMap['Faturamento Bruto']] || 0),
    });
  }
  
  return rows;
}

// ─── Match de Redes ───

async function getSystemRedes(competencia: string): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  
  // Buscar redes com vendas na competência (max ~300 redes por mês = safe)
  const { data: salesData } = await supabase
    .from('mv_vendas_mensal')
    .select('rede')
    .eq('mes', competencia);
  
  // Buscar TODAS as redes históricas distintas (paginado para evitar limite de 1000)
  const allRedesSet = new Set<string>();
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: page } = await supabase
      .from('mv_vendas_mensal')
      .select('rede')
      .range(offset, offset + pageSize - 1)
      .order('rede');
    
    if (!page || page.length === 0) break;
    
    for (const row of page) {
      const rede = String(row.rede || '').trim();
      if (rede) allRedesSet.add(rede);
    }
    
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  
  const map = new Map<string, string>(); // deep-normalizado → original
  
  // Priorizar redes da competência atual
  for (const row of salesData || []) {
    const rede = String(row.rede || '').trim();
    if (rede) {
      map.set(deepNormalize(rede), rede);
    }
  }
  
  // Adicionar redes históricas (sem sobrescrever)
  for (const rede of allRedesSet) {
    const key = deepNormalize(rede);
    if (!map.has(key)) map.set(key, rede);
  }
  
  return map;
}

function matchRede(redePlanilha: string, systemRedes: Map<string, string>): string | null {
  const normalized = normalizeRedeName(redePlanilha);
  const deepNorm = deepNormalize(normalized);
  
  // 1. Match exato (deep normalized — sem acentos)
  const exact = systemRedes.get(deepNorm);
  if (exact) return exact;
  
  // 2. Match parcial — só quando um contém o outro E tamanhos são próximos
  //    Evita "ZAFFARI" matchando "ZAFFARI CESTO" (que é uma rede diferente)
  let bestMatch: string | null = null;
  let bestScore = 0;
  
  for (const [sysDeep, sysOriginal] of systemRedes) {
    if (sysDeep.length < 4 || deepNorm.length < 4) continue;
    
    if (deepNorm.includes(sysDeep) || sysDeep.includes(deepNorm)) {
      // Score = quão próximos os tamanhos são (1.0 = exato)
      const score = Math.min(deepNorm.length, sysDeep.length) / Math.max(deepNorm.length, sysDeep.length);
      // Exigir pelo menos 70% de semelhança de tamanho
      if (score > 0.7 && score > bestScore) {
        bestScore = score;
        bestMatch = sysOriginal;
      }
    }
  }
  
  return bestMatch;
}

// ─── Resolve gerente do sistema ───

async function resolveGerenteSistema(redes: string[], competencia: string): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const map = new Map<string, string>();
  
  // mv_vendas_mensal.manager (fonte primária)
  const { data: salesData } = await supabase
    .from('mv_vendas_mensal')
    .select('rede, manager')
    .eq('mes', competencia)
    .in('rede', redes);
  
  const needsFallback: string[] = [];
  for (const row of salesData || []) {
    const rede = String(row.rede || '').trim();
    const mgr = String(row.manager || '').trim();
    if (!rede) continue;
    if (mgr && mgr !== 'SEM RESPONSÁVEL') {
      map.set(rede, mgr);
    } else {
      needsFallback.push(rede);
    }
  }
  
  // Fallback: cm_clientes.responsavel
  if (needsFallback.length > 0) {
    const { data: clientData } = await supabase
      .from('cm_clientes')
      .select('matriz, responsavel')
      .in('matriz', needsFallback)
      .not('responsavel', 'is', null)
      .neq('responsavel', '');
    
    for (const row of clientData || []) {
      const rede = String(row.matriz || '').trim();
      const mgr = String(row.responsavel || '').trim();
      if (rede && mgr && !map.has(rede)) {
        map.set(rede, mgr);
      }
    }
  }
  
  return map;
}

// ─── API: Upload e Preview ───

export async function processUpload(
  file: ArrayBuffer,
  filename: string,
  competenciaFiltro: string,
  userId?: string,
): Promise<ImportPreview> {
  const supabase = createAdminClient();
  
  // 1. Parse
  const allRows = parseSpreadsheet(file);
  
  // 2. Filtrar pela competência
  const rows = allRows.filter(r => r.competencia === competenciaFiltro);
  if (rows.length === 0) {
    throw new Error(`Nenhuma linha encontrada para a competência ${competenciaFiltro}`);
  }
  
  // 3. Carregar aliases ativos
  const { data: aliasData } = await supabase
    .from('cm_dre_rede_aliases')
    .select('rede_planilha, rede_sistema, rede_uf_match')
    .eq('ativo', true);
  
  const aliases = (aliasData || []) as RedeAlias[];
  // Map: rede_uf_match → rede_sistema (ex: "SP ZAFFARI" → "ZAFFARI")
  const ufAliasMap = new Map<string, string>();
  // Set: redes da planilha que possuem aliases com rede_uf_match
  const aliasedRedes = new Set<string>();
  
  for (const alias of aliases) {
    if (alias.rede_uf_match) {
      ufAliasMap.set(alias.rede_uf_match.toUpperCase(), alias.rede_sistema);
      aliasedRedes.add(alias.rede_planilha.toUpperCase());
    }
  }
  
  // 4. Agregar por rede — COM tratamento de aliases
  // Linhas cujo Rede_UF bate com um alias NÃO são agregadas; geram registro individual
  const aggregated = new Map<string, {
    redePlanilha: string;
    responsavel: string;
    icmsWeightedSum: number;
    fatSum: number;
    cpvCusto: number;
    investimento: number;
    valorContrato: number;
    fatBrutoInfo: number;
    aliasTarget?: string; // Se definido, rede_sistema do alias
  }>();
  
  for (const row of rows) {
    const normalized = normalizeRedeName(row.rede);
    
    // Verificar se esta linha tem alias via Rede_UF
    const aliasTarget = ufAliasMap.get(row.redeUf);
    
    if (aliasTarget) {
      // Alias determinístico — criar registro individual (chave = rede_sistema)
      const key = `__ALIAS__${aliasTarget}`;
      const existing = aggregated.get(key);
      if (existing) {
        // Mesma sub-rede em múltiplas linhas (raro, mas seguro)
        existing.cpvCusto += row.cpvCusto;
        existing.investimento += row.investimento;
        existing.valorContrato += row.valorContrato;
        existing.fatBrutoInfo += row.fatBrutoInfo;
        existing.icmsWeightedSum += row.icmsPct * row.fatBrutoInfo;
        existing.fatSum += row.fatBrutoInfo;
      } else {
        aggregated.set(key, {
          redePlanilha: row.rede,
          responsavel: row.responsavel,
          icmsWeightedSum: row.icmsPct * row.fatBrutoInfo,
          fatSum: row.fatBrutoInfo,
          cpvCusto: row.cpvCusto,
          investimento: row.investimento,
          valorContrato: row.valorContrato,
          fatBrutoInfo: row.fatBrutoInfo,
          aliasTarget,
        });
      }
    } else if (aliasedRedes.has(normalized)) {
      // Rede tem aliases mas esta linha NÃO bate com nenhum rede_uf_match
      // Situação inesperada — agregar normalmente pelo nome normalizado
      const key = normalized;
      const existing = aggregated.get(key);
      if (existing) {
        existing.cpvCusto += row.cpvCusto;
        existing.investimento += row.investimento;
        existing.valorContrato += row.valorContrato;
        existing.fatBrutoInfo += row.fatBrutoInfo;
        existing.icmsWeightedSum += row.icmsPct * row.fatBrutoInfo;
        existing.fatSum += row.fatBrutoInfo;
      } else {
        aggregated.set(key, {
          redePlanilha: row.rede,
          responsavel: row.responsavel,
          icmsWeightedSum: row.icmsPct * row.fatBrutoInfo,
          fatSum: row.fatBrutoInfo,
          cpvCusto: row.cpvCusto,
          investimento: row.investimento,
          valorContrato: row.valorContrato,
          fatBrutoInfo: row.fatBrutoInfo,
        });
      }
    } else {
      // Sem alias — agregar normalmente
      const key = normalized;
      const existing = aggregated.get(key);
      if (existing) {
        existing.cpvCusto += row.cpvCusto;
        existing.investimento += row.investimento;
        existing.valorContrato += row.valorContrato;
        existing.fatBrutoInfo += row.fatBrutoInfo;
        existing.icmsWeightedSum += row.icmsPct * row.fatBrutoInfo;
        existing.fatSum += row.fatBrutoInfo;
      } else {
        aggregated.set(key, {
          redePlanilha: row.rede,
          responsavel: row.responsavel,
          icmsWeightedSum: row.icmsPct * row.fatBrutoInfo,
          fatSum: row.fatBrutoInfo,
          cpvCusto: row.cpvCusto,
          investimento: row.investimento,
          valorContrato: row.valorContrato,
          fatBrutoInfo: row.fatBrutoInfo,
        });
      }
    }
  }
  
  // 5. Match com redes do sistema
  const systemRedes = await getSystemRedes(competenciaFiltro);
  
  // 5. Criar batch
  const [anoComp, mesComp] = competenciaFiltro.split('-').map(Number);
  const { data: batch, error: batchErr } = await supabase
    .from('cm_dre_gerencial_batches')
    .insert({
      filename,
      competencia: competenciaFiltro,
      ano: anoComp,
      mes: mesComp,
      imported_by: userId || null,
      total_rows: rows.length,
      total_redes: aggregated.size,
      status: 'pending',
    })
    .select('id')
    .single();
  
  if (batchErr) throw new Error(`Erro ao criar batch: ${batchErr.message}`);
  
  // 6. Resolver gerentes do sistema — incluir alias targets
  const matchedRedes: string[] = [];
  for (const [, data] of aggregated) {
    if (data.aliasTarget) {
      matchedRedes.push(data.aliasTarget);
    } else {
      const sys = matchRede(data.redePlanilha, systemRedes);
      if (sys) matchedRedes.push(sys);
    }
  }
  const gerenteMap = await resolveGerenteSistema(matchedRedes, competenciaFiltro);
  
  // 7. Inserir staging + build preview
  const previewRows: ImportPreviewRow[] = [];
  const stagingRows: Record<string, unknown>[] = [];
  let matched = 0, autoNamed = 0;
  
  // Detectar splits sem critério determinístico (ex: SUPERNOSSO)
  const splitWarnings: string[] = [];
  
  for (const [normalized, data] of aggregated) {
    let redeCanonica: string;
    let status: 'matched' | 'auto_named' | 'alias';
    
    if (data.aliasTarget) {
      // Alias determinístico — rede já definida pelo alias
      redeCanonica = data.aliasTarget;
      status = 'alias';
      matched++;
    } else {
      const redeSistema = matchRede(data.redePlanilha, systemRedes);
      redeCanonica = redeSistema || normalized;
      status = redeSistema ? 'matched' : 'auto_named';
      if (redeSistema) matched++;
      else autoNamed++;
    }
    
    const icmsPct = data.fatSum > 0 ? data.icmsWeightedSum / data.fatSum : data.icmsWeightedSum;
    const gerenteSistema = (status === 'matched' || status === 'alias')
      ? (gerenteMap.get(redeCanonica) || data.responsavel || null)
      : (data.responsavel || null); // fallback: responsável da planilha
    
    stagingRows.push({
      batch_id: batch.id,
      rede_planilha: data.redePlanilha,
      rede_normalizada: normalized,
      responsavel_planilha: data.responsavel,
      gerente_sistema: gerenteSistema,
      competencia: competenciaFiltro,
      icms_pct: icmsPct,
      cpv_valor: data.cpvCusto * SCALE_FACTOR,
      investimento_valor: data.investimento * SCALE_FACTOR,
      contrato_valor: data.valorContrato * SCALE_FACTOR,
      fat_bruto_informativo: data.fatBrutoInfo * SCALE_FACTOR,
      match_status: status,
      match_rede_sistema: redeCanonica,
    });
    
    previewRows.push({
      redePlanilha: data.redePlanilha,
      redeNormalizada: normalized,
      redeSistema: redeCanonica,
      matchStatus: status,
      responsavelPlanilha: data.responsavel,
      gerenteSistema,
      icmsPct,
      cpvValor: data.cpvCusto * SCALE_FACTOR,
      investimentoValor: data.investimento * SCALE_FACTOR,
      contratoValor: data.valorContrato * SCALE_FACTOR,
    });
  }
  
  // Inserir staging em batch
  if (stagingRows.length > 0) {
    await supabase.from('cm_dre_gerencial_staging').insert(stagingRows);
  }
  
  // Verificar se é reimportação
  const { data: existing } = await supabase
    .from('cm_dre_gerencial_rede')
    .select('id')
    .eq('competencia', competenciaFiltro)
    .limit(1);
  
  // Atualizar batch
  await supabase.from('cm_dre_gerencial_batches').update({
    redes_matched: matched,
    redes_unmatched: autoNamed,
    status: 'validated',
    validation_result: { matched, autoNamed, total: aggregated.size },
  }).eq('id', batch.id);
  
  return {
    batchId: batch.id,
    competencia: competenciaFiltro,
    filename,
    totalRows: rows.length,
    totalRedes: aggregated.size,
    redesMatched: matched,
    redesUnmatched: autoNamed,
    rows: previewRows.sort((a, b) => (a.matchStatus === 'auto_named' ? -1 : 1)),
    canImport: true, // Sempre permite — auto_named usa nome da planilha
    isReimport: (existing?.length || 0) > 0,
  };
}

// ─── API: Confirmar Importação ───

export async function confirmImport(batchId: string): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();
  
  // 1. Buscar staging (matched + auto_named)
  const { data: stagingData, error: stagingErr } = await supabase
    .from('cm_dre_gerencial_staging')
    .select('*')
    .eq('batch_id', batchId)
    .in('match_status', ['matched', 'auto_named']);
  
  if (stagingErr) throw new Error(`Erro ao buscar staging: ${stagingErr.message}`);
  if (!stagingData || stagingData.length === 0) {
    throw new Error('Nenhuma rede matched no staging');
  }
  
  // 2. Todas as redes são importáveis (matched ou auto_named)
  
  // 3. UPSERT em cm_dre_gerencial_rede
  const competencia = stagingData[0].competencia;
  const [ano, mes] = competencia.split('-').map(Number);
  
  for (const row of stagingData) {
    const redeSistema = row.match_rede_sistema;
    if (!redeSistema) continue;
    
    const { error: upsertErr } = await supabase
      .from('cm_dre_gerencial_rede')
      .upsert({
        competencia,
        ano,
        mes,
        rede: redeSistema,
        rede_planilha: row.rede_planilha,
        gerente_atual: row.gerente_sistema,
        canal: 'KA',
        icms_pct: row.icms_pct,
        cpv_valor: row.cpv_valor,
        investimento_valor: row.investimento_valor,
        contrato_valor: row.contrato_valor,
        bonificacao_valor: 0,
        batch_id: batchId,
      }, { onConflict: 'competencia,rede' });
    
    if (upsertErr) throw new Error(`Erro ao gravar rede ${redeSistema}: ${upsertErr.message}`);
  }
  
  // 4. Atualizar batch status
  await supabase.from('cm_dre_gerencial_batches').update({
    status: 'imported',
  }).eq('id', batchId);
  
  return { success: true, message: `${stagingData.length} redes importadas para ${competencia}` };
}
