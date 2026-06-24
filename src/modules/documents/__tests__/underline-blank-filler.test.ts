import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import {
  countUnderlineBlanksInDocx,
  fillUnderlineBlanksInDocx,
} from "../engine/render/underline-blank-filler";

function docxWithBlanks(count: number): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const paragraphs = Array.from({ length: count }, (_, i) => `<w:p><w:r><w:t>Contract field ${i + 1}: ____</w:t></w:r></w:p>`);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr/></w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

describe("underline blank filler", () => {
  it("fills stub caktuar template in field order", () => {
    const fields = [
      "company_name",
      "company_nui",
      "company_nrb",
      "company_address",
      "employee_name",
      "employee_personal_number",
      "employee_position",
      "contract_start_date",
      "contract_end_date",
      "salary_gross",
      "authorized_person_name",
      "authorized_person_position",
      "document_date",
    ];
    const buf = docxWithBlanks(fields.length);
    expect(countUnderlineBlanksInDocx(buf)).toBe(fields.length);

    const filled = fillUnderlineBlanksInDocx(buf, fields, {
      company_name: "Test Co",
      employee_name: "John Doe",
      contract_start_date: "01.01.2026",
      contract_end_date: "01.01.2027",
      document_date: "09.06.2026",
    });

    const zip = new PizZip(filled);
    const xml = zip.files["word/document.xml"]!.asText();
    expect(xml).toContain("Test Co");
    expect(xml).toContain("John Doe");
    expect(xml).toContain("01.01.2026");
  });
});
