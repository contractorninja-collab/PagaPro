import PizZip from "pizzip";
import {
  COMPANY_LOGO_MAX_HEIGHT_MM,
  COMPANY_LOGO_MAX_WIDTH_MM,
  containDimensions,
  type CompanyLogoAsset,
} from "@/modules/company-branding/company-logo";
import { normalizeDocxFontsInZip } from "@/modules/documents/engine/render/normalize-docx-fonts";

const HEADER_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header";
const FOOTER_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer";
const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const SETTINGS_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings";
const MM_TO_EMU = 36_000;
const MM_TO_TWIPS = 1_440 / 25.4;
const LOGO_HEADER_OFFSET_MM = 3;
const LOGO_HEADER_GAP_MM = 6;
const GENERATED_BY_TEXT = "Gjeneruar nga PagaPRO";

export interface DocxBrandingOptions {
  companyName?: string | null;
}

function relationshipTarget(relsXml: string, relationshipId: string): string | null {
  const escaped = relationshipId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = relsXml.match(
    new RegExp(`<Relationship\\b(?=[^>]*\\bId=["']${escaped}["'])(?=[^>]*\\bTarget=["']([^"']+)["'])[^>]*/?>`, "i"),
  );
  return match?.[1] ?? null;
}

function nextRelationshipId(xml: string, prefix: string): string {
  let candidate = prefix;
  let suffix = 1;
  while (new RegExp(`\\bId=["']${candidate}["']`).test(xml)) {
    candidate = `${prefix}${suffix++}`;
  }
  return candidate;
}

function insertBeforeClosing(xml: string, closingTag: string, content: string): string {
  const index = xml.lastIndexOf(closingTag);
  if (index < 0) throw new Error(`Invalid OOXML part: missing ${closingTag}`);
  return `${xml.slice(0, index)}${content}${xml.slice(index)}`;
}

function displayedLogoSize(logo: CompanyLogoAsset): { width: number; height: number } {
  return containDimensions(
    logo.width,
    logo.height,
    COMPANY_LOGO_MAX_WIDTH_MM,
    COMPANY_LOGO_MAX_HEIGHT_MM,
  );
}

function logoDrawingXml(
  size: { width: number; height: number },
  relationshipId: string,
): string {
  const cx = Math.round(size.width * MM_TO_EMU);
  const cy = Math.round(size.height * MM_TO_EMU);

  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="left"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="900001" name="PagaPRO Company Logo" descr="Company logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="company-logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function setTwipsAttribute(tag: string, name: string, value: number): string {
  const attribute = new RegExp(`\\s${name}=["'][^"']*["']`);
  if (attribute.test(tag)) return tag.replace(attribute, ` ${name}="${value}"`);
  return tag.replace(/\s*\/?>(?=$)/, (ending) => ` ${name}="${value}"${ending}`);
}

function reserveHeaderSpace(section: string, logoHeightMm: number): string {
  const requiredTop = Math.ceil(
    (LOGO_HEADER_OFFSET_MM + logoHeightMm + LOGO_HEADER_GAP_MM) * MM_TO_TWIPS,
  );
  const headerOffset = Math.round(LOGO_HEADER_OFFSET_MM * MM_TO_TWIPS);
  const pageMargins = section.match(/<w:pgMar\b[^>]*\/?\s*>/)?.[0];

  if (!pageMargins) {
    const margins = `<w:pgMar w:top="${requiredTop}" w:right="1440" w:bottom="1440" w:left="1440" w:header="${headerOffset}" w:footer="720" w:gutter="0"/>`;
    return section.replace(/(<w:cols\b|<w:docGrid\b|<\/w:sectPr>)/, `${margins}$1`);
  }

  const currentTop = Number(pageMargins.match(/\bw:top=["'](\d+)["']/)?.[1] ?? 0);
  const currentHeader = Number(
    pageMargins.match(/\bw:header=["'](\d+)["']/)?.[1] ?? headerOffset,
  );
  let nextMargins = setTwipsAttribute(pageMargins, "w:top", Math.max(currentTop, requiredTop));
  nextMargins = setTwipsAttribute(
    nextMargins,
    "w:header",
    Math.min(currentHeader, headerOffset),
  );
  return section.replace(pageMargins, nextMargins);
}

function emptyHeaderXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"></w:hdr>`;
}

function emptyFooterXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:ftr>';
}

function generatedByFooterXml(): string {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Liberation Sans" w:hAnsi="Liberation Sans" w:eastAsia="Liberation Sans" w:cs="Liberation Sans"/><w:sz w:val="14"/><w:szCs w:val="14"/><w:color w:val="7A8290"/></w:rPr><w:t>${GENERATED_BY_TEXT}</w:t></w:r></w:p>`;
}

function ensureHeaderNamespaces(xml: string): string {
  const namespaces: Array<[string, string]> = [
    ["r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships"],
    ["wp", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"],
    ["a", "http://schemas.openxmlformats.org/drawingml/2006/main"],
    ["pic", "http://schemas.openxmlformats.org/drawingml/2006/picture"],
  ];
  return xml.replace(/<w:hdr\b([^>]*)>/, (full, attrs: string) => {
    let next = attrs;
    for (const [prefix, uri] of namespaces) {
      if (!new RegExp(`xmlns:${prefix}=`).test(next)) next += ` xmlns:${prefix}="${uri}"`;
    }
    return `<w:hdr${next}>`;
  });
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
  ).join("").trim();
}

function suppressLeadingCompanyName(documentXml: string, companyName: string): string {
  const expected = companyName.trim();
  if (!expected) return documentXml;
  let nonEmptyParagraphs = 0;
  let removed = false;
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (removed) return paragraph;
    const text = paragraphText(paragraph);
    if (!text) return paragraph;
    nonEmptyParagraphs += 1;
    if (nonEmptyParagraphs <= 3 && text === expected) {
      removed = true;
      return "";
    }
    return paragraph;
  });
}

function wordPartFromTarget(target: string): string {
  const normalized = target.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized.startsWith("word/") ? normalized : `word/${normalized}`;
}

function headerReferenceId(section: string, type: string): string | null {
  const reference = section.match(
    new RegExp(`<w:headerReference\\b(?=[^>]*\\bw:type=["']${type}["'])[^>]*>`),
  )?.[0];
  return reference?.match(/\br:id=["']([^"']+)["']/)?.[1] ?? null;
}

function insertHeaderReference(section: string, type: string, relationshipId: string): string {
  const references = Array.from(section.matchAll(/<w:headerReference\b[^>]*>/g));
  const boundaryReference = type === "even" ? references[0] : references.at(-1);
  const insertAt = boundaryReference?.index !== undefined
    ? boundaryReference.index + (type === "even" ? 0 : boundaryReference[0].length)
    : section.indexOf(">") + 1;
  const reference = `<w:headerReference w:type="${type}" r:id="${relationshipId}"/>`;
  return `${section.slice(0, insertAt)}${reference}${section.slice(insertAt)}`;
}

function footerReferenceId(section: string, type: string): string | null {
  const reference = section.match(
    new RegExp(`<w:footerReference\\b(?=[^>]*\\bw:type=["']${type}["'])[^>]*>`),
  )?.[0];
  return reference?.match(/\br:id=["']([^"']+)["']/)?.[1] ?? null;
}

function insertEvenFooterReference(section: string, relationshipId: string): string {
  const firstFooter = section.match(/<w:footerReference\b[^>]*>/);
  const insertAt = firstFooter?.index ?? (() => {
    const headers = Array.from(section.matchAll(/<w:headerReference\b[^>]*>/g));
    const lastHeader = headers.at(-1);
    return lastHeader?.index !== undefined
      ? lastHeader.index + lastHeader[0].length
      : section.indexOf(">") + 1;
  })();
  const reference = `<w:footerReference w:type="even" r:id="${relationshipId}"/>`;
  return `${section.slice(0, insertAt)}${reference}${section.slice(insertAt)}`;
}

/** Applies repeating company branding while preserving existing header/footer content. */
export function applyCompanyLogoToDocx(
  docxBuffer: Buffer,
  logo: CompanyLogoAsset | null,
  options: DocxBrandingOptions = {},
): Buffer {
  const zip = new PizZip(docxBuffer);
  normalizeDocxFontsInZip(zip);
  const documentFile = zip.file("word/document.xml");
  const documentRelsFile = zip.file("word/_rels/document.xml.rels");
  if (!documentFile || !documentRelsFile) throw new Error("DOCX is missing document relationships");

  let documentXml = documentFile.asText();
  let documentRelsXml = documentRelsFile.asText();
  const logoSize = logo ? displayedLogoSize(logo) : null;
  const referencedHeaders = new Set<string>();
  const referencedFooters = new Set<string>();
  const createdHeaders = new Set<string>();
  const createdFooters = new Set<string>();
  let createdSettings = false;

  documentXml.replace(/<w:headerReference\b[^>]*\br:id=["']([^"']+)["'][^>]*\/?\s*>/g, (_all, id: string) => {
    const target = relationshipTarget(documentRelsXml, id);
    if (target) referencedHeaders.add(wordPartFromTarget(target));
    return _all;
  });
  documentXml.replace(/<w:footerReference\b[^>]*\br:id=["']([^"']+)["'][^>]*\/?\s*>/g, (_all, id: string) => {
    const target = relationshipTarget(documentRelsXml, id);
    if (target) referencedFooters.add(wordPartFromTarget(target));
    return _all;
  });

  const headerNumbers = Object.keys(zip.files)
    .map((name) => name.match(/^word\/header(\d+)\.xml$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  let nextHeaderNumber = Math.max(0, ...headerNumbers) + 1;
  const footerNumbers = Object.keys(zip.files)
    .map((name) => name.match(/^word\/footer(\d+)\.xml$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  let nextFooterNumber = Math.max(0, ...footerNumbers) + 1;

  const addSharedHeader = (): { part: string; relId: string } => {
    const part = `word/header${nextHeaderNumber++}.xml`;
    const relId = nextRelationshipId(documentRelsXml, "rIdPagaproHeader");
    documentRelsXml = insertBeforeClosing(
      documentRelsXml,
      "</Relationships>",
      `<Relationship Id="${relId}" Type="${HEADER_REL_TYPE}" Target="${part.slice("word/".length)}"/>`,
    );
    zip.file(part, emptyHeaderXml());
    referencedHeaders.add(part);
    createdHeaders.add(part);
    return { part, relId };
  };

  const addSharedFooter = (): { part: string; relId: string } => {
    const part = `word/footer${nextFooterNumber++}.xml`;
    const relId = nextRelationshipId(documentRelsXml, "rIdPagaproFooter");
    documentRelsXml = insertBeforeClosing(
      documentRelsXml,
      "</Relationships>",
      `<Relationship Id="${relId}" Type="${FOOTER_REL_TYPE}" Target="${part.slice("word/".length)}"/>`,
    );
    zip.file(part, emptyFooterXml());
    referencedFooters.add(part);
    createdFooters.add(part);
    return { part, relId };
  };

  const cloneHeader = (sourceRelId: string): string | null => {
    const target = relationshipTarget(documentRelsXml, sourceRelId);
    if (!target) return null;
    const sourcePart = wordPartFromTarget(target);
    const sourceFile = zip.file(sourcePart);
    if (!sourceFile) return null;

    const part = `word/header${nextHeaderNumber++}.xml`;
    const relId = nextRelationshipId(documentRelsXml, "rIdPagaproHeaderClone");
    documentRelsXml = insertBeforeClosing(
      documentRelsXml,
      "</Relationships>",
      `<Relationship Id="${relId}" Type="${HEADER_REL_TYPE}" Target="${part.slice("word/".length)}"/>`,
    );
    zip.file(part, sourceFile.asText());
    const sourceRelsPart = `word/_rels/${sourcePart.slice("word/".length)}.rels`;
    const clonedRelsPart = `word/_rels/${part.slice("word/".length)}.rels`;
    const sourceRelsFile = zip.file(sourceRelsPart);
    if (sourceRelsFile) zip.file(clonedRelsPart, sourceRelsFile.asText());
    referencedHeaders.add(part);
    createdHeaders.add(part);
    return relId;
  };

  const cloneFooter = (sourceRelId: string): string | null => {
    const target = relationshipTarget(documentRelsXml, sourceRelId);
    if (!target) return null;
    const sourcePart = wordPartFromTarget(target);
    const sourceFile = zip.file(sourcePart);
    if (!sourceFile) return null;

    const part = `word/footer${nextFooterNumber++}.xml`;
    const relId = nextRelationshipId(documentRelsXml, "rIdPagaproFooterClone");
    documentRelsXml = insertBeforeClosing(
      documentRelsXml,
      "</Relationships>",
      `<Relationship Id="${relId}" Type="${FOOTER_REL_TYPE}" Target="${part.slice("word/".length)}"/>`,
    );
    zip.file(part, sourceFile.asText());
    const sourceRelsPart = `word/_rels/${sourcePart.slice("word/".length)}.rels`;
    const clonedRelsPart = `word/_rels/${part.slice("word/".length)}.rels`;
    const sourceRelsFile = zip.file(sourceRelsPart);
    if (sourceRelsFile) zip.file(clonedRelsPart, sourceRelsFile.asText());
    referencedFooters.add(part);
    createdFooters.add(part);
    return relId;
  };

  const settingsFile = zip.file("word/settings.xml");
  const settingsHadEvenAndOddHeaders = Boolean(
    settingsFile?.asText().match(/<w:evenAndOddHeaders\b/),
  );
  if (logo && settingsFile) {
    let settingsXml = settingsFile
      .asText()
      .replace(/<w:evenAndOddHeaders\b[^>]*\/?\s*>/g, "");
    settingsXml = settingsXml.replace(
      /(<w:characterSpacingControl\b|<w:footnotePr\b|<w:endnotePr\b|<w:compat\b|<\/w:settings>)/,
      "<w:evenAndOddHeaders/>$1",
    );
    zip.file("word/settings.xml", settingsXml);
  } else if (logo) {
    const settingsRelId = nextRelationshipId(documentRelsXml, "rIdPagaproSettings");
    documentRelsXml = insertBeforeClosing(
      documentRelsXml,
      "</Relationships>",
      `<Relationship Id="${settingsRelId}" Type="${SETTINGS_REL_TYPE}" Target="settings.xml"/>`,
    );
    zip.file(
      "word/settings.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:evenAndOddHeaders/></w:settings>',
    );
    createdSettings = true;
  }

  let sharedHeader: { part: string; relId: string } | null = null;
  let sharedFooter: { part: string; relId: string } | null = null;
  documentXml = documentXml.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, (section) => {
    const hasTitlePage = /<w:titlePg\b/.test(section);
    const requiredHeaderTypes = ["default", "even"];
    if (hasTitlePage) requiredHeaderTypes.push("first");
    const requiredFooterTypes = ["default"];
    if (logo || settingsHadEvenAndOddHeaders) requiredFooterTypes.push("even");
    if (hasTitlePage) requiredFooterTypes.push("first");
    let next = section;
    if (logo) {
      for (const type of requiredHeaderTypes) {
        if (!headerReferenceId(next, type)) {
          const defaultRelId = type === "default" ? null : headerReferenceId(next, "default");
          const clonedRelId = defaultRelId ? cloneHeader(defaultRelId) : null;
          if (!clonedRelId) sharedHeader ??= addSharedHeader();
          const relId = clonedRelId ?? sharedHeader!.relId;
          next = insertHeaderReference(next, type, relId);
        }
      }
    }

    for (const type of requiredFooterTypes) {
      if (footerReferenceId(next, type)) continue;
      const defaultRelId = type === "default" ? null : footerReferenceId(next, "default");
      const clonedRelId = defaultRelId ? cloneFooter(defaultRelId) : null;
      if (!clonedRelId) sharedFooter ??= addSharedFooter();
      const relId = clonedRelId ?? sharedFooter!.relId;
      if (type === "even") {
        next = insertEvenFooterReference(next, relId);
      } else {
        const reference = `<w:footerReference w:type="${type}" r:id="${relId}"/>`;
        const firstFooter = next.match(/<w:footerReference\b[^>]*>/);
        const insertAt = firstFooter?.index ?? (() => {
          const headers = Array.from(next.matchAll(/<w:headerReference\b[^>]*>/g));
          const lastHeader = headers.at(-1);
          return lastHeader?.index !== undefined
            ? lastHeader.index + lastHeader[0].length
            : next.indexOf(">") + 1;
        })();
        next = `${next.slice(0, insertAt)}${reference}${next.slice(insertAt)}`;
      }
    }
    return logoSize ? reserveHeaderSpace(next, logoSize.height) : next;
  });

  if (logo) {
    const mediaName = "word/media/pagapro-company-logo.png";
    zip.file(mediaName, logo.bytes);
  }

  if (logo && logoSize) {
    for (const headerPart of referencedHeaders) {
      const file = zip.file(headerPart);
      if (!file) continue;
      const relsPart = `word/_rels/${headerPart.slice("word/".length)}.rels`;
      let relsXml = zip.file(relsPart)?.asText() ??
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
      const imageRelId = nextRelationshipId(relsXml, "rIdPagaproCompanyLogo");
      relsXml = insertBeforeClosing(
        relsXml,
        "</Relationships>",
        `<Relationship Id="${imageRelId}" Type="${IMAGE_REL_TYPE}" Target="media/pagapro-company-logo.png"/>`,
      );
      zip.file(relsPart, relsXml);

      let headerXml = ensureHeaderNamespaces(file.asText());
      if (options.companyName) {
        headerXml = suppressLeadingCompanyName(headerXml, options.companyName);
      }
      headerXml = headerXml.replace(/(<w:hdr\b[^>]*>)/, `$1${logoDrawingXml(logoSize, imageRelId)}`);
      zip.file(headerPart, headerXml);
    }
  }

  for (const footerPart of referencedFooters) {
    const file = zip.file(footerPart);
    if (!file) continue;
    let footerXml = file.asText();
    if (!footerXml.includes(GENERATED_BY_TEXT)) {
      footerXml = insertBeforeClosing(footerXml, "</w:ftr>", generatedByFooterXml());
      zip.file(footerPart, footerXml);
    }
  }

  let contentTypes = zip.file("[Content_Types].xml")?.asText();
  if (!contentTypes) throw new Error("DOCX is missing content types");
  if (logo && !/<Default\b[^>]*\bExtension=["']png["']/i.test(contentTypes)) {
    contentTypes = insertBeforeClosing(contentTypes, "</Types>", '<Default Extension="png" ContentType="image/png"/>');
  }
  for (const headerPart of createdHeaders) {
    const partName = `/${headerPart}`;
    if (!contentTypes.includes(`PartName="${partName}"`)) {
      contentTypes = insertBeforeClosing(
        contentTypes,
        "</Types>",
        `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`,
      );
    }
  }
  for (const footerPart of createdFooters) {
    const partName = `/${footerPart}`;
    if (!contentTypes.includes(`PartName="${partName}"`)) {
      contentTypes = insertBeforeClosing(
        contentTypes,
        "</Types>",
        `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`,
      );
    }
  }
  if (createdSettings && !contentTypes.includes('PartName="/word/settings.xml"')) {
    contentTypes = insertBeforeClosing(
      contentTypes,
      "</Types>",
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>',
    );
  }
  zip.file("[Content_Types].xml", contentTypes);

  if (logo && options.companyName) {
    documentXml = suppressLeadingCompanyName(documentXml, options.companyName);
  }
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", documentRelsXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
