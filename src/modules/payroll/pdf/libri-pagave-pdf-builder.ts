import { PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { toPdfStandardFontText } from "@/modules/payroll/helpers/pdf-standard-font-text";
import type { CompanyLogoAsset } from "@/modules/company-branding/company-logo";
import {
  drawCompanyLogoPlate,
  embedCompanyLogo,
  type EmbeddedCompanyLogo,
} from "@/modules/company-branding/pdf-logo-branding";
import {
  drawPagaproGeneratedFooter,
  embedPayrollPdfFonts,
  type PayrollPdfFonts,
} from "@/modules/payroll/pdf/payroll-pdf-fonts";
import { drawRoundedRect, PAGE, PP, RADIUS, RULE } from "@/modules/payroll/pdf/payroll-pdf-tokens";
import {
  LIBRI_PAGAVE_BANDS,
  LIBRI_PAGAVE_COLUMNS,
  type LibriPagaveBand,
} from "@/modules/reports/exporters/libri-pagave-columns";
import type { LibriPagaveRow } from "@/modules/reports/exporters/libri-pagave-rows";

const PAGE_W = PAGE.a3Landscape.width;
const PAGE_H = PAGE.a3Landscape.height;
const MARGIN = 28;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Column widths as fractions of the content width; asserted to sum to 1 in tests. */
export const LIBRI_COLUMN_WIDTHS: readonly number[] = [
  0.030, 0.026, 0.086, 0.050, 0.026, // 1-5 identification
  0.034, 0.036, 0.046, // 6-8 regular hours
  0.034, 0.032, 0.034, // 9-11 premium hours
  0.032, 0.032, 0.032, // 12-14 premium rates
  0.044, 0.052, // 15-16 gross
  0.032, 0.032, 0.042, 0.044, // 17-20 trust
  0.046, 0.044, // 21-22 tax
  0.044, 0.034, 0.056, // 23-25 net
];

const BAND_FILL: Record<LibriPagaveBand, RGB> = {
  IDENTIFIKIMI: PP.navy,
  ORET_E_RREGULLTA: PP.slate800,
  ORET_ME_RRITJE: PP.navy,
  CMIMET_ME_RRITJE: PP.slate800,
  BRUTO: PP.navy,
  TRUSTI: PP.slate800,
  TATIMI: PP.navy,
  NETO: PP.blue,
};

export interface LibriPagavePdfCompany {
  legalName: string;
  tradeName?: string | null;
  businessNumber?: string | null;
  addressLine?: string | null;
  city?: string | null;
}

export interface LibriPagavePdfInput {
  company: LibriPagavePdfCompany;
  rows: readonly LibriPagaveRow[];
  periodLabel: string;
  /** e.g. "2026-07" */
  periodRef: string;
  status: string;
  statusDateLabel?: string | null;
  snapshotRef?: string | null;
  logo?: CompanyLogoAsset | null;
  generatedAtLabel: string;
}

function money(value: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hours(value: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number): string {
  return `${(value * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Cell text per column, taken straight from the frozen row — never recomputed. */
function cellText(row: LibriPagaveRow, key: string): string {
  switch (key) {
    case "idp":
    case "nr":
      return String(row.idp);
    case "fullName":
      return row.fullName;
    case "sektori":
      return row.sektori;
    case "primacy":
      return row.isSecondary ? "2" : "";
    case "regularHours":
    case "overtimeNightHours":
    case "onCallHours":
    case "holidayWeekendHours":
      return hours(row[key as keyof LibriPagaveRow] as number);
    case "employeeTrustPercent":
    case "employerTrustPercent":
      return percent(row[key as keyof LibriPagaveRow] as number);
    default: {
      const value = row[key as keyof LibriPagaveRow];
      return typeof value === "number" ? money(value) : String(value ?? "");
    }
  }
}

interface Fitted {
  text: string;
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): Fitted {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text };
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return { text: `${out}…` };
}

function textFor(fonts: PayrollPdfFonts, which: "sans" | "sansBold" | "mono" | "monoBold", value: string): string {
  return fonts.sanitize[which] ? toPdfStandardFontText(value) : value;
}

interface ColumnBox {
  x: number;
  width: number;
  index: number;
}

function layoutColumns(): ColumnBox[] {
  const boxes: ColumnBox[] = [];
  let x = MARGIN;
  LIBRI_PAGAVE_COLUMNS.forEach((column, i) => {
    const width = CONTENT_W * (LIBRI_COLUMN_WIDTHS[i] ?? 0);
    boxes.push({ x, width, index: column.index });
    x += width;
  });
  return boxes;
}

function drawHeaderBlock(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: LibriPagavePdfInput,
  logo: EmbeddedCompanyLogo | null,
): number {
  const top = PAGE_H - MARGIN;
  let textX = MARGIN;

  if (logo) {
    // Contain, never crop: the plate letterboxes a square logo. With no logo the
    // text block simply starts at the margin — no placeholder, no gap.
    const afterLogoX = drawCompanyLogoPlate(page, logo, { x: MARGIN, top });
    textX = afterLogoX + 14;
    page.drawLine({
      start: { x: textX - 7, y: top - 34 },
      end: { x: textX - 7, y: top },
      thickness: RULE.hair,
      color: PP.line,
    });
  }

  const name = input.company.tradeName?.trim() || input.company.legalName;
  page.drawText(textFor(fonts, "sansBold", name), {
    x: textX,
    y: top - 12,
    size: 11,
    font: fonts.sansBold,
    color: PP.navy,
  });

  const meta = [
    input.company.businessNumber ? `NUI ${input.company.businessNumber}` : null,
    [input.company.addressLine, input.company.city].filter(Boolean).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) {
    page.drawText(textFor(fonts, "sans", meta), {
      x: textX,
      y: top - 25,
      size: 7.5,
      font: fonts.sans,
      color: PP.muted,
    });
  }

  const title = "Libri i Pagave · Përmbledhja Financiare";
  const titleWidth = fonts.sansBold.widthOfTextAtSize(title, 11);
  page.drawText(textFor(fonts, "sansBold", title), {
    x: PAGE_W - MARGIN - titleWidth,
    y: top - 12,
    size: 11,
    font: fonts.sansBold,
    color: PP.navy,
  });

  const ref = `PAGAT PER ATK · ${input.periodLabel.toUpperCase()} · ${input.periodRef}`;
  const refWidth = fonts.sans.widthOfTextAtSize(ref, 7.5);
  page.drawText(textFor(fonts, "sans", ref), {
    x: PAGE_W - MARGIN - refWidth,
    y: top - 25,
    size: 7.5,
    font: fonts.sans,
    color: PP.muted,
  });

  const pill = [input.status, input.statusDateLabel].filter(Boolean).join(" · ");
  const pillTextWidth = fonts.sansBold.widthOfTextAtSize(pill, 7);
  const pillW = pillTextWidth + 16;
  drawRoundedRect(page, {
    x: PAGE_W - MARGIN - pillW,
    y: top - 42,
    w: pillW,
    h: 14,
    r: 7,
    color: PP.blueWash,
  });
  page.drawText(textFor(fonts, "sansBold", pill), {
    x: PAGE_W - MARGIN - pillW + 8,
    y: top - 38,
    size: 7,
    font: fonts.sansBold,
    color: PP.blue,
  });

  page.drawRectangle({
    x: MARGIN,
    y: top - 50,
    width: CONTENT_W,
    height: RULE.heavy,
    color: PP.navy,
  });

  return top - 50 - 14;
}

function drawSummaryTiles(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  rows: readonly LibriPagaveRow[],
  topY: number,
): number {
  const totalGross = rows.reduce((a, r) => a + r.totalGross, 0);
  const trustAll = rows.reduce((a, r) => a + r.employeeTrustAmount + r.employerTrustAmount, 0);
  const tax = rows.reduce((a, r) => a + r.taxAmount, 0);
  const netToPay = rows.reduce((a, r) => a + r.netToPay, 0);
  const employerCost = rows.reduce((a, r) => a + r.totalGross + r.employerTrustAmount, 0);

  const tiles: Array<{ label: string; value: string; fill: RGB; ink: RGB; sub: RGB }> = [
    { label: "PUNËTORË", value: String(rows.length), fill: PP.wash, ink: PP.navy, sub: PP.muted },
    { label: "TOTALI BRUTO (16)", value: money(totalGross), fill: PP.wash, ink: PP.navy, sub: PP.muted },
    { label: "TRUST (19+20)", value: money(trustAll), fill: PP.wash, ink: PP.navy, sub: PP.muted },
    { label: "TATIMI (22)", value: money(tax), fill: PP.wash, ink: PP.navy, sub: PP.muted },
    { label: "NETO PËR PAGESË (25)", value: money(netToPay), fill: PP.navy, ink: PP.white, sub: PP.onNavy },
    { label: "KOSTO E PUNËDHËNËSIT", value: money(employerCost), fill: PP.blue, ink: PP.white, sub: PP.white },
  ];

  const gap = 8;
  const tileW = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const tileH = 40;

  tiles.forEach((tile, i) => {
    const x = MARGIN + i * (tileW + gap);
    drawRoundedRect(page, {
      x,
      y: topY - tileH,
      w: tileW,
      h: tileH,
      r: RADIUS.card,
      color: tile.fill,
      borderColor: tile.fill === PP.wash ? PP.line : undefined,
    });
    page.drawText(textFor(fonts, "sans", tile.label), {
      x: x + 9,
      y: topY - 15,
      size: 6.2,
      font: fonts.sans,
      color: tile.sub,
    });
    page.drawText(textFor(fonts, "monoBold", tile.value), {
      x: x + 9,
      y: topY - 31,
      size: 11,
      font: fonts.monoBold,
      color: tile.ink,
    });
  });

  return topY - tileH - 14;
}

function drawTableHead(page: PDFPage, fonts: PayrollPdfFonts, columns: ColumnBox[], topY: number): number {
  const bandH = 13;
  const headH = 22;

  for (const band of LIBRI_PAGAVE_BANDS) {
    const first = columns[band.from - 1]!;
    const last = columns[band.to - 1]!;
    const w = last.x + last.width - first.x;
    page.drawRectangle({ x: first.x, y: topY - bandH, width: w, height: bandH, color: BAND_FILL[band.band] });
    const size = 5.8;
    const label = fit(fonts.sansBold, band.label, size, w - 6).text;
    const labelW = fonts.sansBold.widthOfTextAtSize(label, size);
    page.drawText(textFor(fonts, "sansBold", label), {
      x: first.x + (w - labelW) / 2,
      y: topY - bandH + 4.5,
      size,
      font: fonts.sansBold,
      color: PP.white,
    });
  }

  const headTop = topY - bandH;
  page.drawRectangle({ x: MARGIN, y: headTop - headH, width: CONTENT_W, height: headH, color: PP.slate800 });

  LIBRI_PAGAVE_COLUMNS.forEach((column, i) => {
    const box = columns[i]!;
    const size = 5.4;
    const label = fit(fonts.sansBold, column.headerPrint, size, box.width - 5).text;
    const w = fonts.sansBold.widthOfTextAtSize(label, size);
    const x = column.align === "right" ? box.x + box.width - 3 - w : box.x + 3;
    page.drawText(textFor(fonts, "sansBold", label), {
      x,
      y: headTop - headH + 8,
      size,
      font: fonts.sansBold,
      color: PP.white,
    });
  });

  return headTop - headH;
}

function drawRow(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  columns: ColumnBox[],
  row: LibriPagaveRow,
  topY: number,
  rowH: number,
): void {
  // The two figures auditors look for get their own wash.
  const gross = columns[15]!;
  page.drawRectangle({ x: gross.x, y: topY - rowH, width: gross.width, height: rowH, color: PP.wash });
  const net = columns[24]!;
  page.drawRectangle({ x: net.x, y: topY - rowH, width: net.width, height: rowH, color: PP.blueWash });

  LIBRI_PAGAVE_COLUMNS.forEach((column, i) => {
    const box = columns[i]!;
    const numeric = column.align === "right";
    const font = numeric ? fonts.mono : fonts.sans;
    const which = numeric ? "mono" : "sans";
    const size = 5.6;
    const raw = cellText(row, column.key);
    if (!raw) return;
    const label = fit(font, raw, size, box.width - 5).text;
    const w = font.widthOfTextAtSize(label, size);
    const x = numeric ? box.x + box.width - 3 - w : box.x + 3;
    page.drawText(textFor(fonts, which, label), {
      x,
      y: topY - rowH + 4.5,
      size,
      font,
      color: PP.text,
    });
  });

  page.drawRectangle({ x: MARGIN, y: topY - rowH, width: CONTENT_W, height: RULE.hair, color: PP.hairline });
}

function drawTotalsRow(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  columns: ColumnBox[],
  rows: readonly LibriPagaveRow[],
  topY: number,
): number {
  const rowH = 16;
  page.drawRectangle({ x: MARGIN, y: topY - RULE.heavy, width: CONTENT_W, height: RULE.heavy, color: PP.navy });

  const sums: Record<string, number> = {
    regularGross: rows.reduce((a, r) => a + r.regularGross, 0),
    premiumPay: rows.reduce((a, r) => a + r.premiumPay, 0),
    totalGross: rows.reduce((a, r) => a + r.totalGross, 0),
    employeeTrustAmount: rows.reduce((a, r) => a + r.employeeTrustAmount, 0),
    employerTrustAmount: rows.reduce((a, r) => a + r.employerTrustAmount, 0),
    taxableIncome: rows.reduce((a, r) => a + r.taxableIncome, 0),
    taxAmount: rows.reduce((a, r) => a + r.taxAmount, 0),
    netIncome: rows.reduce((a, r) => a + r.netIncome, 0),
    advance: rows.reduce((a, r) => a + r.advance, 0),
    netToPay: rows.reduce((a, r) => a + r.netToPay, 0),
  };

  const label = "TOTALI";
  page.drawText(textFor(fonts, "sansBold", label), {
    x: MARGIN + 3,
    y: topY - rowH + 5,
    size: 6.4,
    font: fonts.sansBold,
    color: PP.navy,
  });

  LIBRI_PAGAVE_COLUMNS.forEach((column, i) => {
    const total = sums[column.key];
    if (total === undefined) return;
    const box = columns[i]!;
    const size = 6;
    const text = money(total);
    const w = fonts.monoBold.widthOfTextAtSize(text, size);
    page.drawText(textFor(fonts, "monoBold", text), {
      x: box.x + box.width - 3 - w,
      y: topY - rowH + 5,
      size,
      font: fonts.monoBold,
      color: column.key === "netToPay" ? PP.blue : PP.navy,
    });
  });

  return topY - rowH;
}

function drawFooter(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: LibriPagavePdfInput,
  pageNumber: number,
  pageCount: number,
): void {
  const parts = [
    `PAGAPRO · GJENERUAR ${input.generatedAtLabel}`,
    input.snapshotRef ? `SNAPSHOT ${input.snapshotRef}` : null,
    "Kontraktorët përjashtohen",
  ].filter(Boolean) as string[];
  page.drawText(textFor(fonts, "sans", parts.join(" · ")), {
    x: MARGIN,
    y: 16,
    size: 6.5,
    font: fonts.sans,
    color: PP.faint,
  });

  const pager = `${pageNumber}/${pageCount}`;
  const pagerW = fonts.sans.widthOfTextAtSize(pager, 6.5);
  page.drawText(textFor(fonts, "sans", pager), {
    x: PAGE_W / 2 - pagerW / 2,
    y: 16,
    size: 6.5,
    font: fonts.sans,
    color: PP.faint,
  });

  drawPagaproGeneratedFooter(page, fonts.sans, { pageWidth: PAGE_W, margin: MARGIN });
}

/**
 * Renders Libri i Pagave as an A3 landscape PDF.
 *
 * Every figure is read from `buildLibriPagaveRows` output — this is a renderer,
 * not a calculator.
 */
export async function buildLibriPagavePdf(input: LibriPagavePdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fonts = await embedPayrollPdfFonts(pdf);
  const logo = input.logo ? await embedCompanyLogo(pdf, input.logo) : null;
  const columns = layoutColumns();

  const rowH = 13;
  const bottomLimit = 34;

  const pages: LibriPagaveRow[][] = [];
  let cursor = 0;
  let firstPage = true;
  while (cursor < input.rows.length || pages.length === 0) {
    // Header + (page 1) tiles + table head, then whatever rows fit above the footer.
    const headUsed = 50 + 14 + (firstPage ? 54 : 0) + 13 + 22;
    const available = PAGE_H - MARGIN - headUsed - bottomLimit - 20;
    const capacity = Math.max(1, Math.floor(available / rowH));
    pages.push(input.rows.slice(cursor, cursor + capacity));
    cursor += capacity;
    firstPage = false;
    if (input.rows.length === 0) break;
  }

  pages.forEach((pageRows, pageIndex) => {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = drawHeaderBlock(page, fonts, input, logo);
    if (pageIndex === 0) y = drawSummaryTiles(page, fonts, input.rows, y);
    y = drawTableHead(page, fonts, columns, y);

    if (input.rows.length === 0) {
      page.drawText(textFor(fonts, "sans", "Nuk ka rreshta për këtë periudhë."), {
        x: MARGIN + 4,
        y: y - 16,
        size: 8,
        font: fonts.sans,
        color: PP.muted,
      });
    }

    for (const row of pageRows) {
      drawRow(page, fonts, columns, row, y, rowH);
      y -= rowH;
    }

    if (pageIndex === pages.length - 1 && input.rows.length > 0) {
      drawTotalsRow(page, fonts, columns, input.rows, y);
    }

    drawFooter(page, fonts, input, pageIndex + 1, pages.length);
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
