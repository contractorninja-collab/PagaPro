import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { buildMergedPlaceholderContext } from "@/modules/documents/services/build-placeholder-context";
import { finalizeDocumentGeneration } from "@/modules/documents/services/document-generation-service";
import {
  appendTerminationAuditLog,
  appendTerminationDomainActivity,
  appendTerminationEmployeeTimeline,
  TERMINATION_TIMELINE,
} from "@/modules/terminations/services/termination-audit-service";
import { DomainActivityVerb } from "@prisma/client";

export async function generateTerminationArtifact(params: {
  companyId: string;
  terminationId: string;
  actorUserId?: string | null;
  /** Regenerate even when a document already exists (the "Rigjenero" escape hatch). */
  force?: boolean;
}): Promise<{ ok: true; artifactId: string } | { ok: false; error: string }> {
  const term = await prisma.termination.findFirst({
    where: { id: params.terminationId, companyId: params.companyId },
    include: { employee: true },
  });
  if (!term) return { ok: false, error: "Largimi nuk u gjet." };
  if (term.status === "CANCELLED") {
    return { ok: false, error: "Largimi është anuluar." };
  }
  // Idempotent by default so a double-click on "Shkarko" can't orphan a first artifact.
  if (!params.force && term.generatedDocumentId) {
    return { ok: true, artifactId: term.generatedDocumentId };
  }

  const template = await prisma.documentTemplate.findFirst({
    where: {
      companyId: params.companyId,
      documentCategory: "TERMINATION",
      terminationWorkflowKey: term.type,
      isActive: true,
    },
  });
  if (!template) {
    return {
      ok: false,
      error:
        "Nuk ka shabllon TERMINATION me çelësin përkatës për këtë lloj largimi. Ngarkoni një DOCX te Dokumentet dhe caktoni \"terminationWorkflowKey\".",
    };
  }

  let merged: Record<string, string>;
  try {
    const built = await buildMergedPlaceholderContext(prisma, {
      companyId: params.companyId,
      subjectKind: "TERMINATION",
      subjectId: term.id,
      documentDate: new Date(),
    });
    merged = built.merged;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const storage = getCompanyAssetStorage();

  try {
    const result = await finalizeDocumentGeneration({
      prisma,
      storage,
      companyId: params.companyId,
      documentTemplateId: template.id,
      subjectKind: "TERMINATION",
      subjectId: term.id,
      mergedContext: merged,
      artifactKind: "ARCHIVED_FINAL",
      createdByUserId: params.actorUserId,
      employeeId: term.employeeId,
      title: `Largim — ${term.employee.firstName} ${term.employee.lastName}`.trim(),
      employeeFirstName: term.employee.firstName,
      employeeLastName: term.employee.lastName,
      documentDate: new Date(),
      // DOCX only. finalizeDocumentGeneration throws for ARCHIVED_FINAL when no DOCX→PDF
      // converter is reachable, and the serverless runtime has no LibreOffice/Word/Gotenberg.
      // The PDF route backfills lazily via ensureArtifactPdf once DOCX_TO_PDF_URL is set,
      // so leaving this false costs nothing. Do not flip back to true.
      attemptPdf: false,
    });

    await prisma.$transaction(async (tx) => {
      await tx.termination.update({
        where: { id: term.id },
        data: { generatedDocumentId: result.artifactId },
      });

      await tx.documentGenerationArtifact.updateMany({
        where: { id: result.artifactId, companyId: params.companyId },
        data: { isArchived: true, archivedAt: new Date() },
      });
    });

    await appendTerminationEmployeeTimeline({
      companyId: params.companyId,
      employeeId: term.employeeId,
      terminationId: term.id,
      eventType: TERMINATION_TIMELINE.DOCUMENT_GENERATED,
      title: "Dokumenti i largimit u gjenerua",
      actorUserId: params.actorUserId,
    });

    await appendTerminationDomainActivity({
      companyId: params.companyId,
      terminationId: term.id,
      employeeId: term.employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Dokumenti i largimit u gjenerua.",
      actorUserId: params.actorUserId,
      payload: { artifactId: result.artifactId },
    });

    await appendTerminationAuditLog({
      companyId: params.companyId,
      terminationId: term.id,
      action: "TERMINATION_DOCUMENT_GENERATED",
      actorUserId: params.actorUserId,
      diff: JSON.parse(JSON.stringify({ artifactId: result.artifactId })),
    });

    return { ok: true, artifactId: result.artifactId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
