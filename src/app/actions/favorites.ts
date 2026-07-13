"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireApprovedProfile } from "@/lib/supabase/auth-helpers";

export async function toggleFavoriteAction(moduleKey: string) {
  try {
    const user = await requireAuth();
    await requireApprovedProfile(user.id);

    const supabase = await createClient();

    // Check if it is already favorited
    const { data: existing, error: selectError } = await supabase
      .from("cm_user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("module_key", moduleKey)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      // Remove it
      const { error: deleteError } = await supabase
        .from("cm_user_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("module_key", moduleKey);

      if (deleteError) throw deleteError;
      return { success: true, action: "removed" };
    } else {
      // Add it
      const { error: insertError } = await supabase
        .from("cm_user_favorites")
        .insert({
          user_id: user.id,
          module_key: moduleKey
        });

      if (insertError) throw insertError;
      return { success: true, action: "added" };
    }
  } catch (error) {
    console.error("Error in toggleFavoriteAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateFavoriteOrderAction(orderedKeys: string[]) {
  try {
    const user = await requireAuth();
    await requireApprovedProfile(user.id);

    const supabase = await createClient();

    // Loop through each key and update display_order
    for (let i = 0; i < orderedKeys.length; i++) {
      const { error } = await supabase
        .from("cm_user_favorites")
        .update({ display_order: i })
        .eq("user_id", user.id)
        .eq("module_key", orderedKeys[i]);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error in updateFavoriteOrderAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
