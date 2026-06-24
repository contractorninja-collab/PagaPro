/** Kosovo payroll calculation — pure domain types (no DB/UI imports). */

export type CurrencyCode = "EUR";

export type EmploymentType = "EMPLOYEE" | "CONTRACTOR";

export type EmployerPrimacy = "PRIMARY" | "SECONDARY";

export type AtkRegime = "PRIMARY_PROGRESSIVE" | "SECONDARY_FLAT_10" | "CONTRACTOR_EXEMPT";

export type SecondaryEmployerPitBaseKind = "TAXABLE_AFTER_PENSION" | "GROSS";

export type ContractorWithholdingMode = "NONE" | "SECONDARY_FLAT_10";

export type PremiumStackPolicy = "additive" | "max_only" | "explicit_order";

export interface PremiumRules {
  overtimeHourMultiplier?: string;
  holidayHourMultiplier?: string;
  weekendHourMultiplier?: string;
  /** Punë natën — nga PayrollSettings.nightWorkMultiplier */
  nightHourMultiplier?: string;
  stackPolicy?: PremiumStackPolicy;
}

export interface HourBreakdown {
  regularHours: string;
  overtimeHours?: string;
  holidayHours?: string;
  weekendHours?: string;
  nightHours?: string;
}

export interface HourlyRates {
  hourlyRate: string;
}

export interface PitBandSnapshot {
  cumulativeUpperInclusive: string;
  rate: string;
}

export interface PitRulesSnapshot {
  employeePensionReducesTaxableBase: boolean;
}

export interface LegislationSnapshot {
  rulesVersion: string;
  snapshotId?: string;
  effectiveFromIso?: string;
  currency: CurrencyCode;
  minimumMonthlyGross: string;
  minimumHourlyWage?: string;
  standardMonthlyHours?: string;
  pensionEmployeeRate: string;
  pensionEmployerRate: string;
  pitBands: PitBandSnapshot[];
  pitRules: PitRulesSnapshot;
  secondaryEmployerFlatRate: string;
  secondaryEmployerPitBase: SecondaryEmployerPitBaseKind;
  premiumRules: PremiumRules;
}

export interface GrossBreakdown {
  regularPay: string;
  overtimePay: string;
  holidayPay: string;
  weekendPay: string;
  nightPay: string;
  /** Bonuses added on top of hourly / premium gross before statutory contributions */
  bonuses: string;
  grossSalary: string;
}

export interface PensionBreakdown {
  pensionEmployee: string;
  pensionEmployer: string;
}

export interface PitPrimaryBreakdown {
  atkRegime: "PRIMARY_PROGRESSIVE";
  taxableIncome: string;
  pitWithheld: string;
  bracketSlices: Array<{
    from: string;
    to: string;
    rate: string;
    sliceTaxable: string;
    taxAmount: string;
  }>;
}

export interface PitSecondaryBreakdown {
  atkRegime: "SECONDARY_FLAT_10";
  pitBaseKind: SecondaryEmployerPitBaseKind;
  pitBaseAmount: string;
  flatRate: string;
  pitWithheld: string;
}

export interface PitContractorExemptBreakdown {
  atkRegime: "CONTRACTOR_EXEMPT";
  pitWithheld: string;
}

export type PitBreakdown = PitPrimaryBreakdown | PitSecondaryBreakdown | PitContractorExemptBreakdown;

/** HR-facing payroll transparency (JSON breakdown); values mirror engine inputs from PayrollSettings + snapshot. */
export interface PayrollFormulaLine {
  label: string;
  formula: string;
  substitution: string;
  result: string;
}

export interface PayrollHrTransparency {
  rulesSummary: string[];
  /**
   * Udhëzues i renditur krahasuar me fletën klasike të pagave (~kol. 8 → ~25).
   * Multiplicatorët cituar janë ata të konfiguruar në PayrollSettings për këtë llogaritje.
   */
  referenceSheetSteps: string[];
  /** Ndërtimi i subjektit të brutos përpara kontributeve tatimore (kol. 8 + 15 + bonus − papaguar + pushimet në motor). */
  grossBuild: {
    regularGross: PayrollFormulaLine;
    premiumGrossTotal: PayrollFormulaLine;
    bonuses: PayrollFormulaLine;
    unpaidLeaveAdjustment: PayrollFormulaLine;
    totalGrossSubject: PayrollFormulaLine;
  };
  /** Baza tatimore sipas rregullave të periudhës (kol. ~21). */
  taxableIncomeLine: PayrollFormulaLine;
  /** Tatimi në të ardhura të mbajtur (kol. ~22). */
  pitLine: PayrollFormulaLine;
  /** Netoja pas pensionit të punonjësit dhe tatimit, para zbritjeve në para (afërsisht kol. 23 në Excel). */
  netAfterTaxAndPensionEmployee?: PayrollFormulaLine;
  /** Avansi dhe zbritjet e tjera në para pas tatimit → netoja finale e ruajtur. */
  postTaxCashDeductions?: PayrollFormulaLine;
  hourlyRate: PayrollFormulaLine;
  premiums: {
    overtime: PayrollFormulaLine;
    weekend: PayrollFormulaLine;
    holiday: PayrollFormulaLine;
    night: PayrollFormulaLine;
  };
  leave: {
    paid: PayrollFormulaLine;
    sick: PayrollFormulaLine;
    unpaid: PayrollFormulaLine;
  };
  pensionEmployee: PayrollFormulaLine;
  pensionEmployer: PayrollFormulaLine;
  pitNarrative: string;
  netPay: PayrollFormulaLine;
  employerTotalCost: PayrollFormulaLine;
  /** Çfarë nuk përfshihet në motor krahasuar me një template Excel të plotë. */
  knownGapsVersusClassicSheet: string[];
  calendar: {
    expectedWorkingDays: number;
    hoursPerWorkingDay: string;
    expectedRegularHours: string;
    weekdayPublicHolidaysExcluded: string[];
    overtimeWeeklyThresholdHours: string;
    overtimeWarningWeeklyHours: string;
    standardWeeklyHours: string;
    weekendDefinition: string;
    holidayDefinition: string;
    nightWindowDescription: string;
  };
}

export interface CalculationBreakdownPayload {
  rulesVersion: string;
  snapshotId?: string;
  effectiveFromIso?: string;
  roundingPolicyVersion: string;
  employerPrimacy: EmployerPrimacy;
  atkRegime: AtkRegime;
  gross: GrossBreakdown;
  pension: PensionBreakdown;
  taxableIncome: string;
  pit: PitBreakdown;
  netPay: string;
  /** Detailed formulas for HR review (spreadsheet engine). */
  payrollTransparency?: PayrollHrTransparency;
  /** Spreadsheet earnings snapshot persisted on payroll entries. */
  spreadsheet?: Record<string, unknown>;
}

export interface CalculateEmployeeLineInput {
  employmentType: EmploymentType;
  employerPrimacy: EmployerPrimacy;
  hours: HourBreakdown;
  rates: HourlyRates;
  grossSalaryOverride?: string;
  /** Added to computed hourly gross before pension/PIT (employees only). */
  bonusAmount?: string;
  otherDeductions?: string;
  enforceMinimumGross?: boolean;
}

export interface CalculateEmployeeLineOutput {
  grossSalary: string;
  taxableIncome: string;
  pitWithheld: string;
  pensionEmployee: string;
  pensionEmployer: string;
  otherDeductions: string;
  netPay: string;
  breakdown: CalculationBreakdownPayload;
}

export interface CalculateContractorLineInput {
  hours: HourBreakdown;
  rates: HourlyRates;
  grossSalaryOverride?: string;
  bonusAmount?: string;
  contractorWithholdingMode?: ContractorWithholdingMode;
  employerPrimacy?: EmployerPrimacy;
  applyTrustContributions?: boolean;
  pensionEmployeeRate?: string;
  pensionEmployerRate?: string;
  secondaryEmployerFlatRate?: string;
  secondaryEmployerPitBase?: SecondaryEmployerPitBaseKind;
  pitRules?: PitRulesSnapshot;
  otherDeductions?: string;
}

export interface CalculateContractorLineOutput {
  grossSalary: string;
  taxableIncome: string;
  pitWithheld: string;
  pensionEmployee: string;
  pensionEmployer: string;
  otherDeductions: string;
  netPay: string;
  breakdown: CalculationBreakdownPayload;
}

export type PayrollCalculationIssueCode =
  | "NEGATIVE_OR_NON_FINITE_HOURS"
  | "NEGATIVE_OR_ZERO_HOURLY_RATE"
  | "INVALID_PREMIUM_RULES"
  | "INVALID_PIT_BANDS"
  | "BELOW_MINIMUM_GROSS"
  | "BELOW_MINIMUM_HOURLY"
  | "MISSING_STANDARD_HOURS_FOR_HOURLY_MIN"
  | "INVALID_EMPLOYMENT_TYPE_FOR_EMPLOYEE_CALCULATOR"
  | "INVALID_OTHER_DEDUCTIONS"
  | "INVALID_BONUS_AMOUNT"
  | "INVALID_HOURS"
  | "CONTRACTOR_EXCLUDED"
  | "NEGATIVE_MONEY"
  | "NET_SOLVER_FAILED"
  | "HOURLY_RATE"
  | "INVALID_GROSS_SALARY";

export interface PayrollCalculationIssue {
  code: PayrollCalculationIssueCode;
  message: string;
}

export type PayrollCalculationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: PayrollCalculationIssue[] };
