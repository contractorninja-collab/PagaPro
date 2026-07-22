import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
import { rowsToPdfTableBuffer } from "./pdf-table-export";

describe("report PDF logo branding", () => {
  it("draws the logo on every generated page", async () => {
    const logoBytes = await sharp({
      create: { width: 300, height: 120, channels: 4, background: { r: 0, g: 90, b: 180, alpha: 1 } },
    }).png().toBuffer();
    const buffer = await rowsToPdfTableBuffer({
      title: "Raporti i punonjesve",
      columns: [{ key: "name", headerSq: "Emri" }],
      rows: Array.from({ length: 100 }, (_, index) => ({ name: `Punonjesi ${index + 1}` })),
      logo: { bytes: logoBytes, width: 300, height: 120, mimeType: "image/png" },
    });
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    for (const page of pdf.getPages()) {
      const xObjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      expect(xObjects?.keys().length ?? 0).toBeGreaterThan(0);
    }
  });
});
