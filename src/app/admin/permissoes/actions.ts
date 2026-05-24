"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function togglePermission(role: string, moduleName: string, currentAccess: boolean) {
  try {
    const adminClient = createAdminClient();
    
    // Check if the permission already exists
    const { data: existing } = await adminClient
      .from('cm_role_permissions')
      .select('id')
      .eq('role', role)
      .eq('module_name', moduleName)
      .single();

    if (existing) {
      // Update
      const { error } = await adminClient
        .from('cm_role_permissions')
        .update({ has_access: !currentAccess, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
        
      if (error) throw error;
    } else {
      // Insert
      const { error } = await adminClient
        .from('cm_role_permissions')
        .insert({
          role,
          module_name: moduleName,
          has_access: !currentAccess
        });
        
      if (error) throw error;
    }

    revalidatePath("/admin/permissoes");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro ao atualizar permissão." };
  }
}
