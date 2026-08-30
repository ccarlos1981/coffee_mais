import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { resolveCanonicalManager, isSameManager } from "@/lib/domain/canonical";
import { assertCronAccess } from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";

// ─── env ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CC_ALWAYS = ["trade@coffeemais.com", "cristiano.santos@coffeemais.com"];

// ─── helpers ─────────────────────────────────────────────────────────────────
function dateBr(iso: string) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface InvestmentPeriod {
  start_date: string;
  end_date: string;
}

function calcularStatusItemInvestimento(
  item: any,
  fase_atual: number,
  apuracao_preenchida_em?: string | null
): "AGENDADA" | "EM_ANDAMENTO" | "ENCERRADA" | "ATRASADA" {
  if ((fase_atual || 1) >= 4 || !!apuracao_preenchida_em) {
    return "ENCERRADA";
  }

  let periods: InvestmentPeriod[] = [];
  if (item.periods && Array.isArray(item.periods)) {
    periods = item.periods;
  } else if (item.start_date && item.end_date) {
    periods = [{ start_date: item.start_date, end_date: item.end_date }];
  }

  if (periods.length === 0) {
    return "AGENDADA";
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  let isAtrasada = false;
  let isEmAndamento = false;

  for (const p of periods) {
    if (!p.start_date || !p.end_date) continue;
    if (todayStr > p.end_date) {
      isAtrasada = true;
    } else if (todayStr >= p.start_date && todayStr <= p.end_date) {
      isEmAndamento = true;
    }
  }

  if (isAtrasada) return "ATRASADA";
  if (isEmAndamento) return "EM_ANDAMENTO";
  return "AGENDADA";
}

interface NotificationItem {
  acao_id: string;
  codigo: number;
  rede: string;
  gerente: string;
  item_type: 'familia' | 'sku';
  item_key: string;
  item_name: string;
  start_date: string;
  end_date: string;
}

// ─── handler ─────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    // Validação Obrigatória de Cron (Fail-Closed)
    const cronCheck = await assertCronAccess(request);
    if (!cronCheck.authorized) {
      return cronCheck.errorResponse!;
    }

    // Validar SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { success: false, error: "SMTP_USER ou SMTP_PASS não configurados" },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 1. Buscar todas as ações ativas pendentes de apuração
    const { data: acoes, error: acoesError } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select(
        "id, codigo, rede, tipo_acao, data_inicio, data_fim, fase_atual, gerente_responsavel, date_mode, familias_detalhes, skus_detalhes, familia_produto, apuracao_preenchida_em"
      )
      .in("fase_atual", [1, 2, 3])
      .eq("is_planejamento", false)
      .is("apuracao_preenchida_em", null);

    if (acoesError) throw acoesError;

    if (!acoes || acoes.length === 0) {
      console.log("[acoes-atrasadas] Nenhuma ação ativa e pendente de apuração encontrada.");
      return NextResponse.json({
        success: true,
        message: "Nenhuma ação ativa e pendente encontrada.",
        enviados: 0,
      });
    }

    // 2. Buscar registros do email tracking para evitar envios duplicados
    const { data: trackingRows, error: trackingError } = await supabase
      .from("cm_acoes_email_tracking")
      .select("acao_id, item_type, item_key, alert_type");

    if (trackingError) throw trackingError;

    const trackingSet = new Set(
      (trackingRows || []).map(
        (r) => `${r.acao_id}|${r.item_type}|${r.item_key}|${r.alert_type}`
      )
    );

    // 3. Montar lista unificada de itens para verificação
    const notificationItems: NotificationItem[] = [];
    for (const action of acoes) {
      const gerente = action.gerente_responsavel || "Sem Gerente";

      const hasFam = action.familias_detalhes && action.familias_detalhes.length > 0;
      const hasSku = action.skus_detalhes && action.skus_detalhes.length > 0;

      if (hasFam) {
        action.familias_detalhes.forEach((f: any) => {
          notificationItems.push({
            acao_id: action.id,
            codigo: action.codigo,
            rede: action.rede,
            gerente,
            item_type: 'familia',
            item_key: f.familia_nome,
            item_name: `Família: ${f.familia_nome}`,
            start_date: f.start_date || action.data_inicio,
            end_date: f.end_date || action.data_fim,
          });
        });
      }

      if (hasSku) {
        action.skus_detalhes.forEach((s: any) => {
          notificationItems.push({
            acao_id: action.id,
            codigo: action.codigo,
            rede: action.rede,
            gerente,
            item_type: 'sku',
            item_key: s.sku,
            item_name: `SKU: ${s.sku}`,
            start_date: s.start_date || action.data_inicio,
            end_date: s.end_date || action.data_fim,
          });
        });
      }

      if (!hasFam && !hasSku) {
        notificationItems.push({
          acao_id: action.id,
          codigo: action.codigo,
          rede: action.rede,
          gerente,
          item_type: 'familia',
          item_key: action.familia_produto || 'Geral',
          item_name: action.familia_produto || 'Ação Geral',
          start_date: action.data_inicio,
          end_date: action.data_fim,
        });
      }
    }

    // 4. Buscar e mapear os e-mails dos gerentes (com resolução canônica de nomes)
    const { data: perfis, error: perfisError } = await supabase
      .from("cm_user_profiles")
      .select("manager_name, name, id")
      .eq("role", "Gerente Regional");

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

    // 5. Agrupar alertas e lembretes por gerente canônico
    const porGerente: Record<
      string,
      {
        email: string;
        reminders: NotificationItem[];
        overdues: NotificationItem[];
      }
    > = {};

    const todayMs = hoje.getTime();

    for (const item of notificationItems) {
      const canonGerente = resolveCanonicalManager(item.gerente).managerName || item.gerente;
      const email = gerenteEmailMap[canonGerente] || gerenteEmailMap[item.gerente];
      if (!email) {
        console.warn(`[acoes-atrasadas] Sem email mapeado para o gerente: ${item.gerente} (canônico: ${canonGerente})`);
        continue;
      }

      if (!porGerente[canonGerente]) {
        porGerente[canonGerente] = { email, reminders: [], overdues: [] };
      }

      // Lembrete de início: hoje <= start_date <= hoje + 2d
      if (item.start_date) {
        const startMs = new Date(item.start_date + "T00:00:00").getTime();
        const diffDays = Math.floor((startMs - todayMs) / 86_400_000);
        const shouldRemind = diffDays >= 0 && diffDays <= 2;
        const reminderKey = `${item.acao_id}|${item.item_type}|${item.item_key}|start_reminder`;

        if (shouldRemind && !trackingSet.has(reminderKey)) {
          porGerente[canonGerente].reminders.push(item);
        }
      }

      // Alerta de atraso: hoje > end_date
      if (item.end_date) {
        const endMs = new Date(item.end_date + "T00:00:00").getTime();
        const isOverdue = todayMs > endMs;
        const overdueKey = `${item.acao_id}|${item.item_type}|${item.item_key}|overdue_alert`;

        if (isOverdue && !trackingSet.has(overdueKey)) {
          porGerente[canonGerente].overdues.push(item);
        }
      }
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

    const resultados: Array<{ gerente: string; email: string; remindersCount: number; overduesCount: number; status: string }> = [];
    const trackingToInsert: Array<{ acao_id: string; item_type: string; item_key: string; alert_type: string }> = [];

    // 7. Enviar e-mails consolidados
    for (const [gerente, dados] of Object.entries(porGerente)) {
      if (dados.reminders.length === 0 && dados.overdues.length === 0) continue;

      let emailHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0;">
          <div style="max-width: 680px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 24px 32px;">
              <h1 style="margin: 0; color: #fff; font-size: 22px; font-weight: 700;">Coffee++ Mais</h1>
              <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Gestão de Investimentos — Alertas de Datas</p>
            </div>
            
            <div style="padding: 24px 32px 0;">
              <p style="font-size: 15px; color: #374151;">Olá, Regional <strong>${gerente}</strong>,</p>
              <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Seguem as atualizações e alertas sobre prazos de ações e apurações sob sua gestão:</p>
      `;

      if (dados.reminders.length > 0) {
        const rows = dados.reminders.map(item => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">#${item.codigo}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">${item.rede}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">${item.item_name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #2563eb; font-weight: 600;">Início: ${dateBr(item.start_date)}</td>
          </tr>
        `).join("");

        emailHtml += `
          <div style="margin-top: 24px; border: 1px solid #bfdbfe; border-radius: 8px; overflow: hidden;">
            <div style="background: #eff6ff; padding: 12px 16px; border-bottom: 1px solid #bfdbfe;">
              <h3 style="margin: 0; color: #1e40af; font-size: 14px;">📅 Lembrete de Início (Próximos 2 dias)</h3>
            </div>
            <div style="padding: 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background: #f8fafc;">
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Cód.</th>
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Rede</th>
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Item / Família</th>
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Previsão</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      if (dados.overdues.length > 0) {
        const rows = dados.overdues.map(item => {
          const dias = Math.floor((hoje.getTime() - new Date(item.end_date + "T00:00:00").getTime()) / 86_400_000);
          return `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">#${item.codigo}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">${item.rede}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">${item.item_name}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">Fim: ${dateBr(item.end_date)}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #dc2626; font-weight: 600;">${dias} dia${dias > 1 ? "s" : ""} de atraso</td>
            </tr>
          `;
        }).join("");

        emailHtml += `
          <div style="margin-top: 24px; border: 1px solid #fca5a5; border-radius: 8px; overflow: hidden;">
            <div style="background: #fef2f2; padding: 12px 16px; border-bottom: 1px solid #fca5a5;">
              <h3 style="margin: 0; color: #991b1b; font-size: 14px;">⚠️ Alerta: Apurações em Atraso (Sem Apuração preenchida)</h3>
            </div>
            <div style="padding: 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background: #f8fafc;">
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Cód.</th>
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Rede</th>
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Item / Família</th>
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Fim do Período</th>
                    <th style="padding: 6px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      emailHtml += `
            </div>
            <!-- CTA -->
            <div style="padding: 24px 32px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://coffeemais.vercel.app"}/investimento" style="display: inline-block; background: #d97706; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Acessar Painel de Investimentos →</a>
            </div>
            <!-- Footer -->
            <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">Este e-mail é gerado automaticamente todos os dias. Por favor, regularize suas apurações pendentes no sistema.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const subject = dados.overdues.length > 0 
          ? `⚠️ Prazos de Investimentos em Atraso — ${gerente}` 
          : `📅 Lembrete: Novos Investimentos Iniciando — ${gerente}`;

        await transporter.sendMail({
          from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
          to: dados.email,
          cc: CC_ALWAYS.join(", "),
          subject,
          html: emailHtml,
        });

        console.log(`[acoes-atrasadas] Email enviado para ${gerente} (${dados.email})`);
        resultados.push({ 
          gerente, 
          email: dados.email, 
          remindersCount: dados.reminders.length, 
          overduesCount: dados.overdues.length, 
          status: "enviado" 
        });

        // Gravar no log de controle
        dados.reminders.forEach(item => {
          trackingToInsert.push({
            acao_id: item.acao_id,
            item_type: item.item_type,
            item_key: item.item_key,
            alert_type: "start_reminder"
          });
        });
        dados.overdues.forEach(item => {
          trackingToInsert.push({
            acao_id: item.acao_id,
            item_type: item.item_type,
            item_key: item.item_key,
            alert_type: "overdue_alert"
          });
        });
      } catch (emailError) {
        console.error(`[acoes-atrasadas] Erro ao enviar para ${gerente}:`, emailError);
        resultados.push({ 
          gerente, 
          email: dados.email, 
          remindersCount: dados.reminders.length, 
          overduesCount: dados.overdues.length, 
          status: "erro" 
        });
      }
    }

    // 8. Gravar registros na tabela de tracking para impedir reenvios
    if (trackingToInsert.length > 0) {
      const { error: trackingInsertError } = await supabase
        .from("cm_acoes_email_tracking")
        .insert(trackingToInsert);
      
      if (trackingInsertError) {
        console.error("[acoes-atrasadas] Erro ao salvar tracking de e-mails:", trackingInsertError);
      }
    }

    return NextResponse.json({
      success: true,
      remindersProcessed: trackingToInsert.filter(x => x.alert_type === "start_reminder").length,
      overduesProcessed: trackingToInsert.filter(x => x.alert_type === "overdue_alert").length,
      emailsEnviados: resultados.filter((r) => r.status === "enviado").length,
      detalhes: resultados,
    });
  } catch (error: unknown) {
    console.error("[acoes-atrasadas] Erro geral:", error);
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
