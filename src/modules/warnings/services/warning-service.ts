import { DomainActivityVerb } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendEmployeeAuditLog as appendEmpAuditLog,
  appendDomainEmployeeActivity as appendEmpDomainActivity,
  appendEmployeeTimeline,
} from "@/modules/employees/services/employee-audit";
import type { WarningCreateInput } from "@/modules/warnings/validators/warning-schemas";
import type { WarningMeasure, WarningRow } from "@/modules/warnings/types";

function toRow(row: {
  id: string;
  issuedAt: Date;
  summary: string;
  measure: string | null;
  improvementDeadline: Date | null;
  status: string;
}): WarningRow {
  return {
    id: row.id,
    issuedAt: row.issuedAt.toISOString().slice(0, 10),
    summary: row.summary,
    measure: (row.measure as WarningMeasure | null) ?? null,
    improvementDeadline: row.improvementDeadline
      ? row.improvementDeadline.toISOString().slice(0, 10)
      : null,
    status: row.status,
  };
}

export async function listEmployeeWarnings(
  companyId: string,
  employeeId: string,
): Promise<WarningRow[]> {
  const rows = await prisma.disciplinaryWarning.findMany({
    where: { companyId, employeeId },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      issuedAt: true,
      summary: true,
      measure: true,
      improvementDeadline: true,
      status: true,
    },
  });
  return rows.map(toRow);
}

export async function createDisciplinaryWarning(
  companyId: string,
  input: WarningCreateInput,
  actorUserId: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, companyId },
    select: { id: true },
  });
  if (!employee) return { ok: false, error: "Punonjësi nuk u gjet." };

  // Neni 70.2: a written warning only carries consequences when it sets a deadline.
  if (input.measure === "ME_SHKRIM" && !input.improvementDeadline) {
    return {
      ok: false,
      error: "Vërejtja me shkrim kërkon afatin për përmirësim (neni 70.2).",
    };
  }

  try {
    const created = await prisma.disciplinaryWarning.create({
      data: {
        companyId,
        employeeId: employee.id,
        issuedAt: input.issuedAt,
        summary: input.summary.trim(),
        measure: input.measure,
        improvementDeadline: input.improvementDeadline ?? undefined,
      },
      select: { id: true },
    });

    await appendEmployeeTimeline({
      companyId,
      employeeId: employee.id,
      eventType: "WARNING_ISSUED",
      title:
        input.measure === "ME_SHKRIM" ? "U lëshua vërejtje me shkrim" : "U lëshua vërejtje me gojë",
      body: input.summary.trim(),
      actorUserId,
    });
    await appendEmpDomainActivity({
      companyId,
      employeeId: employee.id,
      verb: DomainActivityVerb.CREATED,
      summary: "U lëshua vërejtje disiplinore.",
      actorUserId,
    });
    await appendEmpAuditLog({
      companyId,
      employeeId: employee.id,
      action: "EMPLOYEE_WARNING_CREATED",
      actorUserId,
      diff: JSON.parse(
        JSON.stringify({ measure: input.measure, issuedAt: input.issuedAt.toISOString() }),
      ),
    });

    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteDisciplinaryWarning(
  companyId: string,
  warningId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.disciplinaryWarning.findFirst({
    where: { id: warningId, companyId },
    select: { id: true, employeeId: true },
  });
  if (!existing) return { ok: false, error: "Vërejtja nuk u gjet." };

  await prisma.disciplinaryWarning.deleteMany({ where: { id: warningId, companyId } });

  await appendEmpAuditLog({
    companyId,
    employeeId: existing.employeeId,
    action: "EMPLOYEE_WARNING_DELETED",
    actorUserId,
    diff: JSON.parse(JSON.stringify({ warningId })),
  });

  return { ok: true };
}
