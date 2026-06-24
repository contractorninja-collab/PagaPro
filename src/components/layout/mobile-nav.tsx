"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SIDEBAR_MODULES } from "@/components/layout/nav-config";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Navigimi kryesor mobil"
    >
      <div className="flex gap-1 overflow-x-auto px-2 pt-2 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SIDEBAR_MODULES.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px] font-medium leading-tight text-center",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="line-clamp-2 w-full">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
