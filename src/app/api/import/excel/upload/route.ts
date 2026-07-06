import { NextRequest, NextResponse } from "next/server";
import { ImportService } from "@/lib/services/import-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userEmail = formData.get("userEmail") as string || "system";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const preview = await ImportService.analyzeExcel(
      buffer,
      file.name,
      file.size,
      userEmail
    );

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (err: any) {
    console.error("[API Upload] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro durante o processamento do arquivo" },
      { status: 500 }
    );
  }
}
