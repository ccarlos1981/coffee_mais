import { createClient } from "./server";
import { createAdminClient } from "./admin";
import { timingSafeEqual } from "crypto";

export async function assertCronAccess(
  request: Request
): Promise<{ authorized: boolean; errorResponse?: Response; actorType?: "cron" | "admin_session" }> {
  // 1. Canal 1: Automação Vercel Cron via Bearer Token
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    if (!cronSecret || cronSecret.trim() === "") {
      console.error("[CRON SECURITY] CRON_SECRET não configurado no ambiente. Execução bloqueada (Fail-Closed).");
      return {
        authorized: false,
        errorResponse: new Response(
          JSON.stringify({ success: false, error: "Acesso não autorizado. Chave de cron não configurada no servidor." }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const secretBuffer = Buffer.from(cronSecret.trim());
    const tokenBuffer = Buffer.from(token);

    if (secretBuffer.length === tokenBuffer.length && timingSafeEqual(secretBuffer, tokenBuffer)) {
      return { authorized: true, actorType: "cron" };
    }

    return {
      authorized: false,
      errorResponse: new Response(
        JSON.stringify({ success: false, error: "Acesso não autorizado. Token de cron inválido." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // 2. Canal 2: Sessão de Usuário Autenticado (Admin / Admin Master / Financeiro / CEO)
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, ["Admin", "Admin Master", "Financeiro", "CEO"]);
    return { authorized: true, actorType: "admin_session" };
  } catch {
    // Falha silenciosa de sessão: cai na resposta padrão 401 abaixo
  }

  // 3. Bloqueio Fail-Closed se nenhum canal for atendido
  return {
    authorized: false,
    errorResponse: new Response(
      JSON.stringify({
        success: false,
        error: "Acesso não autorizado. Requer Bearer CRON_SECRET válido ou sessão administrativa ativa.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    ),
  };
}

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireApprovedProfile(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("cm_user_profiles")
    .select("role, approved, manager_name, name, company_id, employee_code")
    .eq("id", userId)
    .single();

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }
  if (!profile.approved) {
    throw new Error("PROFILE_NOT_APPROVED");
  }
  return profile;
}

export async function requirePermission(role: string, moduleName: string) {
  const adminClient = createAdminClient();
  
  // 1. Check database-defined permissions
  const { data: permission } = await adminClient
    .from("cm_role_permissions")
    .select("has_access")
    .eq("role", role)
    .eq("module_name", moduleName)
    .maybeSingle();

  if (permission) {
    if (!permission.has_access) {
      throw new Error("PERMISSION_DENIED");
    }
    return true;
  }

  // 2. Fallbacks for system administration / super-users
  if (role === "Admin" || role === "CEO") {
    return true;
  }

  throw new Error("PERMISSION_DENIED");
}

export function requireRole(
  profile: { role?: string | null },
  allowedRoles: string[]
) {
  const currentRole = (profile?.role || "").trim().toLowerCase();
  if (!currentRole) {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  const isAllowed = allowedRoles.some(
    (r) => r.trim().toLowerCase() === currentRole
  );

  if (!isAllowed) {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  return true;
}

export function handleAuthError(err: any) {
  const msg = err.message || "";
  if (msg === "UNAUTHENTICATED") {
    return new Response(JSON.stringify({ success: false, error: "Não autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (msg === "NOT_FOUND") {
    return new Response(JSON.stringify({ success: false, error: "Recurso não encontrado." }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (
    msg === "PROFILE_NOT_FOUND" ||
    msg === "PROFILE_NOT_APPROVED" ||
    msg === "PERMISSION_DENIED" ||
    msg === "ROLE_NOT_ALLOWED" ||
    msg === "FORBIDDEN"
  ) {
    return new Response(JSON.stringify({ success: false, error: "Acesso não autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev) {
    console.error("[Server Error]", err);
  }
  return new Response(
    JSON.stringify({
      success: false,
      error: isDev ? msg || "Erro interno no servidor." : "Erro interno no servidor.",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function logAuditAction(userId: string, action: string, tableName: string, details?: any) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from("cm_audit_logs").insert({
      user_id: userId,
      action,
      table_name: tableName,
      details: details || null
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export async function assertPdvAccess(
  userId: string,
  profile: { role?: string | null; manager_name?: string | null; name?: string | null },
  pdvId: string
): Promise<boolean> {
  const currentRole = (profile?.role || "").trim().toLowerCase();

  // 1. National Administrative Roles have global scope
  const NATIONAL_ROLES = new Set([
    "admin",
    "admin master",
    "ceo",
    "trade",
    "financeiro",
    "diretor",
    "gerente nacional",
    "ti",
  ]);

  if (NATIONAL_ROLES.has(currentRole)) {
    return true;
  }

  const adminClient = createAdminClient();

  // 2. Promotor: PDV must be in the Promotor's assigned wallet (carteira) OR in an agenda/visit
  if (currentRole === "promotor") {
    // Check wallet (cm_promotor_carteira_pdv)
    const { data: inWallet } = await adminClient
      .from("cm_promotor_carteira_pdv")
      .select("id")
      .eq("promotor_id", userId)
      .eq("cod_parceiro", pdvId)
      .maybeSingle();

    if (inWallet) {
      return true;
    }

    // Check scheduled agenda & visits
    const { data: agendas } = await adminClient
      .from("cm_promotor_agenda_diaria")
      .select("id")
      .eq("promotor_id", userId);

    if (agendas && agendas.length > 0) {
      const agendaIds = agendas.map((a) => a.id);
      const { data: inVisita } = await adminClient
        .from("cm_promotor_visita")
        .select("id")
        .in("agenda_diaria_id", agendaIds)
        .eq("cod_parceiro", pdvId)
        .maybeSingle();

      if (inVisita) {
        return true;
      }
    }

    throw new Error("FORBIDDEN");
  }

  // 3. Supervisor: PDV must belong to a Promotor under this supervisor
  if (currentRole === "supervisor") {
    const { data: supervised } = await adminClient
      .from("cm_promotor_supervisor_mapping")
      .select("promotor_id")
      .eq("supervisor_id", userId);

    if (supervised && supervised.length > 0) {
      const promotorIds = supervised.map((s) => s.promotor_id);
      const { data: inTeamWallet } = await adminClient
        .from("cm_promotor_carteira_pdv")
        .select("id")
        .in("promotor_id", promotorIds)
        .eq("cod_parceiro", pdvId)
        .maybeSingle();

      if (inTeamWallet) {
        return true;
      }
    }

    throw new Error("FORBIDDEN");
  }

  // 4. Gerente Regional: PDV must belong to this manager's portfolio in base_atendimento
  if (currentRole === "gerente regional") {
    const managerName = profile.manager_name || profile.name;
    if (managerName) {
      const { data: inManagerPortfolio } = await adminClient
        .from("base_atendimento")
        .select("cod_parceiro")
        .eq("cod_parceiro", pdvId)
        .eq("manager", managerName)
        .maybeSingle();

      if (inManagerPortfolio) {
        return true;
      }
    }

    throw new Error("FORBIDDEN");
  }

  throw new Error("FORBIDDEN");
}

export interface VisitaAgendaRecord {
  id: string;
  promotor_id: string;
  data_agenda: string;
}

export interface VisitaAccessRecord {
  id: string;
  cod_parceiro: string;
  status: string;
  agenda_diaria_id: string;
  agenda: VisitaAgendaRecord | VisitaAgendaRecord[] | null;
}

export interface VisitaAccessResult {
  visita: VisitaAccessRecord;
  authorized: boolean;
}

export async function assertVisitaAccess(
  userId: string,
  profile: { role?: string | null; manager_name?: string | null; name?: string | null },
  visitaId: string
): Promise<VisitaAccessResult> {
  const currentRole = (profile?.role || "").trim().toLowerCase();

  // 1. National Administrative Roles have global scope
  const NATIONAL_ROLES = new Set([
    "admin",
    "admin master",
    "ceo",
    "trade",
    "financeiro",
    "diretor",
    "gerente nacional",
    "ti",
  ]);

  const adminClient = createAdminClient();

  const { data: rawVisita, error: visitaError } = await adminClient
    .from("cm_promotor_visita")
    .select(`
      id,
      cod_parceiro,
      status,
      agenda_diaria_id,
      agenda:cm_promotor_agenda_diaria(
        id,
        promotor_id,
        data_agenda
      )
    `)
    .eq("id", visitaId)
    .maybeSingle();

  if (visitaError || !rawVisita) {
    throw new Error("NOT_FOUND");
  }

  const visita = rawVisita as unknown as VisitaAccessRecord;

  // 1. National Administrative Roles have global scope
  if (NATIONAL_ROLES.has(currentRole)) {
    return { visita, authorized: true };
  }

  const agendaData: VisitaAgendaRecord | null = Array.isArray(visita.agenda)
    ? (visita.agenda[0] ?? null)
    : (visita.agenda ?? null);

  const visitPromotorId: string | undefined = agendaData?.promotor_id;

  // 2. Promotor: Must be the owner of the visit's agenda (direct auth.uid() or employee_id)
  if (currentRole === "promotor") {
    if (visitPromotorId && visitPromotorId === userId) {
      return { visita, authorized: true };
    }

    const { data: perfil } = await adminClient
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (perfil && visitPromotorId === perfil.employee_id) {
      return { visita, authorized: true };
    }

    throw new Error("FORBIDDEN");
  }

  // 3. Supervisor: Promotor must be under this supervisor's mapping
  if (currentRole === "supervisor") {
    if (!visitPromotorId) {
      throw new Error("FORBIDDEN");
    }

    const { data: supervised } = await adminClient
      .from("cm_promotor_supervisor_mapping")
      .select("promotor_id")
      .eq("supervisor_id", userId);

    if (supervised && supervised.length > 0) {
      const promotorIds: string[] = supervised.map((s) => s.promotor_id);
      if (promotorIds.includes(visitPromotorId)) {
        return { visita, authorized: true };
      }

      const { data: supervisedProfiles } = await adminClient
        .from("cm_promotor_perfil")
        .select("employee_id")
        .in("user_id", promotorIds);

      if (supervisedProfiles && supervisedProfiles.some((p) => p.employee_id === visitPromotorId)) {
        return { visita, authorized: true };
      }
    }

    throw new Error("FORBIDDEN");
  }

  // 4. Gerente Regional: PDV must belong to this manager's portfolio in base_atendimento
  if (currentRole === "gerente regional") {
    const managerName = profile.manager_name || profile.name;
    if (managerName && visita.cod_parceiro) {
      const { data: inPortfolio } = await adminClient
        .from("base_atendimento")
        .select("cod_parceiro")
        .eq("cod_parceiro", visita.cod_parceiro)
        .eq("manager", managerName)
        .maybeSingle();

      if (inPortfolio) {
        return { visita, authorized: true };
      }
    }

    throw new Error("FORBIDDEN");
  }

  throw new Error("FORBIDDEN");
}

/**
 * Strict Object-Level Authorization for Promoter data:
 * - National roles (Admin, Admin Master, CEO, Trade, Gerente Nacional, Financeiro, Diretor): Full access.
 * - Promotor: Can only access their own data (matching user_id or employee_id).
 * - Supervisor: Can only access promoters under their supervision.
 * - Gerente Regional / others: Fail closed (FORBIDDEN).
 */
export async function assertPromotorAccess(
  userId: string,
  profile: { role?: string | null; manager_name?: string | null; name?: string | null },
  targetPromoterId: string,
  adminClientOverride?: any
): Promise<{ authorized: boolean; promoterId: string }> {
  if (!targetPromoterId || typeof targetPromoterId !== "string" || targetPromoterId.trim().length === 0) {
    throw new Error("NOT_FOUND");
  }

  const currentRole = (profile?.role || "").trim().toLowerCase();

  // 1. National Roles
  const NATIONAL_ROLES = new Set([
    "admin",
    "admin master",
    "ceo",
    "trade",
    "financeiro",
    "diretor",
    "gerente nacional",
    "ti",
  ]);

  if (NATIONAL_ROLES.has(currentRole)) {
    return { authorized: true, promoterId: targetPromoterId.trim() };
  }

  const adminClient = adminClientOverride ?? createAdminClient();

  // 2. Promotor: self-access check
  if (currentRole === "promotor") {
    if (targetPromoterId.trim() === userId) {
      return { authorized: true, promoterId: targetPromoterId.trim() };
    }

    // Check if targetPromoterId matches employee_id of this user
    const { data: myProfile } = await adminClient
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (myProfile?.employee_id && myProfile.employee_id === targetPromoterId.trim()) {
      return { authorized: true, promoterId: targetPromoterId.trim() };
    }

    throw new Error("FORBIDDEN");
  }

  // 3. Supervisor: dual-identity team check (auth.uid + employee_id)
  if (currentRole === "supervisor") {
    const { data: supPerfil } = await adminClient
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", userId)
      .maybeSingle();

    const supervisorIdsToCheck = [userId];
    if (supPerfil?.employee_id) {
      supervisorIdsToCheck.push(supPerfil.employee_id);
    }

    const { data: supervised } = await adminClient
      .from("cm_promotor_supervisor_mapping")
      .select("promotor_id")
      .in("supervisor_id", supervisorIdsToCheck);

    if (supervised && supervised.length > 0) {
      const promotorIds: string[] = supervised.map((s: { promotor_id: string }) => s.promotor_id);
      if (promotorIds.includes(targetPromoterId.trim())) {
        return { authorized: true, promoterId: targetPromoterId.trim() };
      }

      const { data: supervisedProfiles } = await adminClient
        .from("cm_promotor_perfil")
        .select("user_id, employee_id")
        .or(`user_id.in.(${promotorIds.join(",")}),employee_id.in.(${promotorIds.join(",")})`);

      if (supervisedProfiles && supervisedProfiles.some((p: { user_id: string; employee_id: string }) => p.user_id === targetPromoterId.trim() || p.employee_id === targetPromoterId.trim())) {
        return { authorized: true, promoterId: targetPromoterId.trim() };
      }
    }

    throw new Error("FORBIDDEN");
  }

  throw new Error("FORBIDDEN");
}
