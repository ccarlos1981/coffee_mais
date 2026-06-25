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
    const whatsapp = formData.get("whatsapp") as string;
    const endereco_casa = formData.get("endereco_casa") as string;
    
    if (!nome_completo || !cpf) {
      return { error: "Nome completo e CPF são obrigatórios." };
    }
    
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return { error: "CPF deve conter exatamente 11 números." };
    }

    if (!whatsapp || whatsapp.trim() === "") {
      return { error: "WhatsApp é obrigatório para todos os colaboradores." };
    }

    let lat_casa: number | null = null;
    let lng_casa: number | null = null;

    // Geocodificação automática no servidor se houver endereço residencial
    if (endereco_casa && endereco_casa.trim() !== "") {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco_casa)}&format=json&limit=1`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos de timeout max

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "CoffeeMais-Supervisor-App/1.0 (contact@coffeemais.com.br)"
          }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            lat_casa = parseFloat(data[0].lat);
            lng_casa = parseFloat(data[0].lon);
          }
        }
      } catch (err) {
        console.warn("[GEOCODE] Não foi possível obter coordenadas para o endereço:", err);
      }
    }
    
    const employeeData = {
      nome_completo: nome_completo.trim(),
      cpf: cleanCpf,
      identidade: identidade ? identidade.trim() : null,
      data_nascimento: data_nascimento || null,
      funcao: funcao ? funcao.trim() : null,
      area_funcao: area_funcao ? area_funcao.trim() : null,
      data_admissao: data_admissao || null,
      ativo,
      whatsapp: whatsapp ? whatsapp.trim() : null,
      endereco_casa: endereco_casa ? endereco_casa.trim() : null,
      lat_casa,
      lng_casa,
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

export interface ImportEmployeeInput {
  nome_completo: string;
  cpf: string;
  identidade: string | null;
  data_nascimento: string | null;
  funcao: string | null;
  area_funcao: string | null;
  data_admissao: string | null;
  ativo: boolean;
}

export async function importEmployeesInBulk(employees: ImportEmployeeInput[]) {
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

export async function getEmployeeEscala(employeeId: string) {
  try {
    const supabase = await createClient();
    
    // Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Não autorizado. Por favor, faça login." };
    }
    
    const { data: escalas, error } = await supabase
      .from("cm_promotor_escala")
      .select("*")
      .eq("employee_id", employeeId)
      .order("dia_semana", { ascending: true });
      
    if (error) {
      return { error: error.message };
    }
    
    return { success: true, data: escalas || [] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno do servidor.";
    return { error: errorMsg };
  }
}

export interface SaveEscalaInput {
  dia_semana: number;
  hora_entrada: string;
  hora_saida_intervalo?: string | null;
  hora_retorno_intervalo?: string | null;
  hora_saida_lanche?: string | null;
  hora_retorno_lanche?: string | null;
  hora_saida: string;
  tolerancia_minutos?: number;
}

export async function saveEmployeeEscala(employeeId: string, escalas: SaveEscalaInput[]) {
  try {
    const supabase = await createClient();
    
    // Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Não autorizado. Por favor, faça login." };
    }
    
    // Obter cargo e verificar permissão (apenas Admin, CEO, Trade, Supervisor)
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
      
    const role = profile?.role;
    const isGestor = ["Supervisor", "CEO", "Admin", "Trade"].includes(role || "");
    if (!isGestor) {
      return { error: "Você não tem permissão para realizar esta ação." };
    }
    
    // Deletar as escalas existentes para este employee_id
    const { error: deleteError } = await supabase
      .from("cm_promotor_escala")
      .delete()
      .eq("employee_id", employeeId);
      
    if (deleteError) {
      return { error: deleteError.message };
    }
    
    // Inserir as novas escalas válidas
    if (escalas && escalas.length > 0) {
      const scaleRows = escalas.map(esc => ({
        employee_id: employeeId,
        dia_semana: esc.dia_semana,
        hora_entrada: esc.hora_entrada,
        hora_saida_intervalo: esc.hora_saida_intervalo || null,
        hora_retorno_intervalo: esc.hora_retorno_intervalo || null,
        hora_saida_lanche: esc.hora_saida_lanche || null,
        hora_retorno_lanche: esc.hora_retorno_lanche || null,
        hora_saida: esc.hora_saida,
        tolerancia_minutos: esc.tolerancia_minutos ?? 10
      }));
      
      const { error: insertError } = await supabase
        .from("cm_promotor_escala")
        .insert(scaleRows);
        
      if (insertError) {
        return { error: insertError.message };
      }
    }
    
    revalidatePath("/gente-gestao/cadastro");
    return { success: true, message: "Escala de trabalho salva com sucesso!" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno do servidor.";
    return { error: errorMsg };
  }
}


