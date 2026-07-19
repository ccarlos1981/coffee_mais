import { createClient } from "@/lib/supabase/server";
import { User, SupabaseClient } from "@supabase/supabase-js";

export interface AuthenticatedContext {
  supabase: SupabaseClient;
  user: User;
}

export async function getSessionUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null };
  }
  return { supabase, user };
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedContext> {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return { supabase, user };
}
