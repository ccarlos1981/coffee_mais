"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult, ActionErrorCode, successResult, errorResult, handleActionError } from "@/lib/types/action-result";
import nodemailer from "nodemailer";

export interface PesquisaLightData {
  rede: string;
  precoFlat: number;
  tipoFlat: "Moído" | "Grão";
  precoGourmet: number;
}

export async function salvarPesquisaLight(data: PesquisaLightData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  let userId: string | null = null;

  try {
    // 1. Validar autenticação do usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResult(ActionErrorCode.UNAUTHORIZED, "Usuário não autenticado.");
    }
    userId = user.id;

    // 2. Validar campos obrigatórios
    if (!data.rede || !data.rede.trim()) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "O nome da rede é obrigatório.");
    }
    if (data.precoFlat <= 0) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "O preço do café Flat deve ser maior que zero.");
    }
    if (!["Moído", "Grão"].includes(data.tipoFlat)) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "O tipo do Flat deve ser Moído ou Grão.");
    }
    if (data.precoGourmet <= 0) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "O preço do café Gourmet deve ser maior que zero.");
    }

    // 3. Obter perfil e funcionário correspondente ao promotor
    const { data: perfil, error: perfilError } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfilError) {
      console.error("Erro ao carregar perfil do promotor:", perfilError);
    }

    let employeeId: string | null = perfil?.employee_id || null;
    let employeeName = "Promotor";

    if (employeeId) {
      const { data: emp, error: empError } = await supabase
        .from("cm_employees")
        .select("nome_completo")
        .eq("id", employeeId)
        .maybeSingle();
      
      if (!empError && emp) {
        employeeName = emp.nome_completo;
      }
    } else {
      // Fallback para o nome no perfil de usuário geral
      const { data: profileData } = await supabase
        .from("cm_user_profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      
      if (profileData?.name) {
        employeeName = profileData.name;
      }
    }

    // 4. Salvar pesquisa no banco de dados
    const { data: insertResult, error: insertError } = await supabase
      .from("cm_promotor_pesquisa_light")
      .insert({
        promotor_id: employeeId,
        usuario_id: user.id,
        rede: data.rede.trim(),
        preco_flat: data.precoFlat,
        tipo_flat: data.tipoFlat,
        preco_gourmet: data.precoGourmet
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Erro ao salvar pesquisa light no banco:", insertError);
      return errorResult(
        ActionErrorCode.INTERNAL_ERROR,
        `Erro ao salvar no banco de dados: ${insertError.message}`
      );
    }

    // 5. Determinar destinatários do e-mail de alerta
    const recipientsSet = new Set<string>();
    recipientsSet.add("trade@coffeemais.com");
    recipientsSet.add("cristiano.santos@coffeemais.com");

    try {
      const adminClient = createAdminClient();
      const { data: profiles, error: profilesError } = await adminClient
        .from("cm_user_profiles")
        .select("id, role")
        .in("role", ["Gerente Regional", "Gerente Nacional", "Trade"]);

      if (!profilesError && profiles && profiles.length > 0) {
        const { data: authUsersData, error: authUsersError } = await adminClient.auth.admin.listUsers();
        if (!authUsersError && authUsersData?.users) {
          const emailMap = new Map(authUsersData.users.map((u) => [u.id, u.email]));
          for (const p of profiles) {
            const email = emailMap.get(p.id);
            if (email && email.includes("@")) {
              recipientsSet.add(email);
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn("Erro ao buscar e-mails de gerentes/trade do banco de dados:", dbErr);
    }

    const recipientsList = Array.from(recipientsSet).join(", ");

    // 6. Configurar e disparar notificação por e-mail (se SMTP configurado)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const dateStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

        const textBody = `Foi identificada uma movimentação promocional do produto Gourmet.

Rede: ${data.rede.trim()}
Preço Flat: R$ ${data.precoFlat.toFixed(2).replace(".", ",")}
Tipo Flat: ${data.tipoFlat}
Preço Gourmet: R$ ${data.precoGourmet.toFixed(2).replace(".", ",")}
Promotor: ${employeeName}
Data/Hora: ${dateStr}

Favor avaliar a oportunidade comercial e as possíveis ações competitivas.`;

        const htmlBody = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1f2937, #111827); padding: 24px; text-align: center; border-bottom: 4px solid #bba16e;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Coffee Mais</h1>
              <p style="color: #bba16e; margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 1.5px;">
                Alerta de Pesquisa Light - Promoção Gourmet
              </p>
            </div>
            
            <!-- Body -->
            <div style="padding: 24px; color: #374151; line-height: 1.6;">
              <p style="font-size: 15px; margin-top: 0; font-weight: 600; color: #111827;">
                Foi identificada uma movimentação promocional relevante do produto Gourmet. Veja os detalhes:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 12px 8px; font-weight: bold; color: #4b5563; width: 140px; background-color: #f9fafb;">Rede:</td>
                    <td style="padding: 12px 8px; color: #111827; font-weight: 600; background-color: #f9fafb;">${data.rede.trim()}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 12px 8px; font-weight: bold; color: #4b5563;">Preço Flat:</td>
                    <td style="padding: 12px 8px; color: #111827; font-weight: 600;">R$ ${data.precoFlat.toFixed(2).replace(".", ",")}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 12px 8px; font-weight: bold; color: #4b5563; background-color: #f9fafb;">Tipo Flat:</td>
                    <td style="padding: 12px 8px; color: #111827; background-color: #f9fafb;">${data.tipoFlat}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 12px 8px; font-weight: bold; color: #4b5563;">Preço Gourmet:</td>
                    <td style="padding: 12px 8px; color: #c2410c; font-weight: 800; font-size: 16px;">R$ ${data.precoGourmet.toFixed(2).replace(".", ",")}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 12px 8px; font-weight: bold; color: #4b5563; background-color: #f9fafb;">Promotor:</td>
                    <td style="padding: 12px 8px; color: #111827; background-color: #f9fafb;">${employeeName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 8px; font-weight: bold; color: #4b5563;">Data/Hora:</td>
                    <td style="padding: 12px 8px; color: #111827;">${dateStr}</td>
                  </tr>
                </tbody>
              </table>
              
              <div style="margin-top: 24px; padding: 16px; background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 5px solid #bba16e; border-radius: 8px;">
                <p style="margin: 0; font-size: 13px; color: #78350f; font-weight: 500;">
                  <strong>Atenção:</strong> Favor avaliar a oportunidade comercial e as possíveis ações competitivas na rede correspondente.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6;">
              Este é um alerta automático disparado pelo módulo Gestão Promotor da Coffee Mais.
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"Coffee Mais Campo" <${process.env.SMTP_USER}>`,
          to: recipientsList,
          subject: "Alerta de Pesquisa Light - Promoção Gourmet Identificada",
          text: textBody,
          html: htmlBody,
        });
      } catch (mailError) {
        console.error("Erro crítico ao disparar e-mail de alerta do promotor (pesquisa light):", mailError);
        // Não jogamos o erro adiante para não falhar a transação e persistência da pesquisa que já foi salva com sucesso no banco.
      }
    } else {
      console.warn("SMTP_USER ou SMTP_PASS não configurados no .env.local. Alerta de e-mail não enviado.");
    }

    return successResult({ id: insertResult.id });
  } catch (error: unknown) {
    handleActionError(error, {
      module: "Gestão Promotor",
      action: "salvarPesquisaLight",
      userId,
    });
  }
}
