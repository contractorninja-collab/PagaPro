import PizZip from "pizzip";
import type { BlankFieldMapping } from "../../types/template-mapping";

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;
const BLANK_RE = /_{4,}/g;
const PARAGRAPH_RE = /<w:p[\s>][\s\S]*?<\/w:p>/g;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sortedXmlPartNames(zip: PizZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => {
      const file = zip.files[name];
      return Boolean(file && !file.dir && XML_PART.test(name));
    })
    .sort();
}

function mergedParagraphText(paragraphXml: string): string {
  const parts: string[] = [];
  for (const m of paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
    parts.push(m[1] ?? "");
  }
  return parts.join("");
}

function firstRunProps(paragraphXml: string): string {
  const m = paragraphXml.match(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/);
  if (!m) return "";
  const rPr = m[1]!.match(/<w:rPr[\s\S]*?<\/w:rPr>/);
  return rPr ? rPr[0]! : "";
}

function replaceParagraphBlanks(
  paragraphXml: string,
  valueByIndex: Map<number, string>,
  state: { nextIndex: number },
): string {
  const merged = mergedParagraphText(paragraphXml);
  if (!BLANK_RE.test(merged)) return paragraphXml;

  let blankCursor = 0;
  const replaced = merged.replace(BLANK_RE, (match) => {
    blankCursor += 1;
    const idx = state.nextIndex + blankCursor;
    const value = valueByIndex.get(idx);
    if (!value) return match;
    return value;
  });

  state.nextIndex += blankCursor;

  if (replaced === merged) return paragraphXml;

  const pOpen = paragraphXml.match(/^<w:p[^>]*>/)?.[0] ?? "<w:p>";
  const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const rPr = firstRunProps(paragraphXml);
  const run = `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(replaced)}</w:t></w:r>`;
  return `${pOpen}${pPr}${run}</w:p>`;
}

function replaceBlanksInXmlPart(xml: string, valueByIndex: Map<number, string>): string {
  const state = { nextIndex: 0 };
  return xml.replace(PARAGRAPH_RE, (paragraph) =>
    replaceParagraphBlanks(paragraph, valueByIndex, state),
  );
}

/**
 * Replaces underscore blanks in document order using mappingJson.blankFields indices.
 */
export function fillMappedBlankFieldsInDocx(
  docxBuffer: Buffer,
  blankMappings: BlankFieldMapping[],
  values: Record<string, string>,
): Buffer {
  const valueByIndex = new Map<number, string>();
  for (const m of blankMappings) {
    const raw = values[m.placeholderKey]?.trim() || m.fallback?.trim() || "";
    if (raw) valueByIndex.set(m.index, raw);
  }

  const zip = new PizZip(docxBuffer);
  for (const name of sortedXmlPartNames(zip)) {
    const file = zip.files[name]!;
    zip.file(name, replaceBlanksInXmlPart(file.asText(), valueByIndex));
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

export function countMappedBlankSlots(docxBuffer: Buffer): number {
  const zip = new PizZip(docxBuffer);
  let count = 0;
  for (const name of sortedXmlPartNames(zip)) {
    const xml = zip.files[name]!.asText();
    for (const paragraph of xml.match(PARAGRAPH_RE) ?? []) {
      const merged = mergedParagraphText(paragraph);
      const matches = merged.match(BLANK_RE);
      if (matches) count += matches.length;
    }
  }
  return count;
}
