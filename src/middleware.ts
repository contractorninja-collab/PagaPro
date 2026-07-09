import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pp_session";

/**
 * Fast presence-only gate for pages: redirect to /hyrje when no session cookie
 * is present. Authoritative DB-backed session + membership checks live in
 * getCompanyContext (src/server/company-context.ts), which server actions,
 * API routes, and layouts/pages call.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/hyrje") {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
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
