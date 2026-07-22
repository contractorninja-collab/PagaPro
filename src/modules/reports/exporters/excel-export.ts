import ExcelJS from "exceljs";
import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";
import type { CompanyLogoAsset } from "@/modules/company-branding/company-logo";

function addWorksheetLogo(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  logo: CompanyLogoAsset | null | undefined,
): number {
  if (!logo) return 1;
  const imageId = workbook.addImage({
    base64: `data:image/png;base64,${logo.bytes.toString("base64")}`,
    extension: "png",
  });
  const scale = Math.min(132 / logo.width, 68 / logo.height, 1);
  worksheet.addImage(imageId, {
    tl: { col: 0, row: 0 },
    ext: { width: logo.width * scale, height: logo.height * scale },
  });
  worksheet.getRow(1).height = 54;
  return 3;
}

export async function rowsToXlsxBuffer(params: {
  sheetName: string;
  columns: ReportColumnDef[];
  rows: ReportRow[];
  extraSheets?: { name: string; columns: ReportColumnDef[]; rows: ReportRow[] }[];
  logo?: CompanyLogoAsset | null;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const addSheet = (name: string, cols: ReportColumnDef[], data: ReportRow[]) => {
    const ws = workbook.addWorksheet(name.slice(0, 31));
    const headerRowNumber = addWorksheetLogo(workbook, ws, params.logo);
    while (ws.rowCount < headerRowNumber - 1) ws.addRow([]);
    ws.addRow(cols.map((c) => c.headerSq));
    for (const row of data) {
      ws.addRow(cols.map((c) => row[c.key] ?? ""));
    }
    ws.getRow(headerRowNumber).font = { bold: true };
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
  logo?: CompanyLogoAsset | null;
}): Promise<Buffer> {
  return rowsToXlsxBuffer({
    sheetName: "Permbledhje",
    columns: params.summaryColumns,
    rows: params.summaryRows,
    extraSheets: [{ name: "Rreshta", columns: params.detailColumns, rows: params.detailRows }],
    logo: params.logo,
  });
}
