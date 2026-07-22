import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import contractManifest from "../../../../templates/contracts/manifest.json";
import { detectDocxTemplate } from "../engine/detect-docx-template";

const fixedTermKeys = [
  "company_name",
  "authorized_person_name",
  "employee_name",
  "employee_job_description",
  "workplace",
  "contract_start_date",
  "contract_end_date",
  "employment_start_date",
  "probation_period",
  "daily_hours",
  "weekly_hours",
  "salary_gross",
  "travel_compensation",
  "document_date",
  "document_place",
  "authorized_person_name",
  "employee_name",
];

const indefiniteKeys = [
  "company_name",
  "authorized_person_name",
  "employee_name",
  "employee_job_description",
  "workplace",
  "contract_start_date",
  "employment_start_date",
  "probation_period",
  "daily_hours",
  "weekly_hours",
  "salary_gross",
  "travel_compensation",
  "document_date",
  "document_place",
  "authorized_person_name",
  "employee_name",
];

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
  const paragraphs = Array.from({ length: count }, (_, i) => `<w:p><w:r><w:t>Field ${i + 1}: ____</w:t></w:r></w:p>`);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr/></w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

describe("detectDocxTemplate", () => {
  it("maps the NENI 3 workplace field to the workplace placeholder", () => {
    for (const template of contractManifest.templates) {
      const fields = "fields" in template ? template.fields : undefined;
      if (!fields) continue;
      expect(fields[4]).toBe("workplace");
    }
  });

  it("detects 17 blanks for fixed-term contract template", () => {
    const buf = docxWithBlanks(17);
    const result = detectDocxTemplate(buf, { templateSubtype: "AFAT_I_CAKTUAR" });
    expect(result.detectionMode).toBe("BLANK_FIELDS");
    expect(result.blankFields).toHaveLength(17);
    expect(result.blankFields.map((field) => field.suggestedKey)).toEqual(fixedTermKeys);
  });

  it("detects 16 blanks for indefinite contract template", () => {
    const buf = docxWithBlanks(16);
    const result = detectDocxTemplate(buf, { templateSubtype: "AFAT_I_PACAKTUAR" });
    expect(result.blankFields).toHaveLength(16);
    expect(result.blankFields.map((field) => field.suggestedKey)).toEqual(indefiniteKeys);
  });
});
