"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/server/company-context";
import { can } from "@/server/permissions";
import {
  createEmployeeDocument,
  deleteEmployeeDocument,
  setEmployeeDocumentArchived,
  type EmployeeDocumentServiceError,
} from "@/modules/employee-documents/services/employee-document-service";
import {
  archiveEmployeeDocumentSchema,
  deleteEmployeeDocumentSchema,
  uploadEmployeeDocumentPayloadSchema,
} from "@/modules/employee-documents/validations/employee-document-schemas";

export type EmployeeDocumentActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const SERVICE_ERROR_SQ: Record<EmployeeDocumentServiceError, string> = {
  EMPLOYEE_NOT_FOUND: "Punonjësi nuk u gjet.",
  DOCUMENT_NOT_FOUND: "Dokumenti nuk u gjet.",
  FILE_TOO_LARGE: "Skedari është bosh ose mbi 10 MB.",
  FILE_TYPE_NOT_ALLOWED: "Lloji i skedarit nuk lejohet. Pranohen: PDF, JPG, PNG, WEBP, DOCX.",
  FILE_CONTENT_MISMATCH: "Përmbajtja e skedarit nuk përputhet me llojin e deklaruar.",
  STORAGE_FAILED: "Ruajtja e skedarit dështoi. Provoni sërish.",
  DB_FAILED: "Regjistrimi i dokumentit dështoi. Provoni sërish.",
};

export async function uploadEmployeeDocumentAction(
  formData: FormData,
): Promise<EmployeeDocumentActionResult<{ documentId: string }>> {
  const ctx = await requireCapability("documents.write");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user } = ctx.context;

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Të dhëna të pavlefshme." };
  }
  const parsed = uploadEmployeeDocumentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Të dhëna të pavlefshme." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Zgjidhni një skedar." };
  }

  const result = await createEmployeeDocument({
    companyId,
    employeeId: parsed.data.employeeId,
    category: parsed.data.category,
    title: parsed.data.title,
    note: parsed.data.note ?? null,
    originalFilename: file.name,
    declaredMime: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
    issuedAt: parsed.data.issuedAt ?? null,
    expiresAt: parsed.data.expiresAt ?? null,
    supersedesId: parsed.data.supersedesId ?? null,
    actorUserId: user.id,
  });
  if (!result.ok) return { ok: false, error: SERVICE_ERROR_SQ[result.code] };

  revalidatePath(`/punonjesit/${parsed.data.employeeId}`);
  revalidatePath("/paneli");
  return { ok: true, data: result.data };
}

export async function archiveEmployeeDocumentAction(
  raw: unknown,
): Promise<EmployeeDocumentActionResult> {
  const ctx = await requireCapability("documents.write");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user } = ctx.context;

  const parsed = archiveEmployeeDocumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

  const result = await setEmployeeDocumentArchived({
    companyId,
    documentId: parsed.data.documentId,
    archived: parsed.data.archived,
    actorUserId: user.id,
  });
  if (!result.ok) return { ok: false, error: SERVICE_ERROR_SQ[result.code] };

  revalidatePath(`/punonjesit/${result.data.employeeId}`);
  revalidatePath("/paneli");
  return { ok: true };
}

export async function deleteEmployeeDocumentAction(
  raw: unknown,
): Promise<EmployeeDocumentActionResult> {
  const ctx = await requireCapability("documents.write");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user, role } = ctx.context;

  const parsed = deleteEmployeeDocumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

  const result = await deleteEmployeeDocument({
    companyId,
    documentId: parsed.data.documentId,
    actorCanSensitive: can({ role, isPlatformAdmin: user.isPlatformAdmin }, "documents.sensitive"),
    actorUserId: user.id,
  });
  if (!result.ok) return { ok: false, error: SERVICE_ERROR_SQ[result.code] };

  revalidatePath(`/punonjesit/${result.data.employeeId}`);
  revalidatePath("/paneli");
  return { ok: true };
}
