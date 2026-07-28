import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { toPdfStandardFontText } from "@/modules/payroll/helpers/pdf-standard-font-text";
import { PP } from "@/modules/payroll/pdf/payroll-pdf-tokens";

/**
 * Text primitives shared by the payroll documents.
 *
 * Two things pdf-lib has no answer for and the design depends on: letter
 * spacing (the eyebrow labels are tracked at .12em, which changes their look
 * completely) and right-alignment (every money column).
 */

export interface TextStyle {
  font: PDFFont;
  size: number;
  color?: RGB;
  /** Letter spacing as a fraction of the font size, matching CSS `em`. */
  tracking?: number;
  /** Standard (non-embedded) faces are WinAnsi-only and need sanitising first. */
  sanitize?: boolean;
}

function prepare(text: string, style: TextStyle): string {
  return style.sanitize === false ? text : toPdfStandardFontText(text);
}

/** Width of a string as it will actually be drawn, tracking included. */
export function measureText(text: string, style: TextStyle): number {
  const value = prepare(text, style);
  const base = style.font.widthOfTextAtSize(value, style.size);
  if (!style.tracking) return base;
  // Trailing spacing after the final glyph is not part of the visible run.
  return base + Math.max(0, value.length - 1) * style.tracking * style.size;
}

export function drawText(page: PDFPage, text: string, x: number, y: number, style: TextStyle): void {
  const value = prepare(text, style);
  const color = style.color ?? PP.text;

  if (!style.tracking) {
    page.drawText(value, { x, y, size: style.size, font: style.font, color });
    return;
  }

  // pdf-lib cannot track a run, so the glyphs are placed individually.
  let cursor = x;
  for (const char of value) {
    page.drawText(char, { x: cursor, y, size: style.size, font: style.font, color });
    cursor += style.font.widthOfTextAtSize(char, style.size) + style.tracking * style.size;
  }
}

/** Draws so the text *ends* at `right`. */
export function drawTextRight(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  style: TextStyle,
): void {
  drawText(page, text, right - measureText(text, style), y, style);
}

/** Draws centred on `centreX`. */
export function drawTextCentered(
  page: PDFPage,
  text: string,
  centreX: number,
  y: number,
  style: TextStyle,
): void {
  drawText(page, text, centreX - measureText(text, style) / 2, y, style);
}

/** Truncates with an ellipsis so a long value cannot run into its neighbour. */
export function fitText(text: string, style: TextStyle, maxWidth: number): string {
  if (measureText(text, style) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && measureText(`${value}…`, style) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

/** Greedy wrap for the footnote paragraph. */
export function wrapText(text: string, style: TextStyle, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measureText(candidate, style) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}
