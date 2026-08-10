import { PDFDocument, type PDFPage } from "pdf-lib";
import type { CompanyLogoAsset } from "@/modules/company-branding/company-logo";
import { embedCompanyLogo } from "@/modules/company-branding/pdf-logo-branding";
import { KOSOVO_MONTHLY_PIT_BANDS } from "@/modules/payroll/constants/kosovo-payroll";
import {
  embedPayrollPdfFonts,
  type PayrollPdfFonts,
} from "@/modules/payroll/pdf/payroll-pdf-fonts";
import { drawPagaproFooter } from "@/modules/payroll/pdf/payroll-pdf-footer";
import {
  drawRoundedRect,
  PAGE,
  PP,
  RULE,
} from "@/modules/payroll/pdf/payroll-pdf-tokens";
import {
  drawText,
  drawTextRight,
  fitText,
  measureText,
  wrapText,
  type TextStyle,
} from "@/modules/payroll/pdf/payroll-pdf-text";

const PAGE_W = PAGE.a4Portrait.width;
const PAGE_H = PAGE.a4Portrait.height;
/** 12mm, per the design. */
const MARGIN = 34;
const CONTENT_W = PAGE_W - MARGIN * 2;

export interface PayslipPdfCompany {
  displayName: string;
  legalName: string;
  addressLine: string;
  cityLine: string;
  /** Kept on the interface for contracts; the payslip prints only the NUI. */
  fiscalNumber: string | null;
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
  /** Hour counts used as row qualifiers; absent ones simply do not print. */
  overtimeHours?: string;
  weekendHours?: string;
  holidayHours?: string;
  nightHours?: string;
  paidLeaveHours?: string;
  sickLeaveHours?: string;
}

/** The PRANIA tile. Anything genuinely unknown is left null and prints as “—”. */
export interface PayslipPdfAttendance {
  workingDaysInPeriod: number | null;
  daysWorked: number | null;
  annualLeaveRemainingDays: string | null;
}

/** The KUMULATIVE tile. Null when the employee has no closed months this year. */
export interface PayslipPdfYtd {
  grossSalary: string;
  netPay: string;
  rangeLabel: string;
}

export interface PayslipPdfInput {
  company: PayslipPdfCompany;
  employee: PayslipPdfEmployee;
  period: PayslipPdfPeriod;
  amounts: PayslipPdfAmounts;
  documentRef: string;
  logo?: CompanyLogoAsset | null;
  attendance?: PayslipPdfAttendance | null;
  ytd?: PayslipPdfYtd | null;
  generatedAt?: Date;
}

function num(value: string | null | undefined): number {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Plain grouped figure — the currency sits in the column header or the band. */
function amount(value: string): string {
  return num(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isZero(value: string | null | undefined): boolean {
  return num(value) === 0;
}

/** Trims a trailing “.00” so “176 orë” does not read “176.00 orë”. */
function tidyNumber(value: string | null | undefined): string {
  const n = num(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** “0% deri 250 € · 8% për 250–450 € · 10% mbi 450 €”, straight from the constant. */
function pitBandSentence(): string {
  const parts: string[] = [];
  let lower = 0;

  for (const [index, band] of KOSOVO_MONTHLY_PIT_BANDS.entries()) {
    const rate = Number(band.rate) * 100;
    const upper = Number(band.cumulativeUpperInclusive);
    const isLast = index === KOSOVO_MONTHLY_PIT_BANDS.length - 1;

    if (isLast) parts.push(`${rate}% mbi ${lower} €`);
    else if (index === 0) parts.push(`${rate}% deri ${upper} €`);
    else parts.push(`${rate}% për ${lower}–${upper} €`);

    lower = upper;
  }
  return parts.join(" · ");
}

interface LedgerRow {
  label: string;
  qualifier?: string | null;
  value: string;
  negative?: boolean;
  dim?: boolean;
}

function earningRows(a: PayslipPdfAmounts): LedgerRow[] {
  const rows: LedgerRow[] = [
    {
      label: "Paga e rregullt",
      qualifier: `${tidyNumber(a.actualRegularHours)} orë × ${amount(a.hourlyRate)}/orë`,
      value: a.regularPay,
    },
    {
      label: "Orë shtesë",
      qualifier: a.overtimeHours ? `${tidyNumber(a.overtimeHours)} orë` : null,
      value: a.overtimeAmount,
    },
    {
      label: "Pushim i paguar",
      qualifier: a.paidLeaveHours ? `${tidyNumber(a.paidLeaveHours)} orë` : null,
      value: a.paidLeavePay,
    },
    {
      label: "Pushim mjekësor",
      qualifier: a.sickLeaveHours ? `${tidyNumber(a.sickLeaveHours)} orë` : null,
      value: a.sickLeavePay,
    },
    {
      label: "Fundjavë",
      qualifier: a.weekendHours ? `${tidyNumber(a.weekendHours)} orë` : null,
      value: a.weekendAmount,
    },
    {
      label: "Festa",
      qualifier: a.holidayHours ? `${tidyNumber(a.holidayHours)} orë` : null,
      value: a.holidayAmount,
    },
    {
      label: "Punë nate",
      qualifier: a.nightHours ? `${tidyNumber(a.nightHours)} orë` : null,
      value: a.nightAmount,
    },
    { label: "Bonuse", value: a.bonuses },
  ];

  // Regular pay always shows, even at zero — its absence would read as an error.
  return rows.filter((row, index) => index === 0 || !isZero(row.value));
}

function deductionRows(a: PayslipPdfAmounts): LedgerRow[] {
  const gross = num(a.grossSalary);
  const pensionPct = gross > 0 ? (num(a.pensionEmployee) / gross) * 100 : null;

  const rows: LedgerRow[] = [
    {
      label: "Kontributi Punonjësi",
      // Derived from the frozen figures, never a config literal.
      qualifier: pensionPct != null ? `${pensionPct.toFixed(pensionPct % 1 === 0 ? 0 : 1)}%` : null,
      value: a.pensionEmployee,
      negative: true,
    },
    { label: "Tatimi në pagë", value: a.pitWithheld, negative: true },
    { label: "Avans pagë", value: a.salaryAdvanceDeduction, negative: true },
    { label: "Pushim pa pagë", value: a.unpaidLeaveDeduction, negative: true },
  ];

  const shown = rows.filter((row) => !isZero(row.value));
  // The design keeps this row visible at zero so the reader sees it was considered.
  shown.push({
    label: "Zbritje të tjera",
    value: a.otherDeductions,
    negative: !isZero(a.otherDeductions),
    dim: isZero(a.otherDeductions),
  });
  return shown;
}

function deductionTotal(a: PayslipPdfAmounts): number {
  return (
    num(a.pensionEmployee) +
    num(a.pitWithheld) +
    num(a.salaryAdvanceDeduction) +
    num(a.unpaidLeaveDeduction) +
    num(a.otherDeductions)
  );
}

/** Navy band with the client's logo, their name, and the document identity. */
function drawHeaderBand(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayslipPdfInput,
  logo: Awaited<ReturnType<typeof embedCompanyLogo>>,
  top: number,
): number {
  const h = 62;
  const y = top - h;
  drawRoundedRect(page, { x: MARGIN, y, w: CONTENT_W, h, r: 12, color: PP.navy });

  const padX = 20;
  let textX = MARGIN + padX;

  if (logo) {
    // Contained inside a 46pt square tile, never cropped.
    const slot = 46;
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

  // Reserve the right-hand identity block before measuring the company name.
  const pillLabel = input.period.periodLabel;
  const pillStyle: TextStyle = {
    font: fonts.sansBold,
    size: 7.5,
    color: PP.white,
    sanitize: fonts.sanitize.sansBold,
  };
  const pillW = measureText(pillLabel, pillStyle) + 12 * 2 + 5 + 6;
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
  const rightBlockW =
    Math.max(measureText("Fletëpagesa", titleStyle), measureText(input.documentRef, refStyle)) +
    14 +
    pillW;

  const nameW = CONTENT_W - (textX - MARGIN) - padX - rightBlockW - 16;
  const nameStyle: TextStyle = {
    font: fonts.sansBold,
    size: 12.5,
    color: PP.white,
    sanitize: fonts.sanitize.sansBold,
  };
  drawText(page, fitText(input.company.displayName, nameStyle, nameW), textX, y + h / 2 + 2, nameStyle);

  const subStyle: TextStyle = {
    font: fonts.sans,
    size: 7.5,
    color: PP.onNavy,
    sanitize: fonts.sanitize.sans,
  };
  const sub = [
    input.company.addressLine,
    input.company.fiscalNumber ? `NUI ${input.company.fiscalNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (sub) drawText(page, fitText(sub, subStyle, nameW), textX, y + h / 2 - 10, subStyle);

  // Right block.
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
  drawTextRight(page, "Fletëpagesa", identityRight, y + h / 2 + 2, titleStyle);
  drawTextRight(page, input.documentRef, identityRight, y + h / 2 - 10, refStyle);

  return y - 16;
}

function drawMetaRow(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayslipPdfInput,
  top: number,
): number {
  const label: TextStyle = {
    font: fonts.sans,
    size: 7.5,
    color: PP.muted,
    sanitize: fonts.sanitize.sans,
  };
  const strong: TextStyle = {
    font: fonts.sansBold,
    size: 7.5,
    color: PP.text,
    sanitize: fonts.sanitize.sansBold,
  };

  const y = top - 8;
  drawText(page, "Data e pagesës: ", MARGIN, y, label);
  drawText(
    page,
    input.period.payDateLabel,
    MARGIN + measureText("Data e pagesës: ", label),
    y,
    strong,
  );

  const midX = MARGIN + CONTENT_W * 0.42;
  drawText(page, "Monedha: ", midX, y, label);
  drawText(page, input.period.currency, midX + measureText("Monedha: ", label), y, strong);

  drawTextRight(
    page,
    "Dokument konfidencial — vetëm për punonjësin dhe punëdhënësin",
    MARGIN + CONTENT_W,
    y,
    label,
  );

  const ruleY = y - 12;
  page.drawLine({
    start: { x: MARGIN, y: ruleY },
    end: { x: MARGIN + CONTENT_W, y: ruleY },
    thickness: RULE.thin,
    color: PP.line,
  });
  return ruleY;
}

function drawPartyColumns(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayslipPdfInput,
  top: number,
): number {
  const colW = (CONTENT_W - 26) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 26;

  const eyebrow: TextStyle = {
    font: fonts.monoBold,
    size: 7,
    color: PP.blue,
    tracking: 0.12,
    sanitize: fonts.sanitize.monoBold,
  };
  const key: TextStyle = {
    font: fonts.sans,
    size: 8.5,
    color: PP.muted,
    sanitize: fonts.sanitize.sans,
  };
  const val: TextStyle = {
    font: fonts.sansBold,
    size: 8.5,
    color: PP.text,
    sanitize: fonts.sanitize.sansBold,
  };
  const monoVal: TextStyle = {
    font: fonts.mono,
    size: 8.5,
    color: PP.text,
    sanitize: fonts.sanitize.mono,
  };

  let y = top - 16;
  drawText(page, "PUNONJËSI", leftX, y, eyebrow);
  drawText(page, "INFORMACIONI BANKAR", rightX, y, eyebrow);

  y -= 17;
  const nameStyle: TextStyle = {
    font: fonts.sansBold,
    size: 13,
    color: PP.text,
    sanitize: fonts.sanitize.sansBold,
  };
  drawText(page, fitText(input.employee.fullName, nameStyle, colW), leftX, y, nameStyle);

  const keyW = 74;
  const rowGap = 13;

  let leftY = y - 16;
  const leftRows: Array<[string, string, TextStyle]> = [
    ["Numri personal", input.employee.personalId, monoVal],
    ["Pozita", input.employee.jobTitle ?? "—", val],
  ];
  for (const [k, v, style] of leftRows) {
    drawText(page, k, leftX, leftY, key);
    drawText(page, fitText(v, style, colW - keyW), leftX + keyW, leftY, style);
    leftY -= rowGap;
  }

  let rightY = y;
  const rightRows: Array<[string, string, TextStyle]> = [
    ["Banka", input.employee.bankName ?? "—", val],
    ["Llogaria", input.employee.iban ?? "—", monoVal],
    ["Përfituesi", input.employee.accountHolder ?? input.employee.fullName, val],
  ];
  for (const [k, v, style] of rightRows) {
    drawText(page, k, rightX, rightY, key);
    drawText(page, fitText(v, style, colW - keyW), rightX + keyW, rightY, style);
    rightY -= rowGap;
  }

  const bottom = Math.min(leftY, rightY) - 4;
  page.drawLine({
    start: { x: MARGIN, y: bottom },
    end: { x: MARGIN + CONTENT_W, y: bottom },
    thickness: RULE.thin,
    color: PP.line,
  });
  return bottom;
}

/** One ledger column — earnings or deductions — returning its bottom edge. */
function drawLedger(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  opts: {
    x: number;
    w: number;
    top: number;
    title: string;
    accent: boolean;
    rows: LedgerRow[];
    totalLabel: string;
    totalValue: string;
    totalNegative?: boolean;
  },
): number {
  const { x, w, top } = opts;

  const chipH = 19;
  drawRoundedRect(page, {
    x,
    y: top - chipH,
    w,
    h: chipH,
    r: 8,
    color: opts.accent ? PP.blueWash : PP.wash,
  });
  page.drawCircle({
    x: x + 10 + 3,
    y: top - chipH / 2,
    size: 3,
    color: opts.accent ? PP.blue : PP.muted,
  });
  drawText(page, opts.title, x + 10 + 6 + 8, top - chipH / 2 - 2.4, {
    font: fonts.monoBold,
    size: 7,
    color: opts.accent ? PP.blue : PP.muted,
    tracking: 0.12,
    sanitize: fonts.sanitize.monoBold,
  });

  let y = top - chipH - 14;
  const labelStyle: TextStyle = {
    font: fonts.sans,
    size: 8.5,
    color: PP.text,
    sanitize: fonts.sanitize.sans,
  };
  const qualStyle: TextStyle = {
    font: fonts.sans,
    size: 7.5,
    color: PP.faint,
    sanitize: fonts.sanitize.sans,
  };

  for (const row of opts.rows) {
    const label = { ...labelStyle, color: row.dim ? PP.faint : PP.text };
    drawText(page, row.label, x, y, label);

    if (row.qualifier) {
      const at = x + measureText(row.label, label) + 4;
      drawText(page, `(${row.qualifier})`, at, y, qualStyle);
    }

    const shown = `${row.negative ? "−" : ""}${amount(row.value)}`;
    drawTextRight(page, shown, x + w, y, {
      font: fonts.mono,
      size: 8.5,
      color: row.dim ? PP.faint : PP.text,
      sanitize: fonts.sanitize.mono,
    });

    const sepY = y - 6;
    page.drawLine({
      start: { x, y: sepY },
      end: { x: x + w, y: sepY },
      thickness: RULE.hair,
      color: PP.hairline,
    });
    y -= 17;
  }

  y -= 3;
  const totalStyle: TextStyle = {
    font: fonts.sansBold,
    size: 8.5,
    color: PP.text,
    sanitize: fonts.sanitize.sansBold,
  };
  drawText(page, opts.totalLabel, x, y, totalStyle);
  drawTextRight(page, `${opts.totalNegative ? "−" : ""}${opts.totalValue}`, x + w, y, {
    font: fonts.monoBold,
    size: 8.5,
    color: PP.text,
    sanitize: fonts.sanitize.monoBold,
  });

  return y - 6;
}

function drawNetBand(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayslipPdfInput,
  top: number,
): number {
  const h = 52;
  const y = top - h;
  const amountText = amount(input.amounts.netPay);

  const amountStyle: TextStyle = {
    font: fonts.monoBold,
    size: 23,
    color: PP.white,
    sanitize: fonts.sanitize.monoBold,
  };
  const euroStyle: TextStyle = {
    font: fonts.sansBold,
    size: 13,
    color: PP.white,
    sanitize: fonts.sanitize.sansBold,
  };
  const rightPanelW = measureText(amountText, amountStyle) + measureText("€", euroStyle) + 10 + 22 * 2;

  // Navy body first, then the blue panel painted over its right end. Both share
  // the band radius, so the seam between them stays square.
  drawRoundedRect(page, { x: MARGIN, y, w: CONTENT_W, h, r: 12, color: PP.navy });
  drawRoundedRect(page, {
    x: MARGIN + CONTENT_W - rightPanelW,
    y,
    w: rightPanelW,
    h,
    r: 12,
    color: PP.blue,
  });
  page.drawRectangle({
    x: MARGIN + CONTENT_W - rightPanelW,
    y,
    width: 12,
    height: h,
    color: PP.blue,
  });

  drawText(page, "NETO PËR PAGESË", MARGIN + 18, y + h - 20, {
    font: fonts.monoBold,
    size: 7,
    color: PP.onNavy,
    tracking: 0.12,
    sanitize: fonts.sanitize.monoBold,
  });

  const sub = [
    `Transferuar më ${input.period.payDateLabel}`,
    input.employee.iban ? input.employee.iban : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const subStyle: TextStyle = {
    font: fonts.sans,
    size: 8,
    color: PP.onNavy,
    sanitize: fonts.sanitize.sans,
  };
  drawText(
    page,
    fitText(sub, subStyle, CONTENT_W - rightPanelW - 36),
    MARGIN + 18,
    y + h - 34,
    subStyle,
  );

  const amountRight = MARGIN + CONTENT_W - 22;
  drawTextRight(page, amountText, amountRight, y + h / 2 - 8, amountStyle);
  drawTextRight(
    page,
    "€",
    amountRight - measureText(amountText, amountStyle) - 10,
    y + h / 2 - 4,
    euroStyle,
  );

  return y - 18;
}

function drawInfoTiles(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayslipPdfInput,
  top: number,
): number {
  const gap = 14;
  const tileW = (CONTENT_W - gap * 2) / 3;
  const h = 56;
  const y = top - h;

  const eyebrow: TextStyle = {
    font: fonts.mono,
    size: 6.5,
    color: PP.faint,
    tracking: 0.12,
    sanitize: fonts.sanitize.mono,
  };
  const key: TextStyle = {
    font: fonts.sans,
    size: 8,
    color: PP.muted,
    sanitize: fonts.sanitize.sans,
  };
  const val: TextStyle = {
    font: fonts.monoBold,
    size: 8,
    color: PP.text,
    sanitize: fonts.sanitize.monoBold,
  };
  const strongKey: TextStyle = { ...key, font: fonts.sansBold, color: PP.text };

  const attendance = input.attendance;
  const worked =
    attendance?.daysWorked != null && attendance.workingDaysInPeriod != null
      ? `${attendance.daysWorked} / ${attendance.workingDaysInPeriod}`
      : "—";
  const balance =
    attendance?.annualLeaveRemainingDays != null
      ? `${tidyNumber(attendance.annualLeaveRemainingDays)} ditë`
      : "—";

  const employerCost = num(input.amounts.grossSalary) + num(input.amounts.pensionEmployer);

  const tiles: Array<{ title: string; rows: Array<[string, string, boolean]> }> = [
    {
      title: "PRANIA",
      rows: [
        ["Ditë të punuara", worked, false],
        ["Bilanci i pushimit", balance, false],
      ],
    },
    {
      title: "KOSTOJA E PUNËDHËNËSIT",
      rows: [
        ["Kontributi Punëdhënësi", amount(input.amounts.pensionEmployer), false],
        ["Kosto totale", amount(employerCost.toFixed(2)), true],
      ],
    },
    {
      title: input.ytd ? `KUMULATIVE ${input.ytd.rangeLabel}` : `KUMULATIVE ${input.period.year}`,
      rows: input.ytd
        ? [
            ["Bruto", amount(input.ytd.grossSalary), false],
            ["Neto", amount(input.ytd.netPay), true],
          ]
        : [
            ["Bruto", "—", false],
            ["Neto", "—", true],
          ],
    },
  ];

  for (const [index, tile] of tiles.entries()) {
    const x = MARGIN + index * (tileW + gap);
    drawRoundedRect(page, { x, y, w: tileW, h, r: 10, color: PP.wash });
    drawText(page, tile.title, x + 14, y + h - 16, eyebrow);

    let rowY = y + h - 32;
    for (const [k, v, strong] of tile.rows) {
      const keyStyle = strong ? strongKey : key;
      drawText(page, fitText(k, keyStyle, tileW - 28 - 46), x + 14, rowY, keyStyle);
      drawTextRight(page, v, x + tileW - 14, rowY, val);
      rowY -= 13;
    }
  }

  return y - 16;
}

function drawFootnote(
  page: PDFPage,
  fonts: PayrollPdfFonts,
  input: PayslipPdfInput,
  top: number,
): void {
  const taxable = num(input.amounts.grossSalary) - num(input.amounts.pensionEmployee);
  const body: TextStyle = {
    font: fonts.sans,
    size: 7.5,
    color: PP.muted,
    sanitize: fonts.sanitize.sans,
  };
  const lead: TextStyle = {
    font: fonts.sansBold,
    size: 7.5,
    color: PP.text,
    sanitize: fonts.sanitize.sansBold,
  };

  const leadText = "Baza e tatimit";
  const rest = ` ${amount(taxable.toFixed(2))} € (bruto minus kontributi pensional). Shkallët progresive: ${pitBandSentence()}. Ky dokument gjenerohet automatikisht nga PagaPRO dhe është i vlefshëm pa nënshkrim. Për kundërshtime, kontaktoni burimet njerëzore brenda 8 ditësh nga data e pagesës.`;

  const innerW = CONTENT_W - 28;
  const firstLineW = innerW - measureText(leadText, lead);
  const words = rest.trim().split(/\s+/);

  // Fill the first line beside the bold lead-in, then wrap the remainder.
  let firstLine = "";
  let consumed = 0;
  for (const word of words) {
    const candidate = firstLine ? `${firstLine} ${word}` : word;
    if (measureText(` ${candidate}`, body) > firstLineW) break;
    firstLine = candidate;
    consumed += 1;
  }
  const remaining = words.slice(consumed).join(" ");
  const lines = remaining ? wrapText(remaining, body, innerW) : [];

  const lineH = 11;
  const h = 22 + (1 + lines.length) * lineH;
  const y = top - h;
  drawRoundedRect(page, { x: MARGIN, y, w: CONTENT_W, h, r: 10, color: PP.wash });

  let lineY = y + h - 15;
  drawText(page, leadText, MARGIN + 14, lineY, lead);
  drawText(page, ` ${firstLine}`, MARGIN + 14 + measureText(leadText, lead), lineY, body);
  for (const line of lines) {
    lineY -= lineH;
    drawText(page, line, MARGIN + 14, lineY, body);
  }
}

/** Build a single A4 payslip. */
export async function buildProfessionalPayslipPdf(input: PayslipPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fletëpagesa — ${input.employee.fullName} — ${input.period.periodLabel}`);
  pdf.setAuthor(input.company.displayName);
  pdf.setSubject("Fletëpagesa");

  const fonts = await embedPayrollPdfFonts(pdf);
  const logo = await embedCompanyLogo(pdf, input.logo);
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  let y = drawHeaderBand(page, fonts, input, logo, PAGE_H - MARGIN);
  y = drawMetaRow(page, fonts, input, y);
  y = drawPartyColumns(page, fonts, input, y);

  const colGap = 22;
  const colW = (CONTENT_W - colGap) / 2;
  const ledgerTop = y - 16;

  const earnBottom = drawLedger(page, fonts, {
    x: MARGIN,
    w: colW,
    top: ledgerTop,
    title: "TË ARDHURAT",
    accent: true,
    rows: earningRows(input.amounts),
    totalLabel: "Bruto totale",
    totalValue: amount(input.amounts.grossSalary),
  });

  const dedBottom = drawLedger(page, fonts, {
    x: MARGIN + colW + colGap,
    w: colW,
    top: ledgerTop,
    title: "ZBRITJET",
    accent: false,
    rows: deductionRows(input.amounts),
    totalLabel: "Totali i zbritjeve",
    totalValue: amount(deductionTotal(input.amounts).toFixed(2)),
    totalNegative: deductionTotal(input.amounts) > 0,
  });

  y = Math.min(earnBottom, dedBottom) - 12;
  y = drawNetBand(page, fonts, input, y);
  y = drawInfoTiles(page, fonts, input, y);
  drawFootnote(page, fonts, input, y);

  drawPagaproFooter(page, fonts, {
    pageWidth: PAGE_W,
    margin: MARGIN,
    companyLine: [
      input.company.legalName,
      input.company.fiscalNumber ? `NUI ${input.company.fiscalNumber}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    generatedAt: input.generatedAt,
    pageNumber: 1,
    pageCount: 1,
  });

  return pdf.save();
}

/** Merge individual payslip PDFs into one document for mass printing. */
export async function mergePayslipPdfs(buffers: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  merged.setTitle("Fletëpagesat");
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  return merged.save();
}
