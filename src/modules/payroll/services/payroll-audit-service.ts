import type { DomainActivityVerb, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYROLL_ENTITY_TYPE } from "@/modules/payroll/constants/timeline";

export async function appendPayrollDomainActivity(params: {
  companyId: string;
  payrollId: string;
  verb: DomainActivityVerb;
  summary: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.domainActivity.create({
      data: {
        companyId: params.companyId,
        entityType: PAYROLL_ENTITY_TYPE,
        entityId: params.payrollId,
        verb: params.verb,
        summary: params.summary,
        actorUserId: params.actorUserId ?? undefined,
        payload: params.payload === undefined ? undefined : (params.payload as Prisma.InputJsonValue),
      },
    });
  } catch {
    /* non-blocking audit */
  }
}

export async function appendPayrollAuditLog(params: {
  companyId: string;
  payrollId: string;
  action: string;
  actorUserId?: string | null;
  diff?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        entityType: PAYROLL_ENTITY_TYPE,
        entityId: params.payrollId,
        action: params.action,
        actorUserId: params.actorUserId ?? undefined,
        diff: params.diff === undefined ? undefined : (params.diff as Prisma.InputJsonValue),
      },
    });
  } catch {
    /* non-blocking audit */
  }
}
