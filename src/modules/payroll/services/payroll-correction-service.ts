import { randomUUID } from "node:crypto";
import type { PayrollCorrectionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendPayrollAuditLog, appendPayrollDomainActivity } from "@/modules/payroll/services/payroll-audit-service";

export async function createPayrollCorrection(params: {
  companyId: string;
  payrollId: string;
  employeeId: string;
  kind: PayrollCorrectionKind;
  amount: string;
  reason: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: params.payrollId, companyId: params.companyId },
  });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "LOCKED" && payroll.status !== "ARCHIVED") {
    return { ok: false, error: "Korrigjimet lejohen vetëm pas kyçjes së payroll-it." };
  }

  const emp = await prisma.employee.findFirst({
    where: { id: params.employeeId, companyId: params.companyId },
  });
  if (!emp) return { ok: false, error: "Punonjësi nuk u gjet." };

  const id = randomUUID();
  await prisma.payrollCorrection.create({
    data: {
      id,
      companyId: params.companyId,
      payrollId: params.payrollId,
      employeeId: params.employeeId,
      kind: params.kind,
      amount: params.amount,
      reason: params.reason,
      createdByUserId: params.actorUserId ?? undefined,
      metadata: params.metadata === undefined ? undefined : (params.metadata as object),
    },
  });

  await appendPayrollDomainActivity({
    companyId: params.companyId,
    payrollId: params.payrollId,
    verb: "UPDATED",
    summary: "U regjistrua një korrigjim pas kyçjes.",
    actorUserId: params.actorUserId,
    payload: { correctionId: id, kind: params.kind },
  });
  await appendPayrollAuditLog({
    companyId: params.companyId,
    payrollId: params.payrollId,
    action: "CORRECTION_CREATE",
    actorUserId: params.actorUserId,
    diff: { correctionId: id },
  });

  return { ok: true, id };
}
