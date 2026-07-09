import { Decimal } from "decimal.js";
import type { AnnualLeaveAccrualMode, AnnualLeaveRoundingMode } from "@prisma/client";
import {
  applyFirstYearGateClamp,
  composeAnnualWorkingDayQuota,
} from "@/modules/leaves/engine/kosovo-annual-quota";
import { annualSplitLeaveCompliant } from "@/modules/leaves/engine/split-leave-analyzer";
import { LeaveValidationCode } from "@/modules/leaves/engine/validation-result";

export interface AnnualLeaveEntitlementWarning {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AnnualLeaveEntitlementResult {
  baseAnnualDays: number;
  experienceExtraDays: number;
  protectedCategoryExtraDays: number;
  hazardousWorkMinimumApplied: boolean;
  yearlyEntitlementDays: number;
  accruedDaysToDate: number;
  accruedDaysToYearEnd: number;
  usedApprovedDays: number;
  pendingRequestedDays: number;
  carriedOverFromPreviousYear: number;
  carryOverExpiresAt: Date | null;
  remainingAccruedDays: number;
  remainingYearlyDays: number;
  warnings: AnnualLeaveEntitlementWarning[];
  breakdown: Record<string, unknown>;
}

export interface CalculateAnnualLeaveEntitlementInput {
  workingDaysPerWeek: number;
  companyAnnualDefault: number | null;
  policyMinimum: number;
  hazardousMinimum: number;
  tenureEveryYears: number;
  tenureDaysPerBlock: number;
  specialCategoryExtraDays: number;
  firstYearGateMonths: number;
  monthlyAccrualDays: number;
  carryOverExpiryMonth: number;
  carryOverExpiryDay: number;
  splitLeaveMinWorkingDays: number;
  enableTenureBonus: boolean;
  enableSpecialCategoryExtra: boolean;
  accrualMode: AnnualLeaveAccrualMode;
  roundingMode: AnnualLeaveRoundingMode;
  uninterruptedMonths: number;
  fullYearsOfService: number;
  monthsWorkedInYear: number;
  /** Fraction of the year served up to the calculation date (0..1). Preferred day-level basis. */
  servedFractionToDate?: number;
  /** Fraction of the year that will be served by year-end (0..1), for the projection. */
  servedFractionToYearEnd?: number;
  isHazardous: boolean;
  eligibleSpecialCategories: boolean;
  calculationDate: Date;
  usedApprovedDays: number;
  pendingRequestedDays: number;
  carriedOverFromPreviousYear: number;
  carryOverExpiresAt: Date | null;
  ledgerAccruedYtd: number;
  approvedAnnualSegmentWorkingDays: number[];
  hasMedicalOverlapAudit: boolean;
}

function roundLeaveDays(value: number, mode: AnnualLeaveRoundingMode): number {
  switch (mode) {
    case "HALF_DAY":
      return new Decimal(value).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
    case "FULL_DAY":
      return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    default:
      return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  }
}

function effectiveCarryOver(
  carriedOver: number,
  carryExpiresAt: Date | null,
  calculationDate: Date,
): number {
  if (carriedOver <= 0) return 0;
  if (carryExpiresAt && carryExpiresAt.getTime() < calculationDate.getTime()) return 0;
  return carriedOver;
}

/**
 * Deterministic, entitlement-scaled accrual to a given fraction of the year.
 * Independent of whether the (unscheduled) monthly accrual ledger was posted — the
 * flat 1.6667/month ledger is intentionally NOT consulted here, since it ignores the
 * employee's real entitlement (tenure / special / hazardous) and disagrees with the
 * fallback for mid-month hires. Rate is entitlement/12, not a flat company default.
 */
function accrueEntitlementToFraction(
  input: CalculateAnnualLeaveEntitlementInput,
  yearlyEntitlementDays: number,
  yearFraction: number,
): number {
  const gateMonths = Math.max(1, input.firstYearGateMonths);
  const underGate = input.uninterruptedMonths < gateMonths;

  if (input.accrualMode === "UPFRONT") {
    if (underGate) {
      return applyFirstYearGateClamp({
        fullAnnualQuota: yearlyEntitlementDays,
        uninterruptedMonths: input.uninterruptedMonths,
        gateMonths,
      });
    }
    return yearlyEntitlementDays;
  }

  // Prefer true day-level proration (servedFractionToDate); fall back to
  // completed-months/12 when the caller did not supply a fraction (unit tests).
  const fraction =
    yearFraction >= 0
      ? Math.max(0, Math.min(1, yearFraction))
      : Math.max(0, Math.min(1, input.monthsWorkedInYear / 12));
  const prorated = yearlyEntitlementDays * fraction;

  if (input.accrualMode === "STATUTORY_FIRST_YEAR" && underGate) {
    const gated = applyFirstYearGateClamp({
      fullAnnualQuota: yearlyEntitlementDays,
      uninterruptedMonths: input.uninterruptedMonths,
      gateMonths,
    });
    return Math.max(prorated, Math.min(gated, yearlyEntitlementDays));
  }

  return Math.min(yearlyEntitlementDays, prorated);
}

export function calculateAnnualLeaveEntitlement(
  input: CalculateAnnualLeaveEntitlementInput,
): AnnualLeaveEntitlementResult {
  const composed = composeAnnualWorkingDayQuota({
    workingDaysPerWeek: input.workingDaysPerWeek,
    policyMinimum: input.policyMinimum,
    companyAnnualDefault: input.companyAnnualDefault,
    isHazardous: input.isHazardous,
    hazardousMinimum: input.hazardousMinimum,
    fullYearsOfService: input.fullYearsOfService,
    tenureEveryYears: input.tenureEveryYears,
    tenureDaysPerBlock: input.tenureDaysPerBlock,
    enableTenure: input.enableTenureBonus,
    specialExtraDays: input.specialCategoryExtraDays,
    enableSpecialCategoryExtra: input.enableSpecialCategoryExtra,
    eligibleSpecialCategories: input.eligibleSpecialCategories,
  });

  const baseAnnualDays = composed.breakdown.baseMinimum;
  const experienceExtraDays = composed.breakdown.tenureBonus;
  const protectedCategoryExtraDays = composed.breakdown.specialCategoryExtra;
  const hazardousWorkMinimumApplied =
    input.isHazardous && composed.breakdown.afterHazardousBase >= input.hazardousMinimum;

  const yearlyEntitlementDays = roundLeaveDays(composed.total, input.roundingMode);
  const accruedDaysToDate = roundLeaveDays(
    accrueEntitlementToFraction(input, yearlyEntitlementDays, input.servedFractionToDate ?? -1),
    input.roundingMode,
  );
  const accruedDaysToYearEnd = roundLeaveDays(
    accrueEntitlementToFraction(input, yearlyEntitlementDays, input.servedFractionToYearEnd ?? -1),
    input.roundingMode,
  );

  const activeCarry = roundLeaveDays(
    effectiveCarryOver(
      input.carriedOverFromPreviousYear,
      input.carryOverExpiresAt,
      input.calculationDate,
    ),
    input.roundingMode,
  );

  const usedApprovedDays = roundLeaveDays(input.usedApprovedDays, input.roundingMode);
  const pendingRequestedDays = roundLeaveDays(input.pendingRequestedDays, input.roundingMode);

  const remainingAccruedDays = roundLeaveDays(
    activeCarry + accruedDaysToDate - usedApprovedDays,
    input.roundingMode,
  );
  // Projected by year-end uses accrual-through-year-end (prorated for mid-year
  // hires), not the full theoretical entitlement.
  const remainingYearlyDays = roundLeaveDays(
    activeCarry + accruedDaysToYearEnd - usedApprovedDays,
    input.roundingMode,
  );

  const warnings: AnnualLeaveEntitlementWarning[] = [];

  if (input.uninterruptedMonths < input.firstYearGateMonths) {
    warnings.push({
      code: LeaveValidationCode.FIRST_YEAR_ENTITLEMENT_WARN,
      message: "Punonjësi ende nuk ka fituar të drejtën e plotë për shfrytëzim të pushimit vjetor.",
      metadata: {
        uninterruptedMonths: input.uninterruptedMonths,
        gateMonths: input.firstYearGateMonths,
      },
    });
  }

  if (pendingRequestedDays > remainingAccruedDays + 1e-9) {
    warnings.push({
      code: LeaveValidationCode.INSUFFICIENT_BALANCE_WARN,
      message: "Kërkesa tejkalon bilancin e akumuluar.",
      metadata: { pendingRequestedDays, remainingAccruedDays },
    });
  }

  if (
    input.carriedOverFromPreviousYear > 0 &&
    input.carryOverExpiresAt &&
    input.carryOverExpiresAt.getTime() >= input.calculationDate.getTime()
  ) {
    const daysUntilExpiry = Math.ceil(
      (input.carryOverExpiresAt.getTime() - input.calculationDate.getTime()) / 86400000,
    );
    if (daysUntilExpiry <= 45) {
      warnings.push({
        code: LeaveValidationCode.CARRY_EXPIRE_WARN,
        message: "Ditët e bartura skadojnë më 30 qershor.",
        metadata: {
          carryOverExpiresAt: input.carryOverExpiresAt.toISOString(),
          daysUntilExpiry,
        },
      });
    }
  } else if (
    input.carriedOverFromPreviousYear > 0 &&
    input.carryOverExpiresAt &&
    input.carryOverExpiresAt.getTime() < input.calculationDate.getTime()
  ) {
    warnings.push({
      code: LeaveValidationCode.CARRY_EXPIRE_WARN,
      message: "Ditët e bartura kanë kaluar afatin ligjor të përdorimit (30 qershor).",
      metadata: { carryOverExpiresAt: input.carryOverExpiresAt.toISOString() },
    });
  }

  if (
    input.approvedAnnualSegmentWorkingDays.length > 0 &&
    !annualSplitLeaveCompliant(input.approvedAnnualSegmentWorkingDays, input.splitLeaveMinWorkingDays)
  ) {
    warnings.push({
      code: LeaveValidationCode.SPLIT_LEAVE_WARN,
      message: "Pjesa kryesore e pushimit vjetor duhet të jetë së paku 10 ditë pune të pandërprera.",
      metadata: {
        segments: input.approvedAnnualSegmentWorkingDays,
        min: input.splitLeaveMinWorkingDays,
      },
    });
  }

  if (input.hasMedicalOverlapAudit) {
    warnings.push({
      code: "KOSOVO_ANNUAL_MEDICAL_OVERLAP",
      message:
        "Pushimi mjekësor i aprovuar gjatë pushimit vjetor nuk zbritet nga bilanci i pushimit vjetor.",
    });
  }

  return {
    baseAnnualDays,
    experienceExtraDays,
    protectedCategoryExtraDays,
    hazardousWorkMinimumApplied,
    yearlyEntitlementDays,
    accruedDaysToDate,
    accruedDaysToYearEnd,
    usedApprovedDays,
    pendingRequestedDays,
    carriedOverFromPreviousYear: activeCarry,
    carryOverExpiresAt: input.carryOverExpiresAt,
    remainingAccruedDays,
    remainingYearlyDays,
    warnings,
    breakdown: {
      composedQuotaBreakdown: composed.breakdown,
      accrualMode: input.accrualMode,
      roundingMode: input.roundingMode,
      uninterruptedMonths: input.uninterruptedMonths,
      monthsWorkedInYear: input.monthsWorkedInYear,
      activeCarry,
      ledgerAccruedYtd: input.ledgerAccruedYtd,
    },
  };
}
