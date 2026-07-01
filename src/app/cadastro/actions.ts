"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;
  const phone = (formData.get("phone") as string || "").trim();
  const uf = (formData.get("uf") as string || "").trim();
  const firstName = (formData.get("first_name") as string || "").trim();
  const lastName = (formData.get("last_name") as string || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName) {
    return { error: "Primeiro nome e último nome são obrigatórios." };
  }

  if (!phone) {
    return { error: "O número de celular é obrigatório." };
  }

  if (role === "Promotor" && !uf) {
    return { error: "A UF é obrigatória para a área de Promotor." };
  }

  if (!/^\d+$/.test(password)) {
    return { error: "A senha deve conter apenas números." };
  }

  if (!email.endsWith("@coffeemais.com")) {
    return { error: "Este e-mail não faz parte da companhia. Utilize seu e-mail @coffeemais.com." };
  }

  // Create user via Admin API with email_confirm: true (auto-confirmed)
  // This skips the email confirmation step entirely.
  // Access is controlled by the admin approval gate (approved: true/false in cm_user_profiles).
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
    // Handle duplicate email
    if (error.message.includes("already been registered") || error.message.includes("already exists")) {
      return { error: "Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail." };
    }
    return { error: error.message };
  }

  // Insert profile with approved: false (admin must approve)
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
      });

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
    // If auto-login fails, send them to login manually
    return { success: "Conta criada com sucesso! Aguarde a aprovação do administrador para acessar o sistema." };
  }

  revalidatePath("/", "layout");
  redirect("/pendente");
}
