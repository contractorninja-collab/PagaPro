import { Prisma } from "@prisma/client";
import type { LeaveType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KOSOVO_REGULAR_MEDICAL_LEAVE_WORKING_DAYS } from "@/modules/leaves/constants/kosovo-law";
import { LEAVE_ENGINE_RULE_VERSION } from "@/modules/leaves/constants/rule-versions";
import { calculateAnnualLeaveEntitlement } from "@/modules/leaves/engine/annual-leave-entitlement-engine";
import { carryOverExpiryUtcEndOfDay } from "@/modules/leaves/engine/carry-over";
import { fullYearsOfServiceUtc } from "@/modules/leaves/engine/kosovo-annual-quota";
import { isOccupationalMedicalLeave, leaveTypesWithBalance } from "@/modules/leaves/helpers/leave-type-metadata";
import { computeLeaveMetrics } from "@/modules/leaves/services/leave-calculation-service";
import { resolveLeavePolicyParameterSet } from "@/modules/leaves/services/leave-policy-service";
import { uninterruptedCalendarMonthsUtc } from "@/modules/leaves/services/leave-tenure-service";

export function resolveMedicalLeaveYearlyQuota(
  medicalLeaveDaysDefault: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  if (medicalLeaveDaysDefault != null) {
    return medicalLeaveDaysDefault;
  }
  return new Prisma.Decimal(KOSOVO_REGULAR_MEDICAL_LEAVE_WORKING_DAYS);
}

function resolveWorkingDaysPerWeek(cfg: { workingDaysPerWeek: Prisma.Decimal | null } | null): number {
  const n = cfg?.workingDaysPerWeek?.toNumber();
  return n != null && n > 0 ? n : 5;
}

function quotaForNonAnnualType(
  type: LeaveType,
  annual: Prisma.Decimal | null | undefined,
  personal: Prisma.Decimal | null | undefined,
  medical: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  const dPersonal = personal ?? new Prisma.Decimal(5);
  switch (type) {
    case "PUSHIM_PERSONAL":
      return dPersonal;
    case "PUSHIM_MJEKESOR":
      return resolveMedicalLeaveYearlyQuota(medical);
    default:
      return new Prisma.Decimal(0);
  }
}

function clipRangeToYear(start: Date, end: Date, yearStart: Date, yearEnd: Date) {
  const rs = start > yearStart ? start : yearStart;
  const re = end < yearEnd ? end : yearEnd;
  return rs <= re ? { rs, re } : null;
}

async function sumApprovedWorkingDaysForTypeInYear(
  companyId: string,
  employeeId: string,
  leaveType: LeaveType,
  year: number,
): Promise<Prisma.Decimal> {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const reqs = await prisma.leaveRequest.findMany({
    where: {
      companyId,
      employeeId,
      type: leaveType,
      status: "APPROVED",
      affectsPayroll: true,
      AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }],
    },
    select: {
      startDate: true,
      endDate: true,
      subtype: true,
      metricsRuleVersion: true,
    },
  });

  let total = new Prisma.Decimal(0);
  for (const r of reqs) {
    if (leaveType === "PUSHIM_MJEKESOR" && isOccupationalMedicalLeave(r.subtype)) {
      continue;
    }
    const clip = clipRangeToYear(r.startDate, r.endDate, yearStart, yearEnd);
    if (!clip) continue;
    const part = await computeLeaveMetrics(companyId, clip.rs, clip.re, r.metricsRuleVersion);
    total = total.add(new Prisma.Decimal(part.workingDays));
  }

  return total;
}

async function sumNetAnnualUsedDays(
  companyId: string,
  employeeId: string,
  year: number,
): Promise<{ usedDays: number; hasMedicalOverlap: boolean; segments: number[] }> {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const [annualReqs, medicalReqs] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        companyId,
        employeeId,
        type: "PUSHIM_VJETOR",
        status: "APPROVED",
        affectsPayroll: true,
        AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }],
      },
      select: { startDate: true, endDate: true, workingDays: true, metricsRuleVersion: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        companyId,
        employeeId,
        type: "PUSHIM_MJEKESOR",
        status: "APPROVED",
        affectsPayroll: true,
        subtype: { not: "LENDIM_PUNE_OSE_SEMUNDJE_PROFESIONALE" },
        AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }],
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  let total = 0;
  let hasMedicalOverlap = false;
  const segments: number[] = [];

  for (const annual of annualReqs) {
    const clip = clipRangeToYear(annual.startDate, annual.endDate, yearStart, yearEnd);
    if (!clip) continue;

    const grossMetrics = await computeLeaveMetrics(
      companyId,
      clip.rs,
      clip.re,
      annual.metricsRuleVersion,
    );
    let overlapDays = 0;

    for (const medical of medicalReqs) {
      const overlapStart = new Date(
        Math.max(clip.rs.getTime(), medical.startDate.getTime(), yearStart.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(clip.re.getTime(), medical.endDate.getTime(), yearEnd.getTime()),
      );
      if (overlapStart > overlapEnd) continue;
      const overlapMetrics = await computeLeaveMetrics(
        companyId,
        overlapStart,
        overlapEnd,
        annual.metricsRuleVersion,
      );
      overlapDays += overlapMetrics.workingDays;
      hasMedicalOverlap = true;
    }

    const netSegment = Math.max(0, grossMetrics.workingDays - overlapDays);
    total += netSegment;
    if (netSegment > 0) segments.push(netSegment);
  }

  return { usedDays: total, hasMedicalOverlap, segments };
}

async function sumPendingAnnualDays(companyId: string, employeeId: string, year: number): Promise<number> {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const pending = await prisma.leaveRequest.findMany({
    where: {
      companyId,
      employeeId,
      type: "PUSHIM_VJETOR",
      status: "PENDING",
      AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }],
    },
    select: { workingDays: true, startDate: true, endDate: true, metricsRuleVersion: true },
  });

  let total = 0;
  for (const row of pending) {
    if (row.workingDays != null) {
      total += row.workingDays.toNumber();
      continue;
    }
    const clip = clipRangeToYear(row.startDate, row.endDate, yearStart, yearEnd);
    if (!clip) continue;
    const metrics = await computeLeaveMetrics(companyId, clip.rs, clip.re, row.metricsRuleVersion);
    total += metrics.workingDays;
  }
  return total;
}

async function sumLedgerAccrualForAnnualYear(
  companyId: string,
  employeeId: string,
  year: number,
): Promise<number> {
  const agg = await prisma.leaveAccrualLedger.aggregate({
    where: { companyId, employeeId, periodYear: year },
    _sum: { accruedDays: true },
  });
  return agg._sum.accruedDays?.toNumber() ?? 0;
}

export async function syncLeaveBalancesForEmployeeYear(
  companyId: string,
  employeeId: string,
  year: number,
): Promise<void> {
  const cfg = await prisma.companyConfiguration.findUnique({ where: { companyId } });
  const annualCfg = cfg?.annualLeaveDaysDefault;
  const personal = cfg?.personalLeaveDaysDefault;
  const medical = cfg?.medicalLeaveDaysDefault;
  const workingDaysPerWeek = resolveWorkingDaysPerWeek(cfg);

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: {
      hireDate: true,
      leaveTenureAnchorDate: true,
      terminationDate: true,
      isHazardousPosition: true,
      isSingleParent: true,
      hasDisability: true,
      hasChildUnderThree: true,
    },
  });
  if (!employee) return;

  const calculationDate = new Date();
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const policy = await resolveLeavePolicyParameterSet(companyId, yearEnd);

  const serviceAnchor = employee.leaveTenureAnchorDate ?? employee.hireDate;
  const clipEnd =
    employee.terminationDate && employee.terminationDate.getTime() < yearEnd.getTime()
      ? employee.terminationDate
      : yearEnd;
  const uninterruptedMonths = uninterruptedCalendarMonthsUtc(serviceAnchor, clipEnd);
  const fullYears = fullYearsOfServiceUtc(serviceAnchor, clipEnd);

  // Day-level service fractions of the calendar year — the deterministic basis for
  // entitlement-scaled accrual ("to date" = available now, "to year-end" = projection).
  const DAY_MS = 86400000;
  const yearStartMs = Date.UTC(year, 0, 1);
  const yearDays = Math.round((Date.UTC(year + 1, 0, 1) - yearStartMs) / DAY_MS);
  const dayIdx = (ms: number): number => Math.floor((ms - yearStartMs) / DAY_MS);
  const startIdx = Math.min(yearDays, Math.max(0, dayIdx(serviceAnchor.getTime())));
  const termClipMs =
    employee.terminationDate && employee.terminationDate.getTime() < yearEnd.getTime()
      ? employee.terminationDate.getTime()
      : yearEnd.getTime();
  const servedDaysUntil = (endMs: number): number => {
    const endIdx = Math.min(yearDays - 1, dayIdx(Math.min(endMs, yearEnd.getTime())));
    return endIdx >= startIdx ? endIdx - startIdx + 1 : 0;
  };
  const servedFractionToDate = Math.max(
    0,
    Math.min(1, servedDaysUntil(Math.min(calculationDate.getTime(), termClipMs)) / yearDays),
  );
  const servedFractionToYearEnd = Math.max(
    0,
    Math.min(1, servedDaysUntil(termClipMs) / yearDays),
  );

  const eligibleSpecial =
    employee.isSingleParent || employee.hasDisability || employee.hasChildUnderThree;

  const types = leaveTypesWithBalance();

  let prevAnnualRemaining = 0;
  if (year > 1971) {
    const prev = await prisma.leaveBalance.findUnique({
      where: {
        companyId_employeeId_leaveType_year: {
          companyId,
          employeeId,
          leaveType: "PUSHIM_VJETOR",
          year: year - 1,
        },
      },
      select: { remainingDays: true, carryOverDays: true },
    });
    if (prev) {
      // Carry only the prior year's OWN unused entitlement (remaining minus the carry
      // it itself received) so annual balances cannot compound across years — the
      // carried-in portion expires June 30 and must not roll forward again.
      prevAnnualRemaining = Math.max(
        0,
        prev.remainingDays.toNumber() - prev.carryOverDays.toNumber(),
      );
    }
  }

  const carryExpiresAt =
    prevAnnualRemaining > 0
      ? carryOverExpiryUtcEndOfDay({
          originYear: year - 1,
          expiryMonth: policy.carryOverExpiryMonth,
          expiryDay: policy.carryOverExpiryDay,
        })
      : null;

  for (const lt of types) {
    if (lt === "PUSHIM_VJETOR") {
      const yearStartClip =
        serviceAnchor > new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
          ? serviceAnchor
          : new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const endClip = clipEnd < yearEnd ? clipEnd : yearEnd;
      const monthsWorked = uninterruptedCalendarMonthsUtc(yearStartClip, endClip) || 0;

      const [{ usedDays, hasMedicalOverlap, segments }, pendingDays, ledgerSum] = await Promise.all([
        sumNetAnnualUsedDays(companyId, employeeId, year),
        sumPendingAnnualDays(companyId, employeeId, year),
        sumLedgerAccrualForAnnualYear(companyId, employeeId, year),
      ]);

      const entitlement = calculateAnnualLeaveEntitlement({
        workingDaysPerWeek,
        companyAnnualDefault: annualCfg?.toNumber() ?? null,
        policyMinimum: policy.minimumAnnualWorkingDays.toNumber(),
        hazardousMinimum: policy.hazardousMinimumWorkingDays.toNumber(),
        tenureEveryYears: policy.tenureBonusEveryYears,
        tenureDaysPerBlock: policy.tenureBonusDaysPerBlock.toNumber(),
        specialCategoryExtraDays: policy.specialCategoryExtraDays.toNumber(),
        firstYearGateMonths: policy.firstYearGateMonths,
        monthlyAccrualDays: policy.monthlyAccrualDays.toNumber(),
        carryOverExpiryMonth: policy.carryOverExpiryMonth,
        carryOverExpiryDay: policy.carryOverExpiryDay,
        splitLeaveMinWorkingDays: policy.splitLeaveMinWorkingDays,
        enableTenureBonus: policy.enableTenureBonus,
        enableSpecialCategoryExtra: policy.enableSpecialCategoryExtra,
        accrualMode: cfg?.annualLeaveAccrualMode ?? "MONTHLY",
        roundingMode: cfg?.annualLeaveRoundingMode ?? "NONE",
        uninterruptedMonths,
        fullYearsOfService: fullYears,
        monthsWorkedInYear: monthsWorked,
        servedFractionToDate,
        servedFractionToYearEnd,
        isHazardous: employee.isHazardousPosition,
        eligibleSpecialCategories: eligibleSpecial,
        calculationDate,
        usedApprovedDays: usedDays,
        pendingRequestedDays: pendingDays,
        carriedOverFromPreviousYear: prevAnnualRemaining,
        carryOverExpiresAt: carryExpiresAt,
        ledgerAccruedYtd: ledgerSum,
        approvedAnnualSegmentWorkingDays: segments,
        hasMedicalOverlapAudit: hasMedicalOverlap,
      });

      const yearlyQuota = new Prisma.Decimal(entitlement.yearlyEntitlementDays);
      const used = new Prisma.Decimal(entitlement.usedApprovedDays);
      const pending = new Prisma.Decimal(entitlement.pendingRequestedDays);
      const carry = new Prisma.Decimal(entitlement.carriedOverFromPreviousYear);
      const remaining = new Prisma.Decimal(entitlement.remainingAccruedDays);

      const breakdown = {
        ruleVersion: LEAVE_ENGINE_RULE_VERSION,
        entitlement: {
          ...entitlement,
          carryOverExpiresAt: entitlement.carryOverExpiresAt?.toISOString() ?? null,
        },
      };

      await prisma.leaveBalance.upsert({
        where: {
          companyId_employeeId_leaveType_year: {
            companyId,
            employeeId,
            leaveType: lt,
            year,
          },
        },
        create: {
          companyId,
          employeeId,
          leaveType: lt,
          year,
          yearlyQuota,
          usedDays: used,
          pendingDays: pending,
          remainingDays: remaining,
          carryOverDays: carry,
          accruedYtd: new Prisma.Decimal(entitlement.accruedDaysToDate),
          entitlementFullYear: yearlyQuota,
          carryIn: carry,
          carryExpiresAt: entitlement.carriedOverFromPreviousYear > 0 ? carryExpiresAt : null,
          computedFromRuleVersion: LEAVE_ENGINE_RULE_VERSION,
          breakdown: breakdown as unknown as Prisma.InputJsonValue,
        },
        update: {
          yearlyQuota,
          usedDays: used,
          pendingDays: pending,
          remainingDays: remaining,
          carryOverDays: carry,
          accruedYtd: new Prisma.Decimal(entitlement.accruedDaysToDate),
          entitlementFullYear: yearlyQuota,
          carryIn: carry,
          carryExpiresAt: entitlement.carriedOverFromPreviousYear > 0 ? carryExpiresAt : null,
          computedFromRuleVersion: LEAVE_ENGINE_RULE_VERSION,
          breakdown: breakdown as unknown as Prisma.InputJsonValue,
        },
      });
      continue;
    }

    const yearlyQuota = quotaForNonAnnualType(lt, annualCfg, personal, medical);
    const usedDays = await sumApprovedWorkingDaysForTypeInYear(companyId, employeeId, lt, year);
    const remaining = yearlyQuota.sub(usedDays);

    await prisma.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveType_year: {
          companyId,
          employeeId,
          leaveType: lt,
          year,
        },
      },
      create: {
        companyId,
        employeeId,
        leaveType: lt,
        year,
        yearlyQuota,
        usedDays,
        pendingDays: new Prisma.Decimal(0),
        remainingDays: remaining,
        carryOverDays: new Prisma.Decimal(0),
        accruedYtd: new Prisma.Decimal(0),
        entitlementFullYear: null,
        carryIn: new Prisma.Decimal(0),
        carryExpiresAt: null,
        computedFromRuleVersion: null,
        breakdown: Prisma.JsonNull,
      },
      update: {
        yearlyQuota,
        usedDays,
        pendingDays: new Prisma.Decimal(0),
        remainingDays: remaining,
        carryOverDays: new Prisma.Decimal(0),
        accruedYtd: new Prisma.Decimal(0),
        entitlementFullYear: null,
        carryIn: new Prisma.Decimal(0),
        carryExpiresAt: null,
        computedFromRuleVersion: null,
        breakdown: Prisma.JsonNull,
      },
    });
  }
}

export async function syncLeaveBalancesForCompanyYear(companyId: string, year: number): Promise<number> {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: { id: true },
  });
  for (const employee of employees) {
    await syncLeaveBalancesForEmployeeYear(companyId, employee.id, year);
  }
  return employees.length;
}

export async function listLeaveBalancesForEmployee(companyId: string, employeeId: string, year: number) {
  await syncLeaveBalancesForEmployeeYear(companyId, employeeId, year);
  return prisma.leaveBalance.findMany({
    where: { companyId, employeeId, year },
    orderBy: { leaveType: "asc" },
  });
}
