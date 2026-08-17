"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { capabilityDeniedMessage, type Capability } from "@/server/permissions";

/**
 * What the signed-in user may change, handed to the client once by the
 * dashboard layout.
 *
 * The server has always been the real gate — every mutating action calls
 * `requireCapability` and refuses correctly. What was missing was the UI half:
 * a READ_ONLY member saw every button in the app, clicked one, and met an error
 * toast. The refusal was right and the invitation to try was wrong.
 *
 * This never becomes the authorisation. It decides what to *offer*. Anything
 * that slips through still hits `requireCapability` and still fails, so a bug
 * here shows an unusable button — never an unauthorised write.
 *
 * `src/server/permissions.ts` is safe to import from a client component: its
 * only import is a type, which is erased, and the rest is a plain lookup table.
 */

const CapabilityContext = createContext<ReadonlySet<Capability> | null>(null);

export function CapabilityProvider({
  capabilities,
  children,
}: {
  capabilities: readonly Capability[];
  children: ReactNode;
}) {
  const value = useMemo(() => new Set(capabilities), [capabilities]);
  return <CapabilityContext.Provider value={value}>{children}</CapabilityContext.Provider>;
}

/**
 * True when the user holds the capability.
 *
 * Outside a provider this returns FALSE rather than throwing or defaulting to
 * true. Not knowing must not grant: an over-hidden control is a visible bug
 * somebody reports in a minute, while an over-offered one is the exact failure
 * this module exists to remove. The admin console lives under its own layout
 * and does not render these components.
 */
export function useCan(capability: Capability): boolean {
  const held = useContext(CapabilityContext);
  return held?.has(capability) ?? false;
}

/**
 * For controls that stay visible but inert — inline row actions, where hiding
 * would make rows change shape depending on who is looking. Spread onto a
 * button: it carries the disabled state and, as a tooltip, the same Albanian
 * sentence the server would have returned.
 */
export function useCapabilityGate(capability: Capability): {
  allowed: boolean;
  disabled: boolean;
  title: string | undefined;
} {
  const allowed = useCan(capability);
  return {
    allowed,
    disabled: !allowed,
    title: allowed ? undefined : capabilityDeniedMessage(capability),
  };
}
