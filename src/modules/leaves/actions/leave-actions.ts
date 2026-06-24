"use server";

import { revalidatePath } from "next/cache";
import { resolveActiveCompanyId } from "@/server/company-scope";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createDraftLeaveRequest,
  rejectLeaveRequest,
  submitLeaveRequest,
} from "@/modules/leaves/services/leave-workflow-service";
import { generateLeavePdfArtifact } from "@/modules/leaves/services/leave-document-service";
import {
  leaveGenerateDocSchema,
  leaveInterruptLinkSchema,
  leaveRejectSchema,
  leaveRequestCreateSchema,
  leaveRequestIdSchema,
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

export async function linkSickInterruptingAnnualLeaveAction(
  raw: unknown,
): Promise<LeaveModuleActionResult> {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
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
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
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
      createdByUserId: null,
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
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const parsed =
    typeof raw === "string"
      ? leaveRequestIdSchema.safeParse({ leaveId: raw })
      : leaveRequestIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };
  try {
    await approveLeaveRequest({ companyId, leaveId: parsed.data.leaveId, decidedByMembershipId: null });
    safeRev("/pushimet");
    safeRev("/paneli");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Miratimi dështoi." };
  }
}

export async function rejectLeaveRequestAction(raw: unknown): Promise<LeaveModuleActionResult> {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
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
      decidedByMembershipId: null,
    });
    safeRev("/pushimet");
    safeRev("/paneli");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Refuzimi dështoi." };
  }
}

export async function cancelLeaveRequestAction(raw: unknown): Promise<LeaveModuleActionResult> {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
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

export async function generateLeaveDocumentAction(
  raw: unknown,
): Promise<LeaveModuleActionResult<{ artifactId: string }>> {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };
  const parsed = leaveGenerateDocSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  try {
    const artifactId = await generateLeavePdfArtifact({
      companyId,
      leaveRequestId: parsed.data.leaveRequestId,
      documentTemplateId: parsed.data.documentTemplateId,
    });
    safeRev("/pushimet");
    safeRev(`/pushimet/${parsed.data.leaveRequestId}`);
    return { ok: true, data: { artifactId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gjenerimi dështoi." };
  }
}
