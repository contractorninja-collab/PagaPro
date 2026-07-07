"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PagaProLogoCompact, PagaProMark } from "@/components/branding/logo";
import { logoutAction } from "@/modules/auth/actions/auth-actions";
import { cn } from "@/lib/utils";
import { AlertsSheet } from "@/components/layout/alerts-sheet";

function initialsOf(label: string | null | undefined): string {
  const trimmed = label?.trim();
  if (!trimmed) return "PR";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase() || "PR";
}

export function AppHeader({
  activeCompanyLabel,
  userLabel,
  userEmail,
  alertCount,
}: {
  activeCompanyLabel: string | null;
  userLabel?: string | null;
  userEmail?: string | null;
  alertCount?: number;
}) {
  const pathname = usePathname();
  const tenantMissing = activeCompanyLabel == null;

  async function onLogout() {
    await logoutAction();
    window.location.assign("/hyrje");
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href="/paneli"
          className="flex items-center gap-2 rounded-sm md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="PagaPRO — ballina"
        >
          <PagaProMark size={28} rounded="sm" />
          <PagaProLogoCompact ariaHidden />
        </Link>
        <div className="flex max-w-[min(100%,18rem)] shrink items-center gap-2 rounded-md border border-input bg-secondary px-3 py-1.5 text-sm md:max-w-[min(100%,20rem)]">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className={cn("truncate", tenantMissing ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
            {tenantMissing ? "Nuk ka kompani aktive" : activeCompanyLabel}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="sr-only">Faqja aktive: {pathname}</span>
        <AlertsSheet initialCount={alertCount ?? 0} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Profili">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-medium">{initialsOf(userLabel ?? userEmail)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate">
              {userLabel?.trim() || userEmail || "Llogaria"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/ndrysho-fjalekalimin">Ndrysho fjalëkalimin</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onSelect={() => void onLogout()}
            >
              Dilni
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
