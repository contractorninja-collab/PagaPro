import { prisma } from "@/lib/prisma";
import type { TimeClockDirection } from "@prisma/client";
import {
  inferDirection,
  isDuplicateScan,
  pairedMinutes,
  SHIFT_LOOKBACK_MS,
} from "@/modules/timeclock/calculation/punch-inference";

/**
 * Recording a badge scan. The rules themselves (direction inference, the
 * duplicate guard, pairing) are pure and unit-tested in
 * `calculation/punch-inference.ts`; this file is the DB around them.
 */

export interface PunchResult {
  employeeId: string;
  /** First name + last initial — a door screen should not display more. */
  displayName: string;
  direction: TimeClockDirection;
  occurredAt: Date;
  /** Paired minutes across the current working day, for the "8h 32min" line. */
  todayMinutes: number;
  duplicateIgnored: boolean;
}

export type PunchOutcome =
  | { ok: true; result: PunchResult }
  | { ok: false; code: "UNKNOWN_BADGE" | "INACTIVE_EMPLOYEE" | "ERROR"; error: string };

function displayNameFor(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0);
  return initial ? `${firstName} ${initial}.` : firstName;
}

export async function recordBadgePunch(params: {
  companyId: string;
  badgeCode: string;
  deviceId?: string | null;
  /** Clock time reported by the device; differs from now for queued offline scans. */
  deviceReportedAt?: Date | null;
}): Promise<PunchOutcome> {
  const badgeCode = params.badgeCode.trim();
  if (!badgeCode) return { ok: false, code: "UNKNOWN_BADGE", error: "Kodi i skanuar është bosh." };

  try {
    const employee = await prisma.employee.findFirst({
      where: { companyId: params.companyId, badgeCode },
      select: { id: true, firstName: true, lastName: true, status: true },
    });
    if (!employee) {
      return { ok: false, code: "UNKNOWN_BADGE", error: "Kartela nuk njihet." };
    }
    if (employee.status === "TERMINATED" || employee.status === "SUSPENDED") {
      return {
        ok: false,
        code: "INACTIVE_EMPLOYEE",
        error: "Punonjësi nuk është aktiv.",
      };
    }

    const now = new Date();

    const recentPunches = await prisma.timeClockPunch.findMany({
      where: {
        companyId: params.companyId,
        employeeId: employee.id,
        occurredAt: { gte: new Date(now.getTime() - SHIFT_LOOKBACK_MS) },
        voidedAt: null,
      },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true, direction: true },
    });

    const last = recentPunches[recentPunches.length - 1];

    if (last && isDuplicateScan(recentPunches, now)) {
      return {
        ok: true,
        result: {
          employeeId: employee.id,
          displayName: displayNameFor(employee.firstName, employee.lastName),
          direction: last.direction,
          occurredAt: last.occurredAt,
          todayMinutes: pairedMinutes(recentPunches),
          duplicateIgnored: true,
        },
      };
    }

    const direction: TimeClockDirection = inferDirection(recentPunches);

    await prisma.timeClockPunch.create({
      data: {
        companyId: params.companyId,
        employeeId: employee.id,
        deviceId: params.deviceId ?? undefined,
        occurredAt: now,
        deviceReportedAt: params.deviceReportedAt ?? undefined,
        direction,
        source: "KIOSK",
        badgeCodeUsed: badgeCode,
      },
    });

    return {
      ok: true,
      result: {
        employeeId: employee.id,
        displayName: displayNameFor(employee.firstName, employee.lastName),
        direction,
        occurredAt: now,
        todayMinutes: pairedMinutes([...recentPunches, { occurredAt: now, direction }]),
        duplicateIgnored: false,
      },
    };
  } catch (e) {
    console.error("[timeclock] punch failed", e);
    return { ok: false, code: "ERROR", error: "Regjistrimi dështoi — provoni sërish." };
  }
}

export interface FeedEntry {
  id: string;
  displayName: string;
  direction: TimeClockDirection;
  occurredAt: string;
}

/** The last few scans on this device's company, newest first. */
export async function recentPunchFeed(companyId: string, take = 12): Promise<FeedEntry[]> {
  const rows = await prisma.timeClockPunch.findMany({
    // Bounded so a screen opened in the morning is not still listing last night.
    where: {
      companyId,
      voidedAt: null,
      occurredAt: { gte: new Date(Date.now() - SHIFT_LOOKBACK_MS) },
    },
    orderBy: { occurredAt: "desc" },
    take,
    select: {
      id: true,
      direction: true,
      occurredAt: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    displayName: displayNameFor(row.employee.firstName, row.employee.lastName),
    direction: row.direction,
    occurredAt: row.occurredAt.toISOString(),
  }));
}
