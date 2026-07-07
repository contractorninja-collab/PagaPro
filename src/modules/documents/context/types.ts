/** Minimal DTOs — populate from Prisma selections without importing @prisma/client here. */

export interface EmployeeContractDto {
  firstName: string;
  lastName: string;
  personalId: string | null;
  jobTitle: string | null;
  jobDescription?: string | null;
  jobResponsibilities?: string | null;
  jobRequirements?: string | null;
  probationMonths?: number | null;
  /** Department display name for templates */
  departmentName?: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  /** Monthly gross salary string (already normalized), e.g. "850.00" */
  baseSalaryMonthly: string;
  /** Weekly contractual hours, e.g. "40" */
  weeklyHours?: string | null;
  /** Standard monthly hours, when configured for payroll. */
  standardMonthlyHours?: string | null;
}

export interface CompanyContractDto {
  legalName: string;
  tradeName: string | null;
  /** Fiscal / taxpayer number — maps to {{company_nui}} */
  fiscalNumber: string | null;
  /** Business registration — maps to {{company_nrb}} */
  businessRegistrationNumber: string | null;
  /** Legal profile address fallback for {{company_address}} when document settings are empty. */
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface CompanySettingContractDto {
  authorizedRepresentativeName: string | null;
  authorizedRepresentativePosition: string | null;
  companyAddressLine: string | null;
}

export interface ContractRuntimeDto {
  effectiveDate: Date;
  endDate: Date | null;
}

export interface BuildContractContextParams {
  employee: EmployeeContractDto;
  company: CompanyContractDto;
  settings: CompanySettingContractDto | null;
  contract: ContractRuntimeDto;
  /** Optional locale BCP-47 — influences date/number formatting only */
  locale?: string;
}
