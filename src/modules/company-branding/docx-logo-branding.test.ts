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

interface MinimalDocxOptions {
  withHeader?: boolean;
  titleAndEven?: boolean;
  bodyParagraphs?: string[];
  headerParagraphs?: string[];
}

function paragraphsXml(paragraphs: string[]): string {
  return paragraphs
    .map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`)
    .join("");
}

function minimalDocx({
  withHeader = false,
  titleAndEven = false,
  bodyParagraphs = ["Body stays here"],
  headerParagraphs = ["Existing contract header text"],
}: MinimalDocxOptions = {}): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/>' +
      (withHeader ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : "") +
      "</Types>",
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paragraphsXml(bodyParagraphs)}<w:sectPr>${withHeader ? '<w:headerReference w:type="default" r:id="rId1"/>' : ""}${titleAndEven ? "<w:titlePg/>" : ""}<w:pgMar w:top="792" w:right="1037" w:bottom="792" w:left="1037" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${withHeader ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ""}</Relationships>`,
  );
  if (withHeader) {
    zip.file(
      "word/header1.xml",
      `<?xml version="1.0"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraphsXml(headerParagraphs)}</w:hdr>`,
    );
  }
  if (titleAndEven) {
    zip.file(
      "word/settings.xml",
      '<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:characterSpacingControl w:val="doNotCompress"/></w:settings>',
    );
  }
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

describe("DOCX company logo branding", () => {
  it("reuses the default header and preserves its existing text", async () => {
    const output = applyCompanyLogoToDocx(
      minimalDocx({ withHeader: true }),
      await sampleLogo(),
    );
    const zip = new PizZip(output);
    const header = zip.file("word/header1.xml")?.asText() ?? "";
    const rels = zip.file("word/_rels/header1.xml.rels")?.asText() ?? "";

    expect(header).toContain("Existing contract header text");
    expect(header).toContain("PagaPRO Company Logo");
    expect(header).toContain("<wp:inline");
    expect(header).not.toContain("<wp:anchor");
    expect(header).toContain('<w:jc w:val="left"');
    expect(header).toContain('cx="1260000"');
    expect(header).toContain('cy="630000"');
    expect(rels).toContain("relationships/image");
    expect(zip.file("word/media/pagapro-company-logo.png")).not.toBeNull();
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";
    expect(documentXml).toContain("Body stays here");
    expect(documentXml).toContain('w:top="1503"');
    expect(documentXml).toContain('w:header="170"');
  });

  it("creates repeating default, first, and even header references when needed", async () => {
    const output = applyCompanyLogoToDocx(
      minimalDocx({ titleAndEven: true }),
      await sampleLogo(),
    );
    const zip = new PizZip(output);
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";
    const contentTypes = zip.file("[Content_Types].xml")?.asText() ?? "";

    expect(documentXml).toContain('w:type="default"');
    expect(documentXml).toContain('w:type="first"');
    expect(documentXml).toContain('w:type="even"');
    expect(documentXml.indexOf('w:type="even"')).toBeLessThan(
      documentXml.indexOf('w:type="default"'),
    );
    const headerReferenceIds = Array.from(
      documentXml.matchAll(/<w:headerReference\b[^>]*\br:id="([^"]+)"/g),
      (match) => match[1],
    );
    expect(new Set(headerReferenceIds).size).toBe(headerReferenceIds.length);
    const settingsXml = zip.file("word/settings.xml")?.asText() ?? "";
    expect(settingsXml).toContain("<w:evenAndOddHeaders/>");
    expect(settingsXml.indexOf("<w:evenAndOddHeaders/>")).toBeLessThan(
      settingsXml.indexOf("<w:characterSpacingControl"),
    );
    expect(contentTypes).toContain("wordprocessingml.header+xml");
    const headerParts = Object.keys(zip.files).filter((name) => /^word\/header\d+\.xml$/.test(name));
    expect(headerParts).toHaveLength(3);
    for (const headerPart of headerParts) {
      expect(zip.file(headerPart)?.asText()).toContain("PagaPRO Company Logo");
    }
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
    expect(new PizZip(output).file("word/document.xml")?.asText()).toContain(
      '<w:footerReference w:type="even"',
    );
  });

  it("adds the generated-by footer even when no logo is configured", () => {
    const output = applyCompanyLogoToDocx(
      minimalDocx({ withHeader: true }),
      null,
    );
    const zip = new PizZip(output);
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";
    const footerParts = Object.keys(zip.files).filter((name) =>
      /^word\/footer\d+\.xml$/.test(name),
    );

    expect(documentXml).toContain("Body stays here");
    expect(documentXml).toContain('<w:footerReference w:type="default"');
    expect(documentXml).not.toContain('<w:footerReference w:type="even"');
    expect(zip.file("word/media/pagapro-company-logo.png")).toBeNull();
    expect(zip.file("word/settings.xml")).toBeNull();
    expect(footerParts).toHaveLength(1);
    for (const footerPart of footerParts) {
      const footer = zip.file(footerPart)?.asText() ?? "";
      expect(footer).toContain("Gjeneruar nga PagaPRO");
      expect(footer).toContain('w:ascii="Liberation Sans"');
      expect(footer).toContain('<w:sz w:val="14"');
    }
  });

  it("uses the logo instead of a duplicate display-name header without removing legal text", async () => {
    const companyName = "Acme LLC";
    const output = applyCompanyLogoToDocx(
      minimalDocx({
        withHeader: true,
        headerParagraphs: [companyName, "Existing contract header text"],
        bodyParagraphs: [
          companyName,
          `${companyName} is the legal employer under this agreement.`,
          "Employee terms remain here.",
        ],
      }),
      await sampleLogo(),
      { companyName },
    );
    const zip = new PizZip(output);
    const header = zip.file("word/header1.xml")?.asText() ?? "";
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";

    expect(header).not.toContain(`<w:t>${companyName}</w:t>`);
    expect(header).toContain("Existing contract header text");
    expect(header).toContain("PagaPRO Company Logo");
    expect(documentXml).not.toContain(`<w:t>${companyName}</w:t>`);
    expect(documentXml).toContain(
      `${companyName} is the legal employer under this agreement.`,
    );
    expect(documentXml).toContain("Employee terms remain here.");
  });
});
