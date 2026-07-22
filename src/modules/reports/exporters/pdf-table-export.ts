import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";
import { toPdfStandardFontText } from "@/modules/payroll/helpers/pdf-standard-font-text";
import type { CompanyLogoAsset } from "@/modules/company-branding/company-logo";
import { drawCompanyLogoPlate, embedCompanyLogo } from "@/modules/company-branding/pdf-logo-branding";

export async function rowsToPdfTableBuffer(params: {
  title: string;
  subtitle?: string;
  columns: ReportColumnDef[];
  rows: ReportRow[];
  logo?: CompanyLogoAsset | null;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const companyLogo = await embedCompanyLogo(pdf, params.logo);

  const margin = 40;
  const lineHeight = 12;
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  let page = pdf.addPage([pageWidth, pageHeight]);
  const drawPageBranding = () => {
    if (!companyLogo) return;
    drawCompanyLogoPlate(page, companyLogo, { x: margin, top: pageHeight - 12 });
  };
  drawPageBranding();
  let y = pageHeight - (companyLogo ? 88 : 48);

  const newPageIfNeeded = () => {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      drawPageBranding();
      y = pageHeight - (companyLogo ? 88 : 48);
    }
  };

  const writeLine = (text: string, size: number, useBold: boolean) => {
    newPageIfNeeded();
    page.drawText(toPdfStandardFontText(text.slice(0, 180)), {
      x: margin,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= lineHeight * (size > 10 ? 1.6 : 1.15);
  };

  writeLine(params.title, 13, true);
  if (params.subtitle) writeLine(params.subtitle, 9, false);

  const header = params.columns.map((c) => c.headerSq).join("  |  ");
  writeLine(header, 8, true);

  for (const row of params.rows) {
    const line = params.columns.map((c) => String(row[c.key] ?? "")).join("  |  ");
    writeLine(line.slice(0, 180), 7, false);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
