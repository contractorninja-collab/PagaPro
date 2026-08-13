"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, ChevronDown, Search, Settings2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertsSheet } from "@/components/layout/alerts-sheet";
import { SIDEBAR_MODULES } from "@/components/layout/nav-config";
import { PagaProLogo, PagaProMark } from "@/components/branding/logo";
import { logoutAction, switchActiveCompanyAction } from "@/modules/auth/actions/auth-actions";
import { cn } from "@/lib/utils";

export interface TopNavCompanyOption {
  id: string;
  label: string;
}

/** Center tabs = the 7 workforce modules; Konfigurimet lives under the company pill. */
const NAV_TABS = SIDEBAR_MODULES.filter((m) => m.href !== "/konfigurime");

function initialsOf(label: string | null | undefined): string {
  const trimmed = label?.trim();
  if (!trimmed) return "PR";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase() || "PR";
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppTopNav({
  activeCompanyLabel,
  activeCompanyId,
  companies = [],
  userLabel,
  userEmail,
  alertCount = 0,
  timeClockEnabled = false,
}: {
  activeCompanyLabel: string | null;
  activeCompanyId?: string | null;
  /** Every company this user can reach. One or none → no switcher is rendered. */
  companies?: TopNavCompanyOption[];
  userLabel?: string | null;
  userEmail?: string | null;
  alertCount?: number;
  /** Companies without the badge clock see no Prezenca tab — nothing changes for them. */
  timeClockEnabled?: boolean;
}) {
  const pathname = usePathname();
  const navTabs = NAV_TABS.filter((m) => !m.requiresTimeClock || timeClockEnabled);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const tenantMissing = activeCompanyLabel == null;
  /** Customers running several legal entities under one brand; everyone else sees no change. */
  const canSwitch = companies.length > 1;

  async function onLogout() {
    await logoutAction();
    window.location.assign("/hyrje");
  }

  async function onSwitchCompany(companyId: string) {
    if (switching || companyId === activeCompanyId) return;
    setSwitching(true);
    const res = await switchActiveCompanyAction(companyId);
    if (!res.ok) {
      toast.error(res.error);
      setSwitching(false);
      return;
    }
    // Full navigation, not router.push: every page reads the company from the cookie the
    // action just rewrote, so the whole tree has to be re-fetched.
    window.location.assign(res.redirectTo);
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/punonjesit?q=${encodeURIComponent(q)}` : "/punonjesit");
  }

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-4 bg-brand-navy px-4 md:gap-7 md:px-[26px]">
      <Link
        href="/paneli"
        className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-label="PagaPRO — ballina"
      >
        <span className="inline-flex items-center gap-2">
          <PagaProMark size={26} surface="bareOnDark" />
          <PagaProLogo variant="onDark" ariaHidden />
        </span>
      </Link>

      <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex" aria-label="Navigimi kryesor">
        {navTabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[34px] items-center rounded-lg px-[15px] text-[13.5px] transition-colors",
                active
                  ? "bg-white/[0.09] font-semibold text-white"
                  : "font-medium text-slate-400 hover:text-white",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2.5 md:flex-none">
        <form
          onSubmit={onSearch}
          className="hidden h-9 items-center gap-2 rounded-[9px] bg-white/[0.07] px-3 lg:flex"
          role="search"
        >
          <Search className="h-[15px] w-[15px] shrink-0 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko punonjës…"
            aria-label="Kërko punonjës"
            className="w-[140px] bg-transparent text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-[9px] bg-white/[0.07] px-3 transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Kompania aktive"
            >
              <Building2 className="h-[15px] w-[15px] shrink-0 text-slate-400" aria-hidden />
              <span
                className={cn(
                  "hidden max-w-[160px] truncate text-[13px] font-semibold sm:inline",
                  tenantMissing ? "text-amber-300" : "text-slate-100",
                )}
              >
                {tenantMissing ? "Pa kompani" : activeCompanyLabel}
              </span>
              <ChevronDown className="h-[14px] w-[14px] shrink-0 text-slate-500" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {canSwitch ? (
              <>
                <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                  Ndrysho kompaninë
                </DropdownMenuLabel>
                {companies.map((c) => {
                  const current = c.id === activeCompanyId;
                  return (
                    <DropdownMenuItem
                      key={c.id}
                      disabled={switching}
                      className="cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        void onSwitchCompany(c.id);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4 shrink-0", current ? "opacity-100" : "opacity-0")}
                        aria-hidden
                      />
                      <span className="truncate">{c.label}</span>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </>
            ) : (
              <>
                <DropdownMenuLabel className="truncate">
                  {tenantMissing ? "Nuk ka kompani aktive" : activeCompanyLabel}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/konfigurime">
                <Settings2 className="mr-2 h-4 w-4" aria-hidden />
                Konfigurimet
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/punonjesit">
                <Users className="mr-2 h-4 w-4" aria-hidden />
                Punonjësit
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertsSheet initialCount={alertCount} variant="topnav" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-brand-blue text-[12px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Profili"
            >
              {initialsOf(userLabel ?? userEmail)}
            </button>
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
