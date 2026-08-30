import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { CommercialDomainService } from "@/lib/domain";
import { resolveCanonicalManager, isSameManager } from "@/lib/domain/canonical";
import { assertCronAccess } from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CC_ALWAYS = ["trade@coffeemais.com", "cristiano.santos@coffeemais.com"];
const OFFICIAL_MANAGERS = CommercialDomainService.getFieldManagerList()
  .map(m => resolveCanonicalManager(m).managerName)
  .filter((v, i, a) => a.indexOf(v) === i);

function getBrazilTimeParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const year = parseInt(parts.find((p) => p.type === "year")!.value);
  const month = parseInt(parts.find((p) => p.type === "month")!.value);
  const day = parseInt(parts.find((p) => p.type === "day")!.value);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  return { year, month, day, hour, minute };
}

export async function GET(request: Request) {
  try {
    // 1. Validação Obrigatória de Cron (Fail-Closed)
    const cronCheck = await assertCronAccess(request);
    if (!cronCheck.authorized) {
      return cronCheck.errorResponse!;
    }

    // 2. Validar credenciais SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { success: false, error: "SMTP_USER ou SMTP_PASS não configurados" },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 3. Obter dados de hoje e segunda-feira da semana atual no fuso de Brasília
    const { year, month, day } = getBrazilTimeParts();
    const todayDate = new Date(year, month - 1, day);
    const dayOfWeek = todayDate.getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sab
    
    // Calcula a data da segunda-feira correspondente à semana atual
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayDate = new Date(todayDate);
    mondayDate.setDate(todayDate.getDate() + diffToMonday);

    const mondayYear = mondayDate.getFullYear();
    const mondayMonth = mondayDate.getMonth() + 1;
    const mondayDay = mondayDate.getDate();
    const currentMondayStr = `${mondayYear}-${String(mondayMonth).padStart(2, '0')}-${String(mondayDay).padStart(2, '0')}`;

    // Calcular o início da janela de verificação: Domingo 00:00:00 BRT imediatamente anterior à segunda-feira
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() - 1);
    const sunYear = sundayDate.getFullYear();
    const sunMonth = sundayDate.getMonth() + 1;
    const sunDay = sundayDate.getDate();

    // Domingo 00:00:00 BRT = 03:00 UTC do Domingo
    const windowStartBRT = new Date(Date.UTC(sunYear, sunMonth - 1, sunDay, 3, 0, 0));
    // Segunda-feira 14:00:00 BRT = 17:00 UTC da Segunda-feira
    const windowEndBRT = new Date(Date.UTC(mondayYear, mondayMonth - 1, mondayDay, 17, 0, 0));

    // 4. Buscar e mapear os e-mails dos gerentes regionais (com resolução canônica de nomes)
    const { data: perfis, error: perfisError } = await supabase
      .from("cm_user_profiles")
      .select("manager_name, name, id")
      .eq("role", "Gerente Regional")
      .eq("approved", true);

    if (perfisError) throw perfisError;

    const gerenteEmailMap: Record<string, string> = {};
    if (perfis && perfis.length > 0) {
      for (const p of perfis) {
        const { data: userData } = await supabase.auth.admin.getUserById(p.id);
        const userEmail = userData?.user?.email;
        if (userEmail) {
          if (p.manager_name) {
            gerenteEmailMap[p.manager_name] = userEmail;
            const canonMgr = resolveCanonicalManager(p.manager_name).managerName;
            if (canonMgr) gerenteEmailMap[canonMgr] = userEmail;
          }
          if (p.name) {
            gerenteEmailMap[p.name] = userEmail;
            const canonName = resolveCanonicalManager(p.name).managerName;
            if (canonName) gerenteEmailMap[canonName] = userEmail;
          }
        }
      }
    }

    // 5. Verificar no banco quem salvou PROJEÇÕES comerciais completas (FAT + VOL + INVEST)
    // na linha consolidada _TOTAL_ para a semana corrente dentro da janela aberta (Domingo 00:00 BRT a Segunda 14:00 BRT)
    const { data: projections, error: projError } = await supabase
      .from("cm_weekly_projections")
      .select("manager, kpi, updated_at")
      .eq("week_start_date", currentMondayStr)
      .eq("client_matrix", "_TOTAL_")
      .in("kpi", ["VOL", "FAT", "INVEST"])
      .gte("updated_at", windowStartBRT.toISOString())
      .lte("updated_at", windowEndBRT.toISOString());

    if (projError) throw projError;

    // Mapear os KPIs atualizados por gerente canônico na janela oficial no _TOTAL_
    const managerKpiMap: Record<string, Set<string>> = {};
    (projections || []).forEach((p) => {
      const canonManager = resolveCanonicalManager(p.manager).managerName || p.manager;
      if (!managerKpiMap[canonManager]) {
        managerKpiMap[canonManager] = new Set();
      }
      managerKpiMap[canonManager].add(p.kpi);

      // Também manter sob a chave original para retrocompatibilidade
      if (p.manager && !managerKpiMap[p.manager]) {
        managerKpiMap[p.manager] = managerKpiMap[canonManager];
      }
    });

    // Um gerente só é considerado PREENCHIDO se possuir os 3 KPIs (FAT, VOL e INVEST) no _TOTAL_
    const updatedManagers = OFFICIAL_MANAGERS.filter((m) => {
      const canonM = resolveCanonicalManager(m).managerName || m;
      const kpis = managerKpiMap[canonM] || managerKpiMap[m];
      return kpis && kpis.has("FAT") && kpis.has("VOL") && kpis.has("INVEST");
    });

    // Filtrar gerentes pendentes (aqueles que não possuem o trio completo FAT + VOL + INVEST)
    const pendingManagers = OFFICIAL_MANAGERS.filter(
      (m) => !updatedManagers.some(um => isSameManager(um, m) || um === m)
    );

    if (pendingManagers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Todos os gerentes preencheram as projeções desta semana.",
        updatedManagers,
        pendingManagers: [],
        sentEmails: 0,
      });
    }

    // 6. Configurar SMTP Transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const sentEmailsList: string[] = [];

    // URL do app para redirecionar o usuário
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mais.coffeemais.com";

    // 7. Enviar e-mails para cada gerente pendente com controle de idempotência
    for (const managerName of pendingManagers) {
      const emailDest = gerenteEmailMap[managerName];
      if (!emailDest) {
        console.warn(`[rps-alert] Sem e-mail mapeado para o gerente: ${managerName}`);
        continue;
      }

      // Idempotência: verificar se o alerta já foi disparado nesta semana para este gerente
      const alertKey = `RPS_ALERT|${managerName}|${currentMondayStr}`;
      const { data: existingLog } = await supabase
        .from("cm_audit_logs")
        .select("id")
        .eq("action", "INSERT")
        .eq("table_name", alertKey)
        .limit(1);

      if (existingLog && existingLog.length > 0) {
        console.log(`[rps-alert] Alerta já enviado para ${managerName} na semana ${currentMondayStr}. Ignorando duplicata.`);
        continue;
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Coffee++ | Lembrete RPS</title>
        </head>
        <body style="font-family: 'Segoe UI', Inter, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 0;-webkit-font-smoothing: antialiased;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e8e2da;">
            
            <!-- Header premium marrom e ouro -->
            <div style="background: linear-gradient(135deg, #3e2723, #1b0000); padding: 32px; border-bottom: 4px solid #c8a96e; text-align: center;">
              <h2 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: 1px;">COFFEE++ MAIS</h2>
              <p style="margin: 6px 0 0; color: #c8a96e; font-size: 14px; text-transform: uppercase; font-weight: 600; letter-spacing: 2px;">Apuração de Resultados Semanal</p>
            </div>
            
            <!-- Conteúdo -->
            <div style="padding: 40px 32px; color: #3e2723;">
              <h3 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #3e2723;">Olá, Regional ${managerName},</h3>
              
              <p style="font-size: 15px; line-height: 1.6; color: #5d4037; margin-bottom: 24px;">
                Identificamos que as suas <strong>Projeções Semanais (RPS)</strong> referente à semana de <strong>${mondayDay}/${String(mondayMonth).padStart(2, '0')}/${mondayYear}</strong> ainda não foram salvas no portal.
              </p>
              
              <div style="background-color: #fdfbf7; border-left: 4px solid #c8a96e; padding: 16px 20px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #5d4037; font-weight: 500;">
                  ⚠️ <strong>Atenção:</strong> O prazo limite para envio das projeções encerra-se impreterivelmente às <strong>15:00 de hoje</strong> (horário de Brasília). Pedimos que acesse o portal e finalize o lançamento das suas informações de Volume, Faturamento e Investimento.
                </p>
              </div>
              
              <!-- Botão centralizado -->
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="${appUrl}/processo-comercial/rps" style="display: inline-block; padding: 14px 36px; background: linear-gradient(to right, #c8a96e, #a0844f); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 10px rgba(200, 169, 110, 0.3); transition: all 0.2s ease-in-out;">
                  Lançar Projeções
                </a>
              </div>
            </div>
            
            <!-- Rodapé -->
            <div style="background-color: #fcfbf9; padding: 24px 32px; text-align: center; border-top: 1px solid #f0eae1;">
              <p style="margin: 0; font-size: 12px; color: #8d6e63; line-height: 1.5;">
                Este e-mail é gerado automaticamente pelo Hub de Importação Coffee++.<br>
                Por favor, não responda a esta mensagem diretamente.
              </p>
            </div>
            
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"Coffee++ Hub" <${process.env.SMTP_USER}>`,
        to: emailDest,
        cc: CC_ALWAYS,
        subject: `[Coffee++] Lembrete: Projeções RPS Pendentes (${mondayDay}/${String(mondayMonth).padStart(2, '0')})`,
        html: emailHtml,
      });

      // Gravar log de idempotência corporativo em cm_audit_logs
      await supabase.from("cm_audit_logs").insert({
        user_id: null,
        action: "INSERT",
        table_name: alertKey
      });

      sentEmailsList.push(emailDest);
    }

    return NextResponse.json({
      success: true,
      message: "Envio de e-mails de alerta processado.",
      updatedManagers,
      pendingManagers,
      sentEmails: sentEmailsList.length,
      recipients: sentEmailsList,
    });
  } catch (error: any) {
    console.error("[rps-alert error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
