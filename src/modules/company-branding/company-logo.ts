import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import type { DocumentStorage } from "@/modules/documents/engine/storage/types";

export const COMPANY_LOGO_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const COMPANY_LOGO_MAX_PIXEL_WIDTH = 600;
export const COMPANY_LOGO_MAX_PIXEL_HEIGHT = 310;
export const COMPANY_LOGO_MAX_WIDTH_MM = 35;
export const COMPANY_LOGO_MAX_HEIGHT_MM = 18;
export const COMPANY_LOGO_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface CompanyLogoAsset {
  bytes: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
}

export function companyLogoStorageKey(companyId: string): string {
  return `companies/${companyId}/branding/${randomUUID()}-logo.png`;
}

export async function normalizeCompanyLogo(bytes: Buffer, declaredMime: string): Promise<CompanyLogoAsset> {
  if (!COMPANY_LOGO_ALLOWED_MIME.has(declaredMime)) throw new Error("INVALID_LOGO_FILE_TYPE");
  if (bytes.length > COMPANY_LOGO_MAX_UPLOAD_BYTES) throw new Error("LOGO_FILE_TOO_LARGE");

  try {
    const source = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 });
    const metadata = await source.metadata();
    if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) {
      throw new Error("INVALID_LOGO_FILE_TYPE");
    }

    const result = await source
      .rotate()
      .resize({
        width: COMPANY_LOGO_MAX_PIXEL_WIDTH,
        height: COMPANY_LOGO_MAX_PIXEL_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer({ resolveWithObject: true });

    return {
      bytes: result.data,
      width: result.info.width,
      height: result.info.height,
      mimeType: "image/png",
    };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_LOGO_FILE_TYPE") throw error;
    throw new Error("INVALID_LOGO_IMAGE");
  }
}

export async function loadCompanyLogo(
  prisma: PrismaClient,
  storage: DocumentStorage,
  companyId: string,
): Promise<CompanyLogoAsset | null> {
  const settings = await prisma.companySetting.findUnique({
    where: { companyId },
    select: { companyLogoStorageKey: true },
  });
  const key = settings?.companyLogoStorageKey;
  if (!key) return null;

  try {
    const bytes = await storage.get(key);
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height || metadata.format !== "png") {
      throw new Error("Stored logo is not a normalized PNG");
    }
    return { bytes, width: metadata.width, height: metadata.height, mimeType: "image/png" };
  } catch (error) {
    console.warn(`[pagapro] company logo could not be loaded for company ${companyId}; continuing unbranded.`, error);
    return null;
  }
}

export function containDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * scale, height: height * scale };
}
