import { createHash } from "crypto";
import type { EmployeeDocumentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage, safeDeleteAsset } from "@/lib/company-asset-storage";
import {
  appendDomainEmployeeActivity,
  appendEmployeeAuditLog,
  appendEmployeeTimeline,
} from "@/modules/employees/services/employee-audit";
import {
  ALLOWED_EMPLOYEE_DOCUMENT_MIME,
  MAX_EMPLOYEE_DOCUMENT_BYTES,
  buildEmployeeDocumentStorageKey,
  isSensitiveCategory,
  matchesDeclaredMime,
  sanitizeDisplayFilename,
} from "@/modules/employee-documents/services/employee-document-file";

export type EmployeeDocumentServiceError =
  | "EMPLOYEE_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_NOT_ALLOWED"
  | "FILE_CONTENT_MISMATCH"
  | "STORAGE_FAILED"
  | "DB_FAILED";

type Result<T> = { ok: true; data: T } | { ok: false; code: EmployeeDocumentServiceError };

export async function createEmployeeDocument(params: {
  companyId: string;
  employeeId: string;
  category: EmployeeDocumentCategory;
  title: string;
  note?: string | null;
  originalFilename: string;
  declaredMime: string;
  bytes: Buffer;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  supersedesId?: string | null;
  actorUserId?: string | null;
}): Promise<Result<{ documentId: string }>> {
  const employee = await prisma.employee.findFirst({
    where: { id: params.employeeId, companyId: params.companyId },
    select: { id: true },
  });
  if (!employee) return { ok: false, code: "EMPLOYEE_NOT_FOUND" };

  if (params.bytes.byteLength === 0 || params.bytes.byteLength > MAX_EMPLOYEE_DOCUMENT_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE" };
  }
  if (!(params.declaredMime in ALLOWED_EMPLOYEE_DOCUMENT_MIME)) {
    return { ok: false, code: "FILE_TYPE_NOT_ALLOWED" };
  }
  if (!matchesDeclaredMime(params.bytes, params.declaredMime)) {
    return { ok: false, code: "FILE_CONTENT_MISMATCH" };
  }

  const storageKey = buildEmployeeDocumentStorageKey(
    params.companyId,
    params.employeeId,
    params.declaredMime,
  );

  try {
    await getCompanyAssetStorage().put(storageKey, params.bytes, {
      contentType: params.declaredMime,
    });
  } catch {
    return { ok: false, code: "STORAGE_FAILED" };
  }

  let documentId: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      // The superseded row must belong to the same employee — otherwise a
      // crafted id could archive a document in someone else's dossier.
      const supersedes = params.supersedesId
        ? await tx.employeeDocument.findFirst({
            where: {
              id: params.supersedesId,
              companyId: params.companyId,
              employeeId: params.employeeId,
            },
            select: { id: true },
          })
        : null;

      const row = await tx.employeeDocument.create({
        data: {
          companyId: params.companyId,
          employeeId: params.employeeId,
          category: params.category,
          title: params.title,
          note: params.note ?? undefined,
          displayFilename: sanitizeDisplayFilename(params.originalFilename),
          storageKey,
          contentType: params.declaredMime,
          sizeBytes: params.bytes.byteLength,
          sha256: createHash("sha256").update(params.bytes).digest("hex"),
          issuedAt: params.issuedAt ?? undefined,
          expiresAt: params.expiresAt ?? undefined,
          supersedesId: supersedes?.id,
          uploadedByUserId: params.actorUserId ?? undefined,
        },
        select: { id: true },
      });

      if (supersedes) {
        await tx.employeeDocument.update({
          where: { id: supersedes.id },
          data: { isArchived: true, archivedAt: new Date() },
        });
      }
      return row;
    });
    documentId = created.id;
  } catch {
    await safeDeleteAsset(storageKey);
    return { ok: false, code: "DB_FAILED" };
  }

  // The dossier changed; the record of that must not depend on best-effort logs,
  // but a failed log must not undo a successful upload either.
  try {
    await appendEmployeeAuditLog({
      companyId: params.companyId,
      employeeId: params.employeeId,
      action: "EMPLOYEE_DOCUMENT_UPLOADED",
      actorUserId: params.actorUserId,
      diff: { documentId, category: params.category, title: params.title },
    });
    await appendEmployeeTimeline({
      companyId: params.companyId,
      employeeId: params.employeeId,
      eventType: "EMPLOYEE_DOCUMENT_UPLOADED",
      title: `Dokument i ngarkuar: ${params.title}`,
      body: params.note ?? undefined,
      actorUserId: params.actorUserId,
      metadata: { documentId, category: params.category },
    });
    await appendDomainEmployeeActivity({
      companyId: params.companyId,
      employeeId: params.employeeId,
      verb: "CREATED",
      summary: `Dokument i ngarkuar në dosje: ${params.title}`,
      actorUserId: params.actorUserId,
      payload: { documentId, category: params.category },
    });
  } catch (err) {
    console.error("[employee-documents] audit append failed", err);
  }

  return { ok: true, data: { documentId } };
}

/**
 * The dossier list. Sensitive categories are filtered HERE, server-side —
 * hiding a folder in the UI while returning its rows in the payload would be
 * no protection at all.
 */
export async function listEmployeeDocumentsForEmployee(params: {
  companyId: string;
  employeeId: string;
  includeSensitive: boolean;
  includeArchived?: boolean;
}) {
  return prisma.employeeDocument.findMany({
    where: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      ...(params.includeArchived ? {} : { isArchived: false }),
      ...(params.includeSensitive ? {} : { category: { notIn: ["MJEKESORE", "DISIPLINORE"] } }),
    },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { uploadedBy: { select: { displayName: true, email: true } } },
  });
}

export async function setEmployeeDocumentArchived(params: {
  companyId: string;
  documentId: string;
  archived: boolean;
  actorUserId?: string | null;
}): Promise<Result<{ employeeId: string }>> {
  const doc = await prisma.employeeDocument.findFirst({
    where: { id: params.documentId, companyId: params.companyId },
    select: { id: true, employeeId: true, title: true },
  });
  if (!doc) return { ok: false, code: "DOCUMENT_NOT_FOUND" };

  await prisma.employeeDocument.update({
    where: { id: doc.id },
    data: params.archived
      ? { isArchived: true, archivedAt: new Date() }
      : { isArchived: false, archivedAt: null },
  });

  try {
    await appendEmployeeAuditLog({
      companyId: params.companyId,
      employeeId: doc.employeeId,
      action: params.archived ? "EMPLOYEE_DOCUMENT_ARCHIVED" : "EMPLOYEE_DOCUMENT_RESTORED",
      actorUserId: params.actorUserId,
      diff: { documentId: doc.id, title: doc.title },
    });
  } catch (err) {
    console.error("[employee-documents] audit append failed", err);
  }

  return { ok: true, data: { employeeId: doc.employeeId } };
}

/** Serve-time read: row + the sensitivity verdict the route must enforce. */
export async function getEmployeeDocumentForServe(params: {
  companyId: string;
  employeeId: string;
  documentId: string;
}) {
  const doc = await prisma.employeeDocument.findFirst({
    where: { id: params.documentId, employeeId: params.employeeId, companyId: params.companyId },
  });
  if (!doc) return null;
  return { doc, sensitive: isSensitiveCategory(doc.category) };
}

export async function logEmployeeDocumentDownloaded(params: {
  companyId: string;
  employeeId: string;
  documentId: string;
  actorUserId?: string | null;
}): Promise<void> {
  // Audit-log only — downloads in the visible timeline would drown real events.
  try {
    await appendEmployeeAuditLog({
      companyId: params.companyId,
      employeeId: params.employeeId,
      action: "EMPLOYEE_DOCUMENT_DOWNLOADED",
      actorUserId: params.actorUserId,
      diff: { documentId: params.documentId },
    });
  } catch (err) {
    console.error("[employee-documents] download audit failed", err);
  }
}
