/**
 * GET /api/dre-gerencial
 * 
 * Retorna dados do DRE Gerencial (visão mensal consolidada).
 * Fonte: mv_vendas_mensal + cm_dre_gerencial_rede + targets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDreData, getCompetenciasDisponiveis } from '@/lib/dre-gerencial/engine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get('ano') || new Date().getFullYear());
    const gerente = searchParams.get('gerente') || undefined;
    const canal = searchParams.get('canal') || 'KA';
    const rede = searchParams.get('rede') || undefined;
    const visao = (searchParams.get('visao') || 'consolidado') as 'consolidado' | 'gerente' | 'rede';

    const [dreData, competencias] = await Promise.all([
      getDreData({ ano, gerente, canal, rede, visao }),
      getCompetenciasDisponiveis(ano),
    ]);

    return NextResponse.json({
      ano,
      competencias,
      ...dreData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[DRE Gerencial API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
