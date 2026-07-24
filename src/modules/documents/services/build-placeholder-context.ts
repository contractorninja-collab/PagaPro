import type { DocumentSubjectKind, PrismaClient } from "@prisma/client";
import {
  mapCompanyRowToContractDto,
  mapCompanySettingRowToContractDto,
  mapEmployeeRowToContractDto,
} from "../adapters/map-rows-to-document-dto";
import { buildContractPlaceholderContext } from "../context/build-contract-context";
import {
  buildCompanyScopedPlaceholderContext,
  buildCoreOrganizationalContext,
} from "../context/build-core-context";
import { buildLeavePlaceholderMap } from "../context/leave-context";
import { mergeDocumentMetadata } from "../context/merge-metadata";
import { buildTerminationPlaceholderMap } from "../context/termination-context";
import { buildWarningPlaceholderMap } from "../context/warning-context";
import { formatTemplateDate } from "../context/format";
import { payrollMonthLabel } from "../storage/filename-builder";

export interface BuildMergedPlaceholderContextParams {
  companyId: string;
  subjectKind: DocumentSubjectKind;
  subjectId: string;
  employeeId?: string | null;
  payrollId?: string | null;
  documentDate: Date;
  /** User-selected contract start (overrides employee.hireDate when set). */
  contractStartDate?: Date | null;
  /** User-selected contract end for fixed-term templates (overrides employee.terminationDate). */
  contractEndDate?: Date | null;
  locale?: string;
}

export interface BuildMergedPlaceholderContextResult {
  merged: Record<string, string>;
  resolvedEmployeeId: string | null;
  resolvedPayrollId: string | null;
}

async function loadCompanySlice(
  prisma: PrismaClient,
  companyId: string,
): Promise<{
  companyDto: ReturnType<typeof mapCompanyRowToContractDto>;
  settingsDto: ReturnType<typeof mapCompanySettingRowToContractDto>;
}> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      legalName: true,
      tradeName: true,
      fiscalNumber: true,
      businessRegistrationNumber: true,
      addressLine: true,
      city: true,
      postalCode: true,
      country: true,
    },
  });
  if (!company) {
    throw new Error("Kompania nuk u gjet.");
  }
  const settings = await prisma.companySetting.findUnique({
    where: { companyId },
    select: {
      authorizedRepresentativeName: true,
      authorizedRepresentativePosition: true,
      companyAddressLine: true,
    },
  });
  return {
    companyDto: mapCompanyRowToContractDto(company),
    settingsDto: mapCompanySettingRowToContractDto(settings),
  };
}

function withDocDate(
  base: Record<string, string>,
  documentDate: Date,
  locale: string,
): Record<string, string> {
  return mergeDocumentMetadata(base, {
    document_date: formatTemplateDate(documentDate, locale),
  });
}

/**
 * Resolves DB entities into a flat placeholder map for docxtemplater.
 */
export async function buildMergedPlaceholderContext(
  prisma: PrismaClient,
  params: BuildMergedPlaceholderContextParams,
): Promise<BuildMergedPlaceholderContextResult> {
  const locale = params.locale ?? "sq-AL";
  const { companyDto, settingsDto } = await loadCompanySlice(prisma, params.companyId);

  const coreFromEmployeeRow = (
    row: {
      firstName: string;
      lastName: string;
      personalId: string;
      jobTitle: string | null;
      jobTitleProfile?: {
        description: string;
        responsibilities: string | null;
        requirements: string | null;
      } | null;
      probationMonths?: number | null;
      departmentName?: string | null;
      addressLine: string | null;
      addressCity: string | null;
      addressCountry: string | null;
      workplace?: string | null;
      baseSalaryMonthly: { toFixed(n: number): string };
      weeklyHours?: { toFixed(n: number): string } | null;
      standardMonthlyHours?: { toFixed(n: number): string } | null;
    },
    resolvedEmployeeId: string,
  ): BuildMergedPlaceholderContextResult => {
    const empDto = mapEmployeeRowToContractDto({
      firstName: row.firstName,
      lastName: row.lastName,
      personalId: row.personalId,
      jobTitle: row.jobTitle,
      jobDescription: row.jobTitleProfile?.description ?? null,
      jobResponsibilities: row.jobTitleProfile?.responsibilities ?? null,
      jobRequirements: row.jobTitleProfile?.requirements ?? null,
      probationMonths: row.probationMonths ?? null,
      departmentName: row.departmentName,
      addressLine: row.addressLine,
      addressCity: row.addressCity,
      addressCountry: row.addressCountry,
      workplace: row.workplace ?? null,
      baseSalaryMonthly: row.baseSalaryMonthly,
      weeklyHours: row.weeklyHours ?? null,
      standardMonthlyHours: row.standardMonthlyHours ?? null,
    });
    const core = buildCoreOrganizationalContext({
      employee: empDto,
      company: companyDto,
      settings: settingsDto,
      locale,
    });
    return {
      merged: withDocDate(core, params.documentDate, locale),
      resolvedEmployeeId,
      resolvedPayrollId: params.payrollId ?? null,
    };
  };

  switch (params.subjectKind) {
    case "CONTRACT": {
      const resolveContractDates = (fallbackStart: Date, fallbackEnd: Date | null) => ({
        effectiveDate: params.contractStartDate ?? fallbackStart,
        endDate: params.contractEndDate !== undefined ? params.contractEndDate : fallbackEnd,
      });

      // Employee-driven path: contracts are generated straight from employee data.
      if (params.employeeId) {
        const employee = await prisma.employee.findFirst({
          where: { id: params.employeeId, companyId: params.companyId },
          include: {
            department: { select: { name: true } },
            jobTitleProfile: {
              select: {
                description: true,
                responsibilities: true,
                requirements: true,
              },
            },
          },
        });
        if (!employee) throw new Error("Punonjësi nuk u gjet.");
        const dates = resolveContractDates(employee.hireDate, employee.terminationDate ?? null);
        const placeholderCtx = buildContractPlaceholderContext({
          employee: mapEmployeeRowToContractDto({
            firstName: employee.firstName,
            lastName: employee.lastName,
            personalId: employee.personalId,
            jobTitle: employee.jobTitle,
            jobDescription: employee.jobTitleProfile?.description ?? null,
            jobResponsibilities: employee.jobTitleProfile?.responsibilities ?? null,
            jobRequirements: employee.jobTitleProfile?.requirements ?? null,
            probationMonths: employee.probationMonths,
            departmentName: employee.department?.name ?? null,
            addressLine: employee.addressLine,
            addressCity: employee.addressCity,
            addressCountry: employee.addressCountry,
            workplace: employee.workplace,
            baseSalaryMonthly: employee.baseSalaryMonthly,
            weeklyHours: employee.weeklyHours,
            standardMonthlyHours: employee.standardMonthlyHours,
          }),
          company: companyDto,
          settings: settingsDto,
          contract: dates,
          locale,
        });
        return {
          merged: withDocDate(placeholderCtx, params.documentDate, locale),
          resolvedEmployeeId: employee.id,
          resolvedPayrollId: params.payrollId ?? null,
        };
      }

      // Back-compat: subjectId refers to a Contract row (legacy artifacts / regeneration).
      const contract = await prisma.contract.findFirst({
        where: { id: params.subjectId, companyId: params.companyId },
        include: {
          employee: {
            include: {
              jobTitleProfile: {
                select: {
                  description: true,
                  responsibilities: true,
                  requirements: true,
                },
              },
            },
          },
        },
      });
      if (!contract) throw new Error("Kontrata nuk u gjet.");
      const { employee } = contract;
      const dates = resolveContractDates(contract.effectiveDate, contract.endDate);
      const placeholderCtx = buildContractPlaceholderContext({
        employee: mapEmployeeRowToContractDto({
          firstName: employee.firstName,
          lastName: employee.lastName,
          personalId: employee.personalId,
          jobTitle: contract.jobTitleSnapshot ?? employee.jobTitle,
          jobDescription: contract.jobDescriptionSnapshot ?? employee.jobTitleProfile?.description ?? null,
          jobResponsibilities: contract.jobResponsibilitiesSnapshot ?? employee.jobTitleProfile?.responsibilities ?? null,
          jobRequirements: contract.jobRequirementsSnapshot ?? employee.jobTitleProfile?.requirements ?? null,
          probationMonths: employee.probationMonths,
          addressLine: employee.addressLine,
          addressCity: employee.addressCity,
          addressCountry: employee.addressCountry,
          workplace: employee.workplace,
          baseSalaryMonthly: employee.baseSalaryMonthly,
          weeklyHours: employee.weeklyHours,
          standardMonthlyHours: employee.standardMonthlyHours,
        }),
        company: companyDto,
        settings: settingsDto,
        contract: dates,
        locale,
      });
      return {
        merged: withDocDate(placeholderCtx, params.documentDate, locale),
        resolvedEmployeeId: employee.id,
        resolvedPayrollId: params.payrollId ?? null,
      };
    }
    case "LEAVE": {
      const lr = await prisma.leaveRequest.findFirst({
        where: { id: params.subjectId, companyId: params.companyId },
        include: { employee: true },
      });
      if (!lr) throw new Error("Kërkesa e pushimit nuk u gjet.");
      const { employee } = lr;
      const empCore = coreFromEmployeeRow(employee, employee.id);
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          companyId_employeeId_leaveType_year: {
            companyId: params.companyId,
            employeeId: employee.id,
            leaveType: lr.type,
            year: lr.startDate.getUTCFullYear(),
          },
        },
        select: { yearlyQuota: true, usedDays: true, remainingDays: true, carryOverDays: true },
      });
      const leaveSlice = buildLeavePlaceholderMap(
        {
          startDate: lr.startDate,
          endDate: lr.endDate,
          type: lr.type,
          subtype: lr.subtype,
          status: lr.status,
          reason: lr.reason,
          workingDays: lr.workingDays,
          totalDays: lr.totalDays,
          decidedAt: lr.decidedAt,
          isPaid: lr.isPaid,
        },
        balance,
        locale,
      );
      return {
        merged: mergeDocumentMetadata(empCore.merged, leaveSlice),
        resolvedEmployeeId: employee.id,
        resolvedPayrollId: params.payrollId ?? null,
      };
    }
    case "TERMINATION": {
      const term = await prisma.termination.findFirst({
        where: { id: params.subjectId, companyId: params.companyId },
        include: { employee: { include: { department: { select: { name: true } } } } },
      });
      if (!term) throw new Error("Ndërprerja nuk u gjet.");
      const { employee } = term;
      const empCore = coreFromEmployeeRow(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          personalId: employee.personalId,
          jobTitle: employee.jobTitle,
          departmentName: employee.department?.name ?? null,
          addressLine: employee.addressLine,
          addressCity: employee.addressCity,
          addressCountry: employee.addressCountry,
          workplace: employee.workplace,
          baseSalaryMonthly: employee.baseSalaryMonthly,
        },
        employee.id,
      );
      const termSlice = {
        ...buildTerminationPlaceholderMap(
          {
            terminationDate: term.terminationDate,
            lastWorkingDay: term.lastWorkingDay,
            noticeDate: term.noticeDate,
            type: term.type,
            status: term.status,
            noticeDays: term.noticeDays,
            severanceAmount: term.severanceAmount,
            reason: term.reason,
            details: term.details,
          },
          locale,
        ),
        employment_start_date: formatTemplateDate(employee.hireDate, locale),
      };
      return {
        merged: mergeDocumentMetadata(empCore.merged, termSlice),
        resolvedEmployeeId: employee.id,
        resolvedPayrollId: params.payrollId ?? null,
      };
    }
    case "WARNING": {
      const w = await prisma.disciplinaryWarning.findFirst({
        where: { id: params.subjectId, companyId: params.companyId },
        include: { employee: true },
      });
      if (!w) throw new Error("Vërejtja nuk u gjet.");
      const { employee } = w;
      const empCore = coreFromEmployeeRow(employee, employee.id);
      const warnSlice = buildWarningPlaceholderMap(
        {
          issuedAt: w.issuedAt,
          summary: w.summary,
          severity: w.severity,
          status: w.status,
        },
        locale,
      );
      return {
        merged: mergeDocumentMetadata(empCore.merged, warnSlice),
        resolvedEmployeeId: employee.id,
        resolvedPayrollId: params.payrollId ?? null,
      };
    }
    case "PAYROLL": {
      const payroll = await prisma.payroll.findFirst({
        where: { id: params.subjectId, companyId: params.companyId },
      });
      if (!payroll) throw new Error("Pasqyra e pagës nuk u gjet.");

      let empCore: BuildMergedPlaceholderContextResult;
      if (params.employeeId) {
        const employee = await prisma.employee.findFirst({
          where: { id: params.employeeId, companyId: params.companyId },
        });
        if (!employee) throw new Error("Punonjësi nuk u gjet.");
        empCore = coreFromEmployeeRow(employee, employee.id);
      } else {
        const letter = buildCompanyScopedPlaceholderContext({
          company: companyDto,
          settings: settingsDto,
          locale,
        });
        empCore = {
          merged: withDocDate(letter, params.documentDate, locale),
          resolvedEmployeeId: null,
          resolvedPayrollId: payroll.id,
        };
      }

      const monthName = payrollMonthLabel(payroll.month);
      const paySlice = {
        payroll_month_name: monthName,
        payroll_year: String(payroll.year),
        payroll_period_label: `${monthName} ${payroll.year}`,
      };
      return {
        merged: mergeDocumentMetadata(empCore.merged, paySlice),
        resolvedEmployeeId: empCore.resolvedEmployeeId,
        resolvedPayrollId: payroll.id,
      };
    }
    case "OTHER": {
      if (params.employeeId) {
        const employee = await prisma.employee.findFirst({
          where: { id: params.employeeId, companyId: params.companyId },
        });
        if (!employee) throw new Error("Punonjësi nuk u gjet.");
        return coreFromEmployeeRow(employee, employee.id);
      }
      const letter = buildCompanyScopedPlaceholderContext({
        company: companyDto,
        settings: settingsDto,
        locale,
      });
      return {
        merged: withDocDate(letter, params.documentDate, locale),
        resolvedEmployeeId: null,
        resolvedPayrollId: params.payrollId ?? null,
      };
    }
    default: {
      const unknown: never = params.subjectKind;
      throw new Error(`Lloji i subjektit nuk mbështetet: ${unknown}`);
    }
  }
}
