import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { KonfigurimePayloadValidated } from "@/modules/konfigurime/validation/konfigurime-schemas";
import type { CompanyHolidayDto } from "@/modules/payroll/services/company-holiday-service";
import {
  listCompanyHolidaysDto,
  maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty,
} from "@/modules/payroll/services/company-holiday-service";
import { syncPayrollSettingsFromKonfigurime } from "@/modules/payroll/services/payroll-settings-service";

export interface KonfigurimeRepresentativeDto {
  id?: string;
  fullName: string;
  position: string | null;
  signatureStorageKey: string | null;
  stampStorageKey: string | null;
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
    fullName: r.fullName,
    position: r.position ?? null,
    signatureStorageKey: r.signatureStorageKey ?? null,
    stampStorageKey: r.stampStorageKey ?? null,
  }));

  if (!representatives.length && row.settings?.authorizedRepresentativeName) {
    representatives = [
      {
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
        fullName: "",
        position: null,
        signatureStorageKey: null,
        stampStorageKey: null,
      },
    ];
  }

  const cfg = row.configuration;

  const defaultHolidayYear = new Date().getUTCFullYear();
  const holidays = await listCompanyHolidaysDto(row.id, defaultHolidayYear);

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

    const reps = payload.representatives.map((r, idx) => {
      const patch = assetKeys.get(idx);
      return {
        companyId,
        sortOrder: idx,
        fullName: r.fullName.trim(),
        position: r.position ?? null,
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
