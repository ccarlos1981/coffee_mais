import { createAdminClient } from "@/lib/supabase/admin";

export type ResponsabilidadeFuncional =
  | "RESPONSABILIDADE_TRADE"
  | "RESPONSABILIDADE_FINANCEIRO"
  | "RESPONSABILIDADE_GRV"
  | "RESPONSABILIDADE_ADMINISTRATIVA"
  | "RESPONSABILIDADE_DIRETORIA";

export type TipoEventoNotificacaoInvestimento =
  | "ENVIAR_TRADE"           // Fase 1 -> 2
  | "REPROVAR_TRADE"         // Fase 2 -> 1
  | "VALIDAR_TRADE"          // Fase 2 -> 3 (Financeiro EXCLUÍDO)
  | "CONCLUIR_APURACAO"      // Fase 3 -> 4 (Gatilho Oficial Financeiro)
  | "DEVOLVER_FINANCEIRO"    // Fase 4 -> 3
  | "APROVAR_FINANCEIRO"     // Fase 4 -> 5
  | "PAGAMENTO_CONFIRMADO"   // Fase 5 -> 6
  | "ACAO_NAO_OCORREU";      // Cancelamento / Rota de Revisão

export interface ResolveNotificationParams {
  evento: TipoEventoNotificacaoInvestimento;
  faseAtual: number;
  faseDestino?: number;
  gerenteEmail?: string | null;
}

export interface ResolvedNotificationRecipients {
  recipients: string[];
  recipientsString: string;
  responsabilidades: ResponsabilidadeFuncional[];
  includeFinanceiro: boolean;
}

/**
 * Mapeamento estático entre Eventos do Processo de Investimento
 * e as Responsabilidades Funcionais envolvidas em cada etapa.
 */
const MATRIZ_EVENTO_RESPONSABILIDADES: Record<TipoEventoNotificacaoInvestimento, ResponsabilidadeFuncional[]> = {
  ENVIAR_TRADE: ["RESPONSABILIDADE_TRADE", "RESPONSABILIDADE_GRV"],
  REPROVAR_TRADE: ["RESPONSABILIDADE_TRADE", "RESPONSABILIDADE_GRV"],
  VALIDAR_TRADE: ["RESPONSABILIDADE_TRADE", "RESPONSABILIDADE_GRV"],
  CONCLUIR_APURACAO: ["RESPONSABILIDADE_FINANCEIRO", "RESPONSABILIDADE_GRV", "RESPONSABILIDADE_ADMINISTRATIVA"],
  DEVOLVER_FINANCEIRO: ["RESPONSABILIDADE_TRADE", "RESPONSABILIDADE_GRV"],
  APROVAR_FINANCEIRO: ["RESPONSABILIDADE_TRADE", "RESPONSABILIDADE_GRV"],
  PAGAMENTO_CONFIRMADO: ["RESPONSABILIDADE_TRADE", "RESPONSABILIDADE_GRV"],
  ACAO_NAO_OCORREU: ["RESPONSABILIDADE_TRADE", "RESPONSABILIDADE_GRV", "RESPONSABILIDADE_ADMINISTRATIVA"],
};

/**
 * Mapeamento interno entre Responsabilidade Funcional e palavras-chave de cargos/funções no banco
 */
const MAPEAMENTO_RESPONSABILIDADE_ROLES: Record<Exclude<ResponsabilidadeFuncional, "RESPONSABILIDADE_GRV">, string[]> = {
  RESPONSABILIDADE_TRADE: ["trade", "trade marketing", "operacoes_trade"],
  RESPONSABILIDADE_FINANCEIRO: ["financeiro", "contas a pagar", "tesouraria", "financas"],
  RESPONSABILIDADE_ADMINISTRATIVA: ["admin", "admin master", "gerente de sistemas", "coordenador"],
  RESPONSABILIDADE_DIRETORIA: ["diretor", "ceo", "cfo", "vp"],
};

/**
 * Fallbacks de contingência (variáveis de ambiente ou aliases seguros)
 */
const FALLBACK_EMAILS: Record<Exclude<ResponsabilidadeFuncional, "RESPONSABILIDADE_GRV">, string> = {
  RESPONSABILIDADE_TRADE: process.env.NOTIFICATION_EMAIL_TRADE || "trade@coffeemais.com",
  RESPONSABILIDADE_FINANCEIRO: process.env.NOTIFICATION_EMAIL_FINANCEIRO || "financeiro@coffeemais.com",
  RESPONSABILIDADE_ADMINISTRATIVA: process.env.NOTIFICATION_EMAIL_ADMIN || "cristiano.santos@coffeemais.com",
  RESPONSABILIDADE_DIRETORIA: process.env.NOTIFICATION_EMAIL_DIRETORIA || "joao.monteiro@coffeemais.com",
};

/**
 * Resolve dinamicamente os e-mails dos destinatários com base nas Responsabilidades Funcionais exigidas pela etapa.
 */
export async function resolveNotificationRecipients(
  params: ResolveNotificationParams
): Promise<ResolvedNotificationRecipients> {
  const { evento, gerenteEmail } = params;
  const responsabilidades = MATRIZ_EVENTO_RESPONSABILIDADES[evento] || [];
  const recipientsSet = new Set<string>();

  // 1. Resolver e-mail do GRV (Gerente Responsável da Ação) se aplicável
  if (responsabilidades.includes("RESPONSABILIDADE_GRV") && gerenteEmail && gerenteEmail.includes("@")) {
    recipientsSet.add(gerenteEmail.trim().toLowerCase());
  }

  // 2. Tentar buscar destinatários das demais responsabilidades via Supabase DB
  try {
    const adminClient = createAdminClient();

    // 2a. Buscar em cm_report_recipients (tabela de cadastros de relatórios/notificações)
    const { data: reportRecipients } = await adminClient
      .from("cm_report_recipients")
      .select("email");

    if (reportRecipients && reportRecipients.length > 0) {
      reportRecipients.forEach(r => {
        if (r.email && r.email.includes("@")) {
          if (responsabilidades.includes("RESPONSABILIDADE_ADMINISTRATIVA") || responsabilidades.includes("RESPONSABILIDADE_DIRETORIA")) {
            recipientsSet.add(r.email.trim().toLowerCase());
          }
        }
      });
    }

    // 2b. Buscar usuários ativos em cm_user_profiles e auth.users
    const { data: profiles } = await adminClient
      .from("cm_user_profiles")
      .select("id, role, approved")
      .eq("approved", true);

    if (profiles && profiles.length > 0) {
      const targetProfileIds: string[] = [];

      profiles.forEach(p => {
        if (!p.role) return;
        const roleLower = p.role.toLowerCase();

        for (const resp of responsabilidades) {
          if (resp === "RESPONSABILIDADE_GRV") continue;
          const keywords = MAPEAMENTO_RESPONSABILIDADE_ROLES[resp as keyof typeof MAPEAMENTO_RESPONSABILIDADE_ROLES] || [];
          if (keywords.some(kw => roleLower.includes(kw))) {
            targetProfileIds.push(p.id);
            break;
          }
        }
      });

      if (targetProfileIds.length > 0) {
        for (const profileId of targetProfileIds) {
          try {
            const { data: authUser } = await adminClient.auth.admin.getUserById(profileId);
            if (authUser?.user?.email && authUser.user.email.includes("@")) {
              recipientsSet.add(authUser.user.email.trim().toLowerCase());
            }
          } catch (e) {
            // Ignorar erro individual de usuário auth
          }
        }
      }
    }
  } catch (dbErr) {
    console.error("[NotificationService] Erro ao consultar banco de dados para destinatários:", dbErr);
  }

  // 3. Aplicar Fallbacks de Contingência para qualquer responsabilidade requerida sem destinatário
  for (const resp of responsabilidades) {
    if (resp === "RESPONSABILIDADE_GRV") continue;

    const keywords = MAPEAMENTO_RESPONSABILIDADE_ROLES[resp as keyof typeof MAPEAMENTO_RESPONSABILIDADE_ROLES] || [];
    const fallback = FALLBACK_EMAILS[resp as keyof typeof FALLBACK_EMAILS];

    if (fallback) {
      const emailsInSet = Array.from(recipientsSet);
      const hasEmailForResp = emailsInSet.some(e => keywords.some(kw => e.includes(kw)));
      if (!hasEmailForResp) {
        fallback.split(",").forEach(emailStr => {
          if (emailStr.trim()) recipientsSet.add(emailStr.trim().toLowerCase());
        });
      }
    }
  }

  const recipients = Array.from(recipientsSet);
  const includeFinanceiro = responsabilidades.includes("RESPONSABILIDADE_FINANCEIRO");

  return {
    recipients,
    recipientsString: recipients.join(", "),
    responsabilidades,
    includeFinanceiro
  };
}
