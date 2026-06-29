import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Obter perfil do usuário para verificar se tem permissão (Admin, CEO, RH)
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const allowedRoles = ["Admin", "CEO", "RH"];
    if (!profile || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão para importar processos" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let extractedHtml = "";
    let fileType = "docx";
    let renderMode = "HTML";
    let originalFileUrl = "";
    let warning = "";

    if (fileName.endsWith(".docx")) {
      // Import Word using mammoth
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      extractedHtml = result.value;
      if (result.messages.length > 0) {
        warning = "Alguns elementos do Word podem ter sido ajustados na conversão.";
      }
    } else if (fileName.endsWith(".pdf")) {
      // 1. Upload do PDF para o Supabase Storage (processos-docs bucket)
      const uniquePath = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("processos-docs")
        .upload(uniquePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false // versionamento por timestamp, não sobrescreve
        });

      if (uploadErr) {
        throw new Error(`Erro ao enviar PDF para o Storage: ${uploadErr.message}`);
      }

      fileType = "pdf";
      renderMode = "PDF_VIEWER";
      originalFileUrl = uniquePath; // Salvamos o path do Storage

      // 2. Extrair texto para Busca FTS (Chain: pdf-parse -> tesseract -> gemini)
      try {
        const p = new PDFParse(new Uint8Array(fileBuffer));
        const pdfData = await p.getText();
        let rawText = pdfData.text || "";

        if (rawText.trim().length > 100) {
          extractedHtml = rawText;
        } else {
          // Fallback 1: Tesseract OCR (Local)
          console.log("PDF text is empty or too short. Running local OCR via Tesseract.js...");
          try {
            const imageResult = await p.getImage({ imageBuffer: true });
            let ocrText = "";
            
            if (imageResult && imageResult.pages && imageResult.pages.length > 0) {
              const worker = await createWorker("por");
              for (const page of imageResult.pages) {
                if (page.images && page.images.length > 0) {
                  for (const img of page.images) {
                    if (img.data && img.data.length > 0) {
                      const { data: { text } } = await worker.recognize(Buffer.from(img.data));
                      ocrText += text + "\n";
                    }
                  }
                }
              }
              await worker.terminate();
            }
            
            if (ocrText.trim().length > 50) {
              extractedHtml = ocrText;
              warning = "PDF escaneado indexado com sucesso usando OCR local.";
            } else {
              throw new Error("Tesseract OCR result was too short or empty.");
            }
          } catch (ocrErr: any) {
            console.warn("Local OCR failed, trying Gemini OCR fallback...", ocrErr);
            
            // Fallback 2: Gemini OCR (Multimodal)
            const geminiKey = process.env.GEMINI_API_KEY;
            if (!geminiKey) {
              extractedHtml = `Documento PDF Escaneado: ${file.name}`;
              warning = "PDF escaneado. OCR indisponível por falta de chaves.";
            } else {
              const genAI = new GoogleGenerativeAI(geminiKey);
              const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
              
              const pdfPart = {
                inlineData: {
                  data: fileBuffer.toString("base64"),
                  mimeType: "application/pdf"
                }
              };
              
              const prompt = "Você é um assistente de extração de texto OCR. Por favor, leia este documento PDF escaneado e extraia todo o texto dele na íntegra, mantendo a ordem correta dos parágrafos. Retorne apenas o texto extraído, sem comentários ou formatação Markdown especial.";
              const aiResponse = await model.generateContent([prompt, pdfPart]);
              extractedHtml = aiResponse.response.text().trim();
              warning = "PDF escaneado indexado com sucesso usando IA OCR.";
            }
          }
        }
      } catch (err: any) {
        console.error("Erro na esteira de extração de texto:", err);
        extractedHtml = `Documento PDF importado: ${file.name}`;
        warning = "O PDF foi enviado, mas ocorreu um erro na indexação do texto para busca.";
      }
    } else {
      return NextResponse.json({ error: "Formato de arquivo não suportado. Envie .docx ou .pdf." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      html: extractedHtml,
      file_type: fileType,
      render_mode: renderMode,
      original_file_url: originalFileUrl,
      warning: warning || undefined
    });
  } catch (error: any) {
    console.error("Erro na importação de processo:", error);
    return NextResponse.json({ error: error.message || "Erro interno na importação" }, { status: 500 });
  }
}
