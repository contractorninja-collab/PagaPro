import ExcelJS from "exceljs";
import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";

export async function rowsToXlsxBuffer(params: {
  sheetName: string;
  columns: ReportColumnDef[];
  rows: ReportRow[];
  extraSheets?: { name: string; columns: ReportColumnDef[]; rows: ReportRow[] }[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const addSheet = (name: string, cols: ReportColumnDef[], data: ReportRow[]) => {
    const ws = workbook.addWorksheet(name.slice(0, 31));
    ws.addRow(cols.map((c) => c.headerSq));
    for (const row of data) {
      ws.addRow(cols.map((c) => row[c.key] ?? ""));
    }
    ws.getRow(1).font = { bold: true };
  };

  addSheet(params.sheetName, params.columns, params.rows);
  if (params.extraSheets) {
    for (const sh of params.extraSheets) {
      addSheet(sh.name, sh.columns, sh.rows);
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function financePayrollWorkbookBuffer(params: {
  summaryColumns: ReportColumnDef[];
  summaryRows: ReportRow[];
  detailColumns: ReportColumnDef[];
  detailRows: ReportRow[];
}): Promise<Buffer> {
  return rowsToXlsxBuffer({
    sheetName: "Permbledhje",
    columns: params.summaryColumns,
    rows: params.summaryRows,
    extraSheets: [{ name: "Rreshta", columns: params.detailColumns, rows: params.detailRows }],
  });
}
