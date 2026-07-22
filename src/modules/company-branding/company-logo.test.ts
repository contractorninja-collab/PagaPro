import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { DocumentStorage } from "@/modules/documents/engine/storage/types";
import sharp from "sharp";
import {
  COMPANY_LOGO_MAX_UPLOAD_BYTES,
  normalizeCompanyLogo,
  loadCompanyLogo,
} from "@/modules/company-branding/company-logo";

async function raster(format: "png" | "jpeg" | "webp", width = 1200, height = 400): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 30, g: 120, b: 210, alpha: 0.7 } },
  })
    .toFormat(format)
    .toBuffer();
}

describe("company logo normalization", () => {
  it.each([
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
  ] as const)("accepts %s and returns a contained PNG", async (format, mime) => {
    const normalized = await normalizeCompanyLogo(await raster(format), mime);
    const metadata = await sharp(normalized.bytes).metadata();
    expect(metadata.format).toBe("png");
    expect(normalized.width).toBeLessThanOrEqual(600);
    expect(normalized.height).toBeLessThanOrEqual(310);
    expect(normalized.width / normalized.height).toBeCloseTo(3, 1);
  });

  it("rejects an unsupported declared type", async () => {
    await expect(normalizeCompanyLogo(await raster("png"), "image/gif")).rejects.toThrow(
      "INVALID_LOGO_FILE_TYPE",
    );
  });

  it("rejects oversized and corrupt files", async () => {
    await expect(
      normalizeCompanyLogo(Buffer.alloc(COMPANY_LOGO_MAX_UPLOAD_BYTES + 1), "image/png"),
    ).rejects.toThrow("LOGO_FILE_TOO_LARGE");
    await expect(normalizeCompanyLogo(Buffer.from("not an image"), "image/png")).rejects.toThrow(
      "INVALID_LOGO_IMAGE",
    );
  });

  it("loads only the requested tenant's configured key", async () => {
    const bytes = await raster("png", 200, 100);
    const findUnique = vi.fn().mockResolvedValue({
      companyLogoStorageKey: "companies/company-a/branding/logo.png",
    });
    const get = vi.fn().mockResolvedValue(bytes);
    const prisma = { companySetting: { findUnique } } as unknown as PrismaClient;
    const storage = { get } as unknown as DocumentStorage;

    const asset = await loadCompanyLogo(prisma, storage, "company-a");
    expect(findUnique).toHaveBeenCalledWith({
      where: { companyId: "company-a" },
      select: { companyLogoStorageKey: true },
    });
    expect(get).toHaveBeenCalledWith("companies/company-a/branding/logo.png");
    expect(asset?.width).toBe(200);
  });

  it("falls back to unbranded output when the stored logo is unreadable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const prisma = {
      companySetting: {
        findUnique: vi.fn().mockResolvedValue({ companyLogoStorageKey: "companies/a/branding/missing.png" }),
      },
    } as unknown as PrismaClient;
    const storage = { get: vi.fn().mockRejectedValue(new Error("missing")) } as unknown as DocumentStorage;

    await expect(loadCompanyLogo(prisma, storage, "a")).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
