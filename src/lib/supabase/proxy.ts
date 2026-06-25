import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const rememberMe = request.cookies.get("coffee-remember")?.value !== "0";
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = rememberMe
              ? options
              : { ...options, maxAge: undefined, expires: undefined };
            supabaseResponse.cookies.set(name, value, opts);
          });
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  const isAuthPage = pathname.startsWith("/auth");
  const isCadastroPage = pathname.startsWith("/cadastro");
  const isEsqueciPage = pathname.startsWith("/esqueci-senha");
  const isPendentePage = pathname.startsWith("/pendente");
  const isUpdatePasswordPage = pathname.startsWith("/update-password");
  const isApiRoute = pathname.startsWith("/api");

  if (
    !user &&
    !isLoginPage &&
    !isAuthPage &&
    !isCadastroPage &&
    !isEsqueciPage &&
    !isPendentePage &&
    !isUpdatePasswordPage &&
    !isApiRoute
  ) {
    // No user — redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("approved, role")
      .eq("id", user.id)
      .single();

    const isApproved = profile?.approved === true;

    if (!isApproved) {
      if (
        !isLoginPage &&
        !isAuthPage &&
        !isCadastroPage &&
        !isEsqueciPage &&
        !isPendentePage &&
        !isUpdatePasswordPage &&
        !isApiRoute
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/pendente";
        return NextResponse.redirect(url);
      }
    } else {
      if (isPendentePage) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }

      const isPromotorWebPage = pathname.startsWith("/promotor") && pathname !== "/promotor/indisponivel";
      if (isPromotorWebPage && profile?.role === "Promotor") {
        const { data: flag } = await supabase
          .from("cm_feature_flags")
          .select("is_active")
          .eq("flag_key", "force_native_only")
          .maybeSingle();

        if (flag?.is_active) {
          const url = request.nextUrl.clone();
          url.pathname = "/promotor/indisponivel";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as is.
  return supabaseResponse;
}
