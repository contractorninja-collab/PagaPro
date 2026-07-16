import { NextResponse, type NextRequest } from "next/server";
import { isAdminHost, tenantSlugFromHost } from "@/server/tenant-domain";

const SESSION_COOKIE = "pp_session";

/**
 * Fast presence-only gate for pages: redirect to /hyrje when no session cookie
 * is present. Authoritative DB-backed session + membership checks live in
 * getCompanyContext (src/server/company-context.ts), which server actions,
 * API routes, and layouts/pages call.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = hasSession ? (isAdminHost(host) ? "/admin" : "/paneli") : "/hyrje";
    return NextResponse.redirect(url);
  }

  if (pathname === "/hyrje") {
    return NextResponse.next();
  }

  if (isAdminHost(host) && hasSession && !pathname.startsWith("/admin") && pathname !== "/ndrysho-fjalekalimin") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  if (tenantSlugFromHost(host) && hasSession && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/paneli";
    return NextResponse.redirect(url);
  }

  if (!hasSession) {
    const loginUrl = new URL("/hyrje", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes (which gate via getCompanyContext / job secrets), Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
