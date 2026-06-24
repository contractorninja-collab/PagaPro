import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTIVE_COMPANY_COOKIE } from "@/server/company-scope";

/**
 * Development helper: set the active company cookie for multi-tenant UI testing.
 * Disabled outside development.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId =
    typeof body === "object" && body !== null && "companyId" in body
      ? String((body as { companyId?: unknown }).companyId ?? "").trim()
      : "";

  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const exists = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  return NextResponse.json({ ok: true, companyId });
}
