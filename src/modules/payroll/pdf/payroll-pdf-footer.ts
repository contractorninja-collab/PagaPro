import { LineCapStyle, type PDFPage } from "pdf-lib";
import type { PayrollPdfFonts } from "@/modules/payroll/pdf/payroll-pdf-fonts";
import { PP, RULE } from "@/modules/payroll/pdf/payroll-pdf-tokens";
import { drawText, drawTextRight, measureText } from "@/modules/payroll/pdf/payroll-pdf-text";

/**
 * The footer band every payroll document carries.
 *
 * This is the one place PagaPRO brands the document. The header belongs to the
 * client — their logo, their company — and the mark only appears down here,
 * beside the generation stamp, so a payslip reads as issued by the employer
 * rather than by us.
 */

/** The two-arc mark, authored on the same 64-unit grid as the web logo. */
const MARK_RING = "M52.20 35.47 A20.5 20.5 0 1 1 28.44 11.55";
const MARK_ARC = "M32 11.5 A20.5 20.5 0 0 1 52.19 28.54";
const MARK_GRID = 64;
const MARK_STROKE = 9;

/** Draws the PagaPRO mark with its top-left corner at (x, top). */
export function drawPagaproMark(page: PDFPage, x: number, top: number, size: number): void {
  const scale = size / MARK_GRID;
  // drawSvgPath runs y downward from the anchor, so `top` is the anchor. The
  // stroke is given in grid units — the transform scales it with the path, so
  // pre-multiplying here would shrink it twice.
  const common = {
    x,
    y: top,
    scale,
    borderWidth: MARK_STROKE,
    borderLineCap: LineCapStyle.Round,
  } as const;

  page.drawSvgPath(MARK_RING, { ...common, borderColor: PP.navy });
  page.drawSvgPath(MARK_ARC, { ...common, borderColor: PP.blue });
}

export interface PagaproFooterOptions {
  pageWidth: number;
  margin: number;
  /** `Ndërtimi Alba SH.P.K. · NUI 811234567` — the client's legal line. */
  companyLine?: string | null;
  /** Passed in so a render is reproducible in tests. */
  generatedAt?: Date;
  pageNumber?: number;
  pageCount?: number;
  /** Replaces the page counter when a document is deliberately unpaginated. */
  rightLabel?: string;
}

function stamp(at: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `PAGAPRO · GJENERUAR ${two(at.getDate())}.${two(at.getMonth() + 1)}.${at.getFullYear()} · ${two(at.getHours())}:${two(at.getMinutes())}`;
}

/**
 * Sits at a fixed height above the page edge; documents reserve space for it
 * rather than flowing content into it.
 */
export const FOOTER_HEIGHT = 34;

export function drawPagaproFooter(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  options: PagaproFooterOptions,
): void {
  const { pageWidth, margin } = options;
  const right = pageWidth - margin;
  const ruleY = 30;

  page.drawLine({
    start: { x: margin, y: ruleY },
    end: { x: right, y: ruleY },
    thickness: RULE.thin,
    color: PP.line,
  });

  const monoStyle = {
    font: fonts.mono,
    size: 7.5,
    color: PP.faint,
    tracking: 0.04,
    sanitize: fonts.sanitize.mono,
  };
  drawText(page, stamp(options.generatedAt ?? new Date()), margin, ruleY - 12, monoStyle);

  const legal = [options.companyLine?.trim(), "paga-pro.com"].filter(Boolean).join(" · ");
  drawText(page, legal, margin, ruleY - 22, {
    font: fonts.sans,
    size: 7.5,
    color: PP.muted,
    sanitize: fonts.sanitize.sans,
  });

  const label =
    options.rightLabel ??
    (options.pageNumber != null && options.pageCount != null
      ? `Faqe ${options.pageNumber} / ${options.pageCount}`
      : "Dokument i gjeneruar");

  const labelStyle = {
    font: fonts.mono,
    size: 7.5,
    color: PP.faint,
    sanitize: fonts.sanitize.mono,
  };
  const labelWidth = measureText(label, labelStyle);
  const markSize = 11;
  const gap = 7;

  drawPagaproMark(page, right - labelWidth - gap - markSize, ruleY - 12, markSize);
  drawTextRight(page, label, right, ruleY - 20, labelStyle);
}
