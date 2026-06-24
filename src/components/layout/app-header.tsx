"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, ChevronDown } from "lucide-react";
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
}: {
  activeCompanyLabel: string | null;
  userLabel?: string | null;
  userEmail?: string | null;
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="max-w-[min(100%,18rem)] shrink truncate md:max-w-[min(100%,20rem)]"
              aria-label="Ndërro kompaninë"
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className={tenantMissing ? "truncate text-amber-700 dark:text-amber-400" : "truncate"}>
                {tenantMissing ? "Nuk ka kompani aktive" : activeCompanyLabel}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Kompania aktive</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground">
              {tenantMissing
                ? "Vendosni kompaninë (cookie pp_active_company_id ose zgjedhja Dev te Pagat)."
                : "Ndërrimi i kompanive së shpejti."}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="sr-only">Faqja aktive: {pathname}</span>
        <Button variant="ghost" size="icon" type="button" aria-label="Njoftime">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Button>
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
