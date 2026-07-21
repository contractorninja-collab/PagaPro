import { Prisma, type ContractTermType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMoneyEUR } from "@/modules/documents/context/format";
import {
  appendEmployeeTimeline,
  appendEmployeeAuditLog as appendEmpAuditLog,
  appendDomainEmployeeActivity as appendEmpDomainActivity,
} from "@/modules/employees/services/employee-audit";
import { DomainActivityVerb } from "@prisma/client";
import {
  ANNEX_CATEGORY_LABELS,
  CONTRACT_TERM_LABELS,
  type AnnexChange,
  type AnnexChangeCategory,
  type AnnexChangeSuggestion,
  type AnnexDiff,
} from "@/modules/annex/types";

const EMPLOYEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  weeklyHours: true,
  baseSalaryMonthly: true,
  workplace: true,
  hireDate: true,
  contractStartDate: true,
  contractEndDate: true,
  contractType: true,
  department: { select: { name: true } },
  jobTitleProfile: { select: { description: true } },
} satisfies Prisma.EmployeeSelect;

function decStr(d: Prisma.Decimal | null): string {
  return d == null ? "" : d.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

/**
 * Suggests the changes for a new annex by diffing the employee's current Neni-11
 * elements against the most recent annex snapshot (or, for the first annex,
 * salary against its own history and the rest left for HR to confirm).
 */
export async function computeAnnexDiff(
  companyId: string,
  employeeId: string,
): Promise<{ ok: true; diff: AnnexDiff } | { ok: false; error: string }> {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: EMPLOYEE_SELECT,
  });
  if (!emp) return { ok: false, error: "Punonjësi nuk u gjet." };

  const lastAnnex = await prisma.employeeContractAnnex.findFirst({
    where: { companyId, employeeId },
    orderBy: { annexNumber: "desc" },
  });

  // Salary "previous": last annex snapshot, else the employee's initial recorded salary.
  let prevSalary: string;
  if (lastAnnex?.snapshotBaseSalary != null) {
    prevSalary = decStr(lastAnnex.snapshotBaseSalary);
  } else {
    const firstSalary = await prisma.employeeSalaryChange.findFirst({
      where: { companyId, employeeId },
      orderBy: { effectiveFrom: "asc" },
      select: { newBaseSalary: true },
    });
    prevSalary = decStr(firstSalary?.newBaseSalary ?? emp.baseSalaryMonthly);
  }

  const currentJobDescription = emp.jobTitleProfile?.description ?? "";
  const hasPrev = Boolean(lastAnnex);

  const suggest = (
    category: AnnexChangeCategory,
    fromRaw: string,
    toRaw: string,
    fromKnown: boolean,
    fmt: (v: string) => string = (v) => v,
  ): AnnexChangeSuggestion => ({
    category,
    label: ANNEX_CATEGORY_LABELS[category],
    from: fromRaw ? fmt(fromRaw) : "",
    to: toRaw ? fmt(toRaw) : "",
    changed: fromKnown ? fromRaw !== toRaw : false,
    fromUnknown: !fromKnown,
  });

  const suggestions: AnnexChangeSuggestion[] = [
    suggest("SALARY", prevSalary, decStr(emp.baseSalaryMonthly), true, formatMoneyEUR),
    suggest("JOB_TITLE", lastAnnex?.snapshotJobTitle ?? "", emp.jobTitle ?? "", hasPrev),
    suggest(
      "JOB_DESCRIPTION",
      lastAnnex?.snapshotJobDescription ?? "",
      currentJobDescription,
      hasPrev,
    ),
    suggest("DEPARTMENT", lastAnnex?.snapshotDepartment ?? "", emp.department?.name ?? "", hasPrev),
    suggest(
      "HOURS",
      decStr(lastAnnex?.snapshotWeeklyHours ?? null),
      decStr(emp.weeklyHours),
      hasPrev,
    ),
    suggest("WORKPLACE", lastAnnex?.snapshotWorkplace ?? "", emp.workplace ?? "", hasPrev),
    suggest(
      "CONTRACT_TERM",
      lastAnnex ? CONTRACT_TERM_LABELS[lastAnnex.snapshotContractType ?? "INDEFINITE"] : "",
      CONTRACT_TERM_LABELS[emp.contractType],
      hasPrev,
    ),
  ];

  return {
    ok: true,
    diff: {
      hasPreviousAnnex: hasPrev,
      suggestions,
      contractEndDate: emp.contractEndDate ? emp.contractEndDate.toISOString().slice(0, 10) : null,
      contractType: emp.contractType,
    },
  };
}

export interface AnnexPanelData {
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractType: ContractTermType;
  annexes: Array<{
    id: string;
    annexNumber: number;
    effectiveDate: string;
    changeCategories: string[];
    createdAt: string;
  }>;
}

export async function getAnnexPanelData(
  companyId: string,
  employeeId: string,
): Promise<{ ok: true; data: AnnexPanelData } | { ok: false; error: string }> {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { contractStartDate: true, contractEndDate: true, contractType: true, hireDate: true },
  });
  if (!emp) return { ok: false, error: "Punonjësi nuk u gjet." };

  const annexes = await prisma.employeeContractAnnex.findMany({
    where: { companyId, employeeId },
    orderBy: { annexNumber: "desc" },
    select: {
      id: true,
      annexNumber: true,
      effectiveDate: true,
      changeCategories: true,
      createdAt: true,
    },
  });

  return {
    ok: true,
    data: {
      contractStartDate: (emp.contractStartDate ?? emp.hireDate).toISOString().slice(0, 10),
      contractEndDate: emp.contractEndDate ? emp.contractEndDate.toISOString().slice(0, 10) : null,
      contractType: emp.contractType,
      annexes: annexes.map((a) => ({
        id: a.id,
        annexNumber: a.annexNumber,
        effectiveDate: a.effectiveDate.toISOString().slice(0, 10),
        changeCategories: a.changeCategories,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
}

export async function updateContractTerm(
  companyId: string,
  employeeId: string,
  input: { contractType: ContractTermType; contractEndDate: Date | null },
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await prisma.employee.updateMany({
    where: { id: employeeId, companyId },
    data: { contractType: input.contractType, contractEndDate: input.contractEndDate },
  });
  if (res.count === 0) return { ok: false, error: "Punonjësi nuk u gjet." };

  await appendEmpAuditLog({
    companyId,
    employeeId,
    action: "EMPLOYEE_CONTRACT_TERM_UPDATED",
    actorUserId,
    diff: JSON.parse(
      JSON.stringify({
        contractType: input.contractType,
        contractEndDate: input.contractEndDate?.toISOString() ?? null,
      }),
    ),
  });
  return { ok: true };
}

/**
 * Deletes an annex created by mistake. Only removes the record — the employee's
 * data (and any contract-term change a renewal applied) is left as-is; the
 * contract-term editor can correct that separately. The snapshot chain re-points
 * to the new latest annex automatically, since each annex carries its own snapshot.
 */
export async function deleteEmployeeContractAnnex(
  companyId: string,
  annexId: string,
  actorUserId: string | null,
): Promise<{ ok: true; employeeId: string } | { ok: false; error: string }> {
  const annex = await prisma.employeeContractAnnex.findFirst({
    where: { id: annexId, companyId },
    select: { id: true, employeeId: true, annexNumber: true },
  });
  if (!annex) return { ok: false, error: "Aneksi nuk u gjet." };

  await prisma.employeeContractAnnex.deleteMany({ where: { id: annexId, companyId } });

  await appendEmpAuditLog({
    companyId,
    employeeId: annex.employeeId,
    action: "EMPLOYEE_CONTRACT_ANNEX_DELETED",
    actorUserId,
    diff: JSON.parse(JSON.stringify({ annexNumber: annex.annexNumber })),
  });

  return { ok: true, employeeId: annex.employeeId };
}

export interface CreateAnnexInput {
  employeeId: string;
  effectiveDate: Date;
  changes: AnnexChange[];
  /** Renewal: when set, updates the employee's contract term and snapshots the new values. */
  contractEndDate?: Date | null;
  contractType?: ContractTermType;
}

export async function createEmployeeContractAnnex(
  companyId: string,
  input: CreateAnnexInput,
  actorUserId: string | null,
): Promise<{ ok: true; id: string; annexNumber: number } | { ok: false; error: string }> {
  try {
    const emp = await prisma.employee.findFirst({
      where: { id: input.employeeId, companyId },
      select: EMPLOYEE_SELECT,
    });
    if (!emp) return { ok: false, error: "Punonjësi nuk u gjet." };
    if (input.changes.length === 0) {
      return { ok: false, error: "Zgjidhni të paktën një ndryshim për aneksin." };
    }

    const annex = await prisma.$transaction(async (tx) => {
      // Apply a renewal to the employee first, so the snapshot captures the new term.
      if (input.contractType !== undefined || input.contractEndDate !== undefined) {
        await tx.employee.update({
          where: { id: emp.id },
          data: {
            contractType: input.contractType ?? emp.contractType,
            contractEndDate:
              input.contractEndDate !== undefined ? input.contractEndDate : emp.contractEndDate,
          },
        });
      }

      const agg = await tx.employeeContractAnnex.aggregate({
        where: { employeeId: emp.id },
        _max: { annexNumber: true },
      });
      const annexNumber = (agg._max.annexNumber ?? 0) + 1;

      return tx.employeeContractAnnex.create({
        data: {
          companyId,
          employeeId: emp.id,
          annexNumber,
          effectiveDate: input.effectiveDate,
          changeCategories: input.changes.map((c) => c.category),
          changesJson: input.changes as unknown as Prisma.InputJsonValue,
          // Snapshot the current (post-renewal) Neni-11 state — the baseline for the next annex.
          snapshotJobTitle: emp.jobTitle,
          snapshotJobDescription: emp.jobTitleProfile?.description ?? null,
          snapshotDepartment: emp.department?.name ?? null,
          snapshotWorkplace: emp.workplace,
          snapshotWeeklyHours: emp.weeklyHours,
          snapshotBaseSalary: emp.baseSalaryMonthly,
          snapshotContractStart: emp.contractStartDate,
          snapshotContractEnd:
            input.contractEndDate !== undefined ? input.contractEndDate : emp.contractEndDate,
          snapshotContractType: input.contractType ?? emp.contractType,
          createdById: actorUserId ?? undefined,
        },
      });
    });

    await appendEmployeeTimeline({
      companyId,
      employeeId: emp.id,
      eventType: "EMPLOYEE_CONTRACT_ANNEX",
      title: `Aneks kontrate nr. ${annex.annexNumber}`,
      body: input.changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join("; "),
      actorUserId,
    });
    await appendEmpDomainActivity({
      companyId,
      employeeId: emp.id,
      verb: DomainActivityVerb.CREATED,
      summary: `U lëshua aneks kontrate nr. ${annex.annexNumber}.`,
      actorUserId,
    });
    await appendEmpAuditLog({
      companyId,
      employeeId: emp.id,
      action: "EMPLOYEE_CONTRACT_ANNEX_CREATED",
      actorUserId,
      diff: JSON.parse(JSON.stringify({ annexNumber: annex.annexNumber, changes: input.changes })),
    });

    return { ok: true, id: annex.id, annexNumber: annex.annexNumber };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
