/**
 * Stable snake_case keys for DOCX `{{placeholders}}`.
 * Category-specific keys live in `registry.ts` extensions; this list is the CONTRACT-era core subset for compat.
 */
export const DOCUMENT_CORE_PLACEHOLDER_KEYS = [
  "employee_name",
  "employee_personal_number",
  "employee_address",
  "salary_gross",
  "company_name",
  "company_nui",
  "company_nrb",
  "company_address",
  "authorized_person",
  "authorized_position",
] as const;

/** @deprecated Use DOCUMENT_CORE_PLACEHOLDER_KEYS — alias for legacy imports */
export const CONTRACT_PLACEHOLDER_KEYS = [
  ...DOCUMENT_CORE_PLACEHOLDER_KEYS,
  "contract_start_date",
  "contract_end_date",
] as const;

export type DocumentCorePlaceholderKey = (typeof DOCUMENT_CORE_PLACEHOLDER_KEYS)[number];

/** @deprecated Use DocumentCorePlaceholderKey — legacy union included contract dates */
export type ContractPlaceholderKey = (typeof CONTRACT_PLACEHOLDER_KEYS)[number];
