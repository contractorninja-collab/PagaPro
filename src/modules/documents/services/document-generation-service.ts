import type {

  DocumentCategory,

  DocumentGenerationArtifactKind,

  DocumentSubjectKind,

  Prisma,

  PrismaClient,

} from "@prisma/client";

import { DocumentGenerationStatus } from "@prisma/client";

import { createHash, randomUUID } from "node:crypto";

import PizZip from "pizzip";

import { composePlaceholderRegistry, generationArtifactDocxKey, generationArtifactPdfKey } from "../engine";

import { generateDocxFromTemplate } from "../engine/generate-docx";

import type { DocumentStorage } from "../engine/storage/types";

import { convertDocxBufferToPdf } from "../engine/convert-docx-to-pdf";

import { buildGeneratedDocumentBasename } from "../storage/filename-builder";

import {

  assertTemplateReadyForGeneration,

  parseMappingJson,

  validateResolvedValues,

} from "../validators/document-template-validator";



function detectedKeysFromVersionJson(value: unknown): string[] | undefined {

  if (value == null || !Array.isArray(value)) return undefined;

  const keys = value.filter((x): x is string => typeof x === "string");

  return keys.length > 0 ? keys : undefined;

}



function sha256Hex(buf: Buffer): string {

  return createHash("sha256").update(buf).digest("hex");

}

function isGeneratedContractStub(docxBuffer: Buffer): boolean {
  const zip = new PizZip(docxBuffer);
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/(document\d*|header\d*|footer\d*)\.xml$/i.test(name)) continue;
    const file = zip.files[name];
    if (file && !file.dir && /Kontrate me Afat.*— fusha \d+:/.test(file.asText())) return true;
  }
  return false;
}



export async function loadPublishedDocumentTemplateVersion(

  prisma: PrismaClient,

  args: { companyId: string; documentTemplateId: string },

) {

  return prisma.documentTemplateVersion.findFirst({

    where: {

      templateId: args.documentTemplateId,

      isPublished: true,

      template: { companyId: args.companyId },

    },

    include: { template: true },

  });

}



export async function loadDocumentTemplateVersionById(

  prisma: PrismaClient,

  args: { companyId: string; templateVersionId: string },

) {

  return prisma.documentTemplateVersion.findFirst({

    where: {

      id: args.templateVersionId,

      template: { companyId: args.companyId },

    },

    include: { template: true },

  });

}



export interface FinalizeDocumentGenerationParams {

  prisma: PrismaClient;

  storage: DocumentStorage;

  companyId: string;

  documentTemplateId: string;

  subjectKind: DocumentSubjectKind;

  subjectId: string;

  mergedContext: Record<string, string>;

  manualOverrides?: Record<string, string>;

  artifactKind: DocumentGenerationArtifactKind;

  createdByUserId?: string | null;

  templateVersionId?: string;

  employeeId?: string | null;

  payrollId?: string | null;

  supersedesArtifactId?: string | null;

  title?: string;

  displayFilename?: string;

  employeeFirstName?: string | null;

  employeeLastName?: string | null;

  payrollYear?: number | null;

  payrollMonth?: number | null;

  documentDate?: Date;

  attemptPdf?: boolean;

  /** Skip mapping gate (legacy callers). */

  skipMappingGate?: boolean;

}



export interface FinalizeDocumentGenerationResult {

  artifactId: string;

  docxStorageKey: string;

  pdfStorageKey: string | null;

  buffer: Buffer;

  detectedKeys: string[];

  mergedContext: Record<string, string>;

  templateVersionId: string;

  documentCategory: DocumentCategory;

  pdfConversionError: string | null;

}



export async function finalizeDocumentGeneration(

  params: FinalizeDocumentGenerationParams,

): Promise<FinalizeDocumentGenerationResult> {

  const version = params.templateVersionId

    ? await loadDocumentTemplateVersionById(params.prisma, {

        companyId: params.companyId,

        templateVersionId: params.templateVersionId,

      })

    : await loadPublishedDocumentTemplateVersion(params.prisma, {

        companyId: params.companyId,

        documentTemplateId: params.documentTemplateId,

      });



  if (!version) {

    throw new Error(

      params.templateVersionId

        ? `DocumentTemplateVersion ${params.templateVersionId} not found for company ${params.companyId}`

        : `No published DocumentTemplateVersion for template ${params.documentTemplateId} in company ${params.companyId}`,

    );

  }



  if (!params.skipMappingGate && params.artifactKind === "ARCHIVED_FINAL") {

    assertTemplateReadyForGeneration(version);

  }



  const template = version.template;

  const category = template.documentCategory;

  const registry = composePlaceholderRegistry([category]);

  const manual = params.manualOverrides ?? {};

  const mergedContext = { ...params.mergedContext, ...manual };



  const mapping = parseMappingJson(version.mappingJson);

  if (mapping && params.artifactKind === "ARCHIVED_FINAL") {

    const valErrors = validateResolvedValues(mapping, mergedContext);

    if (valErrors.length > 0) {

      throw new Error(

        `Mungojnë vlerat e detyrueshme: ${valErrors.map((e) => e.message).slice(0, 8).join("; ")}`,

      );

    }

  }



  const templateDocxBuffer = await params.storage.get(version.sourceStorageKey);

  if (category === "CONTRACT" && isGeneratedContractStub(templateDocxBuffer)) {
    throw new Error(
      "Shablloni i kontratës është vetëm stub testues, jo kontrata reale. Zëvendësoni DOCX-in te templates/contracts ose ngarkoni kontratën reale te Shabllonet.",
    );
  }

  const detectedFromDb = detectedKeysFromVersionJson(version.detectedPlaceholders);



  const { buffer: renderedBuffer, detectedKeys } = generateDocxFromTemplate({

    templateDocxBuffer,

    detectionMode: version.detectionMode,

    mappingJson: version.mappingJson,

    detectedPlaceholders: detectedFromDb ?? null,

    underlineFieldOrder: version.underlineFieldOrder,

    values: mergedContext,

    manualOverrides: manual,

    placeholderRegistry: registry,

  });



  const attemptPdfDefault = params.artifactKind === "ARCHIVED_FINAL";

  const attemptPdf = params.attemptPdf ?? attemptPdfDefault;



  let pdfBuffer: Buffer | null = null;

  let pdfConversionError: string | null = null;



  if (attemptPdf) {

    const conv = await convertDocxBufferToPdf(renderedBuffer);

    if (conv.ok) {

      pdfBuffer = conv.pdf;

    } else if ("skipped" in conv && conv.skipped) {

      if (params.artifactKind === "ARCHIVED_FINAL") {

        throw new Error(

          "Konvertimi PDF nuk është i disponueshëm. Instaloni LibreOffice ose vendosni DOCX_TO_PDF_URL.",

        );

      }

    } else if ("error" in conv) {

      pdfConversionError = conv.error;

      if (params.artifactKind === "ARCHIVED_FINAL") {

        throw new Error(`Konvertimi PDF dështoi: ${conv.error}`);

      }

    }

  }



  const artifactId = randomUUID();

  const docxStorageKey = generationArtifactDocxKey({

    companyId: params.companyId,

    subjectKind: params.subjectKind,

    subjectId: params.subjectId,

    artifactId,

  });

  const docxSha256 = sha256Hex(renderedBuffer);



  let pdfStorageKey: string | null = null;

  let pdfSha256: string | null = null;



  if (pdfBuffer) {

    pdfStorageKey = generationArtifactPdfKey({

      companyId: params.companyId,

      subjectKind: params.subjectKind,

      subjectId: params.subjectId,

      artifactId,

    });

    pdfSha256 = sha256Hex(pdfBuffer);

  }



  const displayFilename =

    params.displayFilename ??

    buildGeneratedDocumentBasename({

      category,

      employeeFirstName: params.employeeFirstName,

      employeeLastName: params.employeeLastName,

      payrollYear: params.payrollYear,

      payrollMonth: params.payrollMonth,

      documentDate: params.documentDate,

    });



  const title = params.title?.trim() || template.name;



  await params.storage.put(docxStorageKey, renderedBuffer, {

    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  });

  if (pdfBuffer && pdfStorageKey) {

    await params.storage.put(pdfStorageKey, pdfBuffer, { contentType: "application/pdf" });

  }



  await params.prisma.documentGenerationArtifact.create({

    data: {

      id: artifactId,

      companyId: params.companyId,

      employeeId: params.employeeId ?? undefined,

      payrollId: params.payrollId ?? undefined,

      documentTemplateId: template.id,

      subjectKind: params.subjectKind,

      subjectId: params.subjectId,

      documentCategory: category,

      templateVersionId: version.id,

      kind: params.artifactKind,

      title,

      displayFilename,

      mergedPayload: mergedContext as Prisma.InputJsonValue,

      detectedPlaceholderKeys: detectedKeys as Prisma.InputJsonValue,

      snapshotSchemaVersion: "v1",

      generatedDocxStorageKey: docxStorageKey,

      generatedPdfStorageKey: pdfStorageKey ?? undefined,

      docxSha256,

      pdfSha256: pdfSha256 ?? undefined,

      generationStatus: DocumentGenerationStatus.SUCCEEDED,

      generationError: pdfConversionError ?? undefined,

      supersedesArtifactId: params.supersedesArtifactId ?? undefined,

      createdByUserId: params.createdByUserId ?? undefined,

    },

  });



  return {

    artifactId,

    docxStorageKey,

    pdfStorageKey,

    buffer: renderedBuffer,

    detectedKeys,

    mergedContext,

    templateVersionId: version.id,

    documentCategory: category,

    pdfConversionError,

  };

}



export type PersistRenderedDocxArtifactParams = FinalizeDocumentGenerationParams;

export type PersistRenderedDocxArtifactResult = FinalizeDocumentGenerationResult;



export async function persistRenderedDocxArtifact(

  params: FinalizeDocumentGenerationParams,

): Promise<FinalizeDocumentGenerationResult> {

  return finalizeDocumentGeneration(params);

}


