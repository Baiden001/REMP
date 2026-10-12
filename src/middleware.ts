import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { ACTIVITY_COOKIE, FRESH_SIGN_IN_MS, IDLE_LIMIT_MS, hasActivityCookie } from "@/lib/session";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession reads from the cookie only — no network call, no race condition.
  // Server Components still call getUser() for actual security checks.
  let {
    data: { session },
  } = await supabase.auth.getSession();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isApiRoute = path.startsWith("/api/");
  const isProtectedRoute = path.startsWith("/dashboard") || isApiRoute;

  // 30 minutes without activity (or no record of activity at all): end the session.
  let timedOut = false;
  const lastSignIn = Date.parse(session?.user?.last_sign_in_at ?? "");
  const justSignedIn = Number.isFinite(lastSignIn) && Math.abs(Date.now() - lastSignIn) < FRESH_SIGN_IN_MS;
  if (session && !justSignedIn && !hasActivityCookie(request.cookies.get(ACTIVITY_COOKIE)?.value)) {
    await supabase.auth.signOut({ scope: "local" });
    session = null;
    timedOut = true;
  }

  // Carry any auth cookie changes (refresh or sign-out) onto a redirect.
  const withCookies = (response: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    if (timedOut) response.cookies.delete(ACTIVITY_COOKIE);
    return response;
  };

  if (!session && isProtectedRoute) {
    if (isApiRoute) {
      return withCookies(NextResponse.json({ error: "Your session has ended. Sign in again." }, { status: 401 }));
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = timedOut ? "?reason=idle" : "";
    return withCookies(NextResponse.redirect(url));
  }

  if (session && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withCookies(NextResponse.redirect(url));
  }

  if (timedOut) return withCookies(NextResponse.next({ request }));

  if (session && isProtectedRoute) {
    // Opening a page counts as activity; never let the browser reuse a cached copy.
    supabaseResponse.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
      path: "/",
      maxAge: IDLE_LIMIT_MS / 1000,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
    supabaseResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  // Return supabaseResponse as-is so refreshed session cookies reach the browser.
  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/:path*"],
};
