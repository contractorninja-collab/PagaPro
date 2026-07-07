import { cn } from "@/lib/utils";

/** Fixed sidebar width — keep shell offset in sync. */
export const SIDEBAR_SHELL_OFFSET = "md:pl-[280px]";

export function sidebarItemClass(active: boolean): string {
  return cn("sidebar-item", active && "sidebar-item-active");
}
