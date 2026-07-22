import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import {
  COMPANY_LOGO_MAX_HEIGHT_MM,
  COMPANY_LOGO_MAX_WIDTH_MM,
  containDimensions,
  type CompanyLogoAsset,
} from "@/modules/company-branding/company-logo";

const MM_TO_POINTS = 72 / 25.4;
const PLATE_PADDING = 4;

export interface EmbeddedCompanyLogo {
  image: PDFImage;
  width: number;
  height: number;
}

export async function embedCompanyLogo(
  pdf: PDFDocument,
  logo: CompanyLogoAsset | null | undefined,
): Promise<EmbeddedCompanyLogo | null> {
  if (!logo) return null;
  const size = containDimensions(
    logo.width,
    logo.height,
    COMPANY_LOGO_MAX_WIDTH_MM * MM_TO_POINTS,
    COMPANY_LOGO_MAX_HEIGHT_MM * MM_TO_POINTS,
  );
  return { image: await pdf.embedPng(logo.bytes), ...size };
}

export function drawCompanyLogoPlate(
  page: PDFPage,
  logo: EmbeddedCompanyLogo | null,
  options: { x: number; top: number },
): number {
  if (!logo) return options.x;
  const plateWidth = COMPANY_LOGO_MAX_WIDTH_MM * MM_TO_POINTS + PLATE_PADDING * 2;
  const plateHeight = COMPANY_LOGO_MAX_HEIGHT_MM * MM_TO_POINTS + PLATE_PADDING * 2;
  const plateY = options.top - plateHeight;
  page.drawRectangle({
    x: options.x,
    y: plateY,
    width: plateWidth,
    height: plateHeight,
    color: rgb(1, 1, 1),
    opacity: 1,
  });
  page.drawImage(logo.image, {
    x: options.x + PLATE_PADDING,
    y: plateY + (plateHeight - logo.height) / 2,
    width: logo.width,
    height: logo.height,
  });
  return options.x + plateWidth;
}
