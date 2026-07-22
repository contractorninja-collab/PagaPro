import PizZip from "pizzip";
import {
  COMPANY_LOGO_MAX_HEIGHT_MM,
  COMPANY_LOGO_MAX_WIDTH_MM,
  containDimensions,
  type CompanyLogoAsset,
} from "@/modules/company-branding/company-logo";

const HEADER_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header";
const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const MM_TO_EMU = 36_000;

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

function logoDrawingXml(logo: CompanyLogoAsset, relationshipId: string): string {
  const size = containDimensions(
    logo.width,
    logo.height,
    COMPANY_LOGO_MAX_WIDTH_MM,
    COMPANY_LOGO_MAX_HEIGHT_MM,
  );
  const cx = Math.round(size.width * MM_TO_EMU);
  const cy = Math.round(size.height * MM_TO_EMU);

  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/><w:jc w:val="left"/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="900001" name="PagaPRO Company Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="company-logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
}

function emptyHeaderXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"></w:hdr>`;
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

function headerPartFromTarget(target: string): string {
  const normalized = target.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized.startsWith("word/") ? normalized : `word/${normalized}`;
}

/** Adds a floating, left-aligned logo to repeating headers without changing body content. */
export function applyCompanyLogoToDocx(docxBuffer: Buffer, logo: CompanyLogoAsset | null): Buffer {
  if (!logo) return docxBuffer;

  const zip = new PizZip(docxBuffer);
  const documentFile = zip.file("word/document.xml");
  const documentRelsFile = zip.file("word/_rels/document.xml.rels");
  if (!documentFile || !documentRelsFile) throw new Error("DOCX is missing document relationships");

  let documentXml = documentFile.asText();
  let documentRelsXml = documentRelsFile.asText();
  const referencedHeaders = new Set<string>();
  const createdHeaders = new Set<string>();

  documentXml.replace(/<w:headerReference\b[^>]*\br:id=["']([^"']+)["'][^>]*\/?\s*>/g, (_all, id: string) => {
    const target = relationshipTarget(documentRelsXml, id);
    if (target) referencedHeaders.add(headerPartFromTarget(target));
    return _all;
  });

  const headerNumbers = Object.keys(zip.files)
    .map((name) => name.match(/^word\/header(\d+)\.xml$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  let nextHeaderNumber = Math.max(0, ...headerNumbers) + 1;

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

  let sharedHeader: { part: string; relId: string } | null = null;
  const evenHeadersEnabled = /<w:evenAndOddHeaders\b/.test(zip.file("word/settings.xml")?.asText() ?? "");
  documentXml = documentXml.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, (section) => {
    const requiredTypes = ["default"];
    if (/<w:titlePg\b/.test(section)) requiredTypes.push("first");
    if (evenHeadersEnabled) requiredTypes.push("even");
    let next = section;
    for (const type of requiredTypes) {
      const hasType = new RegExp(`<w:headerReference\\b(?=[^>]*\\bw:type=["']${type}["'])`).test(next);
      if (!hasType) {
        sharedHeader ??= addSharedHeader();
        next = next.replace(/(<w:sectPr\b[^>]*>)/, `$1<w:headerReference w:type="${type}" r:id="${sharedHeader.relId}"/>`);
      }
    }
    return next;
  });

  const mediaName = "word/media/pagapro-company-logo.png";
  zip.file(mediaName, logo.bytes);

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
    headerXml = headerXml.replace(/(<w:hdr\b[^>]*>)/, `$1${logoDrawingXml(logo, imageRelId)}`);
    zip.file(headerPart, headerXml);
  }

  let contentTypes = zip.file("[Content_Types].xml")?.asText();
  if (!contentTypes) throw new Error("DOCX is missing content types");
  if (!/<Default\b[^>]*\bExtension=["']png["']/i.test(contentTypes)) {
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
  zip.file("[Content_Types].xml", contentTypes);

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", documentRelsXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
