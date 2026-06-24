import { Prisma } from "@prisma/client";
import type { Employee, PayrollEntryStatus, PayrollPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calendarDaysInMonth } from "@/modules/payroll/helpers/payroll-anchor";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import { decimalToPlain } from "@/modules/payroll/helpers/money-format";
import { loadPayrollLegislationContext, resolvePayrollParameterSetIdForMonth } from "@/modules/payroll/services/payroll-settings-service";
import { appendPayrollAuditLog, appendPayrollDomainActivity } from "@/modules/payroll/services/payroll-audit-service";
import { PAYROLL_TIMELINE } from "@/modules/payroll/constants/timeline";
import {
  periodBoundsUtc,
} from "@/modules/payroll/services/payroll-calendar-service";
import { approximateLeaveHoursForPayrollMonth } from "@/modules/payroll/services/payroll-leave-integration-service";
import { recordLeavePayrollRegenerationLeaveAudit } from "@/modules/leaves/payroll/payroll-sync-audit";
import { resolvePayrollMonthWorkingTime, parseIsoDateJsonList } from "@/modules/payroll/services/payroll-working-time-service";
import {
  computePayrollSpreadsheetLine,
  type PayrollMonthCalendarSnapshot,
  type SpreadsheetLineComputationInput,
} from "@/modules/payroll/calculation/payroll-spreadsheet-line";
import { generatePayrollPdfArtifacts } from "@/modules/payroll/services/payroll-pdf-service";
import { countWeekdaysInclusiveUtc } from "@/modules/payroll/helpers/weekday-count";

const EDITABLE: PayrollPeriodStatus[] = ["DRAFT"];

function payrollNotEditableMessage(status: PayrollPeriodStatus): string | null {
  if (!EDITABLE.includes(status)) {
    return "Ky payroll nuk mund të modifikohet në këtë status (vetëm DRAFT).";
  }
  return null;
}

/** Statuset që përfshihen në payroll mujor (pagë aktive / pushim të paguar). */
const PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE"] as const;

/** Plain JSON for data passed across RSC → client boundaries (avoids prototype/BigInt/Decimal surprises). */
function jsonSerializableClone(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

/** Plain JSON for Prisma `Json` columns (`calculationBreakdown`). */
function payrollCalculationBreakdownAsJson(breakdown: Record<string, unknown>): object {
  return JSON.parse(JSON.stringify(breakdown)) as object;
}

async function findEmployeesEligibleForPayrollMonth(
  companyId: string,
  year: number,
  month: number,
  start: Date,
  end: Date,
): Promise<{ ok: true; employees: Employee[] } | { ok: false; error: string }> {
  const eligibleWhere = {
    companyId,
    employmentType: "EMPLOYEE" as const,
    status: { in: [...PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES] },
    hireDate: { lte: end },
    OR: [{ terminationDate: null }, { terminationDate: { gte: start } }],
  };

  const employees = await prisma.employee.findMany({
    where: eligibleWhere,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  if (employees.length > 0) {
    return { ok: true, employees };
  }

  const totalInCompany = await prisma.employee.count({ where: { companyId } });
  if (totalInCompany === 0) {
    return {
      ok: false,
      error:
        "Nuk ka punonjës të regjistruar për këtë kompani. Shtoni punonjës te moduli Punonjësit, pastaj ripëllogaritni payroll-in.",
    };
  }

  const activeLike = await prisma.employee.count({
    where: {
      companyId,
      status: { in: [...PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES] },
    },
  });

  if (activeLike === 0) {
    return {
      ok: false,
      error:
        "Nuk ka punonjës me status ACTIVE ose ON_LEAVE për këtë kompani. Payroll përfshin vetëm këta statusa (jo INACTIVE / SUSPENDED / TERMINATED).",
    };
  }

  const hiredAfterPeriod = await prisma.employee.count({
    where: {
      companyId,
      status: { in: [...PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES] },
      hireDate: { gt: end },
    },
  });

  if (hiredAfterPeriod > 0) {
    return {
      ok: false,
      error: `Ka punonjës aktivë, por data e punësimit është pas fundit të muajit të pagës (${payrollMonthLabel(year, month)}). Zgjidhni një muaj më të vonë ose korrigjoni datën e punësimit te punonjësi.`,
    };
  }

  const terminatedBefore = await prisma.employee.count({
    where: {
      companyId,
      status: { in: [...PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES] },
      terminationDate: { lt: start },
    },
  });

  if (terminatedBefore > 0) {
    return {
      ok: false,
      error:
        "Punonjësit me të cilët përpoqeni të përdorni payroll-in janë shënuar si të larguar para fillimit të këtij muaji; nuk përfshihen në këtë periudhë.",
    };
  }

  return {
    ok: false,
    error:
      "Nuk u gjet asnjë punonjës për këtë muaj pagë. Verifikoni që kompania aktive (cookie pp_active_company_id) përputhet me kompaninë ku është regjistruar punonjësi.",
  };
}

export async function listPayrollsForCompany(companyId: string, year?: number) {
  const rows = await prisma.payroll.findMany({
    where: {
      companyId,
      ...(year != null ? { year } : {}),
    },
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const totals = await prisma.payrollEntry.groupBy({
    by: ["payrollId"],
    where: { payroll: { companyId } },
    _sum: {
      grossSalary: true,
      netPay: true,
    },
  });
  const grossMap = new Map(totals.map((t) => [t.payrollId, t._sum.grossSalary]));
  const netMap = new Map(totals.map((t) => [t.payrollId, t._sum.netPay]));

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { legalName: true, tradeName: true },
  });
  const companyLabel = company?.tradeName?.trim() || company?.legalName || "";

  return rows.map((p) => ({
    id: p.id,
    year: p.year,
    month: p.month,
    monthLabel: payrollMonthLabel(p.year, p.month),
    companyLabel,
    employeeCount: p._count.entries,
    totalGross: decimalToPlain(grossMap.get(p.id)),
    totalNet: decimalToPlain(netMap.get(p.id)),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function getPayrollDetailDto(companyId: string, payrollId: string) {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId },
    include: {
      parameterSet: true,
      snapshot: true,
      generatedDocuments: { orderBy: { generatedAt: "desc" } },
      atkExports: {
        orderBy: { generatedAt: "desc" },
        include: {
          generatedBy: { select: { email: true, displayName: true } },
        },
      },
      entries: {
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              personalId: true,
              employmentType: true,
              jobTitle: true,
            },
          },
          adjustments: true,
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  });

  if (!payroll) return null;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { legalName: true, tradeName: true },
  });

  const activities = await prisma.domainActivity.findMany({
    where: { companyId, entityType: "Payroll", entityId: payrollId },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });

  const audits = await prisma.auditLog.findMany({
    where: { companyId, entityType: "Payroll", entityId: payrollId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const corrections = await prisma.payrollCorrection.findMany({
    where: { companyId, payrollId },
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { firstName: true, lastName: true, personalId: true } },
    },
  });

  const sumGross = payroll.entries.reduce((a, e) => a.plus(e.grossSalary), new Prisma.Decimal(0));
  const sumNet = payroll.entries.reduce((a, e) => a.plus(e.netPay), new Prisma.Decimal(0));
  const sumEmployerCost = payroll.entries.reduce((a, e) => a.plus(e.employerTotalCost), new Prisma.Decimal(0));
  const sumTaxable = payroll.entries.reduce((a, e) => a.plus(e.taxableIncome), new Prisma.Decimal(0));
  const sumPit = payroll.entries.reduce((a, e) => a.plus(e.pitWithheld), new Prisma.Decimal(0));
  const sumPensionEmployee = payroll.entries.reduce((a, e) => a.plus(e.pensionEmployee), new Prisma.Decimal(0));
  const sumPensionEmployer = payroll.entries.reduce((a, e) => a.plus(e.pensionEmployer), new Prisma.Decimal(0));

  const settings = await prisma.payrollSettings.findUnique({ where: { companyId } });
  const wt = await resolvePayrollMonthWorkingTime(companyId, payroll.year, payroll.month);

  return {
    payroll: {
      id: payroll.id,
      year: payroll.year,
      month: payroll.month,
      monthLabel: payrollMonthLabel(payroll.year, payroll.month),
      currency: payroll.currency,
      status: payroll.status,
      notes: payroll.notes,
      parameterSetId: payroll.parameterSetId,
      lockedAt: payroll.lockedAt?.toISOString() ?? null,
      reviewedAt: payroll.reviewedAt?.toISOString() ?? null,
      approvedAt: payroll.approvedAt?.toISOString() ?? null,
      archivedAt: payroll.archivedAt?.toISOString() ?? null,
      expectedWorkingDays: payroll.expectedWorkingDays,
      expectedRegularHours: payroll.expectedRegularHours?.toString() ?? null,
      validatedAt: payroll.validatedAt?.toISOString() ?? null,
      validationWarnings: Array.isArray(payroll.validationWarnings)
        ? payroll.validationWarnings.filter((x): x is string => typeof x === "string")
        : [],
      createdAt: payroll.createdAt.toISOString(),
      updatedAt: payroll.updatedAt.toISOString(),
    },
    companyLabel: company?.tradeName?.trim() || company?.legalName || "",
    totals: {
      gross: decimalToPlain(sumGross),
      net: decimalToPlain(sumNet),
      employerTotalCost: decimalToPlain(sumEmployerCost),
      taxableIncome: decimalToPlain(sumTaxable),
      pitWithheld: decimalToPlain(sumPit),
      pensionEmployee: decimalToPlain(sumPensionEmployee),
      pensionEmployer: decimalToPlain(sumPensionEmployer),
      headcount: payroll.entries.length,
    },
    operationalSettings: settings
      ? {
          minimumSalaryMonthly: settings.minimumSalaryMonthly.toString(),
          minimumSalaryScheduledAmount: settings.minimumSalaryScheduledAmount?.toString() ?? null,
          minimumSalaryScheduledEffectiveFrom:
            settings.minimumSalaryScheduledEffectiveFrom?.toISOString() ?? null,
          pensionEmployeePercent: settings.pensionEmployeePercent.toString(),
          pensionEmployerPercent: settings.pensionEmployerPercent.toString(),
          overtimeMultiplier: settings.overtimeMultiplier.toString(),
          weekendMultiplier: settings.weekendMultiplier.toString(),
          holidayMultiplier: settings.holidayMultiplier.toString(),
          nightWorkMultiplier: settings.nightWorkMultiplier.toString(),
          sickLeavePayPercent: settings.sickLeavePayPercent.toString(),
          overtimeWeeklyCapHours: settings.overtimeWeeklyCapHours.toString(),
          standardWeeklyHours: settings.standardWeeklyHours.toString(),
          hoursPerWorkingDay: settings.hoursPerWorkingDay.toString(),
          overtimeWeeklyThresholdHours: settings.overtimeWeeklyThresholdHours.toString(),
          nightWorkPeriodDescription: settings.nightWorkPeriodDescription,
          payrollExtraHolidayDates: parseIsoDateJsonList(settings.payrollExtraHolidayDates),
          payrollExcludedHolidayDates: parseIsoDateJsonList(settings.payrollExcludedHolidayDates),
        }
      : null,
    workingCalendar: wt
      ? {
          expectedWorkingDays: wt.expectedWorkingDays,
          expectedRegularHours: wt.expectedRegularHours,
          hoursPerWorkingDay: wt.hoursPerWorkingDay,
          weekdayPublicHolidayDates: wt.weekdayPublicHolidayDates,
        }
      : null,
    entries: payroll.entries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
      jobTitle: e.jobTitleSnapshot ?? e.employee.jobTitle ?? "",
      personalId: e.employee.personalId,
      employmentType: e.employmentTypeSnapshot,
      isLocked: e.isLocked,
      expectedWorkingDays: e.expectedWorkingDays,
      expectedRegularHours: e.expectedRegularHours != null ? decimalToPlain(e.expectedRegularHours) : null,
      actualRegularHours: decimalToPlain(e.actualRegularHours),
      paidLeaveHours: decimalToPlain(e.paidLeaveHours),
      sickLeaveHours: decimalToPlain(e.sickLeaveHours),
      unpaidLeaveHours: decimalToPlain(e.unpaidLeaveHours),
      overtimeHours: decimalToPlain(e.overtimeHours),
      weekendHours: decimalToPlain(e.weekendHours),
      holidayHours: decimalToPlain(e.holidayHours),
      nightHours: decimalToPlain(e.nightHours),
      hourlyRate: decimalToPlain(e.hourlyRate),
      regularPay: decimalToPlain(e.regularPay),
      paidLeavePay: decimalToPlain(e.paidLeavePay),
      sickLeavePay: decimalToPlain(e.sickLeavePay),
      unpaidLeaveDeduction: decimalToPlain(e.unpaidLeaveDeduction),
      overtimeAmount: decimalToPlain(e.overtimeAmount),
      holidayAmount: decimalToPlain(e.holidayAmount),
      weekendAmount: decimalToPlain(e.weekendAmount),
      nightAmount: decimalToPlain(e.nightAmount),
      bonuses: decimalToPlain(e.bonuses),
      salaryAdvanceDeduction: decimalToPlain(e.salaryAdvanceDeduction),
      grossSalary: decimalToPlain(e.grossSalary),
      taxableIncome: decimalToPlain(e.taxableIncome),
      pitWithheld: decimalToPlain(e.pitWithheld),
      pensionEmployee: decimalToPlain(e.pensionEmployee),
      pensionEmployer: decimalToPlain(e.pensionEmployer),
      otherDeductions: decimalToPlain(e.otherDeductions),
      employerTotalCost: decimalToPlain(e.employerTotalCost),
      netPay: decimalToPlain(e.netPay),
      manualGrossOverride: e.manualGrossOverride?.toString() ?? null,
      manualNetOverride: e.manualNetOverride?.toString() ?? null,
      manualGrossReason: e.manualGrossReason,
      manualNetReason: e.manualNetReason,
      notes: e.notes,
      paidDays: decimalToPlain(e.paidDays),
      breakdown: jsonSerializableClone(e.calculationBreakdown),
      adjustments: e.adjustments.map((a) => ({
        id: a.id,
        kind: a.kind,
        label: a.label,
        amount: decimalToPlain(a.amount),
      })),
    })),
    snapshot: payroll.snapshot
      ? {
          id: payroll.snapshot.id,
          capturedAt: payroll.snapshot.capturedAt.toISOString(),
          checksum: payroll.snapshot.checksum,
        }
      : null,
    documents: payroll.generatedDocuments.map((d) => ({
      id: d.id,
      kind: d.kind,
      filename: d.filename,
      generatedAt: d.generatedAt.toISOString(),
      employeeId: d.employeeId,
    })),
    atkExports: payroll.atkExports.map((x) => ({
      id: x.id,
      filename: x.filename,
      downloadUrl: x.generatedFileUrl,
      snapshotHashPrefix: x.snapshotHash.slice(0, 12),
      snapshotHash: x.snapshotHash,
      isArchived: x.isArchived,
      generatedAt: x.generatedAt.toISOString(),
      generatedByLabel: x.generatedBy?.displayName?.trim() || x.generatedBy?.email || null,
    })),
    timeline: activities.map((a) => ({
      id: a.id,
      verb: a.verb,
      summary: a.summary,
      occurredAt: a.occurredAt.toISOString(),
      payload: jsonSerializableClone(a.payload),
    })),
    auditTrail: audits.map((a) => ({
      id: a.id,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      diff: jsonSerializableClone(a.diff),
    })),
    corrections: corrections.map((c) => ({
      id: c.id,
      employeeId: c.employeeId,
      employeeName: `${c.employee.firstName} ${c.employee.lastName}`,
      personalId: c.employee.personalId,
      kind: c.kind,
      amount: decimalToPlain(c.amount),
      reason: c.reason,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function createPayrollDraft(
  companyId: string,
  year: number,
  month: number,
  actorUserId?: string | null,
  employeeIds?: string[],
): Promise<
  | { ok: true; id: string }
  | { ok: false; code: "DUPLICATE" | "NO_PARAMS" | "INVALID_SELECTION" | "ERROR"; message?: string }
> {
  try {
    const existing = await prisma.payroll.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });
    if (existing) return { ok: false, code: "DUPLICATE", message: "Ekziston tashmë një payroll për këtë muaj." };

    const parameterSetId = await resolvePayrollParameterSetIdForMonth(companyId, year, month);
    if (!parameterSetId) return { ok: false, code: "NO_PARAMS", message: "Mungon një set parametrash për këtë periudhë." };

    let validatedIds: string[] = [];
    if (employeeIds && employeeIds.length > 0) {
      const valid = await prisma.employee.findMany({
        where: { companyId, id: { in: employeeIds }, employmentType: "EMPLOYEE" },
        select: { id: true },
      });
      validatedIds = valid.map((v) => v.id);
      if (validatedIds.length !== employeeIds.length) {
        return {
          ok: false,
          code: "INVALID_SELECTION",
          message: "Disa ID nuk janë punonjës të vlefshëm të kësaj kompanie.",
        };
      }
    }

    const payroll = await prisma.payroll.create({
      data: {
        companyId,
        year,
        month,
        status: "DRAFT",
        parameterSetId,
      },
    });

    if (validatedIds.length > 0) {
      await prisma.payrollIncludedEmployee.createMany({
        data: validatedIds.map((employeeId) => ({ payrollId: payroll.id, employeeId })),
      });
    }

    await appendPayrollDomainActivity({
      companyId,
      payrollId: payroll.id,
      verb: "CREATED",
      summary: `Payroll u krijua për ${payrollMonthLabel(year, month)}.`,
      actorUserId,
      payload: { event: PAYROLL_TIMELINE.CREATED },
    });
    await appendPayrollAuditLog({
      companyId,
      payrollId: payroll.id,
      action: "CREATE",
      actorUserId,
      diff: { year, month, employeeIds: validatedIds },
    });

    return { ok: true, id: payroll.id };
  } catch (e) {
    return { ok: false, code: "ERROR", message: e instanceof Error ? e.message : String(e) };
  }
}

async function createPayrollEntriesForEmployeesTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    payrollId: string;
    payrollYear: number;
    payrollMonth: number;
    employees: Employee[];
    ctx: NonNullable<Awaited<ReturnType<typeof loadPayrollLegislationContext>>>;
    wt: NonNullable<Awaited<ReturnType<typeof resolvePayrollMonthWorkingTime>>>;
    sickPct: string;
    lastWorkingDayByEmployeeId?: Record<string, Date>;
    entryStatus: PayrollEntryStatus;
    lineOverridesByEmployeeId?: Record<string, Partial<SpreadsheetLineComputationInput>>;
  },
): Promise<{ aggPaidLeaveHrs: number; aggSickLeaveHrs: number; aggUnpaidLeaveHrs: number }> {
  const wd = params.wt.expectedWorkingDays;
  const expHoursStr = params.wt.expectedRegularHours;
  const { start, end } = periodBoundsUtc(params.payrollYear, params.payrollMonth);
  const days = calendarDaysInMonth(params.payrollYear, params.payrollMonth);

  const calendarSnapshot: PayrollMonthCalendarSnapshot = {
    expectedWorkingDays: params.wt.expectedWorkingDays,
    expectedRegularHours: params.wt.expectedRegularHours,
    hoursPerWorkingDay: params.wt.hoursPerWorkingDay,
    weekdayPublicHolidayDates: params.wt.weekdayPublicHolidayDates,
    overtimeWeeklyThresholdHours: params.wt.overtimeWeeklyThresholdHours,
    overtimeWarningWeeklyHours: params.wt.overtimeWarningWeeklyHours,
    standardWeeklyHours: params.wt.standardWeeklyHours,
    nightWorkPeriodDescription: params.wt.nightWorkPeriodDescription,
  };

  let aggPaidLeaveHrs = 0;
  let aggSickLeaveHrs = 0;
  let aggUnpaidLeaveHrs = 0;

  for (const emp of params.employees) {
    const leaveReqs = await tx.leaveRequest.findMany({
      where: {
        companyId: params.companyId,
        employeeId: emp.id,
        status: "APPROVED",
        affectsPayroll: true,
        AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
      },
      select: {
        id: true,
        type: true,
        startDate: true,
        endDate: true,
        isPaid: true,
        affectsPayroll: true,
        subtype: true,
        interruptedByLeaveRequestId: true,
      },
    });

    const dailyH = Math.min(
      new Prisma.Decimal(emp.weeklyHours).div(new Prisma.Decimal(5)).toNumber(),
      Number(params.wt.hoursPerWorkingDay),
    );
    const leaveHrs = await approximateLeaveHoursForPayrollMonth({
      companyId: params.companyId,
      requests: leaveReqs,
      monthStart: start,
      monthEnd: end,
      dailyHours: dailyH,
    });

    aggPaidLeaveHrs += leaveHrs.paidLeaveHours;
    aggSickLeaveHrs += leaveHrs.sickLeaveHours;
    aggUnpaidLeaveHrs += leaveHrs.unpaidLeaveHours;

    let lineWd = wd;
    let expHoursForLine = Number(expHoursStr);
    const lwCap = params.lastWorkingDayByEmployeeId?.[emp.id];
    if (lwCap) {
      const effectiveEnd = lwCap.getTime() < end.getTime() ? lwCap : end;
      const effectiveStart = emp.hireDate.getTime() > start.getTime() ? emp.hireDate : start;
      const partialWd = countWeekdaysInclusiveUtc(effectiveStart, effectiveEnd);
      lineWd = Math.max(0, partialWd);
      expHoursForLine = wd > 0 ? (lineWd / wd) * Number(expHoursStr) : 0;
    }

    const paid = leaveHrs.paidLeaveHours;
    const sick = leaveHrs.sickLeaveHours;
    const unpaid = leaveHrs.unpaidLeaveHours;
    const actualReg = Math.max(0, expHoursForLine - paid - sick - unpaid);

    const lineInput: SpreadsheetLineComputationInput = {
      expectedWorkingDays: lineWd,
      expectedRegularHours: expHoursForLine.toFixed(2),
      actualRegularHours: actualReg.toFixed(2),
      paidLeaveHours: leaveHrs.paidLeaveHours.toFixed(2),
      sickLeaveHours: leaveHrs.sickLeaveHours.toFixed(2),
      unpaidLeaveHours: leaveHrs.unpaidLeaveHours.toFixed(2),
      overtimeHours: "0",
      weekendHours: "0",
      holidayHours: "0",
      nightHours: "0",
      bonuses: "0",
      otherDeductions: "0",
      salaryAdvanceDeduction: "0",
      ...params.lineOverridesByEmployeeId?.[emp.id],
    };

    const calc = computePayrollSpreadsheetLine(
      {
        employmentType: emp.employmentType,
        employerPrimacy: emp.employerPrimacy,
        baseSalaryMonthly: emp.baseSalaryMonthly.toString(),
        compensationBasis: emp.compensationBasis,
        targetNetMonthly: emp.targetNetMonthly?.toString() ?? null,
        exemptFromMinimumSalary: emp.exemptFromMinimumSalary,
      },
      lineInput,
      params.ctx.snapshot,
      params.sickPct,
      calendarSnapshot,
    );

    if (!calc.ok) {
      throw new Error(calc.issues.map((i) => i.message).join("; "));
    }

    const v = calc.value;

    await tx.payrollEntry.create({
      data: {
        payrollId: params.payrollId,
        employeeId: emp.id,
        status: params.entryStatus,
        employmentTypeSnapshot: emp.employmentType,
        employerPrimacySnapshot: emp.employerPrimacy,
        calendarDaysInMonth: days,
        paidDays: new Prisma.Decimal(lineWd),
        jobTitleSnapshot: emp.jobTitle,
        compensationBasisSnapshot: emp.compensationBasis,
        contractGrossMonthlySnapshot: emp.baseSalaryMonthly,
        contractNetMonthlySnapshot: emp.targetNetMonthly,
        expectedWorkingDays: lineWd,
        expectedRegularHours: new Prisma.Decimal(lineInput.expectedRegularHours),
        actualRegularHours: new Prisma.Decimal(lineInput.actualRegularHours),
        paidLeaveHours: new Prisma.Decimal(lineInput.paidLeaveHours),
        sickLeaveHours: new Prisma.Decimal(lineInput.sickLeaveHours),
        unpaidLeaveHours: new Prisma.Decimal(lineInput.unpaidLeaveHours),
        overtimeHours: new Prisma.Decimal(lineInput.overtimeHours),
        weekendHours: new Prisma.Decimal(lineInput.weekendHours),
        holidayHours: new Prisma.Decimal(lineInput.holidayHours),
        nightHours: new Prisma.Decimal(lineInput.nightHours),
        hourlyRate: new Prisma.Decimal(v.hourlyRate),
        regularPay: new Prisma.Decimal(v.regularPay),
        paidLeavePay: new Prisma.Decimal(v.paidLeavePay),
        sickLeavePay: new Prisma.Decimal(v.sickLeavePay),
        unpaidLeaveDeduction: new Prisma.Decimal(v.unpaidLeaveDeduction),
        overtimeAmount: new Prisma.Decimal(v.overtimeAmount),
        weekendAmount: new Prisma.Decimal(v.weekendAmount),
        holidayAmount: new Prisma.Decimal(v.holidayAmount),
        nightAmount: new Prisma.Decimal(v.nightAmount),
        bonuses: new Prisma.Decimal(v.bonuses),
        salaryAdvanceDeduction: new Prisma.Decimal(v.salaryAdvanceDeduction),
        grossSalary: new Prisma.Decimal(v.grossSalary),
        taxableIncome: new Prisma.Decimal(v.taxableIncome),
        pitWithheld: new Prisma.Decimal(v.pitWithheld),
        pensionEmployee: new Prisma.Decimal(v.pensionEmployee),
        pensionEmployer: new Prisma.Decimal(v.pensionEmployer),
        otherDeductions: new Prisma.Decimal(v.otherDeductions),
        netPay: new Prisma.Decimal(v.netPay),
        employerTotalCost: new Prisma.Decimal(v.employerTotalCost),
        calculationBreakdown: payrollCalculationBreakdownAsJson({
          ...(v.breakdown as Record<string, unknown>),
          terminationPartialMonth: lwCap ? true : undefined,
        }),
        otherEmployerCosts: new Prisma.Decimal(0),
      },
    });
  }

  return { aggPaidLeaveHrs, aggSickLeaveHrs, aggUnpaidLeaveHrs };
}

/** Recalculate payroll rows for a subset of employees without wiping the entire payroll. */
export async function recalculatePayrollEntriesForEmployees(params: {
  companyId: string;
  payrollId: string;
  employeeIds: string[];
  lastWorkingDayByEmployeeId?: Record<string, Date>;
  entryStatus?: PayrollEntryStatus;
  actorUserId?: string | null;
  /** When false, skip updating payroll shell expected hours/days (used for partial runs). Default false. */
  updatePayrollAggregateMeta?: boolean;
  lineOverridesByEmployeeId?: Record<string, Partial<SpreadsheetLineComputationInput>>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const employeeIds = [...new Set(params.employeeIds)].filter(Boolean);
  if (employeeIds.length === 0) {
    return { ok: false, error: "Lista e punonjësve është bosh." };
  }

  const payroll = await prisma.payroll.findFirst({
    where: { id: params.payrollId, companyId: params.companyId },
  });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "DRAFT") {
    return { ok: false, error: "Ripëllogaritja lejohet vetëm për payroll në DRAFT." };
  }

  const ctx = await loadPayrollLegislationContext(params.companyId, payroll.year, payroll.month);
  if (!ctx) return { ok: false, error: "Nuk mund të ngarkohen parametrat për këtë periudhë." };

  const settingsRow = await prisma.payrollSettings.findUnique({ where: { companyId: params.companyId } });
  const sickPct = settingsRow?.sickLeavePayPercent.toString() ?? "1";

  const wt = await resolvePayrollMonthWorkingTime(params.companyId, payroll.year, payroll.month);
  if (!wt) return { ok: false, error: "Nuk mund të ngarkohet kalendari i punës nga PayrollSettings." };

  const { start, end } = periodBoundsUtc(payroll.year, payroll.month);

  const picked = await findEmployeesEligibleForPayrollMonth(params.companyId, payroll.year, payroll.month, start, end);
  if (!picked.ok) return { ok: false, error: picked.error };

  const inclusion = await prisma.payrollIncludedEmployee.findMany({
    where: { payrollId: params.payrollId },
    select: { employeeId: true },
  });
  const inclSet = new Set(inclusion.map((i) => i.employeeId));

  const eligibleFiltered = picked.employees.filter((e) => inclSet.size === 0 || inclSet.has(e.id));
  const idSet = new Set(eligibleFiltered.map((e) => e.id));
  for (const id of employeeIds) {
    if (!idSet.has(id)) {
      return {
        ok: false,
        error:
          "Një ose më shumë punonjës nuk janë të përfshirë në këtë payroll ose nuk janë të përshtatshëm (status / data punësimit).",
      };
    }
  }

  const employees = eligibleFiltered.filter((e) => employeeIds.includes(e.id));
  const entryStatus = params.entryStatus ?? "FINAL";

  let leaveTotals = { aggPaidLeaveHrs: 0, aggSickLeaveHrs: 0, aggUnpaidLeaveHrs: 0 };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payrollEntry.deleteMany({
        where: { payrollId: params.payrollId, employeeId: { in: employeeIds } },
      });

      leaveTotals = await createPayrollEntriesForEmployeesTx(tx, {
        companyId: params.companyId,
        payrollId: params.payrollId,
        payrollYear: payroll.year,
        payrollMonth: payroll.month,
        employees,
        ctx,
        wt,
        sickPct,
        lastWorkingDayByEmployeeId: params.lastWorkingDayByEmployeeId,
        entryStatus,
        lineOverridesByEmployeeId: params.lineOverridesByEmployeeId,
      });

      if (params.updatePayrollAggregateMeta) {
        await tx.payroll.update({
          where: { id: params.payrollId },
          data: {
            parameterSetId: ctx.parameterSetId,
            expectedWorkingDays: wt.expectedWorkingDays,
            expectedRegularHours: new Prisma.Decimal(wt.expectedRegularHours),
          },
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  await recordLeavePayrollRegenerationLeaveAudit({
    companyId: params.companyId,
    payrollId: params.payrollId,
    actorUserId: params.actorUserId,
    headcount: employees.length,
    payrollYear: payroll.year,
    payrollMonth: payroll.month,
    leaveTotals: {
      paidLeaveHours: leaveTotals.aggPaidLeaveHrs,
      sickLeaveHours: leaveTotals.aggSickLeaveHrs,
      unpaidLeaveHours: leaveTotals.aggUnpaidLeaveHrs,
    },
  });

  return { ok: true };
}

export async function regeneratePayrollEntriesAndCalculate(
  companyId: string,
  payrollId: string,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId },
  });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "DRAFT") {
    return { ok: false, error: "Ripëllogaritja lejohet vetëm për payroll në DRAFT." };
  }

  const ctx = await loadPayrollLegislationContext(companyId, payroll.year, payroll.month);
  if (!ctx) return { ok: false, error: "Nuk mund të ngarkohen parametrat për këtë periudhë." };

  const settingsRow = await prisma.payrollSettings.findUnique({ where: { companyId } });
  const sickPct = settingsRow?.sickLeavePayPercent.toString() ?? "1";

  const wt = await resolvePayrollMonthWorkingTime(companyId, payroll.year, payroll.month);
  if (!wt) return { ok: false, error: "Nuk mund të ngarkohet kalendari i punës nga PayrollSettings." };

  const { start, end } = periodBoundsUtc(payroll.year, payroll.month);

  const picked = await findEmployeesEligibleForPayrollMonth(companyId, payroll.year, payroll.month, start, end);
  if (!picked.ok) return { ok: false, error: picked.error };

  const inclusion = await prisma.payrollIncludedEmployee.findMany({
    where: { payrollId },
    select: { employeeId: true },
  });
  const inclSet = new Set(inclusion.map((i) => i.employeeId));

  const employees = picked.employees.filter((e) => inclSet.size === 0 || inclSet.has(e.id));

  let aggPaidLeaveHrs = 0;
  let aggSickLeaveHrs = 0;
  let aggUnpaidLeaveHrs = 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payrollEntry.deleteMany({ where: { payrollId } });

      const totals = await createPayrollEntriesForEmployeesTx(tx, {
        companyId,
        payrollId,
        payrollYear: payroll.year,
        payrollMonth: payroll.month,
        employees,
        ctx,
        wt,
        sickPct,
        entryStatus: "FINAL",
      });
      aggPaidLeaveHrs = totals.aggPaidLeaveHrs;
      aggSickLeaveHrs = totals.aggSickLeaveHrs;
      aggUnpaidLeaveHrs = totals.aggUnpaidLeaveHrs;

      await tx.payroll.update({
        where: { id: payrollId },
        data: {
          parameterSetId: ctx.parameterSetId,
          expectedWorkingDays: wt.expectedWorkingDays,
          expectedRegularHours: new Prisma.Decimal(wt.expectedRegularHours),
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  await recordLeavePayrollRegenerationLeaveAudit({
    companyId,
    payrollId,
    actorUserId,
    headcount: employees.length,
    payrollYear: payroll.year,
    payrollMonth: payroll.month,
    leaveTotals: {
      paidLeaveHours: aggPaidLeaveHrs,
      sickLeaveHours: aggSickLeaveHrs,
      unpaidLeaveHours: aggUnpaidLeaveHrs,
    },
  });

  return { ok: true };
}

export async function reviewPayrollExplicit(
  companyId: string,
  payrollId: string,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({ where: { id: payrollId, companyId } });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "DRAFT") return { ok: false, error: "Vetëm payroll-i në DRAFT kalon në REVIEWED manualisht." };

  await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      status: "REVIEWED",
      reviewedAt: new Date(),
      reviewedById: actorUserId ?? undefined,
    },
  });

  await appendPayrollDomainActivity({
    companyId,
    payrollId,
    verb: "UPDATED",
    summary: "Payroll u shënua si i shqyrtuar.",
    actorUserId,
    payload: { event: PAYROLL_TIMELINE.REVIEWED },
  });

  return { ok: true };
}

export async function approvePayroll(
  companyId: string,
  payrollId: string,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId },
    include: { _count: { select: { entries: true } } },
  });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "REVIEWED") return { ok: false, error: "Miratimi kërkon status REVIEWED." };
  if (payroll._count.entries === 0) return { ok: false, error: "S’ka rreshta pagë për të miratuar." };

  await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: actorUserId ?? undefined,
    },
  });

  await appendPayrollDomainActivity({
    companyId,
    payrollId,
    verb: "APPROVED",
    summary: "Payroll u miratua për kyçje.",
    actorUserId,
    payload: { event: PAYROLL_TIMELINE.APPROVED },
  });
  await appendPayrollAuditLog({
    companyId,
    payrollId,
    action: "APPROVE",
    actorUserId,
  });

  return { ok: true };
}

export async function lockPayrollWithSnapshot(
  companyId: string,
  payrollId: string,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId },
    include: {
      entries: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, personalId: true } },
          adjustments: true,
        },
      },
      company: { select: { legalName: true, tradeName: true } },
    },
  });

  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "APPROVED") return { ok: false, error: "Kyçja kërkon status APPROVED." };

  const payload = {
    version: 1 as const,
    capturedAt: new Date().toISOString(),
    payroll: {
      id: payroll.id,
      year: payroll.year,
      month: payroll.month,
      currency: payroll.currency,
      company: payroll.company.tradeName ?? payroll.company.legalName,
    },
    entries: payroll.entries.map((e) => ({
      employeeId: e.employeeId,
      name: `${e.employee.firstName} ${e.employee.lastName}`,
      personalId: e.employee.personalId,
      grossSalary: e.grossSalary.toString(),
      netPay: e.netPay.toString(),
      taxableIncome: e.taxableIncome.toString(),
      pitWithheld: e.pitWithheld.toString(),
      pensionEmployee: e.pensionEmployee.toString(),
      pensionEmployer: e.pensionEmployer.toString(),
      bonuses: e.bonuses.toString(),
      otherDeductions: e.otherDeductions.toString(),
      breakdown: jsonSerializableClone(e.calculationBreakdown),
      adjustments: e.adjustments.map((a) => ({
        kind: a.kind,
        label: a.label,
        amount: a.amount.toString(),
      })),
    })),
  };

  const pdfRes = await generatePayrollPdfArtifacts({ companyId, payrollId, actorUserId });
  if (!pdfRes.ok) return pdfRes;

  await prisma.$transaction(async (tx) => {
    await tx.payrollSnapshot.create({
      data: {
        payrollId,
        companyId,
        capturedByUserId: actorUserId ?? undefined,
        payload: payload as object,
      },
    });

    await tx.payrollEntry.updateMany({
      where: { payrollId },
      data: { isLocked: true },
    });

    await tx.payroll.update({
      where: { id: payrollId },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedById: actorUserId ?? undefined,
      },
    });
  });

  await appendPayrollDomainActivity({
    companyId,
    payrollId,
    verb: "LOCKED",
    summary: "Payroll u kyç dhe snapshot-i u ruajt.",
    actorUserId,
    payload: { event: PAYROLL_TIMELINE.LOCKED },
  });
  await appendPayrollAuditLog({
    companyId,
    payrollId,
    action: "LOCK",
    actorUserId,
  });

  return { ok: true };
}

export async function archivePayroll(
  companyId: string,
  payrollId: string,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({ where: { id: payrollId, companyId } });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "LOCKED") return { ok: false, error: "Arkivimi kërkon payroll të kyçur." };

  await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
      archivedById: actorUserId ?? undefined,
    },
  });

  await appendPayrollDomainActivity({
    companyId,
    payrollId,
    verb: "ARCHIVED",
    summary: "Payroll u arkivua.",
    actorUserId,
    payload: { event: PAYROLL_TIMELINE.ARCHIVED },
  });

  return { ok: true };
}

export type PayrollEntrySpreadsheetPatch = {
  bonuses?: string;
  otherDeductions?: string;
  salaryAdvanceDeduction?: string;
  actualRegularHours?: string;
  paidLeaveHours?: string;
  sickLeaveHours?: string;
  unpaidLeaveHours?: string;
  overtimeHours?: string;
  weekendHours?: string;
  holidayHours?: string;
  nightHours?: string;
  manualGrossOverride?: string | null;
  manualNetOverride?: string | null;
  manualGrossReason?: string | null;
  manualNetReason?: string | null;
  notes?: string | null;
};

export async function updatePayrollEntryAmounts(
  companyId: string,
  entryId: string,
  patch: PayrollEntrySpreadsheetPatch,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const entry = await prisma.payrollEntry.findFirst({
    where: { id: entryId, payroll: { companyId } },
    include: { payroll: true, employee: true },
  });

  if (!entry) return { ok: false, error: "Rreshti nuk u gjet." };
  const notEditable = payrollNotEditableMessage(entry.payroll.status);
  if (notEditable) return { ok: false, error: notEditable };

  try {
  const grossOv =
    patch.manualGrossOverride !== undefined ? patch.manualGrossOverride : entry.manualGrossOverride?.toString() ?? null;
  const netOv =
    patch.manualNetOverride !== undefined ? patch.manualNetOverride : entry.manualNetOverride?.toString() ?? null;
  const grossReason =
    patch.manualGrossReason !== undefined ? patch.manualGrossReason : entry.manualGrossReason ?? null;
  const netReason = patch.manualNetReason !== undefined ? patch.manualNetReason : entry.manualNetReason ?? null;

  if (grossOv != null && grossOv.trim() !== "" && !(grossReason?.trim())) {
    return { ok: false, error: "Mbivendosja e bruto kërkon arsye." };
  }
  if (netOv != null && netOv.trim() !== "" && !(netReason?.trim())) {
    return { ok: false, error: "Mbivendosja e neto kërkon arsye." };
  }

  const ctx = await loadPayrollLegislationContext(companyId, entry.payroll.year, entry.payroll.month);
  if (!ctx) return { ok: false, error: "Nuk mund të ngarkohen parametrat." };

  const settingsRow = await prisma.payrollSettings.findUnique({ where: { companyId } });
  const sickPct = settingsRow?.sickLeavePayPercent.toString() ?? "1";

  const wt = await resolvePayrollMonthWorkingTime(companyId, entry.payroll.year, entry.payroll.month);
  if (!wt) return { ok: false, error: "Nuk mund të ngarkohet kalendari i punës nga PayrollSettings." };

  const wd =
    entry.payroll.expectedWorkingDays ??
    entry.expectedWorkingDays ??
    wt.expectedWorkingDays;
  const expHours =
    entry.payroll.expectedRegularHours?.toString() ??
    entry.expectedRegularHours?.toString() ??
    wt.expectedRegularHours;

  const calendarSnapshot: PayrollMonthCalendarSnapshot = {
    expectedWorkingDays: wd,
    expectedRegularHours: expHours,
    hoursPerWorkingDay: wt.hoursPerWorkingDay,
    weekdayPublicHolidayDates: wt.weekdayPublicHolidayDates,
    overtimeWeeklyThresholdHours: wt.overtimeWeeklyThresholdHours,
    overtimeWarningWeeklyHours: wt.overtimeWarningWeeklyHours,
    standardWeeklyHours: wt.standardWeeklyHours,
    nightWorkPeriodDescription: wt.nightWorkPeriodDescription,
  };

  const pick = (p: string | undefined, d: Prisma.Decimal) => (p !== undefined ? p : d.toString());

  const lineInput: SpreadsheetLineComputationInput = {
    expectedWorkingDays: wd,
    expectedRegularHours: expHours,
    actualRegularHours: pick(patch.actualRegularHours, entry.actualRegularHours),
    paidLeaveHours: pick(patch.paidLeaveHours, entry.paidLeaveHours),
    sickLeaveHours: pick(patch.sickLeaveHours, entry.sickLeaveHours),
    unpaidLeaveHours: pick(patch.unpaidLeaveHours, entry.unpaidLeaveHours),
    overtimeHours: pick(patch.overtimeHours, entry.overtimeHours),
    weekendHours: pick(patch.weekendHours, entry.weekendHours),
    holidayHours: pick(patch.holidayHours, entry.holidayHours),
    nightHours: pick(patch.nightHours, entry.nightHours),
    bonuses: pick(patch.bonuses, entry.bonuses),
    otherDeductions: pick(patch.otherDeductions, entry.otherDeductions),
    salaryAdvanceDeduction: pick(patch.salaryAdvanceDeduction, entry.salaryAdvanceDeduction),
    manualGrossOverride: grossOv != null && grossOv.trim() !== "" ? grossOv : null,
    manualNetOverride: netOv != null && netOv.trim() !== "" ? netOv : null,
  };

  const emp = entry.employee;
  const calc = computePayrollSpreadsheetLine(
    {
      employmentType: emp.employmentType,
      employerPrimacy: emp.employerPrimacy,
      baseSalaryMonthly: emp.baseSalaryMonthly.toString(),
      compensationBasis: emp.compensationBasis,
      targetNetMonthly: emp.targetNetMonthly?.toString() ?? null,
      exemptFromMinimumSalary: emp.exemptFromMinimumSalary,
    },
    lineInput,
    ctx.snapshot,
    sickPct,
    calendarSnapshot,
  );

  if (!calc.ok) return { ok: false, error: calc.issues.map((i) => i.message).join("; ") };

  const v = calc.value;

  let breakdownPlain: object;
  try {
    breakdownPlain = payrollCalculationBreakdownAsJson(v.breakdown as Record<string, unknown>);
  } catch {
    return { ok: false, error: "Rezultati i llogaritjes nuk mund të ruhet (serializim JSON)." };
  }

  await prisma.payrollEntry.update({
    where: { id: entryId },
    data: {
      expectedWorkingDays: wd,
      expectedRegularHours: new Prisma.Decimal(expHours),
      actualRegularHours: new Prisma.Decimal(lineInput.actualRegularHours),
      paidLeaveHours: new Prisma.Decimal(lineInput.paidLeaveHours),
      sickLeaveHours: new Prisma.Decimal(lineInput.sickLeaveHours),
      unpaidLeaveHours: new Prisma.Decimal(lineInput.unpaidLeaveHours),
      overtimeHours: new Prisma.Decimal(lineInput.overtimeHours),
      weekendHours: new Prisma.Decimal(lineInput.weekendHours),
      holidayHours: new Prisma.Decimal(lineInput.holidayHours),
      nightHours: new Prisma.Decimal(lineInput.nightHours),
      hourlyRate: new Prisma.Decimal(v.hourlyRate),
      regularPay: new Prisma.Decimal(v.regularPay),
      paidLeavePay: new Prisma.Decimal(v.paidLeavePay),
      sickLeavePay: new Prisma.Decimal(v.sickLeavePay),
      unpaidLeaveDeduction: new Prisma.Decimal(v.unpaidLeaveDeduction),
      overtimeAmount: new Prisma.Decimal(v.overtimeAmount),
      weekendAmount: new Prisma.Decimal(v.weekendAmount),
      holidayAmount: new Prisma.Decimal(v.holidayAmount),
      nightAmount: new Prisma.Decimal(v.nightAmount),
      bonuses: new Prisma.Decimal(v.bonuses),
      salaryAdvanceDeduction: new Prisma.Decimal(v.salaryAdvanceDeduction),
      grossSalary: new Prisma.Decimal(v.grossSalary),
      taxableIncome: new Prisma.Decimal(v.taxableIncome),
      pitWithheld: new Prisma.Decimal(v.pitWithheld),
      pensionEmployee: new Prisma.Decimal(v.pensionEmployee),
      pensionEmployer: new Prisma.Decimal(v.pensionEmployer),
      otherDeductions: new Prisma.Decimal(v.otherDeductions),
      netPay: new Prisma.Decimal(v.netPay),
      employerTotalCost: new Prisma.Decimal(v.employerTotalCost),
      calculationBreakdown: breakdownPlain,
      manualGrossOverride:
        grossOv != null && grossOv.trim() !== "" ? new Prisma.Decimal(grossOv) : null,
      manualNetOverride: netOv != null && netOv.trim() !== "" ? new Prisma.Decimal(netOv) : null,
      manualGrossReason: grossReason ?? null,
      manualNetReason: netReason ?? null,
      notes: patch.notes !== undefined ? patch.notes : entry.notes,
    },
  });

  await appendPayrollAuditLog({
    companyId,
    payrollId: entry.payrollId,
    action: "UPDATE_ENTRY",
    actorUserId,
    diff: { entryId, patch },
  });

  return { ok: true };
  } catch (e) {
    console.error("[updatePayrollEntryAmounts]", e);
    const msg = e instanceof Error ? e.message : "Gabim i papritur gjatë llogaritjes ose ruajtjes.";
    return { ok: false, error: msg };
  }
}

export async function patchPayrollEntriesBulk(
  companyId: string,
  payrollId: string,
  rows: { entryId: string; patch: PayrollEntrySpreadsheetPatch }[],
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({ where: { id: payrollId, companyId } });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  const bulkNotEditable = payrollNotEditableMessage(payroll.status);
  if (bulkNotEditable) return { ok: false, error: bulkNotEditable };

  for (const row of rows) {
    const belongs = await prisma.payrollEntry.findFirst({
      where: { id: row.entryId, payrollId },
      select: { id: true },
    });
    if (!belongs) {
      return { ok: false, error: "Një rresht nuk i përket këtij payroll-i." };
    }
    const res = await updatePayrollEntryAmounts(companyId, row.entryId, row.patch, actorUserId);
    if (!res.ok) return res;
  }

  return { ok: true };
}

export async function returnPayrollReviewToDraft(
  companyId: string,
  payrollId: string,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({ where: { id: payrollId, companyId } });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status !== "REVIEWED") return { ok: false, error: "Vetëm payroll në REVIEWED mund të kthehet në DRAFT." };

  await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      status: "DRAFT",
      reviewedAt: null,
      reviewedById: null,
    },
  });

  await appendPayrollDomainActivity({
    companyId,
    payrollId,
    verb: "UPDATED",
    summary: "Payroll u kthye në DRAFT për redaktim.",
    actorUserId,
  });
  await appendPayrollAuditLog({
    companyId,
    payrollId,
    action: "RETURN_TO_DRAFT",
    actorUserId,
  });

  return { ok: true };
}

export async function validatePayrollSpreadsheet(
  companyId: string,
  payrollId: string,
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId },
    include: { entries: true },
  });
  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };

  const settings = await prisma.payrollSettings.findUnique({ where: { companyId } });
  const weeklyOtCap = settings?.overtimeWeeklyCapHours?.toNumber() ?? 8;

  const warnings: string[] = [];

  for (const e of payroll.entries) {
    const ot = e.overtimeHours.toNumber();
    if (ot > weeklyOtCap * 4.5) {
      warnings.push(
        `Punonjësi ${e.employeeId}: overtime mujore (${ot}h) tejkalon pragun për sinjalizim (${weeklyOtCap}h/javë × ~4.5).`,
      );
    }
  }

  await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      validatedAt: new Date(),
      validationWarnings: warnings.length ? warnings : Prisma.DbNull,
    },
  });

  return { ok: true, warnings };
}

export type PayrollDetailDto = NonNullable<Awaited<ReturnType<typeof getPayrollDetailDto>>>;
