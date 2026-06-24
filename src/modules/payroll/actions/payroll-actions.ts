"use server";

import { revalidatePath } from "next/cache";
import type { PayrollCorrectionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveActiveCompanyId } from "@/server/company-scope";
import {
  approvePayroll,
  archivePayroll,
  createPayrollDraft,
  lockPayrollWithSnapshot,
  patchPayrollEntriesBulk,
  regeneratePayrollEntriesAndCalculate,
  returnPayrollReviewToDraft,
  reviewPayrollExplicit,
  updatePayrollEntryAmounts,
  validatePayrollSpreadsheet,
} from "@/modules/payroll/services/payroll-period-service";
import { generatePayrollPdfArtifacts } from "@/modules/payroll/services/payroll-pdf-service";
import {
  archivePayrollAtkExport,
  generatePayrollAtkExport,
} from "@/modules/payroll/atk/services/atk-payroll-export-service";
import { createPayrollCorrection } from "@/modules/payroll/services/payroll-correction-service";
import {
  payrollBulkPatchSchema,
  payrollCorrectionCreateSchema,
  payrollCreateSchema,
  payrollEntryPatchSchema,
  payrollSelectionPreviewSchema,
  formatPayrollFieldErrors,
} from "@/modules/payroll/validators/payroll-schemas";
import { resolvePayrollMonthWorkingTime } from "@/modules/payroll/services/payroll-working-time-service";
import { listEmployeesEligibleForPayrollSelection } from "@/modules/payroll/services/payroll-selection-service";

export type PayrollActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function companyIdOrFail(): Promise<string | null> {
  return resolveActiveCompanyId();
}

/** Avoid surfacing 500s from rare cache/revalidate failures after successful mutations. */
function safeRevalidatePath(path: string): void {
  try {
    revalidatePath(path);
  } catch (err) {
    console.error("[pagapro] payroll-actions: revalidatePath failed:", path, err);
  }
}

export async function payrollSelectionPreviewAction(
  raw: unknown,
): Promise<
  PayrollActionResult<{
    expectedWorkingDays: number;
    expectedRegularHours: string;
    hoursPerWorkingDay: string;
    weekdayPublicHolidayDates: string[];
    multiplierPreview: {
      overtime: string;
      weekend: string;
      holiday: string;
      night: string;
    };
    employees: Awaited<ReturnType<typeof listEmployeesEligibleForPayrollSelection>>;
  }>
> {
  const companyId = await companyIdOrFail();
  if (!companyId) {
    return { ok: false, error: "Nuk ka kompani aktive për këtë sesion." };
  }
  const parsed = payrollSelectionPreviewSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem korrigjoni fushat.",
      fieldErrors: formatPayrollFieldErrors(parsed.error),
    };
  }
  const { year, month } = parsed.data;
  const wt = await resolvePayrollMonthWorkingTime(companyId, year, month);
  const settings = await prisma.payrollSettings.findUnique({ where: { companyId } });
  if (!wt || !settings) {
    return { ok: false, error: "Mungon PayrollSettings për këtë kompani." };
  }
  const employees = await listEmployeesEligibleForPayrollSelection(companyId, year, month);
  return {
    ok: true,
    data: {
      expectedWorkingDays: wt.expectedWorkingDays,
      expectedRegularHours: wt.expectedRegularHours,
      hoursPerWorkingDay: wt.hoursPerWorkingDay,
      weekdayPublicHolidayDates: wt.weekdayPublicHolidayDates,
      multiplierPreview: {
        overtime: settings.overtimeMultiplier.toString(),
        weekend: settings.weekendMultiplier.toString(),
        holiday: settings.holidayMultiplier.toString(),
        night: settings.nightWorkMultiplier.toString(),
      },
      employees,
    },
  };
}

export async function createPayrollDraftAction(raw: unknown): Promise<PayrollActionResult<{ id: string }>> {
  const companyId = await companyIdOrFail();
  if (!companyId) {
    return { ok: false, error: "Nuk ka kompani aktive për këtë sesion." };
  }
  const parsed = payrollCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem korrigjoni fushat.",
      fieldErrors: formatPayrollFieldErrors(parsed.error),
    };
  }
  const res = await createPayrollDraft(
    companyId,
    parsed.data.year,
    parsed.data.month,
    null,
    parsed.data.employeeIds,
  );
  if (!res.ok) {
    const msg =
      res.code === "DUPLICATE"
        ? res.message
        : res.code === "NO_PARAMS"
          ? res.message
          : res.code === "INVALID_SELECTION"
            ? res.message
            : res.message ?? "Krijimi dështoi.";
    return { ok: false, error: msg ?? "Krijimi dështoi." };
  }
  safeRevalidatePath("/pagat");
  return { ok: true, data: { id: res.id } };
}

export async function regeneratePayrollAction(payrollId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const res = await regeneratePayrollEntriesAndCalculate(companyId, payrollId, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true };
}

export async function reviewPayrollAction(payrollId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const res = await reviewPayrollExplicit(companyId, payrollId, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true };
}

export async function returnPayrollReviewToDraftAction(payrollId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const res = await returnPayrollReviewToDraft(companyId, payrollId, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true };
}

export async function approvePayrollAction(payrollId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const res = await approvePayroll(companyId, payrollId, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true };
}

export async function validatePayrollAction(payrollId: string): Promise<PayrollActionResult<{ warnings: string[] }>> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const res = await validatePayrollSpreadsheet(companyId, payrollId);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true, data: { warnings: res.warnings } };
}

export async function lockPayrollAction(payrollId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const res = await lockPayrollWithSnapshot(companyId, payrollId, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true };
}

export async function archivePayrollAction(payrollId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const res = await archivePayroll(companyId, payrollId, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true };
}

export async function generatePayrollAtkExportAction(payrollId: string): Promise<PayrollActionResult<{ exportId: string }>> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const res = await generatePayrollAtkExport({ companyId, payrollId, actorUserId: null });
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true, data: { exportId: res.exportId } };
}

export async function archivePayrollAtkExportAction(exportId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const row = await prisma.payrollATKExport.findFirst({
    where: { id: exportId, companyId },
    select: { payrollId: true },
  });
  if (!row) return { ok: false, error: "Eksporti nuk u gjet." };

  const res = await archivePayrollAtkExport({ companyId, exportId, actorUserId: null });
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${row.payrollId}`);
  return { ok: true };
}

export async function generatePayrollPdfsAction(payrollId: string): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId },
    select: { status: true },
  });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status === "LOCKED" || payroll.status === "ARCHIVED") {
    return {
      ok: false,
      error: "Pas kyçjes, PDF-t nuk rigjenerohen — shkarkoni nga lista më poshtë.",
    };
  }

  const res = await generatePayrollPdfArtifacts({ companyId, payrollId, actorUserId: null });
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath("/pagat");
  safeRevalidatePath(`/pagat/${payrollId}`);
  return { ok: true };
}

export async function updatePayrollEntryAction(raw: unknown): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const parsed = payrollEntryPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Të dhënat nuk janë valide.",
      fieldErrors: formatPayrollFieldErrors(parsed.error),
    };
  }
  const { payrollId, entryId, ...patch } = parsed.data;
  void payrollId;
  const res = await updatePayrollEntryAmounts(companyId, entryId, patch, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath(`/pagat/${parsed.data.payrollId}`);
  return { ok: true };
}

export async function patchPayrollEntriesBulkAction(raw: unknown): Promise<PayrollActionResult> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const parsed = payrollBulkPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Të dhënat nuk janë valide.",
      fieldErrors: formatPayrollFieldErrors(parsed.error),
    };
  }
  const rows = parsed.data.rows.map((r) => {
    const { entryId, ...rest } = r;
    return { entryId, patch: rest };
  });
  const res = await patchPayrollEntriesBulk(companyId, parsed.data.payrollId, rows, null);
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath(`/pagat/${parsed.data.payrollId}`);
  return { ok: true };
}

export async function createPayrollCorrectionAction(raw: unknown): Promise<PayrollActionResult<{ id: string }>> {
  const companyId = await companyIdOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const parsed = payrollCorrectionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Të dhënat nuk janë valide.",
      fieldErrors: formatPayrollFieldErrors(parsed.error),
    };
  }
  const res = await createPayrollCorrection({
    companyId,
    payrollId: parsed.data.payrollId,
    employeeId: parsed.data.employeeId,
    kind: parsed.data.kind as PayrollCorrectionKind,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    actorUserId: null,
  });
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidatePath(`/pagat/${parsed.data.payrollId}`);
  return { ok: true, data: { id: res.id } };
}
