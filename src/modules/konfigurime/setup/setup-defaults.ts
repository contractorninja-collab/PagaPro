/**
 * Constants the setup wizard supplies on the client's behalf.
 *
 * Two kinds live here: values a client should confirm rather than research, and
 * values `employeeUpsertSchema` demands that a six-column grid has no business
 * asking a first-time user for.
 */

/**
 * The description Kosovo Labour Law (Neni 11) requires on every contract.
 *
 * The wizard captures a position's title only — the client writes real duties
 * afterwards — but `JobTitle.description` cannot be empty, and an empty one
 * would not fail loudly: `employee_job_description` is not a required
 * placeholder, so a blank value renders as a **blank duties clause** in a real
 * contract. A generic sentence keeps an early contract readable while the
 * completion summary counts these and points at Konfigurimet → Pozitat.
 */
export function defaultJobDescriptionForTitle(title: string): string {
  const clean = title.trim();
  return `Detyrat dhe përgjegjësitë për pozitën ${clean}, sipas përshkrimit të vendit të punës dhe udhëzimeve të punëdhënësit.`;
}

/**
 * Fields the quick employee row does not show but the schema requires.
 *
 * `documentsMissing: false` is deliberate and was the user's call: a new
 * company starts with a clean dashboard rather than an immediate warning.
 * `employmentType: EMPLOYEE` means contractors still go through the full
 * employee sheet, which is where their pay basis lives.
 */
export const SETUP_EMPLOYEE_ROW_CONSTANTS = {
  status: "ACTIVE",
  employmentType: "EMPLOYEE",
  workArrangement: "ON_SITE",
  applyTrust: true,
  applyTax: true,
  documentsMissing: false,
  weeklyHours: 40,
  departmentId: null,
} as const;

/**
 * Fallbacks for the parameters step when a company has never saved them.
 *
 * The minimum wage is deliberately absent: three different figures live in this
 * codebase (350 provisioned, 425 bootstrapped, 500 scheduled) and they disagree.
 * The step reads the company's own provisioned parameter set instead of
 * asserting one here — a setup wizard confidently confirming a wrong legal
 * minimum to every new client would be worse than asking.
 */
export const SETUP_CONFIGURATION_DEFAULTS = {
  trustContributionPercent: "5",
  standardWeeklyHours: "40",
  workingDaysPerWeek: "5",
  annualLeaveDaysDefault: "20",
} as const;

/**
 * Placeholders that must resolve before a contract is safe to issue.
 *
 * Deliberately broader than the template's own `required` flags, which mark
 * only four fields — a contract with no NUI and no signer passes that check
 * clean while printing blanks where the employer and the signature belong.
 */
export const SETUP_CONTRACT_BLOCKING_KEYS = [
  "company_name",
  "company_nui",
  "company_address",
  "employee_name",
  "employee_personal_number",
  "employee_position",
  "employee_job_description",
  "salary_gross",
  "contract_start_date",
  "authorized_person_name",
  "authorized_position",
  "document_place",
] as const;

export type SetupContractBlockingKey = (typeof SETUP_CONTRACT_BLOCKING_KEYS)[number];

/** Albanian labels plus the step that fixes each blank. */
export const SETUP_CONTRACT_KEY_META: Record<
  SetupContractBlockingKey,
  { label: string; step: "pozitat" | "punonjesit" | "perfaqesuesi" }
> = {
  company_name: { label: "Emri i kompanisë", step: "perfaqesuesi" },
  company_nui: { label: "NUI i kompanisë", step: "perfaqesuesi" },
  company_address: { label: "Adresa e kompanisë", step: "perfaqesuesi" },
  employee_name: { label: "Emri i punonjësit", step: "punonjesit" },
  employee_personal_number: { label: "Numri personal", step: "punonjesit" },
  employee_position: { label: "Pozita e punonjësit", step: "punonjesit" },
  employee_job_description: { label: "Përshkrimi i detyrave", step: "pozitat" },
  salary_gross: { label: "Paga bruto", step: "punonjesit" },
  contract_start_date: { label: "Data e fillimit", step: "punonjesit" },
  authorized_person_name: { label: "Nënshkruesi i dokumenteve", step: "perfaqesuesi" },
  authorized_position: { label: "Pozita e nënshkruesit", step: "perfaqesuesi" },
  document_place: { label: "Vendi i dokumenteve", step: "perfaqesuesi" },
};
