import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { rowsToXlsxBuffer } from "./excel-export";

async function logo() {
  const bytes = await sharp({
    create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 100, b: 200, alpha: 1 } },
  }).png().toBuffer();
  return { bytes, width: 200, height: 100, mimeType: "image/png" as const };
}

describe("PagaPRO XLSX logo branding", () => {
  it("adds the logo to every worksheet and reserves rows above the headers", async () => {
    const buffer = await rowsToXlsxBuffer({
      sheetName: "Kryesor",
      columns: [{ key: "name", headerSq: "Emri" }],
      rows: [{ name: "Arta" }],
      extraSheets: [{ name: "Detaje", columns: [{ key: "name", headerSq: "Emri" }], rows: [] }],
      logo: await logo(),
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    for (const worksheet of workbook.worksheets) {
      expect(worksheet.getImages()).toHaveLength(1);
      expect(worksheet.getCell("A3").value).toBe("Emri");
    }
  });

  it("keeps the original first-row structure without a logo", async () => {
    const buffer = await rowsToXlsxBuffer({
      sheetName: "Kryesor",
      columns: [{ key: "name", headerSq: "Emri" }],
      rows: [{ name: "Arta" }],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    const worksheet = workbook.worksheets[0]!;
    expect(worksheet.getImages()).toHaveLength(0);
    expect(worksheet.getCell("A1").value).toBe("Emri");
  });
});
