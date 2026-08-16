/**
 * GET /api/rdm-gerencial
 * 
 * Retorna dados do RDM (Slide 1 + Slide 2).
 * Fonte: mv_vendas_mensal + cm_dre_gerencial_rede + targets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRdmData } from '@/lib/dre-gerencial/engine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get('ano') || new Date().getFullYear());
    const competencia = searchParams.get('competencia') || undefined;
    const gerente = searchParams.get('gerente') || undefined;
    const canal = searchParams.get('canal') || 'KA';
    const rede = searchParams.get('rede') || undefined;

    if (!competencia) {
      return NextResponse.json({ error: 'Parâmetro "competencia" obrigatório' }, { status: 400 });
    }

    const data = await getRdmData({ ano, competencia, gerente, canal, rede });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[RDM Gerencial API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
