import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  buildProfessionalPayslipPdf,
  type PayslipPdfInput,
} from "../payslip-pdf-builder";

const sampleInput: PayslipPdfInput = {
  company: {
    displayName: "PagaPRO Dev",
    legalName: "PagaPRO Dev Kompania",
    addressLine: "Rr. Test 1",
    cityLine: "Prishtine",
    fiscalNumber: "123456789",
    businessNumber: "987654321",
    phone: "+383 44 000 000",
    email: "info@test.local",
  },
  employee: {
    fullName: "Arines Ajeti",
    personalId: "1234567890",
    jobTitle: "Menaxher",
    bankName: "Banka Test",
    iban: "1234567890123456",
    accountHolder: "Arines Ajeti",
    bicSwift: null,
  },
  period: {
    year: 2026,
    month: 7,
    periodLabel: "Korrik 2026",
    currency: "EUR",
    payDateLabel: "31 korrik 2026",
  },
  amounts: {
    hourlyRate: "7.50",
    actualRegularHours: "160",
    regularPay: "1200.00",
    paidLeavePay: "0",
    sickLeavePay: "0",
    overtimeAmount: "75.00",
    weekendAmount: "0",
    holidayAmount: "0",
    nightAmount: "0",
    bonuses: "100.00",
    unpaidLeaveDeduction: "0",
    grossSalary: "1375.00",
    pensionEmployee: "68.75",
    pitWithheld: "85.00",
    salaryAdvanceDeduction: "0",
    otherDeductions: "0",
    netPay: "1221.25",
    pensionEmployer: "68.75",
  },
  documentRef: "PAY-TEST-2026-07",
};

function pageFontNames(pdf: PDFDocument): string[] {
  const names = new Set<string>();
  for (const page of pdf.getPages()) {
    const fonts = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
    if (!fonts) continue;
    for (const key of fonts.keys()) {
      const font = fonts.lookup(key, PDFDict);
      const baseFont = font?.get(PDFName.of("BaseFont"))?.toString();
      if (baseFont) names.add(baseFont);
    }
  }
  return [...names];
}

describe("professional payslip PDF", () => {
  it("embeds Liberation body and heading fonts", async () => {
    const bytes = await buildProfessionalPayslipPdf(sampleInput);
    const pdf = await PDFDocument.load(bytes);
    const names = pageFontNames(pdf).join(" ");

    expect(names).toContain("LiberationSerif");
    expect(names).toContain("LiberationSans");
  });

  it("draws the configured company logo", async () => {
    const logoBytes = await sharp({
      create: {
        width: 300,
        height: 100,
        channels: 4,
        background: { r: 30, g: 120, b: 210, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const bytes = await buildProfessionalPayslipPdf({
      ...sampleInput,
      logo: {
        bytes: logoBytes,
        width: 300,
        height: 100,
        mimeType: "image/png",
      },
    });
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPage(0);
    const xObjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);

    expect(xObjects?.keys().length ?? 0).toBeGreaterThan(0);
  });
});
