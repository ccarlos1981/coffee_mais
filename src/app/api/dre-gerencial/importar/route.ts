/**
 * POST /api/dre-gerencial/importar — Upload e preview da planilha
 * POST /api/dre-gerencial/importar?action=confirm — Confirmar importação
 */

import { NextRequest, NextResponse } from 'next/server';
import { processUpload, confirmImport } from '@/lib/dre-gerencial/import-service';

export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'confirm') {
      // Confirmar importação
      const body = await req.json();
      const { batchId } = body;
      if (!batchId) {
        return NextResponse.json({ error: 'batchId obrigatório' }, { status: 400 });
      }
      const result = await confirmImport(batchId);
      return NextResponse.json(result);
    }

    // Upload e preview
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const competencia = formData.get('competencia') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
    }
    if (!competencia) {
      return NextResponse.json({ error: 'Competência obrigatória' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const preview = await processUpload(buffer, file.name, competencia);

    return NextResponse.json(preview);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[DRE Import API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
