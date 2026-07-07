import { Decimal } from "decimal.js";

export interface AnnualQuotaBreakdown {
  baseMinimum: number;
  companyBump: number;
  hazardousFloor: number;
  afterHazardousBase: number;
  tenureBonus: number;
  specialCategoryExtra: number;
  totalBeforeFirstYearClamp: number;
}

export function deriveBaseAnnualDaysFromWorkweek(workingDaysPerWeek: number, policyMinimum = 0): number {
  const weekDays = workingDaysPerWeek > 0 ? workingDaysPerWeek : 5;
  const fromWorkweek = weekDays * 4;
  return Math.max(Math.max(0, policyMinimum), fromWorkweek);
}

/**
 * Compose Kosovo-aligned annual working-day quota (Arts 32, 32.3, 32.4 + tenure steps).
 * Base = max(policyMinimum, workingDaysPerWeek × 4). Values are working days (not calendar days).
 * Caller applies Art 35 first-year clamp separately.
 */
export function composeAnnualWorkingDayQuota(input: {
  /** Company working days per week (default 5 → 20 annual base). */
  workingDaysPerWeek: number;
  /** From LeavePolicyParameterSet.minimumAnnualWorkingDays — legal floor */
  policyMinimum: number;
  /** CompanyConfiguration.annualLeaveDaysDefault — optional uplift */
  companyAnnualDefault: number | null | undefined;
  isHazardous: boolean;
  /** From policy.hazardousMinimumWorkingDays */
  hazardousMinimum: number;
  fullYearsOfService: number;
  tenureEveryYears: number;
  tenureDaysPerBlock: number;
  enableTenure: boolean;
  specialExtraDays: number;
  enableSpecialCategoryExtra: boolean;
  eligibleSpecialCategories: boolean;
}): { total: number; breakdown: AnnualQuotaBreakdown } {
  const baseMinimum = deriveBaseAnnualDaysFromWorkweek(input.workingDaysPerWeek, Number(input.policyMinimum) || 0);
  const company = input.companyAnnualDefault != null ? Number(input.companyAnnualDefault) : NaN;
  const companyBump = Number.isFinite(company) ? Math.max(0, company - baseMinimum) : 0;
  const afterCompany = baseMinimum + Math.max(0, companyBump);

  const hazardousFloor = input.isHazardous ? Math.max(0, Number(input.hazardousMinimum) || 0) : afterCompany;
  const afterHazardousBase = input.isHazardous ? Math.max(afterCompany, hazardousFloor) : afterCompany;

  let tenureBonus = 0;
  if (input.enableTenure && input.tenureEveryYears > 0 && input.fullYearsOfService > 0) {
    const blocks = Math.floor(input.fullYearsOfService / input.tenureEveryYears);
    tenureBonus = blocks * Math.max(0, Number(input.tenureDaysPerBlock) || 0);
  }

  let specialCategoryExtra = 0;
  if (input.enableSpecialCategoryExtra && input.eligibleSpecialCategories) {
    specialCategoryExtra = Math.max(0, Number(input.specialExtraDays) || 0);
  }

  const totalBeforeFirstYearClamp = afterHazardousBase + tenureBonus + specialCategoryExtra;

  return {
    total: totalBeforeFirstYearClamp,
    breakdown: {
      baseMinimum,
      companyBump: Number.isFinite(company) ? Math.max(0, company - baseMinimum) : 0,
      hazardousFloor: input.isHazardous ? hazardousFloor : afterCompany,
      afterHazardousBase,
      tenureBonus,
      specialCategoryExtra,
      totalBeforeFirstYearClamp,
    },
  };
}

export function fullYearsOfServiceUtc(serviceAnchor: Date, asOfUtc: Date): number {
  let years = asOfUtc.getUTCFullYear() - serviceAnchor.getUTCFullYear();
  const mo = asOfUtc.getUTCMonth() - serviceAnchor.getUTCMonth();
  const da = asOfUtc.getUTCDate() - serviceAnchor.getUTCDate();
  if (mo < 0 || (mo === 0 && da < 0)) years--;
  return Math.max(0, years);
}

/** Proportional entitlement before uninterrupted gate months (Art 35), applied to already composed quota. */
export function applyFirstYearGateClamp(params: {
  fullAnnualQuota: number;
  uninterruptedMonths: number;
  gateMonths: number;
}): number {
  const gate = Math.max(1, params.gateMonths);
  const m = Math.max(0, Math.min(params.uninterruptedMonths, gate));
  if (params.uninterruptedMonths >= gate) return params.fullAnnualQuota;
  return new Decimal(params.fullAnnualQuota).mul(m).div(gate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}
