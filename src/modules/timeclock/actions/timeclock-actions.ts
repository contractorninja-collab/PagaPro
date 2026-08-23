"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { companyContextErrorMessage, getCompanyContext, requireCapability } from "@/server/company-context";
import { prisma } from "@/lib/prisma";
import { addManualPunch, voidPunch } from "@/modules/timeclock/services/timeclock-correction-service";
import { zonedWallTimeToUtc } from "@/modules/timeclock/calculation/zoned-time";
import {
  getEmployeePresenceMonth,
  listPunchesAroundDay,
  type PresenceEmployeeDto,
  type PresencePunchDto,
} from "@/modules/timeclock/services/timeclock-presence-service";
import { isTimeClockEnabled } from "@/modules/timeclock/services/timeclock-entitlement";
import {
  syncDraftPayrollForTimeClockMonth,
  type TimeClockSyncAccount,
} from "@/modules/payroll/services/payroll-timeclock-sync-service";

export type TimeClockActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function safeRev(path: string) {
  try {
    revalidatePath(path);
  } catch {
    /* ignore */
  }
}

const manualPunchSchema = z.object({
  employeeId: z.string().min(1),
  /**
   * Wall-clock date and time as HR typed them. The dialog used to send a
   * ready-made ISO instant built as literal UTC, which landed every manual
   * punch one or two hours away from the time the person actually typed —
   * classification runs in the company's zone. The conversion belongs here,
   * where the company's timezone is known.
   */
  workDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data nuk është valide."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Shkruani orën si HH:MM."),
  direction: z.enum(["IN", "OUT"]),
  note: z.string().max(300).default(""),
});

export async function addManualPunchAction(raw: unknown): Promise<TimeClockActionResult> {
  const ctx = await requireCapability("timeclock.write");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user } = ctx.context;

  const parsed = manualPunchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Të dhënat nuk janë valide." };
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  if (!company) return { ok: false, error: "Kompania nuk u gjet." };

  const [hourStr, minuteStr] = parsed.data.time.split(":");
  const occurredAt = zonedWallTimeToUtc(
    parsed.data.workDateIso,
    Number(hourStr),
    Number(minuteStr),
    company.timezone,
  );

  const r = await addManualPunch({
    companyId,
    employeeId: parsed.data.employeeId,
    occurredAt,
    direction: parsed.data.direction,
    note: parsed.data.note,
    actorUserId: user.id,
  });
  if (!r.ok) return { ok: false, error: r.error };

  safeRev("/prezenca");
  safeRev("/pagat");
  return { ok: true };
}

const voidPunchSchema = z.object({
  punchId: z.string().min(1),
  reason: z.string().min(3, "Shkruani arsyen e anulimit.").max(300),
});

export async function voidPunchAction(raw: unknown): Promise<TimeClockActionResult> {
  const ctx = await requireCapability("timeclock.write");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user } = ctx.context;

  const parsed = voidPunchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Të dhënat nuk janë valide." };
  }

  const r = await voidPunch({
    companyId,
    punchId: parsed.data.punchId,
    reason: parsed.data.reason,
    actorUserId: user.id,
  });
  if (!r.ok) return { ok: false, error: r.error };

  safeRev("/prezenca");
  safeRev("/pagat");
  return { ok: true };
}

const dayPunchesSchema = z.object({
  employeeId: z.string().min(1),
  workDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function listDayPunchesAction(
  raw: unknown,
): Promise<TimeClockActionResult<PresencePunchDto[]>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId } = ctx.context;

  const parsed = dayPunchesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhënat nuk janë valide." };

  const punches = await listPunchesAroundDay(
    companyId,
    parsed.data.employeeId,
    parsed.data.workDateIso,
  );
  return { ok: true, data: punches };
}

const syncSchema = z.object({
  year: z.number().int().min(1970).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function syncTimeClockMonthToPayrollAction(
  raw: unknown,
): Promise<TimeClockActionResult<TimeClockSyncAccount>> {
  const ctx = await requireCapability("payroll.prepare");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user } = ctx.context;

  const parsed = syncSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Periudha nuk është valide." };

  if (!(await isTimeClockEnabled(companyId))) {
    return { ok: false, error: "Ora e punës nuk është e aktivizuar për këtë kompani." };
  }

  const r = await syncDraftPayrollForTimeClockMonth({
    companyId,
    year: parsed.data.year,
    month: parsed.data.month,
    actorUserId: user.id,
  });
  if (!r.ok) return { ok: false, error: r.error };

  safeRev("/prezenca");
  safeRev("/pagat");
  safeRev(`/pagat/${r.account.payrollId}`);
  return { ok: true, data: r.account };
}

const employeeMonthSchema = z.object({
  employeeId: z.string().min(1),
  year: z.number().int().min(1970).max(2100),
  month: z.number().int().min(1).max(12),
});

/** The employee profile's Prezenca tab — self-fetching panel, like AnnexPanel. */
export async function getEmployeePresenceMonthAction(
  raw: unknown,
): Promise<TimeClockActionResult<PresenceEmployeeDto | null>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId } = ctx.context;

  const parsed = employeeMonthSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhënat nuk janë valide." };

  const data = await getEmployeePresenceMonth(
    companyId,
    parsed.data.employeeId,
    parsed.data.year,
    parsed.data.month,
  );
  return { ok: true, data };
}

/**
 * Time-clock rules — rest days, punch rounding, automatic unpaid break.
 * They live with the time clock because that is the only thing they affect;
 * salaried expected-hours math is a separate concept and unchanged by these.
 */
export interface TimeclockRulesDto {
  /** 0 = Sunday … 6 = Saturday. */
  restDays: number[];
  /** 0 = off; otherwise 5/10/15 (nearest, symmetric). */
  punchRoundingMinutes: number;
  /** 0 = off; unpaid break auto-deducted from single-interval days over 6h. */
  breakDeductMinutes: number;
}

export async function loadTimeclockRulesAction(): Promise<TimeClockActionResult<TimeclockRulesDto>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };

  const settings = await prisma.payrollSettings.findUnique({
    where: { companyId: ctx.context.companyId },
    select: { restDays: true, punchRoundingMinutes: true, breakDeductMinutes: true },
  });
  return {
    ok: true,
    data: {
      restDays: settings?.restDays?.length ? settings.restDays : [0, 6],
      punchRoundingMinutes: settings?.punchRoundingMinutes ?? 0,
      breakDeductMinutes: settings?.breakDeductMinutes ?? 0,
    },
  };
}

const timeclockRulesSchema = z.object({
  restDays: z.array(z.number().int().min(0).max(6)).max(7),
  // Only grids where epoch rounding equals wall-clock rounding in whole-hour zones.
  punchRoundingMinutes: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(15)]),
  breakDeductMinutes: z.union([z.literal(0), z.literal(30), z.literal(45), z.literal(60)]),
});

export async function saveTimeclockRulesAction(raw: unknown): Promise<TimeClockActionResult> {
  const ctx = await requireCapability("company.settings");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId } = ctx.context;

  // The panel is hidden without the entitlement; the action refuses too —
  // hiding is presentation, not a gate.
  if (!(await isTimeClockEnabled(companyId))) {
    return { ok: false, error: "Ora e punës nuk është e aktivizuar për këtë kompani." };
  }

  const parsed = timeclockRulesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhënat nuk janë valide." };
  const restDays = [...new Set(parsed.data.restDays)].sort((a, b) => a - b);

  const updated = await prisma.payrollSettings.updateMany({
    where: { companyId },
    data: {
      restDays,
      punchRoundingMinutes: parsed.data.punchRoundingMinutes,
      breakDeductMinutes: parsed.data.breakDeductMinutes,
    },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Cilësimet e pagave nuk janë inicializuar ende për këtë kompani." };
  }

  safeRev("/prezenca");
  safeRev("/konfigurime");
  return { ok: true };
}
