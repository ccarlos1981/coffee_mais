"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertEmployee(formData: FormData) {
  try {
    const supabase = await createClient();
    
    // Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Não autorizado. Por favor, faça login." };
    }
    
    // Obter cargo e verificar permissão
    const { data: profile } = await supabase
      .from('cm_user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    const role = profile?.role;
    let hasAccess = false;
    
    if (role === 'CEO') {
      hasAccess = true;
    } else if (role) {
      const { data: permission } = await supabase
        .from('cm_role_permissions')
        .select('has_access')
        .eq('role', role)
        .eq('module_name', 'Gente e Gestão')
        .eq('has_access', true)
        .maybeSingle();
      if (permission) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
      return { error: "Você não tem permissão para realizar esta ação." };
    }
    
    const id = formData.get("id") as string;
    const nome_completo = formData.get("nome_completo") as string;
    const cpf = formData.get("cpf") as string;
    const identidade = formData.get("identidade") as string;
    const data_nascimento = formData.get("data_nascimento") as string;
    const funcao = formData.get("funcao") as string;
    const area_funcao = formData.get("area_funcao") as string;
    const data_admissao = formData.get("data_admissao") as string;
    const ativo = formData.get("ativo") === "true";
    
    if (!nome_completo || !cpf) {
      return { error: "Nome completo e CPF são obrigatórios." };
    }
    
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return { error: "CPF deve conter exatamente 11 números." };
    }
    
    const employeeData: any = {
      nome_completo: nome_completo.trim(),
      cpf: cleanCpf,
      identidade: identidade ? identidade.trim() : null,
      data_nascimento: data_nascimento || null,
      funcao: funcao ? funcao.trim() : null,
      area_funcao: area_funcao ? area_funcao.trim() : null,
      data_admissao: data_admissao || null,
      ativo,
      updated_at: new Date().toISOString()
    };
    
    let query;
    if (id) {
      query = supabase
        .from("cm_employees")
        .update(employeeData)
        .eq("id", id);
    } else {
      query = supabase
        .from("cm_employees")
        .insert(employeeData);
    }
    
    const { error } = await query;
    
    if (error) {
      // Tratamento de violação de restrição UNIQUE no Postgres para o CPF (código 23505)
      if (error.code === "23505") {
        return { error: "Este CPF já está cadastrado para outro funcionário." };
      }
      return { error: error.message };
    }
    
    revalidatePath("/gente-gestao/cadastro");
    return { success: true, message: `Funcionário ${id ? 'atualizado' : 'cadastrado'} com sucesso!` };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno do servidor.";
    return { error: errorMsg };
  }
}

export async function deleteEmployee(id: string) {
  try {
    const supabase = await createClient();
    
    // Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Não autorizado. Por favor, faça login." };
    }
    
    // Obter cargo e verificar permissão
    const { data: profile } = await supabase
      .from('cm_user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    const role = profile?.role;
    let hasAccess = false;
    
    if (role === 'CEO') {
      hasAccess = true;
    } else if (role) {
      const { data: permission } = await supabase
        .from('cm_role_permissions')
        .select('has_access')
        .eq('role', role)
        .eq('module_name', 'Gente e Gestão')
        .eq('has_access', true)
        .maybeSingle();
      if (permission) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
      return { error: "Você não tem permissão para realizar esta ação." };
    }
    
    const { error } = await supabase
      .from("cm_employees")
      .delete()
      .eq("id", id);
      
    if (error) {
      return { error: error.message };
    }
    
    revalidatePath("/gente-gestao/cadastro");
    return { success: true, message: "Funcionário excluído com sucesso!" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno do servidor.";
    return { error: errorMsg };
  }
}

export async function importEmployeesInBulk(employees: any[]) {
  try {
    const supabase = await createClient();
    
    // Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Não autorizado. Por favor, faça login." };
    }
    
    // Obter cargo e verificar permissão
    const { data: profile } = await supabase
      .from('cm_user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    const role = profile?.role;
    let hasAccess = false;
    
    if (role === 'CEO') {
      hasAccess = true;
    } else if (role) {
      const { data: permission } = await supabase
        .from('cm_role_permissions')
        .select('has_access')
        .eq('role', role)
        .eq('module_name', 'Gente e Gestão')
        .eq('has_access', true)
        .maybeSingle();
      if (permission) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
      return { error: "Você não tem permissão para realizar esta ação." };
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return { error: "Nenhum funcionário válido enviado para importação." };
    }

    // Fazer o upsert em lote usando a constraint de CPF
    const { error } = await supabase
      .from("cm_employees")
      .upsert(employees, { onConflict: "cpf" });

    if (error) {
      console.error("Erro no upsert em lote:", error);
      return { error: `Erro ao salvar os registros: ${error.message}` };
    }

    revalidatePath("/gente-gestao/cadastro");
    return { success: true, message: `${employees.length} funcionários importados/atualizados com sucesso!` };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno do servidor.";
    return { error: errorMsg };
  }
}

