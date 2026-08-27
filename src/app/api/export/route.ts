import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  requireAuth,
  requireApprovedProfile,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";

const MAX_EXPORT_ROWS = 50000;
const MAX_EXPORT_COLS = 100;

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await requireApprovedProfile(user.id);

    const formData = await req.formData();
    const dataStr = formData.get("data") as string;
    const filename = formData.get("filename") as string;
    const sheetName = formData.get("sheetName") as string;

    const data = dataStr ? JSON.parse(dataStr) : [];

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    if (data.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: "Payload excede o limite máximo de 50.000 registros para exportação." },
        { status: 400 }
      );
    }

    const hasExcessiveCols = data.some(
      (row: Record<string, unknown>) =>
        row && typeof row === "object" && Object.keys(row).length > MAX_EXPORT_COLS
    );
    if (hasExcessiveCols) {
      return NextResponse.json(
        { error: "Payload excede o limite máximo de 100 colunas por registro." },
        { status: 400 }
      );
    }

    // Gerar Planilha
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || "Dados");

    // Converter para Buffer Binário de Excel
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Configurar Headers rígidos forçando o nome de download
    const finalFilename = filename || "exportacao.xlsx";
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${finalFilename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

