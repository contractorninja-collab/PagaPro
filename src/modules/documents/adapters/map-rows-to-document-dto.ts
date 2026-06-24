import type {
  CompanyContractDto,
  CompanySettingContractDto,
  EmployeeContractDto,
} from "../context/types";

/** Bridges Prisma (or API) shapes to template engine DTOs — no `@prisma/client` import required. */
export function mapEmployeeRowToContractDto(row: {
  firstName: string;
  lastName: string;
  personalId: string | null;
  jobTitle?: string | null;
  departmentName?: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  baseSalaryMonthly: string | { toFixed(n: number): string };
  weeklyHours?: string | { toFixed(n: number): string } | null;
  standardMonthlyHours?: string | { toFixed(n: number): string } | null;
}): EmployeeContractDto {
  const gross =
    typeof row.baseSalaryMonthly === "string"
      ? row.baseSalaryMonthly
      : row.baseSalaryMonthly.toFixed(2);
  const weeklyHours =
    row.weeklyHours == null
      ? null
      : typeof row.weeklyHours === "string"
        ? row.weeklyHours
        : row.weeklyHours.toFixed(2);
  const standardMonthlyHours =
    row.standardMonthlyHours == null
      ? null
      : typeof row.standardMonthlyHours === "string"
        ? row.standardMonthlyHours
        : row.standardMonthlyHours.toFixed(2);

  return {
    firstName: row.firstName,
    lastName: row.lastName,
    personalId: row.personalId,
    jobTitle: row.jobTitle ?? null,
    departmentName: row.departmentName ?? undefined,
    addressLine: row.addressLine,
    addressCity: row.addressCity,
    addressCountry: row.addressCountry,
    baseSalaryMonthly: gross,
    weeklyHours,
    standardMonthlyHours,
  };
}

export function mapCompanyRowToContractDto(row: {
  legalName: string;
  tradeName: string | null;
  fiscalNumber: string | null;
  businessRegistrationNumber: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): CompanyContractDto {
  return {
    legalName: row.legalName,
    tradeName: row.tradeName,
    fiscalNumber: row.fiscalNumber,
    businessRegistrationNumber: row.businessRegistrationNumber,
    addressLine: row.addressLine ?? null,
    city: row.city ?? null,
    postalCode: row.postalCode ?? null,
    country: row.country ?? null,
  };
}

export function mapCompanySettingRowToContractDto(
  row: {
    authorizedRepresentativeName: string | null;
    authorizedRepresentativePosition: string | null;
    companyAddressLine: string | null;
  } | null,
): CompanySettingContractDto | null {
  if (!row) return null;
  return {
    authorizedRepresentativeName: row.authorizedRepresentativeName,
    authorizedRepresentativePosition: row.authorizedRepresentativePosition,
    companyAddressLine: row.companyAddressLine,
  };
}
