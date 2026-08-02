"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PAYROLL_HERO_COOKIE } from "../helpers/dashboard-cookies";

/**
 * Folding the payroll hero away.
 *
 * Only the *choice* lives on the client. Both the full hero and the folded strip
 * are rendered on the server and handed in as slots, because they print money —
 * and `formatEur` resolves the sq-XK locale differently in Node than in a
 * browser, so the same figure would change shape the moment it re-rendered here.
 * Keeping the euros server-side means folding cannot alter a single number.
 *
 * The choice is remembered in a cookie rather than localStorage so the server
 * knows it during the first paint: a folded hero is born folded, instead of
 * unfolding for a frame and snapping shut on every page load. The cookie's name
 * lives in a plain module — see `helpers/dashboard-cookies`.
 */

interface PayrollHeroFold {
  collapsed: boolean;
  toggle: () => void;
}

const PayrollHeroFoldContext = createContext<PayrollHeroFold>({
  collapsed: false,
  toggle: () => {},
});

export function PayrollHeroFoldProvider({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        // A year, path-wide. If it fails (private mode) the choice simply does
        // not outlive the page — never worth breaking the dashboard over.
        document.cookie = `${PAYROLL_HERO_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        /* preference only */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  return (
    <PayrollHeroFoldContext.Provider value={value}>{children}</PayrollHeroFoldContext.Provider>
  );
}

/** Picks between two server-rendered layouts without re-rendering either. */
export function PayrollHeroFoldSwitch({
  expanded,
  collapsed,
}: {
  expanded: ReactNode;
  collapsed: ReactNode;
}) {
  const fold = useContext(PayrollHeroFoldContext);
  return <>{fold.collapsed ? collapsed : expanded}</>;
}

/** The chevron itself, embedded in whichever server-rendered header is showing. */
export function PayrollHeroFoldToggle() {
  const { collapsed, toggle } = useContext(PayrollHeroFoldContext);
  const Icon = collapsed ? ChevronDown : ChevronUp;
  const label = collapsed ? "Zgjero ciklin e pagës" : "Palos ciklin e pagës";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      title={label}
      className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[#8b95a7] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
}
