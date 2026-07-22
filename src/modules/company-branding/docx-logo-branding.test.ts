import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { applyCompanyLogoToDocx } from "@/modules/company-branding/docx-logo-branding";
import type { CompanyLogoAsset } from "@/modules/company-branding/company-logo";

async function sampleLogo(): Promise<CompanyLogoAsset> {
  const bytes = await sharp({
    create: { width: 400, height: 200, channels: 4, background: { r: 10, g: 90, b: 180, alpha: 1 } },
  }).png().toBuffer();
  return { bytes, width: 400, height: 200, mimeType: "image/png" };
}

function minimalDocx(withHeader: boolean, titleAndEven = false): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/>' +
      (withHeader ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : "") +
      "</Types>",
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Body stays here</w:t></w:r></w:p><w:sectPr>${withHeader ? '<w:headerReference w:type="default" r:id="rId1"/>' : ""}${titleAndEven ? "<w:titlePg/>" : ""}</w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${withHeader ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ""}</Relationships>`,
  );
  if (withHeader) {
    zip.file(
      "word/header1.xml",
      '<?xml version="1.0"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Existing contract header text</w:t></w:r></w:p></w:hdr>',
    );
  }
  if (titleAndEven) {
    zip.file(
      "word/settings.xml",
      '<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:evenAndOddHeaders/></w:settings>',
    );
  }
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

describe("DOCX company logo branding", () => {
  it("reuses the default header and preserves its existing text", async () => {
    const output = applyCompanyLogoToDocx(minimalDocx(true), await sampleLogo());
    const zip = new PizZip(output);
    const header = zip.file("word/header1.xml")?.asText() ?? "";
    const rels = zip.file("word/_rels/header1.xml.rels")?.asText() ?? "";

    expect(header).toContain("Existing contract header text");
    expect(header).toContain("PagaPRO Company Logo");
    expect(header).toContain('relativeFrom="margin"');
    expect(header).toContain('cx="1260000"');
    expect(header).toContain('cy="630000"');
    expect(rels).toContain("relationships/image");
    expect(zip.file("word/media/pagapro-company-logo.png")).not.toBeNull();
    expect(zip.file("word/document.xml")?.asText()).toContain("Body stays here");
  });

  it("creates repeating default, first, and even header references when needed", async () => {
    const output = applyCompanyLogoToDocx(minimalDocx(false, true), await sampleLogo());
    const zip = new PizZip(output);
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";
    const contentTypes = zip.file("[Content_Types].xml")?.asText() ?? "";

    expect(documentXml).toContain('w:type="default"');
    expect(documentXml).toContain('w:type="first"');
    expect(documentXml).toContain('w:type="even"');
    expect(contentTypes).toContain("wordprocessingml.header+xml");
    expect(Object.keys(zip.files).some((name) => /^word\/header\d+\.xml$/.test(name))).toBe(true);
  });

  it("preserves all text in the bundled fixed-term contract header", async () => {
    const source = await readFile(
      path.join(process.cwd(), "templates", "contracts", "kontrate-me-afat-te-caktuar.docx"),
    );
    const originalZip = new PizZip(source);
    const originalHeader = originalZip.file("word/header1.xml")?.asText() ?? "";
    const originalText = Array.from(originalHeader.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g), (match) => match[1]);

    const output = applyCompanyLogoToDocx(source, await sampleLogo());
    const brandedHeader = new PizZip(output).file("word/header1.xml")?.asText() ?? "";
    expect(originalText.length).toBeGreaterThan(0);
    for (const text of originalText) expect(brandedHeader).toContain(text);
    expect(brandedHeader).toContain("PagaPRO Company Logo");
  });

  it("is a no-op when no logo is configured", () => {
    const input = minimalDocx(true);
    expect(applyCompanyLogoToDocx(input, null)).toBe(input);
  });
});
