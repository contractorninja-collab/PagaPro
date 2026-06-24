import type { EmployerPrimacy, EmploymentType } from "@prisma/client";

/** Excel columns we populate (matched by Albanian header text in the official template). */
export type AtkColumnKey =
  | "firstName"
  | "lastName"
  | "personalId"
  | "grossSalary"
  | "pensionEmployee"
  | "pensionEmployer"
  | "pensionSupplementEmployee"
  | "pensionSupplementEmployer"
  | "primaryWork"
  | "includeContributions"
  | "applyPayrollTax";

export type AtkRowSource = {
  entryId: string;
  employmentTypeSnapshot: EmploymentType;
  employerPrimacySnapshot: EmployerPrimacy;
  grossSalary: string;
  pensionEmployee: string;
  pensionEmployer: string;
  employee: {
    firstName: string;
    lastName: string;
    personalId: string;
    applyTrust: boolean;
    applyTax: boolean;
  };
};

export function poJo(v: boolean): "Po" | "Jo" {
  return v ? "Po" : "Jo";
}

/** Contractors excluded upstream — never pass CONTRACTOR rows here. */
export function mapSourceToAtkCellStrings(input: AtkRowSource): Record<AtkColumnKey, string> {
  const primary = input.employerPrimacySnapshot === "PRIMARY";
  return {
    firstName: input.employee.firstName.trim(),
    lastName: input.employee.lastName.trim(),
    personalId: input.employee.personalId.trim(),
    grossSalary: input.grossSalary.trim(),
    pensionEmployee: input.pensionEmployee.trim(),
    pensionEmployer: input.pensionEmployer.trim(),
    pensionSupplementEmployee: "0",
    pensionSupplementEmployer: "0",
    primaryWork: poJo(primary),
    includeContributions: poJo(input.employee.applyTrust),
    applyPayrollTax: poJo(input.employee.applyTax),
  };
}

export function filterAtkEligibleRows<T extends { employmentTypeSnapshot: EmploymentType }>(entries: T[]): T[] {
  return entries.filter((e) => e.employmentTypeSnapshot !== "CONTRACTOR");
}

/** Stable ordered snapshot for SHA-256 (finance-grade reproducibility). */
export function atkSnapshotCanonicalParts(
  payrollId: string,
  payrollStatus: string,
  rows: AtkRowSource[],
): unknown[] {
  const sorted = [...rows].sort((a, b) =>
    a.employee.personalId.localeCompare(b.employee.personalId, "sq", { sensitivity: "base" }),
  );
  return sorted.map((r) => ({
    payrollId,
    payrollStatus,
    entryId: r.entryId,
    personalId: r.employee.personalId,
    employmentTypeSnapshot: r.employmentTypeSnapshot,
    employerPrimacySnapshot: r.employerPrimacySnapshot,
    grossSalary: r.grossSalary,
    pensionEmployee: r.pensionEmployee,
    pensionEmployer: r.pensionEmployer,
    applyTrust: r.employee.applyTrust,
    applyTax: r.employee.applyTax,
    firstName: r.employee.firstName,
    lastName: r.employee.lastName,
    supplementalEmployee: "0",
    supplementalEmployer: "0",
  }));
}
