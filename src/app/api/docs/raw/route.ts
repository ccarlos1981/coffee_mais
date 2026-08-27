import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAuth, requireApprovedProfile, handleAuthError } from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApprovedProfile(user.id);

    const { searchParams } = new URL(req.url);
    const rawDocPath = searchParams.get("path");

    if (!rawDocPath) {
      return NextResponse.json({ error: "Parâmetro 'path' é obrigatório." }, { status: 400 });
    }

    // 1. Sanitize input: allow only safe relative path chars and enforce .md extension
    if (!/^[a-zA-Z0-9_\-\/.]+\.md$/.test(rawDocPath)) {
      return NextResponse.json(
        { error: "Arquivo inválido ou extensão não permitida. Apenas arquivos .md são autorizados." },
        { status: 403 }
      );
    }

    const docsBaseDir = path.resolve(process.cwd(), "docs");
    
    // Ensure base docs dir exists
    if (!fs.existsSync(docsBaseDir)) {
      return NextResponse.json({ error: "Diretório de documentação não encontrado." }, { status: 404 });
    }

    const realDocsDir = fs.realpathSync(docsBaseDir);
    const normalizedRelative = path.normalize(rawDocPath).replace(/^(\.\.[\/\\])+/, "");
    const cleanRelative = normalizedRelative.startsWith("docs/")
      ? normalizedRelative.slice(5)
      : normalizedRelative;

    const fullTarget = path.resolve(realDocsDir, cleanRelative);

    if (!fs.existsSync(fullTarget)) {
      return NextResponse.json({ error: `Arquivo não encontrado: ${rawDocPath}` }, { status: 404 });
    }

    // 2. Realpath check against symlink escapes
    const realTarget = fs.realpathSync(fullTarget);
    const relative = path.relative(realDocsDir, realTarget);

    if (relative.startsWith("..") || path.isAbsolute(relative) || !realTarget.endsWith(".md")) {
      return NextResponse.json({ error: "Acesso negado: fora do escopo de documentação." }, { status: 403 });
    }

    const content = fs.readFileSync(realTarget, "utf-8");
    const filename = path.basename(realTarget);

    return NextResponse.json({
      success: true,
      path: rawDocPath,
      filename,
      content,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHENTICATED" || error.message?.includes("PROFILE_")) {
      return handleAuthError(error);
    }
    console.error("Erro na API GET /api/docs/raw:", error);
    return NextResponse.json(
      { error: "Falha ao ler documento", message: error.message },
      { status: 500 }
    );
  }
}
