import { DomainActivityVerb, TimelineEventSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import {
  DOCUMENT_ENTITY_ARTIFACT,
  DOCUMENT_MODULE_TIMELINE,
  appendDocumentAuditLog,
  appendDocumentDomainActivity,
  appendDocumentTimelineEvent,
  appendEmployeeDocumentTimeline,
} from "@/modules/documents/services/document-audit-service";
import { finalizeDocumentGeneration } from "@/modules/documents/services/document-generation-service";
import { buildMergedPlaceholderContext } from "@/modules/documents/services/build-placeholder-context";
import { buildGeneratedDocumentBasename } from "@/modules/documents/storage/filename-builder";

/** Generates archived DOCX/PDF artifact + LeaveDocument link + audit hooks (documents + HR timelines). */
export async function generateLeavePdfArtifact(params: {
  companyId: string;
  leaveRequestId: string;
  documentTemplateId: string;
  actorUserId?: string | null;
}): Promise<string> {
  const lr = await prisma.leaveRequest.findFirst({
    where: { id: params.leaveRequestId, companyId: params.companyId },
    include: { employee: true },
  });
  if (!lr) throw new Error("Kërkesa e pushimit nuk u gjet.");
  if (lr.status !== "APPROVED") throw new Error("Vetëm pushimet e miratuara gjenerojnë dokument.");

  const template = await prisma.documentTemplate.findFirst({
    where: { id: params.documentTemplateId, companyId: params.companyId, documentCategory: "LEAVE" },
  });
  if (!template) throw new Error("Shablloni i pushimit nuk u gjet ose kategoria nuk përputhet.");

  const documentDate = new Date();
  const { merged, resolvedEmployeeId } = await buildMergedPlaceholderContext(prisma, {
    companyId: params.companyId,
    subjectKind: "LEAVE",
    subjectId: params.leaveRequestId,
    employeeId: lr.employeeId,
    documentDate,
  });

  const displayFilename = buildGeneratedDocumentBasename({
    category: "LEAVE",
    employeeFirstName: lr.employee.firstName,
    employeeLastName: lr.employee.lastName,
    payrollYear: null,
    payrollMonth: null,
    documentDate,
  });

  const storage = getCompanyAssetStorage();

  const result = await finalizeDocumentGeneration({
    prisma,
    storage,
    companyId: params.companyId,
    documentTemplateId: params.documentTemplateId,
    subjectKind: "LEAVE",
    subjectId: params.leaveRequestId,
    mergedContext: merged,
    artifactKind: "ARCHIVED_FINAL",
    createdByUserId: params.actorUserId ?? undefined,
    employeeId: resolvedEmployeeId,
    title: template.name,
    displayFilename,
    documentDate,
    attemptPdf: true,
  });

  await prisma.leaveDocument.create({
    data: {
      leaveRequestId: params.leaveRequestId,
      generatedDocumentId: result.artifactId,
    },
  });

  const summary = `Dokument pushimi: ${template.name}`;

  await appendDocumentTimelineEvent({
    prisma,
    companyId: params.companyId,
    employeeId: resolvedEmployeeId,
    generatedDocumentId: result.artifactId,
    eventType: DOCUMENT_MODULE_TIMELINE.DOCUMENT_GENERATED,
    metadata: { templateName: template.name, leaveRequestId: params.leaveRequestId },
    createdByUserId: params.actorUserId ?? undefined,
  });

  await appendDocumentDomainActivity({
    prisma,
    companyId: params.companyId,
    entityType: DOCUMENT_ENTITY_ARTIFACT,
    entityId: result.artifactId,
    verb: DomainActivityVerb.CREATED,
    summary,
    actorUserId: params.actorUserId ?? undefined,
    payload: { leaveRequestId: params.leaveRequestId },
  });

  await appendDocumentAuditLog({
    prisma,
    companyId: params.companyId,
    entityType: DOCUMENT_ENTITY_ARTIFACT,
    entityId: result.artifactId,
    action: DOCUMENT_MODULE_TIMELINE.DOCUMENT_GENERATED,
    actorUserId: params.actorUserId ?? undefined,
    diff: { templateName: template.name },
  });

  if (resolvedEmployeeId) {
    await appendEmployeeDocumentTimeline({
      prisma,
      companyId: params.companyId,
      employeeId: resolvedEmployeeId,
      eventType: DOCUMENT_MODULE_TIMELINE.DOCUMENT_GENERATED,
      title: summary,
      actorUserId: params.actorUserId ?? undefined,
      metadata: { artifactId: result.artifactId, leaveRequestId: params.leaveRequestId },
    });
  }

  try {
    await prisma.employeeTimelineEvent.create({
      data: {
        companyId: params.companyId,
        employeeId: lr.employeeId,
        eventType: "LEAVE_DOCUMENT_GENERATED",
        severity: TimelineEventSeverity.INFO,
        subjectKind: "LeaveRequest",
        subjectId: params.leaveRequestId,
        title: summary,
        body: template.name,
        actorUserId: params.actorUserId ?? undefined,
        metadata: { artifactId: result.artifactId },
      },
    });
  } catch {
    /* non-blocking */
  }

  try {
    await prisma.domainActivity.create({
      data: {
        companyId: params.companyId,
        entityType: "LeaveRequest",
        entityId: params.leaveRequestId,
        verb: DomainActivityVerb.UPDATED,
        summary,
        actorUserId: params.actorUserId ?? undefined,
        payload: { artifactId: result.artifactId },
      },
    });
  } catch {
    /* non-blocking */
  }

  return result.artifactId;
}
