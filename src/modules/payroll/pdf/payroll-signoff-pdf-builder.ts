import { PDFDocument, type PDFPage } from "pdf-lib";
import { embedCompanyLogo } from "@/modules/company-branding/pdf-logo-branding";
import {
  embedPayrollPdfFonts,
  type PayrollPdfFonts,
} from "@/modules/payroll/pdf/payroll-pdf-fonts";
import { drawPagaproFooter } from "@/modules/payroll/pdf/payroll-pdf-footer";
import { drawRoundedRect, PAGE, PP, RULE } from "@/modules/payroll/pdf/payroll-pdf-tokens";
import {
  drawText,
  drawTextRight,
  fitText,
  measureText,
  wrapText,
  type TextStyle,
} from "@/modules/payroll/pdf/payroll-pdf-text";
import type {
  PayrollRegisterPdfInput,
  PayrollRegisterRow,
} from "@/modules/payroll/pdf/payroll-register-pdf-builder";

/**
 * Lista e Pagave — the sheet employees physically sign to confirm they received
 * their net pay.
 *
 * **It carries no names.** A signature list gets passed around a workplace and
 * left on desks, so it shows only a personal ID, the two amounts, and a ruled
 * line. Anyone adding a name, position or department column back in has broken
 * the point of the document.
 */

const PAGE_W = PAGE.a4Portrait.width;
const PAGE_H = PAGE.a4Portrait.height;
/** 12mm, per the design. */
const MARGIN = 34;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Fractions of the content width; asserted to sum to 1 in the tests. */
export const SIGNOFF_COLUMNS = [
  { key: "no", header: "#", fraction: 0.06, align: "left" },
  { key: "personalId", header: "NUMRI PERSONAL", fraction: 0.26, align: "left" },
  { key: "gross", header: "BRUTO", fraction: 0.17, align: "right" },
  { key: "net", header: "NETO", fraction: 0.16, align: "right" },
  { key: "signature", header: "NËNSHKRIMI", fraction: 0.35, align: "left" },
] as const;

const ROW_H = 22;
const HEADER_ROW_H = 22;
const CELL_PAD = 10;
/** Room the footer band needs at the foot of every page. */
const FOOTER_RESERVE = 46;

function num(value: string | null | undefined): number {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function amount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ColumnBox {
  key: string;
  header: string;
  align: "left" | "right";
  x: number;
  w: number;
}

function layout(): ColumnBox[] {
  const boxes: ColumnBox[] = [];
  let x = MARGIN;
  for (const spec of SIGNOFF_COLUMNS) {
    const w = CONTENT_W * spec.fraction;
    boxes.push({ key: spec.key, header: spec.header, align: spec.align, x, w });
    x += w;
  }
  return boxes;
}

/** Navy identity band, repeated on every page. */
function drawHeaderBand(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayrollRegisterPdfInput,
  logo: Awaited<ReturnType<typeof embedCompanyLogo>>,
  top: number,
): number {
  const h = 54;
  const y = top - h;
  drawRoundedRect(page, { x: MARGIN, y, w: CONTENT_W, h, r: 12, color: PP.navy });

  const padX = 18;
  let textX = MARGIN + padX;

  if (logo) {
    const slot = 40;
    const scale = Math.min(slot / logo.width, slot / logo.height, 1);
    const w = logo.width * scale;
    const lh = logo.height * scale;
    const tileX = MARGIN + padX;
    const tileY = y + (h - slot) / 2;

    drawRoundedRect(page, { x: tileX, y: tileY, w: slot, h: slot, r: 8, color: PP.white });
    page.drawImage(logo.image, {
      x: tileX + (slot - w) / 2,
      y: tileY + (slot - lh) / 2,
      width: w,
      height: lh,
    });
    textX = tileX + slot + 12;
  }

  const titleStyle: TextStyle = {
    font: fonts.sansBold,
    size: 13,
    color: PP.white,
    sanitize: fonts.sanitize.sansBold,
  };
  const refStyle: TextStyle = {
    font: fonts.mono,
    size: 7,
    color: PP.onNavy,
    tracking: 0.04,
    sanitize: fonts.sanitize.mono,
  };
  const ref = `${input.documentRef} · ${input.periodLabel.toUpperCase()}`;

  const pillLabel = input.approvalLabel?.trim() || `Aprovuar · ${input.payDateLabel}`;
  const pillStyle: TextStyle = {
    font: fonts.sansBold,
    size: 7.5,
    color: PP.white,
    sanitize: fonts.sanitize.sansBold,
  };
  const pillW = measureText(pillLabel, pillStyle) + 12 * 2 + 5 + 6;
  const rightBlockW =
    Math.max(measureText("Lista e pagave", titleStyle), measureText(ref, refStyle)) + 14 + pillW;

  const nameW = CONTENT_W - (textX - MARGIN) - padX - rightBlockW - 16;
  const nameStyle: TextStyle = {
    font: fonts.sansBold,
    size: 11.5,
    color: PP.white,
    sanitize: fonts.sanitize.sansBold,
  };
  drawText(
    page,
    fitText(input.company.displayName, nameStyle, nameW),
    textX,
    y + h / 2 + 2,
    nameStyle,
  );

  const subStyle: TextStyle = {
    font: fonts.sans,
    size: 7.5,
    color: PP.onNavy,
    sanitize: fonts.sanitize.sans,
  };
  const sub = [
    input.company.businessNumber ? `NUI ${input.company.businessNumber}` : null,
    input.company.addressLine,
  ]
    .filter(Boolean)
    .join(" · ");
  if (sub) drawText(page, fitText(sub, subStyle, nameW), textX, y + h / 2 - 10, subStyle);

  const pillRight = MARGIN + CONTENT_W - padX;
  const pillH = 18;
  const pillY = y + (h - pillH) / 2;
  drawRoundedRect(page, {
    x: pillRight - pillW,
    y: pillY,
    w: pillW,
    h: pillH,
    r: pillH / 2,
    color: PP.blue,
  });
  page.drawCircle({ x: pillRight - pillW + 12, y: pillY + pillH / 2, size: 2.5, color: PP.white });
  drawText(page, pillLabel, pillRight - pillW + 12 + 5 + 6, pillY + pillH / 2 - 2.6, pillStyle);

  const identityRight = pillRight - pillW - 14;
  drawTextRight(page, "Lista e pagave", identityRight, y + h / 2 + 2, titleStyle);
  drawTextRight(page, ref, identityRight, y + h / 2 - 10, refStyle);

  return y;
}

/** Punëtorë · Bruto · Neto për transfer. First page only. */
function drawSummaryTiles(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  rows: PayrollRegisterRow[],
  top: number,
): number {
  const gap = 10;
  const tileW = (CONTENT_W - gap * 2) / 3;
  const h = 46;
  const y = top - h;

  const gross = rows.reduce((sum, r) => sum + num(r.gross), 0);
  const net = rows.reduce((sum, r) => sum + num(r.net), 0);

  const tiles = [
    { label: "PUNËTORË", value: String(rows.length), navy: false },
    { label: "BRUTO", value: amount(gross), navy: false },
    { label: "NETO PËR TRANSFER", value: amount(net), navy: true },
  ];

  for (const [index, tile] of tiles.entries()) {
    const x = MARGIN + index * (tileW + gap);
    drawRoundedRect(page, {
      x,
      y,
      w: tileW,
      h,
      r: 10,
      color: tile.navy ? PP.navy : PP.wash,
      borderColor: tile.navy ? undefined : PP.line,
      borderWidth: tile.navy ? 0 : RULE.thin,
    });
    drawText(page, tile.label, x + 12, y + h - 16, {
      font: fonts.mono,
      size: 6.5,
      color: tile.navy ? PP.onNavy : PP.faint,
      tracking: 0.12,
      sanitize: fonts.sanitize.mono,
    });
    const valueStyle: TextStyle = {
      font: fonts.monoBold,
      size: 14,
      color: tile.navy ? PP.white : PP.text,
      sanitize: fonts.sanitize.monoBold,
    };
    drawText(page, fitText(tile.value, valueStyle, tileW - 24), x + 12, y + 12, valueStyle);
  }

  return y - 14;
}

function drawTableHeader(page: PDFPage, fonts: PayrollPdfFonts, columns: ColumnBox[], top: number): number {
  const y = top - HEADER_ROW_H;
  // Rounded top corners only: the band is drawn rounded, then its lower half
  // squared off so the body rows butt straight against it.
  drawRoundedRect(page, { x: MARGIN, y, w: CONTENT_W, h: HEADER_ROW_H, r: 6, color: PP.navy });
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: HEADER_ROW_H / 2, color: PP.navy });

  for (const col of columns) {
    const style: TextStyle = {
      font: fonts.sansBold,
      size: 7,
      color: col.key === "net" ? PP.blueOnNavy : PP.white,
      tracking: 0.06,
      sanitize: fonts.sanitize.sansBold,
    };
    const baseline = y + HEADER_ROW_H / 2 - 2.4;
    if (col.align === "right") drawTextRight(page, col.header, col.x + col.w - CELL_PAD, baseline, style);
    else drawText(page, col.header, col.x + CELL_PAD, baseline, style);
  }

  return y;
}

function drawBodyRow(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  columns: ColumnBox[],
  row: PayrollRegisterRow,
  index: number,
  top: number,
): number {
  const y = top - ROW_H;
  const baseline = y + ROW_H / 2 - 3;

  for (const col of columns) {
    if (col.key === "signature") {
      // A ruled line to sign on, capped so it does not run to the page edge.
      const lineW = Math.min(col.w - CELL_PAD * 2, 170);
      page.drawLine({
        start: { x: col.x + CELL_PAD, y: y + 5 },
        end: { x: col.x + CELL_PAD + lineW, y: y + 5 },
        thickness: RULE.thin,
        color: PP.rule,
      });
      continue;
    }

    let text = "";
    let style: TextStyle;

    if (col.key === "no") {
      text = String(index + 1).padStart(2, "0");
      style = { font: fonts.mono, size: 9, color: PP.faint, sanitize: fonts.sanitize.mono };
    } else if (col.key === "personalId") {
      text = row.personalId;
      style = { font: fonts.monoBold, size: 9, color: PP.text, sanitize: fonts.sanitize.monoBold };
    } else if (col.key === "gross") {
      text = amount(num(row.gross));
      style = { font: fonts.monoBold, size: 9, color: PP.text, sanitize: fonts.sanitize.monoBold };
    } else {
      text = amount(num(row.net));
      style = { font: fonts.monoBold, size: 9, color: PP.text, sanitize: fonts.sanitize.monoBold };
    }

    if (col.align === "right") drawTextRight(page, text, col.x + col.w - CELL_PAD, baseline, style);
    else drawText(page, fitText(text, style, col.w - CELL_PAD * 2), col.x + CELL_PAD, baseline, style);
  }

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_W, y },
    thickness: RULE.hair,
    color: PP.hairline,
  });

  return y;
}

function drawTotalsRow(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  columns: ColumnBox[],
  rows: PayrollRegisterRow[],
  top: number,
): number {
  const h = 26;
  const y = top - h;
  page.drawLine({
    start: { x: MARGIN, y: top },
    end: { x: MARGIN + CONTENT_W, y: top },
    thickness: RULE.heavy,
    color: PP.navy,
  });

  const baseline = y + h / 2 - 3;
  drawText(page, `Totali · ${rows.length} punëtorë`, MARGIN + CELL_PAD, baseline, {
    font: fonts.sansBold,
    size: 9,
    color: PP.text,
    sanitize: fonts.sanitize.sansBold,
  });

  const gross = rows.reduce((sum, r) => sum + num(r.gross), 0);
  const net = rows.reduce((sum, r) => sum + num(r.net), 0);
  const grossCol = columns.find((c) => c.key === "gross")!;
  const netCol = columns.find((c) => c.key === "net")!;

  drawTextRight(page, amount(gross), grossCol.x + grossCol.w - CELL_PAD, baseline, {
    font: fonts.monoBold,
    size: 9,
    color: PP.text,
    sanitize: fonts.sanitize.monoBold,
  });
  drawTextRight(page, amount(net), netCol.x + netCol.w - CELL_PAD, baseline, {
    font: fonts.monoBold,
    size: 9,
    color: PP.blue,
    sanitize: fonts.sanitize.monoBold,
  });

  return y;
}

const SIGNOFF_NOTE =
  "Me nënshkrim, çdo punëtor konfirmon marrjen e pagesës neto për periudhën e specifikuar. Lista pasqyron shumat e ngrira, të aprovuara nga financa.";

/** Height the sign-off strip needs, so it is never orphaned onto its own page. */
const SIGNOFF_H = 84;

/** Who prepared the payroll, and who signs for the company. */
export interface SignoffParty {
  name: string;
  role?: string | null;
}

function drawSignOff(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  top: number,
  parties: { preparedBy?: SignoffParty | null; approvedBy?: SignoffParty | null },
): void {
  const gap = 20;
  const noteW = (CONTENT_W - gap * 2) * (1.6 / 3.6);
  const blockW = (CONTENT_W - gap * 2) * (1 / 3.6);
  const y = top - SIGNOFF_H;

  const noteStyle: TextStyle = {
    font: fonts.sans,
    size: 7.5,
    color: PP.muted,
    sanitize: fonts.sanitize.sans,
  };
  const lines = wrapText(SIGNOFF_NOTE, noteStyle, noteW - 28);
  const noteH = Math.max(SIGNOFF_H - 24, 22 + lines.length * 11);
  const noteY = top - noteH;

  drawRoundedRect(page, { x: MARGIN, y: noteY, w: noteW, h: noteH, r: 10, color: PP.wash });
  let lineY = noteY + noteH - 15;
  for (const line of lines) {
    drawText(page, line, MARGIN + 14, lineY, noteStyle);
    lineY -= 11;
  }

  const eyebrow: TextStyle = {
    font: fonts.mono,
    size: 6.5,
    color: PP.faint,
    tracking: 0.12,
    sanitize: fonts.sanitize.mono,
  };

  const nameStyle: TextStyle = {
    font: fonts.sansBold,
    size: 8,
    color: PP.text,
    sanitize: fonts.sanitize.sansBold,
  };
  const roleStyle: TextStyle = {
    font: fonts.sans,
    size: 7.5,
    color: PP.muted,
    sanitize: fonts.sanitize.sans,
  };

  /**
   * PËRGATITI is the person who prepared the payroll in the app; APROVOI is the
   * company's authorised representative from Konfigurimet. When either is
   * unknown the rule is simply left blank — a printed placeholder on a document
   * that gets signed and filed is worse than an empty line.
   */
  const blocks: Array<{ label: string; party?: SignoffParty | null }> = [
    { label: "PËRGATITI", party: parties.preparedBy },
    { label: "APROVOI", party: parties.approvedBy },
  ];

  for (const [index, block] of blocks.entries()) {
    const x = MARGIN + noteW + gap + index * (blockW + gap);
    drawText(page, block.label, x, top - 10, eyebrow);

    const ruleY = top - 44;
    page.drawLine({
      start: { x, y: ruleY },
      end: { x: x + blockW, y: ruleY },
      thickness: RULE.thin,
      color: PP.rule,
    });

    if (!block.party?.name) continue;
    drawText(page, fitText(block.party.name, nameStyle, blockW), x, ruleY - 12, nameStyle);
    if (block.party.role) {
      drawText(page, fitText(block.party.role, roleStyle, blockW), x, ruleY - 22, roleStyle);
    }
  }

  void y;
}

export async function buildPayrollSignoffPdf(input: PayrollRegisterPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Lista e pagave — ${input.periodLabel}`);
  pdf.setAuthor(input.company.displayName);
  pdf.setSubject("Lista e pagave");

  const fonts = await embedPayrollPdfFonts(pdf);
  const logo = await embedCompanyLogo(pdf, input.logo);
  const columns = layout();

  const companyLine = [
    input.company.legalName,
    input.company.businessNumber ? `NUI ${input.company.businessNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Paginate first so every page can print an honest "Faqe n / m".
  const pages: PayrollRegisterRow[][] = [];
  let remaining = [...input.rows];
  let isFirst = true;

  do {
    const headUsed = 54 + 14 + (isFirst ? 46 + 14 : 0) + HEADER_ROW_H;
    const available = PAGE_H - MARGIN * 2 - headUsed - FOOTER_RESERVE;
    const capacity = Math.max(1, Math.floor(available / ROW_H));
    pages.push(remaining.slice(0, capacity));
    remaining = remaining.slice(capacity);
    isFirst = false;
  } while (remaining.length > 0);

  // The totals row and sign-off strip must not be orphaned: if the last page
  // cannot hold them, they move to a page of their own.
  const lastPage = pages[pages.length - 1] ?? [];
  const lastHeadUsed = 54 + 14 + (pages.length === 1 ? 46 + 14 : 0) + HEADER_ROW_H;
  const lastUsed = lastHeadUsed + lastPage.length * ROW_H + 26 + 16 + SIGNOFF_H;
  if (lastUsed > PAGE_H - MARGIN * 2 - FOOTER_RESERVE) pages.push([]);

  for (const [pageIndex, pageRows] of pages.entries()) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const isLast = pageIndex === pages.length - 1;

    let y = drawHeaderBand(page, fonts, input, logo, PAGE_H - MARGIN);
    y -= 14;
    if (pageIndex === 0) y = drawSummaryTiles(page, fonts, input.rows, y);

    y = drawTableHeader(page, fonts, columns, y);

    let runningIndex = pages.slice(0, pageIndex).reduce((sum, p) => sum + p.length, 0);
    for (const row of pageRows) {
      y = drawBodyRow(page, fonts, columns, row, runningIndex, y);
      runningIndex += 1;
    }

    if (isLast) {
      y = drawTotalsRow(page, fonts, columns, input.rows, y);
      drawSignOff(page, fonts, y - 16, {
        preparedBy: input.preparedBy,
        approvedBy: input.approvedBy,
      });
    }

    drawPagaproFooter(page, fonts, {
      pageWidth: PAGE_W,
      margin: MARGIN,
      companyLine,
      pageNumber: pageIndex + 1,
      pageCount: pages.length,
    });
  }

  return pdf.save();
}
