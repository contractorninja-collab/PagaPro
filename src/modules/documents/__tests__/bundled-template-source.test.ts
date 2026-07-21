import { describe, expect, it, vi } from "vitest";
import PizZip from "pizzip";
import type { DocumentStorage } from "../engine/storage/types";
import { loadTemplateSource } from "../services/bundled-template-source";

function storageWithGet(get: DocumentStorage["get"]): DocumentStorage {
  return {
    get,
    put: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
  };
}

describe("loadTemplateSource", () => {
  it("returns a source found in configured storage", async () => {
    const expected = Buffer.from("stored-template");
    const storage = storageWithGet(vi.fn().mockResolvedValue(expected));

    await expect(
      loadTemplateSource(storage, {
        sourceStorageKey: "documents/templates/stored.docx",
        originalFilename: "vertetim-pushim-lehonie.docx",
        template: { documentCategory: "LEAVE" },
      }),
    ).resolves.toEqual(expected);
  });

  it("loads a bundled maternity-leave DOCX when Vercel storage is missing", async () => {
    const storage = storageWithGet(vi.fn().mockRejectedValue(new Error("missing")));
    const source = await loadTemplateSource(storage, {
      sourceStorageKey: "documents/templates/missing/source.docx",
      originalFilename: "vertetim-pushim-lehonie.docx",
      template: { documentCategory: "LEAVE" },
    });

    expect(source.subarray(0, 2).toString()).toBe("PK");
    const xml = new PizZip(source).file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("{{employee_first_name}}");
    expect(xml).not.toContain("{{employee_name}}");
  });

  it("loads a bundled termination DOCX when Vercel storage is missing", async () => {
    const storage = storageWithGet(vi.fn().mockRejectedValue(new Error("missing")));
    const source = await loadTemplateSource(storage, {
      sourceStorageKey: "documents/templates/missing/source.docx",
      originalFilename: "vendim-nderprerje-vullnetare.docx",
      template: { documentCategory: "TERMINATION" },
    });

    expect(source.subarray(0, 2).toString()).toBe("PK");
  });

  it("preserves the storage error for a non-bundled file", async () => {
    const missing = new Error("missing custom template");
    const storage = storageWithGet(vi.fn().mockRejectedValue(missing));

    await expect(
      loadTemplateSource(storage, {
        sourceStorageKey: "documents/templates/custom/source.docx",
        originalFilename: "custom.docx",
        template: { documentCategory: "OTHER" },
      }),
    ).rejects.toBe(missing);
  });
});
