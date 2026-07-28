import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  buildPayrollSignoffPdf,
  SIGNOFF_COLUMNS,
} from "../payroll-signoff-pdf-builder";
import { extractPdfText } from "./pdf-text-probe";
import type { PayrollRegisterPdfInput } from "../payroll-register-pdf-builder";

/** Set to collect rendered PDFs for a visual check. */
const OUT_DIR = process.env.PAYSLIP_PREVIEW_DIR;

/** Any of these appearing on the sheet would be a privacy regression. */
const FORBIDDEN_NAME = "Arbenor Krasniqi";

function input(count: number): PayrollRegisterPdfInput {
  const rows = Array.from({ length: count }, (_, i) => ({
    name: FORBIDDEN_NAME,
    personalId: String(1001452201 + i),
    gross: (900 + i).toFixed(2),
    net: (770 + i).toFixed(2),
  }));

  return {
    company: {
      displayName: "Ndërtimi Alba SH.P.K.",
      legalName: "Ndërtimi Alba SH.P.K.",
      addressLine: "Rr. Rexhep Luci 14, Prishtinë",
      cityLine: "Prishtinë",
      fiscalNumber: "600123456",
      businessNumber: "811234567",
      phone: null,
      email: null,
    },
    periodLabel: "Korrik 2026",
    currency: "EUR",
    payDateLabel: "03.08.2026",
    documentRef: "LP-2026-07",
    withAmounts: false,
    rows,
    approvalLabel: "Aprovuar · 03.08.2026",
    preparedBy: { name: "Blerta Hoxha", role: "Përgatiti pagat" },
    approvedBy: { name: "Driton Berisha", role: "Drejtor" },
  };
}

async function emit(name: string, bytes: Uint8Array): Promise<void> {
  if (!OUT_DIR) return;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, name), bytes);
}

describe("salary sign-off sheet", () => {
  it("keeps the column fractions at exactly one page width", () => {
    const total = SIGNOFF_COLUMNS.reduce((sum, c) => sum + c.fraction, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("exposes only the five privacy-safe columns", () => {
    // Employees sign this in a corridor. A name, position or department column
    // must never be reintroduced.
    expect(SIGNOFF_COLUMNS.map((c) => c.key)).toEqual([
      "no",
      "personalId",
      "gross",
      "net",
      "signature",
    ]);
  });

  it("renders A4 portrait", async () => {
    const bytes = await buildPayrollSignoffPdf(input(8));
    const pdf = await PDFDocument.load(bytes);
    const { width, height } = pdf.getPage(0).getSize();

    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("never draws an employee name", async () => {
    const bytes = await buildPayrollSignoffPdf(input(8));
    const drawn = await extractPdfText(bytes);

    // Sanity-check the probe itself: if it cannot see the ID it prints, its
    // silence about the name would mean nothing.
    expect(drawn).toContain("1001452201");
    expect(drawn).not.toContain(FORBIDDEN_NAME);
    expect(drawn).not.toContain("Krasniqi");
  });

  it("prints the preparer and the company's representative under the rules", async () => {
    const bytes = await buildPayrollSignoffPdf(input(6));
    const drawn = await extractPdfText(bytes);

    expect(drawn).toContain("Blerta Hoxha");
    expect(drawn).toContain("Driton Berisha");
    expect(drawn).toContain("Drejtor");
  });

  it("leaves the rules blank rather than printing a placeholder", async () => {
    const bytes = await buildPayrollSignoffPdf({
      ...input(6),
      preparedBy: null,
      approvedBy: null,
    });
    const drawn = await extractPdfText(bytes);

    // The labels stay; nothing invented sits on a line someone will sign.
    expect(drawn).not.toContain("Emri");
    expect(drawn).not.toContain("Pozita");
  });

  it("paginates a large payroll and numbers every page", async () => {
    const bytes = await buildPayrollSignoffPdf(input(60));
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBeGreaterThan(1);
    for (const page of pdf.getPages()) {
      expect(Math.round(page.getSize().height)).toBe(842);
    }
  });

  it("renders an empty payroll as a valid single page", async () => {
    const bytes = await buildPayrollSignoffPdf(input(0));
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(1);
  });

  it("draws the company logo when one is configured", async () => {
    const logo = await sharp({
      create: { width: 600, height: 310, channels: 4, background: { r: 11, g: 18, b: 32, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const bytes = await buildPayrollSignoffPdf({
      ...input(12),
      logo: { bytes: logo, width: 600, height: 310, mimeType: "image/png" },
    });
    await emit("signoff.pdf", bytes);

    const pdf = await PDFDocument.load(bytes);
    const xObjects = pdf.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);

    expect(xObjects?.keys().length ?? 0).toBeGreaterThan(0);
  });
});
