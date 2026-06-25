import { createClient } from "@/lib/supabase/server";

export async function isFeatureEnabled(
  flagKey: string, 
  region?: string, 
  supervisorId?: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: flag } = await supabase
      .from("cm_feature_flags")
      .select("*")
      .eq("flag_key", flagKey)
      .maybeSingle();

    if (!flag || !flag.is_active) return false;

    // Filter by active regions if specified
    if (flag.active_regions && flag.active_regions.length > 0 && region) {
      if (!flag.active_regions.includes(region)) return false;
    }

    // Filter by active supervisors if specified
    if (flag.active_supervisor_ids && flag.active_supervisor_ids.length > 0 && supervisorId) {
      if (!flag.active_supervisor_ids.includes(supervisorId)) return false;
    }

    return true;
  } catch (err) {
    console.error("[FEATURE FLAGS] Failed to check status:", err);
    return false; // Fail closed for security
  }
}
