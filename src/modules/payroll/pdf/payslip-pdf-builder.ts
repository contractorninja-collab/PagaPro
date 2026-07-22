import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { toPdfStandardFontText } from "@/modules/payroll/helpers/pdf-standard-font-text";
import type { CompanyLogoAsset } from "@/modules/company-branding/company-logo";
import { drawCompanyLogoPlate, embedCompanyLogo } from "@/modules/company-branding/pdf-logo-branding";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const NAVY = rgb(0.11, 0.2, 0.35);
const NAVY_LIGHT = rgb(0.93, 0.95, 0.98);
const ACCENT = rgb(0.15, 0.42, 0.72);
const TEXT = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.42, 0.44, 0.48);
const LINE = rgb(0.82, 0.84, 0.88);
const NET_BG = rgb(0.9, 0.96, 0.92);
const NET_BORDER = rgb(0.2, 0.55, 0.35);

export interface PayslipPdfCompany {
  displayName: string;
  legalName: string;
  addressLine: string;
  cityLine: string;
  fiscalNumber: string | null;
  businessNumber: string | null;
  phone: string | null;
  email: string | null;
}

export interface PayslipPdfEmployee {
  fullName: string;
  personalId: string;
  jobTitle: string | null;
  bankName: string | null;
  iban: string | null;
  accountHolder: string | null;
  bicSwift: string | null;
}

export interface PayslipPdfPeriod {
  year: number;
  month: number;
  periodLabel: string;
  currency: string;
  payDateLabel: string;
}

export interface PayslipPdfAmounts {
  hourlyRate: string;
  actualRegularHours: string;
  regularPay: string;
  paidLeavePay: string;
  sickLeavePay: string;
  overtimeAmount: string;
  weekendAmount: string;
  holidayAmount: string;
  nightAmount: string;
  bonuses: string;
  unpaidLeaveDeduction: string;
  grossSalary: string;
  pensionEmployee: string;
  pitWithheld: string;
  salaryAdvanceDeduction: string;
  otherDeductions: string;
  netPay: string;
  pensionEmployer: string;
}

export interface PayslipPdfInput {
  company: PayslipPdfCompany;
  employee: PayslipPdfEmployee;
  period: PayslipPdfPeriod;
  amounts: PayslipPdfAmounts;
  documentRef: string;
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
  return txt(`${currency} ${formatted}`);
}

function isZeroAmount(v: string): boolean {
  const n = Number(v.replace(",", "."));
  return !Number.isFinite(n) || n === 0;
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(txt(text), size) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(txt(`${value}..`), size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}..`;
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

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawHLine(page: PDFPage, y: number, x = MARGIN, w = CONTENT_W) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.5, color: LINE });
}

interface LineItem {
  label: string;
  amount: string;
  rawAmount: string;
  always?: boolean;
}

function earningLines(amounts: PayslipPdfAmounts, currency: string): LineItem[] {
  return [
    {
      label: `Paga e rregullt (${amounts.actualRegularHours} ore x ${amounts.hourlyRate}/ore)`,
      amount: money(amounts.regularPay, currency),
      rawAmount: amounts.regularPay,
      always: true,
    },
    { label: "Pushim i paguar", amount: money(amounts.paidLeavePay, currency), rawAmount: amounts.paidLeavePay },
    { label: "Pushim mjekesor", amount: money(amounts.sickLeavePay, currency), rawAmount: amounts.sickLeavePay },
    { label: "Ore shtese", amount: money(amounts.overtimeAmount, currency), rawAmount: amounts.overtimeAmount },
    { label: "Fundjave", amount: money(amounts.weekendAmount, currency), rawAmount: amounts.weekendAmount },
    { label: "Feste", amount: money(amounts.holidayAmount, currency), rawAmount: amounts.holidayAmount },
    { label: "Pune naten", amount: money(amounts.nightAmount, currency), rawAmount: amounts.nightAmount },
    { label: "Bonuse", amount: money(amounts.bonuses, currency), rawAmount: amounts.bonuses },
  ].filter((row) => row.always || !isZeroAmount(row.rawAmount));
}

function deductionLines(amounts: PayslipPdfAmounts, currency: string): LineItem[] {
  const rows: LineItem[] = [
    {
      label: "Kontributi Punonjesi",
      amount: money(amounts.pensionEmployee, currency),
      rawAmount: amounts.pensionEmployee,
    },
    {
      label: "Kontributi Punedhenesi",
      amount: money(amounts.pensionEmployer, currency),
      rawAmount: amounts.pensionEmployer,
    },
    { label: "Tatimi ne page", amount: money(amounts.pitWithheld, currency), rawAmount: amounts.pitWithheld },
    {
      label: "Avans page",
      amount: money(amounts.salaryAdvanceDeduction, currency),
      rawAmount: amounts.salaryAdvanceDeduction,
    },
    { label: "Zbritje te tjera", amount: money(amounts.otherDeductions, currency), rawAmount: amounts.otherDeductions },
  ];
  if (!isZeroAmount(amounts.unpaidLeaveDeduction)) {
    rows.push({
      label: "Pushim pa page (zbritje)",
      amount: money(amounts.unpaidLeaveDeduction, currency),
      rawAmount: amounts.unpaidLeaveDeduction,
    });
  }
  return rows.filter((row) => !isZeroAmount(row.rawAmount));
}

function drawSectionHeader(page: PDFPage, title: string, y: number, fontBold: PDFFont): number {
  drawRect(page, MARGIN, y - 14, CONTENT_W, 18, NAVY_LIGHT);
  drawText(page, title, MARGIN + 8, y - 10, fontBold, 9, ACCENT);
  return y - 28;
}

function drawTableHeader(page: PDFPage, y: number, fontBold: PDFFont) {
  drawText(page, "Pershkrimi", MARGIN + 8, y, fontBold, 8, MUTED);
  drawText(page, "Shuma", PAGE_W - MARGIN - 80, y, fontBold, 8, MUTED);
  drawHLine(page, y - 6);
}

function drawTableRows(page: PDFPage, rows: LineItem[], y: number, font: PDFFont): number {
  let cy = y;
  for (const row of rows) {
    drawText(page, row.label, MARGIN + 8, cy, font, 9);
    const amt = row.amount;
    drawText(page, amt, PAGE_W - MARGIN - 8 - font.widthOfTextAtSize(amt, 9), cy, font, 9);
    cy -= 16;
  }
  return cy;
}

function drawLabelValueBlock(
  page: PDFPage,
  items: { label: string; value: string }[],
  x: number,
  yStart: number,
  font: PDFFont,
  fontBold: PDFFont,
): number {
  let y = yStart;
  for (const item of items) {
    drawText(page, item.label, x, y, fontBold, 7.5, MUTED);
    drawText(page, item.value, x, y - 11, font, 9);
    y -= 28;
  }
  return y;
}

/** Build a single professional A4 payslip. */
export async function buildProfessionalPayslipPdf(input: PayslipPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(txt(`Fletepagese — ${input.employee.fullName} — ${input.period.periodLabel}`));
  pdf.setAuthor(txt(input.company.displayName));
  pdf.setSubject(txt("Fletepagese"));

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const companyLogo = await embedCompanyLogo(pdf, input.logo);
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  drawRect(page, 0, PAGE_H - 72, PAGE_W, 72, NAVY);
  const companyTextX = companyLogo
    ? drawCompanyLogoPlate(page, companyLogo, { x: 16, top: PAGE_H - 7 }) + 10
    : MARGIN;
  const companyTextWidth = PAGE_W - companyTextX - MARGIN - 120;
  drawText(
    page,
    fitText(input.company.displayName.toUpperCase(), fontBold, 16, companyTextWidth),
    companyTextX,
    PAGE_H - 38,
    fontBold,
    16,
    rgb(1, 1, 1),
  );
  const subLine = [input.company.addressLine, input.company.cityLine].filter(Boolean).join(" · ");
  if (subLine) {
    drawText(page, fitText(subLine, font, 8, companyTextWidth), companyTextX, PAGE_H - 56, font, 8, rgb(0.85, 0.88, 0.92));
  }

  drawText(page, "FLETEPAGESE", PAGE_W - MARGIN - 100, PAGE_H - 38, fontBold, 11, rgb(1, 1, 1));
  drawText(page, input.period.periodLabel, PAGE_W - MARGIN - 100, PAGE_H - 54, font, 9, rgb(0.85, 0.88, 0.92));

  let y = PAGE_H - 100;

  drawText(page, `Referenca: ${input.documentRef}`, MARGIN, y, font, 8, MUTED);
  drawText(page, `Data e pageses: ${input.period.payDateLabel}`, MARGIN + 200, y, font, 8, MUTED);
  drawText(page, `Monedha: ${input.period.currency}`, PAGE_W - MARGIN - 100, y, font, 8, MUTED);
  y -= 24;
  drawHLine(page, y);
  y -= 20;

  const colW = CONTENT_W / 2 - 8;
  drawText(page, "PUNONJESI", MARGIN, y, fontBold, 8, ACCENT);
  drawText(page, "INFORMACIONI BANKAR", MARGIN + colW + 16, y, fontBold, 8, ACCENT);
  y -= 16;

  const empItems = [
    { label: "Emri i plote", value: input.employee.fullName },
    { label: "Numri personal", value: input.employee.personalId },
    { label: "Pozita", value: input.employee.jobTitle ?? "—" },
  ];

  const bankItems = [
    { label: "Banka", value: input.employee.bankName ?? "—" },
    { label: "Llogaria", value: input.employee.iban ?? "—" },
    { label: "Perfituesi", value: input.employee.accountHolder ?? input.employee.fullName },
  ];
  if (input.employee.bicSwift) {
    bankItems.push({ label: "Kodi bankes", value: input.employee.bicSwift });
  }

  const yAfterEmp = drawLabelValueBlock(page, empItems, MARGIN, y, font, fontBold);
  const yAfterBank = drawLabelValueBlock(page, bankItems, MARGIN + colW + 16, y, font, fontBold);
  y = Math.min(yAfterEmp, yAfterBank) - 8;
  drawHLine(page, y);
  y -= 18;

  const { amounts, period } = input;
  const currency = period.currency;

  y = drawSectionHeader(page, "TE ARDHURAT", y, fontBold);
  drawTableHeader(page, y, fontBold);
  y -= 18;
  y = drawTableRows(page, earningLines(amounts, currency), y, font);
  drawHLine(page, y + 4);
  drawText(page, "Bruto totale", MARGIN + 8, y - 8, fontBold, 9);
  const grossStr = money(amounts.grossSalary, currency);
  drawText(page, grossStr, PAGE_W - MARGIN - 8 - fontBold.widthOfTextAtSize(grossStr, 9), y - 8, fontBold, 9);
  y -= 28;

  y = drawSectionHeader(page, "ZBRITJET", y, fontBold);
  drawTableHeader(page, y, fontBold);
  y -= 18;
  y = drawTableRows(page, deductionLines(amounts, currency), y, font);
  y -= 8;

  const netBoxH = 36;
  drawRect(page, MARGIN, y - netBoxH, CONTENT_W, netBoxH, NET_BG);
  page.drawRectangle({
    x: MARGIN,
    y: y - netBoxH,
    width: CONTENT_W,
    height: netBoxH,
    borderColor: NET_BORDER,
    borderWidth: 1,
  });
  drawText(page, "NETO PER PAGESE", MARGIN + 12, y - 22, fontBold, 10, NET_BORDER);
  const netStr = money(amounts.netPay, currency);
  drawText(
    page,
    netStr,
    PAGE_W - MARGIN - 12 - fontBold.widthOfTextAtSize(netStr, 14),
    y - 24,
    fontBold,
    14,
    NET_BORDER,
  );
  y -= netBoxH + 16;

  drawHLine(page, y);
  y -= 14;
  const legalBits = [
    input.company.legalName !== input.company.displayName ? input.company.legalName : null,
    input.company.fiscalNumber ? `NUI: ${input.company.fiscalNumber}` : null,
    input.company.businessNumber ? `NRB: ${input.company.businessNumber}` : null,
    input.company.phone ? `Tel: ${input.company.phone}` : null,
    input.company.email ? input.company.email : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (legalBits) {
    drawText(page, legalBits, MARGIN, y, font, 7, MUTED);
    y -= 12;
  }
  drawText(
    page,
    "Dokument konfidencial — vetem per punonjesin dhe punedhenesin.",
    MARGIN,
    y,
    font,
    7,
    MUTED,
  );

  return pdf.save();
}

/** Merge individual payslip PDFs into one document for mass printing. */
export async function mergePayslipPdfs(buffers: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  merged.setTitle(txt("Fletepagesat"));
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  return merged.save();
}
