"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GAP-W16-03: Allowlist restrita para auto-cadastro público
const ALLOWED_SELF_REGISTRATION_ROLES = new Set([
  "Promotor",
  "Vendedor",
  "Visitante"
]);

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const email = (formData.get("email") as string || "").trim().toLowerCase();
  const password = formData.get("password") as string;
  const rawRole = (formData.get("role") as string || "").trim();
  const phone = (formData.get("phone") as string || "").trim();
  const uf = (formData.get("uf") as string || "").trim().toUpperCase();
  const firstName = (formData.get("first_name") as string || "").trim();
  const lastName = (formData.get("last_name") as string || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName) {
    return { error: "Primeiro nome e último nome são obrigatórios." };
  }

  if (!phone) {
    return { error: "O número de celular é obrigatório." };
  }

  // GAP-W16-03: Validação estrita da allowlist de auto-cadastro
  if (!rawRole || !ALLOWED_SELF_REGISTRATION_ROLES.has(rawRole)) {
    return {
      error: "A função selecionada não é permitida para auto-cadastro público. Solicite seu acesso à administração."
    };
  }

  const role = rawRole;

  if (role === "Promotor" && !uf) {
    return { error: "A UF é obrigatória para a área de Promotor." };
  }

  if (!password || !/^\d+$/.test(password)) {
    return { error: "A senha deve conter apenas números." };
  }

  if (!email.endsWith("@coffeemais.com")) {
    return { error: "Este e-mail não faz parte da companhia. Utilize seu e-mail @coffeemais.com." };
  }

  // Create user via Admin API with email_confirm: true (auto-confirmed)
  // Access is controlled strictly by the admin approval gate (approved: false in cm_user_profiles).
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      phone,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      uf: role === "Promotor" ? uf : null,
    },
  });

  if (error) {
    if (error.message.includes("already been registered") || error.message.includes("already exists")) {
      return { error: "Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail." };
    }
    return { error: error.message };
  }

  // Insert profile with approved: false strictly enforced by backend (admin must approve)
  if (data.user) {
    const { error: profileError } = await adminClient
      .from('cm_user_profiles')
      .upsert({ 
        id: data.user.id, 
        role, 
        name: fullName,
        approved: false, 
        phone, 
        uf: role === "Promotor" ? uf : null 
      }, { onConflict: 'id' });

    if (profileError) {
      console.error("Erro ao criar perfil:", profileError);
      return { error: "Conta criada, mas ocorreu um erro ao salvar a sua área de atuação." };
    }
  }

  // Auto-sign in the new user so they land on /pendente
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { success: "Conta criada com sucesso! Aguarde a aprovação do administrador para acessar o sistema." };
  }

  revalidatePath("/", "layout");
  redirect("/pendente");
}
