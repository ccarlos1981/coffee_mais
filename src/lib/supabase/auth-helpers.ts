import { createClient } from "./server";
import { createAdminClient } from "./admin";

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
    .select("role, approved, manager_name, name, company_id")
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
  return new Response(JSON.stringify({ success: false, error: msg || "Erro interno no servidor." }), {
    status: 500,
    headers: { "Content-Type": "application/json" }
  });
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
