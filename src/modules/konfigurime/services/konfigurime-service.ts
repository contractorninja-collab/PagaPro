import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { KonfigurimePayloadValidated } from "@/modules/konfigurime/validation/konfigurime-schemas";
import type { CompanyHolidayDto } from "@/modules/payroll/services/company-holiday-service";
import {
  listCompanyHolidaysDto,
  maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty,
} from "@/modules/payroll/services/company-holiday-service";
import { listDepartmentsWithEmployeeCounts } from "@/modules/departments/services/department-service";
import type { DepartmentWithEmployeeCountDto } from "@/modules/departments/services/department-service";
import { listJobTitlesForCompany, type JobTitleDto } from "@/modules/job-titles/services/job-title-service";
import { syncPayrollSettingsFromKonfigurime } from "@/modules/payroll/services/payroll-settings-service";
import { syncLeaveBalancesForCompanyYear } from "@/modules/leaves/services/leave-balance-service";

export interface KonfigurimeRepresentativeDto {
  id?: string;
  employeeId: string | null;
  fullName: string;
  position: string | null;
  signatureStorageKey: string | null;
  stampStorageKey: string | null;
}

export interface KonfigurimeEmployeeOptionDto {
  id: string;
  fullName: string;
  jobTitle: string | null;
}

export interface KonfigurimePageDto {
  companyId: string;
  company: {
    legalName: string;
    fiscalNumber: string | null;
    businessRegistrationNumber: string | null;
    addressLine: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  representatives: KonfigurimeRepresentativeDto[];
  configuration: {
    minimumSalaryCurrent: string | null;
    minimumSalaryFromJuly1: string | null;
    trustContributionPercent: string | null;
    standardWeeklyHours: string | null;
    contractReferencePrefix: string | null;
    payrollPdfPrefix: string | null;
    generalDocumentPrefix: string | null;
    annualLeaveDaysDefault: string | null;
    personalLeaveDaysDefault: string | null;
    medicalLeaveDaysDefault: string | null;
    workingDaysPerWeek: string | null;
    annualLeaveAccrualMode: "UPFRONT" | "MONTHLY" | "STATUTORY_FIRST_YEAR";
    annualLeaveRoundingMode: "NONE" | "HALF_DAY" | "FULL_DAY";
    allowNegativeAnnualLeaveBalance: boolean;
    medicalLeavePolicyNote: string | null;
    notifyContractExpiring: boolean;
    notifyPayrollReminders: boolean;
    notifyLeaveApprovals: boolean;
    notifyEmployeeWarnings: boolean;
  };
  holidaySettings: {
    defaultYear: number;
    holidays: CompanyHolidayDto[];
  };
  departments: DepartmentWithEmployeeCountDto[];
  jobTitles: JobTitleDto[];
  employees: KonfigurimeEmployeeOptionDto[];
}

function decToString(v: Prisma.Decimal | null | undefined): string | null {
  if (v == null) return null;
  return v.toString();
}

function emptyWebsite(url: string | null | undefined): string | null {
  const s = url?.trim();
  return s ? s : null;
}

export async function loadKonfigurimePageDto(companyId: string): Promise<KonfigurimePageDto | null> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      configuration: true,
      authorizedRepresentatives: { orderBy: { sortOrder: "asc" } },
      settings: true,
    },
  });

  if (!row) return null;

  let representatives: KonfigurimeRepresentativeDto[] = row.authorizedRepresentatives.map((r) => ({
    id: r.id,
    employeeId: r.employeeId ?? null,
    fullName: r.fullName,
    position: r.position ?? null,
    signatureStorageKey: r.signatureStorageKey ?? null,
    stampStorageKey: r.stampStorageKey ?? null,
  }));

  if (!representatives.length && row.settings?.authorizedRepresentativeName) {
    representatives = [
      {
        employeeId: null,
        fullName: row.settings.authorizedRepresentativeName,
        position: row.settings.authorizedRepresentativePosition ?? null,
        signatureStorageKey: row.settings.authorizedSignatureStorageKey ?? null,
        stampStorageKey: row.settings.authorizedStampStorageKey ?? null,
      },
    ];
  }

  if (!representatives.length) {
    representatives = [
      {
        employeeId: null,
        fullName: "",
        position: null,
        signatureStorageKey: null,
        stampStorageKey: null,
      },
    ];
  }

  const cfg = row.configuration;

  const defaultHolidayYear = new Date().getUTCFullYear();
  const [holidays, departments, jobTitles, employeeRows] = await Promise.all([
    listCompanyHolidaysDto(row.id, defaultHolidayYear),
    listDepartmentsWithEmployeeCounts(row.id),
    listJobTitlesForCompany(row.id),
    prisma.employee.findMany({
      where: { companyId: row.id, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const employees: KonfigurimeEmployeeOptionDto[] = employeeRows.map((e) => ({
    id: e.id,
    fullName: `${e.firstName} ${e.lastName}`.trim(),
    jobTitle: e.jobTitle ?? null,
  }));

  return {
    companyId: row.id,
    company: {
      legalName: row.legalName,
      fiscalNumber: row.fiscalNumber ?? null,
      businessRegistrationNumber: row.businessRegistrationNumber ?? null,
      addressLine: row.addressLine ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      website: emptyWebsite(row.website),
    },
    representatives,
    configuration: {
      minimumSalaryCurrent: cfg?.minimumSalaryCurrent != null ? decToString(cfg.minimumSalaryCurrent) : null,
      minimumSalaryFromJuly1:
        cfg?.minimumSalaryFromJuly1 != null ? decToString(cfg.minimumSalaryFromJuly1) : null,
      trustContributionPercent:
        cfg?.trustContributionPercent != null ? decToString(cfg.trustContributionPercent) : null,
      standardWeeklyHours: cfg?.standardWeeklyHours != null ? decToString(cfg.standardWeeklyHours) : null,
      contractReferencePrefix: cfg?.contractReferencePrefix ?? null,
      payrollPdfPrefix: cfg?.payrollPdfPrefix ?? null,
      generalDocumentPrefix: cfg?.generalDocumentPrefix ?? null,
      annualLeaveDaysDefault: cfg?.annualLeaveDaysDefault != null ? decToString(cfg.annualLeaveDaysDefault) : null,
      personalLeaveDaysDefault:
        cfg?.personalLeaveDaysDefault != null ? decToString(cfg.personalLeaveDaysDefault) : null,
      medicalLeaveDaysDefault:
        cfg?.medicalLeaveDaysDefault != null ? decToString(cfg.medicalLeaveDaysDefault) : null,
      workingDaysPerWeek: cfg?.workingDaysPerWeek != null ? decToString(cfg.workingDaysPerWeek) : null,
      annualLeaveAccrualMode: cfg?.annualLeaveAccrualMode ?? "MONTHLY",
      annualLeaveRoundingMode: cfg?.annualLeaveRoundingMode ?? "NONE",
      allowNegativeAnnualLeaveBalance: cfg?.allowNegativeAnnualLeaveBalance ?? false,
      medicalLeavePolicyNote: cfg?.medicalLeavePolicyNote ?? null,
      notifyContractExpiring: cfg?.notifyContractExpiring ?? true,
      notifyPayrollReminders: cfg?.notifyPayrollReminders ?? true,
      notifyLeaveApprovals: cfg?.notifyLeaveApprovals ?? true,
      notifyEmployeeWarnings: cfg?.notifyEmployeeWarnings ?? true,
    },
    holidaySettings: {
      defaultYear: defaultHolidayYear,
      holidays,
    },
    departments,
    jobTitles,
    employees,
  };
}

function normalizeWebsite(v: string | null | undefined): string | null {
  const s = v?.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function configurationPrimitives(payload: KonfigurimePayloadValidated["configuration"]) {
  return {
    minimumSalaryCurrent:
      payload.minimumSalaryCurrent != null ? new Prisma.Decimal(payload.minimumSalaryCurrent) : null,
    minimumSalaryFromJuly1:
      payload.minimumSalaryFromJuly1 != null ? new Prisma.Decimal(payload.minimumSalaryFromJuly1) : null,
    trustContributionPercent:
      payload.trustContributionPercent != null
        ? new Prisma.Decimal(payload.trustContributionPercent)
        : null,
    standardWeeklyHours:
      payload.standardWeeklyHours != null ? new Prisma.Decimal(payload.standardWeeklyHours) : null,
    contractReferencePrefix: payload.contractReferencePrefix ?? null,
    payrollPdfPrefix: payload.payrollPdfPrefix ?? null,
    generalDocumentPrefix: payload.generalDocumentPrefix ?? null,
    annualLeaveDaysDefault:
      payload.annualLeaveDaysDefault != null ? new Prisma.Decimal(payload.annualLeaveDaysDefault) : null,
    personalLeaveDaysDefault:
      payload.personalLeaveDaysDefault != null ? new Prisma.Decimal(payload.personalLeaveDaysDefault) : null,
    medicalLeaveDaysDefault:
      payload.medicalLeaveDaysDefault != null ? new Prisma.Decimal(payload.medicalLeaveDaysDefault) : null,
    workingDaysPerWeek:
      payload.workingDaysPerWeek != null ? new Prisma.Decimal(payload.workingDaysPerWeek) : null,
    annualLeaveAccrualMode: payload.annualLeaveAccrualMode ?? "MONTHLY",
    annualLeaveRoundingMode: payload.annualLeaveRoundingMode ?? "NONE",
    allowNegativeAnnualLeaveBalance: payload.allowNegativeAnnualLeaveBalance ?? false,
    medicalLeavePolicyNote: payload.medicalLeavePolicyNote ?? null,
    notifyContractExpiring: payload.notifyContractExpiring,
    notifyPayrollReminders: payload.notifyPayrollReminders,
    notifyLeaveApprovals: payload.notifyLeaveApprovals,
    notifyEmployeeWarnings: payload.notifyEmployeeWarnings,
  };
}

async function syncActivePayrollParameterSet(
  tx: Prisma.TransactionClient,
  companyId: string,
  payload: KonfigurimePayloadValidated,
) {
  const now = new Date();
  const active = await tx.payrollParameterSet.findFirst({
    where: {
      companyId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!active) return;

  const data: Prisma.PayrollParameterSetUpdateInput = {};
  const cfg = payload.configuration;

  if (cfg.minimumSalaryCurrent != null) {
    data.minimumMonthlyWage = new Prisma.Decimal(cfg.minimumSalaryCurrent);
  }

  /// Same Trust rate on gross for employee and employer; Konfigurime value is percent points (e.g. 5 → 5% each).
  if (cfg.trustContributionPercent != null) {
    const rate = cfg.trustContributionPercent / 100;
    data.pensionEmployeeRate = new Prisma.Decimal(rate);
    data.pensionEmployerRate = new Prisma.Decimal(rate);
  }

  if (Object.keys(data).length === 0) return;

  await tx.payrollParameterSet.update({
    where: { id: active.id },
    data,
  });
}

export async function persistKonfigurimeSave(
  companyId: string,
  payload: KonfigurimePayloadValidated,
  assetKeys: Map<number, { signatureStorageKey?: string; stampStorageKey?: string }>,
): Promise<void> {
  const priorLeaveConfig = await prisma.companyConfiguration.findUnique({
    where: { companyId },
    select: {
      medicalLeaveDaysDefault: true,
      annualLeaveDaysDefault: true,
      workingDaysPerWeek: true,
    },
  });

  const hadPayrollSettings = await prisma.payrollSettings.findUnique({
    where: { companyId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: {
        legalName: payload.company.legalName.trim(),
        fiscalNumber: payload.company.fiscalNumber ?? null,
        businessRegistrationNumber: payload.company.businessRegistrationNumber ?? null,
        addressLine: payload.company.addressLine ?? null,
        email: payload.company.email ?? null,
        phone: payload.company.phone ?? null,
        website: normalizeWebsite(payload.company.website ?? null),
      },
    });

    const cfgData = configurationPrimitives(payload.configuration);

    await tx.companyConfiguration.upsert({
      where: { companyId },
      create: { companyId, ...cfgData },
      update: cfgData,
    });

    const employeeIds = Array.from(new Set(payload.representatives.map((r) => r.employeeId)));
    const employeeRows = await tx.employee.findMany({
      where: { id: { in: employeeIds }, companyId },
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
    });
    const employeeById = new Map(employeeRows.map((e) => [e.id, e]));

    const reps = payload.representatives.map((r, idx) => {
      const patch = assetKeys.get(idx);
      const employee = employeeById.get(r.employeeId);
      if (!employee) {
        throw new Error("REPRESENTATIVE_EMPLOYEE_NOT_FOUND");
      }
      const jobTitle = employee.jobTitle?.trim();
      if (!jobTitle) {
        throw new Error("REPRESENTATIVE_EMPLOYEE_MISSING_JOB_TITLE");
      }
      return {
        companyId,
        sortOrder: idx,
        employeeId: employee.id,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        position: jobTitle,
        signatureStorageKey:
          patch?.signatureStorageKey ?? r.signatureStorageKey ?? null,
        stampStorageKey: patch?.stampStorageKey ?? r.stampStorageKey ?? null,
      };
    });

    await tx.authorizedRepresentative.deleteMany({ where: { companyId } });
    if (reps.length > 0) {
      await tx.authorizedRepresentative.createMany({ data: reps });
    }

    const primary = reps[0];
    await tx.companySetting.upsert({
      where: { companyId },
      create: {
        companyId,
        authorizedRepresentativeName: primary?.fullName ?? null,
        authorizedRepresentativePosition: primary?.position ?? null,
        authorizedSignatureStorageKey: primary?.signatureStorageKey ?? null,
        authorizedStampStorageKey: primary?.stampStorageKey ?? null,
      },
      update: {
        authorizedRepresentativeName: primary?.fullName ?? null,
        authorizedRepresentativePosition: primary?.position ?? null,
        authorizedSignatureStorageKey: primary?.signatureStorageKey ?? null,
        authorizedStampStorageKey: primary?.stampStorageKey ?? null,
      },
    });

    await syncActivePayrollParameterSet(tx, companyId, payload);
    await syncPayrollSettingsFromKonfigurime(tx, companyId, payload);
  });

  if (!hadPayrollSettings) {
    const created = await prisma.payrollSettings.findUnique({
      where: { companyId },
      select: { id: true },
    });
    if (created) {
      await maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty(companyId);
    }
  }

  const leaveConfigChanged =
    decToString(priorLeaveConfig?.medicalLeaveDaysDefault ?? null) !==
      (payload.configuration.medicalLeaveDaysDefault != null
        ? String(payload.configuration.medicalLeaveDaysDefault)
        : null) ||
    decToString(priorLeaveConfig?.annualLeaveDaysDefault ?? null) !==
      (payload.configuration.annualLeaveDaysDefault != null
        ? String(payload.configuration.annualLeaveDaysDefault)
        : null) ||
    decToString(priorLeaveConfig?.workingDaysPerWeek ?? null) !==
      (payload.configuration.workingDaysPerWeek != null
        ? String(payload.configuration.workingDaysPerWeek)
        : null);

  if (leaveConfigChanged) {
    const year = new Date().getUTCFullYear();
    await syncLeaveBalancesForCompanyYear(companyId, year);
    await syncLeaveBalancesForCompanyYear(companyId, year - 1);
  }
}

/** Read helpers for payroll / leave / documents engines — fetch merged company configuration. */
export async function getCompanyConfigurationRecord(companyId: string) {
  return prisma.companyConfiguration.findUnique({
    where: { companyId },
  });
}

/** Single fetch for payroll / documents / leave / notification pipelines. */
export async function getCompanyOperationalSnapshot(companyId: string) {
  const c = await prisma.companyConfiguration.findUnique({
    where: { companyId },
  });
  if (!c) return null;

  return {
    payroll: {
      minimumSalaryCurrent: c.minimumSalaryCurrent,
      minimumSalaryFromJuly1: c.minimumSalaryFromJuly1,
      trustContributionPercent: c.trustContributionPercent,
      standardWeeklyHours: c.standardWeeklyHours,
    },
    documents: {
      contractReferencePrefix: c.contractReferencePrefix,
      payrollPdfPrefix: c.payrollPdfPrefix,
      generalDocumentPrefix: c.generalDocumentPrefix,
    },
    leave: {
      annualLeaveDaysDefault: c.annualLeaveDaysDefault,
      personalLeaveDaysDefault: c.personalLeaveDaysDefault,
      medicalLeaveDaysDefault: c.medicalLeaveDaysDefault,
      workingDaysPerWeek: c.workingDaysPerWeek,
      annualLeaveAccrualMode: c.annualLeaveAccrualMode,
      annualLeaveRoundingMode: c.annualLeaveRoundingMode,
      allowNegativeAnnualLeaveBalance: c.allowNegativeAnnualLeaveBalance,
      medicalLeavePolicyNote: c.medicalLeavePolicyNote,
    },
    notifications: {
      notifyContractExpiring: c.notifyContractExpiring,
      notifyPayrollReminders: c.notifyPayrollReminders,
      notifyLeaveApprovals: c.notifyLeaveApprovals,
      notifyEmployeeWarnings: c.notifyEmployeeWarnings,
    },
  };
}
