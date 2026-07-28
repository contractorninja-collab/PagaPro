import type { Metadata } from "next";
import { KioskScreen } from "@/modules/timeclock/components/kiosk-screen";

export const metadata: Metadata = {
  title: "Skano",
  robots: { index: false, follow: false },
};

/**
 * The door screen. Top-level route so it inherits only the root layout — no app
 * chrome, no navigation, nothing a passer-by could click through into payroll.
 */
export default function KioskPage() {
  return <KioskScreen />;
}
