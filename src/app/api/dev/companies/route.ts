import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Lists companies for local tenant switching — disabled outside development. */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const companies = await prisma.company.findMany({
    select: { id: true, legalName: true, tradeName: true },
    orderBy: { legalName: "asc" },
  });

  return NextResponse.json({ companies });
}
