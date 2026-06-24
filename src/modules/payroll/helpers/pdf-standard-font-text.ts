import { Encodings } from "@pdf-lib/standard-fonts";

/**
 * pdf-lib StandardFonts (Helvetica, etc.) only support WinAnsi / Windows-1252.
 * Any other code point throws from encodeText and aborts PDF generation.
 */
export function toPdfStandardFontText(text: string): string {
  const src = text.normalize("NFC");
  let out = "";
  for (const segment of Array.from(src)) {
    const cp = segment.codePointAt(0)!;
    out += Encodings.WinAnsi.canEncodeUnicodeCodePoint(cp) ? segment : "?";
  }
  return out;
}
