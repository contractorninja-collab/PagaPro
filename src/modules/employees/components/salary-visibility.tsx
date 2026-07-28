"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maskAmount } from "@/modules/employees/components/mask-amount";

/**
 * A screen mask for pay figures, for when someone is standing behind you.
 *
 * This is deliberately *only* a mask: the amounts are still in the page payload
 * and anyone at the keyboard can switch them back on. It defeats a passer-by
 * reading over a shoulder, which is the whole threat it is meant to address —
 * it is not access control. Restricting who may see pay at all is a role
 * question, not a rendering one.
 *
 * The choice is remembered per browser so it survives navigation, and it covers
 * every surface that prints a salary at once. Masking the list but leaving the
 * profile open would be worse than not masking at all.
 */

const STORAGE_KEY = "pp_hide_salaries";

interface SalaryVisibility {
  hidden: boolean;
  toggle: () => void;
}

const SalaryVisibilityContext = createContext<SalaryVisibility>({
  hidden: false,
  toggle: () => {},
});

export function SalaryVisibilityProvider({ children }: { children: React.ReactNode }) {
  // Starts visible on the server so markup matches; the stored choice is
  // applied on mount.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);

  return (
    <SalaryVisibilityContext.Provider value={value}>{children}</SalaryVisibilityContext.Provider>
  );
}

export function useSalaryVisibility(): SalaryVisibility {
  return useContext(SalaryVisibilityContext);
}

/**
 * Renders a money figure, or a mask of the same width so the column does not
 * jump when it is toggled.
 */
export function MaskedAmount({ value }: { value: string }) {
  const { hidden } = useSalaryVisibility();
  if (!hidden) return <>{value}</>;
  return (
    <span aria-label="Shuma e fshehur" title="Shumat janë të fshehura">
      {maskAmount(value, true)}
    </span>
  );
}

export function SalaryVisibilityToggle() {
  const { hidden, toggle } = useSalaryVisibility();
  return (
    <Button
      type="button"
      variant="outlinePrimary"
      onClick={toggle}
      aria-pressed={hidden}
      title={hidden ? "Shfaq pagat" : "Fshih pagat nga ekrani"}
    >
      {hidden ? (
        <Eye className="h-4 w-4" aria-hidden />
      ) : (
        <EyeOff className="h-4 w-4" aria-hidden />
      )}
      {hidden ? "Shfaq pagat" : "Fshih pagat"}
    </Button>
  );
}
