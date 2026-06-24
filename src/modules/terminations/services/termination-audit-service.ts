import type { Prisma } from "@prisma/client";
import { DomainActivityVerb, TimelineEventSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendEmployeeTimeline } from "@/modules/employees/services/employee-audit";
import { TERMINATION_ENTITY, TERMINATION_TIMELINE } from "@/modules/terminations/types";

export { TERMINATION_TIMELINE };

export async function appendTerminationDomainActivity(params: {
  companyId: string;
  terminationId: string;
  employeeId: string;
  verb: DomainActivityVerb;
  summary: string;
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue;
}): Promise<void> {
  const base = {
    companyId: params.companyId,
    employeeId: params.employeeId,
    terminationId: params.terminationId,
  };
  await prisma.domainActivity.create({
    data: {
      companyId: params.companyId,
      entityType: TERMINATION_ENTITY,
      entityId: params.terminationId,
      verb: params.verb,
      summary: params.summary,
      actorUserId: params.actorUserId ?? undefined,
      payload: { ...(params.payload as object), ...base },
    },
  });
}

export async function appendTerminationAuditLog(params: {
  companyId: string;
  terminationId: string;
  action: string;
  actorUserId?: string | null;
  diff?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId,
      entityType: TERMINATION_ENTITY,
      entityId: params.terminationId,
      action: params.action,
      actorUserId: params.actorUserId ?? undefined,
      diff: params.diff ?? undefined,
    },
  });
}

export async function appendTerminationEmployeeTimeline(params: {
  companyId: string;
  employeeId: string;
  eventType: string;
  title: string;
  body?: string | null;
  actorUserId?: string | null;
  terminationId: string;
}): Promise<void> {
  await appendEmployeeTimeline({
    companyId: params.companyId,
    employeeId: params.employeeId,
    eventType: params.eventType,
    title: params.title,
    body: params.body ?? undefined,
    severity: TimelineEventSeverity.INFO,
    actorUserId: params.actorUserId,
    metadata: {
      subjectKind: "Termination",
      subjectId: params.terminationId,
    } as Prisma.InputJsonValue,
  });
}
