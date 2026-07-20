"use server";

import { revalidatePath } from "next/cache";
import type { DocumentCategory, DocumentSubjectKind } from "@prisma/client";
import { DomainActivityVerb } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import {
  templateVersionSourceKey,
} from "@/modules/documents/engine";
import { finalizeDocumentGeneration } from "@/modules/documents/services/document-generation-service";
import { buildMergedPlaceholderContext } from "@/modules/documents/services/build-placeholder-context";
import {
  appendDocumentAuditLog,
  appendDocumentDomainActivity,
  appendDocumentTimelineEvent,
  appendEmployeeDocumentTimeline,
  DOCUMENT_ENTITY_ARTIFACT,
  DOCUMENT_ENTITY_TEMPLATE_VERSION,
  DOCUMENT_MODULE_TIMELINE,
} from "@/modules/documents/services/document-audit-service";
import {
  archiveArtifactSchema,
  bulkGenerateDocumentsSchema,
  generateContractDocumentsSchema,
  generateDocumentPayloadSchema,
  generateHrDocumentsBatchSchema,
  logDownloadSchema,
  previewPlaceholderValuesSchema,
  publishTemplateVersionSchema,
  resolvedSubjectIdAndDate,
  saveTemplateMappingSchema,
  setTemplateActiveSchema,
  updateTemplateTerminationKeySchema,
  uploadTemplateVersionFormSchema,
} from "@/modules/documents/validators/document-schemas";
import {
  assertDocxFilename,
  autoMappedForPlaceholderOnly,
  buildDefaultPlaceholderMapping,
  validateMappingJson,
} from "@/modules/documents/validators/document-template-validator";
import { buildGeneratedDocumentBasename } from "@/modules/documents/storage/filename-builder";
import { detectDocxTemplate } from "@/modules/documents/engine/detect-docx-template";

export type DocumentModuleActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function safeRevalidatePath(path: string): void {
  try {
    revalidatePath(path);
  } catch (err) {
    console.error("[pagapro] documents-actions: revalidatePath failed:", path, err);
  }
}

function assertTemplateMatchesSubject(
  templateCategory: DocumentCategory,
  subjectKind: DocumentSubjectKind,
): void {
  if (templateCategory !== subjectKind) {
    throw new Error(
      `Kategoria e shabllonit (${templateCategory}) nuk përputhet me llojin e subjektit (${subjectKind}).`,
    );
  }
}

async function afterGenerationAudit(params: {
  companyId: string;
  artifactId: string;
  employeeId: string | null;
  templateName: string;
  summary: string;
  actorUserId?: string | null;
  eventCode: string;
}): Promise<void> {
  await appendDocumentTimelineEvent({
    prisma,
    companyId: params.companyId,
    employeeId: params.employeeId,
    generatedDocumentId: params.artifactId,
    eventType: params.eventCode,
    metadata: { templateName: params.templateName },
    createdByUserId: params.actorUserId,
  });

  await appendDocumentDomainActivity({
    prisma,
    companyId: params.companyId,
    entityType: DOCUMENT_ENTITY_ARTIFACT,
    entityId: params.artifactId,
    verb: DomainActivityVerb.CREATED,
    summary: params.summary,
    actorUserId: params.actorUserId,
    payload: { event: params.eventCode },
  });

  await appendDocumentAuditLog({
    prisma,
    companyId: params.companyId,
    entityType: DOCUMENT_ENTITY_ARTIFACT,
    entityId: params.artifactId,
    action: params.eventCode,
    actorUserId: params.actorUserId,
    diff: { templateName: params.templateName },
  });

  if (params.employeeId) {
    await appendEmployeeDocumentTimeline({
      prisma,
      companyId: params.companyId,
      employeeId: params.employeeId,
      eventType: params.eventCode,
      title: params.summary,
      actorUserId: params.actorUserId,
      metadata: { artifactId: params.artifactId },
    });
  }
}

export async function uploadDocumentTemplateVersionAction(
  formData: FormData,
): Promise<
  DocumentModuleActionResult<{
    versionId: string;
    placeholderKeys: string[];
    blankCount: number;
    detectionMode: string;
    needsMapping: boolean;
  }>
> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId } = auth.context;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Ju lutem ngarkoni një skedar DOCX." };
  }

  const meta = uploadTemplateVersionFormSchema.safeParse({
    templateId: String(formData.get("templateId") ?? "").trim() || undefined,
    newTemplateName: String(formData.get("newTemplateName") ?? "").trim() || undefined,
    documentCategory: String(formData.get("documentCategory") ?? "").trim() || undefined,
    contractKind: String(formData.get("contractKind") ?? "").trim() || undefined,
    changelog: String(formData.get("changelog") ?? "").trim() || undefined,
  });

  if (!meta.success) {
    return { ok: false, error: "Të dhënat e formës nuk janë valide." };
  }

  let templateId = meta.data.templateId?.trim() ?? "";

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    assertDocxFilename(file.name || "template.docx");

    if (!templateId) {
      const name = meta.data.newTemplateName?.trim();
      const cat = meta.data.documentCategory;
      if (!name || !cat) {
        return {
          ok: false,
          error: "Për shabllon të ri plotësoni emrin dhe kategorinë.",
        };
      }

      const created = await prisma.documentTemplate.create({
        data: {
          companyId,
          name,
          documentCategory: cat,
          contractKind:
            cat === "CONTRACT" && meta.data.contractKind ? meta.data.contractKind : undefined,
          isActive: true,
        },
      });
      templateId = created.id;
    }

    const template = await prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!template) {
      return { ok: false, error: "Shablloni nuk u gjet." };
    }

    const detection = detectDocxTemplate(buf, { templateSubtype: template.templateSubtype });
    const isMapped = autoMappedForPlaceholderOnly({
      detectionMode: detection.detectionMode,
      placeholders: detection.placeholders,
    });
    const mappingJson = isMapped
      ? buildDefaultPlaceholderMapping(detection.placeholders)
      : undefined;

    const agg = await prisma.documentTemplateVersion.aggregate({
      where: { templateId },
      _max: { versionNumber: true },
    });
    const versionNumber = (agg._max.versionNumber ?? 0) + 1;

    const storage = getCompanyAssetStorage();
    const sourceStorageKey = templateVersionSourceKey({
      companyId,
      templateId,
      versionNumber,
    });

    await storage.put(sourceStorageKey, buf, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const version = await prisma.documentTemplateVersion.create({
      data: {
        templateId,
        versionNumber,
        sourceStorageKey,
        originalFilename: file.name || null,
        detectedPlaceholders: detection.placeholders as unknown as Prisma.InputJsonValue,
        detectedBlankFields: detection.blankFields as unknown as Prisma.InputJsonValue,
        detectionMode: detection.detectionMode,
        mappingJson: mappingJson as unknown as Prisma.InputJsonValue,
        isMapped,
        changelog: meta.data.changelog ?? undefined,
      },
    });

    await appendDocumentDomainActivity({
      prisma,
      companyId,
      entityType: DOCUMENT_ENTITY_TEMPLATE_VERSION,
      entityId: version.id,
      verb: DomainActivityVerb.CREATED,
      summary: `Shablloni DOCX u ngarkua (v${versionNumber}).`,
      payload: { event: DOCUMENT_MODULE_TIMELINE.TEMPLATE_UPLOADED, templateId },
    });

    await appendDocumentAuditLog({
      prisma,
      companyId,
      entityType: DOCUMENT_ENTITY_TEMPLATE_VERSION,
      entityId: version.id,
      action: DOCUMENT_MODULE_TIMELINE.TEMPLATE_UPLOADED,
      diff: {
        templateId,
        versionNumber,
        placeholderCount: detection.placeholders.length,
        blankCount: detection.blankFields.length,
        detectionMode: detection.detectionMode,
      },
    });

    safeRevalidatePath("/dokumentet");
    safeRevalidatePath("/dokumentet/templates");
    safeRevalidatePath(`/dokumentet/templates/${templateId}`);
    return {
      ok: true,
      data: {
        versionId: version.id,
        placeholderKeys: detection.placeholders,
        blankCount: detection.blankFields.length,
        detectionMode: detection.detectionMode,
        needsMapping: !isMapped,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("duplicate")) {
      return { ok: false, error: "Ky numër versioni ekziston tashmë për këtë shabllon." };
    }
    return { ok: false, error: `Ngarkimi dështoi: ${msg}` };
  }
}

export async function publishDocumentTemplateVersionAction(
  raw: unknown,
): Promise<DocumentModuleActionResult> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId } = auth.context;

  const parsed = publishTemplateVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Kërkesë e pavlefshme." };
  }

  const { templateId, versionId } = parsed.data;

  const version = await prisma.documentTemplateVersion.findFirst({
    where: { id: versionId, templateId, template: { companyId } },
  });
  if (!version) {
    return { ok: false, error: "Versioni nuk u gjet." };
  }

  if (
    (version.detectionMode === "BLANK_FIELDS" || version.detectionMode === "MIXED") &&
    !version.isMapped
  ) {
    return {
      ok: false,
      error: "Plotësoni mapimin e fushave bosh para publikimit.",
    };
  }

  await prisma.$transaction([
    prisma.documentTemplateVersion.updateMany({
      where: { templateId },
      data: { isPublished: false },
    }),
    prisma.documentTemplateVersion.update({
      where: { id: versionId },
      data: { isPublished: true },
    }),
  ]);

  await appendDocumentDomainActivity({
    prisma,
    companyId,
    entityType: DOCUMENT_ENTITY_TEMPLATE_VERSION,
    entityId: versionId,
    verb: DomainActivityVerb.UPDATED,
    summary: "Versioni i shabllonit u publikua.",
  });

  safeRevalidatePath("/dokumentet/templates");
  safeRevalidatePath("/dokumentet");
  return { ok: true };
}

export async function saveTemplateMappingAction(
  raw: unknown,
): Promise<DocumentModuleActionResult> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId } = auth.context;

  const parsed = saveTemplateMappingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mapimi i pavlefshëm." };
  }

  const version = await prisma.documentTemplateVersion.findFirst({
    where: {
      id: parsed.data.versionId,
      templateId: parsed.data.templateId,
      template: { companyId },
    },
  });
  if (!version) return { ok: false, error: "Versioni nuk u gjet." };

  const blankCount = Array.isArray(version.detectedBlankFields)
    ? version.detectedBlankFields.length
    : 0;
  const mapErrors = validateMappingJson(
    parsed.data.mappingJson,
    blankCount,
    Array.isArray(version.detectedPlaceholders)
      ? (version.detectedPlaceholders as string[])
      : [],
  );
  if (mapErrors.length > 0) {
    return { ok: false, error: mapErrors.join(" ") };
  }

  await prisma.documentTemplateVersion.update({
    where: { id: version.id },
    data: {
      mappingJson: parsed.data.mappingJson as unknown as Prisma.InputJsonValue,
      isMapped: true,
    },
  });

  await appendDocumentDomainActivity({
    prisma,
    companyId,
    entityType: DOCUMENT_ENTITY_TEMPLATE_VERSION,
    entityId: version.id,
    verb: DomainActivityVerb.UPDATED,
    summary: "Mapimi i fushave të shabllonit u përditësua.",
    payload: { event: DOCUMENT_MODULE_TIMELINE.TEMPLATE_MAPPING_UPDATED },
  });

  await appendDocumentAuditLog({
    prisma,
    companyId,
    entityType: DOCUMENT_ENTITY_TEMPLATE_VERSION,
    entityId: version.id,
    action: DOCUMENT_MODULE_TIMELINE.TEMPLATE_MAPPING_UPDATED,
    diff: { blankFields: parsed.data.mappingJson.blankFields.length },
  });

  safeRevalidatePath(`/dokumentet/templates/${parsed.data.templateId}`);
  safeRevalidatePath(`/dokumentet/templates/${parsed.data.templateId}/mapping`);
  safeRevalidatePath("/dokumentet/templates");
  return { ok: true };
}

export async function previewPlaceholderValuesAction(
  raw: unknown,
): Promise<
  DocumentModuleActionResult<{ values: Record<string, string>; errors: { key: string; message: string }[] }>
> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId } = auth.context;

  const parsed = previewPlaceholderValuesSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Payload i pavlefshëm." };
  }

  const { resolvePlaceholderValues } = await import(
    "@/modules/documents/engine/resolve-placeholder-values"
  );
  const result = await resolvePlaceholderValues({
    companyId,
    employeeId: parsed.data.employeeId,
    payrollId: parsed.data.payrollId,
    templateVersionId: parsed.data.templateVersionId,
    subjectKind: parsed.data.subjectKind,
    subjectId: parsed.data.subjectId,
    documentInput: {
      documentDateIso: parsed.data.documentDateIso,
      documentPlace: parsed.data.documentPlace,
      contractStartDateIso: parsed.data.contractStartDateIso,
      contractEndDateIso: parsed.data.contractEndDateIso,
      manualOverrides: parsed.data.manualOverrides,
    },
  });

  return {
    ok: true,
    data: {
      values: result.values,
      errors: result.errors.map((e) => ({ key: e.key, message: e.message })),
    },
  };
}

export async function setDocumentTemplateActiveAction(
  raw: unknown,
): Promise<DocumentModuleActionResult> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId } = auth.context;

  const parsed = setTemplateActiveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };

  const updated = await prisma.documentTemplate.updateMany({
    where: { id: parsed.data.templateId, companyId },
    data: { isActive: parsed.data.isActive },
  });
  if (updated.count === 0) return { ok: false, error: "Shablloni nuk u gjet." };

  safeRevalidatePath("/dokumentet/templates");
  return { ok: true };
}

export async function updateDocumentTemplateTerminationKeyAction(
  raw: unknown,
): Promise<DocumentModuleActionResult> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId } = auth.context;

  const parsed = updateTemplateTerminationKeySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };

  const template = await prisma.documentTemplate.findFirst({
    where: { id: parsed.data.templateId, companyId },
  });
  if (!template) return { ok: false, error: "Shablloni nuk u gjet." };
  if (template.documentCategory !== "TERMINATION") {
    return { ok: false, error: "Çelësi vlen vetëm për shabllonet TERMINATION." };
  }

  const key = parsed.data.terminationWorkflowKey;

  if (key) {
    const clash = await prisma.documentTemplate.findFirst({
      where: {
        companyId,
        id: { not: template.id },
        terminationWorkflowKey: key,
      },
      select: { id: true },
    });
    if (clash) {
      return {
        ok: false,
        error: "Ky çelës është tashmë i përdorur nga një shabllon tjetër për këtë kompani.",
      };
    }
  }

  await prisma.documentTemplate.update({
    where: { id: template.id },
    data: { terminationWorkflowKey: key },
  });

  safeRevalidatePath("/dokumentet/templates");
  return { ok: true };
}

async function runGeneration(params: {
  companyId: string;
  parsed: z.infer<typeof generateDocumentPayloadSchema>;
  kind: "PREVIEW" | "ARCHIVED_FINAL";
  actorUserId?: string | null;
}): Promise<DocumentModuleActionResult<{ artifactId: string }>> {
  const { subjectId, documentDate, contractStartDate, contractEndDate } = resolvedSubjectIdAndDate(
    params.parsed,
  );
  if (!subjectId) {
    return { ok: false, error: "Subjekti (ID) mungon për këtë lloj dokumenti." };
  }

  const template = await prisma.documentTemplate.findFirst({
    where: { id: params.parsed.documentTemplateId, companyId: params.companyId },
  });

  if (!template) {
    return { ok: false, error: "Shablloni nuk u gjet." };
  }

  const versionRow = params.parsed.templateVersionId
    ? await prisma.documentTemplateVersion.findFirst({
        where: {
          id: params.parsed.templateVersionId,
          templateId: template.id,
          template: { companyId: params.companyId },
        },
      })
    : await prisma.documentTemplateVersion.findFirst({
        where: { templateId: template.id, isPublished: true },
      });

  if (!versionRow) {
    return {
      ok: false,
      error: params.parsed.templateVersionId
        ? "Versioni i zgjedhur nuk ekziston."
        : "Nuk ka version të publikuar për këtë shabllon.",
    };
  }

  try {
    assertTemplateMatchesSubject(template.documentCategory, params.parsed.subjectKind);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Kategori e pavlefshme." };
  }

  let merged: Record<string, string>;
  let resolvedEmployeeId: string | null;
  let resolvedPayrollId: string | null;

  try {
    const ctx = await buildMergedPlaceholderContext(prisma, {
      companyId: params.companyId,
      subjectKind: params.parsed.subjectKind,
      subjectId,
      employeeId: params.parsed.employeeId,
      payrollId: params.parsed.payrollId,
      documentDate,
      contractStartDate,
      contractEndDate,
    });
    merged = ctx.merged;
    resolvedEmployeeId = ctx.resolvedEmployeeId;
    resolvedPayrollId = ctx.resolvedPayrollId ?? params.parsed.payrollId ?? null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ndërtimi i kontekstit dështoi." };
  }

  const manual = params.parsed.manualOverrides ?? {};
  const employeeRow =
    resolvedEmployeeId != null
      ? await prisma.employee.findFirst({
          where: { id: resolvedEmployeeId, companyId: params.companyId },
          select: { firstName: true, lastName: true },
        })
      : null;

  let payrollY: number | null = null;
  let payrollM: number | null = null;
  if (resolvedPayrollId) {
    const pay = await prisma.payroll.findFirst({
      where: { id: resolvedPayrollId, companyId: params.companyId },
      select: { year: true, month: true },
    });
    if (pay) {
      payrollY = pay.year;
      payrollM = pay.month;
    }
  }

  const displayFilename = buildGeneratedDocumentBasename({
    category: template.documentCategory,
    employeeFirstName: employeeRow?.firstName,
    employeeLastName: employeeRow?.lastName,
    payrollYear: payrollY,
    payrollMonth: payrollM,
    documentDate,
  });

  try {
    const storage = getCompanyAssetStorage();
    const result = await finalizeDocumentGeneration({
      prisma,
      storage,
      companyId: params.companyId,
      documentTemplateId: template.id,
      templateVersionId: versionRow.id,
      subjectKind: params.parsed.subjectKind,
      subjectId,
      mergedContext: merged,
      manualOverrides: manual,
      artifactKind: params.kind === "PREVIEW" ? "PREVIEW" : "ARCHIVED_FINAL",
      createdByUserId: params.actorUserId,
      employeeId: resolvedEmployeeId,
      payrollId: resolvedPayrollId,
      supersedesArtifactId: params.parsed.supersedesArtifactId ?? undefined,
      title: params.parsed.title ?? template.name,
      displayFilename,
      employeeFirstName: employeeRow?.firstName,
      employeeLastName: employeeRow?.lastName,
      payrollYear: payrollY,
      payrollMonth: payrollM,
      documentDate,
      attemptPdf: params.kind === "ARCHIVED_FINAL",
      skipMappingGate: params.kind === "PREVIEW",
    });

    const summary =
      params.kind === "PREVIEW"
        ? `Parapamje dokumenti: ${template.name}`
        : template.documentCategory === "CONTRACT"
          ? "Kontrata u gjenerua"
          : `Dokument i gjeneruar: ${template.name}`;

    const eventCode =
      params.kind === "PREVIEW"
        ? DOCUMENT_MODULE_TIMELINE.DOCUMENT_PREVIEWED
        : params.parsed.supersedesArtifactId
          ? DOCUMENT_MODULE_TIMELINE.DOCUMENT_REGENERATED
          : DOCUMENT_MODULE_TIMELINE.DOCUMENT_GENERATED;

    await afterGenerationAudit({
      companyId: params.companyId,
      artifactId: result.artifactId,
      employeeId: resolvedEmployeeId,
      templateName: template.name,
      summary,
      actorUserId: params.actorUserId,
      eventCode,
    });

    safeRevalidatePath("/dokumentet");
    safeRevalidatePath(`/dokumentet/${result.artifactId}`);
    return { ok: true, data: { artifactId: result.artifactId } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function previewDocumentGenerationAction(
  raw: unknown,
): Promise<DocumentModuleActionResult<{ artifactId: string }>> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId, user } = auth.context;

  const parsed = generateDocumentPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Payload i pavlefshëm për gjenerimin." };
  }

  return runGeneration({
    companyId,
    parsed: parsed.data,
    kind: "PREVIEW",
    actorUserId: user.id,
  });
}

export async function generateFinalDocumentAction(
  raw: unknown,
): Promise<DocumentModuleActionResult<{ artifactId: string }>> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId, user } = auth.context;

  const parsed = generateDocumentPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Payload i pavlefshëm për gjenerimin." };
  }

  return runGeneration({
    companyId,
    parsed: parsed.data,
    kind: "ARCHIVED_FINAL",
    actorUserId: user.id,
  });
}

export interface BulkGenerationFailure {
  employeeLabel: string;
  error: string;
}

export interface HrBatchGenerationFailure {
  subjectLabel: string;
  error: string;
}

async function labelSubjectsForBatch(params: {
  companyId: string;
  subjectKind: DocumentSubjectKind;
  subjectIds: string[];
}): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (params.subjectKind === "CONTRACT" || params.subjectKind === "OTHER") {
    const employees = await prisma.employee.findMany({
      where: { id: { in: params.subjectIds }, companyId: params.companyId },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const e of employees) out.set(e.id, `${e.firstName} ${e.lastName}`.trim());
  } else if (params.subjectKind === "LEAVE") {
    const rows = await prisma.leaveRequest.findMany({
      where: { id: { in: params.subjectIds }, companyId: params.companyId },
      select: { id: true, startDate: true, employee: { select: { firstName: true, lastName: true } } },
    });
    for (const r of rows) {
      out.set(r.id, `${r.employee.firstName} ${r.employee.lastName} — ${r.startDate.toISOString().slice(0, 10)}`);
    }
  } else if (params.subjectKind === "TERMINATION") {
    const rows = await prisma.termination.findMany({
      where: { id: { in: params.subjectIds }, companyId: params.companyId },
      select: { id: true, lastWorkingDay: true, employee: { select: { firstName: true, lastName: true } } },
    });
    for (const r of rows) {
      out.set(r.id, `${r.employee.firstName} ${r.employee.lastName} — ${r.lastWorkingDay.toISOString().slice(0, 10)}`);
    }
  } else if (params.subjectKind === "WARNING") {
    const rows = await prisma.disciplinaryWarning.findMany({
      where: { id: { in: params.subjectIds }, companyId: params.companyId },
      select: { id: true, summary: true, employee: { select: { firstName: true, lastName: true } } },
    });
    for (const r of rows) {
      out.set(r.id, `${r.employee.firstName} ${r.employee.lastName} — ${r.summary.slice(0, 48)}`);
    }
  }
  return out;
}

export async function generateHrDocumentsBatchAction(
  raw: unknown,
): Promise<
  DocumentModuleActionResult<{
    generated: number;
    failed: HrBatchGenerationFailure[];
    artifactIds: string[];
    artifactId?: string;
  }>
> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId, user } = auth.context;

  const parsed = generateHrDocumentsBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Payload i pavlefshëm për gjenerimin." };
  }

  const template = await prisma.documentTemplate.findFirst({
    where: { id: parsed.data.documentTemplateId, companyId },
    select: { id: true, documentCategory: true },
  });
  if (!template) return { ok: false, error: "Shablloni nuk u gjet." };
  if (template.documentCategory !== parsed.data.subjectKind) {
    return { ok: false, error: "Shablloni nuk përputhet me llojin e dokumentit." };
  }

  const labels = await labelSubjectsForBatch({
    companyId,
    subjectKind: parsed.data.subjectKind,
    subjectIds: parsed.data.subjectIds,
  });

  let generated = 0;
  const failed: HrBatchGenerationFailure[] = [];
  const artifactIds: string[] = [];

  for (const subjectId of parsed.data.subjectIds) {
    const subjectLabel = labels.get(subjectId) ?? subjectId;
    const payload = generateDocumentPayloadSchema.safeParse({
      documentTemplateId: parsed.data.documentTemplateId,
      templateVersionId: parsed.data.templateVersionId,
      subjectKind: parsed.data.subjectKind,
      subjectId,
      employeeId:
        parsed.data.subjectKind === "CONTRACT" || parsed.data.subjectKind === "OTHER"
          ? subjectId
          : undefined,
      documentDateIso: parsed.data.documentDateIso,
      contractStartDateIso: parsed.data.contractStartDateIso,
      contractEndDateIso: parsed.data.contractEndDateIso,
      title: parsed.data.title,
    });
    if (!payload.success) {
      failed.push({ subjectLabel, error: "Payload i pavlefshëm." });
      continue;
    }

    const res = await runGeneration({
      companyId,
      parsed: payload.data,
      kind: "ARCHIVED_FINAL",
      actorUserId: user.id,
    });
    if (res.ok) {
      generated += 1;
      if (res.data?.artifactId) artifactIds.push(res.data.artifactId);
    } else {
      failed.push({ subjectLabel, error: res.error });
    }
  }

  safeRevalidatePath("/dokumentet");
  return {
    ok: true,
    data: {
      generated,
      failed,
      artifactIds,
      artifactId: parsed.data.subjectIds.length === 1 ? artifactIds[0] : undefined,
    },
  };
}

/**
 * Mass generation: produces one ARCHIVED_FINAL document per selected employee.
 * Supported for employee-driven categories (CONTRACT, OTHER).
 */
export async function generateBulkDocumentsAction(
  raw: unknown,
): Promise<
  DocumentModuleActionResult<{ generated: number; failed: BulkGenerationFailure[]; artifactIds: string[] }>
> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId, user } = auth.context;

  const parsed = bulkGenerateDocumentsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Payload i pavlefshëm për gjenerimin masiv." };
  }

  const template = await prisma.documentTemplate.findFirst({
    where: { id: parsed.data.documentTemplateId, companyId },
  });
  if (!template) {
    return { ok: false, error: "Shablloni nuk u gjet." };
  }
  if (template.documentCategory !== "CONTRACT" && template.documentCategory !== "OTHER") {
    return { ok: false, error: "Gjenerimi masiv mbështetet vetëm për shabllonet e kategorisë Kontratë ose Tjetër." };
  }

  const publishedVersion = await prisma.documentTemplateVersion.findFirst({
    where: { templateId: template.id, isPublished: true },
    select: { id: true },
  });
  if (!publishedVersion) {
    return { ok: false, error: "Nuk ka version të publikuar për këtë shabllon." };
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: parsed.data.employeeIds }, companyId },
    select: { id: true, firstName: true, lastName: true },
  });
  const employeesById = new Map(employees.map((e) => [e.id, e]));

  let generated = 0;
  const failed: BulkGenerationFailure[] = [];
  const artifactIds: string[] = [];

  for (const employeeId of parsed.data.employeeIds) {
    const employee = employeesById.get(employeeId);
    if (!employee) {
      failed.push({ employeeLabel: employeeId, error: "Punonjësi nuk u gjet." });
      continue;
    }
    const label = `${employee.firstName} ${employee.lastName}`.trim();

    const payload = generateDocumentPayloadSchema.safeParse({
      documentTemplateId: template.id,
      subjectKind: template.documentCategory,
      subjectId: employee.id,
      employeeId: employee.id,
      documentDateIso: parsed.data.documentDateIso,
      contractStartDateIso: parsed.data.contractStartDateIso,
      contractEndDateIso: parsed.data.contractEndDateIso,
    });
    if (!payload.success) {
      failed.push({ employeeLabel: label, error: "Payload i pavlefshëm." });
      continue;
    }

    const res = await runGeneration({
      companyId,
      parsed: payload.data,
      kind: "ARCHIVED_FINAL",
      actorUserId: user.id,
    });
    if (res.ok) {
      generated += 1;
      if (res.data?.artifactId) artifactIds.push(res.data.artifactId);
    } else {
      failed.push({ employeeLabel: label, error: res.error });
    }
  }

  safeRevalidatePath("/dokumentet");
  return { ok: true, data: { generated, failed, artifactIds } };
}

/**
 * Contract generation by legal subtype — resolves template automatically.
 */
export async function generateContractDocumentsAction(
  raw: unknown,
): Promise<
  DocumentModuleActionResult<{
    generated: number;
    failed: BulkGenerationFailure[];
    artifactIds: string[];
    artifactId?: string;
  }>
> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId } = auth.context;

  const parsed = generateContractDocumentsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Payload i pavlefshëm për kontratat." };
  }

  const template = await prisma.documentTemplate.findFirst({
    where: {
      companyId,
      documentCategory: "CONTRACT",
      templateSubtype: parsed.data.templateSubtype,
      isActive: true,
    },
  });
  if (!template) {
    return {
      ok: false,
      error: `Shablloni "${parsed.data.templateSubtype === "AFAT_I_CAKTUAR" ? "Kontrate me Afat te Caktuar" : "Kontrate me Afat te Pacaktuar"}" nuk u gjet. Ekzekutoni seed ose ngarkoni shabllonin te Shabllonet.`,
    };
  }

  const bulk = await generateBulkDocumentsAction({
    documentTemplateId: template.id,
    employeeIds: parsed.data.employeeIds,
    documentDateIso: parsed.data.documentDateIso,
    contractStartDateIso: parsed.data.contractStartDateIso,
    contractEndDateIso: parsed.data.contractEndDateIso,
  });

  if (!bulk.ok || !bulk.data) return bulk;

  const singleId =
    parsed.data.employeeIds.length === 1 && bulk.data.artifactIds.length === 1
      ? bulk.data.artifactIds[0]
      : undefined;

  return {
    ok: true,
    data: {
      generated: bulk.data.generated,
      failed: bulk.data.failed,
      artifactIds: bulk.data.artifactIds,
      artifactId: singleId,
    },
  };
}

const regeneratePayloadSchema = z.object({
  priorArtifactId: z.string().min(1),
  manualOverrides: z.record(z.string(), z.string()).optional(),
  documentDateIso: z.string().optional(),
  title: z.string().optional(),
});

export async function regenerateDocumentAction(
  raw: unknown,
): Promise<DocumentModuleActionResult<{ artifactId: string }>> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId, user } = auth.context;

  const parsed = regeneratePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Payload i pavlefshëm." };
  }

  const prior = await prisma.documentGenerationArtifact.findFirst({
    where: { id: parsed.data.priorArtifactId, companyId },
  });
  if (!prior) return { ok: false, error: "Dokumenti origjinal nuk u gjet." };
  if (!prior.documentTemplateId) {
    return { ok: false, error: "Dokumenti origjinal nuk ka shabllon të lidhur." };
  }

  const payload = {
    documentTemplateId: prior.documentTemplateId,
    templateVersionId: undefined as string | undefined,
    subjectKind: prior.subjectKind,
    subjectId: prior.subjectId,
    employeeId: prior.employeeId,
    payrollId: prior.payrollId,
    manualOverrides: parsed.data.manualOverrides,
    documentDateIso: parsed.data.documentDateIso,
    title: parsed.data.title,
    supersedesArtifactId: prior.id,
  };

  return runGeneration({
    companyId,
    parsed: generateDocumentPayloadSchema.parse(payload),
    kind: "ARCHIVED_FINAL",
    actorUserId: user.id,
  });
}

export async function archiveArtifactAction(raw: unknown): Promise<DocumentModuleActionResult> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId, user } = auth.context;

  const parsed = archiveArtifactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };

  const row = await prisma.documentGenerationArtifact.findFirst({
    where: { id: parsed.data.artifactId, companyId },
  });
  if (!row) return { ok: false, error: "Dokumenti nuk u gjet." };

  await prisma.documentGenerationArtifact.update({
    where: { id: row.id },
    data: {
      isArchived: parsed.data.archived,
      archivedAt: parsed.data.archived ? new Date() : null,
    },
  });

  await appendDocumentTimelineEvent({
    prisma,
    companyId,
    employeeId: row.employeeId,
    generatedDocumentId: row.id,
    eventType: DOCUMENT_MODULE_TIMELINE.DOCUMENT_ARCHIVED,
    metadata: { archived: parsed.data.archived },
    createdByUserId: user.id,
  });

  await appendDocumentDomainActivity({
    prisma,
    companyId,
    entityType: DOCUMENT_ENTITY_ARTIFACT,
    entityId: row.id,
    verb: DomainActivityVerb.ARCHIVED,
    summary: parsed.data.archived ? "Dokumenti u arkivua." : "Arkivi u hoq.",
  });

  safeRevalidatePath("/dokumentet");
  safeRevalidatePath(`/dokumentet/${row.id}`);
  return { ok: true };
}

export async function logDocumentDownloadAction(raw: unknown): Promise<DocumentModuleActionResult> {
  const auth = await getCompanyContext();
  if (!auth.ok) {
    return { ok: false, error: companyContextErrorMessage(auth.reason) };
  }
  const { companyId, user } = auth.context;

  const parsed = logDownloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };

  const row = await prisma.documentGenerationArtifact.findFirst({
    where: { id: parsed.data.artifactId, companyId },
  });
  if (!row) return { ok: false, error: "Dokumenti nuk u gjet." };

  await appendDocumentTimelineEvent({
    prisma,
    companyId,
    employeeId: row.employeeId,
    generatedDocumentId: row.id,
    eventType: DOCUMENT_MODULE_TIMELINE.DOCUMENT_DOWNLOADED,
    createdByUserId: user.id,
  });

  await appendDocumentDomainActivity({
    prisma,
    companyId,
    entityType: DOCUMENT_ENTITY_ARTIFACT,
    entityId: row.id,
    verb: DomainActivityVerb.UPDATED,
    summary: "Dokumenti u shkarkua.",
    payload: { event: DOCUMENT_MODULE_TIMELINE.DOCUMENT_DOWNLOADED },
  });

  return { ok: true };
}
