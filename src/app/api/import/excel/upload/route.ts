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

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "O arquivo excede o limite máximo permitido de 50MB." }, { status: 400 });
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
  } catch (error: unknown) {
    console.error("[API Upload] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message || "Erro durante o processamento do arquivo" },
      { status: 500 }
    );
  }
}
