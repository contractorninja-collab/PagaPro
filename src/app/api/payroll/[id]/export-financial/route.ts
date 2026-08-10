import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { getPayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { generateBrandedFinancialWorkbookBuffer } from "@/modules/reports/exporters/branded-financial-export";
import { buildLibriPagaveRows, type LibriPagaveEntryInput } from "@/modules/reports/exporters/libri-pagave-rows";
import { rowsToCsvBuffer } from "@/modules/reports/exporters/csv-export";
import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";
import { LIBRI_PAGAVE_COLUMNS } from "@/modules/reports/exporters/libri-pagave-columns";
import { buildLibriPagavePdf } from "@/modules/payroll/pdf/libri-pagave-pdf-builder";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { loadCompanyLogo } from "@/modules/company-branding/company-logo";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await getCompanyContext();
  if (!result.ok) {
    return companyContextHttpError(result.reason);
  }
  const { companyId } = result.context;

  const { id } = await context.params;

  // Load detailed payroll entries directly from DB to get the specific columns needed (employerPrimacySnapshot, applyTrust, applyTax, etc.)
  const payroll = await prisma.payroll.findFirst({
    where: { id, companyId },
    include: {
      entries: {
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              personalId: true,
              jobTitle: true,
              applyTrust: true,
              applyTax: true,
              department: {
                select: {
                  name: true
                }
              }
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  });

  if (!payroll) {
    return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
  }

  // Finance-facing book must reflect at-least-approved figures — never a DRAFT/REVIEWED period.
  if (payroll.status !== "APPROVED" && payroll.status !== "LOCKED" && payroll.status !== "ARCHIVED") {
    return NextResponse.json(
      { error: "Libri i Pagave gjenerohet vetëm për paga të aprovuara, të mbyllura ose të arkivuara." },
      { status: 409 },
    );
  }

  const data = await getPayrollDetailDto(companyId, id);
  if (!data) {
    return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "xlsx").toLowerCase();

  // Filename formatting matching the requested "Pagat per ATK" title and period slug
  const slug = `${payroll.year}-${String(payroll.month).padStart(2, "0")}`;
  const filenameBase = "Pagat_per_ATK";

  // Map database entries to the shared Libri i Pagave row input (frozen engine amounts).
  const entriesMapped: LibriPagaveEntryInput[] = payroll.entries.map((e) => ({
    employerPrimacySnapshot: e.employerPrimacySnapshot,
    hourlyRate: e.hourlyRate.toString(),
    actualRegularHours: e.actualRegularHours.toString(),
    paidLeaveHours: e.paidLeaveHours.toString(),
    sickLeaveHours: e.sickLeaveHours.toString(),
    overtimeHours: e.overtimeHours.toString(),
    weekendHours: e.weekendHours.toString(),
    holidayHours: e.holidayHours.toString(),
    nightHours: e.nightHours.toString(),
    regularPay: e.regularPay.toString(),
    paidLeavePay: e.paidLeavePay.toString(),
    sickLeavePay: e.sickLeavePay.toString(),
    overtimeAmount: e.overtimeAmount.toString(),
    holidayAmount: e.holidayAmount.toString(),
    weekendAmount: e.weekendAmount.toString(),
    nightAmount: e.nightAmount.toString(),
    bonuses: e.bonuses.toString(),
    unpaidLeaveDeduction: e.unpaidLeaveDeduction.toString(),
    otherDeductions: e.otherDeductions.toString(),
    salaryAdvanceDeduction: e.salaryAdvanceDeduction.toString(),
    grossSalary: e.grossSalary.toString(),
    taxableIncome: e.taxableIncome.toString(),
    pitWithheld: e.pitWithheld.toString(),
    pensionEmployee: e.pensionEmployee.toString(),
    pensionEmployer: e.pensionEmployer.toString(),
    netPay: e.netPay.toString(),
    employee: {
      firstName: e.employee.firstName,
      lastName: e.employee.lastName,
      applyTrust: e.employee.applyTrust,
      applyTax: e.employee.applyTax,
      department: e.employee.department,
    }
  }));

  if (format === "pdf") {
    // Same rows as the XLSX and CSV — the book is a rendering, not a calculation.
    const [logo, company] = await Promise.all([
      loadCompanyLogo(prisma, getCompanyAssetStorage(), companyId),
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          legalName: true,
          tradeName: true,
          fiscalNumber: true,
          addressLine: true,
          city: true,
        },
      }),
    ]);

    const buffer = await buildLibriPagavePdf({
      company: {
        legalName: company?.legalName ?? data.companyLabel ?? "",
        tradeName: company?.tradeName ?? null,
        fiscalNumber: company?.fiscalNumber ?? null,
        addressLine: company?.addressLine ?? null,
        city: company?.city ?? null,
      },
      rows: buildLibriPagaveRows(entriesMapped),
      periodLabel: data.payroll.monthLabel,
      periodRef: slug,
      status: payroll.status,
      statusDateLabel: (payroll.approvedAt ?? payroll.lockedAt ?? payroll.archivedAt)
        ?.toLocaleDateString("sq-AL", { timeZone: "Europe/Belgrade" }) ?? null,
      snapshotRef: null,
      logo,
      generatedAtLabel: new Date().toLocaleString("sq-AL", { timeZone: "Europe/Belgrade" }),
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}_${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "csv") {
    // Generate CSV using rowsToCsvBuffer matching the exact columns in the screenshot
    // Single source for the 25 columns — the PDF book renders the same list.
    const columns: ReportColumnDef[] = LIBRI_PAGAVE_COLUMNS.map((c) => ({
      key: c.key,
      headerSq: c.headerSq,
    }));

    const parseNum = (val: string) => {
      const n = Number(String(val).replace(",", "."));
      return isNaN(n) ? 0 : n;
    };

    const libriRows = buildLibriPagaveRows(entriesMapped);

    const mappedRows: ReportRow[] = libriRows.map((r) => ({
      idp: r.idp,
      nr: r.idp,
      fullName: r.fullName,
      sektori: r.sektori,
      primacy: r.isSecondary ? "2" : "",
      hourlyRate: r.hourlyRate.toFixed(2),
      regularHours: r.regularHours.toFixed(2),
      regularGross: r.regularGross.toFixed(2),
      overtimeNightHours: r.overtimeNightHours.toFixed(2),
      onCallHours: "0.00",
      holidayWeekendHours: r.holidayWeekendHours.toFixed(2),
      overtimeNightRate: r.overtimeNightRate.toFixed(2),
      onCallRate: r.onCallRate.toFixed(2),
      holidayWeekendRate: r.holidayWeekendRate.toFixed(2),
      premiumPay: r.premiumPay.toFixed(2),
      totalGross: r.totalGross.toFixed(2),
      employeeTrustPercent: `${(r.employeeTrustPercent * 100).toFixed(1)}%`,
      employerTrustPercent: `${(r.employerTrustPercent * 100).toFixed(1)}%`,
      employeeTrustAmount: r.employeeTrustAmount.toFixed(2),
      employerTrustAmount: r.employerTrustAmount.toFixed(2),
      taxableIncome: r.taxableIncome.toFixed(2),
      taxAmount: r.taxAmount.toFixed(2),
      netIncome: r.netIncome.toFixed(2),
      advance: r.advance.toFixed(2),
      netToPay: r.netToPay.toFixed(2)
    }));

    // Add Totals row to CSV
    const totalsRow: ReportRow = {
      idp: "TOTALI",
      nr: "",
      fullName: "",
      sektori: "",
      primacy: "",
      hourlyRate: "",
      regularHours: mappedRows.reduce((acc, r) => acc + parseNum(r.regularHours as string), 0).toFixed(2),
      regularGross: mappedRows.reduce((acc, r) => acc + parseNum(r.regularGross as string), 0).toFixed(2),
      overtimeNightHours: mappedRows.reduce((acc, r) => acc + parseNum(r.overtimeNightHours as string), 0).toFixed(2),
      onCallHours: "0.00",
      holidayWeekendHours: mappedRows.reduce((acc, r) => acc + parseNum(r.holidayWeekendHours as string), 0).toFixed(2),
      overtimeNightRate: "",
      onCallRate: "",
      holidayWeekendRate: "",
      premiumPay: mappedRows.reduce((acc, r) => acc + parseNum(r.premiumPay as string), 0).toFixed(2),
      totalGross: data.totals.gross,
      employeeTrustPercent: "",
      employerTrustPercent: "",
      employeeTrustAmount: data.totals.pensionEmployee,
      employerTrustAmount: data.totals.pensionEmployer,
      taxableIncome: data.totals.taxableIncome,
      taxAmount: data.totals.pitWithheld,
      netIncome: mappedRows.reduce((acc, r) => acc + parseNum(r.netIncome as string), 0).toFixed(2),
      advance: mappedRows.reduce((acc, r) => acc + parseNum(r.advance as string), 0).toFixed(2),
      netToPay: data.totals.net
    };
    mappedRows.push(totalsRow);

    const buf = rowsToCsvBuffer(columns, mappedRows);

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}_${slug}.csv"`,
      },
    });
  }

  // Default is Excel format
  try {
    const logo = await loadCompanyLogo(prisma, getCompanyAssetStorage(), companyId);
    const buf = await generateBrandedFinancialWorkbookBuffer({
      payroll: {
        year: payroll.year,
        month: payroll.month,
        monthLabel: data.payroll.monthLabel,
      },
      companyLabel: data.companyLabel,
      totals: data.totals,
      entries: entriesMapped,
      logo,
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}_${slug}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[export-financial]", err);
    return NextResponse.json({ error: "Failed to generate Excel file" }, { status: 500 });
  }
}
