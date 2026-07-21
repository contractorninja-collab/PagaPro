import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import type { DocumentStorage } from "../engine/storage/types";

const BUNDLED_TEMPLATE_DIRECTORIES: Record<string, string> = {
  CONTRACT: "contracts",
  LEAVE: "leave",
  TERMINATION: "termination",
};

interface BundledTemplateVersion {
  sourceStorageKey: string;
  originalFilename: string | null;
  template: { documentCategory: string };
}

const DOCX_XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;

function normalizeLegacyEmployeeName(source: Buffer): Buffer {
  const zip = new PizZip(source);
  for (const name of Object.keys(zip.files)) {
    const file = zip.files[name];
    if (!file || file.dir || !DOCX_XML_PART.test(name)) continue;
    zip.file(
      name,
      file.asText().replace(/\{\{\s*employee_name\s*\}\}/g, "{{employee_first_name}}"),
    );
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function loadTemplateSource(
  storage: DocumentStorage,
  version: BundledTemplateVersion,
): Promise<Buffer> {
  try {
    return await storage.get(version.sourceStorageKey);
  } catch (storageError) {
    const directory = BUNDLED_TEMPLATE_DIRECTORIES[version.template.documentCategory];
    const filename = version.originalFilename?.trim();
    if (!directory || !filename || path.basename(filename) !== filename) {
      throw storageError;
    }

    try {
      const source = await readFile(
        path.join(process.cwd(), "templates", directory, filename),
      );
      return directory === "leave" || directory === "termination"
        ? normalizeLegacyEmployeeName(source)
        : source;
    } catch {
      throw storageError;
    }
  }
}
