import { Encodings } from "@pdf-lib/standard-fonts";

/**
 * Typographic characters the documents use that WinAnsi cannot encode, mapped to
 * the closest thing it can. Without this a minus sign on a payslip deduction
 * renders as "?", which on a money column is worse than plain wrong.
 */
const WINANSI_FALLBACKS: Record<string, string> = {
  "−": "-", // minus sign → hyphen-minus
  "‒": "-", // figure dash
  "–": "-", // en dash
  "—": "—".normalize("NFC"), // em dash is encodable; kept explicit
  " ": " ", // figure space
  " ": " ", // narrow no-break space
  " ": " ", // no-break space
};

/**
 * pdf-lib StandardFonts (Helvetica, etc.) only support WinAnsi / Windows-1252.
 * Any other code point throws from encodeText and aborts PDF generation.
 */
export function toPdfStandardFontText(text: string): string {
  const src = text.normalize("NFC");
  let out = "";
  for (const segment of Array.from(src)) {
    const mapped = WINANSI_FALLBACKS[segment] ?? segment;
    const cp = mapped.codePointAt(0)!;
    out += Encodings.WinAnsi.canEncodeUnicodeCodePoint(cp) ? mapped : "?";
  }
  return out;
}
