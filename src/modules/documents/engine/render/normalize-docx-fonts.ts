import PizZip from "pizzip";

export const DOCX_BODY_FONT = "Liberation Serif";
export const DOCX_HEADING_FONT = "Liberation Sans";

const HEADING_STYLE_IDS = new Set([
  "Title",
  "Subtitle",
  "ArticleTitle",
  ...Array.from({ length: 9 }, (_, index) => `Heading${index + 1}`),
]);
const ROMAN_HEADING = /^[IVXLCDM]+\.$/;

function fontTag(fontName: string): string {
  return `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:eastAsia="${fontName}" w:cs="${fontName}"/>`;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function paragraphText(paragraphXml: string): string {
  return Array.from(
    paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
    (match) => decodeXmlText(match[1] ?? ""),
  )
    .join("")
    .trim();
}

function paragraphUsesHeadingFont(paragraphXml: string): boolean {
  const styleId = paragraphXml.match(
    /<w:pStyle\b[^>]*\bw:val=["']([^"']+)["'][^>]*\/?>/,
  )?.[1];
  if (styleId && HEADING_STYLE_IDS.has(styleId)) return true;

  const text = paragraphText(paragraphXml);
  if (text.startsWith("Neni ") || ROMAN_HEADING.test(text)) return true;

  const sizes = Array.from(
    paragraphXml.matchAll(/<w:sz\b[^>]*\bw:val=["'](\d+)["'][^>]*\/?>/g),
    (match) => Number(match[1]),
  );
  const largestSize = sizes.length > 0 ? Math.max(...sizes) : 0;
  return largestSize >= 28 || (largestSize >= 24 && /<w:b\b/.test(paragraphXml));
}

function setRunFont(runXml: string, fontName: string): string {
  const replacement = fontTag(fontName);
  const properties = runXml.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0];
  if (properties) {
    const nextProperties = /<w:rFonts\b/.test(properties)
      ? properties.replace(
          /<w:rFonts\b[^>]*(?:\/>|>[\s\S]*?<\/w:rFonts>)/,
          replacement,
        )
      : properties.replace(/(<w:rPr\b[^>]*>)/, `$1${replacement}`);
    return runXml.replace(properties, nextProperties);
  }

  const selfClosingProperties = runXml.match(/<w:rPr\b[^>]*\/>/)?.[0];
  if (selfClosingProperties) {
    return runXml.replace(
      selfClosingProperties,
      `<w:rPr>${replacement}</w:rPr>`,
    );
  }

  return runXml.replace(/(<w:r\b[^>]*>)/, `$1<w:rPr>${replacement}</w:rPr>`);
}

function normalizeContentXml(xml: string): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const fontName = paragraphUsesHeadingFont(paragraph)
      ? DOCX_HEADING_FONT
      : DOCX_BODY_FONT;
    return paragraph.replace(
      /<w:r\b[\s\S]*?<\/w:r>/g,
      (run) => setRunFont(run, fontName),
    );
  });
}

function setPropertiesFont(containerXml: string, fontName: string): string {
  const replacement = fontTag(fontName);
  const properties = containerXml.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0];
  if (properties) {
    const nextProperties = /<w:rFonts\b/.test(properties)
      ? properties.replace(
          /<w:rFonts\b[^>]*(?:\/>|>[\s\S]*?<\/w:rFonts>)/,
          replacement,
        )
      : properties.replace(/(<w:rPr\b[^>]*>)/, `$1${replacement}`);
    return containerXml.replace(properties, nextProperties);
  }

  const selfClosingProperties = containerXml.match(/<w:rPr\b[^>]*\/>/)?.[0];
  if (selfClosingProperties) {
    return containerXml.replace(
      selfClosingProperties,
      `<w:rPr>${replacement}</w:rPr>`,
    );
  }

  return containerXml.replace(
    /(<\/w:(?:style|rPrDefault)>)/,
    `<w:rPr>${replacement}</w:rPr>$1`,
  );
}

function normalizeStylesXml(xml: string): string {
  let next = xml.replace(
    /<w:rPrDefault\b[\s\S]*?<\/w:rPrDefault>/g,
    (defaults) => setPropertiesFont(defaults, DOCX_BODY_FONT),
  );
  next = next.replace(/<w:style\b[\s\S]*?<\/w:style>/g, (style) => {
    const styleType = style.match(/\bw:type=["']([^"']+)["']/)?.[1];
    if (styleType !== "paragraph" && styleType !== "character") return style;
    const styleId = style.match(/\bw:styleId=["']([^"']+)["']/)?.[1];
    return setPropertiesFont(
      style,
      styleId && HEADING_STYLE_IDS.has(styleId)
        ? DOCX_HEADING_FONT
        : DOCX_BODY_FONT,
    );
  });
  return next;
}

/**
 * Normalizes rendered content and styles at download time so stored tenant
 * templates cannot retain Calibri or other legacy font overrides.
 */
export function normalizeDocxFontsInZip(zip: PizZip): void {
  const contentParts = Object.keys(zip.files).filter(
    (name) =>
      name === "word/document.xml" ||
      /^word\/header\d*\.xml$/.test(name) ||
      /^word\/footer\d*\.xml$/.test(name),
  );
  for (const part of contentParts) {
    const file = zip.file(part);
    if (file) zip.file(part, normalizeContentXml(file.asText()));
  }

  const styles = zip.file("word/styles.xml");
  if (styles) zip.file("word/styles.xml", normalizeStylesXml(styles.asText()));
}
