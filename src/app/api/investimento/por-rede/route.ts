import { NextResponse } from 'next/server';
import { AnalyticsEngine } from '@/lib/governance/analytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startMonth = searchParams.get('startMonth') || undefined;
    const endMonth = searchParams.get('endMonth') || undefined;
    const manager = searchParams.get('manager') || undefined;
    const uf = searchParams.get('uf') || undefined;
    const channel = searchParams.get('channel') || undefined;
    const matriz = searchParams.get('rede') || searchParams.get('matriz') || undefined;

    const result = await AnalyticsEngine.getInvestimentoPorRede({
      startMonth,
      endMonth,
      manager,
      uf,
      channel,
      matriz,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Investimento por Rede Error]", error);
    return NextResponse.json({ error: error.message || "Erro ao carregar dados de investimento por rede" }, { status: 500 });
  }
}

