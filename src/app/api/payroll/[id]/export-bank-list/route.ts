import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { requireCapabilityHttp } from "@/server/company-context";
import { loadCompanyLogo } from "@/modules/company-branding/company-logo";
import { resolveEmployeeBank } from "@/modules/employees/helpers/employee-bank-resolver";
import { buildBankPaymentSheet } from "@/modules/reports/exporters/bank-payment-rows";
import { generateBankListWorkbookBuffer } from "@/modules/reports/exporters/branded-bank-list-export";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import { appendPayrollAuditLog } from "@/modules/payroll/services/payroll-audit-service";
import { PAYROLL_TIMELINE } from "@/modules/payroll/constants/timeline";

/**
 * "Lista e pagave për ekzekutim" — the bank payment list finance uploads.
 *
 * Only for a LOCKED or ARCHIVED period. That is stricter than the Libri i
 * Pagave export next door, deliberately: an APPROVED period can still be sent
 * back to draft and edited, so a payment file generated from one could instruct
 * a transfer that the payroll later disagrees with. Locking is one-way, so
 * once this file exists the amounts in it can never change underneath it.
 *
 * Gated on `payroll.prepare` — the first API route in the app to check a
 * capability at all. One GET here returns every employee's decrypted account
 * number, which is a different class of data from the rest of the register.
 */

const STATUS_LABELS: Record<string, string> = {
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapabilityHttp("payroll.prepare");
  if (!auth.ok) return auth.response;
  const { companyId, user } = auth.context;

  const { id } = await context.params;

  const payroll = await prisma.payroll.findFirst({
    where: { id, companyId },
    include: {
      company: { select: { legalName: true, tradeName: true } },
      entries: {
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              bankName: true,
              bankAccountIban: true,
              bankAccounts: {
                select: {
                  iban: true,
                  bankName: true,
                  accountHolderName: true,
                  bicSwift: true,
                  isPrimary: true,
                  validFrom: true,
                  validTo: true,
                },
              },
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  });

  // A foreign company's id and a missing one are indistinguishable here, which
  // is the point — never confirm another tenant's payroll exists.
  if (!payroll) {
    return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
  }

  if (payroll.status !== "LOCKED" && payroll.status !== "ARCHIVED") {
    return NextResponse.json(
      {
        error:
          "Lista e pagave për ekzekutim gjenerohet vetëm pasi payroll-i të jetë kyçur. " +
          "Kyçni periudhën te Pagat, pastaj shkarkoni listën.",
      },
      { status: 409 },
    );
  }

  const sheet = buildBankPaymentSheet(
    payroll.entries.map((e) => {
      const bank = resolveEmployeeBank(e.employee);
      return {
        firstName: e.employee.firstName,
        lastName: e.employee.lastName,
        netPay: e.netPay.toString(),
        bank: { iban: bank.iban, source: bank.source },
      };
    }),
  );

  /**
   * Every stored account unreadable means the encryption key is missing or has
   * been rotated — an operations fault, not a data-entry one. Say so plainly
   * instead of handing over a file that blames HR for two hundred bad records.
   */
  if (sheet.withStoredAccountCount > 0 && sheet.unreadableCount === sheet.withStoredAccountCount) {
    return NextResponse.json(
      {
        error:
          "Asnjë numër llogarie nuk mund të deshifrohet. Kjo është një problem konfigurimi " +
          "i çelësit të enkriptimit — njoftoni mbështetjen teknike, mos i rishkruani llogaritë.",
      },
      { status: 409 },
    );
  }

  // The period total comes from its own aggregate, never from the rows above:
  // if the row builder ever loses a row, the KONTROLL line in the delivered
  // file is the thing that says so.
  const aggregate = await prisma.payrollEntry.aggregate({
    where: { payrollId: payroll.id },
    _sum: { netPay: true },
  });
  const periodNetTotal = (aggregate._sum.netPay ?? 0).toString();

  const slug = `${payroll.year}-${String(payroll.month).padStart(2, "0")}`;

  try {
    const logo = await loadCompanyLogo(prisma, getCompanyAssetStorage(), companyId);
    const buf = await generateBankListWorkbookBuffer({
      sheet,
      companyLabel: payroll.company.tradeName?.trim() || payroll.company.legalName,
      periodLabel: payrollMonthLabel(payroll.year, payroll.month),
      statusLabel: STATUS_LABELS[payroll.status] ?? payroll.status,
      periodNetTotal,
      currency: payroll.currency,
      generatedAtLabel: new Date().toLocaleString("sq-AL", { timeZone: "Europe/Belgrade" }),
      downloadedByLabel: user.displayName?.trim() || user.email,
      logo,
    });

    // Recorded before the bytes leave. No account numbers in the diff.
    await appendPayrollAuditLog({
      companyId,
      payrollId: payroll.id,
      action: PAYROLL_TIMELINE.PAYROLL_BANK_LIST_DOWNLOADED,
      actorUserId: user.id,
      diff: {
        headcount: sheet.headcount,
        payableCount: sheet.payable.length,
        blockedCount: sheet.blockedCount,
        payableTotal: sheet.payableTotal,
        periodNetTotal,
        payrollStatus: payroll.status,
        isPlatformAdmin: user.isPlatformAdmin,
      },
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // Period only — a filename carrying the company name would announce
        // whose bank accounts these are in download history and screen shares.
        "Content-Disposition": `attachment; filename="Lista_e_Pagave_per_Ekzekutim_${slug}.xlsx"`,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    console.error("[export-bank-list]", err);
    return NextResponse.json(
      { error: "Lista e pagave nuk mund të gjenerohej." },
      { status: 500 },
    );
  }
}
