"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { companyContextErrorMessage, getCompanyContext, requireCapability } from "@/server/company-context";
import { addManualPunch, voidPunch } from "@/modules/timeclock/services/timeclock-correction-service";
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
  /** ISO instant, minute precision from the dialog's datetime-local input. */
  occurredAtIso: z.string().datetime({ message: "Ora nuk është valide." }),
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

  const r = await addManualPunch({
    companyId,
    employeeId: parsed.data.employeeId,
    occurredAt: new Date(parsed.data.occurredAtIso),
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
