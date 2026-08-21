import { Prisma as PrismaNs } from "@prisma/client";
import type {
  ContractorHoursSource,
  ContractorPayBasis,
  ContractorPayrollStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeContractorPay } from "@/modules/payroll/calculation/gross/contractor-pay";
import type { PremiumRules } from "@/modules/payroll/calculation/types";
import { D } from "@/modules/payroll/calculation/money/decimal";
import { periodBoundsUtc } from "@/modules/payroll/services/payroll-calendar-service";
import { recomputeTimeClockDaysForRange } from "@/modules/timeclock/services/timeclock-day-aggregation-service";

/**
 * The contractor flow deliberately stops at gross: CONTRACTOR employees have
 * applyTrust/applyTax forced off, so whatever this computes IS the payout — no
 * PIT, no pension, no ATK surface. Two bases are supported and both are net:
 * hours × tarifë (+ premiums), or a fixed monthly fee that hours never touch.
 * Anything shared with the regular engine (premium math, holiday calendar,
 * punch classification) is reused, not copied.
 */

/**
 * Contractor payroll is available when the admin flag says so OR the company
 * actually has contractors. Gating the only path that can pay a contractor
 * behind a manual console flag stranded companies that imported contractors
 * before anyone flipped it.
 */
export async function isContractorPayrollAvailable(companyId: string): Promise<boolean> {
  const [company, contractorCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { contractorPayrollEnabled: true },
    }),
    prisma.employee.count({
      where: { companyId, employmentType: "CONTRACTOR", status: { not: "TERMINATED" } },
    }),
  ]);
  if (!company) return false;
  return company.contractorPayrollEnabled || contractorCount > 0;
}

export interface ContractorHoursInput {
  regularHours: string;
  overtimeHours: string;
  weekendHours: string;
  holidayHours: string;
  nightHours: string;
}

export interface ContractorEntryDto {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  personalId: string;
  payBasis: ContractorPayBasis;
  hourlyRate: string;
  monthlyFlatAmount: string;
  regularHours: string;
  overtimeHours: string;
  weekendHours: string;
  holidayHours: string;
  nightHours: string;
  hoursSource: ContractorHoursSource;
  /** Net = gross for a contractor — the single figure that gets paid. */
  grossPay: string;
  notes: string | null;
}

export interface ContractorPeriodListRowDto {
  id: string;
  year: number;
  month: number;
  status: ContractorPayrollStatus;
  entryCount: number;
  totalGross: string;
  updatedAtIso: string;
}

export interface ContractorPeriodDetailDto {
  id: string;
  year: number;
  month: number;
  status: ContractorPayrollStatus;
  notes: string | null;
  entries: ContractorEntryDto[];
  totalGross: string;
  /** Albanian transparency warnings (e.g. monthly overtime above the weekly-cap approximation). */
  warnings: string[];
  multipliers: { overtime: string; weekend: string; holiday: string; night: string };
}

export type ContractorServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "NOT_ENABLED"
        | "DUPLICATE_PERIOD"
        | "NOT_EDITABLE"
        | "NO_CONTRACTORS"
        | "NO_HOURLY_RATE"
        | "NOT_HOURLY"
        | "ERROR";
    };

const CONTRACTOR_ELIGIBLE_STATUSES = ["ACTIVE", "ON_LEAVE"] as const;

async function loadPremiumRules(companyId: string): Promise<PremiumRules> {
  const settings = await prisma.payrollSettings.findUnique({
    where: { companyId },
    select: {
      overtimeMultiplier: true,
      weekendMultiplier: true,
      holidayMultiplier: true,
      nightWorkMultiplier: true,
    },
  });
  return {
    overtimeHourMultiplier: settings?.overtimeMultiplier.toString() ?? "1.3",
    weekendHourMultiplier: settings?.weekendMultiplier.toString() ?? "1.5",
    holidayHourMultiplier: settings?.holidayMultiplier.toString() ?? "1.5",
    nightHourMultiplier: settings?.nightWorkMultiplier.toString() ?? "1.3",
    stackPolicy: "additive",
  };
}

/**
 * Thin adapter over the pure engine — an unpayable entry resolves to 0 with the
 * reason recorded, rather than throwing and taking the whole period with it.
 */
function payForEntry(
  basis: ContractorPayBasis,
  hourlyRate: string,
  monthlyFlatAmount: string,
  hours: ContractorHoursInput,
  rules: PremiumRules,
): { grossPay: string; breakdown: object } {
  const result = computeContractorPay({
    basis,
    hourlyRate,
    monthlyFlatAmount,
    hours: {
      regularHours: hours.regularHours,
      overtimeHours: hours.overtimeHours,
      weekendHours: hours.weekendHours,
      holidayHours: hours.holidayHours,
      nightHours: hours.nightHours,
    },
    premiumRules: rules,
  });
  return { grossPay: result.pay, breakdown: result.breakdown };
}

function entryToDto(entry: {
  id: string;
  employeeId: string;
  payBasis: ContractorPayBasis;
  hourlyRateSnapshot: PrismaNs.Decimal;
  monthlyFlatAmount: PrismaNs.Decimal;
  regularHours: PrismaNs.Decimal;
  overtimeHours: PrismaNs.Decimal;
  weekendHours: PrismaNs.Decimal;
  holidayHours: PrismaNs.Decimal;
  nightHours: PrismaNs.Decimal;
  hoursSource: ContractorHoursSource;
  grossPay: PrismaNs.Decimal;
  notes: string | null;
  employee: { firstName: string; lastName: string; personalId: string };
}): ContractorEntryDto {
  return {
    id: entry.id,
    employeeId: entry.employeeId,
    firstName: entry.employee.firstName,
    lastName: entry.employee.lastName,
    personalId: entry.employee.personalId,
    payBasis: entry.payBasis,
    hourlyRate: entry.hourlyRateSnapshot.toFixed(2),
    monthlyFlatAmount: entry.monthlyFlatAmount.toFixed(2),
    regularHours: entry.regularHours.toFixed(2),
    overtimeHours: entry.overtimeHours.toFixed(2),
    weekendHours: entry.weekendHours.toFixed(2),
    holidayHours: entry.holidayHours.toFixed(2),
    nightHours: entry.nightHours.toFixed(2),
    hoursSource: entry.hoursSource,
    grossPay: entry.grossPay.toFixed(2),
    notes: entry.notes,
  };
}

async function findEligibleContractors(companyId: string, year: number, month: number) {
  const { start, end } = periodBoundsUtc(year, month);
  return prisma.employee.findMany({
    where: {
      companyId,
      employmentType: "CONTRACTOR",
      hireDate: { lte: end },
      OR: [
        {
          status: { in: [...CONTRACTOR_ELIGIBLE_STATUSES] },
          OR: [{ terminationDate: null }, { terminationDate: { gte: start } }],
        },
        { status: "TERMINATED" as const, terminationDate: { gte: start } },
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, hourlyRate: true, baseSalaryMonthly: true, compensationBasis: true },
  });
}

/**
 * `Employee.compensationBasis` is the switch for contractors too: HOURLY_GROSS
 * means orë × tarifë, anything else means the agreed monthly fee. Contractors
 * have no withholding, so "gross" in those enum names is also their net.
 */
function basisFor(employee: { compensationBasis: string }): ContractorPayBasis {
  return employee.compensationBasis === "HOURLY_GROSS" ? "HOURLY" : "MONTHLY_FLAT";
}

function snapshotFor(employee: {
  hourlyRate: PrismaNs.Decimal | null;
  baseSalaryMonthly: PrismaNs.Decimal;
  compensationBasis: string;
}) {
  const basis = basisFor(employee);
  return {
    payBasis: basis,
    hourlyRateSnapshot: employee.hourlyRate ?? new PrismaNs.Decimal(0),
    // Only the paid basis carries a figure; the other stays 0 so a glance at the
    // row can never suggest a fee that was not agreed.
    monthlyFlatAmount:
      basis === "MONTHLY_FLAT" ? employee.baseSalaryMonthly : new PrismaNs.Decimal(0),
  };
}

export async function listContractorPayrollsForCompany(
  companyId: string,
): Promise<ContractorPeriodListRowDto[]> {
  const periods = await prisma.contractorPayrollPeriod.findMany({
    where: { companyId },
    include: {
      _count: { select: { entries: true } },
      entries: { select: { grossPay: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  return periods.map((p) => ({
    id: p.id,
    year: p.year,
    month: p.month,
    status: p.status,
    entryCount: p._count.entries,
    totalGross: p.entries
      .reduce((sum, e) => sum.plus(D(e.grossPay.toString())), D("0"))
      .toFixed(2),
    updatedAtIso: p.updatedAt.toISOString(),
  }));
}

export async function createContractorPayrollPeriod(params: {
  companyId: string;
  year: number;
  month: number;
  actorUserId: string;
}): Promise<ContractorServiceResult<{ id: string }>> {
  const { companyId, year, month, actorUserId } = params;
  try {
    if (!(await isContractorPayrollAvailable(companyId))) {
      return { ok: false, code: "NOT_ENABLED" };
    }

    const existing = await prisma.contractorPayrollPeriod.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
      select: { id: true },
    });
    if (existing) return { ok: false, code: "DUPLICATE_PERIOD" };

    const contractors = await findEligibleContractors(companyId, year, month);
    if (contractors.length === 0) return { ok: false, code: "NO_CONTRACTORS" };

    const rules = await loadPremiumRules(companyId);
    const noHours: ContractorHoursInput = {
      regularHours: "0",
      overtimeHours: "0",
      weekendHours: "0",
      holidayHours: "0",
      nightHours: "0",
    };

    const period = await prisma.contractorPayrollPeriod.create({
      data: {
        companyId,
        year,
        month,
        createdById: actorUserId,
        entries: {
          create: contractors.map((c) => {
            const snapshot = snapshotFor(c);
            // A fixed fee is already known the moment the period opens, so price
            // it now. An hourly line legitimately starts at 0 — nobody has said
            // how many hours were worked yet.
            const { grossPay, breakdown } = payForEntry(
              snapshot.payBasis,
              snapshot.hourlyRateSnapshot.toString(),
              snapshot.monthlyFlatAmount.toString(),
              noHours,
              rules,
            );
            return {
              employeeId: c.id,
              ...snapshot,
              grossPay: new PrismaNs.Decimal(grossPay),
              calculationBreakdown: JSON.parse(JSON.stringify(breakdown)),
            };
          }),
        },
      },
      select: { id: true },
    });
    return { ok: true, data: { id: period.id } };
  } catch (error) {
    console.error("createContractorPayrollPeriod failed", error);
    return { ok: false, code: "ERROR" };
  }
}

export async function getContractorPayrollDetail(
  companyId: string,
  periodId: string,
): Promise<ContractorPeriodDetailDto | null> {
  const period = await prisma.contractorPayrollPeriod.findFirst({
    where: { id: periodId, companyId },
    include: {
      entries: {
        include: { employee: { select: { firstName: true, lastName: true, personalId: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!period) return null;

  const settings = await prisma.payrollSettings.findUnique({
    where: { companyId },
    select: {
      overtimeMultiplier: true,
      weekendMultiplier: true,
      holidayMultiplier: true,
      nightWorkMultiplier: true,
      overtimeWeeklyCapHours: true,
    },
  });

  const entries = [...period.entries]
    .sort((a, b) =>
      `${a.employee.lastName} ${a.employee.firstName}`.localeCompare(
        `${b.employee.lastName} ${b.employee.firstName}`,
        "sq",
      ),
    )
    .map(entryToDto);

  const warnings: string[] = [];
  // Mirror of the regular flow's transparency check: monthly overtime vs. weekly cap × 4.5.
  const monthlyOtCap = D(settings?.overtimeWeeklyCapHours.toString() ?? "8").mul("4.5");
  for (const e of entries) {
    if (e.payBasis === "MONTHLY_FLAT") {
      if (D(e.monthlyFlatAmount).lte(0)) {
        warnings.push(
          `${e.firstName} ${e.lastName}: mungon paga mujore neto — paga del 0. Vendoseni te profili i punonjësit dhe rifreskoni listën.`,
        );
      }
      // Overtime hours on a flat fee are an attendance note, not money — warning
      // about the cap here would imply a payment that never happens.
      continue;
    }
    if (D(e.overtimeHours).gt(monthlyOtCap)) {
      warnings.push(
        `${e.firstName} ${e.lastName}: ${e.overtimeHours} orë shtesë këtë muaj — mbi kufirin orientues mujor (${monthlyOtCap.toFixed(1)} orë).`,
      );
    }
    if (D(e.hourlyRate).lte(0)) {
      warnings.push(
        `${e.firstName} ${e.lastName}: mungon tarifa orare — paga del 0. Vendoseni te profili i punonjësit dhe rifreskoni listën.`,
      );
    }
  }

  return {
    id: period.id,
    year: period.year,
    month: period.month,
    status: period.status,
    notes: period.notes,
    entries,
    totalGross: entries.reduce((sum, e) => sum.plus(D(e.grossPay)), D("0")).toFixed(2),
    warnings,
    multipliers: {
      overtime: settings?.overtimeMultiplier.toString() ?? "1.3",
      weekend: settings?.weekendMultiplier.toString() ?? "1.5",
      holiday: settings?.holidayMultiplier.toString() ?? "1.5",
      night: settings?.nightWorkMultiplier.toString() ?? "1.3",
    },
  };
}

async function loadEditablePeriod(companyId: string, periodId: string) {
  const period = await prisma.contractorPayrollPeriod.findFirst({
    where: { id: periodId, companyId },
    select: { id: true, year: true, month: true, status: true },
  });
  if (!period) return { period: null, editable: false } as const;
  return { period, editable: period.status === "DRAFT" } as const;
}

/**
 * Re-syncs entries with today's contractor roster and rates: adds missing
 * contractors, refreshes each snapshot rate to the current wage, recomputes
 * gross from whatever hours are already entered. DRAFT only.
 */
export async function regenerateContractorPayrollEntries(
  companyId: string,
  periodId: string,
): Promise<ContractorServiceResult<{ updated: number }>> {
  try {
    const { period, editable } = await loadEditablePeriod(companyId, periodId);
    if (!period) return { ok: false, code: "NOT_FOUND" };
    if (!editable) return { ok: false, code: "NOT_EDITABLE" };

    const [contractors, rules, existingEntries] = await Promise.all([
      findEligibleContractors(companyId, period.year, period.month),
      loadPremiumRules(companyId),
      prisma.contractorPayrollEntry.findMany({
        where: { periodId },
        select: {
          id: true,
          employeeId: true,
          monthlyFlatAmount: true,
          regularHours: true,
          overtimeHours: true,
          weekendHours: true,
          holidayHours: true,
          nightHours: true,
        },
      }),
    ]);

    const byEmployee = new Map(existingEntries.map((e) => [e.employeeId, e]));
    let updated = 0;

    for (const contractor of contractors) {
      const snapshot = snapshotFor(contractor);
      const existing = byEmployee.get(contractor.id);
      if (!existing) {
        await prisma.contractorPayrollEntry.create({
          data: { periodId, employeeId: contractor.id, ...snapshot },
        });
        updated += 1;
        continue;
      }
      const hours: ContractorHoursInput = {
        regularHours: existing.regularHours.toString(),
        overtimeHours: existing.overtimeHours.toString(),
        weekendHours: existing.weekendHours.toString(),
        holidayHours: existing.holidayHours.toString(),
        nightHours: existing.nightHours.toString(),
      };
      // A flat fee already edited on this period (a pro-rated partial month) is
      // kept; refreshing the roster must not quietly undo that decision.
      const flatAmount =
        snapshot.payBasis === "MONTHLY_FLAT" && existing.monthlyFlatAmount.gt(0)
          ? existing.monthlyFlatAmount
          : snapshot.monthlyFlatAmount;
      const { grossPay, breakdown } = payForEntry(
        snapshot.payBasis,
        snapshot.hourlyRateSnapshot.toString(),
        flatAmount.toString(),
        hours,
        rules,
      );
      await prisma.contractorPayrollEntry.update({
        where: { id: existing.id },
        data: {
          payBasis: snapshot.payBasis,
          hourlyRateSnapshot: snapshot.hourlyRateSnapshot,
          monthlyFlatAmount: flatAmount,
          grossPay: new PrismaNs.Decimal(grossPay),
          calculationBreakdown: JSON.parse(JSON.stringify(breakdown)),
        },
      });
      updated += 1;
    }

    return { ok: true, data: { updated } };
  } catch (error) {
    console.error("regenerateContractorPayrollEntries failed", error);
    return { ok: false, code: "ERROR" };
  }
}

export async function updateContractorEntryHours(params: {
  companyId: string;
  periodId: string;
  entryId: string;
  hours: ContractorHoursInput;
  /** Only meaningful on MONTHLY_FLAT entries; ignored on hourly ones. */
  monthlyFlatAmount?: string;
  notes?: string | null;
}): Promise<ContractorServiceResult<{ grossPay: string }>> {
  const { companyId, periodId, entryId, hours, monthlyFlatAmount, notes } = params;
  try {
    const { period, editable } = await loadEditablePeriod(companyId, periodId);
    if (!period) return { ok: false, code: "NOT_FOUND" };
    if (!editable) return { ok: false, code: "NOT_EDITABLE" };

    const entry = await prisma.contractorPayrollEntry.findFirst({
      where: { id: entryId, periodId },
      select: {
        id: true,
        payBasis: true,
        hourlyRateSnapshot: true,
        monthlyFlatAmount: true,
      },
    });
    if (!entry) return { ok: false, code: "NOT_FOUND" };

    const rules = await loadPremiumRules(companyId);
    // The basis lives on the entry, never on the request: a client cannot talk an
    // hourly contractor into being paid a flat fee by posting one.
    const flatAmount =
      entry.payBasis === "MONTHLY_FLAT" && monthlyFlatAmount !== undefined
        ? monthlyFlatAmount
        : entry.monthlyFlatAmount.toString();
    const { grossPay, breakdown } = payForEntry(
      entry.payBasis,
      entry.hourlyRateSnapshot.toString(),
      flatAmount,
      hours,
      rules,
    );

    await prisma.contractorPayrollEntry.update({
      where: { id: entry.id },
      data: {
        regularHours: new PrismaNs.Decimal(hours.regularHours),
        overtimeHours: new PrismaNs.Decimal(hours.overtimeHours),
        weekendHours: new PrismaNs.Decimal(hours.weekendHours),
        holidayHours: new PrismaNs.Decimal(hours.holidayHours),
        nightHours: new PrismaNs.Decimal(hours.nightHours),
        monthlyFlatAmount: new PrismaNs.Decimal(flatAmount),
        hoursSource: "MANUAL",
        grossPay: new PrismaNs.Decimal(grossPay),
        calculationBreakdown: JSON.parse(JSON.stringify(breakdown)),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    return { ok: true, data: { grossPay } };
  } catch (error) {
    console.error("updateContractorEntryHours failed", error);
    return { ok: false, code: "ERROR" };
  }
}

/**
 * Pre-fills an entry's hour buckets from the badge time clock: recomputes the
 * month's TimeClockDay rows from raw punches, then sums them. A convenience
 * fill, not a lock — HR can still edit every figure afterwards.
 */
export async function syncContractorEntryFromTimeClock(params: {
  companyId: string;
  periodId: string;
  entryId: string;
}): Promise<ContractorServiceResult<{ grossPay: string; daysNeedingReview: number }>> {
  const { companyId, periodId, entryId } = params;
  try {
    const { period, editable } = await loadEditablePeriod(companyId, periodId);
    if (!period) return { ok: false, code: "NOT_FOUND" };
    if (!editable) return { ok: false, code: "NOT_EDITABLE" };

    const entry = await prisma.contractorPayrollEntry.findFirst({
      where: { id: entryId, periodId },
      select: { id: true, employeeId: true, payBasis: true, hourlyRateSnapshot: true },
    });
    if (!entry) return { ok: false, code: "NOT_FOUND" };
    // Filling hours would not move a flat fee by a cent, so say so rather than
    // appear to work.
    if (entry.payBasis !== "HOURLY") return { ok: false, code: "NOT_HOURLY" };

    const { start, end } = periodBoundsUtc(period.year, period.month);
    const recompute = await recomputeTimeClockDaysForRange({
      companyId,
      employeeId: entry.employeeId,
      rangeStart: start,
      rangeEnd: end,
    });
    if (!recompute.ok) return { ok: false, code: "ERROR" };

    const days = await prisma.timeClockDay.findMany({
      where: { companyId, employeeId: entry.employeeId, workDate: { gte: start, lte: end } },
      select: {
        status: true,
        regularMinutes: true,
        overtimeMinutes: true,
        weekendMinutes: true,
        holidayMinutes: true,
        nightMinutes: true,
        nightStackMinutes: true,
      },
    });

    const sumMinutes = (pick: (d: (typeof days)[number]) => number): string =>
      D(days.reduce((sum, d) => sum + pick(d), 0))
        .div(60)
        .toDecimalPlaces(2)
        .toFixed(2);

    const hours: ContractorHoursInput = {
      regularHours: sumMinutes((d) => d.regularMinutes),
      overtimeHours: sumMinutes((d) => d.overtimeMinutes),
      weekendHours: sumMinutes((d) => d.weekendMinutes),
      holidayHours: sumMinutes((d) => d.holidayMinutes),
      nightHours: sumMinutes((d) => d.nightMinutes),
    };
    const daysNeedingReview = days.filter((d) => d.status === "NEEDS_REVIEW").length;

    const rules = await loadPremiumRules(companyId);
    const { grossPay, breakdown } = payForEntry(
      "HOURLY",
      entry.hourlyRateSnapshot.toString(),
      "0",
      hours,
      rules,
    );

    await prisma.contractorPayrollEntry.update({
      where: { id: entry.id },
      data: {
        regularHours: new PrismaNs.Decimal(hours.regularHours),
        overtimeHours: new PrismaNs.Decimal(hours.overtimeHours),
        weekendHours: new PrismaNs.Decimal(hours.weekendHours),
        holidayHours: new PrismaNs.Decimal(hours.holidayHours),
        nightHours: new PrismaNs.Decimal(hours.nightHours),
        hoursSource: "TIMECLOCK",
        grossPay: new PrismaNs.Decimal(grossPay),
        calculationBreakdown: JSON.parse(
          JSON.stringify({
            ...breakdown,
            timeClockSync: {
              daysCounted: days.length,
              daysNeedingReview,
              // Stack minutes earn only the uplift in the regular engine; the five-bucket
              // contractor grid has no stack column, so they're surfaced here for audit.
              nightStackMinutesNotBilled: days.reduce((s, d) => s + d.nightStackMinutes, 0),
            },
          }),
        ),
      },
    });

    return { ok: true, data: { grossPay, daysNeedingReview } };
  } catch (error) {
    console.error("syncContractorEntryFromTimeClock failed", error);
    return { ok: false, code: "ERROR" };
  }
}

export async function lockContractorPayrollPeriod(params: {
  companyId: string;
  periodId: string;
  actorUserId: string;
}): Promise<ContractorServiceResult<undefined>> {
  try {
    const { period } = await loadEditablePeriod(params.companyId, params.periodId);
    if (!period) return { ok: false, code: "NOT_FOUND" };
    if (period.status !== "DRAFT") return { ok: false, code: "NOT_EDITABLE" };
    await prisma.contractorPayrollPeriod.update({
      where: { id: period.id },
      data: { status: "LOCKED", lockedAt: new Date(), lockedById: params.actorUserId },
    });
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("lockContractorPayrollPeriod failed", error);
    return { ok: false, code: "ERROR" };
  }
}

export async function reopenContractorPayrollPeriod(params: {
  companyId: string;
  periodId: string;
}): Promise<ContractorServiceResult<undefined>> {
  try {
    const period = await prisma.contractorPayrollPeriod.findFirst({
      where: { id: params.periodId, companyId: params.companyId },
      select: { id: true, status: true },
    });
    if (!period) return { ok: false, code: "NOT_FOUND" };
    if (period.status !== "LOCKED") return { ok: false, code: "NOT_EDITABLE" };
    await prisma.contractorPayrollPeriod.update({
      where: { id: period.id },
      data: { status: "DRAFT", lockedAt: null, lockedById: null },
    });
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("reopenContractorPayrollPeriod failed", error);
    return { ok: false, code: "ERROR" };
  }
}
