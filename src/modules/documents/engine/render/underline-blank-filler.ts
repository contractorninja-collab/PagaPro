import PizZip from "pizzip";

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;
const UNDERLINE_RE = /_{4,}/g;

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

/** Counts underscore blank sequences (4+ chars) across document XML parts. */
export function countUnderlineBlanksInDocx(docxBuffer: Buffer): number {
  const zip = new PizZip(docxBuffer);
  let count = 0;
  for (const name of sortedXmlPartNames(zip)) {
    const text = zip.files[name]!.asText();
    const matches = text.match(UNDERLINE_RE);
    if (matches) count += matches.length;
  }
  return count;
}

export function underlineFieldOrderFromJson(value: unknown): string[] | undefined {
  if (value == null || !Array.isArray(value)) return undefined;
  const keys = value.filter((x): x is string => typeof x === "string");
  return keys.length > 0 ? keys : undefined;
}

/**
 * Replaces underscore blanks in document order using an ordered field list and value map.
 * Blank count must match field list length (validated at seed/upload time).
 */
export function fillUnderlineBlanksInDocx(
  docxBuffer: Buffer,
  fieldKeys: string[],
  values: Record<string, string>,
): Buffer {
  const zip = new PizZip(docxBuffer);
  let fieldIndex = 0;

  const replaceInXml = (xml: string): string =>
    xml.replace(UNDERLINE_RE, (match) => {
      if (fieldIndex >= fieldKeys.length) return match;
      const key = fieldKeys[fieldIndex++]!;
      const value = values[key]?.trim();
      if (!value) return match;
      return escapeXml(value);
    });

  for (const name of sortedXmlPartNames(zip)) {
    const file = zip.files[name]!;
    zip.file(name, replaceInXml(file.asText()));
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
