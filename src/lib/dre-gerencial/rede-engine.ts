/**
 * DRE Gerencial por Rede / Matriz — Engine de Domínio (Slide 10/29 RDM)
 * 
 * Responsabilidade:
 * - Single Source of Truth para a visão gerencial de DRE por Rede do RDM.
 * - Elimina frete fixo de 3%: utiliza alíquota específica de frete de cada rede.
 * - Elimina dependência das notas fiscais do ERP Sankhya para a modelagem gerencial.
 * - Elimina fallbacks e cálculos financeiros na camada de UI (React).
 * - Busca volume físico exclusivamente no SSOT operacional (mv_vendas_cliente_mensal.qty).
 * 
 * Regras Irrevogáveis:
 * - RECEITA LÍQUIDA = FAT - IMPOSTOS - INVESTIMENTO - CONTRATO
 * - CPV = FAT × CPV %
 * - FRETE = (FAT - INVESTIMENTO) × FRETE %
 * - MACO = RECEITA LÍQUIDA - CPV - FRETE
 * - % MACO = MACO / FAT × 100 (Denominador = FATURAMENTO TOTAL)
 */

import { getReferenceRedesPorCompetencia } from './reference-data';
import type { RdmSlide10RedeItem, RdmSlide10Result } from './types';
import { resolveCanonicalManager, isSameManager } from '@/lib/domain/canonical';
import { AnalyticsEngine } from '@/lib/governance/analytics/engine';

/**
 * Busca e consolida os dados de DRE por Rede para o Slide 10 do RDM.
 */
export async function getRdmDrePorRedeData(
  competencia: string,
  managerFilter?: string
): Promise<RdmSlide10Result> {
  const rawRedes = getReferenceRedesPorCompetencia(competencia);

  // Tratamento de competências sem fechamento gerencial homologado
  if (!rawRedes || rawRedes.length === 0) {
    return {
      items: [],
      status: 'PENDENTE',
      competencia,
      totalRedes: 0,
    };
  }

  // 1. Filtrar apenas redes com faturamento > 0
  const redesAtivas = rawRedes.filter(r => (r.faturamentoBruto || 0) > 0);

  // 2. Busca do Volume no SSOT Operacional (mv_vendas_cliente_mensal)
  let volRows: { rede: string; uf: string; volume: number }[] = [];
  try {
    const volSql = `
      SELECT 
        COALESCE(rede, 'Outros') as rede,
        COALESCE(uf, 'ND') as uf,
        SUM(qty) as volume
      FROM public.mv_vendas_cliente_mensal
      WHERE mes = '${competencia}'
      GROUP BY rede, uf
    `;
    volRows = await AnalyticsEngine.executeSql<{ rede: string; uf: string; volume: number }>(volSql);
  } catch (err) {
    console.error('[getRdmDrePorRedeData] Erro ao carregar volumes de mv_vendas_cliente_mensal:', err);
  }

  function matchVol(rowRede: string, rowUf: string, targetNome: string, targetUf: string): boolean {
    const rUf = (rowUf || '').toUpperCase().trim();
    const tUf = (targetUf || '').toUpperCase().trim();
    if (rUf && tUf && rUf !== 'ND' && tUf !== 'ND' && rUf !== 'BR' && rUf !== tUf) return false;

    const tNorm = targetNome.toUpperCase().replace(/\(.*?\)/g, '').replace(/[^A-Z0-9]/g, ' ').trim();
    const rNorm = rowRede.toUpperCase().replace(/\(.*?\)/g, '').replace(/[^A-Z0-9]/g, ' ').trim();
    if (tNorm === rNorm) return true;

    const tTokens = tNorm.split(/\s+/).filter(t => t.length > 2 && t !== tUf && t !== 'REDE' && t !== 'DIST');
    const rTokens = rNorm.split(/\s+/).filter(t => t.length > 2 && t !== rUf && t !== 'REDE' && t !== 'DIST');
    return tTokens.some(t => rTokens.includes(t));
  }

  // 3. Resolução do Gerente para Filtro
  const isConsolidado = !managerFilter || 
    managerFilter.toLowerCase() === 'all' || 
    managerFilter.toLowerCase() === 'todos' || 
    managerFilter.toLowerCase() === 'cristiano';

  const canonicalFilter = !isConsolidado ? resolveCanonicalManager(managerFilter).managerName : null;

  // 4. Mapeamento, Cálculos Oficiais e Associação de Volume
  const mappedItems: RdmSlide10RedeItem[] = [];

  for (const r of redesAtivas) {
    // Filtro por gerente comercial
    if (!isConsolidado && canonicalFilter) {
      const resp = r.responsavelPlanilha;
      if (!isSameManager(resp, canonicalFilter)) {
        continue;
      }
    }

    const fat = r.faturamentoBruto || 0;
    const invest = r.investimento || 0;
    const icmsPct = typeof r.icmsPct === 'number' ? r.icmsPct : 0.0417;
    const contratoPct = typeof r.contratoPct === 'number' ? r.contratoPct : 0;
    const cpvPct = typeof r.cpvPct === 'number' ? r.cpvPct : (fat > 0 ? (r.cpvCusto || 0) / fat : 0);
    const fretePct = typeof r.fretePct === 'number' ? r.fretePct : 0.008;

    // Fórmulas Oficiais Homologadas:
    const impostos = typeof r.imposto === 'number' ? r.imposto : fat * icmsPct;
    const contrato = typeof r.valorContrato === 'number' ? r.valorContrato : fat * contratoPct;
    const recLiquida = fat - impostos - invest - contrato;
    const cpv = typeof r.cpvCusto === 'number' ? r.cpvCusto : fat * cpvPct;
    // Frete com alíquota específica da rede: (FAT - INVESTIMENTO) * FRETE %
    const frete = typeof r.frete === 'number' ? r.frete : (fat - invest) * fretePct;
    const maco = recLiquida - cpv - frete;
    const macoPct = fat > 0 ? (maco / fat) * 100 : 0;

    // Extrair UF da chave canônica (ex: "DF REDE OBA" -> "DF")
    const parts = (r.redeUf || '').trim().split(' ');
    const uf = parts.length > 1 && parts[0].length === 2 ? parts[0] : 'BR';

    // Resolução do Volume Operacional (SSOT)
    const matchingVolRows = volRows.filter(row => matchVol(row.rede, row.uf, r.rede, uf));
    const vol = matchingVolRows.reduce((acc, cur) => acc + (Number(cur.volume) || 0), 0);

    mappedItems.push({
      id: `dre-rede-${r.redeUf || r.rede}`,
      ranking: 0, // atribuído pós-ordenação
      nome: r.rede,
      uf,
      gerente: r.responsavelPlanilha,
      volume: vol,
      fat,
      impostos,
      investimento: invest,
      contrato,
      recLiquida,
      cpv,
      frete,
      maco,
      macoPct,
      codigo_matriz: r.redeUf || r.rede,
      icmsPct,
      contratoPct,
      cpvPct,
      fretePct,
    });
  }

  // 5. Ordenação Determinística por FAT DESC e Desempate Alfabético pt-BR
  mappedItems.sort((a, b) => {
    if (b.fat !== a.fat) return b.fat - a.fat;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  // 6. Atribuição do Ranking Global Determinístico
  mappedItems.forEach((item, idx) => {
    item.ranking = idx + 1;
  });

  return {
    items: mappedItems,
    status: 'HOMOLOGADO',
    competencia,
    totalRedes: mappedItems.length,
  };
}
