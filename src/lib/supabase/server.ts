import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  let authHeader: string | undefined;
  try {
    const reqHeaders = await headers();
    authHeader = reqHeaders.get("authorization") || undefined;
  } catch {
    // Safe fallback for static rendering or other environments where headers() is not available
  }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const rememberMe = cookieStore.get("coffee-remember")?.value !== "0";
            cookiesToSet.forEach(({ name, value, options }) => {
              const opts = rememberMe
                ? options
                : { ...options, maxAge: undefined, expires: undefined };
              cookieStore.set(name, value, opts);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
      global: authHeader ? {
        headers: {
          Authorization: authHeader
        }
      } : undefined
    }
  );

  return client;
}
