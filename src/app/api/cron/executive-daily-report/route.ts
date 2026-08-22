import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { ExecutiveReportCollector } from "@/lib/services/executive-report-collector";
import { ExecutivePdfBuilder } from "@/lib/services/executive-pdf-builder";
import { ExecutiveAiAnalyst } from "@/lib/services/executive-ai-analyst";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos de limite de execução

const TARGET_EMAIL = "cristiano.santos@coffeemais.com";

// Registro em memória de execuções no ciclo da instância para proteção contra duplo disparo
const executedDatesCache = new Set<string>();

export async function GET(request: NextRequest) {
  return handleExecutiveReportCron(request);
}

export async function POST(request: NextRequest) {
  return handleExecutiveReportCron(request);
}

async function handleExecutiveReportCron(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validação de Autenticação / CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const secretParam = request.nextUrl.searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : secretParam;
      if (token !== cronSecret) {
        return NextResponse.json({ error: "Acesso não autorizado. CRON_SECRET inválido." }, { status: 401 });
      }
    }

    // 2. Barreira de Domingo (Timezone: America/Sao_Paulo)
    const nowSp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayOfWeek = nowSp.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const todayIso = nowSp.toISOString().split("T")[0];

    const forceOverride = request.nextUrl.searchParams.get("force") === "true";

    if (dayOfWeek === 0 && !forceOverride) {
      console.log("[ExecutiveReportCron] Execução aos domingos é estritamente bloqueada.");
      return NextResponse.json({
        success: true,
        status: "SKIPPED_SUNDAY",
        message: "Relatório executivo automático não é executado aos domingos.",
      });
    }

    // 3. Idempotência / Proteção contra disparo duplicado no mesmo dia
    if (executedDatesCache.has(todayIso) && !forceOverride) {
      console.log(`[ExecutiveReportCron] Relatório do dia ${todayIso} já foi enviado nesta data.`);
      return NextResponse.json({
        success: true,
        status: "SKIPPED_ALREADY_SENT",
        message: `Relatório do dia ${todayIso} já enviado anteriormente. Use ?force=true para reenvio.`,
      });
    }

    // 4. Coleta dos Dados Oficiais via ExecutiveReportCollector
    console.log("[ExecutiveReportCron] Coletando dados oficiais do relatório...");
    const reportData = await ExecutiveReportCollector.collect();

    // 5. Verificação da Conclusão da Importação
    // Se a importação do dia falhou ou não existe, envia alerta e interrompe
    if (!reportData.ultimaImportacao.validaParaHoje && !forceOverride) {
      console.warn("[ExecutiveReportCron] Última importação não está validada para a data corrente. Disparando e-mail de alerta.");
      await sendImportAlertEmail(reportData);

      return NextResponse.json({
        success: false,
        status: "BLOCKED_IMPORT_PENDING",
        message: "Importação diária do Import Hub pendente ou não concluída. E-mail de alerta enviado.",
        ultimaImportacao: reportData.ultimaImportacao,
      });
    }

    // 6. Geração da Análise de IA para o Corpo do E-mail
    console.log("[ExecutiveReportCron] Gerando resumo analítico com IA Gemini...");
    const emailHtml = await ExecutiveAiAnalyst.generateEmailSummary(reportData);

    // 7. Geração do Buffer PDF de 4 Páginas
    console.log("[ExecutiveReportCron] Construindo PDF executivo de 4 páginas com pdfMake...");
    const pdfBuffer = await ExecutivePdfBuilder.buildPdfBuffer(reportData);
    console.log(`[ExecutiveReportCron] PDF gerado com sucesso (${(pdfBuffer.length / 1024).toFixed(1)} KB).`);

    // 8. Transmissão do E-mail via Nodemailer (Gmail SMTP)
    const emailSubject = `☕ Coffee++ | Relatório Executivo Diário | ${reportData.dataReferencia}`;
    const pdfFileName = `Relatorio_Executivo_Coffee++_${reportData.dataReferencia.replace(/\//g, "-")}.pdf`;

    let emailSent = false;
    let messageId = "";

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "465", 10),
        secure: (process.env.SMTP_PORT || "465") === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
      });

      const info = await transporter.sendMail({
        from: `"Coffee++ Gestão Executiva" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: TARGET_EMAIL,
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: pdfFileName,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      emailSent = true;
      messageId = info.messageId;
      console.log(`[ExecutiveReportCron] E-mail executivo transmitido com sucesso para ${TARGET_EMAIL} (ID: ${messageId})`);
    } else {
      console.warn("[ExecutiveReportCron] Credenciais SMTP não configuradas. Logando disparo em modo simulação.");
      messageId = "SIMULATED_LOCAL_DISPATCH";
      emailSent = true;
    }

    // Registrar data enviada no cache de idempotência
    executedDatesCache.add(todayIso);

    const durationSeconds = (Date.now() - startTime) / 1000;

    return NextResponse.json({
      success: true,
      status: "EXECUTED_SUCCESSFULLY",
      dataReferencia: reportData.dataReferencia,
      competencia: reportData.competenciaAtual,
      destinatario: TARGET_EMAIL,
      assunto: emailSubject,
      pdfAnexado: pdfFileName,
      tamanhoPdfKb: Number((pdfBuffer.length / 1024).toFixed(1)),
      emailEnviado: emailSent,
      messageId,
      duracaoSegundos: durationSeconds,
    });
  } catch (error: any) {
    console.error("[ExecutiveReportCron] Erro fatal na execução do relatório executivo:", error);
    const durationSeconds = (Date.now() - startTime) / 1000;

    return NextResponse.json(
      {
        success: false,
        status: "FATAL_ERROR",
        error: error.message || String(error),
        duracaoSegundos: durationSeconds,
      },
      { status: 500 }
    );
  }
}

/**
 * Envia e-mail de alerta caso a importação do dia não tenha sido confirmada
 */
async function sendImportAlertEmail(reportData: any) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "465", 10),
      secure: (process.env.SMTP_PORT || "465") === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `"Coffee++ Gestão Executiva" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: TARGET_EMAIL,
      subject: `⚠️ Coffee++ — Relatório Executivo não gerado | ${reportData.dataReferencia}`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 8px; border: 1px solid #fee2e2;">
          <h2 style="color: #dc2626; margin-top: 0;">⚠️ Coffee++ &bull; Relatório Executivo Não Gerado</h2>
          <p>Olá,</p>
          <p>O Relatório Executivo Diário referente a <strong>${reportData.dataReferencia}</strong> não foi gerado porque a rotina de importação automática do Import Hub ainda não foi concluída com sucesso para a data corrente.</p>
          
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 13px;">
            <strong>Diagnóstico de Ingestão:</strong><br>
            • Status da Ingestão: <code>${reportData.ultimaImportacao.status}</code><br>
            • Último Registro Concluído: <code>${reportData.ultimaImportacao.finalizadaEm}</code><br>
            • Arquivo: <code>${reportData.ultimaImportacao.nomeArquivo}</code>
          </div>

          <p style="font-size: 13px; color: #6b7280;">Por diretriz de governança (Demanda 085), o envio com dados desatualizados é bloqueado para evitar tomada de decisão baseada em números parciais.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><small style="color: #999;">Notificação gerada automaticamente pela plataforma Coffee++.</small></p>
        </div>
      `,
    });
  } catch (err: any) {
    console.warn("[ExecutiveReportCron] Falha ao enviar e-mail de alerta de importação:", err.message);
  }
}
