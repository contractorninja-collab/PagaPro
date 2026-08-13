import { prisma } from "@/lib/prisma";
import { recomputeTimeClockDaysForRange } from "@/modules/timeclock/services/timeclock-day-aggregation-service";

/**
 * HR corrections to the punch log. The log itself is immutable — a fix is a new
 * MANUAL punch or a void with a reason, never an edit — so what happened and
 * what was corrected both stay on the record. Every correction recomputes the
 * derived days around it, so the exception queue reflects the fix immediately.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type CorrectionOutcome = { ok: true } | { ok: false; code: string; error: string };

async function recomputeAround(companyId: string, employeeId: string, at: Date): Promise<void> {
  await recomputeTimeClockDaysForRange({
    companyId,
    employeeId,
    rangeStart: new Date(at.getTime() - DAY_MS),
    rangeEnd: new Date(at.getTime() + DAY_MS),
  });
}

export async function addManualPunch(params: {
  companyId: string;
  employeeId: string;
  occurredAt: Date;
  direction: "IN" | "OUT";
  note: string;
  actorUserId: string;
}): Promise<CorrectionOutcome> {
  const { companyId, employeeId, occurredAt } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });
  if (!employee) return { ok: false, code: "NOT_FOUND", error: "Punonjësi nuk u gjet." };

  if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return { ok: false, code: "FUTURE", error: "Ora e regjistrimit nuk mund të jetë në të ardhmen." };
  }

  await prisma.timeClockPunch.create({
    data: {
      companyId,
      employeeId,
      occurredAt,
      direction: params.direction,
      source: "MANUAL",
      note: params.note.trim() || null,
      createdById: params.actorUserId,
    },
  });

  await recomputeAround(companyId, employeeId, occurredAt);
  return { ok: true };
}

export async function voidPunch(params: {
  companyId: string;
  punchId: string;
  reason: string;
  actorUserId: string;
}): Promise<CorrectionOutcome> {
  const reason = params.reason.trim();
  if (reason.length < 3) {
    return { ok: false, code: "REASON", error: "Shkruani arsyen e anulimit." };
  }

  // Guarded updateMany: scoped to the company and to not-yet-voided, so a
  // double-click or a foreign id both fall out as count 0.
  const updated = await prisma.timeClockPunch.updateMany({
    where: { id: params.punchId, companyId: params.companyId, voidedAt: null },
    data: { voidedAt: new Date(), voidedById: params.actorUserId, voidedReason: reason },
  });
  if (updated.count !== 1) {
    return { ok: false, code: "NOT_FOUND", error: "Skanimi nuk u gjet ose është anuluar tashmë." };
  }

  const punch = await prisma.timeClockPunch.findFirst({
    where: { id: params.punchId, companyId: params.companyId },
    select: { employeeId: true, occurredAt: true },
  });
  if (punch) await recomputeAround(params.companyId, punch.employeeId, punch.occurredAt);
  return { ok: true };
}
