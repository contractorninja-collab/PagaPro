import type { LeaveType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateLeavePdfArtifact } from "@/modules/leaves/services/leave-document-service";

/**
 * Approving a leave produces its document automatically. Clients read an
 * approval as "the paperwork exists now" — the manual Gjenero step stays
 * available for regeneration and for extra certificates, but nobody should
 * have to know it exists for the standard case.
 *
 * Template choice is by seeded name per leave type (annual leave gets the
 * decision, the rest their certificate). Companies can rename or delete
 * templates, so every name in the preference list may miss; the fallback is
 * any LEAVE template, and a company with none simply skips — approval must
 * never fail or block on document generation, which is why the caller wraps
 * this in try/catch rather than awaiting it inside the approval transaction.
 */
const TEMPLATE_NAME_PREFERENCE: Record<LeaveType, string[]> = {
  PUSHIM_VJETOR: ["Vendim për pushim vjetor", "Vërtetim për pushim vjetor"],
  PUSHIM_MJEKESOR: ["Vërtetim për pushim mjekësor"],
  PUSHIM_PERSONAL: ["Vërtetim për pushim personal"],
  PUSHIM_PA_PAGESE: ["Vërtetim për pushim pa pagesë"],
  PUSHIM_LEHONIE: ["Vërtetim për pushim lehonie"],
  TJETER: ["Vërtetim për pushim tjetër"],
};

export async function autoGenerateLeaveDocumentOnApproval(params: {
  companyId: string;
  leaveRequestId: string;
  leaveType: LeaveType;
  actorUserId?: string | null;
}): Promise<{ generated: boolean; artifactId?: string; reason?: string }> {
  // A document already generated for this request (e.g. before a revoke →
  // re-approve cycle) is kept, not duplicated.
  const existing = await prisma.leaveDocument.findFirst({
    where: {
      leaveRequestId: params.leaveRequestId,
      leaveRequest: { companyId: params.companyId },
    },
    select: { id: true },
  });
  if (existing) return { generated: false, reason: "already-documented" };

  const templates = await prisma.documentTemplate.findMany({
    where: { companyId: params.companyId, documentCategory: "LEAVE" },
    select: { id: true, name: true },
  });
  if (templates.length === 0) return { generated: false, reason: "no-leave-templates" };

  const preferred = TEMPLATE_NAME_PREFERENCE[params.leaveType] ?? [];
  const template =
    preferred
      .map((name) => templates.find((t) => t.name === name))
      .find((t) => t !== undefined) ?? templates[0];
  if (!template) return { generated: false, reason: "no-leave-templates" };

  const artifactId = await generateLeavePdfArtifact({
    companyId: params.companyId,
    leaveRequestId: params.leaveRequestId,
    documentTemplateId: template.id,
    actorUserId: params.actorUserId ?? null,
  });
  return { generated: true, artifactId };
}
