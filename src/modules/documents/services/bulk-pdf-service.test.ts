import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfBuffers } from "./bulk-pdf-service";

async function onePagePdf(width: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([width, 400]);
  return Buffer.from(await pdf.save());
}

describe("mergePdfBuffers", () => {
  it("combines PDFs in selection order for browser print preview", async () => {
    const output = await mergePdfBuffers([
      await onePagePdf(300),
      await onePagePdf(500),
    ]);
    const merged = await PDFDocument.load(output);

    expect(merged.getPageCount()).toBe(2);
    expect(merged.getPage(0).getWidth()).toBe(300);
    expect(merged.getPage(1).getWidth()).toBe(500);
  });
});
