import { SupabaseClient } from "@supabase/supabase-js";

export async function checkIsGovernanceAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data: isAdmin, error } = await supabase.rpc("is_governance_admin", {
    p_user_id: userId,
  });
  if (error || isAdmin === null) {
    // Fallback: check profile role directly in case RPC has permissions constraints
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    return typeof profile?.role === "string" && profile.role.trim().toLowerCase() === "admin";
  }
  return !!isAdmin;
}

export async function requireGovernanceAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const isAdmin = await checkIsGovernanceAdmin(supabase, userId);
  if (!isAdmin) {
    throw new Error("FORBIDDEN");
  }
}
