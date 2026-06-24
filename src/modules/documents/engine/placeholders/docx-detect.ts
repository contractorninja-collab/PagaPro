import PizZip from "pizzip";
import { parsePlaceholdersFromTexts } from "./parser";

/** Reads `word/document*.xml` parts from a DOCX (ZIP) and extracts {{placeholders}}. */
export function detectPlaceholdersInDocxBuffer(docxBuffer: Buffer): string[] {
  const zip = new PizZip(docxBuffer);
  const parts: string[] = [];

  for (const name of Object.keys(zip.files)) {
    if (/^word\/document\d*\.xml$/i.test(name)) {
      const file = zip.files[name];
      if (file && !file.dir) {
        parts.push(file.asText());
      }
    }
  }

  if (parts.length === 0) {
    throw new Error("DOCX has no word/document*.xml parts — invalid or encrypted file");
  }

  return parsePlaceholdersFromTexts(parts);
}
