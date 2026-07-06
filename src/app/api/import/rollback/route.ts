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
  } catch (err: any) {
    console.error("[API Rollback] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro ao desfazer lote" },
      { status: 500 }
    );
  }
}
