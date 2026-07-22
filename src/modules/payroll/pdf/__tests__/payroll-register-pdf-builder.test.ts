import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
import { buildPayrollRegisterPdf, getRegisterLayoutForTests } from "../payroll-register-pdf-builder";

const sampleCompany = {
  displayName: "PagaPRO Dev",
  legalName: "PagaPRO Dev Kompania",
  addressLine: "Rr. Test 1",
  cityLine: "Prishtine",
  fiscalNumber: "123456789",
  businessNumber: "987654321",
  phone: "+383 44 000 000",
  email: "info@test.local",
};

const sampleRows = [
  { name: "Arines Ajeti", personalId: "1234567890", gross: "1400.00", net: "1226.00" },
  { name: "Gentian Ajeti", personalId: "0987654321", gross: "650.00", net: "580.25" },
  { name: "Fjolla Gashi", personalId: "1122334455", gross: "1100.00", net: "974.00" },
];

describe("payroll register PDF layout", () => {
  it("money columns do not overlap (gross ends before net starts)", () => {
    const layout = getRegisterLayoutForTests(true);
    expect(layout.gross.x + layout.gross.width).toBeLessThanOrEqual(layout.net.x + 1);
    expect(layout.gross.right).toBeLessThan(layout.net.x);
  });

  it("signature list columns do not overlap (pid ends before sign starts)", () => {
    const layout = getRegisterLayoutForTests(false);
    expect(layout.pid.x + layout.pid.width).toBeLessThanOrEqual(layout.sign.x + 1);
    expect(layout.pid.right).toBeLessThanOrEqual(layout.sign.x);
  });

  it("meta columns are evenly spaced without overlap", () => {
    for (const withAmounts of [true, false]) {
      const layout = getRegisterLayoutForTests(withAmounts);
      for (let i = 0; i < layout.meta.length - 1; i++) {
        const a = layout.meta[i]!;
        const b = layout.meta[i + 1]!;
        expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
      }
    }
  });

  it("generates lista e pagave PDF buffer", async () => {
    const buf = await buildPayrollRegisterPdf({
      company: sampleCompany,
      periodLabel: "Qershor 2026",
      currency: "EUR",
      payDateLabel: "24 qershor 2026",
      documentRef: "PAY-101010-REG-2026-07",
      withAmounts: true,
      rows: sampleRows,
    });
    expect(buf.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(buf.subarray(0, 4))).toBe("%PDF");
  });

  it("generates lista per nenshkrime PDF buffer", async () => {
    const buf = await buildPayrollRegisterPdf({
      company: sampleCompany,
      periodLabel: "Qershor 2026",
      currency: "EUR",
      payDateLabel: "24 qershor 2026",
      documentRef: "PAY-101010-SIG-2026-07",
      withAmounts: false,
      rows: sampleRows,
    });
    expect(buf.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(buf.subarray(0, 4))).toBe("%PDF");
  });

  it("draws the company logo on every register page", async () => {
    const logoBytes = await sharp({
      create: { width: 300, height: 100, channels: 4, background: { r: 30, g: 120, b: 210, alpha: 1 } },
    }).png().toBuffer();
    const rows = Array.from({ length: 80 }, (_, index) => ({
      name: `Punonjesi ${index + 1}`,
      personalId: String(1000000000 + index),
      gross: "1000.00",
      net: "850.00",
    }));
    const buf = await buildPayrollRegisterPdf({
      company: sampleCompany,
      periodLabel: "Qershor 2026",
      currency: "EUR",
      payDateLabel: "24 qershor 2026",
      documentRef: "PAY-REG-LOGO",
      withAmounts: true,
      rows,
      logo: { bytes: logoBytes, width: 300, height: 100, mimeType: "image/png" },
    });

    const pdf = await PDFDocument.load(buf);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    for (const page of pdf.getPages()) {
      const xObjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      expect(xObjects?.keys().length ?? 0).toBeGreaterThan(0);
    }
  });
});
