import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNs } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { KonfigurimePayloadValidated } from "@/modules/konfigurime/validation/konfigurime-schemas";
import { payrollAnchorDateUtc, type PayrollAnchorMode } from "@/modules/payroll/helpers/payroll-anchor";
import {
  mapPayrollParameterSetToLegislationSnapshot,
  type PayrollParameterSetRowInput,
  type PitBracketRowInput,
} from "@/modules/payroll/mappers/map-payroll-parameter-set";
import type { LegislationSnapshot, PremiumRules } from "@/modules/payroll/calculation/types";
import { maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty } from "@/modules/payroll/services/company-holiday-service";

const RULES_VERSION = "pagapro-payroll-settings+v1";

const BOOTSTRAP_HOURS_PER_WORKING_DAY = new PrismaNs.Decimal("8");
/** Weekly norm (full-time) before overtime — policy default aligned with Kosovo 40h week. */
const BOOTSTRAP_OVERTIME_WEEKLY_THRESHOLD_HOURS = new PrismaNs.Decimal("40");
/** Weekly overtime hours above which payroll transparency warns HR (default 8h). */
const BOOTSTRAP_OVERTIME_WEEKLY_WARNING_CAP_HOURS = new PrismaNs.Decimal("8");
const BOOTSTRAP_NIGHT_PERIOD_DESCRIPTION = "22:00 - 06:00";

function defaultJulyFirstUtc(referenceYear: number): Date {
  return new Date(Date.UTC(referenceYear, 6, 1, 0, 0, 0, 0));
}

export function resolveEffectiveMinimumMonthly(params: {
  anchorDateUtc: Date;
  baselineMinimum: string;
  scheduledMinimum?: string | null;
  scheduledEffectiveFromUtc?: Date | null;
}): string {
  const schedAmt = params.scheduledMinimum?.trim();
  const schedFrom = params.scheduledEffectiveFromUtc;
  if (schedAmt && schedFrom && params.anchorDateUtc.getTime() >= schedFrom.getTime()) {
    return schedAmt;
  }
  return params.baselineMinimum;
}

function premiumRulesFromMultipliers(params: {
  overtimeMultiplier: PrismaNs.Decimal;
  weekendMultiplier: PrismaNs.Decimal;
  holidayMultiplier: PrismaNs.Decimal;
  nightWorkMultiplier?: PrismaNs.Decimal;
}): PremiumRules {
  return {
    overtimeHourMultiplier: params.overtimeMultiplier.toString(),
    weekendHourMultiplier: params.weekendMultiplier.toString(),
    holidayHourMultiplier: params.holidayMultiplier.toString(),
    nightHourMultiplier: params.nightWorkMultiplier?.toString() ?? "1",
    stackPolicy: "additive",
  };
}

/** Upserts operational payroll settings from Konfigurime + active parameter set (transaction-safe). */
export async function syncPayrollSettingsFromKonfigurime(
  tx: Prisma.TransactionClient,
  companyId: string,
  payload: KonfigurimePayloadValidated,
): Promise<void> {
  const cfg = payload.configuration;
  const now = new Date();

  const active = await tx.payrollParameterSet.findFirst({
    where: {
      companyId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const minCurrent = cfg.minimumSalaryCurrent ?? "425";
  const minJuly = cfg.minimumSalaryFromJuly1 ?? "500";
  const standardWeekly = cfg.standardWeeklyHours ?? "40";

  let pensionEmp = new PrismaNs.Decimal("0.05");
  let pensionEr = new PrismaNs.Decimal("0.05");
  if (cfg.trustContributionPercent != null) {
    const rate = new PrismaNs.Decimal(cfg.trustContributionPercent).div(new PrismaNs.Decimal("100"));
    pensionEmp = rate;
    pensionEr = rate;
  } else if (active) {
    pensionEmp = active.pensionEmployeeRate;
    pensionEr = active.pensionEmployerRate;
  }

  let overtimeMul = new PrismaNs.Decimal("1.3");
  let weekendMul = new PrismaNs.Decimal("1.5");
  let holidayMul = new PrismaNs.Decimal("1.5");
  let nightMul = new PrismaNs.Decimal("1.3");
  if (active?.premiumRules && typeof active.premiumRules === "object" && !Array.isArray(active.premiumRules)) {
    const pr = active.premiumRules as Record<string, unknown>;
    const r = (k: string) => (typeof pr[k] === "string" ? (pr[k] as string) : undefined);
    const ot = r("overtimeHourMultiplier");
    const we = r("weekendHourMultiplier");
    const ho = r("holidayHourMultiplier");
    const nw = r("nightHourMultiplier");
    if (ot) overtimeMul = new PrismaNs.Decimal(ot);
    if (we) weekendMul = new PrismaNs.Decimal(we);
    if (ho) holidayMul = new PrismaNs.Decimal(ho);
    if (nw) nightMul = new PrismaNs.Decimal(nw);
  }

  const refYear = now.getUTCFullYear();
  const scheduledFrom = defaultJulyFirstUtc(refYear);

  const standardWeeklyDec = new PrismaNs.Decimal(standardWeekly);

  await tx.payrollSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      minimumSalaryMonthly: new PrismaNs.Decimal(minCurrent),
      minimumSalaryScheduledAmount: new PrismaNs.Decimal(minJuly),
      minimumSalaryScheduledEffectiveFrom: scheduledFrom,
      pensionEmployeePercent: pensionEmp,
      pensionEmployerPercent: pensionEr,
      overtimeMultiplier: overtimeMul,
      weekendMultiplier: weekendMul,
      holidayMultiplier: holidayMul,
      nightWorkMultiplier: nightMul,
      standardWeeklyHours: standardWeeklyDec,
      hoursPerWorkingDay: BOOTSTRAP_HOURS_PER_WORKING_DAY,
      overtimeWeeklyThresholdHours: BOOTSTRAP_OVERTIME_WEEKLY_THRESHOLD_HOURS,
      overtimeWeeklyCapHours: BOOTSTRAP_OVERTIME_WEEKLY_WARNING_CAP_HOURS,
      nightWorkPeriodDescription: BOOTSTRAP_NIGHT_PERIOD_DESCRIPTION,
    },
    update: {
      minimumSalaryMonthly: new PrismaNs.Decimal(minCurrent),
      minimumSalaryScheduledAmount: new PrismaNs.Decimal(minJuly),
      minimumSalaryScheduledEffectiveFrom: scheduledFrom,
      pensionEmployeePercent: pensionEmp,
      pensionEmployerPercent: pensionEr,
      overtimeMultiplier: overtimeMul,
      weekendMultiplier: weekendMul,
      holidayMultiplier: holidayMul,
      nightWorkMultiplier: nightMul,
      standardWeeklyHours: standardWeeklyDec,
    },
  });
}

export async function ensurePayrollSettingsRow(companyId: string): Promise<void> {
  const exists = await prisma.payrollSettings.findUnique({ where: { companyId } });
  if (exists) return;

  const cfg = await prisma.companyConfiguration.findUnique({ where: { companyId } });
  const now = new Date();
  const active = await prisma.payrollParameterSet.findFirst({
    where: {
      companyId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const minCurrent = cfg?.minimumSalaryCurrent?.toString() ?? "425";
  const minJuly = cfg?.minimumSalaryFromJuly1?.toString() ?? "500";
  const weekly = cfg?.standardWeeklyHours?.toString() ?? "40";

  let pensionEmp = new PrismaNs.Decimal("0.05");
  let pensionEr = new PrismaNs.Decimal("0.05");
  if (cfg?.trustContributionPercent != null) {
    const rate = cfg.trustContributionPercent.div(new PrismaNs.Decimal("100"));
    pensionEmp = rate;
    pensionEr = rate;
  } else if (active) {
    pensionEmp = active.pensionEmployeeRate;
    pensionEr = active.pensionEmployerRate;
  }

  let overtimeMul = new PrismaNs.Decimal("1.3");
  let weekendMul = new PrismaNs.Decimal("1.5");
  let holidayMul = new PrismaNs.Decimal("1.5");
  let nightMul = new PrismaNs.Decimal("1.3");
  if (active?.premiumRules && typeof active.premiumRules === "object" && !Array.isArray(active.premiumRules)) {
    const pr = active.premiumRules as Record<string, unknown>;
    const r = (k: string) => (typeof pr[k] === "string" ? (pr[k] as string) : undefined);
    const ot = r("overtimeHourMultiplier");
    const we = r("weekendHourMultiplier");
    const ho = r("holidayHourMultiplier");
    const nw = r("nightHourMultiplier");
    if (ot) overtimeMul = new PrismaNs.Decimal(ot);
    if (we) weekendMul = new PrismaNs.Decimal(we);
    if (ho) holidayMul = new PrismaNs.Decimal(ho);
    if (nw) nightMul = new PrismaNs.Decimal(nw);
  }

  const refYear = now.getUTCFullYear();

  await prisma.payrollSettings.create({
    data: {
      companyId,
      minimumSalaryMonthly: new PrismaNs.Decimal(minCurrent),
      minimumSalaryScheduledAmount: new PrismaNs.Decimal(minJuly),
      minimumSalaryScheduledEffectiveFrom: defaultJulyFirstUtc(refYear),
      pensionEmployeePercent: pensionEmp,
      pensionEmployerPercent: pensionEr,
      overtimeMultiplier: overtimeMul,
      weekendMultiplier: weekendMul,
      holidayMultiplier: holidayMul,
      nightWorkMultiplier: nightMul,
      standardWeeklyHours: new PrismaNs.Decimal(weekly),
      hoursPerWorkingDay: BOOTSTRAP_HOURS_PER_WORKING_DAY,
      overtimeWeeklyThresholdHours: BOOTSTRAP_OVERTIME_WEEKLY_THRESHOLD_HOURS,
      overtimeWeeklyCapHours: BOOTSTRAP_OVERTIME_WEEKLY_WARNING_CAP_HOURS,
      nightWorkPeriodDescription: BOOTSTRAP_NIGHT_PERIOD_DESCRIPTION,
    },
  });

  await maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty(companyId);
}

export interface PayrollLegislationContext {
  snapshot: LegislationSnapshot;
  parameterSetId: string | null;
  payrollSettingsId: string;
  anchorMode: PayrollAnchorMode;
}

/**
 * Resolves the active payroll parameter set for a calendar month without touching PayrollSettings.
 * Used when creating a draft so "Krijo payroll" works even if payroll_settings migration/generate is pending.
 */
export async function resolvePayrollParameterSetIdForMonth(
  companyId: string,
  year: number,
  month: number,
): Promise<string | null> {
  const companySetting = await prisma.companySetting.findUnique({
    where: { companyId },
  });

  const anchorMode = (companySetting?.payrollUseParameterEffectiveOn === "PERIOD_START"
    ? "PERIOD_START"
    : "PERIOD_END") as PayrollAnchorMode;
  const anchor = payrollAnchorDateUtc(year, month, anchorMode);

  const parameterSet = await prisma.payrollParameterSet.findFirst({
    where: {
      companyId,
      effectiveFrom: { lte: anchor },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: anchor } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true },
  });

  return parameterSet?.id ?? null;
}

/** Builds merged legislation snapshot for a payroll month using DB-only inputs. */
export async function loadPayrollLegislationContext(
  companyId: string,
  year: number,
  month: number,
): Promise<PayrollLegislationContext | null> {
  await ensurePayrollSettingsRow(companyId);

  const settingsRow = await prisma.payrollSettings.findUnique({
    where: { companyId },
  });
  if (!settingsRow) return null;

  const companySetting = await prisma.companySetting.findUnique({
    where: { companyId },
  });

  const anchorMode = (companySetting?.payrollUseParameterEffectiveOn === "PERIOD_START"
    ? "PERIOD_START"
    : "PERIOD_END") as PayrollAnchorMode;
  const anchor = payrollAnchorDateUtc(year, month, anchorMode);

  const parameterSet = await prisma.payrollParameterSet.findFirst({
    where: {
      companyId,
      effectiveFrom: { lte: anchor },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: anchor } }],
    },
    orderBy: { effectiveFrom: "desc" },
    include: { pitBrackets: true },
  });

  if (!parameterSet) {
    return null;
  }

  const pitBracketRows: PitBracketRowInput[] = parameterSet.pitBrackets.map((b) => ({
    sequence: b.sequence,
    fromAmount: b.fromAmount.toString(),
    toAmount: b.toAmount.toString(),
    rate: b.rate.toString(),
  }));

  const monthlyHoursFromWeekly = settingsRow.standardWeeklyHours.mul(new PrismaNs.Decimal("52")).div(new PrismaNs.Decimal("12"));

  const parameterInput: PayrollParameterSetRowInput = {
    id: parameterSet.id,
    minimumMonthlyWage: parameterSet.minimumMonthlyWage.toString(),
    pensionEmployeeRate: settingsRow.pensionEmployeePercent.toString(),
    pensionEmployerRate: settingsRow.pensionEmployerPercent.toString(),
    premiumRules: premiumRulesFromMultipliers({
      overtimeMultiplier: settingsRow.overtimeMultiplier,
      weekendMultiplier: settingsRow.weekendMultiplier,
      holidayMultiplier: settingsRow.holidayMultiplier,
      nightWorkMultiplier: settingsRow.nightWorkMultiplier,
    }),
    secondaryEmployerFlatRate: parameterSet.secondaryEmployerFlatRate?.toString() ?? null,
    secondaryEmployerPitBase: parameterSet.secondaryEmployerPitBase ?? null,
  };

  const effectiveMinimum = resolveEffectiveMinimumMonthly({
    anchorDateUtc: anchor,
    baselineMinimum: settingsRow.minimumSalaryMonthly.toString(),
    scheduledMinimum: settingsRow.minimumSalaryScheduledAmount?.toString() ?? null,
    scheduledEffectiveFromUtc: settingsRow.minimumSalaryScheduledEffectiveFrom,
  });

  const snapshot = mapPayrollParameterSetToLegislationSnapshot({
    rulesVersion: RULES_VERSION,
    effectiveFromIso: parameterSet.effectiveFrom.toISOString(),
    parameterSet: { ...parameterInput, minimumMonthlyWage: effectiveMinimum },
    pitBracketRows,
    standardMonthlyHours: monthlyHoursFromWeekly.toFixed(2),
  });

  return {
    snapshot,
    parameterSetId: parameterSet.id,
    payrollSettingsId: settingsRow.id,
    anchorMode,
  };
}
