import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

// ─── env ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CC_ALWAYS = ["trade@coffeemais.com", "cristiano.santos@coffeemais.com"];

// ─── helpers ─────────────────────────────────────────────────────────────────
function dateBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function diasAtraso(dataFim: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(dataFim + "T00:00:00");
  return Math.floor((hoje.getTime() - fim.getTime()) / 86_400_000);
}

// ─── handler ─────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    // Segurança: verificar CRON_SECRET em produção
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    if (
      process.env.CRON_SECRET &&
      secret !== process.env.CRON_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validar SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { success: false, error: "SMTP_USER ou SMTP_PASS não configurados" },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ── 1. Calcular janela de datas ───────────────────────────────────────────
    // Atraso a partir de 7 dias após data_fim, até 14 dias (janela de 7 dias de reenvio)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const cutoffMax = new Date(hoje); // hoje - 7 dias
    cutoffMax.setDate(cutoffMax.getDate() - 7);
    const cutoffMin = new Date(hoje); // hoje - 14 dias
    cutoffMin.setDate(cutoffMin.getDate() - 14);

    const cutoffMaxStr = cutoffMax.toISOString().slice(0, 10);
    const cutoffMinStr = cutoffMin.toISOString().slice(0, 10);

    // ── 2. Buscar ações atrasadas via view com gerente ────────────────────────
    const { data: acoes, error: acoesError } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select(
        "id, codigo, rede, tipo_acao, data_inicio, data_fim, fase_atual, gerente_responsavel"
      )
      .eq("fase_atual", 3)
      .gte("data_fim", cutoffMinStr) // não mais que 9 dias de atraso
      .lte("data_fim", cutoffMaxStr) // pelo menos 2 dias de atraso
      .order("data_fim", { ascending: true });

    if (acoesError) throw acoesError;

    if (!acoes || acoes.length === 0) {
      console.log("[acoes-atrasadas] Nenhuma ação atrasada encontrada.");
      return NextResponse.json({
        success: true,
        message: "Nenhuma ação atrasada encontrada.",
        enviados: 0,
      });
    }

    console.log(`[acoes-atrasadas] ${acoes.length} ação(ões) atrasada(s).`);

    // ── 3. Buscar emails dos gerentes ─────────────────────────────────────────
    const { data: perfis, error: perfisError } = await supabase
      .from("cm_user_profiles")
      .select("manager_name, id")
      .eq("role", "Gerente Regional");

    if (perfisError) throw perfisError;

    // Buscar emails via auth.users (precisa de service role key)
    const gerenteEmailMap: Record<string, string> = {};

    if (perfis && perfis.length > 0) {
      for (const p of perfis) {
        if (!p.manager_name) continue;
        const { data: userData } = await supabase.auth.admin.getUserById(p.id);
        if (userData?.user?.email) {
          gerenteEmailMap[p.manager_name] = userData.user.email;
        }
      }
    }

    console.log("[acoes-atrasadas] Emails dos gerentes:", gerenteEmailMap);

    // ── 4. Agrupar ações por gerente ──────────────────────────────────────────
    const porGerente: Record<
      string,
      {
        email: string;
        acoes: typeof acoes;
      }
    > = {};

    for (const acao of acoes) {
      const gerente = acao.gerente_responsavel || "Sem Gerente";
      const email = gerenteEmailMap[gerente];

      if (!email) {
        console.warn(`[acoes-atrasadas] Sem email para gerente: ${gerente}`);
        continue;
      }

      if (!porGerente[gerente]) {
        porGerente[gerente] = { email, acoes: [] };
      }
      porGerente[gerente].acoes.push(acao);
    }

    // ── 5. Configurar transporter SMTP ────────────────────────────────────────
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

    // ── 6. Enviar um email por gerente ────────────────────────────────────────
    const resultados: Array<{ gerente: string; email: string; qtd: number; status: string }> = [];

    for (const [gerente, dados] of Object.entries(porGerente)) {
      const linhasTabela = dados.acoes
        .map((a) => {
          const atraso = diasAtraso(a.data_fim);
          return `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">#${a.codigo}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">${a.rede}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">${a.tipo_acao || "-"}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">${dateBr(a.data_inicio)} → ${dateBr(a.data_fim)}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #dc2626; font-weight: 600;">${atraso} dia${atraso > 1 ? "s" : ""}</td>
            </tr>
          `;
        })
        .join("");

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0;">
          <div style="max-width: 680px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 24px 32px;">
              <h1 style="margin: 0; color: #fff; font-size: 22px; font-weight: 700;">Coffee++ Mais</h1>
              <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Gestão de Investimentos</p>
            </div>

            <!-- Alerta -->
            <div style="padding: 24px 32px 0;">
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 15px; color: #991b1b;">
                  ⚠️ <strong>Atenção, ${gerente}!</strong>
                  Você tem <strong>${dados.acoes.length} ação${dados.acoes.length > 1 ? "ões" : ""} de investimento</strong> com apuração em atraso.
                </p>
                <p style="margin: 8px 0 0; font-size: 13px; color: #b91c1c;">
                  Essas ações encerraram o período mas ainda estão na fase <strong>Apur. GRV</strong>.
                  Por favor, acesse o sistema e avance-as para a próxima etapa.
                </p>
              </div>

              <!-- Tabela de ações -->
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 10px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Cód.</th>
                    <th style="padding: 10px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Rede</th>
                    <th style="padding: 10px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Tipo</th>
                    <th style="padding: 10px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Período</th>
                    <th style="padding: 10px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  ${linhasTabela}
                </tbody>
              </table>
            </div>

            <!-- CTA -->
            <div style="padding: 24px 32px;">
              <a
                href="${process.env.NEXT_PUBLIC_APP_URL || "https://coffeemais.vercel.app"}/investimento"
                style="display: inline-block; background: #d97706; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;"
              >
                Acessar Painel de Investimentos →
              </a>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                Este e-mail é gerado automaticamente todos os dias enquanto houver ações em atraso (por até 7 dias após o início do atraso).<br>
                Não é necessário responder.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await transporter.sendMail({
          from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
          to: dados.email,
          cc: CC_ALWAYS.join(", "),
          subject: `⚠️ ${dados.acoes.length} ação${dados.acoes.length > 1 ? "ões" : ""} com apuração em atraso — ${gerente}`,
          html,
        });

        console.log(`[acoes-atrasadas] Email enviado para ${gerente} (${dados.email})`);
        resultados.push({ gerente, email: dados.email, qtd: dados.acoes.length, status: "enviado" });
      } catch (emailError) {
        console.error(`[acoes-atrasadas] Erro ao enviar para ${gerente}:`, emailError);
        resultados.push({ gerente, email: dados.email, qtd: dados.acoes.length, status: "erro" });
      }
    }

    return NextResponse.json({
      success: true,
      acoesAtrasadas: acoes.length,
      emailsEnviados: resultados.filter((r) => r.status === "enviado").length,
      detalhes: resultados,
    });
  } catch (error: unknown) {
    console.error("[acoes-atrasadas] Erro geral:", error);
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
