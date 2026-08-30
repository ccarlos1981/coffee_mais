import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { ExecutiveReportCollector } from "@/lib/services/executive-report-collector";
import {
  ExecutiveReportDispatcher,
  HOMOLOGATED_EXECUTIVE_RECIPIENTS,
} from "@/lib/services/executive-report-dispatcher";
import { assertCronAccess } from "@/lib/supabase/auth-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos de limite de execução

export async function GET(request: NextRequest) {
  return handleExecutiveReportCron(request);
}

export async function POST(request: NextRequest) {
  return handleExecutiveReportCron(request);
}

async function handleExecutiveReportCron(request: NextRequest) {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

  // 1. Validação Obrigatória de Cron (Fail-Closed)
  const cronCheck = await assertCronAccess(request);
  if (!cronCheck.authorized) {
    return cronCheck.errorResponse!;
  }

  // 2. Barreira de Horário / Fuso (America/Sao_Paulo)
  const nowSp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dayOfWeek = nowSp.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const todayIso = nowSp.toISOString().split("T")[0];

  const forceOverride = request.nextUrl.searchParams.get("force") === "true";
  const isDryRun = request.nextUrl.searchParams.get("dry_run") === "true";

  try {

    // 3. Barreira de Domingo (Permanente)
    if (dayOfWeek === 0 && !forceOverride) {
      console.log("[ExecutiveReportCron] Execução aos domingos é estritamente bloqueada.");
      return NextResponse.json({
        success: true,
        status: "SKIPPED_SUNDAY",
        message: "Relatório executivo automático não é executado aos domingos.",
      });
    }

    // 4. Idempotência Persistente: Aquisição Atômica de Lock no Banco de Dados
    console.log(`[ExecutiveReportCron] Tentando adquirir lock atômico para ${todayIso} (Execution ID: ${executionId})...`);
    const lock = await ExecutiveReportDispatcher.acquireLock(todayIso, executionId, forceOverride);

    if (!lock.acquired) {
      console.log(`[ExecutiveReportCron] Execução ignorada por idempotência: ${lock.reason} (Status Atual: ${lock.currentStatus})`);
      const durationSeconds = (Date.now() - startTime) / 1000;
      return NextResponse.json({
        success: true,
        status: lock.reason,
        message:
          lock.reason === "SKIPPED_ALREADY_SENT"
            ? `Relatório do dia ${todayIso} já foi enviado com sucesso anteriormente. Use ?force=true para reenvio forçado.`
            : `Existe outra execução do relatório do dia ${todayIso} em andamento. Aguarde a conclusão.`,
        reportDate: todayIso,
        currentStatus: lock.currentStatus,
        startedAt: lock.startedAt,
        duracaoSegundos: durationSeconds,
      });
    }

    // 5. Coleta dos Dados Oficiais via ExecutiveReportCollector
    console.log("[ExecutiveReportCron] Lock adquirido com sucesso. Coletando dados oficiais do relatório...");
    const reportData = await ExecutiveReportCollector.collect();

    // 6. Verificação da Conclusão da Importação
    // Se a importação do dia falhou ou não existe, envia alerta aos administradores e encerra
    if (!reportData.ultimaImportacao.validaParaHoje && !forceOverride) {
      console.warn("[ExecutiveReportCron] Última importação não está validada para a data corrente. Disparando alerta de importação pendente.");
      await sendImportAlertEmail(reportData);

      await ExecutiveReportDispatcher.completeReport(
        todayIso,
        executionId,
        "FAILED",
        0,
        HOMOLOGATED_EXECUTIVE_RECIPIENTS.length,
        [],
        "Importação diária do Import Hub pendente ou não concluída."
      );

      return NextResponse.json({
        success: false,
        status: "BLOCKED_IMPORT_PENDING",
        message: "Importação diária do Import Hub pendente ou não concluída. E-mail de alerta enviado.",
        ultimaImportacao: reportData.ultimaImportacao,
      });
    }

    // 7. Geração e Disparo Homologado para os 7 Destinatários
    console.log("[ExecutiveReportCron] Iniciando pipeline homologado de 7 relatórios executivos...");
    const dispatchResult = await ExecutiveReportDispatcher.dispatchHomologatedReports({
      reportData,
      executionId,
      dryRun: isDryRun,
    });

    const durationSeconds = (Date.now() - startTime) / 1000;

    return NextResponse.json({
      success: dispatchResult.success,
      status: dispatchResult.status,
      reportDate: reportData.dataReferenciaIso,
      dataReferencia: reportData.dataReferencia,
      competencia: reportData.competenciaAtual,
      executionId,
      totalDestinatarios: dispatchResult.totalExpected,
      totalEnviados: dispatchResult.totalSent,
      totalFalhas: dispatchResult.totalFailed,
      detalhes: dispatchResult.details,
      duracaoSegundos: durationSeconds,
    });
  } catch (error: any) {
    console.error("[ExecutiveReportCron] Erro fatal na execução do relatório executivo:", error);
    const durationSeconds = (Date.now() - startTime) / 1000;

    // Registra falha no banco de dados para liberar lock ou registrar histórico
    try {
      await ExecutiveReportDispatcher.completeReport(
        todayIso,
        executionId,
        "FAILED",
        0,
        HOMOLOGATED_EXECUTIVE_RECIPIENTS.length,
        [],
        error.message || String(error)
      );
    } catch (logErr) {
      console.error("[ExecutiveReportCron] Erro ao registrar falha no log:", logErr);
    }

    return NextResponse.json(
      {
        success: false,
        status: "FATAL_ERROR",
        executionId,
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

  const targetEmail = "cristiano.santos@coffeemais.com";

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
      to: targetEmail,
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
