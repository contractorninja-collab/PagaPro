"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createDraftLeaveRequest,
  InsufficientLeaveBalanceError,
  rejectLeaveRequest,
  revokeApprovedLeaveRequest,
  submitLeaveRequest,
} from "@/modules/leaves/services/leave-workflow-service";
import { generateLeavePdfArtifact } from "@/modules/leaves/services/leave-document-service";
import { syncLeaveBalancesForCompanyYear } from "@/modules/leaves/services/leave-balance-service";
import { computeLeaveMetrics } from "@/modules/leaves/services/leave-calculation-service";
import { LEAVE_ENGINE_RULE_VERSION } from "@/modules/leaves/constants/rule-versions";
import {
  leaveGenerateDocSchema,
  leaveInterruptLinkSchema,
  leaveRangePreviewSchema,
  leaveRejectSchema,
  leaveRequestCreateSchema,
  leaveRequestIdSchema,
  leaveRevokeSchema,
} from "@/modules/leaves/validators/leave-schemas";
import { linkApprovedSickInterruptingAnnualLeave } from "@/modules/leaves/services/leave-interruption-service";

export type LeaveModuleActionResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      error: string;
      /** Set when the only obstacle is the accumulated balance — the UI offers the written override. */
      code?: "INSUFFICIENT_BALANCE";
    };

function safeRev(path: string) {
  try {
    revalidatePath(path);
  } catch {
    /* ignore */
  }
}

async function activeMembershipId(userId: string, companyId: string): Promise<string | null> {
  const membership = await prisma.userCompanyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { id: true },
  });
  return membership?.id ?? null;
}

export async function linkSickInterruptingAnnualLeaveAction(
  raw: unknown,
): Promise<LeaveModuleActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId, user } = ctx.context;
  const parsed = leaveInterruptLinkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  try {
    await linkApprovedSickInterruptingAnnualLeave({
      companyId,
      annualLeaveId: parsed.data.annualLeaveId,
      sickLeaveId: parsed.data.sickLeaveId,
      actorUserId: user.id,
    });
    safeRev("/pushimet");
    safeRev(`/pushimet/${parsed.data.annualLeaveId}`);
    safeRev(`/pushimet/${parsed.data.sickLeaveId}`);
    safeRev("/pagat");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lidhja dështoi." };
  }
}

export async function createLeaveRequestAction(
  raw: unknown,
): Promise<LeaveModuleActionResult<{ id: string }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId, user } = ctx.context;
  const parsed = leaveRequestCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  const start = new Date(parsed.data.startDateIso);
  const end = new Date(parsed.data.endDateIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Datat nuk janë valide." };
  }
  const { id } = await createDraftLeaveRequest({
    companyId,
    employeeId: parsed.data.employeeId,
    type: parsed.data.type,
    subtype: parsed.data.subtype ?? undefined,
    startDate: start,
    endDate: end,
    reason: parsed.data.reason,
    createdByUserId: user.id,
    balanceOverrideApprovedBy: parsed.data.balanceOverrideApprovedBy ?? null,
  });
  try {
    await submitLeaveRequest({ companyId, leaveId: id });
    safeRev("/pushimet");
    safeRev("/paneli");
    return { ok: true, data: { id } };
  } catch (e) {
    // The draft was created only to be submitted — a blocked submit would
    // otherwise leave a stray DRAFT behind on every retry of the dialog.
    await prisma.leaveRequest.deleteMany({ where: { id, companyId, status: "DRAFT" } });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Dështoi ruajtja.",
      ...(e instanceof InsufficientLeaveBalanceError ? { code: "INSUFFICIENT_BALANCE" as const } : {}),
    };
  }
}

export async function approveLeaveRequestAction(raw: unknown): Promise<LeaveModuleActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId, user } = ctx.context;
  const parsed =
    typeof raw === "string"
      ? leaveRequestIdSchema.safeParse({ leaveId: raw })
      : leaveRequestIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };
  try {
    await approveLeaveRequest({
      companyId,
      leaveId: parsed.data.leaveId,
      decidedByMembershipId: await activeMembershipId(user.id, companyId),
      actorUserId: user.id,
    });
    safeRev("/pushimet");
    safeRev("/paneli");
    safeRev("/pagat");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Miratimi dështoi." };
  }
}

export async function rejectLeaveRequestAction(raw: unknown): Promise<LeaveModuleActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId, user } = ctx.context;
  const parsed =
    typeof raw === "string"
      ? leaveRejectSchema.safeParse({ leaveId: raw })
      : leaveRejectSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  try {
    await rejectLeaveRequest({
      companyId,
      leaveId: parsed.data.leaveId,
      rejectionReason: parsed.data.rejectionReason,
      decidedByMembershipId: await activeMembershipId(user.id, companyId),
    });
    safeRev("/pushimet");
    safeRev("/paneli");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Refuzimi dështoi." };
  }
}

export async function cancelLeaveRequestAction(raw: unknown): Promise<LeaveModuleActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId } = ctx.context;
  const parsed =
    typeof raw === "string"
      ? leaveRequestIdSchema.safeParse({ leaveId: raw })
      : leaveRequestIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };
  try {
    await cancelLeaveRequest({ companyId, leaveId: parsed.data.leaveId });
    safeRev("/pushimet");
    safeRev("/paneli");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Anulimi dështoi." };
  }
}

export async function revokeLeaveRequestAction(raw: unknown): Promise<LeaveModuleActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId, user } = ctx.context;
  const parsed =
    typeof raw === "string"
      ? leaveRevokeSchema.safeParse({ leaveId: raw })
      : leaveRevokeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  try {
    await revokeApprovedLeaveRequest({
      companyId,
      leaveId: parsed.data.leaveId,
      reason: parsed.data.reason,
      actorUserId: user.id,
    });
    safeRev("/pushimet");
    safeRev(`/pushimet/${parsed.data.leaveId}`);
    safeRev("/paneli");
    safeRev("/pagat");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Revokimi dështoi." };
  }
}

export async function generateLeaveDocumentAction(
  raw: unknown,
): Promise<LeaveModuleActionResult<{ artifactId: string }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId, user } = ctx.context;
  const parsed = leaveGenerateDocSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  try {
    const artifactId = await generateLeavePdfArtifact({
      companyId,
      leaveRequestId: parsed.data.leaveRequestId,
      documentTemplateId: parsed.data.documentTemplateId,
      actorUserId: user.id,
    });
    safeRev("/pushimet");
    safeRev(`/pushimet/${parsed.data.leaveRequestId}`);
    return { ok: true, data: { artifactId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gjenerimi dështoi." };
  }
}

/**
 * Recompute every leave balance for one year on demand.
 *
 * The Pushimet page used to run this on every render — a serial per-employee
 * loop before any markup was produced. The write paths already keep balances
 * correct, so it is now an explicit action for the cases they cannot cover
 * (a policy change applied outside the app, a restored backup).
 */
export async function refreshLeaveBalancesAction(
  year: number,
): Promise<LeaveModuleActionResult<{ synced: number }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId } = ctx.context;

  const y = Number(year);
  if (!Number.isInteger(y) || y < 1970 || y > 2100) {
    return { ok: false, error: "Vit i pavlefshëm." };
  }

  try {
    const synced = await syncLeaveBalancesForCompanyYear(companyId, y);
    safeRev("/pushimet");
    return { ok: true, data: { synced } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Rifreskimi dështoi." };
  }
}

export interface LeaveRangePreview {
  workingDays: number;
  calendarDays: number;
  totalHours: string;
  /** Public holidays that fall on a weekday inside the range, by name. */
  holidayNames: string[];
  /** Null when the type carries no balance, or no balance row exists yet. */
  remainingBefore: string | null;
  remainingAfter: string | null;
  /** Colleagues already approved or pending off during the same span. */
  colleaguesOff: number;
  /** True when the end date precedes the start — the form allows it. */
  reversed: boolean;
}

/**
 * What the request would mean, before it is submitted.
 *
 * Today the operator learns about an insufficient balance only after sending it
 * and reading a rejection, and learns about colleagues being away not at all.
 * All of this is DB-bound — holidays, hours-per-day, balances — so it cannot run
 * inside the client dialog; one action answers the lot in a single round trip.
 */
export async function previewLeaveRangeAction(
  raw: unknown,
): Promise<LeaveModuleActionResult<LeaveRangePreview>> {
  try {
    const ctx = await getCompanyContext();
    if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
    const { companyId } = ctx.context;

    const parsed = leaveRangePreviewSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Vlera jo valide." };

    const start = new Date(parsed.data.startDateIso);
    const end = new Date(parsed.data.endDateIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false, error: "Datat nuk janë valide." };
    }
    if (end < start) {
      return {
        ok: true,
        data: {
          workingDays: 0,
          calendarDays: 0,
          totalHours: "0",
          holidayNames: [],
          remainingBefore: null,
          remainingAfter: null,
          colleaguesOff: 0,
          reversed: true,
        },
      };
    }

    // Same rule version the draft will be written with, so the strip cannot
    // promise a different number of days than the saved record.
    const metrics = await computeLeaveMetrics(companyId, start, end, LEAVE_ENGINE_RULE_VERSION);

    const [holidays, balance, colleaguesOff] = await Promise.all([
      metrics.weekdayHolidayDatesInRange.length > 0
        ? prisma.companyHoliday.findMany({
            where: {
              companyId,
              isActive: true,
              observedOn: { in: metrics.weekdayHolidayDatesInRange },
            },
            select: { name: true },
          })
        : Promise.resolve([] as Array<{ name: string }>),
      prisma.leaveBalance.findFirst({
        where: {
          companyId,
          employeeId: parsed.data.employeeId,
          leaveType: parsed.data.type,
          year: start.getUTCFullYear(),
        },
        select: { remainingDays: true },
      }),
      prisma.leaveRequest.count({
        where: {
          companyId,
          employeeId: { not: parsed.data.employeeId },
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      }),
    ]);

    const before = balance ? Number(balance.remainingDays) : null;
    const after = before == null ? null : before - metrics.workingDays;

    return {
      ok: true,
      data: {
        workingDays: metrics.workingDays,
        calendarDays: metrics.calendarDays,
        totalHours: metrics.totalHours,
        holidayNames: holidays.map((h) => h.name),
        remainingBefore: before == null ? null : before.toFixed(2),
        remainingAfter: after == null ? null : after.toFixed(2),
        colleaguesOff,
        reversed: false,
      },
    };
  } catch (err) {
    console.error("[previewLeaveRangeAction] failed:", err);
    return { ok: false, error: "Llogaritja e periudhës dështoi." };
  }
}
