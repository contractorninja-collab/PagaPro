import ExcelJS from "exceljs";
import type { BankPaymentRow, BankPaymentSheet } from "./bank-payment-rows";
import type { CompanyLogoAsset } from "@/modules/company-branding/company-logo";

/**
 * "Lista e pagave për ekzekutim" — the file finance uploads to the bank.
 *
 * Branding and palette follow branded-financial-export.ts so the two payroll
 * workbooks read as one family.
 *
 * The two rules this file exists to enforce:
 *
 *  1. The account number is written as TEXT. Excel keeps 15 significant digits,
 *     so a 16-digit Kosovo account entered as a number silently loses its last
 *     digit and renders as 1.23457E+15. That is a salary paid into an account
 *     that does not exist, with nothing on screen to suggest anything happened.
 *  2. The totals are built to disagree out loud. Paid + unpaid is checked
 *     against the period total, which arrives from a separate database
 *     aggregate — so a row this code loses shows up as a non-zero KONTROLL in
 *     the very file finance is holding, rather than as a person who quietly
 *     was not paid.
 */

const NAVY = "FF0B1220";
const ACCENT = "FF2563EB";
const WHITE = "FFFFFFFF";
const ZEBRA = "FFF8FAFC";
const MUTED = "FF6B7280";
const BORDER = "FFE5E7EB";
const BORDER_STRONG = "FFD1D5DB";
const TOTAL_FILL = "FFE8EDF5";
const DANGER = "FFB91C1C";
const DANGER_FILL = "FFFEF2F2";
const INK = "FF111827";

const FONT = "Inter";

const COLUMNS = [
  { key: "nr", header: "Nr.", width: 6 },
  { key: "firstName", header: "Emri", width: 20 },
  { key: "lastName", header: "Mbiemri", width: 22 },
  { key: "account", header: "Llogaria Bankare", width: 24 },
  { key: "net", header: "Paga Neto", width: 15 },
  { key: "note", header: "Shënim", width: 42 },
] as const;

const LAST_COL = "F";
const HEADER_ROW = 7;

function thinBorder(): ExcelJS.Borders {
  const side = { style: "thin" as const, color: { argb: BORDER } };
  return { top: side, left: side, bottom: side, right: side } as ExcelJS.Borders;
}

export interface BankListExportParams {
  sheet: BankPaymentSheet;
  companyLabel: string;
  periodLabel: string;
  statusLabel: string;
  /** From an independent DB aggregate — the whole point of the KONTROLL row. */
  periodNetTotal: string;
  currency: string;
  generatedAtLabel: string;
  downloadedByLabel: string;
  logo?: CompanyLogoAsset | null;
}

export async function generateBankListWorkbookBuffer(
  params: BankListExportParams,
): Promise<Buffer> {
  const { sheet } = params;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Lista e pagave për ekzekutim");

  if (params.logo) {
    const imageId = workbook.addImage({
      base64: `data:image/png;base64,${params.logo.bytes.toString("base64")}`,
      extension: "png",
    });
    const scale = Math.min(132 / params.logo.width, 60 / params.logo.height, 1);
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: params.logo.width * scale, height: params.logo.height * scale },
    });
  }
  ws.getRow(1).height = 48;

  COLUMNS.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });

  // Title
  ws.mergeCells(`A2:${LAST_COL}2`);
  const title = ws.getCell("A2");
  title.value = "Lista e pagave për ekzekutim";
  title.font = { name: FONT, size: 15, bold: true, color: { argb: NAVY } };
  title.alignment = { vertical: "middle" };
  ws.getRow(2).height = 26;

  // Meta block — company and period identify the file from a printed copy,
  // and the downloader's name makes a leaked copy traceable to a person.
  const meta: Array<[string, string, string, string]> = [
    ["A3", "Kompania:", "B3", params.companyLabel],
    ["A4", "Periudha:", "B4", params.periodLabel],
    ["D3", "Statusi:", "E3", params.statusLabel],
    ["D4", "Gjeneruar më:", "E4", params.generatedAtLabel],
    ["A5", "Shkarkuar nga:", "B5", params.downloadedByLabel],
  ];
  for (const [labelCell, label, valueCell, value] of meta) {
    ws.getCell(labelCell).value = label;
    ws.getCell(labelCell).font = { name: FONT, size: 9, bold: true, color: { argb: MUTED } };
    ws.getCell(valueCell).value = value;
    ws.getCell(valueCell).font = { name: FONT, size: 9, bold: true };
  }

  // Warning banner — only when something genuinely needs attention.
  ws.mergeCells(`A6:${LAST_COL}6`);
  const banner = ws.getCell("A6");
  if (sheet.blockedCount > 0) {
    banner.value = `KUJDES: ${sheet.blockedCount} punonjës nuk mund të paguhen — shihni bllokun e kuq më poshtë.`;
    banner.font = { name: FONT, size: 10, bold: true, color: { argb: DANGER } };
    banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DANGER_FILL } };
    banner.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(6).height = 20;
  } else {
    ws.getRow(6).height = 8;
  }

  // Header
  const headerRow = ws.getRow(HEADER_ROW);
  headerRow.height = 22;
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.key === "net" ? `${c.header} (${params.currency})` : c.header;
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: ACCENT } },
      top: { style: "thin", color: { argb: BORDER_STRONG } },
      left: { style: "thin", color: { argb: BORDER_STRONG } },
      right: { style: "thin", color: { argb: BORDER_STRONG } },
    };
  });

  let cursor = HEADER_ROW + 1;

  function writeRow(row: BankPaymentRow, zebraIndex: number, blocked: boolean) {
    const r = ws.getRow(cursor);
    r.height = 17;
    const bg = blocked ? DANGER_FILL : zebraIndex % 2 === 0 ? WHITE : ZEBRA;

    const values: Array<string | number> = [
      row.nr,
      row.firstName,
      row.lastName,
      row.accountNumber,
      row.netPay,
      row.note,
    ];

    COLUMNS.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      cell.value = values[i]!;
      cell.font = {
        name: FONT,
        size: 9,
        color: { argb: blocked ? DANGER : INK },
      };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = thinBorder();

      if (c.key === "net") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (c.key === "nr") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (c.key === "account") {
        // TEXT, always. See the header comment — this single line is the
        // difference between a payable account number and a corrupted one.
        cell.numFmt = "@";
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.font = { name: FONT, size: 9, bold: !blocked, color: { argb: blocked ? DANGER : INK } };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
    cursor += 1;
  }

  const payableStart = cursor;
  sheet.payable.forEach((row, i) => writeRow(row, i, false));
  const payableEnd = cursor - 1;
  const hasPayable = sheet.payable.length > 0;

  let blockedStart = 0;
  let blockedEnd = 0;
  if (sheet.blocked.length > 0) {
    // Separator + a heading, so the two blocks can never be read as one list.
    cursor += 1;
    ws.mergeCells(`A${cursor}:${LAST_COL}${cursor}`);
    const head = ws.getCell(`A${cursor}`);
    head.value = "NUK PAGUHEN KËTË MUAJ";
    head.font = { name: FONT, size: 10, bold: true, color: { argb: WHITE } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DANGER } };
    head.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(cursor).height = 20;
    cursor += 1;

    blockedStart = cursor;
    sheet.blocked.forEach((row, i) => writeRow(row, i, true));
    blockedEnd = cursor - 1;
  }

  // Totals. Live formulas, so they also catch anyone editing an amount later.
  cursor += 1;
  const netCol = "E";

  function totalRow(label: string, value: ExcelJS.CellValue, emphasis: boolean) {
    const r = ws.getRow(cursor);
    r.height = 19;
    ws.mergeCells(`A${cursor}:D${cursor}`);
    const labelCell = ws.getCell(`A${cursor}`);
    labelCell.value = label;
    labelCell.font = { name: FONT, size: 9, bold: true, color: { argb: INK } };
    labelCell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };

    const valueCell = r.getCell(5);
    valueCell.value = value;
    valueCell.numFmt = "#,##0.00";
    valueCell.font = { name: FONT, size: 9, bold: true, color: { argb: INK } };
    valueCell.alignment = { vertical: "middle", horizontal: "right" };

    for (const col of [1, 5, 6]) {
      const cell = r.getCell(col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
      cell.border = emphasis
        ? {
            top: { style: "thin", color: { argb: BORDER_STRONG } },
            bottom: { style: "double", color: { argb: NAVY } },
          }
        : { top: { style: "thin", color: { argb: BORDER_STRONG } } };
    }
    const written = cursor;
    cursor += 1;
    return written;
  }

  const payTotalRow = totalRow(
    "TOTALI PËR PAGESË",
    hasPayable ? { formula: `SUM(${netCol}${payableStart}:${netCol}${payableEnd})` } : 0,
    false,
  );
  const unpaidTotalRow = totalRow(
    "TOTALI I PAPAGUAR",
    blockedStart > 0 ? { formula: `SUM(${netCol}${blockedStart}:${netCol}${blockedEnd})` } : 0,
    false,
  );
  const periodTotalRow = totalRow(
    "TOTALI NETO I PERIUDHËS",
    Number(params.periodNetTotal),
    false,
  );

  // The check: paid + unpaid − period must be exactly zero. ROUND is load
  // bearing, not cosmetic — the two SUMs are float cells and a bare comparison
  // would trip on a 1e-13 residue.
  const checkRow = totalRow(
    "KONTROLL (duhet të jetë 0.00)",
    {
      formula: `ROUND(${netCol}${payTotalRow}+${netCol}${unpaidTotalRow}-${netCol}${periodTotalRow},2)`,
    },
    true,
  );
  ws.getCell(`${netCol}${checkRow}`).font = {
    name: FONT,
    size: 9,
    bold: true,
    color: { argb: DANGER },
  };

  ws.views = [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: true }];
  ws.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
