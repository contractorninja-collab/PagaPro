"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { resolveActiveCompanyId } from "@/server/company-scope";
import {
  createTerminationWorkflow,
  updateTerminationWorkflow,
  submitTerminationForReview,
  approveTerminationWorkflow,
  prepareTerminationFinalPayrollAction,
  generateTerminationDocumentAction,
  completeTerminationWorkflow,
  cancelTerminationWorkflow,
  toggleTerminationChecklist,
} from "@/modules/terminations/services/termination-workflow-service";
import {
  terminationCreateSchema,
  terminationUpdateSchema,
  terminationIdSchema,
  checklistToggleSchema,
} from "@/modules/terminations/validators/termination-schemas";

export type TerminationActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function rev(): void {
  try {
    revalidatePath("/largimet");
  } catch {
    /* ignore */
  }
}

async function companyOrFail(): Promise<string | null> {
  return resolveActiveCompanyId();
}

export async function createTerminationAction(raw: unknown): Promise<TerminationActionResult<{ id: string }>> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const res = await createTerminationWorkflow(companyId, parsed.data, null);
  if (!res.ok) return res;
  rev();
  return res;
}

export async function updateTerminationAction(raw: unknown): Promise<TerminationActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const res = await updateTerminationWorkflow(companyId, parsed.data, null);
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${parsed.data.id}`);
  } catch {
    /* ignore */
  }
  return res;
}

export async function submitTerminationAction(raw: unknown): Promise<TerminationActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await submitTerminationForReview(companyId, parsed.data.id, null);
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${parsed.data.id}`);
  } catch {
    /* ignore */
  }
  return res;
}

export async function approveTerminationAction(raw: unknown): Promise<TerminationActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await approveTerminationWorkflow(companyId, parsed.data.id, null);
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${parsed.data.id}`);
  } catch {
    /* ignore */
  }
  return res;
}

export async function prepareFinalPayrollTerminationAction(raw: unknown): Promise<TerminationActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await prepareTerminationFinalPayrollAction(companyId, parsed.data.id, null);
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${parsed.data.id}`);
    revalidatePath("/pagat");
  } catch {
    /* ignore */
  }
  return res;
}

export async function generateTerminationDocumentActionServer(
  raw: unknown,
): Promise<TerminationActionResult<{ artifactId: string }>> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await generateTerminationDocumentAction(companyId, parsed.data.id, null);
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${parsed.data.id}`);
    revalidatePath("/dokumentet");
  } catch {
    /* ignore */
  }
  return res;
}

export async function completeTerminationAction(raw: unknown): Promise<TerminationActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const id = parsed.data.id;

  const empRow = await prisma.termination.findFirst({
    where: { id, companyId },
    select: { employeeId: true },
  });

  const res = await completeTerminationWorkflow(companyId, id, null);
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${id}`);
    if (empRow?.employeeId) {
      revalidatePath(`/punonjesit/${empRow.employeeId}`);
    }
  } catch {
    /* ignore */
  }
  return res;
}

export async function cancelTerminationAction(raw: unknown): Promise<TerminationActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = terminationIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await cancelTerminationWorkflow(companyId, parsed.data.id, null);
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${parsed.data.id}`);
  } catch {
    /* ignore */
  }
  return res;
}

export async function toggleTerminationChecklistAction(raw: unknown): Promise<TerminationActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = checklistToggleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const res = await toggleTerminationChecklist(
    companyId,
    parsed.data.terminationId,
    parsed.data.itemKey,
    parsed.data.isCompleted,
    null,
  );
  if (!res.ok) return res;
  rev();
  try {
    revalidatePath(`/largimet/${parsed.data.terminationId}`);
  } catch {
    /* ignore */
  }
  return res;
}
