import { inflateSync } from "node:zlib";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  type PDFPage,
} from "pdf-lib";

/**
 * Reads back the text a PDF actually draws.
 *
 * Three things make this less obvious than it looks:
 *
 * 1. Content streams are Flate-compressed, so searching the saved bytes finds
 *    nothing — an early version of these assertions passed for exactly that
 *    wrong reason.
 * 2. pdf-lib emits `<hex> Tj`, never `(literal) Tj`.
 * 3. For a standard face the hex is WinAnsi bytes, but for an embedded subset it
 *    is *glyph indices*. Decoding only the readable ones would leave the
 *    privacy assertion blind to anything drawn in bold — which is precisely
 *    where a name would end up. So the font's ToUnicode CMap is parsed and used.
 */

interface FontDecoder {
  /** Type0 fonts address glyphs with two bytes; simple fonts with one. */
  bytesPerCode: number;
  toUnicode?: Map<number, string>;
}

function inflateStream(stream: PDFRawStream): Buffer {
  const raw = Buffer.from(stream.getContents());
  try {
    return inflateSync(raw);
  } catch {
    return raw;
  }
}

/** Parses the bfchar / bfrange sections of a ToUnicode CMap. */
function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const hexToStr = (hex: string): string => {
    let out = "";
    for (let i = 0; i + 3 < hex.length + 1; i += 4) {
      const unit = parseInt(hex.slice(i, i + 4), 16);
      if (!Number.isNaN(unit)) out += String.fromCharCode(unit);
    }
    return out;
  };

  for (const block of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const pair of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(pair[1]!, 16), hexToStr(pair[2]!));
    }
  }

  for (const block of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const row of block.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    )) {
      const from = parseInt(row[1]!, 16);
      const to = parseInt(row[2]!, 16);
      const base = parseInt(row[3]!, 16);
      for (let code = from; code <= to && code - from < 65536; code += 1) {
        map.set(code, String.fromCharCode(base + (code - from)));
      }
    }
  }

  return map;
}

function buildFontDecoders(page: PDFPage): Map<string, FontDecoder> {
  const decoders = new Map<string, FontDecoder>();
  const fonts = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
  if (!fonts) return decoders;

  for (const key of fonts.keys()) {
    const font = fonts.lookup(key, PDFDict);
    if (!font) continue;

    const subtype = font.get(PDFName.of("Subtype"))?.toString() ?? "";
    const decoder: FontDecoder = { bytesPerCode: subtype.includes("Type0") ? 2 : 1 };

    const toUnicodeRef = font.get(PDFName.of("ToUnicode"));
    const stream = toUnicodeRef ? font.context.lookup(toUnicodeRef) : undefined;
    if (stream instanceof PDFRawStream) {
      decoder.toUnicode = parseToUnicode(inflateStream(stream).toString("latin1"));
    }

    decoders.set(key.toString(), decoder);
  }

  return decoders;
}

/** Every text run the document draws, in order, across all pages. */
export async function extractPdfTextRuns(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  const runs: string[] = [];

  for (const page of pdf.getPages()) {
    const decoders = buildFontDecoders(page);

    const contents = page.node.Contents();
    if (!contents) continue;
    const streams: PDFRawStream[] = [];
    if (contents instanceof PDFRawStream) streams.push(contents);
    else if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i += 1) {
        const item = page.node.context.lookup(contents.get(i));
        if (item instanceof PDFRawStream) streams.push(item);
      }
    }

    for (const stream of streams) {
      const text = inflateStream(stream).toString("latin1");
      let decoder: FontDecoder | undefined;

      const token = /(\/[A-Za-z0-9+\-_.]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g;
      let match: RegExpExecArray | null;

      while ((match = token.exec(text)) !== null) {
        if (match[1] !== undefined) {
          decoder = decoders.get(match[1]);
          continue;
        }
        const hex = match[2];
        if (!hex) continue;

        const width = (decoder?.bytesPerCode ?? 1) * 2;
        let run = "";
        for (let i = 0; i + width <= hex.length; i += width) {
          const code = parseInt(hex.slice(i, i + width), 16);
          run += decoder?.toUnicode?.get(code) ?? String.fromCharCode(code);
        }
        runs.push(run);
      }
    }
  }

  return runs;
}

/** All drawn text as one string — convenient for `toContain` assertions. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  return (await extractPdfTextRuns(bytes)).join(" ");
}
