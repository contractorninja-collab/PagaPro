/**
 * Shared row model for the "Libri i Pagave (Pagat per ATK)" financial export.
 *
 * Single source of truth consumed by BOTH the branded XLSX exporter and the CSV
 * route, so the two formats can never diverge. Every monetary column is read
 * from the frozen engine values stored on the PayrollEntry (regularPay,
 * premium amounts, gross, pension, taxable, PIT, net) — the export never
 * recomputes tax or premiums, so it always agrees with the payslip and the
 * official ATK export.
 */

/** Official ATK "Libri i Pagave" fixed premium display rates (columns 12/13/14). */
export const ATK_OVERTIME_NIGHT_RATE_FACTOR = 1.3;
export const ATK_ON_CALL_RATE_FACTOR = 1.2;
export const ATK_HOLIDAY_WEEKEND_RATE_FACTOR = 1.5;

export interface LibriPagaveEntryInput {
  employerPrimacySnapshot: string;
  hourlyRate: string;
  actualRegularHours: string;
  paidLeaveHours: string;
  sickLeaveHours: string;
  overtimeHours: string;
  weekendHours: string;
  holidayHours: string;
  nightHours: string;
  regularPay: string;
  paidLeavePay: string;
  sickLeavePay: string;
  overtimeAmount: string;
  holidayAmount: string;
  weekendAmount: string;
  nightAmount: string;
  bonuses: string;
  unpaidLeaveDeduction: string;
  otherDeductions: string;
  salaryAdvanceDeduction: string;
  grossSalary: string;
  taxableIncome: string;
  pitWithheld: string;
  pensionEmployee: string;
  pensionEmployer: string;
  netPay: string;
  employee: {
    firstName: string;
    lastName: string;
    applyTrust: boolean;
    applyTax: boolean;
    department: { name: string } | null;
  };
}

/** One fully-resolved row of the 25-column ATK payroll book (all amounts already euro-rounded). */
export interface LibriPagaveRow {
  idp: number;
  fullName: string;
  sektori: string;
  isSecondary: boolean;
  hourlyRate: number;
  regularHours: number;
  regularGross: number;
  overtimeNightHours: number;
  onCallHours: number;
  holidayWeekendHours: number;
  overtimeNightRate: number;
  onCallRate: number;
  holidayWeekendRate: number;
  premiumPay: number;
  totalGross: number;
  employeeTrustPercent: number;
  employerTrustPercent: number;
  employeeTrustAmount: number;
  employerTrustAmount: number;
  taxableIncome: number;
  taxAmount: number;
  netIncome: number;
  advance: number;
  netToPay: number;
  bonuses: number;
  unpaidLeaveDeduction: number;
  applyTrust: boolean;
  applyTax: boolean;
}

function num(val: string): number {
  const n = Number(String(val).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number): number => Math.round((n + Number.EPSILON) * 10000) / 10000;

export function buildLibriPagaveRows(entries: LibriPagaveEntryInput[]): LibriPagaveRow[] {
  return entries.map((e, idx) => {
    const hourlyRate = num(e.hourlyRate);
    // Regular gross (col 8) and premium pay (col 15) are read from the frozen
    // engine amounts — never the hardcoded-multiplier / pension-proxy recompute.
    const regularGross = round2(num(e.regularPay) + num(e.paidLeavePay) + num(e.sickLeavePay));
    const premiumPay = round2(
      num(e.overtimeAmount) + num(e.holidayAmount) + num(e.weekendAmount) + num(e.nightAmount),
    );
    const totalGross = num(e.grossSalary);
    const employeeTrustAmount = num(e.pensionEmployee);
    const employerTrustAmount = num(e.pensionEmployer);
    const taxableIncome = num(e.taxableIncome);
    const taxAmount = num(e.pitWithheld);
    const netToPay = num(e.netPay);

    // The ATK 25-column book has a single post-tax cash-deduction column ("Avans"),
    // but the engine subtracts BOTH otherDeductions and the salary advance from net.
    // Fold both into col 24 so col25 (net-to-pay) equals the frozen engine net and
    // col23 = col21 − col22 = taxable − tax holds exactly.
    const advance = round2(num(e.salaryAdvanceDeduction) + num(e.otherDeductions));
    const netIncome = round2(taxableIncome - taxAmount);

    // Trust % is derived from the frozen amount (amount ÷ gross), so it always
    // agrees with the euro column even for entries frozen before applyTrust was
    // honored by the engine — never coupled to the mutable live flag.
    const employeeTrustPercent = totalGross > 0 ? round4(employeeTrustAmount / totalGross) : 0;
    const employerTrustPercent = totalGross > 0 ? round4(employerTrustAmount / totalGross) : 0;

    return {
      idp: idx + 1,
      fullName: `${e.employee.firstName} ${e.employee.lastName}`.trim(),
      sektori: e.employee.department?.name ?? "",
      isSecondary: e.employerPrimacySnapshot === "SECONDARY",
      hourlyRate,
      regularHours: round2(num(e.actualRegularHours) + num(e.paidLeaveHours) + num(e.sickLeaveHours)),
      regularGross,
      overtimeNightHours: round2(num(e.overtimeHours) + num(e.nightHours)),
      onCallHours: 0,
      holidayWeekendHours: round2(num(e.holidayHours) + num(e.weekendHours)),
      overtimeNightRate: round2(hourlyRate * ATK_OVERTIME_NIGHT_RATE_FACTOR),
      onCallRate: round2(hourlyRate * ATK_ON_CALL_RATE_FACTOR),
      holidayWeekendRate: round2(hourlyRate * ATK_HOLIDAY_WEEKEND_RATE_FACTOR),
      premiumPay,
      totalGross,
      employeeTrustPercent,
      employerTrustPercent,
      employeeTrustAmount,
      employerTrustAmount,
      taxableIncome,
      taxAmount,
      netIncome,
      advance,
      netToPay,
      bonuses: num(e.bonuses),
      unpaidLeaveDeduction: num(e.unpaidLeaveDeduction),
      applyTrust: e.employee.applyTrust,
      applyTax: e.employee.applyTax,
    };
  });
}
