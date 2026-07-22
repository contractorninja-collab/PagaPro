import { randomUUID } from "node:crypto";
import type { Company, CompanySetting, Employee, EmployeeBankAccount, Payroll, PayrollEntry } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { payrollDocumentPdfKey } from "@/modules/documents/engine/storage/payroll-path-keys";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import { decimalToPlain } from "@/modules/payroll/helpers/money-format";
import { appendPayrollDomainActivity } from "@/modules/payroll/services/payroll-audit-service";
import { PAYROLL_TIMELINE } from "@/modules/payroll/constants/timeline";
import {
  buildProfessionalPayslipPdf,
  mergePayslipPdfs,
  type PayslipPdfInput,
} from "@/modules/payroll/pdf/payslip-pdf-builder";
import { buildPayrollRegisterPdf } from "@/modules/payroll/pdf/payroll-register-pdf-builder";
import { buildPayslipBundleFilename, buildPayslipFilename } from "@/modules/payroll/pdf/payslip-filename";
import { loadCompanyLogo } from "@/modules/company-branding/company-logo";

type PayrollEntryWithEmployee = PayrollEntry & {
  employee: Employee & { bankAccounts: EmployeeBankAccount[] };
};

function resolveCompanyAddress(company: Company, settings: CompanySetting | null): string {
  return (
    settings?.companyAddressLine?.trim() ||
    company.addressLine?.trim() ||
    ""
  );
}

function resolveCityLine(company: Company): string {
  return [company.postalCode, company.city, company.country].filter(Boolean).join(" ");
}

function resolveEmployeeBank(employee: Employee & { bankAccounts: EmployeeBankAccount[] }) {
  const primary =
    employee.bankAccounts.find((a) => a.isPrimary && (a.validTo == null || a.validTo > new Date())) ??
    employee.bankAccounts[0];
  return {
    bankName: primary?.bankName ?? employee.bankName ?? null,
    iban: primary?.iban ?? employee.bankAccountIban ?? null,
    accountHolder: primary?.accountHolderName ?? `${employee.firstName} ${employee.lastName}`,
    bicSwift: primary?.bicSwift ?? null,
  };
}

function buildPayslipInput(params: {
  pay: Payroll;
  entry: PayrollEntryWithEmployee;
  company: Company;
  settings: CompanySetting | null;
  documentRef: string;
}): PayslipPdfInput {
  const { pay, entry, company, settings, documentRef } = params;
  const bank = resolveEmployeeBank(entry.employee);
  const payDate = pay.lockedAt ?? pay.approvedAt ?? new Date();

  return {
    company: {
      displayName: company.tradeName?.trim() || company.legalName,
      legalName: company.legalName,
      addressLine: resolveCompanyAddress(company, settings),
      cityLine: resolveCityLine(company),
      fiscalNumber: company.fiscalNumber,
      businessNumber: company.businessRegistrationNumber,
      phone: company.phone,
      email: company.email,
    },
    employee: {
      fullName: `${entry.employee.firstName} ${entry.employee.lastName}`,
      personalId: entry.employee.personalId,
      jobTitle: entry.jobTitleSnapshot ?? entry.employee.jobTitle,
      ...bank,
    },
    period: {
      year: pay.year,
      month: pay.month,
      periodLabel: payrollMonthLabel(pay.year, pay.month),
      currency: pay.currency,
      payDateLabel: payDate.toLocaleDateString("sq-XK", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
    amounts: {
      hourlyRate: decimalToPlain(entry.hourlyRate),
      actualRegularHours: decimalToPlain(entry.actualRegularHours),
      regularPay: decimalToPlain(entry.regularPay),
      paidLeavePay: decimalToPlain(entry.paidLeavePay),
      sickLeavePay: decimalToPlain(entry.sickLeavePay),
      overtimeAmount: decimalToPlain(entry.overtimeAmount),
      weekendAmount: decimalToPlain(entry.weekendAmount),
      holidayAmount: decimalToPlain(entry.holidayAmount),
      nightAmount: decimalToPlain(entry.nightAmount),
      bonuses: decimalToPlain(entry.bonuses),
      unpaidLeaveDeduction: decimalToPlain(entry.unpaidLeaveDeduction),
      grossSalary: decimalToPlain(entry.grossSalary),
      pensionEmployee: decimalToPlain(entry.pensionEmployee),
      pitWithheld: decimalToPlain(entry.pitWithheld),
      salaryAdvanceDeduction: decimalToPlain(entry.salaryAdvanceDeduction),
      otherDeductions: decimalToPlain(entry.otherDeductions),
      netPay: decimalToPlain(entry.netPay),
      pensionEmployer: decimalToPlain(entry.pensionEmployer),
    },
    documentRef,
  };
}

export async function generatePayrollPdfArtifacts(params: {
  companyId: string;
  payrollId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await generatePayrollPdfArtifactsInner(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generatePayrollPdfArtifacts]", err);
    return {
      ok: false,
      error:
        msg.length > 0
          ? `Gjenerimi i PDF dështoi: ${msg}`
          : "Gjenerimi i PDF dështoi për një gabim të papritur.",
    };
  }
}

async function generatePayrollPdfArtifactsInner(params: {
  companyId: string;
  payrollId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: params.payrollId, companyId: params.companyId },
    include: {
      company: true,
      entries: {
        include: {
          employee: {
            include: {
              bankAccounts: { orderBy: [{ isPrimary: "desc" }, { validFrom: "desc" }] },
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  });

  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status === "LOCKED" || payroll.status === "ARCHIVED") {
    return { ok: false, error: "PDF-t janë të ngurtësuara pas kyçjes së payroll-it." };
  }
  if (payroll.entries.length === 0) return { ok: false, error: "Nuk ka rreshta pagë për të gjeneruar PDF." };

  const pay = payroll;
  const settings = await prisma.companySetting.findUnique({ where: { companyId: params.companyId } });
  const cfg = await prisma.companyConfiguration.findUnique({ where: { companyId: params.companyId } });
  const prefix = (cfg?.payrollPdfPrefix ?? "PP").replace(/[^a-zA-Z0-9_-]/g, "") || "PP";
  const monthSlug = `${pay.year}-${String(pay.month).padStart(2, "0")}`;

  const storage = getCompanyAssetStorage();
  const companyLogo = await loadCompanyLogo(prisma, storage, params.companyId);
  const payDate = pay.lockedAt ?? pay.approvedAt ?? new Date();
  const companyPdf = {
    displayName: pay.company.tradeName?.trim() || pay.company.legalName,
    legalName: pay.company.legalName,
    addressLine: resolveCompanyAddress(pay.company, settings),
    cityLine: resolveCityLine(pay.company),
    fiscalNumber: pay.company.fiscalNumber,
    businessNumber: pay.company.businessRegistrationNumber,
    phone: pay.company.phone,
    email: pay.company.email,
  };
  const periodLabel = payrollMonthLabel(pay.year, pay.month);
  const payDateLabel = payDate.toLocaleDateString("sq-XK", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const registerRows = pay.entries.map((e) => ({
    name: `${e.employee.firstName} ${e.employee.lastName}`,
    gross: decimalToPlain(e.grossSalary),
    net: decimalToPlain(e.netPay),
    personalId: e.employee.personalId,
  }));

  const registerBase = {
    company: companyPdf,
    periodLabel,
    currency: pay.currency,
    payDateLabel,
    rows: registerRows,
    logo: companyLogo,
  };

  await prisma.payrollGeneratedDocument.deleteMany({ where: { payrollId: pay.id } });

  const buffers: Array<{
    kind: "REGISTER_WITH_TOTALS" | "REGISTER_SIGNATURE_LIST" | "EMPLOYEE_PAYSLIP" | "PAYSLIPS_PRINT_BUNDLE";
    employeeId?: string;
    body: Uint8Array;
    filename: string;
    storageSuffix: "register_totals" | "register_signatures" | "payslip" | "payslips_bundle";
  }> = [];

  const regTotals = await buildPayrollRegisterPdf({
    ...registerBase,
    withAmounts: true,
    documentRef: `${prefix}-REG-${monthSlug}`,
  });
  buffers.push({
    kind: "REGISTER_WITH_TOTALS",
    body: regTotals,
    filename: `${prefix}_lista_me_shuma_${monthSlug}.pdf`,
    storageSuffix: "register_totals",
  });

  const regSig = await buildPayrollRegisterPdf({
    ...registerBase,
    withAmounts: false,
    documentRef: `${prefix}-SIG-${monthSlug}`,
  });
  buffers.push({
    kind: "REGISTER_SIGNATURE_LIST",
    body: regSig,
    filename: `${prefix}_lista_nenshkrimet_${monthSlug}.pdf`,
    storageSuffix: "register_signatures",
  });

  const payslipBodies: Uint8Array[] = [];

  for (const [idx, e] of pay.entries.entries()) {
    const documentRef = `${prefix}-${monthSlug}-${String(idx + 1).padStart(3, "0")}`;
    const slipInput = buildPayslipInput({
      pay,
      entry: e,
      company: pay.company,
      settings,
      documentRef,
    });
    slipInput.logo = companyLogo;
    const slip = await buildProfessionalPayslipPdf(slipInput);
    payslipBodies.push(slip);
    buffers.push({
      kind: "EMPLOYEE_PAYSLIP",
      employeeId: e.employeeId,
      body: slip,
      filename: buildPayslipFilename({
        firstName: e.employee.firstName,
        lastName: e.employee.lastName,
        year: pay.year,
        month: pay.month,
      }),
      storageSuffix: "payslip",
    });
  }

  if (payslipBodies.length > 0) {
    const bundle = await mergePayslipPdfs(payslipBodies);
    buffers.push({
      kind: "PAYSLIPS_PRINT_BUNDLE",
      body: bundle,
      filename: buildPayslipBundleFilename(pay.year, pay.month, prefix),
      storageSuffix: "payslips_bundle",
    });
  }

  for (const b of buffers) {
    const id = randomUUID();
    const key = payrollDocumentPdfKey({
      companyId: params.companyId,
      payrollId: pay.id,
      documentId: id,
      suffix: b.storageSuffix,
    });
    await storage.put(key, Buffer.from(b.body), { contentType: "application/pdf" });
    await prisma.payrollGeneratedDocument.create({
      data: {
        id,
        payrollId: pay.id,
        companyId: params.companyId,
        kind: b.kind,
        employeeId: b.employeeId ?? null,
        storageKey: key,
        filename: b.filename,
        generatedByUserId: params.actorUserId ?? undefined,
      },
    });
  }

  await appendPayrollDomainActivity({
    companyId: params.companyId,
    payrollId: pay.id,
    verb: "UPDATED",
    summary: "PDF-t e pagës u gjeneruan.",
    actorUserId: params.actorUserId,
    payload: { event: PAYROLL_TIMELINE.PDF_GENERATED, kinds: buffers.map((x) => x.kind) },
  });

  return { ok: true };
}
