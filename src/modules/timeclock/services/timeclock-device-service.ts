import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Kiosk devices authenticate with their own bearer token, never a user session.
 * A door tablet carrying someone's login would expose the whole app — payroll
 * included — to anyone who walks past it. A device token can do exactly two
 * things, both scoped to one company: resolve a badge to a display name, and
 * record a punch.
 */

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Human-readable, unambiguous pairing code (no O/0/I/1). */
function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[randomInt(0, alphabet.length)];
    if (i === 3) out += "-";
  }
  return out;
}

const PAIRING_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export interface TimeClockDeviceRow {
  id: string;
  label: string;
  location: string | null;
  isActive: boolean;
  pairedAt: string | null;
  lastSeenAt: string | null;
  /** Present only while the device is waiting to be paired. */
  pairingCode: string | null;
  pairingCodeExpired: boolean;
}

export async function listTimeClockDevices(companyId: string): Promise<TimeClockDeviceRow[]> {
  const rows = await prisma.timeClockDevice.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }],
  });

  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    location: row.location,
    isActive: row.isActive,
    pairedAt: row.pairedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    pairingCode: row.pairedAt ? null : row.pairingCode,
    pairingCodeExpired: Boolean(
      !row.pairedAt && row.pairingCodeExpires && row.pairingCodeExpires.getTime() < now,
    ),
  }));
}

export async function createTimeClockDevice(params: {
  companyId: string;
  label: string;
  location?: string | null;
  actorUserId?: string | null;
}): Promise<{ ok: true; id: string; pairingCode: string } | { ok: false; error: string }> {
  const label = params.label.trim();
  if (!label) return { ok: false, error: "Emri i pajisjes është i detyrueshëm." };

  try {
    const device = await prisma.timeClockDevice.create({
      data: {
        companyId: params.companyId,
        label,
        location: params.location?.trim() || null,
        // Replaced with the real hash at pairing; never a usable token on its own.
        tokenHash: `unpaired:${randomBytes(16).toString("hex")}`,
        pairingCode: generatePairingCode(),
        pairingCodeExpires: new Date(Date.now() + PAIRING_CODE_TTL_MS),
        createdById: params.actorUserId ?? undefined,
      },
      select: { id: true, pairingCode: true },
    });
    return { ok: true, id: device.id, pairingCode: device.pairingCode! };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Issues a fresh pairing code for a device that was never paired or needs re-pairing. */
export async function regenerateTimeClockPairingCode(
  companyId: string,
  deviceId: string,
): Promise<{ ok: true; pairingCode: string } | { ok: false; error: string }> {
  const device = await prisma.timeClockDevice.findFirst({
    where: { id: deviceId, companyId },
    select: { id: true },
  });
  if (!device) return { ok: false, error: "Pajisja nuk u gjet." };

  const pairingCode = generatePairingCode();
  await prisma.timeClockDevice.update({
    where: { id: device.id },
    data: {
      pairingCode,
      pairingCodeExpires: new Date(Date.now() + PAIRING_CODE_TTL_MS),
      // Re-pairing invalidates the old token immediately.
      tokenHash: `unpaired:${randomBytes(16).toString("hex")}`,
      pairedAt: null,
    },
  });
  return { ok: true, pairingCode };
}

export async function setTimeClockDeviceActive(
  companyId: string,
  deviceId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const updated = await prisma.timeClockDevice.updateMany({
    where: { id: deviceId, companyId },
    data: { isActive },
  });
  if (updated.count === 0) return { ok: false, error: "Pajisja nuk u gjet." };
  return { ok: true };
}

/**
 * Exchanges a single-use pairing code for a long-lived device token. The code is
 * cleared on success, so a code shown on a screen or sent over chat cannot be
 * replayed to enrol a second device.
 */
export async function redeemPairingCode(
  code: string,
): Promise<
  | { ok: true; token: string; deviceLabel: string; companyName: string }
  | { ok: false; error: string }
> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Kodi i lidhjes mungon." };

  const device = await prisma.timeClockDevice.findUnique({
    where: { pairingCode: normalized },
    include: { company: { select: { legalName: true, tradeName: true, timeClockEnabled: true } } },
  });
  if (!device) return { ok: false, error: "Kod i pavlefshëm lidhjeje." };
  if (!device.company.timeClockEnabled) {
    return { ok: false, error: "Moduli i orarit nuk është aktiv për këtë kompani." };
  }
  if (!device.isActive) return { ok: false, error: "Pajisja është çaktivizuar." };
  if (device.pairingCodeExpires && device.pairingCodeExpires.getTime() < Date.now()) {
    return { ok: false, error: "Kodi i lidhjes ka skaduar — gjeneroni një të ri." };
  }

  const token = randomBytes(32).toString("hex");
  await prisma.timeClockDevice.update({
    where: { id: device.id },
    data: {
      tokenHash: hashDeviceToken(token),
      pairingCode: null,
      pairingCodeExpires: null,
      pairedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  return {
    ok: true,
    token,
    deviceLabel: device.label,
    companyName: device.company.tradeName?.trim() || device.company.legalName,
  };
}

export interface AuthenticatedDevice {
  id: string;
  companyId: string;
  label: string;
}

/** Resolves a bearer token to its device, or null. Also refreshes lastSeenAt. */
export async function authenticateDevice(token: string | null): Promise<AuthenticatedDevice | null> {
  if (!token) return null;
  const trimmed = token.trim();
  if (trimmed.length < 32) return null;

  const device = await prisma.timeClockDevice.findUnique({
    where: { tokenHash: hashDeviceToken(trimmed) },
    include: { company: { select: { timeClockEnabled: true, status: true } } },
  });
  if (!device || !device.isActive || !device.pairedAt) return null;
  if (!device.company.timeClockEnabled || device.company.status !== "ACTIVE") return null;

  await prisma.timeClockDevice
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return { id: device.id, companyId: device.companyId, label: device.label };
}
