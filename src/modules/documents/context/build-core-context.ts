import type { CompanyContractDto, CompanySettingContractDto, EmployeeContractDto } from "./types";
import { formatMoneyEUR } from "./format";

export interface BuildCoreOrganizationalContextParams {
  employee: EmployeeContractDto;
  company: CompanyContractDto;
  settings: CompanySettingContractDto | null;
  locale?: string;
}

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

function resolveCompanyAddress(company: CompanyContractDto, settings: CompanySettingContractDto | null): string {
  return (
    settings?.companyAddressLine?.trim() ||
    joinAddress([company.addressLine, company.postalCode, company.city, company.country])
  );
}

function resolveDocumentPlace(company: CompanyContractDto, settings: CompanySettingContractDto | null): string {
  const configuredAddress = settings?.companyAddressLine?.trim() || company.addressLine?.trim();
  if (configuredAddress) {
    const parts = configuredAddress
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const candidate = parts.at(-1) ?? configuredAddress;
    const withoutPostalCode = candidate.replace(/\b\d{4,6}\b/g, "").trim();
    if (withoutPostalCode) return withoutPostalCode;
  }

  return company.city?.trim() || "Prishtinë";
}

function stripTrailingZeros(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function resolveDailyHours(weeklyHours: string | null | undefined): string {
  const weekly = Number(String(weeklyHours ?? "").replace(",", "."));
  if (!Number.isFinite(weekly) || weekly <= 0) return "";
  const daily = weekly / 5;
  return stripTrailingZeros(daily.toFixed(2));
}

function formatProbationPeriod(months: number | null | undefined): string {
  if (months == null || months <= 0) return "";
  return `${months} Muaj`;
}

/** Company letterhead slice when no employee is bound (OTHER / annex templates). */
export function buildCompanyScopedPlaceholderContext(params: {
  company: CompanyContractDto;
  settings: CompanySettingContractDto | null;
  locale?: string;
}): Record<string, string> {
  const { company, settings } = params;
  const displayCompanyName = company.tradeName?.trim() || company.legalName;
  const address = resolveCompanyAddress(company, settings);

  return {
    employee_name: "",
    employee_last_name: "",
    employee_position: "",
    employee_job_description: "",
    employee_job_responsibilities: "",
    employee_job_requirements: "",
    probation_months: "",
    probation_period: "",
    employee_personal_number: "",
    employee_department: "",
    employee_address: "",
    salary_gross: "",
    company_name: displayCompanyName,
    company_nui: company.fiscalNumber ?? "",
    company_nrb: company.businessRegistrationNumber ?? "",
    company_address: address,
    company_city: company.city ?? "",
    document_place: resolveDocumentPlace(company, settings),
    authorized_person: settings?.authorizedRepresentativeName ?? "",
    authorized_person_name: settings?.authorizedRepresentativeName ?? "",
    authorized_position: settings?.authorizedRepresentativePosition ?? "",
    authorized_person_position: settings?.authorizedRepresentativePosition ?? "",
    ...(address ? { company_registered_address: address } : {}),
  };
}

/** Employee + company + settings slice shared by every document category */
export function buildCoreOrganizationalContext(
  params: BuildCoreOrganizationalContextParams,
): Record<string, string> {
  const { employee, company, settings } = params;

  const employeeAddress = joinAddress([
    employee.addressLine,
    employee.addressCity,
    employee.addressCountry,
  ]);

  const displayCompanyName = company.tradeName?.trim() || company.legalName;
  const address = resolveCompanyAddress(company, settings);

  const ctx: Record<string, string> = {
    employee_first_name: employee.firstName ?? "",
    employee_last_name: employee.lastName ?? "",
    employee_full_name: `${employee.firstName} ${employee.lastName}`.trim(),
    employee_name: `${employee.firstName} ${employee.lastName}`.trim(),
    employee_position: employee.jobTitle ?? "",
    employee_job_description: employee.jobDescription ?? "",
    employee_job_responsibilities: employee.jobResponsibilities ?? "",
    employee_job_requirements: employee.jobRequirements ?? "",
    probation_months: employee.probationMonths && employee.probationMonths > 0 ? String(employee.probationMonths) : "",
    probation_period: formatProbationPeriod(employee.probationMonths),
    employee_personal_number: employee.personalId ?? "",
    employee_department: employee.departmentName?.trim() ?? "",
    employee_address: employeeAddress,
    employee_city: employee.addressCity ?? "",
    salary_gross: formatMoneyEUR(employee.baseSalaryMonthly),
    salary_gross_words: employee.baseSalaryMonthly,
    weekly_hours: stripTrailingZeros(employee.weeklyHours),
    daily_hours: resolveDailyHours(employee.weeklyHours),
    monthly_hours: stripTrailingZeros(employee.standardMonthlyHours),
    company_name: displayCompanyName,
    company_nui: company.fiscalNumber ?? "",
    company_nrb: company.businessRegistrationNumber ?? "",
    company_address: address,
    company_city: company.city ?? "",
    company_phone: "",
    company_email: "",
    company_website: "",
    authorized_person: settings?.authorizedRepresentativeName ?? "",
    authorized_person_name: settings?.authorizedRepresentativeName ?? "",
    authorized_position: settings?.authorizedRepresentativePosition ?? "",
    authorized_person_position: settings?.authorizedRepresentativePosition ?? "",
    document_place: resolveDocumentPlace(company, settings),
  };

  if (address) {
    ctx.company_registered_address = address;
  }

  return ctx;
}
