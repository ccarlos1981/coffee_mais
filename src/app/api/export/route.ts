import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const dataStr = formData.get("data") as string;
    const filename = formData.get("filename") as string;
    const sheetName = formData.get("sheetName") as string;

    const data = dataStr ? JSON.parse(dataStr) : [];

    if (!data || !data.length) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
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
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate Excel" }, { status: 500 });
  }
}
