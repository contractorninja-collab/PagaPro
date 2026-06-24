import type {

  CompanyContractDto,

  CompanySettingContractDto,

  EmployeeContractDto,

} from "../../documents/context/types";



/** Bridges Prisma (or API) shapes to template engine DTOs — no `@prisma/client` import required. */

export function mapEmployeeRowToContractDto(row: {

  firstName: string;

  lastName: string;

  personalId: string | null;

  jobTitle?: string | null;

  addressLine: string | null;

  addressCity: string | null;

  addressCountry: string | null;

  baseSalaryMonthly: string | { toFixed(n: number): string };

}): EmployeeContractDto {

  const gross =

    typeof row.baseSalaryMonthly === "string"

      ? row.baseSalaryMonthly

      : row.baseSalaryMonthly.toFixed(2);



  return {

    firstName: row.firstName,

    lastName: row.lastName,

    personalId: row.personalId,

    jobTitle: row.jobTitle ?? null,

    addressLine: row.addressLine,

    addressCity: row.addressCity,

    addressCountry: row.addressCountry,

    baseSalaryMonthly: gross,

  };

}



export function mapCompanyRowToContractDto(row: {

  legalName: string;

  tradeName: string | null;

  fiscalNumber: string | null;

  businessRegistrationNumber: string | null;

}): CompanyContractDto {

  return {

    legalName: row.legalName,

    tradeName: row.tradeName,

    fiscalNumber: row.fiscalNumber,

    businessRegistrationNumber: row.businessRegistrationNumber,

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

