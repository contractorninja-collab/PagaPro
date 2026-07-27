import { PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { toPdfStandardFontText } from "@/modules/payroll/helpers/pdf-standard-font-text";
import type { PayslipPdfCompany } from "@/modules/payroll/pdf/payslip-pdf-builder";
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

const PAGE_W = PAGE.a4Landscape.width;
const PAGE_H = PAGE.a4Landscape.height;
const MARGIN = 32;
const CONTENT_W = PAGE_W - MARGIN * 2;

export interface PayrollRegisterRow {
  name: string;
  personalId: string;
  gross: string;
  net: string;
  /** Detail columns; when absent the cell prints an em dash rather than a zero. */
  position?: string | null;
  days?: string | null;
  base?: string | null;
  extra?: string | null;
  pensionEmployee?: string | null;
  taxable?: string | null;
  tax?: string | null;
  otherDeductions?: string | null;
  pensionEmployer?: string | null;
}

export interface PayrollRegisterPdfInput {
  company: PayslipPdfCompany;
  periodLabel: string;
  currency: string;
  payDateLabel: string;
  documentRef: string;
  /** true → the 13-column salary list; false → the signature list. */
  withAmounts: boolean;
  rows: PayrollRegisterRow[];
  logo?: CompanyLogoAsset | null;
  approvalLabel?: string | null;
  generatedAtLabel?: string | null;
}

interface ColumnSpec {
  key: string;
  header: string;
  fraction: number;
  align: "left" | "right";
  emphasis?: boolean;
}

/** The redesign's 13 columns; the fractions sum to 1 — asserted in the layout test. */
const AMOUNT_COLUMNS: readonly ColumnSpec[] = [
  { key: "no", header: "#", fraction: 0.035, align: "left" },
  { key: "name", header: "PUNËTORI", fraction: 0.155, align: "left" },
  { key: "position", header: "POZITA", fraction: 0.155, align: "left" },
  { key: "days", header: "DITË", fraction: 0.045, align: "right" },
  { key: "base", header: "PAGA NETO", fraction: 0.075, align: "right" },
  { key: "extra", header: "SHTESA", fraction: 0.065, align: "right" },
  { key: "gross", header: "BRUTO", fraction: 0.08, align: "right" },
  { key: "pensionEmployee", header: "KONTR. 5%", fraction: 0.07, align: "right" },
  { key: "taxable", header: "BAZË TATIMI", fraction: 0.08, align: "right" },
  { key: "tax", header: "TATIMI", fraction: 0.065, align: "right" },
  { key: "otherDeductions", header: "NDALESA", fraction: 0.065, align: "right" },
  { key: "net", header: "NETO", fraction: 0.08, align: "right", emphasis: true },
  { key: "pensionEmployer", header: "KONTR. PD.", fraction: 0.07, align: "right" },
];

const SIGNATURE_COLUMNS: readonly ColumnSpec[] = [
  { key: "no", header: "#", fraction: 0.04, align: "left" },
  { key: "name", header: "PUNËTORI", fraction: 0.26, align: "left" },
  { key: "position", header: "POZITA", fraction: 0.22, align: "left" },
  { key: "personalId", header: "NUMRI PERSONAL", fraction: 0.16, align: "left" },
  { key: "net", header: "NETO", fraction: 0.1, align: "right", emphasis: true },
  { key: "sign", header: "NËNSHKRIMI", fraction: 0.22, align: "left" },
];

export interface RegisterColumnBox {
  key: string;
  header: string;
  x: number;
  width: number;
  right: number;
  align: "left" | "right";
  emphasis: boolean;
}

function layoutColumns(withAmounts: boolean): RegisterColumnBox[] {
  const specs = withAmounts ? AMOUNT_COLUMNS : SIGNATURE_COLUMNS;
  // Normalise rather than trusting the fractions to sum to 1 — the design's own
  // list sums to 1.04, which would have run the last column off the page.
  const total = specs.reduce((a, s) => a + s.fraction, 0);
  const boxes: RegisterColumnBox[] = [];
  let x = MARGIN;
  for (const spec of specs) {
    const width = (CONTENT_W * spec.fraction) / total;
    boxes.push({
      key: spec.key,
      header: spec.header,
      x,
      width,
      right: x + width,
      align: spec.align,
      emphasis: Boolean(spec.emphasis),
    });
    x += width;
  }
  return boxes;
}

export function getRegisterLayoutForTests(withAmounts: boolean): {
  columns: RegisterColumnBox[];
  contentWidth: number;
  pageWidth: number;
  pageHeight: number;
} {
  return {
    columns: layoutColumns(withAmounts),
    contentWidth: CONTENT_W,
    pageWidth: PAGE_W,
    pageHeight: PAGE_H,
  };
}

function textFor(
  fonts: PayrollPdfFonts,
  which: "sans" | "sansBold" | "mono" | "monoBold",
  value: string,
): string {
  return fonts.sanitize[which] ? toPdfStandardFontText(value) : value;
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function money(value: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cellValue(row: PayrollRegisterRow, key: string, index: number): string {
  if (key === "no") return String(index + 1);
  if (key === "sign") return "";
  const raw = row[key as keyof PayrollRegisterRow];
  if (raw == null || raw === "") return "—";
  if (key === "name" || key === "position" || key === "personalId" || key === "days") {
    return String(raw);
  }
  return money(toNumber(String(raw)));
}

function drawRunningHeader(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayrollRegisterPdfInput,
  logo: EmbeddedCompanyLogo | null,
): number {
  const top = PAGE_H - MARGIN;
  let textX = MARGIN;

  if (logo) {
    // Contain, never crop; with no logo the text block starts at the margin.
    const afterLogo = drawCompanyLogoPlate(page, logo, { x: MARGIN, top });
    textX = afterLogo + 14;
    page.drawLine({
      start: { x: textX - 7, y: top - 34 },
      end: { x: textX - 7, y: top },
      thickness: RULE.hair,
      color: PP.line,
    });
  }

  const name = input.company.displayName || input.company.legalName;
  page.drawText(textFor(fonts, "sansBold", name), {
    x: textX,
    y: top - 12,
    size: 12,
    font: fonts.sansBold,
    color: PP.navy,
  });

  const meta = [
    input.company.businessNumber ? `NUI ${input.company.businessNumber}` : null,
    [input.company.addressLine, input.company.cityLine].filter(Boolean).join(", ") || null,
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

  const title = input.withAmounts ? "Lista e pagave" : "Lista e nënshkrimeve";
  const titleW = fonts.sansBold.widthOfTextAtSize(title, 12);
  page.drawText(textFor(fonts, "sansBold", title), {
    x: PAGE_W - MARGIN - titleW,
    y: top - 12,
    size: 12,
    font: fonts.sansBold,
    color: PP.navy,
  });

  const ref = `${input.documentRef} · ${input.periodLabel.toUpperCase()}`;
  const refW = fonts.sans.widthOfTextAtSize(ref, 7.5);
  page.drawText(textFor(fonts, "sans", ref), {
    x: PAGE_W - MARGIN - refW,
    y: top - 25,
    size: 7.5,
    font: fonts.sans,
    color: PP.muted,
  });

  if (input.approvalLabel) {
    const pillTextW = fonts.sansBold.widthOfTextAtSize(input.approvalLabel, 7);
    const pillW = pillTextW + 16;
    drawRoundedRect(page, {
      x: PAGE_W - MARGIN - pillW,
      y: top - 42,
      w: pillW,
      h: 14,
      r: 7,
      color: PP.blueWash,
    });
    page.drawText(textFor(fonts, "sansBold", input.approvalLabel), {
      x: PAGE_W - MARGIN - pillW + 8,
      y: top - 38,
      size: 7,
      font: fonts.sansBold,
      color: PP.blue,
    });
  }

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
  rows: PayrollRegisterRow[],
  topY: number,
): number {
  const gross = rows.reduce((a, r) => a + toNumber(r.gross), 0);
  const tax = rows.reduce((a, r) => a + toNumber(r.tax), 0);
  const pensionEmployee = rows.reduce((a, r) => a + toNumber(r.pensionEmployee), 0);
  const pensionEmployer = rows.reduce((a, r) => a + toNumber(r.pensionEmployer), 0);
  const net = rows.reduce((a, r) => a + toNumber(r.net), 0);

  const tiles: Array<{ label: string; value: string; fill: RGB; ink: RGB; sub: RGB }> = [
    { label: "PUNËTORË", value: String(rows.length), fill: PP.wash, ink: PP.navy, sub: PP.muted },
    { label: "BRUTO", value: money(gross), fill: PP.wash, ink: PP.navy, sub: PP.muted },
    {
      label: "TATIM + KONTRIBUTE",
      value: money(tax + pensionEmployee + pensionEmployer),
      fill: PP.wash,
      ink: PP.navy,
      sub: PP.muted,
    },
    { label: "NETO PËR TRANSFER", value: money(net), fill: PP.navy, ink: PP.white, sub: PP.onNavy },
    {
      label: "KOSTO TOTALE",
      value: money(gross + pensionEmployer),
      fill: PP.blue,
      ink: PP.white,
      sub: PP.white,
    },
  ];

  const gap = 10;
  const tileW = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const tileH = 44;

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
      x: x + 10,
      y: topY - 16,
      size: 6.5,
      font: fonts.sans,
      color: tile.sub,
    });
    page.drawText(textFor(fonts, "monoBold", tile.value), {
      x: x + 10,
      y: topY - 34,
      size: 12,
      font: fonts.monoBold,
      color: tile.ink,
    });
  });

  return topY - tileH - 16;
}

function drawTableHeader(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  columns: RegisterColumnBox[],
  topY: number,
): number {
  const h = 20;
  drawRoundedRect(page, { x: MARGIN, y: topY - h, w: CONTENT_W, h, r: 6, color: PP.navy });

  for (const column of columns) {
    const size = 6.4;
    const label = fit(fonts.sansBold, column.header, size, column.width - 8);
    const w = fonts.sansBold.widthOfTextAtSize(label, size);
    const x = column.align === "right" ? column.right - 5 - w : column.x + 5;
    page.drawText(textFor(fonts, "sansBold", label), {
      x,
      y: topY - h + 7,
      size,
      font: fonts.sansBold,
      color: PP.white,
    });
  }

  return topY - h;
}

function drawBodyRow(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  columns: RegisterColumnBox[],
  row: PayrollRegisterRow,
  index: number,
  topY: number,
  rowH: number,
): void {
  for (const column of columns) {
    if (column.key === "sign") {
      page.drawLine({
        start: { x: column.x + 6, y: topY - rowH + 6 },
        end: { x: column.right - 6, y: topY - rowH + 6 },
        thickness: RULE.hair,
        color: PP.line,
      });
      continue;
    }
    const numeric = column.align === "right" && column.key !== "days";
    const font = numeric ? (column.emphasis ? fonts.monoBold : fonts.mono) : fonts.sans;
    const which = numeric ? (column.emphasis ? "monoBold" : "mono") : "sans";
    const size = 7;
    const value = cellValue(row, column.key, index);
    if (!value) continue;
    const label = fit(font, value, size, column.width - 8);
    const w = font.widthOfTextAtSize(label, size);
    const x = column.align === "right" ? column.right - 5 - w : column.x + 5;
    page.drawText(textFor(fonts, which, label), {
      x,
      y: topY - rowH + 5.5,
      size,
      font,
      color: column.emphasis ? PP.navy : PP.text,
    });
  }

  // Hairline separator — the redesign drops the zebra striping.
  page.drawRectangle({
    x: MARGIN,
    y: topY - rowH,
    width: CONTENT_W,
    height: RULE.hair,
    color: PP.hairline,
  });
}

function drawTotalsRow(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  columns: RegisterColumnBox[],
  rows: PayrollRegisterRow[],
  topY: number,
): number {
  const h = 20;
  page.drawRectangle({
    x: MARGIN,
    y: topY - RULE.heavy,
    width: CONTENT_W,
    height: RULE.heavy,
    color: PP.navy,
  });

  const sums: Record<string, number> = {};
  for (const key of [
    "base",
    "extra",
    "gross",
    "pensionEmployee",
    "taxable",
    "tax",
    "otherDeductions",
    "net",
    "pensionEmployer",
  ]) {
    sums[key] = rows.reduce(
      (a, r) => a + toNumber(r[key as keyof PayrollRegisterRow] as string),
      0,
    );
  }

  page.drawText(textFor(fonts, "sansBold", `Totali · ${rows.length} punëtorë`), {
    x: MARGIN + 5,
    y: topY - h + 6,
    size: 7.2,
    font: fonts.sansBold,
    color: PP.navy,
  });

  for (const column of columns) {
    const total = sums[column.key];
    if (total === undefined) continue;
    const size = 7.2;
    const text = money(total);
    const w = fonts.monoBold.widthOfTextAtSize(text, size);
    page.drawText(textFor(fonts, "monoBold", text), {
      x: column.right - 5 - w,
      y: topY - h + 6,
      size,
      font: fonts.monoBold,
      color: column.emphasis ? PP.blue : PP.navy,
    });
  }

  return topY - h;
}

function drawSignOff(page: PDFPage, fonts: PayrollPdfFonts, topY: number): void {
  const h = 64;
  const noteW = CONTENT_W * 0.5;
  const colW = (CONTENT_W - noteW - 20) / 2;

  drawRoundedRect(page, {
    x: MARGIN,
    y: topY - h,
    w: noteW,
    h,
    r: RADIUS.card,
    color: PP.wash,
    borderColor: PP.line,
  });

  const note =
    "Lista pasqyron shumat e ngrira të periudhës. Kontributet dhe tatimi paguhen sipas afateve ligjore.";
  let line = "";
  let ly = topY - 18;
  for (const word of note.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (fonts.sans.widthOfTextAtSize(next, 7) > noteW - 20) {
      page.drawText(textFor(fonts, "sans", line), {
        x: MARGIN + 10,
        y: ly,
        size: 7,
        font: fonts.sans,
        color: PP.muted,
      });
      ly -= 10;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    page.drawText(textFor(fonts, "sans", line), {
      x: MARGIN + 10,
      y: ly,
      size: 7,
      font: fonts.sans,
      color: PP.muted,
    });
  }

  ["PËRGATITI", "APROVOI"].forEach((title, i) => {
    const x = MARGIN + noteW + 20 + i * colW;
    page.drawText(textFor(fonts, "sans", title), {
      x,
      y: topY - 18,
      size: 6.5,
      font: fonts.sans,
      color: PP.faint,
    });
    page.drawLine({
      start: { x, y: topY - h + 18 },
      end: { x: x + colW - 20, y: topY - h + 18 },
      thickness: RULE.hair,
      color: PP.line,
    });
  });
}

function drawFooter(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayrollRegisterPdfInput,
  pageNumber: number,
  pageCount: number,
): void {
  const left = [
    input.generatedAtLabel ? `PAGAPRO · GJENERUAR ${input.generatedAtLabel}` : "PAGAPRO",
    input.company.businessNumber ? `NUI ${input.company.businessNumber}` : null,
    "paga-pro.com",
  ]
    .filter(Boolean)
    .join(" · ");
  page.drawText(textFor(fonts, "sans", left), {
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

/** Builds the salary list (or the signature list) as an A4 landscape PDF. */
export async function buildPayrollRegisterPdf(
  input: PayrollRegisterPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const title = input.withAmounts ? "Lista e pagave" : "Lista e nënshkrimeve";
  pdf.setTitle(toPdfStandardFontText(`${title} — ${input.periodLabel}`));
  pdf.setAuthor(toPdfStandardFontText(input.company.displayName));
  pdf.setSubject(toPdfStandardFontText(title));

  const fonts = await embedPayrollPdfFonts(pdf);
  const logo = await embedCompanyLogo(pdf, input.logo);
  const columns = layoutColumns(input.withAmounts);

  const rowH = input.withAmounts ? 16 : 22;
  const bottomLimit = 34;
  const signOffH = 88;

  const headUsed = 50 + 14 + 20;
  const firstAvailable = PAGE_H - MARGIN - headUsed - (input.withAmounts ? 60 : 0) - bottomLimit - 24;
  const laterAvailable = PAGE_H - MARGIN - headUsed - bottomLimit - 24;

  const pages: PayrollRegisterRow[][] = [];
  let cursor = 0;
  while (cursor < input.rows.length) {
    const available = pages.length === 0 ? firstAvailable : laterAvailable;
    const capacity = Math.max(1, Math.floor(available / rowH));
    pages.push(input.rows.slice(cursor, cursor + capacity));
    cursor += capacity;
  }
  if (pages.length === 0) pages.push([]);

  // The sign-off strip may need a page of its own; count it before drawing footers.
  let rowOffset = 0;
  const rendered: Array<{ page: PDFPage; y: number; isLast: boolean }> = [];

  pages.forEach((pageRows, pageIndex) => {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = drawRunningHeader(page, fonts, input, logo);
    if (pageIndex === 0 && input.withAmounts) y = drawSummaryTiles(page, fonts, input.rows, y);
    y = drawTableHeader(page, fonts, columns, y);

    if (input.rows.length === 0) {
      page.drawText(textFor(fonts, "sans", "Nuk ka punonjës në këtë listë."), {
        x: MARGIN + 5,
        y: y - 18,
        size: 8,
        font: fonts.sans,
        color: PP.muted,
      });
    }

    pageRows.forEach((row, i) => {
      drawBodyRow(page, fonts, columns, row, rowOffset + i, y, rowH);
      y -= rowH;
    });
    rowOffset += pageRows.length;

    const isLast = pageIndex === pages.length - 1;
    if (isLast && input.rows.length > 0 && input.withAmounts) {
      y = drawTotalsRow(page, fonts, columns, input.rows, y);
    }
    rendered.push({ page, y, isLast });
  });

  const last = rendered[rendered.length - 1]!;
  const needsExtraPage = last.y - signOffH < bottomLimit;
  const totalPages = pages.length + (needsExtraPage ? 1 : 0);

  rendered.forEach((entry, i) => {
    if (entry.isLast && !needsExtraPage) drawSignOff(entry.page, fonts, entry.y - 12);
    drawFooter(entry.page, fonts, input, i + 1, totalPages);
  });

  if (needsExtraPage) {
    const extra = pdf.addPage([PAGE_W, PAGE_H]);
    const y = drawRunningHeader(extra, fonts, input, logo);
    drawSignOff(extra, fonts, y - 6);
    drawFooter(extra, fonts, input, totalPages, totalPages);
  }

  return pdf.save();
}
