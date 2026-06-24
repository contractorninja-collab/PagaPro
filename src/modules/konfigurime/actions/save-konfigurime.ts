"use server";

import { randomUUID } from "node:crypto";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { prisma } from "@/lib/prisma";
import {
  formatKonfigurimeFieldErrors,
  konfigurimePayloadSchema,
} from "@/modules/konfigurime/validation/konfigurime-schemas";
import { persistKonfigurimeSave } from "@/modules/konfigurime/services/konfigurime-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 3 * 1024 * 1024;

function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

async function storeRepAsset(companyId: string, kind: "signature" | "stamp", file: File): Promise<string> {
  const mime = file.type;
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("INVALID_FILE_TYPE");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("FILE_TOO_LARGE");
  const key = `companies/${companyId}/authorized-reps/${randomUUID()}-${kind}.${extForMime(mime)}`;
  await getCompanyAssetStorage().put(key, buf, { contentType: mime });
  return key;
}

export type SaveKonfigurimeResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function saveKonfigurimeAction(formData: FormData): Promise<SaveKonfigurimeResult> {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    return {
      ok: false,
      error:
        "Nuk ka kompani aktive. Vendosni cookie-in pp_active_company_id, variablën DEV_DEFAULT_COMPANY_ID, ose përdorni POST /api/dev/active-company (vetëm në development).",
    };
  }

  const companyExists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!companyExists) {
    return { ok: false, error: "Kompania nuk ekziston." };
  }

  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return { ok: false, error: "Payload jo valid." };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Payload JSON jo valid." };
  }

  const parsed = konfigurimePayloadSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem korrigjoni fushat e theksuara.",
      fieldErrors: formatKonfigurimeFieldErrors(parsed.error),
    };
  }

  const assetKeys = new Map<number, { signatureStorageKey?: string; stampStorageKey?: string }>();
  const repCount = parsed.data.representatives.length;

  try {
    for (let i = 0; i < repCount; i++) {
      const sig = formData.get(`signature_${i}`);
      const stamp = formData.get(`stamp_${i}`);
      const patch: { signatureStorageKey?: string; stampStorageKey?: string } = {};

      if (sig instanceof File && sig.size > 0) {
        patch.signatureStorageKey = await storeRepAsset(companyId, "signature", sig);
      }
      if (stamp instanceof File && stamp.size > 0) {
        patch.stampStorageKey = await storeRepAsset(companyId, "stamp", stamp);
      }

      if (patch.signatureStorageKey || patch.stampStorageKey) {
        assetKeys.set(i, patch);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ngarkimi dështoi.";
    if (msg === "INVALID_FILE_TYPE") {
      return { ok: false, error: "Lejohen vetëm PNG, JPEG ose WebP për nënshkrim dhe vulë." };
    }
    if (msg === "FILE_TOO_LARGE") {
      return { ok: false, error: "Skedari është shumë i madh (maks. 3 MB)." };
    }
    return { ok: false, error: msg };
  }

  try {
    await persistKonfigurimeSave(companyId, parsed.data, assetKeys);
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Ruajtja në databazë dështoi." };
  }

  return { ok: true };
}
