import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docPath = searchParams.get("path");

    if (!docPath) {
      return NextResponse.json({ error: "Parâmetro 'path' é obrigatório." }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const resolvedPath = path.resolve(projectRoot, docPath);

    // Traversal attack guard: ensure resolved path starts with projectRoot
    if (!resolvedPath.startsWith(projectRoot)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: `Arquivo não encontrado: ${docPath}` }, { status: 404 });
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    const filename = path.basename(resolvedPath);

    return NextResponse.json({
      success: true,
      path: docPath,
      filename,
      content,
    });
  } catch (error: any) {
    console.error("Erro na API GET /api/docs/raw:", error);
    return NextResponse.json(
      { error: "Falha ao ler documento", message: error.message },
      { status: 500 }
    );
  }
}
