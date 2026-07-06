import { NextRequest, NextResponse } from "next/server";
import { ImportService } from "@/lib/services/import-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { batchId, mode } = await request.json();

    if (!batchId || !mode) {
      return NextResponse.json({ error: "batchId e mode ('replace' | 'append') são obrigatórios" }, { status: 400 });
    }

    const result = await ImportService.confirmImport(batchId, mode);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API Confirm] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro ao confirmar importação" },
      { status: 500 }
    );
  }
}
