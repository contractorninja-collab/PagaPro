import { NextResponse } from "next/server";
import { z } from "zod";
import { redeemPairingCode } from "@/modules/timeclock/services/timeclock-device-service";

const bodySchema = z.object({
  code: z.string().min(4).max(32),
});

/**
 * Exchanges a single-use pairing code for a device token. Unauthenticated by
 * design — the code *is* the credential, it is single-use, and it expires.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Kërkesë e pavlefshme." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Kodi i lidhjes mungon." }, { status: 400 });
  }

  const result = await redeemPairingCode(parsed.data.code);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
