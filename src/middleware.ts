import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_BASE_PATH,
  isAdminPublicPathname,
} from "@/lib/admin-path";
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
  const tenantSlug = tenantSlugFromHost(host);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = hasSession ? (isAdminHost(host) ? ADMIN_BASE_PATH : "/paneli") : "/hyrje";
    return NextResponse.redirect(url);
  }

  if (pathname === "/hyrje") {
    return NextResponse.next();
  }

  if (isAdminPublicPathname(pathname)) {
    if (tenantSlug) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!hasSession) {
      return NextResponse.redirect(new URL("/hyrje", request.url));
    }

    const internalUrl = request.nextUrl.clone();
    internalUrl.pathname = `/admin${pathname.slice(ADMIN_BASE_PATH.length)}`;
    return NextResponse.rewrite(internalUrl);
  }

  if (isAdminHost(host) && hasSession && pathname !== "/ndrysho-fjalekalimin") {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_BASE_PATH;
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
