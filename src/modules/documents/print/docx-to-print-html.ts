import PizZip from "pizzip";

/**
 * Renders a generated DOCX to print-ready HTML.
 *
 * The serverless runtime has no DOCX→PDF converter, so a browser print view is the
 * only way to preview and print a batch of contracts without downloading each file.
 * This walks the WordprocessingML directly (rather than going through a generic
 * converter) so the things that matter in a contract survive: paragraph alignment,
 * bold/italic/underline runs, the borderless signature table, the page geometry and
 * the company logo that `applyCompanyLogoToDocx` puts in the header.
 */

const TWIPS_PER_MM = 1440 / 25.4;

export interface PrintPageGeometry {
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
}

export interface DocxPrintRender {
  /** Markup for the document body — paragraphs and tables, no page chrome. */
  html: string;
  /** Header logo as a data URI, or null when the company has no logo. */
  logoDataUri: string | null;
  geometry: PrintPageGeometry | null;
  /** Default body font family taken from the template's style defaults. */
  fontFamily: string | null;
  /** Default body font size in points, taken from the template's style defaults. */
  fontSizePt: number | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** True when `<w:tag` at `index` is that element and not a longer one such as `<w:tblPr`. */
function isTagStart(xml: string, index: number, tag: string): boolean {
  if (!xml.startsWith(`<${tag}`, index)) return false;
  const next = xml[index + tag.length + 1];
  return next === ">" || next === " " || next === "/" || next === "\t" || next === "\n" || next === "\r";
}

/** Returns the full element text starting at `start`, counting nested elements of the same tag. */
function takeElement(xml: string, start: number, tag: string): { xml: string; end: number } {
  const openEnd = xml.indexOf(">", start);
  if (openEnd === -1) return { xml: xml.slice(start), end: xml.length };
  if (xml[openEnd - 1] === "/") return { xml: xml.slice(start, openEnd + 1), end: openEnd + 1 };

  let depth = 1;
  let cursor = openEnd + 1;
  const close = `</${tag}>`;
  while (cursor < xml.length && depth > 0) {
    const nextClose = xml.indexOf(close, cursor);
    if (nextClose === -1) break;
    let nextOpen = -1;
    for (let i = cursor; i < nextClose; i += 1) {
      if (isTagStart(xml, i, tag)) {
        const selfEnd = xml.indexOf(">", i);
        if (selfEnd !== -1 && xml[selfEnd - 1] === "/") {
          i = selfEnd;
          continue;
        }
        nextOpen = i;
        break;
      }
    }
    if (nextOpen !== -1) {
      depth += 1;
      cursor = xml.indexOf(">", nextOpen) + 1;
      continue;
    }
    depth -= 1;
    cursor = nextClose + close.length;
  }
  return { xml: xml.slice(start, cursor), end: cursor };
}

/**
 * Collects direct child elements with one of `wanted` tags. Elements listed in
 * `skip` are consumed whole, so a nested table's rows are never mistaken for the
 * outer table's rows.
 */
function collectElements(
  xml: string,
  wanted: string[],
  skip: string[] = [],
): Array<{ tag: string; xml: string }> {
  const out: Array<{ tag: string; xml: string }> = [];
  const all = [...wanted, ...skip];
  let cursor = 0;

  while (cursor < xml.length) {
    const open = xml.indexOf("<", cursor);
    if (open === -1) break;
    const tag = all.find((candidate) => isTagStart(xml, open, candidate));
    if (!tag) {
      cursor = open + 1;
      continue;
    }
    const element = takeElement(xml, open, tag);
    if (wanted.includes(tag)) out.push({ tag, xml: element.xml });
    cursor = element.end;
  }

  return out;
}

/**
 * Content between an element's own tags. Scanning children must start here: passing
 * a whole `<w:tbl>` while skipping over `w:tbl` would consume the element itself.
 */
function innerXml(elementXml: string, tag: string): string {
  const openEnd = elementXml.indexOf(">");
  if (openEnd === -1 || elementXml[openEnd - 1] === "/") return "";
  const closeStart = elementXml.lastIndexOf(`</${tag}>`);
  return closeStart === -1 ? elementXml.slice(openEnd + 1) : elementXml.slice(openEnd + 1, closeStart);
}

/** The element's own property block (`<w:pPr>`, `<w:rPr>`, …), which always comes first. */
function propertyBlock(xml: string, tag: string): string {
  const start = xml.indexOf(`<${tag}`);
  if (start === -1) return "";
  return takeElement(xml, start, tag).xml;
}

function isToggleOn(propertiesXml: string, tag: string): boolean {
  const match = propertiesXml.match(new RegExp(`<${tag}(\\s[^>]*)?/?>`));
  if (!match) return false;
  const value = match[1]?.match(/w:val=["']([^"']+)["']/)?.[1];
  return value === undefined || !["0", "false", "off", "none"].includes(value);
}

function twipsAttr(xml: string, tag: string, attribute: string): number | null {
  const element = xml.match(new RegExp(`<${tag}(\\s[^>]*)?/?>`))?.[1];
  const raw = element?.match(new RegExp(`${attribute}=["'](-?\\d+)["']`))?.[1];
  return raw === undefined ? null : Number(raw);
}

function twipsToPt(twips: number): number {
  return Math.round((twips / 20) * 100) / 100;
}

function twipsToMm(twips: number): number {
  return Math.round((twips / TWIPS_PER_MM) * 100) / 100;
}

const ALIGNMENT: Record<string, string> = {
  left: "left",
  start: "left",
  center: "center",
  right: "right",
  end: "right",
  both: "justify",
  distribute: "justify",
};

function renderRuns(containerXml: string): string {
  const runs = collectElements(containerXml, ["w:r"], ["w:tbl"]);
  let html = "";

  for (const run of runs) {
    const properties = propertyBlock(run.xml, "w:rPr");
    const body = properties ? run.xml.slice(run.xml.indexOf(properties) + properties.length) : run.xml;

    let text = "";
    const tokens = body.matchAll(
      /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t\s*\/>|<w:br(?:\s[^>]*)?\/?>|<w:tab(?:\s[^>]*)?\/?>|<w:noBreakHyphen\s*\/?>/g,
    );
    for (const token of tokens) {
      const raw = token[0];
      if (raw.startsWith("<w:br")) text += "\n";
      else if (raw.startsWith("<w:tab")) text += "\t";
      else if (raw.startsWith("<w:noBreakHyphen")) text += "‑";
      else if (token[1] !== undefined) text += decodeXml(token[1]);
    }
    if (text === "") continue;

    const styles: string[] = [];
    if (isToggleOn(properties, "w:b")) styles.push("font-weight:700");
    if (isToggleOn(properties, "w:i")) styles.push("font-style:italic");

    const decorations: string[] = [];
    const underline = properties.match(/<w:u(\s[^>]*)?\/?>/)?.[1]?.match(/w:val=["']([^"']+)["']/)?.[1];
    if (properties.includes("<w:u") && underline !== "none") decorations.push("underline");
    if (isToggleOn(properties, "w:strike")) decorations.push("line-through");
    if (decorations.length > 0) styles.push(`text-decoration:${decorations.join(" ")}`);

    const halfPoints = twipsAttr(properties, "w:sz", "w:val");
    if (halfPoints) styles.push(`font-size:${halfPoints / 2}pt`);
    if (isToggleOn(properties, "w:caps")) styles.push("text-transform:uppercase");

    const content = escapeHtml(text);
    html += styles.length > 0 ? `<span style="${styles.join(";")}">${content}</span>` : content;
  }

  return html;
}

function renderParagraph(paragraphXml: string, defaultSpacingAfterTwips: number): string {
  const properties = propertyBlock(paragraphXml, "w:pPr");
  const styles: string[] = [];

  const alignment = properties.match(/<w:jc\s[^>]*w:val=["']([^"']+)["']/)?.[1];
  if (alignment && ALIGNMENT[alignment]) styles.push(`text-align:${ALIGNMENT[alignment]}`);

  const spacingBefore = twipsAttr(properties, "w:spacing", "w:before");
  const spacingAfter = twipsAttr(properties, "w:spacing", "w:after") ?? defaultSpacingAfterTwips;
  styles.push(`margin:${twipsToPt(spacingBefore ?? 0)}pt 0 ${twipsToPt(spacingAfter)}pt`);

  const indentLeft = twipsAttr(properties, "w:ind", "w:left");
  if (indentLeft) styles.push(`padding-left:${twipsToPt(indentLeft)}pt`);
  const firstLine = twipsAttr(properties, "w:ind", "w:firstLine");
  if (firstLine) styles.push(`text-indent:${twipsToPt(firstLine)}pt`);

  const lineTwips = twipsAttr(properties, "w:spacing", "w:line");
  const lineRule = properties.match(/<w:spacing\s[^>]*w:lineRule=["']([^"']+)["']/)?.[1];
  if (lineTwips && lineRule !== "exact" && lineRule !== "atLeast") {
    styles.push(`line-height:${Math.round((lineTwips / 240) * 100) / 100}`);
  }

  const inner = renderRuns(paragraphXml);
  // An empty paragraph is vertical space in Word — keep it as one.
  return `<p style="${styles.join(";")}">${inner === "" ? "<br>" : inner}</p>`;
}

function renderTable(tableXml: string, defaultSpacingAfterTwips: number): string {
  const grid = Array.from(tableXml.matchAll(/<w:gridCol\s[^>]*w:w=["'](\d+)["']/g)).map((m) => Number(m[1]));
  const gridTotal = grid.reduce((sum, width) => sum + width, 0);
  const columns =
    gridTotal > 0
      ? `<colgroup>${grid
          .map((width) => `<col style="width:${Math.round((width / gridTotal) * 10000) / 100}%">`)
          .join("")}</colgroup>`
      : "";

  const rows = collectElements(innerXml(tableXml, "w:tbl"), ["w:tr"], ["w:tbl"]);
  let body = "";

  for (const row of rows) {
    const cells = collectElements(innerXml(row.xml, "w:tr"), ["w:tc"], ["w:tbl"]);
    let cellsHtml = "";
    for (const cell of cells) {
      const cellProperties = propertyBlock(cell.xml, "w:tcPr");
      const span = twipsAttr(cellProperties, "w:gridSpan", "w:val");
      const verticalAlign = cellProperties.match(/<w:vAlign\s[^>]*w:val=["']([^"']+)["']/)?.[1];
      // Word's signature blocks use nil borders; only draw a border when the cell asks for one.
      const bordered = /<w:tcBorders>/.test(cellProperties)
        ? /<w:(top|left|bottom|right)\s[^>]*w:val=["'](?!nil|none)[^"']+["']/.test(cellProperties)
        : false;
      const styles = [
        "padding:0 4pt",
        `vertical-align:${verticalAlign === "center" ? "middle" : verticalAlign === "bottom" ? "bottom" : "top"}`,
      ];
      if (bordered) styles.push("border:0.5pt solid #000");
      cellsHtml += `<td${span && span > 1 ? ` colspan="${span}"` : ""} style="${styles.join(";")}">${renderBlocks(
        innerXml(cell.xml, "w:tc"),
        defaultSpacingAfterTwips,
      )}</td>`;
    }
    body += `<tr>${cellsHtml}</tr>`;
  }

  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed">${columns}<tbody>${body}</tbody></table>`;
}

function renderBlocks(containerXml: string, defaultSpacingAfterTwips: number): string {
  const blocks = collectElements(containerXml, ["w:p", "w:tbl"]);
  return blocks
    .map((block) =>
      block.tag === "w:tbl"
        ? renderTable(block.xml, defaultSpacingAfterTwips)
        : renderParagraph(block.xml, defaultSpacingAfterTwips),
    )
    .join("");
}

function readGeometry(documentXml: string): PrintPageGeometry | null {
  const sections = Array.from(documentXml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g));
  const section = sections.at(-1)?.[0];
  if (!section) return null;

  const width = twipsAttr(section, "w:pgSz", "w:w");
  const height = twipsAttr(section, "w:pgSz", "w:h");
  if (!width || !height) return null;

  return {
    widthMm: twipsToMm(width),
    heightMm: twipsToMm(height),
    marginTopMm: twipsToMm(twipsAttr(section, "w:pgMar", "w:top") ?? 1440),
    marginRightMm: twipsToMm(twipsAttr(section, "w:pgMar", "w:right") ?? 1440),
    marginBottomMm: twipsToMm(twipsAttr(section, "w:pgMar", "w:bottom") ?? 1440),
    marginLeftMm: twipsToMm(twipsAttr(section, "w:pgMar", "w:left") ?? 1440),
  };
}

function relationshipTargets(relsXml: string, typeSuffix: string): string[] {
  return Array.from(relsXml.matchAll(/<Relationship\b[^>]*>/g))
    .filter((match) => new RegExp(`Type=["'][^"']*/${typeSuffix}["']`).test(match[0]))
    .map((match) => match[0].match(/Target=["']([^"']+)["']/)?.[1])
    .filter((target): target is string => Boolean(target));
}

function wordPart(target: string): string {
  const normalized = target.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized.startsWith("word/") ? normalized : `word/${normalized}`;
}

/** The header logo, as a data URI — headers do not repeat in an HTML print view, so it is drawn once. */
function readHeaderLogo(zip: PizZip): string | null {
  const documentRels = zip.file("word/_rels/document.xml.rels")?.asText();
  if (!documentRels) return null;

  for (const headerTarget of relationshipTargets(documentRels, "header")) {
    const headerPart = wordPart(headerTarget);
    const headerRels = zip.file(`word/_rels/${headerPart.slice("word/".length)}.rels`)?.asText();
    if (!headerRels) continue;
    for (const imageTarget of relationshipTargets(headerRels, "image")) {
      const file = zip.file(wordPart(imageTarget));
      if (!file) continue;
      const bytes = Buffer.from(file.asUint8Array());
      const extension = wordPart(imageTarget).split(".").pop()?.toLowerCase();
      const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension ?? "png"}`;
      return `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }
  return null;
}

function readStyleDefaults(zip: PizZip): {
  fontFamily: string | null;
  fontSizePt: number | null;
  spacingAfterTwips: number;
} {
  const styles = zip.file("word/styles.xml")?.asText();
  if (!styles) return { fontFamily: null, fontSizePt: null, spacingAfterTwips: 0 };

  const defaults = styles.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? "";
  const font = defaults.match(/<w:rFonts\b[^>]*w:ascii=["']([^"']+)["']/)?.[1] ?? null;
  const halfPoints = twipsAttr(defaults, "w:sz", "w:val");
  const spacingAfter = twipsAttr(defaults, "w:spacing", "w:after");

  return {
    fontFamily: font,
    fontSizePt: halfPoints ? halfPoints / 2 : null,
    spacingAfterTwips: spacingAfter ?? 0,
  };
}

export function renderDocxToPrintHtml(docxBuffer: Buffer): DocxPrintRender {
  const zip = new PizZip(docxBuffer);
  const documentXml = zip.file("word/document.xml")?.asText();
  if (!documentXml) throw new Error("DOCX is missing word/document.xml");

  const bodyStart = documentXml.indexOf("<w:body");
  const bodyXml =
    bodyStart === -1 ? documentXml : takeElement(documentXml, bodyStart, "w:body").xml;

  const styleDefaults = readStyleDefaults(zip);

  return {
    html: renderBlocks(bodyXml, styleDefaults.spacingAfterTwips),
    logoDataUri: readHeaderLogo(zip),
    geometry: readGeometry(documentXml),
    fontFamily: styleDefaults.fontFamily,
    fontSizePt: styleDefaults.fontSizePt,
  };
}
