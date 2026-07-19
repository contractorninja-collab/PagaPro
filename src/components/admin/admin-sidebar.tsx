"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, type LucideIcon } from "lucide-react";
import { PagaProLogo } from "@/components/branding/logo";
import { sidebarItemClass } from "@/components/layout/sidebar-styles";
import { adminPath } from "@/lib/admin-path";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_NAV: AdminNavItem[] = [{ href: adminPath("bizneset"), label: "Bizneset", icon: Building2 }];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar-shell">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-[18px]">
        <PagaProLogo variant="onDark" asLink aria-label="PagaPRO — ballina" />
        <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Admin
        </span>
      </div>
      <nav className="sidebar-nav" aria-label="Konsola e administratorit">
        {ADMIN_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        <p className="px-[18px] text-[11px] leading-relaxed text-sidebar-muted">
          Konsola e administratorit të platformës
        </p>
      </div>
    </aside>
  );
}
