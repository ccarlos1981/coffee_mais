import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExecutiveReportCollector, ExecutiveReportData } from "./executive-report-collector";
import { ExecutivePdfBuilder } from "./executive-pdf-builder";
import { ExecutiveAiAnalyst } from "./executive-ai-analyst";

export interface ExecutiveReportRecipient {
  email: string;
  name: string;
  role: "GLOBAL" | "GERENTE";
  managerFilter?: "Leandro" | "Luiz" | "Julliano" | "John Guedes";
}

export interface DispatchDetail {
  recipient: string;
  name: string;
  role: "GLOBAL" | "GERENTE";
  managerFilter?: string;
  pdfType: "GLOBAL" | "GERENTE";
  pdfFileName: string;
  pdfSizeKb: number;
  status: "SENT" | "FAILED" | "SIMULATED";
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface DispatchResult {
  success: boolean;
  status: "EXECUTED_SUCCESSFULLY" | "PARTIAL_FAILURE" | "FATAL_ERROR";
  reportDateIso: string;
  executionId: string;
  totalExpected: number;
  totalSent: number;
  totalFailed: number;
  details: DispatchDetail[];
  errorMessage?: string;
  durationSeconds: number;
}

export interface LockAcquisitionResult {
  acquired: boolean;
  reason: "LOCK_ACQUIRED" | "FORCE_ACQUIRED" | "RECOVERY_ACQUIRED" | "SKIPPED_ALREADY_SENT" | "SKIPPED_ALREADY_RUNNING";
  currentStatus: string;
  startedAt: string;
}

/**
 * Matriz Homologada Oficial de Distribuição dos 7 Destinatários
 */
export const HOMOLOGATED_EXECUTIVE_RECIPIENTS: readonly ExecutiveReportRecipient[] = [
  // ─── GRUPO GLOBAL (3) — Página 5: Top 20 Geral ───────────────────────────
  {
    email: "cristiano.santos@coffeemais.com",
    name: "Cristiano Santos",
    role: "GLOBAL",
  },
  {
    email: "renata.naciff@coffeemais.com",
    name: "Renata Naciff",
    role: "GLOBAL",
  },
  {
    email: "trade@coffeemais.com",
    name: "Trade Marketing",
    role: "GLOBAL",
  },

  // ─── GRUPO GERENTES (4) — Página 5: Personalizada por Gerente ─────────────
  {
    email: "leandro.saffi@coffeemais.com",
    name: "Leandro Saffi",
    role: "GERENTE",
    managerFilter: "Leandro",
  },
  {
    email: "luiz@coffeemais.com",
    name: "Luiz",
    role: "GERENTE",
    managerFilter: "Luiz",
  },
  {
    email: "julliano@coffeemais.com",
    name: "Julliano",
    role: "GERENTE",
    managerFilter: "Julliano",
  },
  {
    email: "john.guedes@coffeemais.com",
    name: "John Guedes",
    role: "GERENTE",
    managerFilter: "John Guedes",
  },
] as const;

export class ExecutiveReportDispatcher {
  /**
   * Helper para auditoria de quantidade de páginas A4 no buffer PDF
   */
  static countPdfPages(buffer: Buffer): number {
    if (!buffer || buffer.length === 0) return 0;
    const str = buffer.toString("binary");
    const matches = str.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : 0;
  }

  /**
   * Validação Estrita Pré-Envio:
   * Garante normalização, ausência de duplicidades e que a lista contenha EXATAMENTE 7 destinatários distintos.
   */
  static validateRecipients(recipients: readonly ExecutiveReportRecipient[]): ExecutiveReportRecipient[] {
    const normalized: ExecutiveReportRecipient[] = [];
    const seenEmails = new Set<string>();

    for (const r of recipients) {
      const cleanEmail = r.email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        throw new Error(`Configuração inválida de destinatário: e-mail inválido "${r.email}".`);
      }
      if (seenEmails.has(cleanEmail)) {
        throw new Error(`Duplicidade detectada na lista de destinatários: "${cleanEmail}" aparece mais de uma vez.`);
      }
      seenEmails.add(cleanEmail);
      normalized.push({
        ...r,
        email: cleanEmail,
      });
    }

    if (normalized.length !== 7) {
      throw new Error(
        `Barreira de Distribuição Violada: A lista de destinatários deve conter EXATAMENTE 7 e-mails homologados (detectados ${normalized.length}). Envio abortado antes do primeiro disparo.`
      );
    }

    return normalized;
  }

  /**
   * Aquisição Atômica de Lock de Execução no Banco de Dados
   */
  static async acquireLock(
    reportDateIso: string,
    executionId: string,
    force = false,
    lockTimeoutMinutes = 15
  ): Promise<LockAcquisitionResult> {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("fn_acquire_executive_report_lock", {
      p_report_date: reportDateIso,
      p_execution_id: executionId,
      p_force: force,
      p_lock_timeout_minutes: lockTimeoutMinutes,
    });

    if (error) {
      throw new Error(`Falha ao adquirir lock de idempotência no banco: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error("Retorno inesperado da função de lock de idempotência.");
    }

    return {
      acquired: Boolean(row.acquired),
      reason: row.reason,
      currentStatus: row.current_status || row.currentStatus || "UNKNOWN",
      startedAt: row.started_at || row.startedAt || new Date().toISOString(),
    };
  }

  /**
   * Atualização do Status Final da Execução no Banco de Dados
   */
  static async completeReport(
    reportDateIso: string,
    executionId: string,
    status: "SUCCESS" | "FAILED",
    totalSent: number,
    totalFailed: number,
    details: DispatchDetail[],
    errorMessage?: string
  ): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase.rpc("fn_complete_executive_report_log", {
      p_report_date: reportDateIso,
      p_execution_id: executionId,
      p_status: status,
      p_total_sent: totalSent,
      p_total_failed: totalFailed,
      p_details: details,
      p_error_message: errorMessage || null,
    });

    if (error) {
      console.error("[ExecutiveReportDispatcher] Erro ao finalizar log no banco:", error.message);
    }
  }

  /**
   * Pipeline Completo de Geração e Disparo Homologado dos 7 Relatórios
   * Incorpora Barreira Absoluta Pré-Envio (Validações 100% concluídas antes do primeiro sendMail)
   */
  static async dispatchHomologatedReports(options: {
    reportData: ExecutiveReportData;
    executionId: string;
    dryRun?: boolean;
    customTransporter?: any;
  }): Promise<DispatchResult> {
    const startTime = Date.now();
    const { reportData, executionId, dryRun = false, customTransporter } = options;
    const reportDateIso = reportData.dataReferenciaIso;

    // 1. Barreira Pré-Envio: Validação Absoluta dos 7 Destinatários
    const recipients = this.validateRecipients(HOMOLOGATED_EXECUTIVE_RECIPIENTS);

    // 2. Barreira Pré-Envio: Compilação Otimizada dos 5 PDFs
    console.log("[ExecutiveReportDispatcher] Construindo PDF Global (Páginas 1 a 5 Top 20 Global)...");
    const pdfBufferGlobal = await ExecutivePdfBuilder.buildPdfBuffer(reportData);
    const pdfSizeKbGlobal = Number((pdfBufferGlobal.length / 1024).toFixed(1));

    const pagesGlobal = this.countPdfPages(pdfBufferGlobal);
    if (pagesGlobal !== 5) {
      const errMsg = `Barreira Pré-Envio Violada: PDF Global possui ${pagesGlobal} páginas em vez de 5. Nenhum e-mail foi disparado.`;
      await this.completeReport(reportDateIso, executionId, "FAILED", 0, 7, [], errMsg);
      throw new Error(errMsg);
    }

    const managerPdfCache: Record<string, { buffer: Buffer; sizeKb: number }> = {};
    const managers = ["Leandro", "Luiz", "Julliano", "John Guedes"] as const;

    for (const mgr of managers) {
      console.log(`[ExecutiveReportDispatcher] Construindo PDF Personalizado para ${mgr}...`);
      const managerReportData = await ExecutiveReportCollector.collect(undefined, mgr);
      const managerBuffer = await ExecutivePdfBuilder.buildPdfBuffer(managerReportData);
      const pagesMgr = this.countPdfPages(managerBuffer);

      if (pagesMgr !== 5) {
        const errMsg = `Barreira Pré-Envio Violada: PDF do gerente ${mgr} possui ${pagesMgr} páginas em vez de 5. Nenhum e-mail foi disparado.`;
        await this.completeReport(reportDateIso, executionId, "FAILED", 0, 7, [], errMsg);
        throw new Error(errMsg);
      }

      managerPdfCache[mgr] = {
        buffer: managerBuffer,
        sizeKb: Number((managerBuffer.length / 1024).toFixed(1)),
      };
    }

    // 3. Barreira Pré-Envio: Validar que todos os 7 destinatários possuem PDF válido associado
    for (const rc of recipients) {
      const isGlobal = rc.role === "GLOBAL";
      const buffer = isGlobal ? pdfBufferGlobal : managerPdfCache[rc.managerFilter!]?.buffer;
      if (!buffer || buffer.length === 0) {
        const errMsg = `Barreira Pré-Envio Violada: Destinatário ${rc.email} não possui buffer PDF gerado. Nenhum e-mail foi disparado.`;
        await this.completeReport(reportDateIso, executionId, "FAILED", 0, 7, [], errMsg);
        throw new Error(errMsg);
      }
    }

    // 4. Configuração do Transporter SMTP
    let transporter: any = customTransporter;
    const hasSmtpCredentials = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (!transporter && !dryRun && hasSmtpCredentials) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "465", 10),
        secure: (process.env.SMTP_PORT || "465") === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
      });
    }

    // 5. Execução dos 7 Disparos Rastreáveis
    const details: DispatchDetail[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    const emailSubject = `☕ Coffee++ | Relatório Executivo Diário | ${reportData.dataReferencia}`;
    const dateFormatted = reportData.dataReferencia.replace(/\//g, "-");

    for (const rc of recipients) {
      const isGlobal = rc.role === "GLOBAL";
      const pdfFileName = isGlobal
        ? `Relatorio_Executivo_Coffee++_GLOBAL_${dateFormatted}.pdf`
        : `Relatorio_Executivo_Coffee++_${rc.managerFilter?.toUpperCase()}_${dateFormatted}.pdf`;

      const pdfBuffer = isGlobal
        ? pdfBufferGlobal
        : managerPdfCache[rc.managerFilter!]?.buffer || pdfBufferGlobal;
      const pdfSizeKb = isGlobal
        ? pdfSizeKbGlobal
        : managerPdfCache[rc.managerFilter!]?.sizeKb || pdfSizeKbGlobal;

      const emailHtml = ExecutiveAiAnalyst.generateInstitutionalEmail(reportData);

      const detail: DispatchDetail = {
        recipient: rc.email,
        name: rc.name,
        role: rc.role,
        managerFilter: rc.managerFilter,
        pdfType: isGlobal ? "GLOBAL" : "GERENTE",
        pdfFileName,
        pdfSizeKb,
        status: "SIMULATED",
        timestamp: new Date().toISOString(),
      };

      try {
        if (dryRun || !hasSmtpCredentials) {
          detail.status = "SIMULATED";
          detail.messageId = `SIMULATED_DISPATCH_${rc.email}_${Date.now()}`;
          totalSent++;
          console.log(`[ExecutiveReportDispatcher] [SIMULADO] E-mail ${rc.role} preparado para ${rc.email}`);
        } else {
          const info = await transporter.sendMail({
            from: `"Coffee++ Gestão Executiva" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: rc.email,
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

          detail.status = "SENT";
          detail.messageId = info.messageId;
          totalSent++;
          console.log(`[ExecutiveReportDispatcher] [ENVIADO] E-mail transmitido para ${rc.email} (ID: ${info.messageId})`);
        }
      } catch (err: any) {
        detail.status = "FAILED";
        detail.error = err.message || String(err);
        totalFailed++;
        console.error(`[ExecutiveReportDispatcher] [FALHA] Erro no envio para ${rc.email}:`, err.message);
      }

      details.push(detail);
    }

    const durationSeconds = (Date.now() - startTime) / 1000;
    const finalStatus = totalFailed === 0 ? "SUCCESS" : "FAILED";

    // 6. Persistência do Log Final no Banco de Dados
    await this.completeReport(
      reportDateIso,
      executionId,
      finalStatus,
      totalSent,
      totalFailed,
      details,
      totalFailed > 0 ? `${totalFailed} dos 7 envios falharam.` : undefined
    );

    return {
      success: totalFailed === 0,
      status: totalFailed === 0 ? "EXECUTED_SUCCESSFULLY" : "PARTIAL_FAILURE",
      reportDateIso,
      executionId,
      totalExpected: 7,
      totalSent,
      totalFailed,
      details,
      durationSeconds,
    };
  }
}
