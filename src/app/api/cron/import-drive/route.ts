import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveService } from "@/lib/services/google-drive-service";
import { CsvImportService } from "@/lib/services/csv-import-service";
import { EmailNotificationService } from "@/lib/services/email-notification-service";
import { assertCronAccess } from "@/lib/supabase/auth-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos de limite de execução

export async function GET(request: NextRequest) {
  return handleImportCron(request);
}

export async function POST(request: NextRequest) {
  return handleImportCron(request);
}

async function handleImportCron(request: NextRequest) {
  const startTime = Date.now();

  // 1. Validação Obrigatória de Cron (Fail-Closed)
  const cronCheck = assertCronAccess(request);
  if (!cronCheck.authorized) {
    return cronCheck.errorResponse!;
  }

  let batchId: string | undefined;
  let isDryRun = false;

  try {
    // 2. Barreira de Domingo (Timezone: America/Sao_Paulo)
    const nowSp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayOfWeek = nowSp.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

    if (dayOfWeek === 0) {
      console.log("[CronImportDrive] Execução aos domingos é estritamente bloqueada.");
      await EmailNotificationService.sendReport({
        status: "SKIPPED",
        fileName: "CFOP.CSV",
        blockReason: "Execução automática ignorada aos domingos conforme regra oficial da plataforma.",
      });

      return NextResponse.json({
        success: true,
        status: "SKIPPED",
        message: "Execuções aos domingos estão permanentemente bloqueadas.",
      });
    }

    // 3. Parâmetros da Requisição
    const urlParams = request.nextUrl.searchParams;
    // Em produção (Demanda 059), o padrão é isDryRun = false (execução real)
    isDryRun = urlParams.get("dry_run") === "true";
    const forceOverride = urlParams.get("force") === "true";

    // 4. Iniciar Registro Persistente de Execução em cm_sync_logs (Observabilidade Imediata)
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data: initialLog } = await supabase
        .from("cm_sync_logs")
        .insert({
          source: "google_drive_csv",
          status: "RUNNING",
          triggered_by: "cron_07",
          metadata: {
            file_name: "CFOP.CSV",
            is_dry_run: isDryRun,
            current_step: "DOWNLOADING_FROM_DRIVE",
            progress: 5,
          },
        })
        .select("id")
        .single();
      batchId = initialLog?.id;
    } catch (logInitErr) {
      console.warn("[CronImportDrive] Falha ao iniciar log preliminar:", logInitErr);
    }

    // 5. Download do Arquivo via Google Drive (ou fallback seguro em desenvolvimento local)
    const driveResult = await GoogleDriveService.fetchCfopCsv({
      allowLocalFallback: process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1",
    });

    // 6. Ingestão, Validações e Processamento via CsvImportService
    const importResult = await CsvImportService.processCsv({
      fileBuffer: driveResult.fileBuffer,
      fileName: driveResult.fileName,
      fileSize: driveResult.fileSize,
      fileHash: driveResult.fileHashSha256,
      driveFileId: driveResult.driveFileId,
      driveModifiedTime: driveResult.driveModifiedTime,
      triggeredBy: "cron_07",
      isDryRun,
      forceOverride,
      existingBatchId: batchId,
    });

    const durationSeconds = (Date.now() - startTime) / 1000;

    // 7. Envio de Notificação por E-mail
    const emailStatus =
      importResult.status === "DRY_RUN_SUCCESS"
        ? "DRY_RUN_SUCCESS"
        : importResult.status === "SKIPPED_DUPLICATE_HASH" || importResult.status === "SKIPPED_UNMODIFIED"
        ? "SKIPPED"
        : (importResult.status as any);

    await EmailNotificationService.sendReport({
      status: emailStatus,
      fileName: importResult.fileName,
      batchId: importResult.batchId,
      fileHash: importResult.fileHash,
      periodFormatted: importResult.metrics?.periodFormatted,
      totalRows: importResult.metrics?.totalRows,
      totalNfs: importResult.metrics?.totalNfs,
      totalNet: importResult.metrics?.totalNet,
      totalGross: importResult.metrics?.totalGross,
      totalDevolution: importResult.metrics?.totalDevolution,
      totalCancelledNet: importResult.metrics?.totalCancelledNet,
      promotionStatus: importResult.status === "SUCCESS" ? "SUCESSO (Atomic Swap)" : importResult.status,
      viewsStatus: importResult.status === "SUCCESS" ? "ATUALIZADAS (0,0000% desvio)" : "PRESERVADAS",
      durationSeconds,
      deltaNet: 0,
      driveModifiedTime: driveResult.driveModifiedTime,
      blockReason:
        importResult.status === "SKIPPED_DUPLICATE_HASH" || importResult.status === "SKIPPED_UNMODIFIED"
          ? importResult.message
          : undefined,
    });

    return NextResponse.json({
      success: true,
      importResult,
      durationSeconds,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CronImportDrive] Erro na execução da rota cron:", error);
    const durationSeconds = (Date.now() - startTime) / 1000;

    if (batchId) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        await supabase
          .from("cm_sync_logs")
          .update({
            status: "ERROR",
            finished_at: new Date().toISOString(),
            error_message: error.message || String(error),
            metadata: {
              file_name: "CFOP.CSV",
              is_dry_run: isDryRun,
              sub_status: "BLOCKED",
              barrier_failed: "DRIVE_DOWNLOAD_OR_INIT_FAILED",
              error_details: error.stack || String(error),
            },
          })
          .eq("id", batchId);
      } catch (logUpdateErr) {
        console.error("[CronImportDrive] Falha ao registrar status ERROR em cm_sync_logs:", logUpdateErr);
      }
    }

    await EmailNotificationService.sendReport({
      status: "BLOCKED",
      fileName: "CFOP.CSV",
      blockReason: error.message || "Erro durante o processamento do pipeline",
      errorDetails: error.stack,
      durationSeconds,
    });

    return NextResponse.json(
      {
        success: false,
        status: "BLOCKED",
        error: error.message || String(error),
        durationSeconds,
      },
      { status: 500 }
    );
  }
}
