import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { renderDocxToPrintHtml } from "./docx-to-print-html";
import { buildPrintPageHtml } from "./build-print-page";

const WORD_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function docx(bodyXml: string, extra?: Record<string, string | Buffer>): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document ${WORD_NS}><w:body>${bodyXml}</w:body></w:document>`,
  );
  for (const [name, content] of Object.entries(extra ?? {})) zip.file(name, content);
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

describe("renderDocxToPrintHtml", () => {
  it("keeps paragraph text, alignment and run formatting", () => {
    const buffer = docx(
      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>KONTRATË PUNE</w:t></w:r></w:p>' +
        '<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t xml:space="preserve">Neni 1 </w:t></w:r>' +
        "<w:r><w:rPr><w:i/><w:u w:val=\"single\"/></w:rPr><w:t>Objekti</w:t></w:r></w:p>",
    );

    const { html } = renderDocxToPrintHtml(buffer);

    expect(html).toContain("text-align:center");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("KONTRATË PUNE");
    expect(html).toContain("text-align:justify");
    expect(html).toContain("font-style:italic");
    expect(html).toContain("text-decoration:underline");
    expect(html).toContain("Neni 1 ");
  });

  it("escapes text that would otherwise be read as markup", () => {
    const buffer = docx("<w:p><w:r><w:t>Paga &lt; 500 &amp; &gt; 300</w:t></w:r></w:p>");
    const { html } = renderDocxToPrintHtml(buffer);

    expect(html).toContain("Paga &lt; 500 &amp; &gt; 300");
    expect(html).not.toContain("<script");
  });

  it("renders an empty paragraph as blank vertical space", () => {
    const { html } = renderDocxToPrintHtml(docx("<w:p/><w:p><w:r><w:t>x</w:t></w:r></w:p>"));
    expect(html.startsWith("<p")).toBe(true);
    expect(html).toContain("<br>");
  });

  it("renders a table and leaves nil-bordered signature cells unruled", () => {
    const buffer = docx(
      "<w:tbl><w:tblGrid><w:gridCol w:w=\"5000\"/><w:gridCol w:w=\"5000\"/></w:tblGrid>" +
        "<w:tr><w:tc><w:tcPr><w:tcBorders><w:top w:val=\"nil\"/><w:bottom w:val=\"nil\"/></w:tcBorders></w:tcPr>" +
        "<w:p><w:r><w:t>Punëdhënësi</w:t></w:r></w:p></w:tc>" +
        "<w:tc><w:p><w:r><w:t>I punësuari</w:t></w:r></w:p></w:tc></w:tr></w:tbl>",
    );

    const { html } = renderDocxToPrintHtml(buffer);

    expect(html).toContain("<table");
    expect(html).toContain("Punëdhënësi");
    expect(html).toContain("I punësuari");
    expect(html).toContain("width:50%");
    expect(html).not.toContain("border:0.5pt solid");
  });

  it("draws borders only for cells that ask for them", () => {
    const buffer = docx(
      "<w:tbl><w:tr><w:tc><w:tcPr><w:tcBorders><w:top w:val=\"single\"/></w:tcBorders></w:tcPr>" +
        "<w:p><w:r><w:t>c</w:t></w:r></w:p></w:tc></w:tr></w:tbl>",
    );
    expect(renderDocxToPrintHtml(buffer).html).toContain("border:0.5pt solid");
  });

  it("reads page geometry from the section properties", () => {
    const buffer = docx(
      '<w:p/><w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
        '<w:pgMar w:top="792" w:right="1037" w:bottom="792" w:left="1037"/></w:sectPr>',
    );

    const { geometry } = renderDocxToPrintHtml(buffer);

    expect(geometry?.widthMm).toBeCloseTo(215.9, 1);
    expect(geometry?.heightMm).toBeCloseTo(279.4, 1);
    expect(geometry?.marginTopMm).toBeCloseTo(13.97, 1);
  });

  it("extracts the header logo as a data URI", () => {
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    const buffer = docx("<w:p/>", {
      "word/_rels/document.xml.rels":
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
        "</Relationships>",
      "word/_rels/header1.xml.rels":
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/pagapro-company-logo.png"/>' +
        "</Relationships>",
      "word/media/pagapro-company-logo.png": png,
      "word/header1.xml": "<w:hdr/>",
    });

    const { logoDataUri } = renderDocxToPrintHtml(buffer);

    expect(logoDataUri).toBe(`data:image/png;base64,${png.toString("base64")}`);
  });

  it("returns no logo when the document has no header image", () => {
    expect(renderDocxToPrintHtml(docx("<w:p/>")).logoDataUri).toBeNull();
  });

  it("resolves spacing, alignment and font through the paragraph style chain", () => {
    const styles =
      `<?xml version="1.0"?><w:styles ${WORD_NS}>` +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="200" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:pPr><w:spacing w:after="40"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Liberation Serif"/><w:sz w:val="21"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Base"><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Body"><w:basedOn w:val="Base"/>' +
      '<w:pPr><w:spacing w:after="50" w:line="252" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>' +
      "</w:styles>";
    const buffer = docx(
      '<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr><w:r><w:t>styled</w:t></w:r></w:p>' +
        // Direct formatting overrides one attribute; the style's other spacing survives.
        '<w:p><w:pPr><w:pStyle w:val="Body"/><w:spacing w:before="120"/></w:pPr><w:r><w:t>override</w:t></w:r></w:p>' +
        "<w:p><w:r><w:t>unstyled</w:t></w:r></w:p>",
      { "word/styles.xml": styles },
    );

    const render = renderDocxToPrintHtml(buffer);
    const paragraphs = [...render.html.matchAll(/<p style="([^"]*)"/g)].map((m) => m[1]);

    expect(paragraphs[0]).toContain("text-align:justify");
    expect(paragraphs[0]).toContain("margin:0pt 0 2.5pt");
    expect(paragraphs[0]).toContain("line-height:1.21");
    expect(paragraphs[0]).toContain("font-size:10pt");
    expect(paragraphs[0]).toContain("'Liberation Serif'");
    expect(paragraphs[1]).toContain("margin:6pt 0 2.5pt");
    // No pStyle → the default paragraph style, not the bare document defaults.
    expect(paragraphs[2]).toContain("margin:0pt 0 2pt");
    expect(paragraphs[2]).toContain("font-size:10.5pt");
    expect(render.fontFamily).toBe("Liberation Serif");
    expect(render.fontSizePt).toBe(10.5);
  });

  it("lets a run switch off bold that its paragraph style turns on", () => {
    const styles =
      `<?xml version="1.0"?><w:styles ${WORD_NS}>` +
      '<w:style w:type="paragraph" w:styleId="Title"><w:rPr><w:b/></w:rPr></w:style></w:styles>';
    const buffer = docx(
      '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>plain</w:t></w:r></w:p>',
      { "word/styles.xml": styles },
    );
    const { html } = renderDocxToPrintHtml(buffer);

    expect(html).toMatch(/<p style="[^"]*font-weight:700/);
    expect(html).toContain('<span style="font-weight:400">plain</span>');
  });

  it("prints both employment contracts with the same compact spacing", () => {
    const signatures = ["kontrate-me-afat-te-caktuar", "kontrate-me-afat-te-pacaktuar"].map((name) => {
      const { html } = renderDocxToPrintHtml(
        readFileSync(path.join(process.cwd(), "templates/contracts", `${name}.docx`)),
      );
      const paragraphs = [...html.matchAll(/<p style="([^"]*)"/g)].map((m) => m[1]!);
      const clauses = paragraphs.filter((s) => s.includes("text-align:justify"));
      expect(clauses.length, name).toBeGreaterThan(40);
      for (const clause of clauses) {
        expect(clause, name).toContain("margin:0pt 0 2.5pt");
        expect(clause, name).toContain("line-height:1.21");
        expect(clause, name).toContain("font-size:10pt");
      }
      // Only the one deliberate 10pt gap, under the contract's title.
      const wideGaps = paragraphs.filter((s) => Number(s.match(/margin:[\d.]+pt 0 ([\d.]+)pt/)?.[1]) >= 10);
      expect(wideGaps, name).toHaveLength(1);
      return [...new Set(paragraphs)].sort();
    });

    expect(signatures[0]).toEqual(signatures[1]);
  });

  it("converts the real contract template without leaving markup artefacts", () => {
    const templatePath = path.join(
      process.cwd(),
      "templates/contracts/kontrate-me-afat-te-pacaktuar.docx",
    );
    const { html, geometry } = renderDocxToPrintHtml(readFileSync(templatePath));

    expect(html).toContain("KONTRATË PUNE");
    expect(html).toContain("<table");
    // Word markup must not survive into the HTML.
    expect(html).not.toMatch(/<w:/);
    expect(geometry?.widthMm).toBeGreaterThan(200);
  });
});

describe("buildPrintPageHtml", () => {
  const render = (html: string) => ({
    html,
    logoDataUri: null,
    geometry: null,
    fontFamily: null,
    fontSizePt: null,
  });

  it("puts every document on its own sheet and breaks pages between them", () => {
    const page = buildPrintPageHtml([
      { title: "Kontrata A", render: render("<p>A</p>") },
      { title: "Kontrata B", render: render("<p>B</p>") },
      { title: "Kontrata C", render: render("<p>C</p>") },
    ]);

    expect(page.match(/class="sheet"/g)).toHaveLength(3);
    expect(page).toContain("page-break-before: always");
    expect(page).toContain("3 dokumente");
    expect(page).toContain("window.print()");
  });

  it("leaves no @page margin box for the browser to print its header and footer into", () => {
    const page = buildPrintPageHtml([{ title: "Kontrata", render: render("<p>A</p>") }]);

    expect(page).toMatch(/@page \{[^}]*margin: 0;/);
    // The margins move into the sheet, repeated per page by the wrapper table.
    expect(page.match(/class="gap-top"/g)).toHaveLength(1);
    expect(page).toContain("<thead>");
    expect(page).toContain("<tfoot>");
  });

  it("escapes document titles", () => {
    const page = buildPrintPageHtml([
      { title: '<img src=x onerror="alert(1)">', render: render("<p>A</p>") },
    ]);
    expect(page).not.toContain("<img src=x");
    expect(page).toContain("&lt;img src=x");
  });
});
