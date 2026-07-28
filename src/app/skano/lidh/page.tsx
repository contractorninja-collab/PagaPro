import type { Metadata } from "next";
import { KioskPairing } from "@/modules/timeclock/components/kiosk-pairing";

export const metadata: Metadata = {
  title: "Lidh pajisjen",
  robots: { index: false, follow: false },
};

/** One-time enrolment: a pairing code from HR becomes this tablet's device token. */
export default async function KioskPairingPage({
  searchParams,
}: {
  searchParams: Promise<{ kod?: string }>;
}) {
  const { kod } = await searchParams;
  return <KioskPairing initialCode={kod ?? ""} />;
}
