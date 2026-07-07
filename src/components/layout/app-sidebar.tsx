"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2 } from "lucide-react";
import { PagaProLogo } from "@/components/branding/logo";
import { SIDEBAR_MODULES } from "@/components/layout/nav-config";
import { sidebarItemClass } from "@/components/layout/sidebar-styles";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar-shell">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-[18px]">
        <PagaProLogo variant="onDark" asLink aria-label="PagaPRO — ballina" />
      </div>
      <nav className="sidebar-nav" aria-label="Moduli kryesor">
        {SIDEBAR_MODULES.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={sidebarItemClass(active)}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <Link href="/konfigurime" className="sidebar-footer-link">
          <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Konfigurimet · v1.0.0</span>
        </Link>
      </div>
    </aside>
  );
}
