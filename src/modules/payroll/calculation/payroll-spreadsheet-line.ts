import type {
  AtkRegime,
  CalculationBreakdownPayload,
  EmployerPrimacy,
  EmploymentType,
  LegislationSnapshot,
  PayrollCalculationIssue,
  PayrollCalculationResult,
  PayrollHrTransparency,
  PitBreakdown,
} from "./types";
import { calculateEmployeeLine } from "./payroll-calculator";
import { D } from "./money/decimal";
import { roundMoneyEUR, ROUNDING_POLICY_VERSION } from "./money/rounding";
import { computePremiumPays } from "./gross/premiums";
import { solveEquivalentMonthlyGrossForTargetNet } from "./net-gross-solver";
import { buildPayrollHrTransparency } from "./payroll-transparency";

export interface SpreadsheetLineComputationInput {
  expectedWorkingDays: number;
  expectedRegularHours: string;
  actualRegularHours: string;
  paidLeaveHours: string;
  sickLeaveHours: string;
  unpaidLeaveHours: string;
  overtimeHours: string;
  weekendHours: string;
  holidayHours: string;
  nightHours: string;
  bonuses: string;
  otherDeductions: string;
  salaryAdvanceDeduction: string;
  manualGrossOverride?: string | null;
  manualNetOverride?: string | null;
}

export interface SpreadsheetEmployeeInput {
  employmentType: EmploymentType;
  employerPrimacy: EmployerPrimacy;
  baseSalaryMonthly: string;
  compensationBasis: "GROSS_MONTHLY" | "TARGET_NET_MONTHLY";
  targetNetMonthly: string | null;
  exemptFromMinimumSalary: boolean;
}

function parseNonNegativeHours(
  raw: string | undefined,
  label: string,
): { ok: true; v: ReturnType<typeof D> } | { ok: false; issues: PayrollCalculationIssue[] } {
  const v = D(raw ?? "0");
  if (!v.isFinite() || v.isNegative()) {
    return {
      ok: false,
      issues: [{ code: "INVALID_HOURS", message: `${label} must be finite and ≥ 0` }],
    };
  }
  return { ok: true, v };
}

export interface SpreadsheetLineComputed {
  hourlyRate: string;
  regularPay: string;
  paidLeavePay: string;
  sickLeavePay: string;
  unpaidLeaveDeduction: string;
  overtimeAmount: string;
  weekendAmount: string;
  holidayAmount: string;
  nightAmount: string;
  bonuses: string;
  grossSalary: string;
  taxableIncome: string;
  pitWithheld: string;
  pensionEmployee: string;
  pensionEmployer: string;
  otherDeductions: string;
  salaryAdvanceDeduction: string;
  netPay: string;
  employerTotalCost: string;
  breakdown: Record<string, unknown>;
}

/** Calendar + policy snapshot from PayrollSettings (transparency + expected hours). */
export interface PayrollMonthCalendarSnapshot {
  expectedWorkingDays: number;
  expectedRegularHours: string;
  hoursPerWorkingDay: string;
  weekdayPublicHolidayDates: string[];
  overtimeWeeklyThresholdHours: string;
  overtimeWarningWeeklyHours: string;
  standardWeeklyHours: string;
  nightWorkPeriodDescription: string;
}

/** Full spreadsheet row: earnings buckets → statutory (single gross bar). */
export function computePayrollSpreadsheetLine(
  employee: SpreadsheetEmployeeInput,
  line: SpreadsheetLineComputationInput,
  snapshot: LegislationSnapshot,
  sickLeavePayPercent: string,
  calendarSnapshot: PayrollMonthCalendarSnapshot,
): PayrollCalculationResult<SpreadsheetLineComputed> {
  const issues: PayrollCalculationIssue[] = [];

  if (employee.employmentType !== "EMPLOYEE") {
    return {
      ok: false,
      issues: [{ code: "CONTRACTOR_EXCLUDED", message: "Kontraktorët nuk përfshihen në payroll." }],
    };
  }

  const buckets = [
    parseNonNegativeHours(line.actualRegularHours, "actualRegularHours"),
    parseNonNegativeHours(line.paidLeaveHours, "paidLeaveHours"),
    parseNonNegativeHours(line.sickLeaveHours, "sickLeaveHours"),
    parseNonNegativeHours(line.unpaidLeaveHours, "unpaidLeaveHours"),
    parseNonNegativeHours(line.overtimeHours, "overtimeHours"),
    parseNonNegativeHours(line.weekendHours, "weekendHours"),
    parseNonNegativeHours(line.holidayHours, "holidayHours"),
    parseNonNegativeHours(line.nightHours, "nightHours"),
  ];
  for (const b of buckets) {
    if (!b.ok) issues.push(...b.issues);
  }
  if (issues.length) return { ok: false, issues };

  const actualReg = (buckets[0] as { ok: true; v: ReturnType<typeof D> }).v;
  const paidLeav = (buckets[1] as { ok: true; v: ReturnType<typeof D> }).v;
  const sickH = (buckets[2] as { ok: true; v: ReturnType<typeof D> }).v;
  const unpaidH = (buckets[3] as { ok: true; v: ReturnType<typeof D> }).v;
  const otH = (buckets[4] as { ok: true; v: ReturnType<typeof D> }).v;
  const weH = (buckets[5] as { ok: true; v: ReturnType<typeof D> }).v;
  const hoH = (buckets[6] as { ok: true; v: ReturnType<typeof D> }).v;
  const niH = (buckets[7] as { ok: true; v: ReturnType<typeof D> }).v;

  const bonuses = roundMoneyEUR(D(line.bonuses ?? "0"));
  const otherDed = roundMoneyEUR(D(line.otherDeductions ?? "0"));
  const advance = roundMoneyEUR(D(line.salaryAdvanceDeduction ?? "0"));

  if (bonuses.isNegative() || otherDed.isNegative() || advance.isNegative()) {
    return {
      ok: false,
      issues: [{ code: "NEGATIVE_MONEY", message: "Bonuset dhe zbritjet nuk mund të jenë negative." }],
    };
  }

  const expectedReg = D(line.expectedRegularHours);
  const denom = expectedReg.gt(0) ? expectedReg : D("173.33");
  // Norma orare = paga bruto mujore ÷ orët e pritura të kalendarit (jo orët e punuara).
  // Pagesa e rregullt = norma × orët e punuara — orët që mungojnë pa pushim zbriten automatikisht.
  // Me pushime të paguara/mjekësore, norma mbetet e njëjtë që regular + leave të arrijë pagën kontraktuale.

  /** Full-precision quotient (classic sheet col 6 implicit rate) — do not round before × hours. */
  let hourlyPrecise: ReturnType<typeof D>;

  if (employee.compensationBasis === "TARGET_NET_MONTHLY" && employee.targetNetMonthly != null) {
    const solved = solveEquivalentMonthlyGrossForTargetNet({
      targetNet: employee.targetNetMonthly,
      snapshot,
      employerPrimacy: employee.employerPrimacy,
      enforceMinimumGross: !employee.exemptFromMinimumSalary,
    });
    if (!solved) {
      return {
        ok: false,
        issues: [{ code: "NET_SOLVER_FAILED", message: "Nuk u gjet një bruto ekuivalente për neton e synuar." }],
      };
    }
    hourlyPrecise = D(solved.gross).div(denom);
  } else {
    hourlyPrecise = D(employee.baseSalaryMonthly).div(denom);
  }

  if (!hourlyPrecise.isFinite() || hourlyPrecise.lte(0)) {
    return {
      ok: false,
      issues: [{ code: "HOURLY_RATE", message: "Norma orare është e pavlefshme." }],
    };
  }

  const sickPct = D(sickLeavePayPercent);
  const regularPay = roundMoneyEUR(hourlyPrecise.mul(actualReg));
  const paidLeavePay = roundMoneyEUR(hourlyPrecise.mul(paidLeav));
  const sickLeavePay = roundMoneyEUR(hourlyPrecise.mul(sickH).mul(sickPct));
  const unpaidLeaveDeduction = roundMoneyEUR(hourlyPrecise.mul(unpaidH));

  let prem;
  try {
    prem = computePremiumPays(hourlyPrecise, snapshot.premiumRules, otH, hoH, weH, niH);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Shumëzues të pavlefshëm për premiumët (OT / festë / fundjavë / natë).";
    return {
      ok: false,
      issues: [{ code: "INVALID_PREMIUM_RULES", message: msg }],
    };
  }

  const overtimeAmount = roundMoneyEUR(prem.overtimePay);
  const holidayAmount = roundMoneyEUR(prem.holidayPay);
  const weekendAmount = roundMoneyEUR(prem.weekendPay);
  const nightAmount = roundMoneyEUR(prem.nightPay);

  const earningsSum = regularPay
    .plus(paidLeavePay)
    .plus(sickLeavePay)
    .plus(overtimeAmount)
    .plus(weekendAmount)
    .plus(holidayAmount)
    .plus(nightAmount)
    .plus(bonuses)
    .minus(unpaidLeaveDeduction);

  let grossSubject = roundMoneyEUR(earningsSum);

  if (line.manualGrossOverride != null && line.manualGrossOverride.trim() !== "") {
    grossSubject = roundMoneyEUR(D(line.manualGrossOverride));
  }

  const transparencyCalendar = {
    expectedWorkingDays: calendarSnapshot.expectedWorkingDays,
    hoursPerWorkingDay: calendarSnapshot.hoursPerWorkingDay,
    expectedRegularHours: calendarSnapshot.expectedRegularHours,
    weekdayPublicHolidaysExcluded: calendarSnapshot.weekdayPublicHolidayDates,
    overtimeWeeklyThresholdHours: calendarSnapshot.overtimeWeeklyThresholdHours,
    overtimeWarningWeeklyHours: calendarSnapshot.overtimeWarningWeeklyHours,
    standardWeeklyHours: calendarSnapshot.standardWeeklyHours,
    weekendDefinition:
      "Fundjavë (weekend_hours): orët e së shtunës dhe së dielës; në motor: normë_orare × orë × weekend_multiplier nga PayrollSettings (grupi «F» në fleta klasike kur shumëzuesi përkon me politikat tuaja).",
    holidayDefinition:
      "Festë (holiday_hours): orët në ditë festive publike; në motor: normë_orare × orë × holiday_multiplier nga PayrollSettings. Ditët festive në javën e punës përjashtohen nga orët e pritura mujore sipas kalendarit të payroll-it (bazë Kosovë + lista në PayrollSettings).",
    nightWindowDescription: calendarSnapshot.nightWorkPeriodDescription,
  };

  // Leje pa pagesë / muaj pa punë: kur bruto-subjekti del ≤ 0, pagesa është 0.
  // Motori statutor bazë refuzon bruto ≤ 0 (dhe zbaton pagën minimale), prandaj e
  // shkurtojmë këtu pa e prekur atë motor dhe kthejmë një rresht plotësisht zero.
  if (grossSubject.lte(0)) {
    return buildZeroSalaryLine({
      employee,
      line,
      snapshot,
      sickLeavePayPercent,
      hourlyPrecise,
      transparencyCalendar,
    });
  }

  const statutory = calculateEmployeeLine(
    {
      employmentType: "EMPLOYEE",
      employerPrimacy: employee.employerPrimacy,
      hours: { regularHours: "0" },
      rates: { hourlyRate: hourlyPrecise.toFixed(6) },
      grossSalaryOverride: grossSubject.toFixed(2),
      bonusAmount: "0",
      otherDeductions: roundMoneyEUR(otherDed.plus(advance)).toFixed(2),
      enforceMinimumGross: !employee.exemptFromMinimumSalary,
    },
    snapshot,
  );

  if (!statutory.ok) return statutory;

  let netPay = D(statutory.value.netPay);
  if (line.manualNetOverride != null && line.manualNetOverride.trim() !== "") {
    netPay = roundMoneyEUR(D(line.manualNetOverride));
  }

  const pensionEr = D(statutory.value.pensionEmployer);
  const employerTotalCost = roundMoneyEUR(grossSubject.plus(pensionEr));

  const payrollTransparency = buildPayrollHrTransparency({
    employerPrimacy: employee.employerPrimacy,
    compensationBasis: employee.compensationBasis,
    baseSalaryMonthly: employee.baseSalaryMonthly,
    targetNetMonthly: employee.targetNetMonthly,
    snapshot,
    calendar: transparencyCalendar,
    buckets: {
      actualRegularHours: line.actualRegularHours,
      paidLeaveHours: line.paidLeaveHours,
      sickLeaveHours: line.sickLeaveHours,
      unpaidLeaveHours: line.unpaidLeaveHours,
      overtimeHours: line.overtimeHours,
      weekendHours: line.weekendHours,
      holidayHours: line.holidayHours,
      nightHours: line.nightHours,
    },
    sickLeavePayPercent,
    premiumRules: snapshot.premiumRules,
    hourlyRate: hourlyPrecise.toFixed(6),
    amounts: {
      regularPay: regularPay.toFixed(2),
      paidLeavePay: paidLeavePay.toFixed(2),
      sickLeavePay: sickLeavePay.toFixed(2),
      unpaidLeaveDeduction: unpaidLeaveDeduction.toFixed(2),
      overtimeAmount: overtimeAmount.toFixed(2),
      weekendAmount: weekendAmount.toFixed(2),
      holidayAmount: holidayAmount.toFixed(2),
      nightAmount: nightAmount.toFixed(2),
      bonuses: bonuses.toFixed(2),
      grossSalary: grossSubject.toFixed(2),
      employerTotalCost: employerTotalCost.toFixed(2),
      netPay: netPay.toFixed(2),
    },
    statutoryBreakdown: statutory.value.breakdown,
    spreadsheetDeductions: {
      otherDeductionsExAdvance: otherDed.toFixed(2),
      salaryAdvanceDeduction: advance.toFixed(2),
    },
  });

  const mergedBreakdown: CalculationBreakdownPayload = {
    ...statutory.value.breakdown,
    gross: {
      ...statutory.value.breakdown.gross,
      regularPay: regularPay.toFixed(2),
      overtimePay: overtimeAmount.toFixed(2),
      holidayPay: holidayAmount.toFixed(2),
      weekendPay: weekendAmount.toFixed(2),
      nightPay: nightAmount.toFixed(2),
      bonuses: bonuses.toFixed(2),
      grossSalary: grossSubject.toFixed(2),
    },
    spreadsheet: {
      expectedWorkingDays: line.expectedWorkingDays,
      expectedRegularHours: line.expectedRegularHours,
      paidLeavePay: paidLeavePay.toFixed(2),
      sickLeavePay: sickLeavePay.toFixed(2),
      unpaidLeaveDeduction: unpaidLeaveDeduction.toFixed(2),
      salaryAdvanceDeduction: advance.toFixed(2),
      otherDeductionsExAdvance: otherDed.toFixed(2),
    },
    netPay: netPay.toFixed(2),
    payrollTransparency,
  };
  return {
    ok: true,
    value: {
      hourlyRate: hourlyPrecise.toFixed(6),
      regularPay: regularPay.toFixed(2),
      paidLeavePay: paidLeavePay.toFixed(2),
      sickLeavePay: sickLeavePay.toFixed(2),
      unpaidLeaveDeduction: unpaidLeaveDeduction.toFixed(2),
      overtimeAmount: overtimeAmount.toFixed(2),
      weekendAmount: weekendAmount.toFixed(2),
      holidayAmount: holidayAmount.toFixed(2),
      nightAmount: nightAmount.toFixed(2),
      bonuses: bonuses.toFixed(2),
      grossSalary: grossSubject.toFixed(2),
      taxableIncome: statutory.value.taxableIncome,
      pitWithheld: statutory.value.pitWithheld,
      pensionEmployee: statutory.value.pensionEmployee,
      pensionEmployer: statutory.value.pensionEmployer,
      otherDeductions: otherDed.toFixed(2),
      salaryAdvanceDeduction: advance.toFixed(2),
      netPay: netPay.toFixed(2),
      employerTotalCost: employerTotalCost.toFixed(2),
      breakdown: mergedBreakdown as unknown as Record<string, unknown>,
    },
  };
}

/**
 * Rresht plotësisht zero (leje pa pagesë / muaj pa punë). Nuk thërret motorin statutor bazë,
 * i cili refuzon bruto ≤ 0 dhe zbaton pagën minimale; këtu pagesa është qëllimisht 0.
 */
function buildZeroSalaryLine(params: {
  employee: SpreadsheetEmployeeInput;
  line: SpreadsheetLineComputationInput;
  snapshot: LegislationSnapshot;
  sickLeavePayPercent: string;
  hourlyPrecise: ReturnType<typeof D>;
  transparencyCalendar: PayrollHrTransparency["calendar"];
}): PayrollCalculationResult<SpreadsheetLineComputed> {
  const ZERO = "0.00";
  const { employee, line, snapshot, sickLeavePayPercent, hourlyPrecise, transparencyCalendar } =
    params;

  const atkRegime: AtkRegime =
    employee.employerPrimacy === "SECONDARY" ? "SECONDARY_FLAT_10" : "PRIMARY_PROGRESSIVE";

  const zeroPit: PitBreakdown =
    atkRegime === "SECONDARY_FLAT_10"
      ? {
          atkRegime: "SECONDARY_FLAT_10",
          pitBaseKind: snapshot.secondaryEmployerPitBase,
          pitBaseAmount: ZERO,
          flatRate: snapshot.secondaryEmployerFlatRate,
          pitWithheld: ZERO,
        }
      : {
          atkRegime: "PRIMARY_PROGRESSIVE",
          taxableIncome: ZERO,
          pitWithheld: ZERO,
          bracketSlices: [],
        };

  const statutoryBreakdown: CalculationBreakdownPayload = {
    rulesVersion: snapshot.rulesVersion,
    snapshotId: snapshot.snapshotId,
    effectiveFromIso: snapshot.effectiveFromIso,
    roundingPolicyVersion: ROUNDING_POLICY_VERSION,
    employerPrimacy: employee.employerPrimacy,
    atkRegime,
    gross: {
      regularPay: ZERO,
      overtimePay: ZERO,
      holidayPay: ZERO,
      weekendPay: ZERO,
      nightPay: ZERO,
      bonuses: ZERO,
      grossSalary: ZERO,
    },
    pension: { pensionEmployee: ZERO, pensionEmployer: ZERO },
    taxableIncome: ZERO,
    pit: zeroPit,
    netPay: ZERO,
  };

  const payrollTransparency = buildPayrollHrTransparency({
    employerPrimacy: employee.employerPrimacy,
    compensationBasis: employee.compensationBasis,
    baseSalaryMonthly: employee.baseSalaryMonthly,
    targetNetMonthly: employee.targetNetMonthly,
    snapshot,
    calendar: transparencyCalendar,
    buckets: {
      actualRegularHours: line.actualRegularHours,
      paidLeaveHours: line.paidLeaveHours,
      sickLeaveHours: line.sickLeaveHours,
      unpaidLeaveHours: line.unpaidLeaveHours,
      overtimeHours: line.overtimeHours,
      weekendHours: line.weekendHours,
      holidayHours: line.holidayHours,
      nightHours: line.nightHours,
    },
    sickLeavePayPercent,
    premiumRules: snapshot.premiumRules,
    hourlyRate: hourlyPrecise.toFixed(6),
    amounts: {
      regularPay: ZERO,
      paidLeavePay: ZERO,
      sickLeavePay: ZERO,
      unpaidLeaveDeduction: ZERO,
      overtimeAmount: ZERO,
      weekendAmount: ZERO,
      holidayAmount: ZERO,
      nightAmount: ZERO,
      bonuses: ZERO,
      grossSalary: ZERO,
      employerTotalCost: ZERO,
      netPay: ZERO,
    },
    statutoryBreakdown,
    spreadsheetDeductions: {
      otherDeductionsExAdvance: ZERO,
      salaryAdvanceDeduction: ZERO,
    },
  });

  const mergedBreakdown: CalculationBreakdownPayload = {
    ...statutoryBreakdown,
    spreadsheet: {
      expectedWorkingDays: line.expectedWorkingDays,
      expectedRegularHours: line.expectedRegularHours,
      paidLeavePay: ZERO,
      sickLeavePay: ZERO,
      unpaidLeaveDeduction: ZERO,
      salaryAdvanceDeduction: ZERO,
      otherDeductionsExAdvance: ZERO,
      zeroSalary: true,
    },
    payrollTransparency,
  };

  return {
    ok: true,
    value: {
      hourlyRate: hourlyPrecise.toFixed(6),
      regularPay: ZERO,
      paidLeavePay: ZERO,
      sickLeavePay: ZERO,
      unpaidLeaveDeduction: ZERO,
      overtimeAmount: ZERO,
      weekendAmount: ZERO,
      holidayAmount: ZERO,
      nightAmount: ZERO,
      bonuses: ZERO,
      grossSalary: ZERO,
      taxableIncome: ZERO,
      pitWithheld: ZERO,
      pensionEmployee: ZERO,
      pensionEmployer: ZERO,
      otherDeductions: ZERO,
      salaryAdvanceDeduction: ZERO,
      netPay: ZERO,
      employerTotalCost: ZERO,
      breakdown: mergedBreakdown as unknown as Record<string, unknown>,
    },
  };
}
