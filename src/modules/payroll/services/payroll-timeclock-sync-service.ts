import { prisma } from "@/lib/prisma";
import {
  payrollNotEditableMessage,
  updatePayrollEntryAmounts,
} from "@/modules/payroll/services/payroll-period-service";
import { recomputeTimeClockDaysForRange } from "@/modules/timeclock/services/timeclock-day-aggregation-service";
import { presenceMonthBounds } from "@/modules/timeclock/services/timeclock-presence-service";

/**
 * Time clock → draft payroll, the sibling of the leave sync and built on the
 * same spine: DRAFT only, a narrow patch of exactly the columns the clock owns,
 * one `expectedUpdatedAt`-guarded write per entry through the shared recompute
 * path so every euro is re-derived by the engine, never edited in place.
 *
 * Only employees who actually punched in the month are touched — a company can
 * run badges on the floor and manual entry in the office, and syncing zeros
 * over the office's typed hours would be the sync inventing absence.
 *
 * An employee with NEEDS_REVIEW days is skipped whole: such days contribute
 * zero minutes by design, so syncing them would write hours that are silently
 * short. The queue on /prezenca exists to drain those first.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimeClockSyncAccount {
  payrollId: string;
  year: number;
  month: number;
  synced: { employeeId: string; employeeName: string; workedHours: string }[];
  skipped: { employeeId: string; employeeName: string; reason: string }[];
}

export type TimeClockSyncOutcome =
  | { ok: true; account: TimeClockSyncAccount }
  | { ok: false; error: string };

export async function syncDraftPayrollForTimeClockMonth(params: {
  companyId: string;
  year: number;
  month: number;
  actorUserId: string;
}): Promise<TimeClockSyncOutcome> {
  const { companyId, year, month } = params;

  const payroll = await prisma.payroll.findFirst({
    where: { companyId, year, month },
    select: { id: true, status: true },
  });
  if (!payroll) {
    return { ok: false, error: `Nuk ka payroll për ${month}/${year} — krijojeni te Pagat së pari.` };
  }
  const notEditable = payrollNotEditableMessage(payroll.status);
  if (notEditable) return { ok: false, error: notEditable };

  const { start, end } = presenceMonthBounds(year, month);
  const punched = await prisma.timeClockPunch.groupBy({
    by: ["employeeId"],
    where: {
      companyId,
      voidedAt: null,
      occurredAt: { gte: new Date(start.getTime() - DAY_MS), lte: new Date(end.getTime() + DAY_MS) },
    },
  });
  if (punched.length === 0) {
    return { ok: false, error: `Asnjë skanim ore për ${month}/${year} — s'ka çfarë të sinkronizohet.` };
  }

  const names = new Map(
    (
      await prisma.employee.findMany({
        where: { id: { in: punched.map((p) => p.employeeId) }, companyId },
        select: { id: true, firstName: true, lastName: true },
      })
    ).map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]),
  );

  const account: TimeClockSyncAccount = {
    payrollId: payroll.id,
    year,
    month,
    synced: [],
    skipped: [],
  };

  for (const { employeeId } of punched) {
    const employeeName = names.get(employeeId) ?? "Punonjës";

    const outcome = await recomputeTimeClockDaysForRange({
      companyId,
      employeeId,
      rangeStart: start,
      rangeEnd: end,
    });
    if (!outcome.ok) {
      account.skipped.push({ employeeId, employeeName, reason: "Rillogaritja e ditëve dështoi." });
      continue;
    }

    const reviewDays = outcome.days.filter((d) => d.status === "NEEDS_REVIEW").length;
    if (reviewDays > 0) {
      account.skipped.push({
        employeeId,
        employeeName,
        reason:
          reviewDays === 1
            ? "1 ditë pret rishikim — zgjidheni te Prezenca para sinkronizimit."
            : `${reviewDays} ditë presin rishikim — zgjidhini te Prezenca para sinkronizimit.`,
      });
      continue;
    }

    const entry = await prisma.payrollEntry.findUnique({
      where: { payrollId_employeeId: { payrollId: payroll.id, employeeId } },
      select: { id: true, updatedAt: true },
    });
    if (!entry) {
      account.skipped.push({
        employeeId,
        employeeName,
        reason: "Nuk është në listën e pagave të këtij muaji.",
      });
      continue;
    }

    const days = outcome.days;
    const sum = (pick: (d: (typeof days)[number]) => number): number =>
      days.reduce((acc, d) => acc + pick(d), 0);
    const hours = (minutes: number): string => (minutes / 60).toFixed(2);

    // The recompute's returned days carry overtimeStackMinutes, which the
    // persisted TimeClockDay row does not — sync from the return value, never
    // from a re-read of the table.
    const recalc = await updatePayrollEntryAmounts(
      companyId,
      entry.id,
      {
        actualRegularHours: hours(sum((d) => d.regularMinutes)),
        overtimeHours: hours(sum((d) => d.overtimeMinutes)),
        weekendHours: hours(sum((d) => d.weekendMinutes)),
        holidayHours: hours(sum((d) => d.holidayMinutes)),
        nightHours: hours(sum((d) => d.nightMinutes)),
        overtimeStackHours: hours(sum((d) => d.overtimeStackMinutes)),
        nightStackHours: hours(sum((d) => d.nightStackMinutes)),
      },
      params.actorUserId,
      { expectedUpdatedAt: entry.updatedAt },
    );

    if (recalc.ok) {
      account.synced.push({
        employeeId,
        employeeName,
        workedHours: hours(sum((d) => d.workedMinutes)),
      });
    } else {
      account.skipped.push({ employeeId, employeeName, reason: recalc.error });
    }
  }

  return { ok: true, account };
}

/**
 * Whether the clock owns this employee's hour columns for a given month —
 * true when the module is on and the employee actually punched in that window.
 * Read by the leave sync (to drop `actualRegularHours` from its patch) and by
 * the spreadsheet action gate.
 */
export async function timeClockOwnsMonth(
  companyId: string,
  employeeId: string,
  year: number,
  month: number,
): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timeClockEnabled: true },
  });
  if (!company?.timeClockEnabled) return false;

  const { start, end } = presenceMonthBounds(year, month);
  const punch = await prisma.timeClockPunch.findFirst({
    where: {
      companyId,
      employeeId,
      voidedAt: null,
      occurredAt: { gte: new Date(start.getTime() - DAY_MS), lte: new Date(end.getTime() + DAY_MS) },
    },
    select: { id: true },
  });
  return punch != null;
}
