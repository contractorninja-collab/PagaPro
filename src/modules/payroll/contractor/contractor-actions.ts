"use server";

import { revalidatePath } from "next/cache";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import {
  createContractorPayrollPeriod,
  lockContractorPayrollPeriod,
  regenerateContractorPayrollEntries,
  reopenContractorPayrollPeriod,
  syncContractorEntryFromTimeClock,
  updateContractorEntryHours,
} from "@/modules/payroll/contractor/contractor-payroll-service";
import {
  contractorEntryHoursSchema,
  contractorEntrySyncSchema,
  contractorPeriodCreateSchema,
  contractorPeriodIdSchema,
  formatContractorFieldErrors,
} from "@/modules/payroll/contractor/contractor-schemas";

export type ContractorActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const CODE_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Periudha ose rreshti nuk u gjet.",
  NOT_ENABLED: "Payroll-i i kontraktorëve nuk është aktivizuar për këtë kompani.",
  DUPLICATE_PERIOD: "Ekziston tashmë një periudhë kontraktorësh për këtë muaj.",
  NOT_EDITABLE: "Kjo periudhë nuk mund të modifikohet në këtë status (vetëm DRAFT).",
  NO_CONTRACTORS:
    "Nuk ka kontraktorë aktivë për këtë muaj. Shtoni punonjës me tip punësimi 'Kontraktor' te moduli Punonjësit.",
  NO_HOURLY_RATE: "Kontraktorit i mungon tarifa orare.",
  NOT_HOURLY:
    "Ky kontraktor paguhet me pagë mujore fikse — orët nuk ndikojnë në pagesë, prandaj plotësimi nga ora e punës nuk aplikohet.",
  ERROR: "Ndodhi një gabim i papritur. Provoni përsëri.",
};

function codeMessage(code: string): string {
  return CODE_MESSAGES[code] ?? CODE_MESSAGES.ERROR!;
}

function safeRevalidate(path: string): void {
  try {
    revalidatePath(path);
  } catch (err) {
    console.error("[pagapro] contractor-actions: revalidatePath failed:", path, err);
  }
}

export async function createContractorPayrollAction(
  raw: unknown,
): Promise<ContractorActionResult<{ id: string }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = contractorPeriodCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem korrigjoni fushat.",
      fieldErrors: formatContractorFieldErrors(parsed.error),
    };
  }
  const result = await createContractorPayrollPeriod({
    companyId: ctx.context.companyId,
    year: parsed.data.year,
    month: parsed.data.month,
    actorUserId: ctx.context.user.id,
  });
  if (!result.ok) return { ok: false, error: codeMessage(result.code) };
  safeRevalidate("/pagat/kontraktor");
  return { ok: true, data: result.data };
}

export async function updateContractorEntryHoursAction(
  raw: unknown,
): Promise<ContractorActionResult<{ grossPay: string }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = contractorEntryHoursSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem korrigjoni fushat.",
      fieldErrors: formatContractorFieldErrors(parsed.error),
    };
  }
  const result = await updateContractorEntryHours({
    companyId: ctx.context.companyId,
    periodId: parsed.data.periodId,
    entryId: parsed.data.entryId,
    hours: {
      regularHours: String(parsed.data.regularHours),
      overtimeHours: String(parsed.data.overtimeHours),
      weekendHours: String(parsed.data.weekendHours),
      holidayHours: String(parsed.data.holidayHours),
      nightHours: String(parsed.data.nightHours),
    },
    monthlyFlatAmount:
      parsed.data.monthlyFlatAmount === undefined
        ? undefined
        : String(parsed.data.monthlyFlatAmount),
    notes: parsed.data.notes,
  });
  if (!result.ok) return { ok: false, error: codeMessage(result.code) };
  safeRevalidate(`/pagat/kontraktor/${parsed.data.periodId}`);
  return { ok: true, data: result.data };
}

export async function syncContractorEntryFromTimeClockAction(
  raw: unknown,
): Promise<ContractorActionResult<{ grossPay: string; daysNeedingReview: number }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = contractorEntrySyncSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };
  const result = await syncContractorEntryFromTimeClock({
    companyId: ctx.context.companyId,
    periodId: parsed.data.periodId,
    entryId: parsed.data.entryId,
  });
  if (!result.ok) return { ok: false, error: codeMessage(result.code) };
  safeRevalidate(`/pagat/kontraktor/${parsed.data.periodId}`);
  return { ok: true, data: result.data };
}

export async function regenerateContractorEntriesAction(
  raw: unknown,
): Promise<ContractorActionResult<{ updated: number }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = contractorPeriodIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };
  const result = await regenerateContractorPayrollEntries(
    ctx.context.companyId,
    parsed.data.periodId,
  );
  if (!result.ok) return { ok: false, error: codeMessage(result.code) };
  safeRevalidate(`/pagat/kontraktor/${parsed.data.periodId}`);
  return { ok: true, data: result.data };
}

export async function lockContractorPayrollAction(
  raw: unknown,
): Promise<ContractorActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = contractorPeriodIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };
  const result = await lockContractorPayrollPeriod({
    companyId: ctx.context.companyId,
    periodId: parsed.data.periodId,
    actorUserId: ctx.context.user.id,
  });
  if (!result.ok) return { ok: false, error: codeMessage(result.code) };
  safeRevalidate(`/pagat/kontraktor/${parsed.data.periodId}`);
  safeRevalidate("/pagat/kontraktor");
  return { ok: true };
}

export async function reopenContractorPayrollAction(
  raw: unknown,
): Promise<ContractorActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = contractorPeriodIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };
  const result = await reopenContractorPayrollPeriod({
    companyId: ctx.context.companyId,
    periodId: parsed.data.periodId,
  });
  if (!result.ok) return { ok: false, error: codeMessage(result.code) };
  safeRevalidate(`/pagat/kontraktor/${parsed.data.periodId}`);
  safeRevalidate("/pagat/kontraktor");
  return { ok: true };
}
