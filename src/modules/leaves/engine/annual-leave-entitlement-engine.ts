import { Decimal } from "decimal.js";
import type { AnnualLeaveAccrualMode, AnnualLeaveRoundingMode } from "@prisma/client";
import {
  KOSOVO_STATUTORY_MIN_MONTHLY_ACCRUAL_DAYS,
} from "@/modules/leaves/constants/kosovo-law";
import { accruedYtdLinearMonths } from "@/modules/leaves/engine/accrual-models";
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

function computeAccruedDaysToDate(input: CalculateAnnualLeaveEntitlementInput, yearlyEntitlementDays: number): number {
  if (input.ledgerAccruedYtd > 0) {
    return Math.min(input.ledgerAccruedYtd, yearlyEntitlementDays);
  }

  const gateMonths = Math.max(1, input.firstYearGateMonths);
  const underGate = input.uninterruptedMonths < gateMonths;
  const monthlyRate = Math.max(
    input.monthlyAccrualDays,
    KOSOVO_STATUTORY_MIN_MONTHLY_ACCRUAL_DAYS,
  );

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

  if (input.accrualMode === "STATUTORY_FIRST_YEAR" && underGate) {
    const statutory = monthlyRate * Math.max(0, input.monthsWorkedInYear);
    const gated = applyFirstYearGateClamp({
      fullAnnualQuota: yearlyEntitlementDays,
      uninterruptedMonths: input.uninterruptedMonths,
      gateMonths,
    });
    return Math.max(statutory, Math.min(gated, yearlyEntitlementDays));
  }

  return accruedYtdLinearMonths({
    monthsWorkedInYear: input.monthsWorkedInYear,
    monthlyRate,
    capAtAnnualEntitlement: yearlyEntitlementDays,
  });
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
    computeAccruedDaysToDate(input, yearlyEntitlementDays),
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
  const remainingYearlyDays = roundLeaveDays(
    activeCarry + yearlyEntitlementDays - usedApprovedDays,
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
