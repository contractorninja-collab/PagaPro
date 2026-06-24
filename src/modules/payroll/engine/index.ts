/** Kosovo payroll engine + shared calculator entrypoints (UI imports from here). */
export {
  calculateEmployeeLine,
  calculateContractorLineSafe,
} from "@/modules/payroll/calculation/payroll-calculator";
export { computePayrollSpreadsheetLine } from "@/modules/payroll/calculation/payroll-spreadsheet-line";
export type { PayrollMonthCalendarSnapshot } from "@/modules/payroll/calculation/payroll-spreadsheet-line";
export {
  calculateKosovoPrimaryPayrollFromGross,
  type KosovoPrimaryPayrollFromGrossInput,
  type KosovoPrimaryPayrollFromGrossResult,
} from "@/modules/payroll/engine/kosovo-gross-to-net";
export type {
  LegislationSnapshot,
  PayrollCalculationResult,
  CalculateEmployeeLineInput,
  CalculateContractorLineInput,
} from "@/modules/payroll/calculation/types";
export { loadPayrollLegislationContext, resolveEffectiveMinimumMonthly } from "@/modules/payroll/services/payroll-settings-service";
