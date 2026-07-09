"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createDraftLeaveRequest,
  rejectLeaveRequest,
  revokeApprovedLeaveRequest,
  submitLeaveRequest,
} from "@/modules/leaves/services/leave-workflow-service";
import { generateLeavePdfArtifact } from "@/modules/leaves/services/leave-document-service";
import {
  leaveGenerateDocSchema,
  leaveInterruptLinkSchema,
  leaveRejectSchema,
  leaveRequestCreateSchema,
  leaveRequestIdSchema,
  leaveRevokeSchema,
} from "@/modules/leaves/validators/leave-schemas";
import { linkApprovedSickInterruptingAnnualLeave } from "@/modules/leaves/services/leave-interruption-service";

export type LeaveModuleActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

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
  const { companyId } = ctx.context;
  const parsed = leaveInterruptLinkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  try {
    await linkApprovedSickInterruptingAnnualLeave({
      companyId,
      annualLeaveId: parsed.data.annualLeaveId,
      sickLeaveId: parsed.data.sickLeaveId,
    });
    safeRev("/pushimet");
    safeRev(`/pushimet/${parsed.data.annualLeaveId}`);
    safeRev(`/pushimet/${parsed.data.sickLeaveId}`);
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
  try {
    const { id } = await createDraftLeaveRequest({
      companyId,
      employeeId: parsed.data.employeeId,
      type: parsed.data.type,
      subtype: parsed.data.subtype ?? undefined,
      startDate: start,
      endDate: end,
      reason: parsed.data.reason,
      createdByUserId: user.id,
    });
    await submitLeaveRequest({ companyId, leaveId: id });
    safeRev("/pushimet");
    safeRev("/paneli");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Dështoi ruajtja." };
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
    });
    safeRev("/pushimet");
    safeRev("/paneli");
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
  const { companyId } = ctx.context;
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
    });
    safeRev("/pushimet");
    safeRev(`/pushimet/${parsed.data.leaveId}`);
    safeRev("/paneli");
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
