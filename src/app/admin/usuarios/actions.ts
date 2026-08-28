"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, logAuditAction } from "@/lib/supabase/auth-helpers";

const MASTER_ROLES = new Set(["Admin Master", "CEO"]);

export async function createUser(formData: FormData) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");

    const adminClient = createAdminClient();
    
    let email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;
    const managerName = (formData.get("manager_name") as string) || null;
    const firstName = (formData.get("first_name") as string || "").trim();
    const lastName = (formData.get("last_name") as string || "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || null;
    
    const receber_pdf_vendas = formData.get("receber_pdf_vendas") === "on";
    const receber_pdf_investimento = formData.get("receber_pdf_investimento") === "on";
    
    if (!email || !password || !role) {
      return { error: "E-mail, senha e função são obrigatórios." };
    }
    
    email = email.trim().toLowerCase();

    // Validação extra de segurança no backend
    if (!email.endsWith("@coffeemais.com")) {
      return { error: "Apenas e-mails corporativos @coffeemais.com são permitidos." };
    }

    // GAP-W16-02: Apenas Admin Master ou CEO podem criar contas com role Admin Master
    if (role === "Admin Master" && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Apenas Admin Master ou CEO podem criar contas Admin Master." };
    }

    // Cria o usuário via Admin API
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        full_name: fullName || undefined,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.user) {
      // Insere o perfil do usuário
      const { error: profileError } = await adminClient
        .from('cm_user_profiles')
        .insert({
          id: data.user.id,
          role: role,
          name: fullName,
          manager_name: managerName,
          receber_pdf_vendas,
          receber_pdf_investimento,
          approved: true
        });
        
      if (profileError) {
        console.error("Erro ao criar perfil de usuário:", profileError);
      }

      await logAuditAction(user.id, "CREATE_USER", "cm_user_profiles", {
        created_user_id: data.user.id,
        created_email: email,
        assigned_role: role,
      });
    }

    revalidatePath("/admin/usuarios");
    return { success: true, message: `Usuário ${email} criado com sucesso!` };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao criar usuário.";
    return { error: errorMsg };
  }
}

export async function deleteUser(userId: string) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");

    if (!userId) {
      return { error: "ID do usuário é obrigatório." };
    }

    if (userId === user.id) {
      return { error: "Acesso negado: Não é permitido excluir a própria conta." };
    }

    const adminClient = createAdminClient();

    // GAP-W16-02: Verificar perfil do usuário alvo
    const { data: targetProfile } = await adminClient
      .from('cm_user_profiles')
      .select('role, name')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile?.role === "Admin Master" && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Administradores comuns não podem excluir contas Admin Master." };
    }
    
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    
    if (error) {
      return { error: error.message };
    }

    await logAuditAction(user.id, "DELETE_USER", "cm_user_profiles", {
      deleted_user_id: userId,
      deleted_user_role: targetProfile?.role,
    });
    
    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao excluir usuário.";
    return { error: errorMsg };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");

    if (!userId || !newRole) {
      return { error: "Usuário e nova função são obrigatórios." };
    }

    // GAP-W16-02: Proibição de auto-elevação
    if (userId === user.id && newRole !== profile.role) {
      return { error: "Acesso negado: Não é permitido alterar o próprio cargo." };
    }

    const adminClient = createAdminClient();

    // GAP-W16-02: Validar usuário alvo e destino
    const { data: targetProfile } = await adminClient
      .from('cm_user_profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if ((targetProfile?.role === "Admin Master" || newRole === "Admin Master") && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Apenas Admin Master ou CEO podem alterar ou conceder o cargo de Admin Master." };
    }

    const { error } = await adminClient
      .from('cm_user_profiles')
      .upsert({
        id: userId,
        role: newRole
      }, { onConflict: 'id' });

    if (error) {
      return { error: error.message };
    }

    await logAuditAction(user.id, "UPDATE_USER_ROLE", "cm_user_profiles", {
      target_user_id: userId,
      old_role: targetProfile?.role,
      new_role: newRole,
    });

    revalidatePath("/admin/usuarios");
    return { success: true, message: "Cargo atualizado com sucesso!" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao atualizar cargo.";
    return { error: errorMsg };
  }
}

export async function updateUserPdfPreferences(userId: string, field: "vendas" | "investimento", value: boolean) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");

    const adminClient = createAdminClient();
    
    if (!userId) {
      return { error: "Usuário é obrigatório." };
    }

    const updateObj: { receber_pdf_vendas?: boolean; receber_pdf_investimento?: boolean } = {};
    if (field === "vendas") updateObj.receber_pdf_vendas = value;
    if (field === "investimento") updateObj.receber_pdf_investimento = value;

    const { error } = await adminClient
      .from('cm_user_profiles')
      .update(updateObj)
      .eq('id', userId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao atualizar preferências.";
    return { error: errorMsg };
  }
}

export async function updateUserApproval(userId: string, approved: boolean) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");

    if (!userId) {
      return { error: "Usuário é obrigatório." };
    }

    // GAP-W16-02: Proibição de auto-aprovação
    if (userId === user.id) {
      return { error: "Acesso negado: Não é permitido aprovar ou desaprovar a própria conta." };
    }

    const adminClient = createAdminClient();

    const { data: targetProfile } = await adminClient
      .from('cm_user_profiles')
      .select('role, name, uf')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile?.role === "Admin Master" && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Administradores comuns não podem alterar o status de aprovação de Admin Master." };
    }

    // Update approval status
    const { error } = await adminClient
      .from('cm_user_profiles')
      .update({ approved })
      .eq('id', userId);

    if (error) {
      return { error: error.message };
    }

    // Auto-create basic HR record when approving a Promotor
    if (approved && targetProfile?.role === 'Promotor') {
      const { data: existing } = await adminClient
        .from('cm_promotor_perfil')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        const { data: newEmployee, error: empError } = await adminClient
          .from('cm_employees')
          .insert({
            nome_completo: targetProfile.name || 'Promotor',
            funcao: 'Promotor',
            area_funcao: 'Trade',
            ativo: true,
          })
          .select('id')
          .single();

        if (!empError && newEmployee) {
          await adminClient.from('cm_promotor_perfil').insert({
            user_id: userId,
            employee_id: newEmployee.id,
          });
        }
      }
    }

    await logAuditAction(user.id, "UPDATE_USER_APPROVAL", "cm_user_profiles", {
      target_user_id: userId,
      approved,
    });

    revalidatePath("/admin/usuarios");
    return { success: true, message: "Aprovação atualizada com sucesso!" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao atualizar aprovação.";
    return { error: errorMsg };
  }
}

export async function updateManagerName(userId: string, managerName: string | null) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");

    if (!userId) {
      return { error: "Usuário é obrigatório." };
    }

    const adminClient = createAdminClient();

    const { data: targetProfile } = await adminClient
      .from('cm_user_profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile?.role === "Admin Master" && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Administradores comuns não podem alterar dados de Admin Master." };
    }

    const { error } = await adminClient
      .from('cm_user_profiles')
      .update({ manager_name: managerName || null })
      .eq('id', userId);

    if (error) {
      return { error: error.message };
    }

    await logAuditAction(user.id, "UPDATE_MANAGER_NAME", "cm_user_profiles", {
      target_user_id: userId,
      manager_name: managerName,
    });

    revalidatePath("/admin/usuarios");
    return { success: true, message: "Gerente atualizado com sucesso!" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao atualizar gerente.";
    return { error: errorMsg };
  }
}

export async function updateUser(userId: string, formData: FormData) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");

    if (!userId) {
      return { error: "ID do usuário é obrigatório." };
    }

    const adminClient = createAdminClient();

    // 1. Obter perfil do usuário alvo
    const { data: targetProfile, error: targetError } = await adminClient
      .from('cm_user_profiles')
      .select('role, name, approved')
      .eq('id', userId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return { error: "Usuário alvo não encontrado." };
    }

    // GAP-W16-02: Apenas Admin Master ou CEO podem alterar conta de Admin Master
    if (targetProfile.role === "Admin Master" && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Administradores comuns não podem modificar contas Admin Master." };
    }
    
    let email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const managerName = (formData.get("manager_name") as string) || null;
    const firstName = (formData.get("first_name") as string || "").trim();
    const lastName = (formData.get("last_name") as string || "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || null;
    const phone = (formData.get("phone") as string || "").trim() || null;
    const uf = (formData.get("uf") as string || "").trim() || null;
    
    const receber_pdf_vendas = formData.get("receber_pdf_vendas") === "on";
    const receber_pdf_investimento = formData.get("receber_pdf_investimento") === "on";
    
    if (!email || !role) {
      return { error: "E-mail e função são obrigatórios." };
    }
    // GAP-W16-02: Apenas Admin Master ou CEO podem promover qualquer usuário a Admin Master
    if (role === "Admin Master" && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Apenas Admin Master ou CEO podem conceder o cargo Admin Master." };
    }

    // GAP-W16-02: Proibição de auto-elevação de cargo
    if (userId === user.id && role !== profile.role) {
      return { error: "Acesso negado: Não é permitido alterar o próprio cargo." };
    }
    
    email = email.trim().toLowerCase();

    // Validação extra de segurança no backend
    if (!email.endsWith("@coffeemais.com")) {
      return { error: "Apenas e-mails corporativos @coffeemais.com são permitidos." };
    }

    // 2. Atualiza os dados no Auth (email e user_metadata)
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      user_metadata: {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        full_name: fullName || undefined,
      },
    });

    if (authError) {
      return { error: authError.message };
    }

    // 3. Atualiza o perfil na tabela 'cm_user_profiles' com campos estritos (prevenção de mass assignment)
    const { error: profileError } = await adminClient
      .from('cm_user_profiles')
      .update({
        name: fullName,
        role: role,
        manager_name: managerName,
        phone,
        uf,
        receber_pdf_vendas,
        receber_pdf_investimento
      })
      .eq('id', userId);

    if (profileError) {
      return { error: profileError.message };
    }

    await logAuditAction(user.id, "UPDATE_USER", "cm_user_profiles", {
      target_user_id: userId,
      updated_email: email,
      updated_role: role,
    });

    revalidatePath("/admin/usuarios");
    return { success: true, message: `Usuário ${email} atualizado com sucesso!` };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao atualizar usuário.";
    return { error: errorMsg };
  }
}

export async function resetUserPassword(userId: string) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Usuários");
    
    if (!userId) {
      return { error: "Usuário é obrigatório." };
    }

    const adminClient = createAdminClient();

    // GAP-W16-02: Validar usuário alvo
    const { data: targetProfile } = await adminClient
      .from('cm_user_profiles')
      .select('role, name')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile?.role === "Admin Master" && !MASTER_ROLES.has(profile.role)) {
      return { error: "Acesso negado: Administradores comuns não podem redefinir a senha de contas Admin Master." };
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: "123456",
    });

    if (error) {
      return { error: error.message };
    }

    await logAuditAction(user.id, "RESET_USER_PASSWORD", "cm_user_profiles", {
      target_user_id: userId,
      target_user_role: targetProfile?.role,
    });

    revalidatePath("/admin/usuarios");
    return { success: true, message: "Senha redefinida para 123456 com sucesso!" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao redefinir senha.";
    return { error: errorMsg };
  }
}
