import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Settings2,
  Users,
  Landmark,
  FileText,
  Palmtree,
  UserMinus,
  BarChart3,
} from "lucide-react";

/** Albanian navigation labels — workforce modules */
export interface SidebarModule {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const SIDEBAR_MODULES: SidebarModule[] = [
  { href: "/paneli", label: "Paneli", icon: LayoutDashboard },
  { href: "/konfigurime", label: "Konfigurimet", icon: Settings2 },
  { href: "/punonjesit", label: "Punonjësit", icon: Users },
  { href: "/pagat", label: "Pagat", icon: Landmark },
  { href: "/dokumentet", label: "Dokumentet", icon: FileText },
  { href: "/pushimet", label: "Pushimet", icon: Palmtree },
  { href: "/largimet", label: "Largimet", icon: UserMinus },
  { href: "/raportet", label: "Raportet", icon: BarChart3 },
];
