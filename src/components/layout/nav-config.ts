import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Settings2,
  Users,
  Landmark,
  FileText,
  Palmtree,
  AlarmClock,
  UserMinus,
  BarChart3,
} from "lucide-react";

/** Albanian navigation labels — workforce modules */
export interface SidebarModule {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Set when the module only exists for companies with an entitlement flag.
   * Shells filter on it; the page itself re-checks server-side — hiding a nav
   * item is presentation, not a gate.
   */
  requiresTimeClock?: true;
}

export const SIDEBAR_MODULES: SidebarModule[] = [
  { href: "/paneli", label: "Paneli", icon: LayoutDashboard },
  { href: "/konfigurime", label: "Konfigurimet", icon: Settings2 },
  { href: "/punonjesit", label: "Punonjësit", icon: Users },
  { href: "/prezenca", label: "Prezenca", icon: AlarmClock, requiresTimeClock: true },
  { href: "/pagat", label: "Pagat", icon: Landmark },
  { href: "/dokumentet", label: "Dokumentet", icon: FileText },
  { href: "/pushimet", label: "Pushimet", icon: Palmtree },
  { href: "/largimet", label: "Largimet", icon: UserMinus },
  { href: "/raportet", label: "Raportet", icon: BarChart3 },
];
