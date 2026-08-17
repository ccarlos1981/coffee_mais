/**
 * DRE Gerencial Engine — Camada Central de Cálculo
 * 
 * Single Source of Truth para todos os KPIs do DRE e RDM.
 * Consome exclusivamente fontes oficiais auditadas:
 * - Volume/Faturamento: mv_vendas_mensal
 * - ICMS/CPV/Invest/Contrato: cm_dre_gerencial_rede (planilha)
 * - Metas: targets
 * - Gerente: mv_vendas_mensal.manager (fallback: cm_clientes.responsavel)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveCanonicalManager } from '@/lib/domain/canonical';
import {
  type DreKpis,
  type DreRedeRow,
  type RdmSlide1Linha,
  type RdmSlide1Data,
  type RdmSlide2Data,
  type RdmSlide2Grupo,
  type DreMensalColuna,
  type DreGerencialFilters,
  type RdmAcumuladoColuna,
  type RdmAcumuladoValor,
  type RdmAcumuladoLinha,
  type RdmTrimestreData,
  type RdmSlideAcumuladoData,
  GERENTES_KA,
  GERENTE_DISPLAY_MAP,
  GERENTE_TARGET_MAP,
  MESES_LABEL,
} from './types';

// ─── Helper de Comparação Canônica de Gerentes ───
function isSameManagerCanonical(m1?: string, m2?: string): boolean {
  if (!m1 || !m2) return false;
  const c1 = resolveCanonicalManager(m1).managerId;
  const c2 = resolveCanonicalManager(m2).managerId;
  return c1 === c2 && c1 !== '9999';
}

// ─── Internal Types ───

interface SalesRow {
  mes: string;
  rede: string;
  manager: string;
  fat: number;
  qty: number;
}

interface DreRedeDbRow {
  rede: string;
  competencia: string;
  icms_pct: number;
  cpv_valor: number;
  investimento_valor: number;
  contrato_valor: number;
  bonificacao_valor: number;
  gerente_atual: string;
}

interface TargetRow {
  manager: string;
  target_revenue: number;
  target_tons: number;
}

// ─── Fetch de Dados ───

async function fetchSales(competencias: string[]): Promise<SalesRow[]> {
  const supabase = createAdminClient();
  const allRows: SalesRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('mv_vendas_mensal')
      .select('mes, rede, manager, fat, qty')
      .in('mes', competencias)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Erro ao buscar vendas: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const r of data) {
      allRows.push({
        mes: String(r.mes || ''),
        rede: String(r.rede || '').trim(),
        manager: String(r.manager || '').trim(),
        fat: Number(r.fat || 0),
        qty: Number(r.qty || 0),
      });
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

async function fetchDreRede(competencias: string[]): Promise<DreRedeDbRow[]> {
  const supabase = createAdminClient();
  const allRows: DreRedeDbRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('cm_dre_gerencial_rede')
      .select('rede, competencia, icms_pct, cpv_valor, investimento_valor, contrato_valor, bonificacao_valor, gerente_atual')
      .in('competencia', competencias)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Erro ao buscar DRE rede: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const r of data) {
      allRows.push({
        rede: r.rede,
        competencia: r.competencia,
        icms_pct: Number(r.icms_pct || 0),
        cpv_valor: Number(r.cpv_valor || 0),
        investimento_valor: Number(r.investimento_valor || 0),
        contrato_valor: Number(r.contrato_valor || 0),
        bonificacao_valor: Number(r.bonificacao_valor || 0),
        gerente_atual: r.gerente_atual || '',
      });
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

async function fetchTargets(ano: number, mes: number): Promise<TargetRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('targets')
    .select('manager, target_revenue, target_tons')
    .eq('year', ano)
    .eq('month', mes);

  if (error) throw new Error(`Erro ao buscar targets: ${error.message}`);
  return (data || []).map(t => ({
    manager: t.manager,
    target_revenue: Number(t.target_revenue || 0),
    target_tons: Number(t.target_tons || 0),
  }));
}

/** Resolve gerente atual: mv_vendas_mensal.manager → fallback cm_clientes.responsavel */
async function fetchGerenteMap(competencia: string): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const map = new Map<string, string>();
  let offset = 0;
  const pageSize = 1000;
  const needsFallback: string[] = [];

  while (true) {
    const { data: salesData, error } = await supabase
      .from('mv_vendas_mensal')
      .select('rede, manager')
      .eq('mes', competencia)
      .range(offset, offset + pageSize - 1);

    if (error) break;
    if (!salesData || salesData.length === 0) break;

    for (const row of salesData) {
      const rede = String(row.rede || '').trim();
      const mgr = String(row.manager || '').trim();
      if (!rede) continue;
      if (mgr && mgr !== 'SEM RESPONSÁVEL') {
        map.set(rede, mgr);
      } else {
        needsFallback.push(rede);
      }
    }

    if (salesData.length < pageSize) break;
    offset += pageSize;
  }

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

// ─── Helpers ───

function resolveGerenteSistema(gerente?: string): string | undefined {
  if (!gerente || gerente === 'KA' || gerente === 'CRISTIANO' || gerente === 'CRISTIANO (Total)' || gerente === 'Total') return undefined;

  const mapById: Record<string, string> = {
    '1001': 'Leandro Saffi',
    '1002': 'Luiz',
    '1000': 'Julliano',
    '1003': 'John Guedes',
  };
  if (mapById[gerente]) return mapById[gerente];

  const canonical = resolveCanonicalManager(gerente);
  if (canonical.managerId === '9999' || canonical.managerId === 'CRISTIANO') return undefined;
  if (mapById[canonical.managerId]) return mapById[canonical.managerId];

  const mapText: Record<string, string> = {
    'Leandro': 'Leandro Saffi',
    'John': 'John Guedes',
    'Luiz': 'Luiz',
    'Julliano': 'Julliano',
  };
  return mapText[gerente] || gerente;
}

function filterByGerente(sales: SalesRow[], gerenteSistema?: string): SalesRow[] {
  if (!gerenteSistema) {
    return sales.filter(s => GERENTES_KA.some(g => isSameManagerCanonical(s.manager, g)));
  }
  return sales.filter(s => s.manager === gerenteSistema || isSameManagerCanonical(s.manager, gerenteSistema));
}

// ─── Cálculo de KPIs para um período ───

function buildKpisForComp(
  sales: SalesRow[],
  dreRede: DreRedeDbRow[],
  comp: string,
  gerenteSistema: string | undefined,
  redeFiltro?: string,
): DreKpis {
  // Filtrar vendas da competência e gerente
  let salesComp = sales.filter(s => s.mes === comp);
  salesComp = filterByGerente(salesComp, gerenteSistema);

  // Agregar vendas por rede
  const salesByRede = new Map<string, { fat: number; qty: number }>();
  for (const s of salesComp) {
    if (!s.rede) continue;
    const ex = salesByRede.get(s.rede);
    if (ex) { ex.fat += s.fat; ex.qty += s.qty; }
    else salesByRede.set(s.rede, { fat: s.fat, qty: s.qty });
  }

  // DRE data da competência (filtrado por gerente canônico)
  let dreComp = dreRede.filter(d => d.competencia === comp);
  if (gerenteSistema) {
    dreComp = dreComp.filter(d =>
      salesByRede.has(d.rede) || isSameManagerCanonical(d.gerente_atual, gerenteSistema)
    );
  } else {
    dreComp = dreComp.filter(d =>
      salesByRede.has(d.rede) || GERENTES_KA.some(g => isSameManagerCanonical(d.gerente_atual, g))
    );
  }

  // DRE por rede
  const dreMap = new Map<string, DreRedeDbRow>();
  for (const d of dreComp) dreMap.set(d.rede, d);

  // Union de redes
  const allRedes = new Set([...salesByRede.keys(), ...dreComp.map(d => d.rede)]);

  let totalFat = 0, totalQty = 0, totalImpostos = 0;
  let totalCpv = 0, totalInvest = 0, totalContrato = 0, totalBonif = 0;

  for (const rede of allRedes) {
    if (redeFiltro && rede !== redeFiltro) continue;

    const sale = salesByRede.get(rede);
    const dre = dreMap.get(rede);

    const fat = sale?.fat || 0;
    const qty = sale?.qty || 0;
    const icmsPct = dre?.icms_pct || 0;
    const cpv = dre?.cpv_valor || 0;
    const invest = dre?.investimento_valor || 0;
    const contrato = dre?.contrato_valor || 0;
    const bonif = dre?.bonificacao_valor || 0;

    totalFat += fat;
    totalQty += qty;
    totalImpostos += fat * icmsPct;
    totalCpv += cpv;
    totalInvest += invest;
    totalContrato += contrato;
    totalBonif += bonif;
  }

  // Se não houver dados de DRE cadastrados para a competência (como no Mês Anterior / Ano Anterior),
  // aplica as regras oficiais padronizadas sobre o Faturamento:
  // Impostos: 3,5% | CPV: 46% | Investimento Comercial: 10%
  const impostosFinal = (totalImpostos === 0 && totalFat > 0) ? totalFat * 0.035 : totalImpostos;
  const cpvFinal = (totalCpv === 0 && totalFat > 0) ? totalFat * 0.46 : totalCpv;
  const investComercial = (totalInvest + totalContrato + totalBonif === 0 && totalFat > 0)
    ? totalFat * 0.10
    : totalInvest + totalContrato + totalBonif;

  const receitaLiquida = totalFat - impostosFinal - investComercial;
  const frete = totalFat * 0.03;
  const mc = receitaLiquida - cpvFinal - frete;

  return {
    volume: totalQty,
    faturamento: totalFat,
    impostos: impostosFinal,
    investComercial,
    abatimento: totalInvest,
    contrato: totalContrato,
    bonificacao: totalBonif,
    receitaLiquida,
    cpv: cpvFinal,
    frete,
    margemContribuicao: mc,
  };
}

// ─── Desafio ───

function getDesafio(targets: TargetRow[], gerente?: string, redeFiltro?: string): { revenue: number | null; volume: number | null } {
  if (redeFiltro) return { revenue: null, volume: null };

  const isConsolidado = !gerente || gerente === 'KA' || gerente === 'CRISTIANO' || gerente === 'CRISTIANO (Total)';
  if (isConsolidado) {
    let rev = 0, vol = 0;
    for (const g of GERENTES_KA) {
      const targetName = GERENTE_TARGET_MAP[g];
      const t = targets.find(t => t.manager === targetName);
      rev += t?.target_revenue || 0;
      vol += t?.target_tons || 0;
    }
    return { revenue: rev || null, volume: vol || null };
  }

  const gerenteSistema = resolveGerenteSistema(gerente);
  if (!gerenteSistema) return { revenue: null, volume: null };
  const targetName = GERENTE_TARGET_MAP[gerenteSistema];
  const t = targets.find(t => t.manager === targetName);
  return {
    revenue: t?.target_revenue || null,
    volume: t?.target_tons || null,
  };
}

async function fetchDesafioConfig(gerente?: string): Promise<{ impostos_pct: number; investimento_pct: number; cpv_pct: number; frete_pct: number }> {
  const defaults = { impostos_pct: 0.035, investimento_pct: 0.100, cpv_pct: 0.460, frete_pct: 0.030 };
  try {
    let canonicalId = 'CRISTIANO';
    if (gerente && gerente !== 'CRISTIANO' && gerente !== 'CRISTIANO (Total)' && gerente !== 'KA') {
      canonicalId = resolveCanonicalManager(gerente).managerId;
      if (canonicalId === '9999') canonicalId = 'CRISTIANO';
    }
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('cm_rdm_desafio_config')
      .select('impostos_pct, investimento_pct, cpv_pct, frete_pct')
      .eq('manager_id', canonicalId)
      .maybeSingle();

    if (data) {
      return {
        impostos_pct: Number(data.impostos_pct ?? defaults.impostos_pct),
        investimento_pct: Number(data.investimento_pct ?? defaults.investimento_pct),
        cpv_pct: Number(data.cpv_pct ?? defaults.cpv_pct),
        frete_pct: Number(data.frete_pct ?? defaults.frete_pct),
      };
    }
  } catch (err) {
    console.error('[Engine] Erro ao carregar cm_rdm_desafio_config:', err);
  }
  return defaults;
}

// ─── Slide 1 Builder ───

function buildSlide1(
  actual: DreKpis,
  desafio: { revenue: number | null; volume: number | null },
  mesAnterior: DreKpis,
  anoAnterior: DreKpis,
  competencia: string,
  customPcts?: { impostos_pct: number; investimento_pct: number; cpv_pct: number; frete_pct: number },
): RdmSlide1Data {
  const [ano, mes] = competencia.split('-').map(Number);
  const mesLabel = MESES_LABEL[mes] || '';

  function linha(kpi: string, actualVal: number, desafioVal: number | null, mesAntVal: number, anoAntVal: number, highlighted: boolean, indent = false): RdmSlide1Linha {
    const deltaDesafio = desafioVal !== null ? actualVal - desafioVal : null;
    const pctDeltaDesafio = desafioVal !== null && desafioVal !== 0 ? ((actualVal / desafioVal) - 1) * 100 : null;
    const deltaMesAnterior = actualVal - mesAntVal;
    const pctDeltaMesAnterior = mesAntVal !== 0 ? ((actualVal / mesAntVal) - 1) * 100 : null;

    return {
      kpi, actual: actualVal, desafio: desafioVal,
      deltaDesafio, pctDeltaDesafio,
      mesAnterior: mesAntVal, deltaMesAnterior, pctDeltaMesAnterior,
      anoAnterior: anoAntVal, isHighlighted: highlighted, indent,
    };
  }

  const pcts = customPcts || { impostos_pct: 0.035, investimento_pct: 0.100, cpv_pct: 0.460, frete_pct: 0.030 };

  const desafioFat = desafio.revenue;
  const desafioImpostos = desafioFat !== null ? desafioFat * pcts.impostos_pct : null;
  const desafioFrete = desafioFat !== null ? desafioFat * pcts.frete_pct : null;
  const desafioInvest = desafioFat !== null ? desafioFat * pcts.investimento_pct : null;
  const desafioCPV = desafioFat !== null ? desafioFat * pcts.cpv_pct : null;
  const desafioRecLiq = (desafioFat !== null && desafioImpostos !== null && desafioInvest !== null)
    ? desafioFat - desafioImpostos - desafioInvest
    : null;
  const desafioMargem = (desafioRecLiq !== null && desafioCPV !== null && desafioFrete !== null)
    ? desafioRecLiq - desafioCPV - desafioFrete
    : null;

  const linhas: RdmSlide1Linha[] = [
    linha('Volume', actual.volume, desafio.volume, mesAnterior.volume, anoAnterior.volume, false),
    linha('Faturamento', actual.faturamento, desafioFat, mesAnterior.faturamento, anoAnterior.faturamento, true),
    linha('Impostos', actual.impostos, desafioImpostos, mesAnterior.impostos, anoAnterior.impostos, false),
    linha('Invest. Comercial', actual.investComercial, desafioInvest, mesAnterior.investComercial, anoAnterior.investComercial, false),
    linha('  Abatimento', actual.abatimento, null, mesAnterior.abatimento, anoAnterior.abatimento, false, true),
    linha('  Contrato', actual.contrato, null, mesAnterior.contrato, anoAnterior.contrato, false, true),
    linha('  Bonificação', actual.bonificacao, null, mesAnterior.bonificacao, anoAnterior.bonificacao, false, true),
    linha('Receita Líquida', actual.receitaLiquida, desafioRecLiq, mesAnterior.receitaLiquida, anoAnterior.receitaLiquida, true),
    linha('CPV', actual.cpv, desafioCPV, mesAnterior.cpv, anoAnterior.cpv, false),
    linha('Frete', actual.frete, desafioFrete, mesAnterior.frete, anoAnterior.frete, false),
    linha('Margem de Contribuição', actual.margemContribuicao, desafioMargem, mesAnterior.margemContribuicao, anoAnterior.margemContribuicao, true),
  ];

  return { titulo: `RDM — ${mesLabel}/${ano}`, competenciaLabel: `${mesLabel}/${ano}`, linhas };
}

// ─── API: RDM ───

export async function getRdmData(filters: DreGerencialFilters): Promise<{ slide1: RdmSlide1Data; slide2: RdmSlide2Data }> {
  const { competencia } = filters;
  if (!competencia) throw new Error('Competência obrigatória para RDM');

  const [anoComp, mesComp] = competencia.split('-').map(Number);
  const compActual = competencia;
  const prevMonth = mesComp === 1 ? 12 : mesComp - 1;
  const prevYear = mesComp === 1 ? anoComp - 1 : anoComp;
  const compPrev = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const compAnoAnt = `${anoComp - 1}-${String(mesComp).padStart(2, '0')}`;
  const competencias = [compActual, compPrev, compAnoAnt];

  const gerenteSistema = resolveGerenteSistema(filters.gerente);

  const [sales, dreRede, targets, customPcts] = await Promise.all([
    fetchSales(competencias),
    fetchDreRede(competencias),
    fetchTargets(anoComp, mesComp),
    fetchDesafioConfig(filters.gerente),
  ]);

  const kpisActual = buildKpisForComp(sales, dreRede, compActual, gerenteSistema, filters.rede);
  const kpisPrev = buildKpisForComp(sales, dreRede, compPrev, gerenteSistema, filters.rede);
  const kpisAnoAnt = buildKpisForComp(sales, dreRede, compAnoAnt, gerenteSistema, filters.rede);

  const desafio = getDesafio(targets, filters.gerente, filters.rede);
  const slide1 = buildSlide1(kpisActual, desafio, kpisPrev, kpisAnoAnt, competencia, customPcts);
  const slide2 = await buildSlide2(compActual, dreRede, sales, gerenteSistema, filters.rede);

  return { slide1, slide2 };
}

// ─── Slide 2 Builder ───

async function buildSlide2(
  compActual: string,
  dreRedeAll: DreRedeDbRow[],
  salesAll: SalesRow[],
  gerenteSistema?: string,
  redeFiltro?: string,
): Promise<RdmSlide2Data> {
  const dreRedeComp = dreRedeAll.filter(d => d.competencia === compActual);
  const salesComp = salesAll.filter(s => s.mes === compActual && GERENTES_KA.includes(s.manager));

  const dreMap = new Map<string, DreRedeDbRow>();
  for (const d of dreRedeComp) dreMap.set(d.rede, d);

  const salesByRede = new Map<string, { fat: number; qty: number; manager: string }>();
  for (const s of salesComp) {
    if (!s.rede) continue;
    const ex = salesByRede.get(s.rede);
    if (ex) { ex.fat += s.fat; ex.qty += s.qty; }
    else salesByRede.set(s.rede, { fat: s.fat, qty: s.qty, manager: s.manager });
  }

  const gerenteMap = await fetchGerenteMap(compActual);
  const allRedes = new Set([...salesByRede.keys(), ...dreRedeComp.map(d => d.rede)]);
  const redeRows: DreRedeRow[] = [];

  for (const rede of allRedes) {
    if (!rede) continue;
    if (redeFiltro && rede !== redeFiltro) continue;

    const sale = salesByRede.get(rede);
    const dre = dreMap.get(rede);
    const fat = sale?.fat || 0;
    const qty = sale?.qty || 0;
    const invest = (dre?.investimento_valor || 0) + (dre?.contrato_valor || 0) + (dre?.bonificacao_valor || 0);

    if (fat <= 0 && invest <= 0) continue;

    const icmsPct = dre?.icms_pct || 0;
    const cpv = dre?.cpv_valor || 0;
    const impostos = fat * icmsPct;
    const frete = fat * 0.03;
    const receitaLiquida = fat - impostos - invest;
    const mc = receitaLiquida - cpv - frete;

    const gerente = gerenteMap.get(rede) || sale?.manager || dre?.gerente_atual || 'SEM RESPONSÁVEL';
    if (gerenteSistema && gerente !== gerenteSistema) continue;

    redeRows.push({
      rede, gerente, volume: qty, faturamento: fat, icmsPct,
      impPct: fat > 0 ? (impostos / fat) * 100 : null,
      investPct: fat > 0 ? (invest / fat) * 100 : null,
      freteUnidade: qty > 0 ? frete / qty : null,
      cpvUnidade: qty > 0 ? cpv / qty : null,
      mc,
    });
  }

  redeRows.sort((a, b) => b.faturamento - a.faturamento);

  const gerenteGroups = new Map<string, DreRedeRow[]>();
  for (const row of redeRows) {
    const displayName = GERENTE_DISPLAY_MAP[row.gerente] || row.gerente;
    if (!gerenteGroups.has(displayName)) gerenteGroups.set(displayName, []);
    gerenteGroups.get(displayName)!.push(row);
  }

  const grupos: RdmSlide2Grupo[] = [...gerenteGroups.entries()]
    .sort((a, b) => b[1].reduce((s, r) => s + r.faturamento, 0) - a[1].reduce((s, r) => s + r.faturamento, 0))
    .map(([gerente, redes]) => ({ gerente, redes }));

  return { grupos };
}

// ─── API: DRE ───

export async function getDreData(filters: DreGerencialFilters): Promise<{
  consolidado: DreMensalColuna[];
  porGerente: { gerente: string; colunas: DreMensalColuna[] }[];
  porRede: { rede: string; gerente: string; colunas: DreMensalColuna[] }[];
}> {
  const { ano } = filters;

  const supabase = createAdminClient();

  // Competências do ano
  const todasComp: string[] = [];
  for (let m = 1; m <= 12; m++) {
    todasComp.push(`${ano}-${String(m).padStart(2, '0')}`);
  }

  const gerenteSistema = resolveGerenteSistema(filters.gerente);
  const [sales, dreRede] = await Promise.all([
    fetchSales(todasComp),
    fetchDreRede(todasComp),
  ]);

  // Consolidado
  const consolidado: DreMensalColuna[] = [];
  for (const comp of todasComp) {
    const [, mesNum] = comp.split('-').map(Number);
    const kpis = buildKpisForComp(sales, dreRede, comp, gerenteSistema, filters.rede);
    if (kpis.faturamento > 0 || kpis.investComercial > 0) {
      consolidado.push({ competencia: comp, label: MESES_LABEL[mesNum] || comp, kpis });
    }
  }

  // Por Gerente
  const porGerente: { gerente: string; colunas: DreMensalColuna[] }[] = [];
  const gerentesAtivos = gerenteSistema ? [gerenteSistema] : GERENTES_KA;

  for (const g of gerentesAtivos) {
    const colunas: DreMensalColuna[] = [];
    for (const comp of todasComp) {
      const [, mesNum] = comp.split('-').map(Number);
      const kpis = buildKpisForComp(sales, dreRede, comp, g, filters.rede);
      if (kpis.faturamento > 0 || kpis.investComercial > 0) {
        colunas.push({ competencia: comp, label: MESES_LABEL[mesNum] || comp, kpis });
      }
    }
    if (colunas.length > 0) {
      porGerente.push({ gerente: GERENTE_DISPLAY_MAP[g] || g, colunas });
    }
  }

  // Por Rede
  const porRede: { rede: string; gerente: string; colunas: DreMensalColuna[] }[] = [];
  const lastComp = todasComp[todasComp.length - 1];
  const gerenteMap = await fetchGerenteMap(lastComp);

  // Coletar todas as redes
  const redesSet = new Set<string>();
  const filteredSales = filterByGerente(sales, gerenteSistema);
  for (const s of filteredSales) if (s.rede) redesSet.add(s.rede);
  for (const d of dreRede) if (d.rede) redesSet.add(d.rede);

  for (const rede of [...redesSet].sort()) {
    if (filters.rede && rede !== filters.rede) continue;

    const gerente = gerenteMap.get(rede) || 'SEM RESPONSÁVEL';
    if (gerenteSistema && gerente !== gerenteSistema) continue;

    const colunas: DreMensalColuna[] = [];
    for (const comp of todasComp) {
      const [, mesNum] = comp.split('-').map(Number);
      // Para rede individual, filtrar sales e DRE apenas dessa rede
      const salesRede = sales.filter(s => s.rede === rede && s.mes === comp);
      const dreRedeComp = dreRede.filter(d => d.rede === rede && d.competencia === comp);

      const fat = salesRede.reduce((s, r) => s + r.fat, 0);
      const qty = salesRede.reduce((s, r) => s + r.qty, 0);
      const dre = dreRedeComp[0];

      const icmsPct = dre?.icms_pct || 0;
      const cpv = dre?.cpv_valor || 0;
      const invest = dre?.investimento_valor || 0;
      const contrato = dre?.contrato_valor || 0;
      const bonif = dre?.bonificacao_valor || 0;

      if (fat <= 0 && (invest + contrato + bonif) <= 0) continue;

      const investComercial = invest + contrato + bonif;
      const impostos = fat * icmsPct;
      const receitaLiquida = fat - impostos - investComercial;
      const frete = fat * 0.03;
      const mc = receitaLiquida - cpv - frete;

      colunas.push({
        competencia: comp,
        label: MESES_LABEL[mesNum] || comp,
        kpis: {
          volume: qty, faturamento: fat, impostos, investComercial,
          abatimento: invest, contrato, bonificacao: bonif,
          receitaLiquida, cpv, frete, margemContribuicao: mc,
        },
      });
    }
    if (colunas.length > 0) {
      porRede.push({ rede, gerente: GERENTE_DISPLAY_MAP[gerente] || gerente, colunas });
    }
  }

  porRede.sort((a, b) => {
    const fatA = a.colunas.reduce((s, c) => s + c.kpis.faturamento, 0);
    const fatB = b.colunas.reduce((s, c) => s + c.kpis.faturamento, 0);
    return fatB - fatA;
  });

  return { consolidado, porGerente, porRede };
}

// ─── API: Competências disponíveis ───

export async function getCompetenciasDisponiveis(ano: number): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('mv_vendas_mensal')
    .select('mes')
    .like('mes', `${ano}-%`);

  return [...new Set((data || []).map(r => r.mes))].sort();
}

// ─── API: RDM Slide DRE Acumulado por Período ───

async function fetchYearTargets(ano: number): Promise<{ month: number; manager: string; target_revenue: number; target_tons: number }[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('targets')
    .select('month, manager, target_revenue, target_tons')
    .eq('year', ano);

  if (error) throw new Error(`Erro ao buscar targets do ano: ${error.message}`);
  return (data || []).map(t => ({
    month: Number(t.month || 0),
    manager: String(t.manager || ''),
    target_revenue: Number(t.target_revenue || 0),
    target_tons: Number(t.target_tons || 0),
  }));
}

export async function getRdmDreAcumuladoData(year: number, gerente?: string): Promise<RdmSlideAcumuladoData> {
  const competencias = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const gerenteSistema = resolveGerenteSistema(gerente);

  const [sales, dreRede, yearTargets, customPcts] = await Promise.all([
    fetchSales(competencias),
    fetchDreRede(competencias),
    fetchYearTargets(year),
    fetchDesafioConfig(gerente),
  ]);

  const salesCompSet = new Set(sales.map(s => s.mes));

  const monthlyData: {
    month: number;
    comp: string;
    hasActualData: boolean;
    actual: DreKpis;
    desafio: { revenue: number | null; volume: number | null };
    desafioImpostos: number | null;
    desafioInvest: number | null;
    desafioCPV: number | null;
    desafioFrete: number | null;
    desafioRecLiq: number | null;
    desafioMargem: number | null;
  }[] = [];

  for (let m = 1; m <= 12; m++) {
    const comp = `${year}-${String(m).padStart(2, '0')}`;
    const actualKpis = buildKpisForComp(sales, dreRede, comp, gerenteSistema);
    const hasActualData = actualKpis.faturamento > 0 || actualKpis.volume > 0 || actualKpis.cpv > 0 || actualKpis.investComercial > 0;

    const mTargets: TargetRow[] = yearTargets.filter(t => t.month === m).map(t => ({
      manager: t.manager,
      target_revenue: t.target_revenue,
      target_tons: t.target_tons,
    }));

    const mDesafio = getDesafio(mTargets, gerente);
    const fatDesafio = mDesafio.revenue;
    const volDesafio = mDesafio.volume;

    const impDesafio = fatDesafio !== null ? fatDesafio * customPcts.impostos_pct : null;
    const invDesafio = fatDesafio !== null ? fatDesafio * customPcts.investimento_pct : null;
    const cpvDesafio = fatDesafio !== null ? fatDesafio * customPcts.cpv_pct : null;
    const freDesafio = fatDesafio !== null ? fatDesafio * customPcts.frete_pct : null;
    const recLiqDesafio = (fatDesafio !== null && impDesafio !== null && invDesafio !== null)
      ? fatDesafio - impDesafio - invDesafio
      : null;
    const mcDesafio = (recLiqDesafio !== null && cpvDesafio !== null && freDesafio !== null)
      ? recLiqDesafio - cpvDesafio - freDesafio
      : null;

    monthlyData.push({
      month: m,
      comp,
      hasActualData,
      actual: actualKpis,
      desafio: { revenue: fatDesafio, volume: volDesafio },
      desafioImpostos: impDesafio,
      desafioInvest: invDesafio,
      desafioCPV: cpvDesafio,
      desafioFrete: freDesafio,
      desafioRecLiq: recLiqDesafio,
      desafioMargem: mcDesafio,
    });
  }

  const trimestresDef = [
    { trimestre: 1, label: '1º TRIMESTRE', months: [1, 2, 3], labels: ['JAN', 'FEV', 'MAR'] },
    { trimestre: 2, label: '2º TRIMESTRE', months: [4, 5, 6], labels: ['ABR', 'MAI', 'JUN'] },
    { trimestre: 3, label: '3º TRIMESTRE', months: [7, 8, 9], labels: ['JUL', 'AGO', 'SET'] },
    { trimestre: 4, label: '4º TRIMESTRE', months: [10, 11, 12], labels: ['OUT', 'NOV', 'DEZ'] },
  ];

  const trimestresData: RdmTrimestreData[] = trimestresDef.map(tDef => {
    const colunas: RdmAcumuladoColuna[] = tDef.months.map((m, idx) => ({
      key: `M_${m}`,
      label: tDef.labels[idx],
      isAcum: false,
      hasData: monthlyData[m - 1].hasActualData,
    }));
    colunas.push({
      key: `ACUM_Q${tDef.trimestre}`,
      label: 'ACUM',
      isAcum: true,
      hasData: tDef.months.some(m => monthlyData[m - 1].hasActualData),
    });

    const kpiDefs: { kpi: string; getKey: (m: typeof monthlyData[0]) => { actual: number; desafio: number | null }; isHighlighted?: boolean }[] = [
      {
        kpi: 'Volume',
        getKey: (m) => ({ actual: m.actual.volume, desafio: m.desafio.volume }),
      },
      {
        kpi: 'Faturamento',
        getKey: (m) => ({ actual: m.actual.faturamento, desafio: m.desafio.revenue }),
        isHighlighted: true,
      },
      {
        kpi: 'Impostos',
        getKey: (m) => ({ actual: m.actual.impostos, desafio: m.desafioImpostos }),
      },
      {
        kpi: 'Invest. Comercial',
        getKey: (m) => ({ actual: m.actual.investComercial, desafio: m.desafioInvest }),
      },
      {
        kpi: 'Receita Líquida',
        getKey: (m) => ({ actual: m.actual.receitaLiquida, desafio: m.desafioRecLiq }),
        isHighlighted: true,
      },
      {
        kpi: 'CPV',
        getKey: (m) => ({ actual: m.actual.cpv, desafio: m.desafioCPV }),
      },
      {
        kpi: 'Frete',
        getKey: (m) => ({ actual: m.actual.frete, desafio: m.desafioFrete }),
      },
      {
        kpi: 'Margem de Contribuição',
        getKey: (m) => ({ actual: m.actual.margemContribuicao, desafio: m.desafioMargem }),
        isHighlighted: true,
      },
    ];

    const linhas: RdmAcumuladoLinha[] = kpiDefs.map(kDef => {
      const valores: Record<string, RdmAcumuladoValor> = {};

      let qDesafioSum = 0;
      let hasQDesafio = false;
      let qActualSum = 0;
      let hasQActual = false;

      tDef.months.forEach(m => {
        const mData = monthlyData[m - 1];
        const { actual, desafio } = kDef.getKey(mData);

        const colKey = `M_${m}`;
        const actualVal = mData.hasActualData ? actual : null;

        let delta: number | null = null;
        let pctDelta: number | null = null;

        if (actualVal !== null && desafio !== null) {
          delta = actualVal - desafio;
          pctDelta = desafio !== 0 ? (actualVal / desafio - 1) * 100 : null;
        }

        valores[colKey] = {
          desafio,
          actual: actualVal,
          delta,
          pctDelta,
        };

        if (desafio !== null) {
          qDesafioSum += desafio;
          hasQDesafio = true;
        }

        if (actualVal !== null) {
          qActualSum += actualVal;
          hasQActual = true;
        }
      });

      const acumKey = `ACUM_Q${tDef.trimestre}`;
      const acumDesafio = hasQDesafio ? qDesafioSum : null;
      const acumActual = hasQActual ? qActualSum : null;

      let acumDelta: number | null = null;
      let acumPctDelta: number | null = null;

      if (acumActual !== null && acumDesafio !== null) {
        acumDelta = acumActual - acumDesafio;
        acumPctDelta = acumDesafio !== 0 ? (acumActual / acumDesafio - 1) * 100 : null;
      }

      valores[acumKey] = {
        desafio: acumDesafio,
        actual: acumActual,
        delta: acumDelta,
        pctDelta: acumPctDelta,
      };

      return {
        kpi: kDef.kpi,
        isHighlighted: kDef.isHighlighted,
        valores,
      };
    });

    return {
      trimestre: tDef.trimestre,
      label: tDef.label,
      colunas,
      linhas,
    };
  });

  return {
    titulo: `Resultado DRE | Acumulado por Período — ${year}`,
    year,
    trimestres: trimestresData,
  };
}
