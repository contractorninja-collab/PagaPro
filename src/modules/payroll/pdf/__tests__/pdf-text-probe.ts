import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";

/**
 * Reads back the text a PDF actually draws.
 *
 * Two things make this less obvious than it looks. Content streams are
 * Flate-compressed, so searching the saved bytes finds nothing — an earlier
 * version of these assertions passed for exactly that wrong reason. And pdf-lib
 * emits `<hex> Tj` rather than `(literal) Tj`, where the hex is WinAnsi bytes
 * for a standard face but *glyph indices* for an embedded subset. Only the
 * standard-face runs can be decoded, which is enough: the figures and IDs these
 * tests care about are drawn in Courier and Helvetica.
 */

const STANDARD_FACES = /^\/(Helvetica|Courier|Times|Symbol|ZapfDingbats)/;

function inflateStream(stream: PDFRawStream): string {
  const raw = Buffer.from(stream.getContents());
  try {
    return inflateSync(raw).toString("latin1");
  } catch {
    return raw.toString("latin1");
  }
}

export async function extractPdfStreamText(bytes: Uint8Array): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  const chunks: string[] = [];

  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    if (!contents) continue;

    if (contents instanceof PDFRawStream) {
      chunks.push(inflateStream(contents));
    } else if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i += 1) {
        const item = page.node.context.lookup(contents.get(i));
        if (item instanceof PDFRawStream) chunks.push(inflateStream(item));
      }
    }
  }

  return chunks.join("\n");
}

/** Decoded text runs, in draw order, from the faces whose bytes are readable. */
export function literalStrings(streamText: string): string[] {
  const out: string[] = [];
  let readable = false;

  // `/Face size Tf` sets the font; `<hex> Tj` shows a run in it.
  const token = /\/([A-Za-z0-9+\-_]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g;
  let match: RegExpExecArray | null;

  while ((match = token.exec(streamText)) !== null) {
    if (match[1] !== undefined) {
      readable = STANDARD_FACES.test(`/${match[1]}`);
      continue;
    }
    if (!readable || !match[2]) continue;

    const hex = match[2];
    let decoded = "";
    for (let i = 0; i + 1 < hex.length; i += 2) {
      decoded += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    out.push(decoded);
  }

  return out;
}
