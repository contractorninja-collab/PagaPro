import { describe, expect, it } from "vitest";
import {
  generateDocumentPayloadSchema,
  resolvedSubjectIdAndDate,
  uploadTemplateVersionFormSchema,
} from "../validators/document-schemas";

describe("generateDocumentPayloadSchema", () => {
  it("accepts PAYROLL and OTHER subject kinds", () => {
    const payroll = generateDocumentPayloadSchema.parse({
      documentTemplateId: "t1",
      subjectKind: "PAYROLL",
      payrollId: "p1",
      employeeId: "e1",
    });
    expect(payroll.subjectKind).toBe("PAYROLL");

    const other = generateDocumentPayloadSchema.parse({
      documentTemplateId: "t1",
      subjectKind: "OTHER",
      title: "Note",
    });
    expect(other.subjectKind).toBe("OTHER");
  });
});

describe("resolvedSubjectIdAndDate", () => {
  it("generates a UUID subject id when kind is OTHER and subjectId is empty", () => {
    const out = resolvedSubjectIdAndDate({
      documentTemplateId: "t",
      subjectKind: "OTHER",
    });
    expect(out.subjectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("parses documentDateIso when valid", () => {
    const out = resolvedSubjectIdAndDate({
      documentTemplateId: "t",
      subjectKind: "CONTRACT",
      subjectId: "sub",
      documentDateIso: "2026-03-15",
    });
    expect(out.documentDate.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("falls back to current instant when documentDateIso is invalid", () => {
    const before = Date.now();
    const out = resolvedSubjectIdAndDate({
      documentTemplateId: "t",
      subjectKind: "CONTRACT",
      subjectId: "sub",
      documentDateIso: "",
    });
    expect(out.documentDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(out.documentDate.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
  });
});

describe("uploadTemplateVersionFormSchema", () => {
  it("parses optional template metadata fields", () => {
    const parsed = uploadTemplateVersionFormSchema.parse({
      templateId: "tpl",
      changelog: "v2",
      documentCategory: "PAYROLL",
    });
    expect(parsed.templateId).toBe("tpl");
    expect(parsed.documentCategory).toBe("PAYROLL");
  });
});
