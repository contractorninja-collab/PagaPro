import type { DocumentSubjectKind, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { formatTemplateDate } from "../context/format";
import { buildMergedPlaceholderContext } from "../services/build-placeholder-context";
import type { PlaceholderValidationError } from "../types/template-mapping";
import {
  parseMappingJson,
  validateResolvedValues,
} from "../validators/document-template-validator";

export interface ResolvePlaceholderValuesInput {
  companyId: string;
  employeeId?: string | null;
  payrollId?: string | null;
  templateVersionId: string;
  subjectKind: DocumentSubjectKind;
  subjectId: string;
  documentInput?: {
    documentDateIso?: string;
    documentPlace?: string;
    contractStartDateIso?: string;
    contractEndDateIso?: string | null;
    manualOverrides?: Record<string, string>;
  };
}

export interface ResolvePlaceholderValuesResult {
  values: Record<string, string>;
  errors: PlaceholderValidationError[];
}

function parseOptionalDate(iso?: string): Date | undefined {
  if (!iso?.trim()) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function resolvePlaceholderValues(
  input: ResolvePlaceholderValuesInput,
  db: PrismaClient = defaultPrisma,
): Promise<ResolvePlaceholderValuesResult> {
  const version = await db.documentTemplateVersion.findFirst({
    where: { id: input.templateVersionId, template: { companyId: input.companyId } },
    include: { template: true },
  });
  if (!version) {
    return { values: {}, errors: [{ key: "_", label: "Shabllon", message: "Versioni i shabllonit nuk u gjet." }] };
  }

  const documentDate = parseOptionalDate(input.documentInput?.documentDateIso) ?? new Date();
  const contractStartDate = parseOptionalDate(input.documentInput?.contractStartDateIso);
  const contractEndDate =
    input.documentInput?.contractEndDateIso === null
      ? null
      : parseOptionalDate(input.documentInput?.contractEndDateIso);

  const ctx = await buildMergedPlaceholderContext(db, {
    companyId: input.companyId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    employeeId: input.employeeId,
    payrollId: input.payrollId,
    documentDate,
    contractStartDate,
    contractEndDate,
  });

  const values: Record<string, string> = { ...ctx.merged };

  if (input.documentInput?.documentPlace?.trim()) {
    values.document_place = input.documentInput.documentPlace.trim();
  }
  values.document_date = formatTemplateDate(documentDate, "sq-AL");

  if (input.employeeId) {
    const employee = await db.employee.findFirst({
      where: { id: input.employeeId, companyId: input.companyId },
      include: {
        department: { select: { name: true } },
        bankAccounts: { where: { isPrimary: true }, take: 1 },
      },
    });
    if (employee) {
      values.employee_birth_date = employee.dateOfBirth
        ? formatTemplateDate(employee.dateOfBirth, "sq-AL")
        : "";
      values.employee_gender = employee.gender ?? "";
      values.employee_phone = employee.phone ?? "";
      values.employee_email = employee.email ?? "";
      values.employee_city = employee.addressCity ?? "";
      values.employment_start_date = formatTemplateDate(employee.hireDate, "sq-AL");
      values.employment_end_date = employee.terminationDate
        ? formatTemplateDate(employee.terminationDate, "sq-AL")
        : "";
      values.employment_type = employee.employmentType;
      values.work_type = employee.workArrangement;
      values.weekly_hours = String(employee.weeklyHours);
      values.monthly_hours = employee.standardMonthlyHours
        ? String(employee.standardMonthlyHours)
        : "";
      values.apply_pension = employee.applyTrust ? "Po" : "Jo";
      values.apply_tax = employee.applyTax ? "Po" : "Jo";
      values.bank_name = employee.bankName ?? employee.bankAccounts[0]?.bankName ?? "";
      values.iban = employee.bankAccounts[0]?.iban ?? "";
      values.employee_department = employee.department?.name ?? values.employee_department ?? "";
    }
  }

  const company = await db.company.findUnique({
    where: { id: input.companyId },
    select: { email: true, phone: true, website: true, city: true },
  });
  if (company) {
    values.company_email = company.email ?? "";
    values.company_phone = company.phone ?? "";
    values.company_website = company.website ?? "";
    if (!values.company_city) values.company_city = company.city ?? "";
  }

  const overrides = input.documentInput?.manualOverrides ?? {};
  for (const [k, v] of Object.entries(overrides)) {
    values[k] = v;
  }

  const mapping = parseMappingJson(version.mappingJson);
  const errors = mapping ? validateResolvedValues(mapping, values) : [];

  return { values, errors };
}
