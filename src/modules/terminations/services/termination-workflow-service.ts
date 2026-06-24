import { Prisma, EmployeeHistoryEventKind, DomainActivityVerb } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyEmployeeTerminationOutcome } from "@/modules/employees/services/employee-service";
import {
  appendEmployeeEmploymentHistory,
  appendEmployeeAuditLog as appendEmpAuditLog,
  appendDomainEmployeeActivity as appendEmpDomainActivity,
  appendEmployeeTimeline,
  TIMELINE_TYPES,
} from "@/modules/employees/services/employee-audit";
import { prepareTerminationFinalPayroll } from "@/modules/terminations/payroll/prepare-final-payroll";
import { defaultTerminationChecklistRows, CHECKLIST_KEYS } from "@/modules/terminations/checklists/default-checklist";
import { generateTerminationArtifact } from "@/modules/terminations/documents/generate-termination-document";
import {
  appendTerminationAuditLog,
  appendTerminationDomainActivity,
  appendTerminationEmployeeTimeline,
  TERMINATION_TIMELINE,
} from "@/modules/terminations/services/termination-audit-service";
import type { terminationCreateSchema, terminationUpdateSchema } from "@/modules/terminations/validators/termination-schemas";
import type { z } from "zod";

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type CreateInput = z.infer<typeof terminationCreateSchema>;
type UpdateInput = z.infer<typeof terminationUpdateSchema>;

async function assertNoBlockingTermination(companyId: string, employeeId: string): Promise<void> {
  const open = await prisma.termination.findFirst({
    where: {
      companyId,
      employeeId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    select: { id: true },
  });
  if (open) {
    throw new Error("Ekziston tashmë një proces largimi aktiv për këtë punonjës.");
  }
}

async function loadTerminationOrThrow(companyId: string, id: string) {
  const row = await prisma.termination.findFirst({
    where: { id, companyId },
    include: { employee: true },
  });
  if (!row) throw new Error("Largimi nuk u gjet.");
  return row;
}

export async function createTerminationWorkflow(
  companyId: string,
  input: CreateInput,
  actorUserId: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const emp = await prisma.employee.findFirst({
      where: { id: input.employeeId, companyId },
    });
    if (!emp) throw new Error("Punonjësi nuk u gjet.");
    if (emp.status === "TERMINATED") throw new Error("Punonjësi është tashmë i larguar.");
    if (input.terminationDate.getTime() < emp.hireDate.getTime()) {
      throw new Error("Data e largimit nuk mund të jetë para datës së punësimit.");
    }

    await assertNoBlockingTermination(companyId, input.employeeId);

    const severance =
      input.severanceAmount?.trim() !== ""
        ? new Prisma.Decimal(input.severanceAmount!.replace(",", "."))
        : undefined;

    const row = await prisma.$transaction(async (tx) => {
      const t = await tx.termination.create({
        data: {
          companyId,
          employeeId: input.employeeId,
          type: input.type,
          status: "DRAFT",
          terminationDate: input.terminationDate,
          noticeDate: input.noticeDate ?? undefined,
          lastWorkingDay: input.lastWorkingDay,
          noticeDays: input.noticeDays ?? undefined,
          severanceAmount: severance,
          reason: input.reason?.trim() || undefined,
          details: input.details?.trim() || undefined,
          finalPayrollRequired: input.finalPayrollRequired ?? true,
          createdById: actorUserId ?? undefined,
        },
      });

      for (const item of defaultTerminationChecklistRows()) {
        await tx.terminationChecklist.create({
          data: {
            companyId,
            terminationId: t.id,
            itemKey: item.itemKey,
            label: item.label,
          },
        });
      }

      return t;
    });

    await appendTerminationEmployeeTimeline({
      companyId,
      employeeId: input.employeeId,
      terminationId: row.id,
      eventType: TERMINATION_TIMELINE.CREATED,
      title: "Largimi u krijua",
      actorUserId,
    });

    await appendTerminationDomainActivity({
      companyId,
      terminationId: row.id,
      employeeId: input.employeeId,
      verb: DomainActivityVerb.CREATED,
      summary: "U krijua një proces largimi.",
      actorUserId,
      payload: { type: input.type },
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: row.id,
      action: "TERMINATION_CREATED",
      actorUserId,
      diff: jsonSafe({ employeeId: input.employeeId, type: input.type }),
    });

    return { ok: true, id: row.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function updateTerminationWorkflow(
  companyId: string,
  input: UpdateInput,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const existing = await loadTerminationOrThrow(companyId, input.id);
    if (existing.status === "COMPLETED") throw new Error("Largimi i përfunduar nuk mund të editohet.");
    if (existing.status === "CANCELLED") throw new Error("Largimi është anuluar.");

    const payload: Prisma.TerminationUpdateInput = {};
    if (input.type !== undefined) payload.type = input.type;
    if (input.terminationDate !== undefined) {
      if (input.terminationDate.getTime() < existing.employee.hireDate.getTime()) {
        throw new Error("Data e largimit nuk mund të jetë para datës së punësimit.");
      }
      payload.terminationDate = input.terminationDate;
    }
    if (input.noticeDate !== undefined) payload.noticeDate = input.noticeDate;
    if (input.lastWorkingDay !== undefined) payload.lastWorkingDay = input.lastWorkingDay;
    if (input.noticeDays !== undefined) payload.noticeDays = input.noticeDays;
    if (input.reason !== undefined) payload.reason = input.reason?.trim() || null;
    if (input.details !== undefined) payload.details = input.details?.trim() || null;
    if (input.finalPayrollRequired !== undefined) payload.finalPayrollRequired = input.finalPayrollRequired;

    if (input.severanceAmount !== undefined) {
      const raw = input.severanceAmount?.trim() ?? "";
      payload.severanceAmount = raw !== "" ? new Prisma.Decimal(raw.replace(",", ".")) : null;
    }

    const typeForRules = input.type ?? existing.type;
    const reasonVal = input.reason !== undefined ? input.reason : existing.reason;
    const detailsVal = input.details !== undefined ? input.details : existing.details;
    if (typeForRules === "PA_PARALAJMERIM" || typeForRules === "NGA_PUNEDHENESI") {
      if (!(reasonVal?.trim())) throw new Error("Arsyeja është e detyrueshme për këtë lloj largimi.");
    }
    if (typeForRules === "MANUAL" && !(detailsVal?.trim())) {
      throw new Error("Detajet janë të detyrueshme për largim manual.");
    }

    await prisma.termination.update({
      where: { id: existing.id },
      data: payload,
    });

    await appendTerminationDomainActivity({
      companyId,
      terminationId: existing.id,
      employeeId: existing.employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Largimi u përditësua.",
      actorUserId,
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: existing.id,
      action: "TERMINATION_UPDATED",
      actorUserId,
      diff: jsonSafe(payload),
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function submitTerminationForReview(
  companyId: string,
  terminationId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await loadTerminationOrThrow(companyId, terminationId);
    if (row.status !== "DRAFT") throw new Error("Vetëm largimet në DRAFT mund të dërgohen në shqyrtim.");

    await prisma.termination.update({
      where: { id: row.id },
      data: { status: "PENDING_REVIEW" },
    });

    await appendTerminationDomainActivity({
      companyId,
      terminationId: row.id,
      employeeId: row.employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Largimi u dërgua në shqyrtim.",
      actorUserId,
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: row.id,
      action: "TERMINATION_SUBMITTED_REVIEW",
      actorUserId,
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function approveTerminationWorkflow(
  companyId: string,
  terminationId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await loadTerminationOrThrow(companyId, terminationId);
    if (row.status !== "PENDING_REVIEW") throw new Error("Miratimi kërkon status PENDING_REVIEW.");

    await prisma.termination.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: actorUserId ?? undefined,
      },
    });

    await appendTerminationEmployeeTimeline({
      companyId,
      employeeId: row.employeeId,
      terminationId: row.id,
      eventType: TERMINATION_TIMELINE.APPROVED,
      title: "Largimi u aprovua",
      actorUserId,
    });

    await appendTerminationDomainActivity({
      companyId,
      terminationId: row.id,
      employeeId: row.employeeId,
      verb: DomainActivityVerb.APPROVED,
      summary: "Largimi u miratua.",
      actorUserId,
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: row.id,
      action: "TERMINATION_APPROVED",
      actorUserId,
    });

    if (row.finalPayrollRequired) {
      const prep = await prepareTerminationFinalPayroll({
        companyId,
        employeeId: row.employeeId,
        lastWorkingDay: row.lastWorkingDay,
        actorUserId,
      });
      if (!prep.ok) {
        await prisma.termination.update({
          where: { id: row.id },
          data: {
            status: "PENDING_REVIEW",
            approvedAt: null,
            approvedById: null,
          },
        });
        return { ok: false, error: prep.error };
      }

      await prisma.termination.update({
        where: { id: row.id },
        data: { finalPayrollId: prep.payrollId },
      });

      await prisma.terminationChecklist.updateMany({
        where: { terminationId: row.id, itemKey: CHECKLIST_KEYS.FINAL_PAYROLL },
        data: {
          isCompleted: true,
          completedAt: new Date(),
          completedById: actorUserId ?? undefined,
        },
      });

      await appendTerminationEmployeeTimeline({
        companyId,
        employeeId: row.employeeId,
        terminationId: row.id,
        eventType: TERMINATION_TIMELINE.FINAL_PAYROLL_PREPARED,
        title: "Final payroll u përgatit",
        actorUserId,
      });

      await appendTerminationDomainActivity({
        companyId,
        terminationId: row.id,
        employeeId: row.employeeId,
        verb: DomainActivityVerb.UPDATED,
        summary: "Final payroll u përgatit (draft).",
        actorUserId,
        payload: { payrollId: prep.payrollId },
      });

      await appendTerminationAuditLog({
        companyId,
        terminationId: row.id,
        action: "TERMINATION_FINAL_PAYROLL_PREPARED",
        actorUserId,
        diff: jsonSafe({ payrollId: prep.payrollId }),
      });
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function prepareTerminationFinalPayrollAction(
  companyId: string,
  terminationId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await loadTerminationOrThrow(companyId, terminationId);
    if (row.status === "CANCELLED" || row.status === "COMPLETED") {
      throw new Error("Ky largim nuk pranon përgatitje të payroll-it.");
    }

    const prep = await prepareTerminationFinalPayroll({
      companyId,
      employeeId: row.employeeId,
      lastWorkingDay: row.lastWorkingDay,
      actorUserId,
    });
    if (!prep.ok) return { ok: false, error: prep.error };

    await prisma.termination.update({
      where: { id: row.id },
      data: { finalPayrollId: prep.payrollId },
    });

    await prisma.terminationChecklist.updateMany({
      where: { terminationId: row.id, itemKey: CHECKLIST_KEYS.FINAL_PAYROLL },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        completedById: actorUserId ?? undefined,
      },
    });

    await appendTerminationEmployeeTimeline({
      companyId,
      employeeId: row.employeeId,
      terminationId: row.id,
      eventType: TERMINATION_TIMELINE.FINAL_PAYROLL_PREPARED,
      title: "Final payroll u përgatit",
      actorUserId,
    });

    await appendTerminationDomainActivity({
      companyId,
      terminationId: row.id,
      employeeId: row.employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Final payroll u përgatit (draft).",
      actorUserId,
      payload: { payrollId: prep.payrollId },
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: row.id,
      action: "TERMINATION_FINAL_PAYROLL_PREPARED",
      actorUserId,
      diff: jsonSafe({ payrollId: prep.payrollId }),
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function generateTerminationDocumentAction(
  companyId: string,
  terminationId: string,
  actorUserId: string | null,
): Promise<{ ok: true; artifactId: string } | { ok: false; error: string }> {
  return generateTerminationArtifact({ companyId, terminationId, actorUserId });
}

export async function completeTerminationWorkflow(
  companyId: string,
  terminationId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await loadTerminationOrThrow(companyId, terminationId);
    if (row.status !== "APPROVED") throw new Error("Përfundimi kërkon status APPROVED.");
    if (row.employee.status === "TERMINATED") {
      throw new Error("Punonjësi është tashmë i shënuar si i larguar.");
    }

    if (row.finalPayrollRequired) {
      if (!row.finalPayrollId) throw new Error("Final payroll është i detyrueshëm — përgatiteni para përfundimit.");
      const payroll = await prisma.payroll.findFirst({
        where: { id: row.finalPayrollId, companyId },
      });
      if (!payroll || payroll.status !== "DRAFT") {
        throw new Error("Final payroll duhet të jetë i lidhur me një payroll në DRAFT (HR nuk duhet ta kyçë para përfundimit).");
      }
      const entry = await prisma.payrollEntry.findFirst({
        where: { payrollId: row.finalPayrollId, employeeId: row.employeeId },
      });
      if (!entry || entry.status !== "DRAFT") {
        throw new Error("Rreshti i pagës për punonjësin duhet të jetë në DRAFT për përfundim.");
      }
    }

    const reasonText = row.reason?.trim() || row.details?.trim() || "Largim";

    await prisma.$transaction(async (tx) => {
      await applyEmployeeTerminationOutcome({
        tx,
        employeeId: row.employeeId,
        terminationDate: row.terminationDate,
        terminationReason: reasonText,
        employmentTerminationRecordId: row.id,
      });

      await tx.termination.update({
        where: { id: row.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await tx.terminationChecklist.updateMany({
        where: { terminationId: row.id, itemKey: CHECKLIST_KEYS.EMPLOYEE_MARKED_LEFT },
        data: {
          isCompleted: true,
          completedAt: new Date(),
          completedById: actorUserId ?? undefined,
        },
      });
    });

    await appendTerminationEmployeeTimeline({
      companyId,
      employeeId: row.employeeId,
      terminationId: row.id,
      eventType: TERMINATION_TIMELINE.EMPLOYEE_TERMINATED,
      title: "Punonjësi u shënua si i larguar",
      body: reasonText,
      actorUserId,
    });

    await appendTerminationDomainActivity({
      companyId,
      terminationId: row.id,
      employeeId: row.employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Largimi u përfundua — punonjësi u shënua TERMINATED.",
      actorUserId,
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: row.id,
      action: "TERMINATION_COMPLETED",
      actorUserId,
    });

    try {
      await appendEmployeeEmploymentHistory({
        companyId,
        employeeId: row.employeeId,
        kind: EmployeeHistoryEventKind.TERMINATED,
        title: "Punonjësi u largua",
        description: reasonText,
        status: "TERMINATED",
        metadata: jsonSafe({
          terminationId: row.id,
          terminationDate: row.terminationDate.toISOString(),
        }),
      });
      await appendEmployeeTimeline({
        companyId,
        employeeId: row.employeeId,
        eventType: TIMELINE_TYPES.TERMINATED,
        title: "Punonjësi u largua",
        body: reasonText,
        actorUserId,
      });
      await appendEmpDomainActivity({
        companyId,
        employeeId: row.employeeId,
        verb: DomainActivityVerb.UPDATED,
        summary: "Punonjësi u largua",
        actorUserId,
        payload: jsonSafe({
          terminationDate: row.terminationDate.toISOString(),
          terminationReason: reasonText,
          terminationWorkflowId: row.id,
        }),
      });
      await appendEmpAuditLog({
        companyId,
        employeeId: row.employeeId,
        action: "EMPLOYEE_TERMINATE",
        actorUserId,
        diff: jsonSafe({
          terminationDate: row.terminationDate.toISOString(),
          terminationReason: reasonText,
          terminationWorkflowId: row.id,
        }),
      });
    } catch (err) {
      console.error("[terminations] employee audit after completion failed:", err);
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function cancelTerminationWorkflow(
  companyId: string,
  terminationId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await loadTerminationOrThrow(companyId, terminationId);
    if (row.status === "COMPLETED") throw new Error("Nuk mund të anulohet një largim i përfunduar.");

    if (row.finalPayrollId) {
      const payroll = await prisma.payroll.findFirst({
        where: { id: row.finalPayrollId, companyId },
      });
      if (payroll && payroll.status !== "DRAFT") {
        throw new Error(
          "Ky largim është lidhur me një payroll që nuk është më në DRAFT — anulimi do të prekte payroll-in.",
        );
      }
    }

    await prisma.termination.update({
      where: { id: row.id },
      data: { status: "CANCELLED", finalPayrollId: null },
    });

    await appendTerminationEmployeeTimeline({
      companyId,
      employeeId: row.employeeId,
      terminationId: row.id,
      eventType: TERMINATION_TIMELINE.CANCELLED,
      title: "Largimi u anulua",
      actorUserId,
    });

    await appendTerminationDomainActivity({
      companyId,
      terminationId: row.id,
      employeeId: row.employeeId,
      verb: DomainActivityVerb.VOIDED,
      summary: "Largimi u anulua.",
      actorUserId,
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: row.id,
      action: "TERMINATION_CANCELLED",
      actorUserId,
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function toggleTerminationChecklist(
  companyId: string,
  terminationId: string,
  itemKey: string,
  isCompleted: boolean,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await loadTerminationOrThrow(companyId, terminationId);
    if (row.status === "COMPLETED") throw new Error("Lista e kontrollit është vetëm leximi.");

    const item = await prisma.terminationChecklist.findFirst({
      where: { terminationId: row.id, itemKey, companyId },
    });
    if (!item) throw new Error("Artikulli i listës nuk u gjet.");

    await prisma.terminationChecklist.update({
      where: { id: item.id },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedById: isCompleted ? actorUserId ?? undefined : null,
      },
    });

    await appendTerminationAuditLog({
      companyId,
      terminationId: row.id,
      action: "TERMINATION_CHECKLIST_TOGGLE",
      actorUserId,
      diff: jsonSafe({ itemKey, isCompleted }),
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
