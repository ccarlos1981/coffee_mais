import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * [DECOMMISSIONED - WAVE 0 CONTENÇÃO]
 * Este endpoint legado de importação foi permanentemente desativado e substituído
 * pelo Import Hub oficial (/api/import/excel/*).
 * Retorna HTTP 410 Gone para todas as requisições.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Gone",
      message: "Este endpoint legado foi permanentemente desativado. Utilize o Import Hub oficial em /api/import/excel/*.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Gone",
      message: "Este endpoint legado foi permanentemente desativado.",
    },
    { status: 410 }
  );
}
