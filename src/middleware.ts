import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pp_session";

/**
 * Lightweight gate: redirect to /hyrje when no session cookie is present.
 * Authoritative, DB-backed checks live in the (dashboard)/(admin) layouts and server actions.
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
  // Everything except API routes (own auth: company cookie / job secrets), Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
