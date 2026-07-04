"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(formData: FormData) {
  const cookieStore = await cookies();

  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;
  const remember = formData.get("remember") === "on";

  // Apenas e-mails corporativos @coffeemais.com
  if (!email.endsWith("@coffeemais.com")) {
    return { error: "Este e-mail não faz parte da companhia. Utilize seu e-mail @coffeemais.com." };
  }

  // Set remember preference BEFORE creating the Supabase client
  // so the cookie handler can adjust auth cookie maxAge accordingly
  if (remember) {
    cookieStore.set("coffee-remember", "1", {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    // Session cookie — no maxAge, expires when browser closes
    cookieStore.set("coffee-remember", "0", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  try {
    if (data?.user) {
      const adminClient = createAdminClient();
      await adminClient.from("cm_audit_logs").insert({
        user_id: data.user.id,
        action: "Login",
        table_name: "auth"
      });
    }
  } catch (e) {
    console.error("Erro ao gravar log de login:", e);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
