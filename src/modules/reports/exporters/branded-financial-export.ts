import ExcelJS from "exceljs";
import { buildLibriPagaveRows, type LibriPagaveEntryInput } from "./libri-pagave-rows";

export type BrandedFinancialExportEntry = LibriPagaveEntryInput;

export async function generateBrandedFinancialWorkbookBuffer(params: {
  payroll: { year: number; month: number; monthLabel: string };
  companyLabel: string;
  totals: {
    gross: string;
    net: string;
    employerTotalCost: string;
    taxableIncome: string;
    pitWithheld: string;
    pensionEmployee: string;
    pensionEmployer: string;
  };
  entries: BrandedFinancialExportEntry[];
}): Promise<Buffer> {
  const { payroll, companyLabel, totals, entries } = params;
  const rows = buildLibriPagaveRows(entries);
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Libri i Pagave");

  // Enable gridlines explicitly
  ws.views = [{ showGridLines: true }];

  // 1. Add Title block
  ws.mergeCells("A2:Y2");
  const titleCell = ws.getCell("A2");
  titleCell.value = "PagaPRO · Libri i Pagave (Pagat per ATK)";
  titleCell.font = { name: "Inter", size: 14, bold: true, color: { argb: "FF0B1220" } };
  titleCell.alignment = { vertical: "middle" };

  ws.getCell("A3").value = "Kompania:";
  ws.getCell("A3").font = { name: "Inter", size: 9, bold: true, color: { argb: "FF6B7280" } };
  ws.getCell("B3").value = companyLabel;
  ws.getCell("B3").font = { name: "Inter", size: 9, bold: true };

  ws.getCell("E3").value = "Periudha:";
  ws.getCell("E3").font = { name: "Inter", size: 9, bold: true, color: { argb: "FF6B7280" } };
  ws.getCell("F3").value = payroll.monthLabel;
  ws.getCell("F3").font = { name: "Inter", size: 9, bold: true };

  ws.getCell("I3").value = "Gjeneruar më:";
  ws.getCell("I3").font = { name: "Inter", size: 9, bold: true, color: { argb: "FF6B7280" } };
  const timestamp = new Date().toLocaleString("sq-XK");
  ws.getCell("J3").value = timestamp;
  ws.getCell("J3").font = { name: "Inter", size: 9 };

  // Set rows heights
  ws.getRow(2).height = 25;
  ws.getRow(3).height = 18;
  ws.getRow(4).height = 10; // Empty spacer row
  ws.getRow(5).height = 90; // Table header row

  // 2. Table Headers config matching the screenshot
  const headers = [
    { col: "A", header: "IDP\n(1)", type: "string", width: 5 },
    { col: "B", header: "Nr.\n(2)", type: "string", width: 5 },
    { col: "C", header: "Emri dhe mbiemri\n(3)", type: "string", width: 18 },
    { col: "D", header: "Sektori\n(4)", type: "string", width: 12 },
    { col: "E", header: "Për pun. të dytë shkr. 2\n(5)", type: "string", width: 5 },
    { col: "F", header: "Çmimi për Orë të rregullta\n(6)", type: "number", width: 7 },
    { col: "G", header: "Totali i Orëve të rregullta të realizuara\n(7)", type: "number", width: 7 },
    { col: "H", header: "Paga Bruto për orë të rregullta 6 x 7\n(8)", type: "number", width: 9 },
    { col: "I", header: "J - Jashtë orarit dhe Natën\n(9)", type: "number", width: 8 },
    { col: "J", header: "K - Kujdestari\n(10)", type: "number", width: 8 },
    { col: "K", header: "F - Festave/Fundjav.\n(11)", type: "number", width: 8 },
    { col: "L", header: "Çmimi për Orë me rritje 30% J\n(12)", type: "number", width: 8 },
    { col: "M", header: "Çmimi për Orë me rritje 20% K\n(13)", type: "number", width: 8 },
    { col: "N", header: "Çmimi për Orë me rritje 50% F\n(14)", type: "number", width: 8 },
    { col: "O", header: "Paga Bruto Shtesë 9 x 12 + 10 x 13 + 11 x 14\n(15)", type: "number", width: 10 },
    { col: "P", header: "TOTALI Paga Bruto 8 + 15\n(16)", type: "number", width: 10 },
    { col: "Q", header: "Punëtori %\n(17)", type: "percent", width: 5 },
    { col: "R", header: "Punëdhënësi %\n(18)", type: "percent", width: 5 },
    { col: "S", header: "Punëtori 16 x 17 Euro (€)\n(19)", type: "number", width: 8 },
    { col: "T", header: "Punëdhënësi 16 x 18 Euro (€)\n(20)", type: "number", width: 8 },
    { col: "U", header: "Paga që tatohet 16 - 19 Euro (€)\n(21)", type: "number", width: 9 },
    { col: "V", header: "TATIMI Euro (€)\n(22)", type: "number", width: 8 },
    { col: "W", header: "PAGA NETO 21 - 22 Euro (€)\n(23)", type: "number", width: 9 },
    { col: "X", header: "Avans Euro (€)\n(24)", type: "number", width: 7 },
    { col: "Y", header: "Paga Neto për pagesë 23 - 24 Euro (€)\n(25)", type: "number", width: 9 }
  ];

  // Set column widths explicitly
  headers.forEach((h, idx) => {
    ws.getColumn(idx + 1).width = h.width;
  });

  const headerRow = ws.getRow(5);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h.header;
    cell.font = { name: "Inter", size: 8, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B1220" } // Primary Navy
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true
    };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF2563EB" } }, // Accent blue
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } }
    };
  });

  // 3. Table Rows
  let currentRowNumber = 6;
  rows.forEach((r, entryIdx) => {
    const row = ws.getRow(currentRowNumber);
    row.height = 18;

    const isEven = entryIdx % 2 === 0;
    const rowBg = isEven ? "FFFFFFFF" : "FFF8FAFC"; // Alternating white/slate

    // Columns mapping — a frozen payroll book: every monetary cell holds the static
    // engine value (no embedded formulas, which would recompute to different numbers
    // on recalc since company premium/tax rates need not match the ATK form's fixed
    // 30/20/50% and bracket assumptions).
    const colValues: Record<string, ExcelJS.CellValue> = {
      A: r.idp, // IDP
      B: r.idp, // Nr.
      C: r.fullName, // Emri dhe mbiemri
      D: r.sektori, // Sektori
      E: r.isSecondary ? 2 : "",
      F: r.hourlyRate,
      G: r.regularHours,
      H: r.regularGross,
      I: r.overtimeNightHours,
      J: r.onCallHours, // Kujdestari
      K: r.holidayWeekendHours,
      L: r.overtimeNightRate,
      M: r.onCallRate,
      N: r.holidayWeekendRate,
      O: r.premiumPay,
      P: r.totalGross,
      Q: r.employeeTrustPercent,
      R: r.employerTrustPercent,
      S: r.employeeTrustAmount,
      T: r.employerTrustAmount,
      U: r.taxableIncome,
      V: r.taxAmount,
      W: r.netIncome,
      X: r.advance,
      Y: r.netToPay
    };

    headers.forEach((h, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = colValues[h.col];
      cell.font = { name: "Inter", size: 8 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowBg }
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } }
      };

      if (h.type === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (h.type === "percent") {
        cell.numFmt = "0.0%";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: (h.col === "E" || h.col === "A" || h.col === "B") ? "center" : "left" };
      }
    });

    currentRowNumber++;
  });

  // 4. Totals Row
  const totalRow = ws.getRow(currentRowNumber);
  totalRow.height = 20;
  totalRow.getCell(1).value = "TOTALI";
  totalRow.getCell(1).font = { name: "Inter", size: 8, bold: true, color: { argb: "FF111827" } };
  totalRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  totalRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EDF5" } // Highlighted light blue-slate
  };
  totalRow.getCell(1).border = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "double", color: { argb: "FF0B1220" } }
  };

  const startRow = 6;
  const endRow = currentRowNumber - 1;

  headers.forEach((h, colIdx) => {
    if (colIdx === 0) return; // Already written "TOTALI"
    const cell = totalRow.getCell(colIdx + 1);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EDF5" }
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "double", color: { argb: "FF0B1220" } } // standard accounting double underline
    };

    if (h.type === "number") {
      cell.value = { formula: `SUM(${h.col}${startRow}:${h.col}${endRow})` };
      cell.numFmt = "#,##0.00";
      cell.font = { name: "Inter", size: 8, bold: true, color: { argb: "FF111827" } };
      cell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      cell.value = "";
      cell.alignment = { vertical: "middle", horizontal: "left" };
    }
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
