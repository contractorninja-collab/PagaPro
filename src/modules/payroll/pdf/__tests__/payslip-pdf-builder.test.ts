import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildProfessionalPayslipPdf, type PayslipPdfInput } from "../payslip-pdf-builder";
import { extractPdfStreamText, literalStrings } from "./pdf-text-probe";

/** Set to collect rendered PDFs for a visual check. */
const OUT_DIR = process.env.PAYSLIP_PREVIEW_DIR;

const sampleInput: PayslipPdfInput = {
  company: {
    displayName: "Ndërtimi Alba SH.P.K.",
    legalName: "Ndërtimi Alba SH.P.K.",
    addressLine: "Rr. Rexhep Luci 14, Prishtinë",
    cityLine: "Prishtinë",
    fiscalNumber: "600123456",
    businessNumber: "811234567",
    phone: "+383 38 123 456",
    email: "info@alba.example",
  },
  employee: {
    fullName: "Arbënor Krasniqi",
    personalId: "1004921883",
    jobTitle: "Inxhinier ndërtimi",
    bankName: "ProCredit Bank Kosovë",
    iban: "XK05 1100 0000 0000 8912",
    accountHolder: "Arbënor Krasniqi",
    bicSwift: null,
  },
  period: {
    year: 2026,
    month: 7,
    periodLabel: "Korrik 2026",
    currency: "EUR",
    payDateLabel: "05.08.2026",
  },
  amounts: {
    hourlyRate: "4.43",
    actualRegularHours: "176",
    regularPay: "780.00",
    paidLeavePay: "35.40",
    sickLeavePay: "0",
    overtimeAmount: "62.40",
    weekendAmount: "0",
    holidayAmount: "0",
    nightAmount: "0",
    bonuses: "50.00",
    unpaidLeaveDeduction: "0",
    grossSalary: "927.80",
    pensionEmployee: "46.39",
    pitWithheld: "59.28",
    salaryAdvanceDeduction: "50.00",
    otherDeductions: "0",
    netPay: "772.13",
    pensionEmployer: "46.39",
    overtimeHours: "11",
    paidLeaveHours: "8",
  },
  documentRef: "FP-2026-07-0184",
  attendance: { workingDaysInPeriod: 22, daysWorked: 21, annualLeaveRemainingDays: "9" },
  ytd: { grossSalary: "6516.20", netPay: "5788.02", rangeLabel: "2026 (JAN–KOR)" },
  generatedAt: new Date("2026-08-01T09:14:00Z"),
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

async function emit(name: string, bytes: Uint8Array): Promise<void> {
  if (!OUT_DIR) return;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, name), bytes);
}

describe("professional payslip PDF", () => {
  it("renders a single A4 portrait page", async () => {
    const bytes = await buildProfessionalPayslipPdf(sampleInput);
    const pdf = await PDFDocument.load(bytes);
    const { width, height } = pdf.getPage(0).getSize();

    expect(pdf.getPageCount()).toBe(1);
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("embeds a sans face for copy and a mono face for figures", async () => {
    const bytes = await buildProfessionalPayslipPdf(sampleInput);
    const pdf = await PDFDocument.load(bytes);
    const names = pageFontNames(pdf).join(" ");

    // Falls back to metrically compatible faces until the brand fonts are
    // dropped into templates/fonts, so assert the roles rather than the files.
    expect(names).toMatch(/LiberationSans|InstrumentSans/);
    expect(names).toMatch(/Courier|IBMPlexMono/);
  });

  it("draws the configured company logo", async () => {
    const logoBytes = await sharp({
      create: {
        width: 600,
        height: 310,
        channels: 4,
        background: { r: 11, g: 18, b: 32, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const bytes = await buildProfessionalPayslipPdf({
      ...sampleInput,
      logo: { bytes: logoBytes, width: 600, height: 310, mimeType: "image/png" },
    });
    await emit("payslip.pdf", bytes);

    const pdf = await PDFDocument.load(bytes);
    const xObjects = pdf.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);

    expect(xObjects?.keys().length ?? 0).toBeGreaterThan(0);
  });

  it("renders without a logo and without leaving a gap", async () => {
    const bytes = await buildProfessionalPayslipPdf(sampleInput);
    const pdf = await PDFDocument.load(bytes);
    const xObjects = pdf.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);

    // No logo means no image at all — never a placeholder box.
    expect(xObjects?.keys().length ?? 0).toBe(0);
  });

  it("prints deductions as minus signs, not encoding fallbacks", async () => {
    const bytes = await buildProfessionalPayslipPdf(sampleInput);
    const drawn = literalStrings(await extractPdfStreamText(bytes)).join(" ");

    // U+2212 is outside WinAnsi, so an unmapped minus used to reach the page as
    // "?46.39" — on a money column that is worse than being merely wrong.
    expect(drawn).not.toContain("?46.39");
    expect(drawn).toContain("-46.39");
  });

  it("renders when attendance and year-to-date figures are unavailable", async () => {
    const bytes = await buildProfessionalPayslipPdf({
      ...sampleInput,
      attendance: null,
      ytd: null,
    });
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(1);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
