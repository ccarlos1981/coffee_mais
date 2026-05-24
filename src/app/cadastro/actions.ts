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

  if (!/^\d+$/.test(password)) {
    return { error: "A senha deve conter apenas números." };
  }

  if (!email.endsWith("@coffeemais.com")) {
    return { error: "Este e-mail não faz parte da companhia. Utilize seu e-mail @coffeemais.com." };
  }

  // Use auth.signUp
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Insert profile
  if (data.user) {
    const { error: profileError } = await adminClient
      .from('cm_user_profiles')
      .upsert({ id: data.user.id, role, email });

    if (profileError) {
      console.error("Erro ao criar perfil:", profileError);
      return { error: "Conta criada, mas ocorreu um erro ao salvar a sua área de atuação." };
    }
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  } else {
    // If no session, it means email confirmation is required.
    return { success: "Conta criada com sucesso! Verifique seu e-mail para confirmar a conta antes de fazer o login." };
  }
}
