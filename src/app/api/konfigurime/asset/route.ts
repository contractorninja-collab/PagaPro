import { NextRequest } from "next/server";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { assertCompanyScopedStorageKey } from "@/server/company-scope";

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

/**
 * Only the two branding prefixes are servable here. The company prefix alone
 * is not enough: `companies/{companyId}/employees/…/documents/` now holds
 * personnel files whose sensitive categories are role-gated on their own
 * route — a generic key-to-bytes endpoint must not become a bypass for that.
 */
const SERVABLE_PREFIXES = ["branding/", "authorized-reps/"];

/** Streams an authorized-representative asset after tenant + prefix checks. */
export async function GET(req: NextRequest) {
  const result = await getCompanyContext();
  if (!result.ok) {
    return companyContextHttpError(result.reason);
  }
  const { companyId } = result.context;

  const key = req.nextUrl.searchParams.get("key")?.trim();
  if (!key) {
    return new Response("Missing key", { status: 400 });
  }

  try {
    assertCompanyScopedStorageKey(companyId, key);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const rest = key.slice(`companies/${companyId}/`.length);
  if (!SERVABLE_PREFIXES.some((p) => rest.startsWith(p))) {
    return new Response("Forbidden", { status: 403 });
  }

  const storage = getCompanyAssetStorage();
  const exists = await storage.exists(key);
  if (!exists) {
    return new Response("Not found", { status: 404 });
  }

  const buf = await storage.get(key);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentTypeForKey(key),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
