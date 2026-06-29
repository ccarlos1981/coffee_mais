import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import DOMPurify from "isomorphic-dompurify";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // 1. Buscar processo
    const { data: process, error: procErr } = await supabase
      .from("cm_processos")
      .select("*")
      .eq("id", id)
      .eq("ativo", true)
      .single();

    if (procErr || !process) {
      return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
    }

    // 2. Obter perfil do usuário
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "Promotor";
    const allowedEditRoles = ["Admin", "CEO", "RH"];
    const isEditor = allowedEditRoles.includes(role);

    // Se NÃO for editor e o processo não for PUBLICADO, não pode ler
    if (!isEditor && process.status !== "PUBLICADO") {
      return NextResponse.json({ error: "Não autorizado a visualizar este processo" }, { status: 403 });
    }

    // 3. Buscar histórico de versões
    const { data: history, error: histErr } = await supabase
      .from("cm_processos_historico")
      .select("*")
      .eq("processo_id", id)
      .order("created_at", { ascending: false });

    // Obter nomes dos editores para o histórico
    const userIds = Array.from(new Set((history || []).map(h => h.updated_by).filter(Boolean)));
    const { data: profiles } = await supabase
      .from("cm_user_profiles")
      .select("id, employee_code")
      .in("id", userIds);

    const { data: employees } = await supabase
      .from("cm_employees")
      .select("id, nome_completo");

    const empNameMap = new Map();
    if (employees) employees.forEach(e => empNameMap.set(e.id, e.nome_completo));

    const userToEmpMap = new Map();
    // No Supabase de dev, o cm_promotor_perfil faz o link de user_id a employee_id.
    const { data: promotorPerfil } = await supabase.from("cm_promotor_perfil").select("user_id, employee_id");
    if (promotorPerfil) promotorPerfil.forEach(p => userToEmpMap.set(p.user_id, p.employee_id));

    const editorNames = new Map();
    if (profiles) {
      profiles.forEach(p => {
        const empId = userToEmpMap.get(p.id);
        const name = empId ? empNameMap.get(empId) : `Editor ${p.employee_code || "000"}`;
        editorNames.set(p.id, name);
      });
    }

    // Adiciona o nome do autor principal (created_by e updated_by do processo principal)
    const creatorEmpId = userToEmpMap.get(process.created_by);
    const creatorName = creatorEmpId ? empNameMap.get(creatorEmpId) : "Cristiano Santos"; // Fallback padrão

    const formattedHistory = (history || []).map(h => ({
      id: h.id,
      versao: h.versao,
      conteudo_snapshot: h.conteudo_snapshot,
      change_log: h.change_log || "Ajustes de conteúdo",
      created_at: h.created_at,
      updated_by_name: editorNames.get(h.updated_by) || "Cristiano Santos"
    }));

    let signedFileUrl = null;
    if (process.render_mode === "PDF_VIEWER" && process.original_file_url) {
      if (process.original_file_url.startsWith("/")) {
        signedFileUrl = process.original_file_url;
      } else {
        const { data: signedData, error: signedErr } = await supabase.storage
          .from("processos-docs")
          .createSignedUrl(process.original_file_url, 7200); // 2 hours
        if (!signedErr && signedData) {
          signedFileUrl = signedData.signedUrl;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...process,
        creator_name: creatorName,
        history: formattedHistory,
        is_editor: isEditor,
        signed_file_url: signedFileUrl
      }
    });
  } catch (error: any) {
    console.error("Erro ao buscar detalhes do processo:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verificar permissão de edição
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const allowedEditRoles = ["Admin", "CEO", "RH"];
    if (!profile || !allowedEditRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão para alterar processos" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let titulo, categoria, departamento_responsavel, conteudo, status, change_log, nova_versao, mandatory_read, allow_download;
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      titulo = formData.get("titulo") as string;
      categoria = formData.get("categoria") as string;
      departamento_responsavel = formData.get("departamento_responsavel") as string;
      conteudo = formData.get("conteudo") as string;
      status = formData.get("status") as string;
      change_log = formData.get("change_log") as string;
      nova_versao = formData.get("nova_versao") as string;
      mandatory_read = formData.get("mandatory_read") === "true";
      allow_download = formData.get("allow_download") === "true";
      file = formData.get("file") as File | null;
    } else {
      const body = await request.json();
      titulo = body.titulo;
      categoria = body.categoria;
      departamento_responsavel = body.departamento_responsavel;
      conteudo = body.conteudo;
      status = body.status;
      change_log = body.change_log;
      nova_versao = body.nova_versao;
      mandatory_read = body.mandatory_read;
      allow_download = body.allow_download;
    }

    let fileFieldsToUpdate: any = {};

    if (file) {
      const timestamp = Date.now();
      const uniquePath = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("processos-docs")
        .upload(uniquePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false
        });

      if (uploadErr) {
        throw new Error(`Erro ao enviar PDF para o Storage: ${uploadErr.message}`);
      }

      fileFieldsToUpdate = {
        original_file_url: uniquePath,
        file_type: "pdf",
        render_mode: "PDF_VIEWER"
      };

      // OCR/Extraction pipeline
      let extractedText = "";
      try {
        const p = new PDFParse(new Uint8Array(fileBuffer));
        const pdfData = await p.getText();
        let rawText = pdfData.text || "";

        if (rawText.trim().length > 100) {
          extractedText = rawText;
        } else {
          // Fallback 1: Tesseract OCR (Local)
          console.log("PDF text too short. Running Tesseract OCR...");
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
            extractedText = ocrText;
          } else {
            throw new Error("Local OCR too short");
          }
        }
      } catch (ocrErr: any) {
        console.warn("Local OCR failed, trying Gemini OCR fallback...", ocrErr);
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
          try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const pdfPart = {
              inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: "application/pdf"
              }
            };
            const prompt = "Você é um assistente de extração de texto OCR. Por favor, leia este documento PDF escaneado e extraia todo o texto dele na íntegra. Retorne apenas o texto extraído.";
            const aiResponse = await model.generateContent([prompt, pdfPart]);
            extractedText = aiResponse.response.text().trim();
          } catch (geminiErr) {
            console.error("Gemini OCR fallback failed:", geminiErr);
            extractedText = `Documento PDF atualizado: ${file.name}`;
          }
        } else {
          extractedText = `Documento PDF atualizado: ${file.name}`;
        }
      }

      conteudo = extractedText;
    }

    const sanitizedConteudo = DOMPurify.sanitize(conteudo || "");

    // Buscar versão atual para versionar
    const { data: current, error: getErr } = await supabase
      .from("cm_processos")
      .select("versao, conteudo, render_mode")
      .eq("id", id)
      .single();

    if (getErr || !current) {
      return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
    }

    // Calcular próxima versão
    let nextVersion = nova_versao;
    if (!nextVersion) {
      if (current.render_mode === "PDF_VIEWER" && !file) {
        // Se for PDF e apenas mudou configurações (sem upload), mantém a versão
        nextVersion = current.versao || "v1.0";
      } else {
        const currentVerStr = current.versao || "v1.0";
        const verNum = parseFloat(currentVerStr.replace("v", ""));
        nextVersion = `v${(verNum + 0.1).toFixed(1)}`;
      }
    }

    // Atualizar processo
    const { data: updatedProcess, error: updateErr } = await supabase
      .from("cm_processos")
      .update({
        titulo,
        categoria: categoria || departamento_responsavel,
        departamento_responsavel,
        conteudo: sanitizedConteudo,
        versao: nextVersion,
        status,
        mandatory_read: mandatory_read !== undefined ? !!mandatory_read : undefined,
        allow_download: allow_download !== undefined ? !!allow_download : undefined,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        ...fileFieldsToUpdate
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Adicionar histórico
    const { error: histErr } = await supabase
      .from("cm_processos_historico")
      .insert({
        processo_id: id,
        versao: nextVersion,
        conteudo_snapshot: sanitizedConteudo,
        change_log: change_log || "Edição de conteúdo",
        updated_by: user.id
      });

    if (histErr) throw histErr;

    return NextResponse.json({ success: true, data: updatedProcess });
  } catch (error: any) {
    console.error("Erro ao atualizar processo:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verificar permissão
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const allowedEditRoles = ["Admin", "CEO", "RH"];
    if (!profile || !allowedEditRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão para remover processos" }, { status: 403 });
    }

    // Soft delete
    const { error: deleteErr } = await supabase
      .from("cm_processos")
      .update({
        ativo: false,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao excluir processo:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
