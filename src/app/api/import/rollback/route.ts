import { NextRequest, NextResponse } from "next/server";
import { ImportService } from "@/lib/services/import-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();

    if (!batchId) {
      return NextResponse.json({ error: "batchId é obrigatório" }, { status: 400 });
    }

    const result = await ImportService.rollbackImport(batchId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[API Rollback] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message || "Erro ao desfazer lote" },
      { status: 500 }
    );
  }
}
