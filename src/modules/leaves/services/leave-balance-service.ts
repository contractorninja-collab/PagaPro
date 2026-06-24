import { Prisma } from "@prisma/client";
import type { LeaveType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEAVE_ENGINE_RULE_VERSION } from "@/modules/leaves/constants/rule-versions";
import { leaveTypesWithBalance } from "@/modules/leaves/helpers/leave-type-metadata";
import { accruedYtdLinearMonths } from "@/modules/leaves/engine/accrual-models";
import {
  applyFirstYearGateClamp,
  composeAnnualWorkingDayQuota,
  fullYearsOfServiceUtc,
} from "@/modules/leaves/engine/kosovo-annual-quota";
import { carryOverExpiryUtcEndOfDay } from "@/modules/leaves/engine/carry-over";
import { computeLeaveMetrics } from "@/modules/leaves/services/leave-calculation-service";
import { resolveLeavePolicyParameterSet } from "@/modules/leaves/services/leave-policy-service";
import { uninterruptedCalendarMonthsUtc } from "@/modules/leaves/services/leave-tenure-service";

function quotaForNonAnnualType(
  type: LeaveType,
  annual: Prisma.Decimal | null | undefined,
  personal: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  const dAnnual = annual ?? new Prisma.Decimal(20);
  const dPersonal = personal ?? new Prisma.Decimal(5);
  const sickDefault = new Prisma.Decimal(40);
  switch (type) {
    case "PUSHIM_VJETOR":
      return dAnnual;
    case "PUSHIM_PERSONAL":
      return dPersonal;
    case "PUSHIM_MJEKESOR":
      return sickDefault;
    default:
      return new Prisma.Decimal(0);
  }
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
    },
  });

  let total = new Prisma.Decimal(0);
  for (const r of reqs) {
    const rs = r.startDate > yearStart ? r.startDate : yearStart;
    const re = r.endDate < yearEnd ? r.endDate : yearEnd;
    if (rs > re) continue;
    const part = await computeLeaveMetrics(companyId, rs, re);
    total = total.add(new Prisma.Decimal(part.workingDays));
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

  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const policy = await resolveLeavePolicyParameterSet(companyId, yearEnd);

  const serviceAnchor = employee.leaveTenureAnchorDate ?? employee.hireDate;
  const clipEnd =
    employee.terminationDate && employee.terminationDate.getTime() < yearEnd.getTime()
      ? employee.terminationDate
      : yearEnd;
  const uninterruptedMonths = uninterruptedCalendarMonthsUtc(serviceAnchor, clipEnd);
  const fullYears = fullYearsOfServiceUtc(serviceAnchor, clipEnd);

  const eligibleSpecial =
    employee.isSingleParent || employee.hasDisability || employee.hasChildUnderThree;

  const types = leaveTypesWithBalance();

  let prevAnnualRemaining = new Prisma.Decimal(0);
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
      select: { remainingDays: true },
    });
    if (prev) prevAnnualRemaining = prev.remainingDays;
  }

  for (const lt of types) {
    let yearlyQuota: Prisma.Decimal;
    let usedDays: Prisma.Decimal;
    let carry = new Prisma.Decimal(0);
    let entitlementFullYearNum: number | null = null;
    let accruedYtdNum = 0;
    let carryExpiresAt: Date | null = null;
    let breakdown: Record<string, unknown> | undefined;

    if (lt === "PUSHIM_VJETOR") {
      const { total: composedQuota, breakdown: composedBreakdown } = composeAnnualWorkingDayQuota({
        policyMinimum: policy.minimumAnnualWorkingDays.toNumber(),
        companyAnnualDefault: annualCfg?.toNumber() ?? null,
        isHazardous: employee.isHazardousPosition,
        hazardousMinimum: policy.hazardousMinimumWorkingDays.toNumber(),
        fullYearsOfService: fullYears,
        tenureEveryYears: policy.tenureBonusEveryYears,
        tenureDaysPerBlock: policy.tenureBonusDaysPerBlock.toNumber(),
        enableTenure: policy.enableTenureBonus,
        specialExtraDays: policy.specialCategoryExtraDays.toNumber(),
        enableSpecialCategoryExtra: policy.enableSpecialCategoryExtra,
        eligibleSpecialCategories: eligibleSpecial,
      });

      const entitlementWorkingDays = applyFirstYearGateClamp({
        fullAnnualQuota: composedQuota,
        uninterruptedMonths,
        gateMonths: policy.firstYearGateMonths,
      });

      entitlementFullYearNum = entitlementWorkingDays;
      yearlyQuota = new Prisma.Decimal(entitlementWorkingDays);

      carry = Prisma.Decimal.max(prevAnnualRemaining, 0);
      carryExpiresAt = carry.gt(0)
        ? carryOverExpiryUtcEndOfDay({
            originYear: year - 1,
            expiryMonth: policy.carryOverExpiryMonth,
            expiryDay: policy.carryOverExpiryDay,
          })
        : null;

      usedDays = await sumApprovedWorkingDaysForTypeInYear(companyId, employeeId, lt, year);

      const ledgerSum = await sumLedgerAccrualForAnnualYear(companyId, employeeId, year);
      const yearStartClip =
        serviceAnchor > new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
          ? serviceAnchor
          : new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const endClip =
        clipEnd < yearEnd ? clipEnd : yearEnd;
      const monthsWorked = uninterruptedCalendarMonthsUtc(yearStartClip, endClip) || 0;

      accruedYtdNum =
        ledgerSum > 0
          ? ledgerSum
          : accruedYtdLinearMonths({
              monthsWorkedInYear: monthsWorked,
              monthlyRate: policy.monthlyAccrualDays.toNumber(),
              capAtAnnualEntitlement: entitlementWorkingDays,
            });

      breakdown = {
        ruleVersion: LEAVE_ENGINE_RULE_VERSION,
        composedQuotaBreakdown: composedBreakdown,
        firstYearGate: {
          uninterruptedMonths,
          gateMonths: policy.firstYearGateMonths,
          entitlementAfterGate: entitlementWorkingDays,
        },
        carryIn: carry.toString(),
        accruedYtdSource: ledgerSum > 0 ? "ledger" : "synthetic_monthly_linear",
      };
    } else {
      yearlyQuota = quotaForNonAnnualType(lt, annualCfg, personal);
      usedDays = await sumApprovedWorkingDaysForTypeInYear(companyId, employeeId, lt, year);
    }

    const remaining = yearlyQuota.add(carry).sub(usedDays);

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
        remainingDays: remaining,
        carryOverDays: carry,
        accruedYtd: new Prisma.Decimal(lt === "PUSHIM_VJETOR" ? accruedYtdNum : 0),
        entitlementFullYear:
          lt === "PUSHIM_VJETOR" && entitlementFullYearNum != null
            ? new Prisma.Decimal(entitlementFullYearNum)
            : null,
        carryIn: lt === "PUSHIM_VJETOR" ? carry : new Prisma.Decimal(0),
        carryExpiresAt: lt === "PUSHIM_VJETOR" ? carryExpiresAt : null,
        computedFromRuleVersion: lt === "PUSHIM_VJETOR" ? LEAVE_ENGINE_RULE_VERSION : null,
        breakdown:
          lt === "PUSHIM_VJETOR" ? ((breakdown ?? null) as Prisma.InputJsonValue | undefined) : Prisma.JsonNull,
      },
      update: {
        yearlyQuota,
        usedDays,
        remainingDays: remaining,
        carryOverDays: carry,
        accruedYtd: new Prisma.Decimal(lt === "PUSHIM_VJETOR" ? accruedYtdNum : 0),
        entitlementFullYear:
          lt === "PUSHIM_VJETOR" && entitlementFullYearNum != null
            ? new Prisma.Decimal(entitlementFullYearNum)
            : null,
        carryIn: lt === "PUSHIM_VJETOR" ? carry : new Prisma.Decimal(0),
        carryExpiresAt: lt === "PUSHIM_VJETOR" ? carryExpiresAt : null,
        computedFromRuleVersion: lt === "PUSHIM_VJETOR" ? LEAVE_ENGINE_RULE_VERSION : null,
        breakdown:
          lt === "PUSHIM_VJETOR" ? ((breakdown ?? null) as Prisma.InputJsonValue | undefined) : Prisma.JsonNull,
      },
    });
  }
}

export async function listLeaveBalancesForEmployee(companyId: string, employeeId: string, year: number) {
  await syncLeaveBalancesForEmployeeYear(companyId, employeeId, year);
  return prisma.leaveBalance.findMany({
    where: { companyId, employeeId, year },
    orderBy: { leaveType: "asc" },
  });
}
