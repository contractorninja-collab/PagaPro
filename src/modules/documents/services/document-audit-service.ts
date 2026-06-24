import type { DomainActivityVerb, Prisma, PrismaClient } from "@prisma/client";
import { TimelineEventSeverity } from "@prisma/client";

export const DOCUMENT_ENTITY_TEMPLATE = "DocumentTemplate";
export const DOCUMENT_ENTITY_TEMPLATE_VERSION = "DocumentTemplateVersion";
export const DOCUMENT_ENTITY_ARTIFACT = "DocumentGenerationArtifact";

export const DOCUMENT_MODULE_TIMELINE = {
  TEMPLATE_UPLOADED: "DOCUMENT_TEMPLATE_UPLOADED",
  TEMPLATE_MAPPING_UPDATED: "TEMPLATE_MAPPING_UPDATED",
  DOCUMENT_PREVIEWED: "DOCUMENT_PREVIEWED",
  DOCUMENT_GENERATED: "DOCUMENT_GENERATED",
  DOCUMENT_DOWNLOADED: "DOCUMENT_DOWNLOADED",
  DOCUMENT_ARCHIVED: "DOCUMENT_ARCHIVED",
  DOCUMENT_REGENERATED: "DOCUMENT_REGENERATED",
} as const;

export async function appendDocumentTimelineEvent(params: {
  prisma: PrismaClient;
  companyId: string;
  employeeId?: string | null;
  generatedDocumentId: string;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
  createdByUserId?: string | null;
}): Promise<void> {
  try {
    await params.prisma.documentTimelineEvent.create({
      data: {
        companyId: params.companyId,
        employeeId: params.employeeId ?? undefined,
        generatedDocumentId: params.generatedDocumentId,
        eventType: params.eventType,
        metadata: params.metadata ?? undefined,
        createdByUserId: params.createdByUserId ?? undefined,
      },
    });
  } catch {
    /* non-blocking */
  }
}

export async function appendDocumentDomainActivity(params: {
  prisma: PrismaClient;
  companyId: string;
  entityType: string;
  entityId: string;
  verb: DomainActivityVerb;
  summary: string;
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await params.prisma.domainActivity.create({
      data: {
        companyId: params.companyId,
        entityType: params.entityType,
        entityId: params.entityId,
        verb: params.verb,
        summary: params.summary,
        actorUserId: params.actorUserId ?? undefined,
        payload: params.payload ?? undefined,
      },
    });
  } catch {
    /* non-blocking */
  }
}

export async function appendDocumentAuditLog(params: {
  prisma: PrismaClient;
  companyId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId?: string | null;
  diff?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await params.prisma.auditLog.create({
      data: {
        companyId: params.companyId ?? undefined,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actorUserId: params.actorUserId ?? undefined,
        diff: params.diff ?? undefined,
      },
    });
  } catch {
    /* non-blocking */
  }
}

export async function appendEmployeeDocumentTimeline(params: {
  prisma: PrismaClient;
  companyId: string;
  employeeId: string;
  eventType: string;
  title: string;
  body?: string | null;
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await params.prisma.employeeTimelineEvent.create({
      data: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        eventType: params.eventType,
        title: params.title,
        body: params.body ?? undefined,
        severity: TimelineEventSeverity.INFO,
        actorUserId: params.actorUserId ?? undefined,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch {
    /* non-blocking */
  }
}
