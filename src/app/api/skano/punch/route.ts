import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDevice } from "@/modules/timeclock/services/timeclock-device-service";
import {
  recentPunchFeed,
  recordBadgePunch,
} from "@/modules/timeclock/services/timeclock-punch-service";

const bodySchema = z.object({
  badgeCode: z.string().min(1).max(64),
  /** Device clock, sent so a queued offline scan keeps its original time. */
  deviceReportedAt: z.string().datetime().optional(),
});

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

/**
 * The only write a door tablet can make. Authenticated by device token, scoped
 * to that device's company — a stolen token can record attendance and read back
 * the same screen the tablet already shows, and nothing else.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const device = await authenticateDevice(bearer(req));
  if (!device) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Pajisja nuk është e lidhur." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Kërkesë e pavlefshme." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Kodi i skanuar është bosh." }, { status: 400 });
  }

  const outcome = await recordBadgePunch({
    companyId: device.companyId,
    badgeCode: parsed.data.badgeCode,
    deviceId: device.id,
    deviceReportedAt: parsed.data.deviceReportedAt
      ? new Date(parsed.data.deviceReportedAt)
      : null,
  });

  if (!outcome.ok) {
    return NextResponse.json(outcome, {
      status: outcome.code === "ERROR" ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const feed = await recentPunchFeed(device.companyId);

  return NextResponse.json(
    {
      ok: true,
      result: { ...outcome.result, occurredAt: outcome.result.occurredAt.toISOString() },
      feed,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Feed refresh for a screen that has been idle — same auth, no write. */
export async function GET(req: Request): Promise<NextResponse> {
  const device = await authenticateDevice(bearer(req));
  if (!device) {
    return NextResponse.json(
      { ok: false, error: "Pajisja nuk është e lidhur." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const feed = await recentPunchFeed(device.companyId);
  return NextResponse.json(
    { ok: true, deviceLabel: device.label, feed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
