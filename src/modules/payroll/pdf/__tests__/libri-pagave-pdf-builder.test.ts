import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  buildLibriPagavePdf,
  LIBRI_COLUMN_WIDTHS,
  type LibriPagavePdfInput,
} from "@/modules/payroll/pdf/libri-pagave-pdf-builder";
import { LIBRI_PAGAVE_COLUMNS } from "@/modules/reports/exporters/libri-pagave-columns";
import type { LibriPagaveRow } from "@/modules/reports/exporters/libri-pagave-rows";

function row(i: number, overrides: Partial<LibriPagaveRow> = {}): LibriPagaveRow {
  const regularGross = 800;
  const premiumPay = 120;
  const totalGross = regularGross + premiumPay;
  const employeeTrustAmount = totalGross * 0.05;
  const employerTrustAmount = totalGross * 0.05;
  const taxableIncome = totalGross - employeeTrustAmount;
  const taxAmount = 62;
  const netIncome = taxableIncome - taxAmount;
  const advance = 0;
  return {
    idp: i,
    fullName: `Punëtori Çelësi ${i}`,
    sektori: "Prodhim",
    isSecondary: false,
    hourlyRate: 4.6,
    regularHours: 174,
    regularGross,
    overtimeNightHours: 4,
    onCallHours: 2,
    holidayWeekendHours: 6,
    overtimeNightRate: 5.98,
    onCallRate: 5.52,
    holidayWeekendRate: 6.9,
    premiumPay,
    totalGross,
    employeeTrustPercent: 0.05,
    employerTrustPercent: 0.05,
    employeeTrustAmount,
    employerTrustAmount,
    taxableIncome,
    taxAmount,
    netIncome,
    advance,
    netToPay: netIncome - advance,
    bonuses: 0,
    unpaidLeaveDeduction: 0,
    applyTrust: true,
    applyTax: true,
    ...overrides,
  };
}

function input(rows: LibriPagaveRow[]): LibriPagavePdfInput {
  return {
    company: {
      legalName: "Ndërtimi Alba SH.P.K.",
      businessNumber: "811234567",
      addressLine: "Rr. Rexhep Luci 14",
      city: "Prishtinë",
    },
    rows,
    periodLabel: "Korrik 2026",
    periodRef: "2026-07",
    status: "APPROVED",
    statusDateLabel: "03.08.2026",
    snapshotRef: "7f3ac91b",
    generatedAtLabel: "03.08.2026 · 11:42",
  };
}

describe("libri pagave PDF", () => {
  it("declares column widths that exactly fill the content width", () => {
    expect(LIBRI_COLUMN_WIDTHS).toHaveLength(LIBRI_PAGAVE_COLUMNS.length);
    const sum = LIBRI_COLUMN_WIDTHS.reduce((a, w) => a + w, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("renders A3 landscape", async () => {
    const buffer = await buildLibriPagavePdf(input([row(1), row(2)]));
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");

    const pdf = await PDFDocument.load(buffer);
    const page = pdf.getPage(0);
    expect(Math.round(page.getWidth())).toBe(1191);
    expect(Math.round(page.getHeight())).toBe(842);
  });

  // Drawing 200 rows × 25 columns across several A3 sheets runs to a few
  // seconds on its own and longer when the suite is loaded, so it gets a
  // realistic budget rather than the 5s default.
  it("paginates a large payroll and repeats the table head", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => row(i + 1));
    const buffer = await buildLibriPagavePdf(input(rows));
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    for (const page of pdf.getPages()) {
      expect(Math.round(page.getWidth())).toBe(1191);
    }
  }, 30_000);

  it("renders an empty payroll as a valid single page rather than throwing", async () => {
    const buffer = await buildLibriPagavePdf(input([]));
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("renders without a logo, and with one", async () => {
    const withoutLogo = await buildLibriPagavePdf(input([row(1)]));
    expect(withoutLogo.length).toBeGreaterThan(1000);

    // 1×1 PNG — enough to exercise the embed + plate path.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const withLogo = await buildLibriPagavePdf({
      ...input([row(1)]),
      logo: { bytes: png, width: 600, height: 310, mimeType: "image/png" },
    });
    expect(withLogo.subarray(0, 4).toString()).toBe("%PDF");
  });
});
