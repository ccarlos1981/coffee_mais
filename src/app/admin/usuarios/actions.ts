"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createUser(formData: FormData) {
  try {
    const adminClient = createAdminClient();
    
    let email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;
    
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

    // Cria o usuário via Admin API
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirma para facilitar, já que é o admin que está criando
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
          receber_pdf_vendas,
          receber_pdf_investimento
        });
        
      if (profileError) {
        // Logar o erro, mas o usuário já foi criado. Idealmente tratar isso em transação, 
        // mas supabase admin.createUser não entra em blocos PL/pgSQL transacionais do lado do cliente facilmente.
        console.error("Erro ao criar perfil de usuário:", profileError);
      }
    }

    revalidatePath("/admin/usuarios");
    return { success: true, message: `Usuário ${email} criado com sucesso!` };

  } catch (error: any) {
    return { error: error.message || "Erro interno ao criar usuário." };
  }
}

export async function deleteUser(userId: string) {
  try {
    const adminClient = createAdminClient();
    
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    
    if (error) {
      return { error: error.message };
    }
    
    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro interno ao excluir usuário." };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  try {
    const adminClient = createAdminClient();
    
    if (!userId || !newRole) {
      return { error: "Usuário e nova função são obrigatórios." };
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

    revalidatePath("/admin/usuarios");
    return { success: true, message: "Cargo atualizado com sucesso!" };
  } catch (error: any) {
    return { error: error.message || "Erro interno ao atualizar cargo." };
  }
}

export async function updateUserPdfPreferences(userId: string, field: "vendas" | "investimento", value: boolean) {
  try {
    const adminClient = createAdminClient();
    
    if (!userId) {
      return { error: "Usuário é obrigatório." };
    }

    const updateObj: any = {};
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
  } catch (error: any) {
    return { error: error.message || "Erro interno ao atualizar preferências." };
  }
}
