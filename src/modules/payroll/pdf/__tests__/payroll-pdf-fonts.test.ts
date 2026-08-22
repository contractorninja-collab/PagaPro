import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { embedPayrollPdfFonts } from "../payroll-pdf-fonts";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

describe("payroll PDF fonts", () => {
  it("gives the figure faces one width for every digit", async () => {
    // The guarantee money columns rest on. Manrope's digits are proportional
    // by default ("1" is ~58% of "6"), and pdf-lib cannot apply the `tnum`
    // feature at draw time — so the tabular glyphs are baked into the digit
    // codepoints ahead of time. If that ever regresses, every payslip's
    // decimal commas start wandering down the column and nothing else fails.
    const pdf = await PDFDocument.create();
    const fonts = await embedPayrollPdfFonts(pdf);

    for (const face of [fonts.mono, fonts.monoBold]) {
      const widths = new Set(DIGITS.map((d) => face.widthOfTextAtSize(d, 9).toFixed(4)));
      expect(widths.size).toBe(1);
    }
  });

  it("renders two different amounts at the same width", async () => {
    const pdf = await PDFDocument.create();
    const fonts = await embedPayrollPdfFonts(pdf);

    const a = fonts.mono.widthOfTextAtSize("1.234,56", 9);
    const b = fonts.mono.widthOfTextAtSize("9.876,54", 9);
    expect(a).toBeCloseTo(b, 5);
  });

  it("carries the Albanian letters the payslip is written in", async () => {
    const pdf = await PDFDocument.create();
    const fonts = await embedPayrollPdfFonts(pdf);

    // A face missing ë or ç would throw here rather than silently drop them.
    for (const face of [fonts.sans, fonts.sansBold]) {
      expect(() => face.widthOfTextAtSize("Pagë neto · Gëzim Çelaj", 9)).not.toThrow();
    }
  });

  it("reports which face filled each slot", async () => {
    const pdf = await PDFDocument.create();
    const fonts = await embedPayrollPdfFonts(pdf);

    expect(fonts.faces.mono).toMatch(/Tabular/);
    expect(fonts.faces.monoBold).toMatch(/Tabular/);
    // Embedded faces must not be run through the WinAnsi sanitiser.
    expect(fonts.sanitize.mono).toBe(false);
    expect(fonts.sanitize.sans).toBe(false);
  });
});
