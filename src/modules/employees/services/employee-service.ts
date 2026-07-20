import { DomainActivityVerb, EmployeeHistoryEventKind, Prisma } from "@prisma/client";
import type { EmploymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  EmployeeDetailDto,
  EmployeeFiltersDto,
  EmployeeListRowDto,
  EmployeesPageDataDto,
} from "@/modules/employees/types";
import { listDepartmentsForCompany } from "@/modules/departments/services/department-service";
import { listActiveJobTitleOptions } from "@/modules/job-titles/services/job-title-service";
import type { EmployeeUpsertInput } from "@/modules/employees/validations/employee-schemas";
import {
  appendDomainEmployeeActivity,
  appendEmployeeAuditLog,
  appendEmployeeEmploymentHistory,
  appendEmployeeTimeline,
  EMPLOYEE_ENTITY,
  TIMELINE_TYPES,
} from "@/modules/employees/services/employee-audit";

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function toIso(d: Date): string {
  return d.toISOString();
}

function moneyToString(v: Prisma.Decimal): string {
  return v.toFixed ? v.toFixed(2) : String(v);
}

function mapListRow(e: {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string;
  email: string | null;
  jobTitle: string | null;
  jobTitleId: string | null;
  departmentId: string | null;
  status: EmploymentStatus;
  employmentType: import("@prisma/client").EmploymentType;
  baseSalaryMonthly: Prisma.Decimal;
  hireDate: Date;
  department: { name: string } | null;
  jobTitleProfile: { description: string; status: "ACTIVE" | "ARCHIVED" } | null;
}): EmployeeListRowDto {
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    personalId: e.personalId,
    email: e.email,
    jobTitle: e.jobTitle,
    jobTitleId: e.jobTitleId,
    jobDescription: e.jobTitleProfile?.description ?? null,
    departmentId: e.departmentId,
    departmentName: e.department?.name ?? null,
    status: e.status,
    employmentType: e.employmentType,
    baseSalaryMonthly: moneyToString(e.baseSalaryMonthly),
    hireDate: toIso(e.hireDate),
  };
}

export { listDepartmentsForCompany } from "@/modules/departments/services/department-service";

export async function getEmployeesPageData(
  companyId: string,
  filters: EmployeeFiltersDto,
): Promise<EmployeesPageDataDto> {
  const search = filters.search?.trim();
  const where: Prisma.EmployeeWhereInput = {
    companyId,
    AND: [
      search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { personalId: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      filters.status ? { status: filters.status } : {},
      filters.employmentType ? { employmentType: filters.employmentType } : {},
      filters.departmentId ? { departmentId: filters.departmentId } : {},
      filters.documentsMissing
        ? { documentsMissing: true, status: { not: "TERMINATED" } }
        : {},
    ],
  };

  const [employees, departments, jobTitles] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        department: { select: { name: true } },
        jobTitleProfile: { select: { description: true, status: true } },
      },
    }),
    listDepartmentsForCompany(companyId),
    listActiveJobTitleOptions(companyId),
  ]);

  return {
    employees: employees.map(mapListRow),
    departments,
    jobTitles,
  };
}

export async function getEmployeeById(companyId: string, id: string): Promise<EmployeeDetailDto | null> {
  const e = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      department: { select: { name: true } },
      jobTitleProfile: {
        select: {
          id: true,
          description: true,
          responsibilities: true,
          requirements: true,
          status: true,
        },
      },
      emergencyContacts: {
        where: { isPrimary: true },
        take: 1,
      },
      bankAccounts: {
        where: { isPrimary: true },
        take: 1,
      },
      salaryChanges: {
        orderBy: { effectiveFrom: "desc" },
        take: 50,
      },
    },
  });
  if (!e) return null;

  const ec = e.emergencyContacts[0];
  const bank = e.bankAccounts[0];
  const iban = e.bankAccountIban ?? bank?.iban ?? null;
  const bankName = e.bankName ?? bank?.bankName ?? null;

  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    personalId: e.personalId,
    dateOfBirth: e.dateOfBirth ? toIso(e.dateOfBirth) : null,
    gender: e.gender,
    phone: e.phone,
    email: e.email,
    addressLine: e.addressLine,
    addressCity: e.addressCity,
    addressCountry: e.addressCountry,
    departmentId: e.departmentId,
    departmentName: e.department?.name ?? null,
    jobTitle: e.jobTitle,
    jobTitleId: e.jobTitleId,
    jobDescription: e.jobTitleProfile?.description ?? null,
    jobResponsibilities: e.jobTitleProfile?.responsibilities ?? null,
    jobRequirements: e.jobTitleProfile?.requirements ?? null,
    jobTitleStatus: e.jobTitleProfile?.status ?? null,
    probationMonths: e.probationMonths,
    hireDate: toIso(e.hireDate),
    status: e.status,
    employmentType: e.employmentType,
    workArrangement: e.workArrangement,
    baseSalaryMonthly: moneyToString(e.baseSalaryMonthly),
    weeklyHours: moneyToString(e.weeklyHours),
    bankName,
    bankAccountIban: iban,
    applyTrust: e.applyTrust,
    applyTax: e.applyTax,
    emergencyContact: ec
      ? {
          fullName: ec.fullName,
          phone: ec.phone,
          relationship: ec.relationship,
        }
      : null,
    internalNotes: e.internalNotes,
    documentsMissing: e.documentsMissing,
    terminationDate: e.terminationDate ? toIso(e.terminationDate) : null,
    terminationReason: e.terminationReason,
    salaryHistory: e.salaryChanges.map((s) => ({
      id: s.id,
      effectiveFromIso: toIso(s.effectiveFrom),
      previousBaseSalary: s.previousBaseSalary ? moneyToString(s.previousBaseSalary) : null,
      newBaseSalary: moneyToString(s.newBaseSalary),
      compensationBasis: s.compensationBasis,
      targetNetMonthly: s.targetNetMonthly ? moneyToString(s.targetNetMonthly) : null,
      reason: s.reason,
      createdAtIso: toIso(s.createdAt),
    })),
  };
}

async function syncEmergencyContact(
  tx: Prisma.TransactionClient,
  employeeId: string,
  input: Pick<EmployeeUpsertInput, "emergencyContactName" | "emergencyContactPhone" | "emergencyContactRelationship">,
): Promise<void> {
  await tx.employeeEmergencyContact.deleteMany({ where: { employeeId } });
  const fullName = input.emergencyContactName?.trim() ?? "";
  const phone = input.emergencyContactPhone?.trim() ?? "";
  const relationship = input.emergencyContactRelationship?.trim() ?? "";
  if (!fullName && !phone && !relationship) return;

  await tx.employeeEmergencyContact.create({
    data: {
      employeeId,
      fullName,
      phone,
      relationship,
      isPrimary: true,
    },
  });
}

async function syncPrimaryBankAccount(
  tx: Prisma.TransactionClient,
  employeeId: string,
  iban: string | null | undefined,
  bankName: string | null | undefined,
): Promise<void> {
  await tx.employeeBankAccount.deleteMany({ where: { employeeId } });
  const trimmed = iban?.replace(/\s+/g, "").trim();
  if (!trimmed) return;
  await tx.employeeBankAccount.create({
    data: {
      employeeId,
      iban: trimmed,
      bankName: bankName ?? undefined,
      isPrimary: true,
    },
  });
}

async function logEmployeeCreated(
  companyId: string,
  employeeId: string,
  actorUserId: string | null,
  snapshot: Record<string, unknown>,
): Promise<void> {
  try {
    await appendEmployeeEmploymentHistory({
      companyId,
      employeeId,
      kind: EmployeeHistoryEventKind.CREATED,
      title: "Punonjësi u regjistrua",
      description: "Hyrje e re në sistem.",
      metadata: asJson(snapshot),
    });
    await appendEmployeeTimeline({
      companyId,
      employeeId,
      eventType: TIMELINE_TYPES.CREATED,
      title: "Punonjësi u krijua",
      body: "Regjistrim i plotë në modulin e punonjësve.",
      actorUserId,
    });
    await appendDomainEmployeeActivity({
      companyId,
      employeeId,
      verb: DomainActivityVerb.CREATED,
      summary: "Punonjësi u krijua",
      actorUserId,
      payload: asJson(snapshot),
    });
    await appendEmployeeAuditLog({
      companyId,
      employeeId,
      action: "EMPLOYEE_CREATE",
      actorUserId,
      diff: asJson(snapshot),
    });
  } catch (err) {
    console.error("[employees] audit trail (created) failed — employee may still be saved:", err);
  }
}

async function logEmployeeUpdated(
  companyId: string,
  employeeId: string,
  actorUserId: string | null,
  diff: Record<string, unknown>,
): Promise<void> {
  try {
    const j = asJson(diff);
    await appendEmployeeEmploymentHistory({
      companyId,
      employeeId,
      kind: EmployeeHistoryEventKind.UPDATED,
      title: "Të dhënat u përditësuan",
      metadata: j,
    });
    await appendEmployeeTimeline({
      companyId,
      employeeId,
      eventType: TIMELINE_TYPES.UPDATED,
      title: "Të dhënat u përditësuan",
      actorUserId,
      metadata: j,
    });
    await appendDomainEmployeeActivity({
      companyId,
      employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Profili i punonjësit u përditësua",
      actorUserId,
      payload: j,
    });
    await appendEmployeeAuditLog({
      companyId,
      employeeId,
      action: "EMPLOYEE_UPDATE",
      actorUserId,
      diff: j,
    });
  } catch (err) {
    console.error("[employees] audit trail (updated) failed:", err);
  }
}

export async function createEmployee(
  companyId: string,
  input: EmployeeUpsertInput,
  actorUserId: string | null,
): Promise<
  | { ok: true; id: string }
  | { ok: false; code: "DUPLICATE_PERSONAL_ID" | "INVALID_DEPARTMENT" | "INVALID_JOB_TITLE" | "DB_ERROR"; message?: string }
> {
  try {
    const selectedJobTitle = await prisma.jobTitle.findFirst({
      where: { id: input.jobTitleId, companyId, status: "ACTIVE" },
      select: { id: true, title: true },
    });
    if (!selectedJobTitle) return { ok: false, code: "INVALID_JOB_TITLE" };

    if (input.departmentId) {
      const d = await prisma.department.findFirst({
        where: { id: input.departmentId, companyId },
        select: { id: true },
      });
      if (!d) return { ok: false, code: "INVALID_DEPARTMENT" };
    }

    const employee = await prisma.$transaction(async (tx) => {
      const row = await tx.employee.create({
        data: {
          companyId,
          departmentId: input.departmentId ?? undefined,
          jobTitleId: selectedJobTitle.id,
          employmentType: input.employmentType,
          status: input.status,
          workArrangement: input.workArrangement,
          firstName: input.firstName,
          lastName: input.lastName,
          personalId: input.personalId.trim(),
          dateOfBirth: input.dateOfBirth ?? undefined,
          gender: input.gender ?? undefined,
          phone: input.phone ?? undefined,
          email: input.email ?? undefined,
          hireDate: input.hireDate,
          jobTitle: selectedJobTitle.title,
          probationMonths: input.probationMonths ?? undefined,
          weeklyHours: new Prisma.Decimal(String(input.weeklyHours)),
          baseSalaryMonthly: new Prisma.Decimal(String(input.baseSalaryMonthly)),
          exemptFromMinimumSalary: input.exemptFromMinimumSalary,
          applyTrust: input.applyTrust,
          applyTax: input.applyTax,
          bankName: input.bankName ?? undefined,
          bankAccountIban: input.bankAccountIban?.replace(/\s+/g, "").trim() || undefined,
          addressLine: input.addressLine ?? undefined,
          addressCity: input.addressCity ?? undefined,
          addressCountry: input.addressCountry ?? undefined,
          internalNotes: input.internalNotes ?? undefined,
          documentsMissing: input.documentsMissing,
        },
      });

      await tx.employmentPeriod.create({
        data: {
          companyId,
          employeeId: row.id,
          startedAt: input.hireDate,
          reason: "HIRE",
        },
      });

      await tx.employeeSalaryChange.create({
        data: {
          companyId,
          employeeId: row.id,
          effectiveFrom: input.hireDate,
          previousBaseSalary: null,
          newBaseSalary: row.baseSalaryMonthly,
          compensationBasis: row.compensationBasis,
          targetNetMonthly: row.targetNetMonthly,
          reason: "Rekord fillestar (punësim)",
          changedById: actorUserId ?? undefined,
        },
      });

      await syncEmergencyContact(tx, row.id, input);
      await syncPrimaryBankAccount(tx, row.id, input.bankAccountIban, input.bankName);

      return row;
    });

    await logEmployeeCreated(companyId, employee.id, actorUserId, {
      firstName: employee.firstName,
      lastName: employee.lastName,
      personalId: employee.personalId,
      employmentType: employee.employmentType,
    });

    return { ok: true, id: employee.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, code: "DUPLICATE_PERSONAL_ID" };
    }
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "DB_ERROR", message };
  }
}

export async function updateEmployee(
  companyId: string,
  employeeId: string,
  input: EmployeeUpsertInput,
  actorUserId: string | null,
): Promise<
  | { ok: true }
  | {
      ok: false;
      code: "NOT_FOUND" | "DUPLICATE_PERSONAL_ID" | "INVALID_DEPARTMENT" | "INVALID_JOB_TITLE" | "TERMINATED_LOCKED" | "DB_ERROR";
      message?: string;
    }
> {
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: {
      id: true,
      status: true,
      jobTitleId: true,
      baseSalaryMonthly: true,
      compensationBasis: true,
      targetNetMonthly: true,
    },
  });
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  if (existing.status === "TERMINATED") return { ok: false, code: "TERMINATED_LOCKED" };

  if (input.departmentId) {
    const d = await prisma.department.findFirst({
      where: { id: input.departmentId, companyId },
      select: { id: true },
    });
    if (!d) return { ok: false, code: "INVALID_DEPARTMENT" };
  }

  const selectedJobTitle = await prisma.jobTitle.findFirst({
    where: { id: input.jobTitleId, companyId },
    select: { id: true, title: true, status: true },
  });
  if (
    !selectedJobTitle ||
    (selectedJobTitle.status !== "ACTIVE" && existing.jobTitleId !== selectedJobTitle.id)
  ) {
    return { ok: false, code: "INVALID_JOB_TITLE" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          departmentId: input.departmentId ?? null,
          jobTitleId: selectedJobTitle.id,
          employmentType: input.employmentType,
          status: input.status,
          workArrangement: input.workArrangement,
          firstName: input.firstName,
          lastName: input.lastName,
          personalId: input.personalId.trim(),
          dateOfBirth: input.dateOfBirth ?? null,
          gender: input.gender ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          hireDate: input.hireDate,
          jobTitle: selectedJobTitle.title,
          probationMonths: input.probationMonths ?? null,
          weeklyHours: new Prisma.Decimal(String(input.weeklyHours)),
          baseSalaryMonthly: new Prisma.Decimal(String(input.baseSalaryMonthly)),
          exemptFromMinimumSalary: input.exemptFromMinimumSalary,
          applyTrust: input.applyTrust,
          applyTax: input.applyTax,
          bankName: input.bankName ?? null,
          bankAccountIban: input.bankAccountIban?.replace(/\s+/g, "").trim() || null,
          addressLine: input.addressLine ?? null,
          addressCity: input.addressCity ?? null,
          addressCountry: input.addressCountry ?? null,
          internalNotes: input.internalNotes ?? null,
          documentsMissing: input.documentsMissing,
        },
      });

      const newBase = new Prisma.Decimal(String(input.baseSalaryMonthly));
      if (!existing.baseSalaryMonthly.equals(newBase)) {
        await tx.employeeSalaryChange.create({
          data: {
            companyId,
            employeeId,
            effectiveFrom: new Date(),
            previousBaseSalary: existing.baseSalaryMonthly,
            newBaseSalary: newBase,
            compensationBasis: existing.compensationBasis,
            targetNetMonthly: existing.targetNetMonthly,
            changedById: actorUserId ?? undefined,
          },
        });
      }

      await syncEmergencyContact(tx, employeeId, input);
      await syncPrimaryBankAccount(tx, employeeId, input.bankAccountIban, input.bankName);
    });

    await logEmployeeUpdated(companyId, employeeId, actorUserId, {
      updatedAt: new Date().toISOString(),
      fields: Object.keys(input),
    });

    if (existing.status !== input.status) {
      try {
        await appendEmployeeEmploymentHistory({
          companyId,
          employeeId,
          kind: EmployeeHistoryEventKind.STATUS_CHANGED,
          title: "Statusi u ndryshua",
          description: `Nga ${existing.status} në ${input.status}.`,
          status: input.status,
          metadata: asJson({ from: existing.status, to: input.status }),
        });
        await appendEmployeeTimeline({
          companyId,
          employeeId,
          eventType: TIMELINE_TYPES.STATUS_CHANGED,
          title: "Statusi u ndryshua",
          body: `${existing.status} → ${input.status}`,
          actorUserId,
        });
      } catch (err) {
        console.error("[employees] status-change audit failed:", err);
      }
    }

    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, code: "DUPLICATE_PERSONAL_ID" };
    }
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "DB_ERROR", message };
  }
}

export async function archiveEmployee(
  companyId: string,
  employeeId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "TERMINATED" | "DB_ERROR"; message?: string }> {
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  if (existing.status === "TERMINATED") return { ok: false, code: "TERMINATED" };

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { status: "INACTIVE" },
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "DB_ERROR", message };
  }

  try {
    await appendEmployeeEmploymentHistory({
      companyId,
      employeeId,
      kind: EmployeeHistoryEventKind.ARCHIVED,
      title: "Statusi: jo aktiv",
      description: "Punonjësi u shënua si jo aktiv.",
      status: "INACTIVE",
    });
    await appendEmployeeTimeline({
      companyId,
      employeeId,
      eventType: TIMELINE_TYPES.ARCHIVED,
      title: "Statusi u ndryshua në jo aktiv",
      actorUserId,
    });
    await appendDomainEmployeeActivity({
      companyId,
      employeeId,
      verb: DomainActivityVerb.ARCHIVED,
      summary: "Punonjësi u shënua si jo aktiv",
      actorUserId,
    });
    await appendEmployeeAuditLog({
      companyId,
      employeeId,
      action: "EMPLOYEE_ARCHIVE",
      actorUserId,
      diff: asJson({ status: "INACTIVE" }),
    });
  } catch (err) {
    console.error("[employees] archive audit failed:", err);
  }

  return { ok: true };
}

export async function applyEmployeeTerminationOutcome(params: {
  tx: Prisma.TransactionClient;
  employeeId: string;
  terminationDate: Date;
  terminationReason: string;
  /** When set, links open employment segments to this termination row */
  employmentTerminationRecordId?: string | null;
}): Promise<void> {
  await params.tx.employee.update({
    where: { id: params.employeeId },
    data: {
      status: "TERMINATED",
      terminationDate: params.terminationDate,
      terminationReason: params.terminationReason,
    },
  });

  await params.tx.employmentPeriod.updateMany({
    where: { employeeId: params.employeeId, endedAt: null },
    data: {
      endedAt: params.terminationDate,
      reason: "TERMINATION",
      ...(params.employmentTerminationRecordId
        ? { terminationId: params.employmentTerminationRecordId }
        : {}),
    },
  });
}

export async function terminateEmployee(
  companyId: string,
  employeeId: string,
  terminationDate: Date,
  terminationReason: string,
  actorUserId: string | null,
): Promise<
  { ok: true } | { ok: false; code: "NOT_FOUND" | "ALREADY_TERMINATED" | "DB_ERROR"; message?: string }
> {
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  // Guard against double-termination (the full Largimet workflow guards similarly) —
  // avoids a duplicate COMPLETED Termination row + a spurious period close.
  if (existing.status === "TERMINATED") return { ok: false, code: "ALREADY_TERMINATED" };

  try {
    await prisma.$transaction(async (tx) => {
      // Quick termination still creates a COMPLETED Termination record so every
      // TERMINATED employee has a matching record + closed employment period,
      // identical in shape to the full Largimet workflow's end state.
      const termination = await tx.termination.create({
        data: {
          companyId,
          employeeId,
          type: "MANUAL",
          status: "COMPLETED",
          terminationDate,
          lastWorkingDay: terminationDate,
          finalPayrollRequired: false,
          reason: terminationReason,
          createdById: actorUserId ?? undefined,
          completedAt: new Date(),
        },
      });
      await applyEmployeeTerminationOutcome({
        tx,
        employeeId,
        terminationDate,
        terminationReason,
        employmentTerminationRecordId: termination.id,
      });
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "DB_ERROR", message };
  }

  try {
    await appendEmployeeEmploymentHistory({
      companyId,
      employeeId,
      kind: EmployeeHistoryEventKind.TERMINATED,
      title: "Punonjësi u largua",
      description: terminationReason,
      status: "TERMINATED",
      metadata: asJson({ terminationDate: terminationDate.toISOString() }),
    });
    await appendEmployeeTimeline({
      companyId,
      employeeId,
      eventType: TIMELINE_TYPES.TERMINATED,
      title: "Punonjësi u largua",
      body: terminationReason,
      actorUserId,
    });
    await appendDomainEmployeeActivity({
      companyId,
      employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Punonjësi u largua",
      actorUserId,
      payload: asJson({ terminationDate: terminationDate.toISOString(), terminationReason }),
    });
    await appendEmployeeAuditLog({
      companyId,
      employeeId,
      action: "EMPLOYEE_TERMINATE",
      actorUserId,
      diff: asJson({ terminationDate: terminationDate.toISOString(), terminationReason }),
    });
  } catch (err) {
    console.error("[employees] terminate audit failed:", err);
  }

  return { ok: true };
}

export async function rehireEmployee(
  companyId: string,
  employeeId: string,
  rehireDate: Date,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "NOT_TERMINATED" | "DB_ERROR"; message?: string }> {
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  if (existing.status !== "TERMINATED") return { ok: false, code: "NOT_TERMINATED" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: { status: "ACTIVE", terminationDate: null, terminationReason: null },
      });
      await tx.employmentPeriod.create({
        data: { companyId, employeeId, startedAt: rehireDate, reason: "REHIRE" },
      });
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "DB_ERROR", message };
  }

  const isoDay = rehireDate.toISOString().slice(0, 10);
  try {
    await appendEmployeeEmploymentHistory({
      companyId,
      employeeId,
      kind: EmployeeHistoryEventKind.STATUS_CHANGED,
      title: "Punonjësi u rikthye në punë",
      description: `Rikthim në punë (${isoDay}).`,
      status: "ACTIVE",
      metadata: asJson({ rehireDate: rehireDate.toISOString(), reason: "REHIRE" }),
    });
    await appendEmployeeTimeline({
      companyId,
      employeeId,
      eventType: TIMELINE_TYPES.STATUS_CHANGED,
      title: "Punonjësi u rikthye në punë",
      body: `Rikthim në punë (${isoDay})`,
      actorUserId,
    });
    await appendDomainEmployeeActivity({
      companyId,
      employeeId,
      verb: DomainActivityVerb.UPDATED,
      summary: "Punonjësi u rikthye në punë",
      actorUserId,
      payload: asJson({ rehireDate: rehireDate.toISOString() }),
    });
    await appendEmployeeAuditLog({
      companyId,
      employeeId,
      action: "EMPLOYEE_REHIRE",
      actorUserId,
      diff: asJson({ status: "ACTIVE", rehireDate: rehireDate.toISOString() }),
    });
  } catch (err) {
    console.error("[employees] rehire audit failed:", err);
  }

  return { ok: true };
}

export async function getEmployeeDeletionEligibility(
  companyId: string,
  employeeId: string,
): Promise<{ eligible: true } | { eligible: false; reason: "NOT_FOUND" | "HAS_PAYROLL" | "HAS_CONTRACTS" }> {
  const row = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });
  if (!row) return { eligible: false, reason: "NOT_FOUND" };

  const [payCount, contractCount] = await Promise.all([
    prisma.payrollEntry.count({ where: { employeeId } }),
    prisma.contract.count({ where: { employeeId } }),
  ]);

  if (payCount > 0) return { eligible: false, reason: "HAS_PAYROLL" };
  if (contractCount > 0) return { eligible: false, reason: "HAS_CONTRACTS" };

  return { eligible: true };
}

export async function deleteEmployeeHard(
  companyId: string,
  employeeId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "NOT_ELIGIBLE" | "DB_ERROR"; message?: string }> {
  const eligibility = await getEmployeeDeletionEligibility(companyId, employeeId);
  if (!eligibility.eligible) {
    const reason = eligibility.reason;
    if (reason === "NOT_FOUND") return { ok: false, code: "NOT_FOUND" };
    return { ok: false, code: "NOT_ELIGIBLE" };
  }

  try {
    await prisma.employee.deleteMany({ where: { id: employeeId, companyId } });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "DB_ERROR", message };
  }

  try {
    await prisma.auditLog.create({
      data: {
        companyId,
        entityType: EMPLOYEE_ENTITY,
        entityId: employeeId,
        action: "EMPLOYEE_DELETE",
        actorUserId: actorUserId ?? undefined,
        diff: asJson({ deleted: true }),
      },
    });
  } catch (err) {
    console.error("[employees] delete audit failed:", err);
  }

  return { ok: true };
}
