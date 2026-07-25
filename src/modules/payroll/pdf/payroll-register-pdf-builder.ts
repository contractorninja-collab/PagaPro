import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
} from "@/modules/payroll/pdf/payroll-pdf-fonts";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CELL_PAD = 6;

const NAVY = rgb(0.11, 0.2, 0.35);
const NAVY_LIGHT = rgb(0.93, 0.95, 0.98);
const ACCENT = rgb(0.15, 0.42, 0.72);
const TEXT = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.42, 0.44, 0.48);
const LINE = rgb(0.82, 0.84, 0.88);
const TOTAL_BG = rgb(0.9, 0.96, 0.92);
const TOTAL_BORDER = rgb(0.2, 0.55, 0.35);
const ROW_ALT = rgb(0.97, 0.98, 0.99);

/** Percentage-based A4 column layout (matches spec: 5 / 35 / 25 / 17.5 / 17.5). */
interface ColumnBox {
  x: number;
  width: number;
  right: number;
}

interface RegisterLayout {
  withAmounts: boolean;
  num: ColumnBox;
  name: ColumnBox;
  pid: ColumnBox;
  gross: ColumnBox;
  net: ColumnBox;
  sign: ColumnBox;
  meta: ColumnBox[];
}

function columnAt(offsetPct: number, widthPct: number): ColumnBox {
  const x = MARGIN + CONTENT_W * offsetPct;
  const width = CONTENT_W * widthPct;
  return { x, width, right: x + width - CELL_PAD };
}

/** Shared metadata grid: Referenca | Data e pageses | Punonjes | Monedha */
function buildMetaColumns(): ColumnBox[] {
  return [0, 0.25, 0.5, 0.75].map((p) => columnAt(p, 0.25));
}

function buildLayout(withAmounts: boolean): RegisterLayout {
  const num = columnAt(0, 0.05);
  const name = columnAt(0.05, 0.35);
  const pid = columnAt(0.4, 0.25);
  const meta = buildMetaColumns();

  if (withAmounts) {
    return {
      withAmounts: true,
      num,
      name,
      pid,
      gross: columnAt(0.65, 0.175),
      net: columnAt(0.825, 0.175),
      sign: columnAt(0.65, 0.35),
      meta,
    };
  }

  return {
    withAmounts: false,
    num,
    name,
    pid,
    gross: columnAt(0.65, 0.175),
    net: columnAt(0.825, 0.175),
    sign: columnAt(0.65, 0.35),
    meta,
  };
}

export interface PayrollRegisterRow {
  name: string;
  personalId: string;
  gross: string;
  net: string;
}

export interface PayrollRegisterPdfInput {
  company: PayslipPdfCompany;
  periodLabel: string;
  currency: string;
  payDateLabel: string;
  documentRef: string;
  withAmounts: boolean;
  rows: PayrollRegisterRow[];
  logo?: CompanyLogoAsset | null;
}

function txt(s: string): string {
  return toPdfStandardFontText(s);
}

function money(amount: string, currency: string): string {
  const n = Number(amount.replace(",", "."));
  const formatted = Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;
  return `${currency} ${formatted}`;
}

function sumPlain(values: string[]): string {
  let t = 0;
  for (const v of values) {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) t += n;
  }
  return t.toFixed(2);
}

function textWidth(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(txt(text), size);
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (textWidth(font, text, size) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && textWidth(font, s, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s.length < text.length ? `${s.slice(0, Math.max(0, s.length - 2))}..` : s;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = TEXT,
) {
  page.drawText(txt(text), { x, y, size, font, color });
}

function drawTextInBox(
  page: PDFPage,
  text: string,
  box: ColumnBox,
  y: number,
  font: PDFFont,
  size: number,
  align: "left" | "right",
  color = TEXT,
) {
  const fitted = fitText(text, font, size, box.width - CELL_PAD * 2);
  const encoded = txt(fitted);
  const w = font.widthOfTextAtSize(encoded, size);
  const x = align === "right" ? box.right - w : box.x + CELL_PAD;
  page.drawText(encoded, { x, y, size, font, color });
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawHLine(page: PDFPage, y: number, x = MARGIN, w = CONTENT_W) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.5, color: LINE });
}

function drawCompanyHeader(
  page: PDFPage,
  company: PayslipPdfCompany,
  docTitle: string,
  periodLabel: string,
  font: PDFFont,
  fontBold: PDFFont,
  logo: EmbeddedCompanyLogo | null,
) {
  drawRect(page, 0, PAGE_H - 72, PAGE_W, 72, NAVY);
  const companyTextX = logo
    ? drawCompanyLogoPlate(page, logo, { x: 16, top: PAGE_H - 7 }) + 10
    : MARGIN;
  const companyTextWidth = PAGE_W - companyTextX - MARGIN - 170;
  if (!logo) {
    drawText(page, fitText(company.displayName.toUpperCase(), fontBold, 16, companyTextWidth), companyTextX, PAGE_H - 38, fontBold, 16, rgb(1, 1, 1));
  }
  const subLine = [company.addressLine, company.cityLine].filter(Boolean).join(" · ");
  if (subLine) {
    drawText(page, fitText(subLine, font, 8, companyTextWidth), companyTextX, logo ? PAGE_H - 45 : PAGE_H - 56, font, 8, rgb(0.85, 0.88, 0.92));
  }
  drawText(page, docTitle, PAGE_W - MARGIN - 160, PAGE_H - 38, fontBold, 11, rgb(1, 1, 1));
  drawText(page, periodLabel, PAGE_W - MARGIN - 160, PAGE_H - 54, font, 9, rgb(0.85, 0.88, 0.92));
}

/** 4-column metadata grid: Referenca | Data e pageses | Punonjes | Monedha */
function drawMetaBlock(
  page: PDFPage,
  input: PayrollRegisterPdfInput,
  layout: RegisterLayout,
  font: PDFFont,
  fontBold: PDFFont,
  y: number,
): number {
  const fields = [
    { label: "Referenca", value: input.documentRef },
    { label: "Data e pageses", value: input.payDateLabel },
    { label: "Punonjes", value: String(input.rows.length) },
    { label: "Monedha", value: input.currency },
  ];

  drawRect(page, MARGIN, y - 28, CONTENT_W, 30, NAVY_LIGHT);
  for (let i = 0; i < fields.length; i++) {
    const box = layout.meta[i]!;
    const field = fields[i]!;
    drawTextInBox(page, field.label, box, y - 8, fontBold, 7, "left", MUTED);
    drawTextInBox(page, field.value, box, y - 20, font, 8, "left", TEXT);
  }

  return y - 38;
}

function drawSignatureBlock(page: PDFPage, font: PDFFont, y: number): number {
  y -= 16;
  const halfW = (CONTENT_W - 24) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + halfW + 24;

  drawHLine(page, y, leftX, halfW);
  drawHLine(page, y, rightX, halfW);
  y -= 14;
  drawText(page, "Pergjegjesi financiar", leftX, y, font, 8, MUTED);
  drawText(page, "Drejtori / Personi i autorizuar", rightX, y, font, 8, MUTED);
  y -= 28;
  drawHLine(page, y, leftX, 140);
  y -= 14;
  drawText(page, "Data:", leftX, y, font, 8, MUTED);
  return y - 20;
}

function drawLegalFooter(page: PDFPage, company: PayslipPdfCompany, font: PDFFont, y: number): number {
  drawHLine(page, y);
  y -= 14;
  const legalBits = [
    company.legalName !== company.displayName ? company.legalName : null,
    company.fiscalNumber ? `NUI: ${company.fiscalNumber}` : null,
    company.businessNumber ? `NRB: ${company.businessNumber}` : null,
    company.phone ? `Tel: ${company.phone}` : null,
    company.email ? company.email : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (legalBits) {
    drawText(page, fitText(legalBits, font, 7, CONTENT_W), MARGIN, y, font, 7, MUTED);
    y -= 12;
  }
  drawText(page, "Dokument konfidencial — per perdorim te brendshem te kompanise.", MARGIN, y, font, 7, MUTED);
  return y;
}

function drawTableHeader(
  page: PDFPage,
  layout: RegisterLayout,
  fontBold: PDFFont,
  y: number,
): number {
  drawRect(page, MARGIN, y - 14, CONTENT_W, 18, NAVY_LIGHT);
  drawTextInBox(page, "#", layout.num, y - 10, fontBold, 8, "left", ACCENT);
  drawTextInBox(page, "Punonjesi", layout.name, y - 10, fontBold, 8, "left", ACCENT);
  drawTextInBox(page, "Numri personal", layout.pid, y - 10, fontBold, 8, "left", ACCENT);
  if (layout.withAmounts) {
    drawTextInBox(page, "Bruto", layout.gross, y - 10, fontBold, 8, "right", ACCENT);
    drawTextInBox(page, "Neto", layout.net, y - 10, fontBold, 8, "right", ACCENT);
  } else {
    drawTextInBox(page, "Nenshkrimi", layout.sign, y - 10, fontBold, 8, "left", ACCENT);
  }
  return y - 24;
}

function drawDataRow(
  page: PDFPage,
  row: PayrollRegisterRow,
  idx: number,
  layout: RegisterLayout,
  currency: string,
  y: number,
  font: PDFFont,
) {
  if (idx % 2 === 1) {
    drawRect(page, MARGIN, y - 14, CONTENT_W, 18, ROW_ALT);
  }

  drawTextInBox(page, String(idx + 1), layout.num, y - 10, font, 9, "left");
  drawTextInBox(page, row.name, layout.name, y - 10, font, 9, "left");
  drawTextInBox(page, row.personalId, layout.pid, y - 10, font, 9, "left");

  if (layout.withAmounts) {
    drawTextInBox(page, money(row.gross, currency), layout.gross, y - 10, font, 9, "right");
    drawTextInBox(page, money(row.net, currency), layout.net, y - 10, font, 9, "right");
  } else {
    drawHLine(page, y - 12, layout.sign.x + CELL_PAD, layout.sign.width - CELL_PAD * 2);
  }
}

function drawTotalsRow(
  page: PDFPage,
  layout: RegisterLayout,
  totalGross: string,
  totalNet: string,
  currency: string,
  y: number,
  font: PDFFont,
  fontBold: PDFFont,
): number {
  const boxH = 32;
  y -= 8;
  drawRect(page, MARGIN, y - boxH, CONTENT_W, boxH, TOTAL_BG);
  page.drawRectangle({
    x: MARGIN,
    y: y - boxH,
    width: CONTENT_W,
    height: boxH,
    borderColor: TOTAL_BORDER,
    borderWidth: 1,
  });
  drawTextInBox(page, "TOTALET", layout.name, y - 20, fontBold, 10, "left", TOTAL_BORDER);
  drawTextInBox(page, money(totalGross, currency), layout.gross, y - 20, fontBold, 9, "right", TOTAL_BORDER);
  drawTextInBox(page, money(totalNet, currency), layout.net, y - 20, fontBold, 9, "right", TOTAL_BORDER);
  return y - boxH - 12;
}

/** Build payroll register PDF matching payslip document styling. */
export async function buildPayrollRegisterPdf(input: PayrollRegisterPdfInput): Promise<Uint8Array> {
  const docTitle = input.withAmounts ? "LISTA E PAGEVE" : "LISTA PER NENSHKRIME";
  const pdfTitle = input.withAmounts ? "Lista e pagave" : "Lista per nenshkrime";

  const pdf = await PDFDocument.create();
  pdf.setTitle(txt(`${pdfTitle} — ${input.periodLabel}`));
  pdf.setAuthor(txt(input.company.displayName));
  pdf.setSubject(txt(pdfTitle));

  const { body: font, heading: fontBold } = await embedPayrollPdfFonts(pdf);
  const companyLogo = await embedCompanyLogo(pdf, input.logo);
  const layout = buildLayout(input.withAmounts);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  drawCompanyHeader(page, input.company, docTitle, input.periodLabel, font, fontBold, companyLogo);

  let y = PAGE_H - 100;
  y = drawMetaBlock(page, input, layout, font, fontBold, y);
  drawHLine(page, y);
  y -= 20;

  y = drawTableHeader(page, layout, fontBold, y);

  const rowH = 18;
  const minY = 160;

  input.rows.forEach((row, idx) => {
    if (y < minY) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawCompanyHeader(page, input.company, `${docTitle} (vazhdim)`, input.periodLabel, font, fontBold, companyLogo);
      y = PAGE_H - 100;
      y = drawTableHeader(page, layout, fontBold, y);
    }
    drawDataRow(page, row, idx, layout, input.currency, y, font);
    y -= rowH;
  });

  if (layout.withAmounts && input.rows.length > 0) {
    if (y < minY + 50) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawCompanyHeader(page, input.company, `${docTitle} (vazhdim)`, input.periodLabel, font, fontBold, companyLogo);
      y = PAGE_H - 100;
    }
    y = drawTotalsRow(
      page,
      layout,
      sumPlain(input.rows.map((r) => r.gross)),
      sumPlain(input.rows.map((r) => r.net)),
      input.currency,
      y,
      font,
      fontBold,
    );
  }

  if (y < minY + 70) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    drawCompanyHeader(page, input.company, `${docTitle} (vazhdim)`, input.periodLabel, font, fontBold, companyLogo);
    y = PAGE_H - 100;
  }

  y = drawSignatureBlock(page, font, y);
  drawLegalFooter(page, input.company, font, y);
  for (const outputPage of pdf.getPages()) {
    drawPagaproGeneratedFooter(outputPage, fontBold, {
      pageWidth: PAGE_W,
      margin: MARGIN,
    });
  }

  return pdf.save();
}

/** Exported for unit tests — column boxes must not overlap. */
export function getRegisterLayoutForTests(withAmounts = true): RegisterLayout {
  return buildLayout(withAmounts);
}
