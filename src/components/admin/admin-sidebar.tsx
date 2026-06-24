"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PagaProLogo } from "@/components/branding/logo";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_NAV: AdminNavItem[] = [{ href: "/admin/bizneset", label: "Bizneset", icon: Building2 }];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-30 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <PagaProLogo variant="onDark" asLink aria-label="PagaPRO — ballina" />
        <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground">
          Admin
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5" aria-label="Konsola e administratorit">
        {ADMIN_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <p className="text-[11px] leading-relaxed text-sidebar-muted">Konsola e administratorit të platformës</p>
      </div>
    </aside>
  );
}
