import type { Prisma } from "@prisma/client";
import {
  DomainActivityVerb,
  EmployeeHistoryEventKind,
  TimelineEventSeverity,
  type EmploymentStatus,
  type EmploymentType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const EMPLOYEE_ENTITY = "Employee";

export const TIMELINE_TYPES = {
  CREATED: "EMPLOYEE_CREATED",
  UPDATED: "EMPLOYEE_UPDATED",
  STATUS_CHANGED: "EMPLOYEE_STATUS_CHANGED",
  ARCHIVED: "EMPLOYEE_ARCHIVED",
  TERMINATED: "EMPLOYEE_TERMINATED",
} as const;

export async function appendEmployeeEmploymentHistory(params: {
  companyId: string;
  employeeId: string;
  kind: EmployeeHistoryEventKind;
  title: string;
  description?: string | null;
  departmentId?: string | null;
  jobTitle?: string | null;
  employmentType?: EmploymentType | null;
  status?: EmploymentStatus | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.employeeEmploymentHistory.create({
    data: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      kind: params.kind,
      title: params.title,
      description: params.description ?? undefined,
      departmentId: params.departmentId ?? undefined,
      jobTitle: params.jobTitle ?? undefined,
      employmentType: params.employmentType ?? undefined,
      status: params.status ?? undefined,
      metadata: params.metadata ?? undefined,
    },
  });
}

export async function appendEmployeeTimeline(params: {
  companyId: string;
  employeeId: string;
  eventType: string;
  title: string;
  body?: string | null;
  severity?: TimelineEventSeverity;
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.employeeTimelineEvent.create({
    data: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      eventType: params.eventType,
      title: params.title,
      body: params.body ?? undefined,
      severity: params.severity ?? TimelineEventSeverity.INFO,
      actorUserId: params.actorUserId ?? undefined,
      metadata: params.metadata ?? undefined,
    },
  });
}

export async function appendDomainEmployeeActivity(params: {
  companyId: string;
  employeeId: string;
  verb: DomainActivityVerb;
  summary: string;
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.domainActivity.create({
    data: {
      companyId: params.companyId,
      entityType: EMPLOYEE_ENTITY,
      entityId: params.employeeId,
      verb: params.verb,
      summary: params.summary,
      actorUserId: params.actorUserId ?? undefined,
      payload: params.payload ?? undefined,
    },
  });
}

export async function appendEmployeeAuditLog(params: {
  companyId: string;
  employeeId: string;
  action: string;
  actorUserId?: string | null;
  diff?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId,
      entityType: EMPLOYEE_ENTITY,
      entityId: params.employeeId,
      action: params.action,
      actorUserId: params.actorUserId ?? undefined,
      diff: params.diff ?? undefined,
    },
  });
}
