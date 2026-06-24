import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runMonthlyLeaveAccrualForCompany } from "@/modules/leaves/services/leave-accrual-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

const postBodySchema = z.object({
  periodYear: z.number().int().min(1970).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  /** Required only when authenticating with `LEAVE_ACCRUAL_JOB_SECRET`. */
  companyId: z.string().min(1).optional(),
});

/**
 * Post monthly leave accrual (Art 36) for a company.
 *
 * - **Browser / HR UI**: same-origin session — resolves company from `pp_active_company_id` (no `companyId` in body).
 * - **Automation**: `Authorization: Bearer <LEAVE_ACCRUAL_JOB_SECRET>` and JSON `{ companyId, periodYear, periodMonth }`.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const secret = process.env.LEAVE_ACCRUAL_JOB_SECRET?.trim();
  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  let companyId: string | null = null;

  if (secret) {
    if (bearer === secret) {
      if (!parsed.data.companyId) {
        return NextResponse.json(
          { ok: false, error: "companyId required when using job secret" },
          { status: 400 },
        );
      }
      const exists = await prisma.company.findUnique({
        where: { id: parsed.data.companyId },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
      }
      companyId = parsed.data.companyId;
    } else {
      if (bearer) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      companyId = await resolveActiveCompanyId();
      if (!companyId) {
        return NextResponse.json({ ok: false, error: "Missing active company" }, { status: 401 });
      }
    }
  } else {
    if (bearer) {
      return NextResponse.json({ ok: false, error: "Job secret not configured" }, { status: 503 });
    }
    companyId = await resolveActiveCompanyId();
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing active company" }, { status: 401 });
    }
  }

  try {
    const { created, skipped } = await runMonthlyLeaveAccrualForCompany({
      companyId,
      periodYear: parsed.data.periodYear,
      periodMonth: parsed.data.periodMonth,
    });
    return NextResponse.json({ ok: true, created, skipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Accrual failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
